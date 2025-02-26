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

// Функция получения последней транзакции покупки токена
async function getLastTokenTransaction2(tokenAddress) {
    try {
        const signatures = await connection.getSignaturesForAddress(new PublicKey(tokenAddress), { limit: 10 });
        for (const signatureInfo of signatures) {
            const transaction = await connection.getParsedTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 });
            if (transaction && transaction.meta && transaction.meta.postTokenBalances.length > 1) {
                // Проверяем тип accountKeys[0]
                const wallet = transaction.transaction.message.accountKeys[0];

                // Если wallet - объект PublicKey, конвертируем его в строку
                const walletAddress = wallet.pubkey.toBase58 ? wallet.pubkey.toBase58() : wallet.pubkey;

                const slot = transaction.slot;
                const amount = transaction.meta.postTokenBalances[1].uiTokenAmount.uiAmount;
                const signature = signatureInfo.signature; // Уникальный номер транзакции

                return { slot, walletAddress, amount, signature };
            }
        }
        return null;
    } catch (error) {
        console.error("Solana RPC error:", error);
        return null;
    }
}


async function getLastTokenTransaction3(tokenAddress) {
    try {
        const signatures = await connection.getSignaturesForAddress(new PublicKey(tokenAddress), { limit: 10 });

        for (const signatureInfo of signatures) {
            const transaction = await connection.getParsedTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 });

            if (transaction && transaction.meta && transaction.meta.postTokenBalances.length > 0) {
                // Выводим весь объект accountKeys[0]
                console.log("🔍 Полный объект wallet:", transaction.transaction.message.accountKeys[0]);

                // Выводим все postTokenBalances для анализа
                console.log("🔍 Все postTokenBalances:", transaction.meta.postTokenBalances);

                return {
                    slot: transaction.slot,
                    wallet: transaction.transaction.message.accountKeys[0], // Выведем как объект
                    amount: transaction.meta.postTokenBalances[1]?.uiTokenAmount?.uiAmount || 0, // Проверим индекс
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


async function getLastTokenTransaction(tokenAddress) {
    try {
        // Получаем последние 10 транзакций для токена
        const signatures = await connection.getSignaturesForAddress(new PublicKey(tokenAddress), { limit: 10 });

        for (const signatureInfo of signatures) {
            // Получаем детали транзакции
            const transaction = await connection.getParsedTransaction(signatureInfo.signature, { maxSupportedTransactionVersion: 0 });

            if (transaction && transaction.meta && transaction.meta.postTokenBalances.length > 1) {
                const slot = transaction.slot;
                const tokenBalance = transaction.meta.postTokenBalances[1];

                const mintAddress = tokenBalance.mint;  // Адрес токена
                const rawAmount = tokenBalance.uiTokenAmount.uiAmount; // Количество токенов

                let amountInSOL = rawAmount; // По умолчанию берем как есть

                // Если это не wSOL, конвертируем в SOL через DexScreener API
                if (mintAddress !== "So11111111111111111111111111111111111111112") {
                    amountInSOL = await convertToSOL(mintAddress, rawAmount);
                }

                const wallet = transaction.transaction.message.accountKeys[0];

                // Если wallet - объект PublicKey, конвертируем его в строку
                const walletAddress = wallet.pubkey.toBase58 ? wallet.pubkey.toBase58() : wallet.pubkey;

                return {
                    slot,
                    wallet: walletAddress,
                    amountInSOL,
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

// Функция конвертации в SOL через DexScreener API
async function convertToSOL(mintAddress, amount) {
    try {
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
        const priceData = response.data.pairs?.[0]?.priceNative; // Цена токена в SOL

        if (priceData) {
            return amount * parseFloat(priceData); // Конвертируем в SOL
        } else {
            console.warn("Не удалось получить цену токена, возвращаю 0 SOL");
            return 0;
        }
    } catch (error) {
        console.error("Ошибка получения курса токена:", error);
        return 0;
    }
}


bot.launch().then(() => console.log("✅ Bot is running..."));
