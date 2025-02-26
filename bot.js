require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { Connection, PublicKey } = require('@solana/web3.js');

const bot = new Telegraf(process.env.BOT_TOKEN);
const solanaRpcUrl = process.env.SOLANA_RPC_URL || process.env.ALCHEMY_RPC_URL;
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

        const { slot, wallet, amount } = lastTransaction;

        // Отправляем информацию пользователю
        ctx.reply(
            `📊 Token Analysis:\n` +
            `💰 Liquidity: $${liquidityData || "N/A"}\n` +
            `📌 Last Buy Transaction:\n` +
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

// Функция получения последней транзакции покупки токена
async function getLastTokenTransaction(tokenAddress) {
    try {
        const signatures = await connection.getSignaturesForAddress(new PublicKey(tokenAddress), { limit: 10 });
        for (const signatureInfo of signatures) {
            const transaction = await connection.getParsedTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 });
            if (transaction && transaction.meta && transaction.meta.postTokenBalances.length > 1) {
                const wallet = transaction.transaction.message.accountKeys[0].toString();
                const slot = transaction.slot;
                const amount = transaction.meta.postTokenBalances[1].uiTokenAmount.uiAmount;

                return { slot, wallet, amount };
            }
        }
        return null;
    } catch (error) {
        console.error("Solana RPC error:", error);
        return null;
    }
}

bot.launch().then(() => console.log("✅ Bot is running..."));
