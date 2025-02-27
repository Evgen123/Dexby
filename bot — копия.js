// @sherpa_testbot

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { Connection, PublicKey } = require('@solana/web3.js');
import { Alchemy, Network } from "alchemy-sdk";

const bot = new Telegraf(process.env.BOT_TOKEN);
const solanaRpcUrl = process.env.SOLANA_RPC_URL;//  || process.env.ALCHEMY_RPC_URL;
const connection = new Connection(solanaRpcUrl, 'confirmed');

bot.start((ctx) => {
    ctx.reply(
        "This is the token analyzer. Please send the token address to get info about it."
    );
});

bot.on('text', async (ctx) => {
    const tokenAddress = ctx.message.text.trim();

    if (!isValidSolanaAddress(tokenAddress)) {
        return ctx.reply("Wrong token address, please send the correct one.");
    }

    try {
        // Получаем ликвидность токена через Dexscreener
        const liquidityData = await getLiquidity(tokenAddress);

        // Получаем последнюю транзакцию покупки
        const lastTransaction = await getLastTokenTransaction(tokenAddress);

        if (!lastTransaction) {
            return ctx.reply("No purchase transactions found for this token.");
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
            `🔹 Amount: ${amount} SOL\n`,
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

// Функция для получения последней транзакции на покупку токена
async function getLastTokenTransaction(tokenAddress) {
    try {
        const tokenPubkey = new PublicKey(tokenAddress);

        // Получаем список последних транзакций
        const signatures = await connection.getSignaturesForAddress(tokenPubkey, { limit: 10 });

        for (const sigInfo of signatures) {
            await delay(4000);
            const tx = await connection.getTransaction(sigInfo.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || !tx.meta.postTokenBalances || !tx.transaction) continue;

            // Проверяем, есть ли accountKeys и хотя бы один элемент
            if (!tx.transaction.message.accountKeys || tx.transaction.message.accountKeys.length === 0) continue;

            // Ищем изменение баланса токена
            for (const balance of tx.meta.postTokenBalances) {
                await delay(4000);
                if (balance.mint === tokenAddress) {
                    const preBalance = tx.meta.preTokenBalances?.find(b => b.accountIndex === balance.accountIndex);
                    const amount = balance.uiTokenAmount.uiAmount - (preBalance?.uiTokenAmount.uiAmount || 0);

                    return {
                        slot: sigInfo.slot,
                        signature: sigInfo.signature,
                        wallet: tx.transaction.message.accountKeys[0].toBase58(), // Отправитель
                        amount: amount
                    };
                }
            }
        }

        return null; // Если не нашли покупку
    } catch (error) {
        console.error("Ошибка:", error);
        return null;
    }
}


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Функция для конвертации токена в SOL через DexScreener API
async function convertToSOL(tokenMint, amount) {
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`;
        const response = await axios.get(url);
        const priceInSOL = response.data.pairs[0]?.priceNative;

        if (!priceInSOL) throw new Error("Не удалось получить цену токена в SOL");

        return amount * parseFloat(priceInSOL);
    } catch (error) {
        console.error(`❌ Ошибка при конвертации ${tokenMint} в SOL:`, error);
        return amount; // Возвращаем исходное значение, если курс не найден
    }
}


bot.launch().then(() => console.log("✅ Bot is running..."));
