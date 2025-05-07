const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const logger = require('./logger');

async function startBot() {
    // Create auth folder if it doesn't exist
    const AUTH_FOLDER = './auth';
    if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER);
    }

    // Load or create auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    // Create WhatsApp socket connection
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: logger
    });

    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.info('Connection closed due to ' + lastDisconnect?.error + ', reconnecting ' + shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            logger.info('Opened connection');
        }

        if (qr) {
            qrcode.generate(qr, { small: true });
        }
    });

    // Handle credentials updates
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const message of messages) {
            if (!message.key.fromMe && message.message) {
                const { remoteJid } = message.key;
                const messageText = message?.message?.conversation || 
                                  message?.message?.extendedTextMessage?.text || '';

                logger.info('Received message: ' + messageText);

                // Simple auto-reply
                if (messageText.toLowerCase() === 'hi' || messageText.toLowerCase() === 'hello') {
                    await sock.sendMessage(remoteJid, { 
                        text: 'Hello! How can I help you?\n\n1. Info\n2. Help\n3. About' 
                    });
                }
                else if (messageText === '1') {
                    await sock.sendMessage(remoteJid, { 
                        text: 'This is a simple WhatsApp bot built with Baileys.' 
                    });
                }
                else if (messageText === '2') {
                    await sock.sendMessage(remoteJid, { 
                        text: 'Available commands:\n- Hi/Hello: Show menu\n- 1: Show info\n- 2: Show help\n- 3: Show about' 
                    });
                }
                else if (messageText === '3') {
                    await sock.sendMessage(remoteJid, { 
                        text: 'Created by BlackBox AI' 
                    });
                }
            }
        }
    });
}

// Start the bot
logger.info('Starting WhatsApp bot...');
startBot();

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Shutting down...');
    process.exit(0);
});
