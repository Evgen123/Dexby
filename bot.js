﻿// @sherpa_testbot

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
        var lastTransaction = await getLastTokenTransaction(connection, tokenAddress);

        if (!lastTransaction) {
            // Получаем последнюю транзакцию покупки через Alchemy
            lastTransaction = await getLastTokenTransaction2(tokenAddress);
            
            if (!lastTransaction) {
                return ctx.reply("No purchase transactions found for this token.");
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


// Функция для получения последней транзакции на покупку токена
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

            if (txDetails && txDetails.meta && txDetails.meta.postTokenBalances) {
                for (let i = 0; i < txDetails.meta.postTokenBalances.length; i++) {
                    const balance = txDetails.meta.postTokenBalances[i];
                    const preBalance = txDetails.meta.preTokenBalances?.[i];

                    if (
                        balance.mint === tokenAddress &&
                        preBalance &&
                        balance.uiTokenAmount.uiAmount !== null &&
                        balance.uiTokenAmount.uiAmount !== undefined &&
                        preBalance.uiTokenAmount.uiAmount !== null &&
                        preBalance.uiTokenAmount.uiAmount !== undefined &&
                        balance.uiTokenAmount.uiAmount > preBalance.uiTokenAmount.uiAmount
                    ) {
                        const amount = balance.uiTokenAmount.uiAmount - preBalance.uiTokenAmount.uiAmount;
                        const wallet = balance.owner || 'Неизвестный кошелек';

                        return {
                            slot: txDetails.slot,
                            wallet,
                            amount,
                            signature: txInfo.signature,
                        };
                    }
                }
            }
        }

        return null;
    } catch (error) {
        console.error("Ошибка получения транзакции:", error);
        return null;
    }

}



// Функция для получения последней транзакции на покупку токена через Alchemy
async function getLastTokenTransaction2(tokenAddress) {
    try {
        const transactions = await alchemy.transact.getAssetTransfersV2({
            category: ["spl-token"],
            order: "desc",
            limit: 10,
            contractAddresses: [tokenAddress], // Solana поддерживает этот параметр в V2 API
        });

        if (!transactions.transfers || transactions.transfers.length === 0) {
            throw new Error("Нет транзакций для этого токена.");
        }

        const buyTx = transactions.transfers.find(tx => tx.to !== null);
        if (!buyTx) {
            throw new Error("Не найдено покупок токена.");
        }

        return {
            slot: buyTx.blockNum,
            signature: buyTx.hash,
            wallet: buyTx.from,
            amount: buyTx.value.toString(),
        };
    } catch (error) {
        console.error("Ошибка получения транзакции:", error.message);
        return null;
    }
}


bot.launch().then(() => console.log("✅ Bot is running..."));
