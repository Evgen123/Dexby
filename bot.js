// @sherpa_testbot

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { Connection, PublicKey } = require('@solana/web3.js');

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
async function getLastTokenTransaction2(tokenAddress) {
    try {
        const signatures = await connection.getSignaturesForAddress(new PublicKey(tokenAddress), { limit: 10 });

        for (const signatureInfo of signatures) {
            const transaction = await connection.getParsedTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 });

            if (!transaction || !transaction.meta) continue;

            // console.log("🔍 Полная транзакция:", JSON.stringify(transaction, null, 2));

            const { preTokenBalances, postTokenBalances } = transaction.meta;

            let spentTokenMint = null;
            let spentAmount = 0;
            let boughtTokenMint = null;
            let boughtAmount = 0;

            // 🔹 Ищем, какой токен уменьшился (потраченный)
            for (let i = 0; i < preTokenBalances.length; i++) {
                const preBalance = preTokenBalances[i];
                const postBalance = postTokenBalances.find(b => b.accountIndex === preBalance.accountIndex);

                if (!postBalance || preBalance.uiTokenAmount.uiAmount > postBalance.uiTokenAmount.uiAmount) {
                    spentAmount = preBalance.uiTokenAmount.uiAmount - (postBalance?.uiTokenAmount.uiAmount || 0);
                    spentTokenMint = preBalance.mint;
                    break;
                }
            }

            // 🔹 Ищем, какой токен увеличился (купленный)
            for (let i = 0; i < postTokenBalances.length; i++) {
                const postBalance = postTokenBalances[i];
                const preBalance = preTokenBalances.find(b => b.accountIndex === postBalance.accountIndex);

                if (!preBalance || preBalance.uiTokenAmount.uiAmount < postBalance.uiTokenAmount.uiAmount) {
                    boughtAmount = postBalance.uiTokenAmount.uiAmount - (preBalance?.uiTokenAmount.uiAmount || 0);
                    boughtTokenMint = postBalance.mint;
                    break;
                }
            }

            if (boughtAmount > 0 && spentAmount > 0) {
                let spentAmountInSOL = spentAmount;

                // 🔄 Конвертируем в SOL, если оплата была НЕ SOL
                if (spentTokenMint !== "So11111111111111111111111111111111111111112") {
                    spentAmountInSOL = await convertToSOL(spentTokenMint, spentAmount);
                }

                const wallet = transaction.transaction.message.accountKeys[0].pubkey.toBase58();

                return {
                    slot: transaction.slot,
                    wallet: wallet,
                    amount: boughtAmount,
                    spentToken: spentTokenMint,
                    spentAmount: spentAmountInSOL, // Теперь в SOL
                    tokenMint: boughtTokenMint,
                    signature: signatureInfo.signature
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Solana RPC error:", error);
        return null;
    }
}


// Функция для получения последней транзакции на покупку токена
async function getLastTokenTransaction(tokenAddress) {
    try {
        // Получаем последние 10 транзакций для указанного токена
        const signatures = await connection.getSignaturesForAddress(new PublicKey(tokenAddress), { limit: 10 });

        for (const signatureInfo of signatures) {
            // Получаем детали транзакции
            const transaction = await connection.getParsedTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 });

            if (!transaction || !transaction.meta) continue;

            // console.log("🔍 Полная транзакция:", JSON.stringify(transaction, null, 2));

            const { preTokenBalances, postTokenBalances } = transaction.meta;

            let boughtAmount = 0;
            let boughtTokenMint = null;

            // 🔹 Ищем, какой токен увеличился (купленный)
            for (let i = 0; i < postTokenBalances.length; i++) {
                const postBalance = postTokenBalances[i];
                const preBalance = preTokenBalances.find(b => b.accountIndex === postBalance.accountIndex);

                if (!preBalance || preBalance.uiTokenAmount.uiAmount < postBalance.uiTokenAmount.uiAmount) {
                    boughtAmount = postBalance.uiTokenAmount.uiAmount - (preBalance?.uiTokenAmount.uiAmount || 0);
                    boughtTokenMint = postBalance.mint;
                    break;
                }
            }

            // Проверка, был ли куплен нужный токен
            if (boughtAmount > 0 && boughtTokenMint === tokenAddress) {
                const wallet = transaction.transaction.message.accountKeys[0].pubkey.toBase58();

                return {
                    slot: transaction.slot,
                    wallet: wallet,
                    amount: boughtAmount,
                    signature: signatureInfo.signature
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Solana RPC error:", error);
        return null;
    }
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
