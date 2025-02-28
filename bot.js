// @sherpa_testbot

import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import { Alchemy, Network } from "alchemy-sdk";
import fetch from "node-fetch";

// Настройки Alchemy
const alchemy = new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY, // Укажите ваш API-ключ Alchemy
    network: Network.SOL_MAINNET, // Solana Mainnet
});
// Настройки SOLANA_RPC
const solanaRpcUrl = process.env.SOLANA_RPC_URL;
var connection = new Connection(solanaRpcUrl, 'confirmed');

const rpcUrls = [
    'https://solana-api.projectserum.com',
    'https://api.mainnet-beta.solana.com',
    'https://rpc.safecoin.org',
    'https://rpc.ankr.com/solana'
];

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply("This is the token analyzer. Please send the token address to get info about it.");
});

bot.on('text', async (ctx) => {
    const tokenAddress = ctx.message.text.trim();

    if (!isValidSolanaAddress(tokenAddress)) {
        return ctx.reply("Wrong token address, please send the correct one.");
    }

    try {
        // Получаем ликвидность токена через Dexscreener
        const liquidityData = await getLiquidity(tokenAddress);

        // Получаем последнюю транзакцию покупки через Solana RPC
        var lastTransaction = await getLastTokenTransaction(tokenAddress);

        if (!lastTransaction) {
            // Получаем последнюю транзакцию покупки через Alchemy
            // lastTransaction = await getLastTokenTransaction2(tokenAddress);
            
            if (lastTransaction == 0) {
                return ctx.reply("No purchase transactions found for this token.");              
            }
            else if (!lastTransaction) {
                return ctx.reply("Server responded with 429 Too Many Requests.");
            }
        }

        const { slot, wallet, amount, signature } = lastTransaction;

        // Отправляем информацию пользователю
        ctx.reply(
            `📊 Token Analysis:\n` +
            `💰 Liquidity: $${liquidityData || "N/A"}\n` +
            `\n📌 Last Buy Transaction:\n` +
            `🔹 Tx Signature: ${signature}\n` +
            `🔹 Slot: ${slot}\n` +
            `🔹 Wallet: ${wallet}\n` +
            `🔹 Amount: ${amount} \n`,
            Markup.inlineKeyboard([Markup.button.callback("🔙 Back", "BACK")])
        );

    } catch (error) {
        console.error("Error:", error);
        ctx.reply("Failed to get token info. Please try again later.");
    }
});

// Кнопка "Back"
bot.action("BACK", (ctx) => {
    ctx.reply("Please send the token address to get info about it.");
});

// Функция проверки валидности Solana-адреса
function isValidSolanaAddress(address) {
    try {
        new PublicKey(address);
        return true;
    } catch (e) {
        return false;
    }
}

// Функция получения ликвидности через Dexscreener
async function getLiquidity(tokenAddress) {
    try {
        const response = await axios.get(`${process.env.DEXSCREENER_API_URL}${tokenAddress}`);
        const pair = response.data.pairs.find(pair => pair.baseToken.address === tokenAddress);
        return pair ? pair.liquidity.usd : null;
    } catch (error) {
        console.error("Dexscreener API error:", error);
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function getLastTokenTransaction(tokenAddress) {
    try {
        const tokenPubKey = new PublicKey(tokenAddress);

        // Получаем последние транзакции для токена
        const confirmedTxs = await connection.getSignaturesForAddress(tokenPubKey, { limit: 10 });

        for (const txInfo of confirmedTxs) {
            const txDetails = await connection.getTransaction(txInfo.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });

            // 🔹 Выводим кошелек породивший транзакцию
            const walletTransact = txDetails.transaction.message.staticAccountKeys[0].toBase58();;
            console.log("🔍 кошелек породивший транзакцию:", walletTransact);

            // 🔹 Выводим полные данные транзакции в консоль
            // console.log("🔍 Полные детали транзакции:", JSON.stringify(txDetails, null, 2));

            if (txDetails && txDetails.meta && txDetails.meta.postTokenBalances) {
                var secondToken = ""
                var slot = 0
                var wallet = ""
                var amount = 0
                var signature = ""

                for (let i = 0; i < txDetails.meta.postTokenBalances.length; i++) {

                    const balance = txDetails.meta.postTokenBalances[i];
                    const preBalance = txDetails.meta.preTokenBalances?.[i];
                    if (balance.mint !== tokenAddress) {
                        secondToken = balance.mint
                    }
                    
                    // Ищем покупку токена — это когда баланс увеличивается у получателя токена
                    if (
                        balance.mint === tokenAddress && // Проверяем, что это нужный токен
                        preBalance &&
                        balance.uiTokenAmount.uiAmount > preBalance.uiTokenAmount.uiAmount && // Увеличение баланса
                        balance.owner === walletTransact &&   // получатель - кошелек породивший транзакцию
                        amount <= 0
                    ) {
                        // Сохраняем информацию о последней покупке токена
                        amount = balance.uiTokenAmount.uiAmount - preBalance.uiTokenAmount.uiAmount;
                        wallet = balance.owner || 'Неизвестный кошелек';
                        slot = txDetails.slot
                        signature = txInfo.signature
                    }

                    if (secondToken !== "" && amount > 0) {  // все что нужно найдено
                        break;
                    }
                    await delay(1000); // Ждём 1 секунду
                }
                if (secondToken !== "" && slot && wallet && signature) {
                    // Возвращаем информацию о последней покупке токена
                    return {
                        slot,
                        wallet,
                        amount,
                        signature,
                    };
                }
            }
        }

        return 0; // Если покупок не найдено
    } catch (error) {
        console.error("Ошибка получения транзакции:", error);
        return null;  // Если ошибка, например Too Many Requests
    }
}



bot.launch().then(() => console.log("✅ Bot is running..."));
