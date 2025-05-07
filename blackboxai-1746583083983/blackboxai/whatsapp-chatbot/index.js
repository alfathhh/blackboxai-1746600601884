const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const messageLogger = require('./utils/messageLogger');

// Initialize loggers
const logger = pino();

// Create auth folder if it doesn't exist
const AUTH_FOLDER = './auth';
if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER);
}

const greetedUsers = new Set();
const lastMessageTimestamps = new Map();
const userStates = new Map();

const CLOSING_MESSAGE = 'Terima kasih telah menghubungi kami. Semoga hari Anda menyenangkan! Jika Anda membutuhkan bantuan lagi, silakan hubungi kami kembali.';

async function handleMessage(sock, message) {
    try {
        const { remoteJid, fromMe, id } = message.key;
        const messageText = message?.message?.conversation || 
                          message?.message?.extendedTextMessage?.text || '';
        const messageType = Object.keys(message.message)[0];

        if (fromMe) return;

        logger.info(`Received message: ${messageText} from ${remoteJid}`);

        lastMessageTimestamps.set(remoteJid, Date.now());

        if (!greetedUsers.has(remoteJid)) {
            const welcomeMessage = 'Selamat datang! Saya adalah chatbot yang dapat membantu Anda. Berikut fitur yang tersedia:\n\n' +
                '1. Produk\n' +
                '2. Layanan\n' +
                '3. Kontak\n' +
                '4. Chat dengan CS\n' +
                '5. Info\n' +
                '6. Akhiri Obrolan\n\n' +
                'Silakan ketik angka pilihan Anda.';
            await sock.sendMessage(remoteJid, { text: welcomeMessage });
            greetedUsers.add(remoteJid);
            userStates.set(remoteJid, 'main_menu');
            logger.info(`Sent welcome message with numbered options to ${remoteJid}`);
            return;
        }

        let response = '';

        if (messageType === 'buttonsResponseMessage') {
            // Ignore button responses since we no longer use buttons
            response = 'Silakan ketik angka pilihan Anda sesuai menu.';
        } else {
            const text = messageText.toLowerCase();
            switch (userStates.get(remoteJid) || 'main_menu') {
                case 'main_menu':
                    if (text === 'tidak' || text === '6') {
                        response = CLOSING_MESSAGE;
                        userStates.delete(remoteJid);
                        greetedUsers.delete(remoteJid);
                        lastMessageTimestamps.delete(remoteJid);
                    } else if (text === 'menu') {
                        response = '📋 Menu:\n1. Produk\n2. Layanan\n3. Kontak\n4. Chat dengan CS\n5. Info\n6. Akhiri Obrolan\n\nSilakan ketik angka pilihan Anda.';
                        userStates.set(remoteJid, 'main_menu');
                    } else if (text === '1') {
                        response = '📦 Produk kami meliputi:\n- Produk A\n- Produk B\n- Produk C\n\nKetik "menu" untuk kembali ke menu utama.';
                        userStates.set(remoteJid, 'main_menu');
                    } else if (text === '2') {
                        response = '🛠️ Layanan kami meliputi:\n- Layanan X\n- Layanan Y\n- Layanan Z\n\nKetik "menu" untuk kembali ke menu utama.';
                        userStates.set(remoteJid, 'main_menu');
                    } else if (text === '3') {
                        response = '📞 Anda dapat menghubungi kami di:\n- Telepon: +62xxxxxxxxxxx\n- Email: support@example.com\n\nKetik "menu" untuk kembali ke menu utama.';
                        userStates.set(remoteJid, 'main_menu');
                    } else if (text === '4') {
                        response = 'Silahkan menunggu cs akan membalas';
                        userStates.set(remoteJid, 'chatting_cs');
                        // Set a timeout for 5 minutes to check if CS has replied
                        setTimeout(async () => {
                            if (userStates.get(remoteJid) === 'chatting_cs') {
                                await sock.sendMessage(remoteJid, { text: 'Maaf cs sedang sibuk' });
                                userStates.set(remoteJid, 'main_menu');
                            }
                        }, 5 * 60 * 1000);
                    } else if (text === '5') {
                        response = 'ℹ️ Info:\n1. Nilai PDRB tahun ini\n2. Laju PDRB tahun ini\n\nKetik angka 1 atau 2 untuk informasi lebih lanjut, atau "menu" untuk kembali.';
                        userStates.set(remoteJid, 'info_menu');
                    } else {
                        response = 'Maaf, pilihan tidak dikenali. Silakan ketik angka sesuai menu.';
                    }
                    break;
                case 'info_menu':
                    if (text === '1') {
                        response = 'Nilai PDRB sebesar 100m.\n\nKetik "menu sebelumnya" untuk kembali ke menu sebelumnya.';
                        userStates.set(remoteJid, 'pdrb_menu');
                    } else if (text === '2') {
                        response = 'Laju PDRB tahun ini adalah 5%.\n\nKetik "menu sebelumnya" untuk kembali ke menu sebelumnya.';
                        userStates.set(remoteJid, 'pdrb_menu');
                    } else if (text === 'menu sebelumnya') {
                        response = 'ℹ️ Info:\n1. Nilai PDRB tahun ini\n2. Laju PDRB tahun ini\n\nKetik angka 1 atau 2 untuk informasi lebih lanjut, atau "menu" untuk kembali.';
                        userStates.set(remoteJid, 'info_menu');
                    } else if (text === 'menu') {
                        response = '📋 Menu:\n1. Produk\n2. Layanan\n3. Kontak\n4. Chat dengan CS\n5. Info\n6. Akhiri Obrolan\n\nSilakan ketik angka pilihan Anda.';
                        userStates.set(remoteJid, 'main_menu');
                    } else {
                        response = 'Pilihan tidak dikenali. Ketik angka 1 atau 2, "menu sebelumnya", atau "menu" untuk kembali.';
                    }
                    break;
                case 'chatting_cs':
                    // The bot sends the closing message to the user to end chat with CS
                    if (response === 'Terima kasih telah menghubungi kami') {
                        response = 'Terima kasih atas konfirmasi Anda. Obrolan dengan Customer Service telah selesai.';
                        userStates.set(remoteJid, 'main_menu');
                    } else if (text === 'menu') {
                        response = '📋 Menu:\n1. Produk\n2. Layanan\n3. Kontak\n4. Chat dengan CS\n5. Info\n6. Akhiri Obrolan\n\nSilakan ketik angka pilihan Anda.';
                        userStates.set(remoteJid, 'main_menu');
                    } else {
                        response = ''; // Do not respond to user messages while chatting with CS
                    }
                    break;
                default:
                    response = 'Maaf, terjadi kesalahan. Ketik "menu" untuk kembali ke menu utama.';
                    userStates.set(remoteJid, 'main_menu');
                    break;
            }
        }

        if (response) {
            await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
            logger.info(`Sent response to ${remoteJid}`);
            
            // Log message to spreadsheet
            await messageLogger.logMessage(
                remoteJid,
                messageType,
                messageText,
                response
            );
        }

    } catch (error) {
        logger.error('Error handling message:', error);
    }
}

// Inactivity timeout checker
setInterval(() => {
    const now = Date.now();
    for (const [user, lastTime] of lastMessageTimestamps.entries()) {
        if (now - lastTime > 5 * 60 * 1000) { // 5 minutes
            // Send closing message and remove user from greetedUsers and lastMessageTimestamps
            sock.sendMessage(user, { text: CLOSING_MESSAGE }).catch(() => {});
            greetedUsers.delete(user);
            lastMessageTimestamps.delete(user);
            logger.info(`Closed chat with ${user} due to inactivity.`);
        }
    }
}, 60 * 1000); // Check every 1 minute

async function connectToWhatsApp() {
    // Initialize message logger
    await messageLogger.initialize();
    try {
        // Load or create auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

        // Create WhatsApp socket connection
        const sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            logger: pino({ level: 'silent' })
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.info('Connection closed due to:', lastDisconnect.error);
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                logger.info('WhatsApp connection established!');
            }

            // Display QR code in terminal
            if (qr) {
                qrcode.generate(qr, { small: true });
            }
        });

        // Handle credentials updates
        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const message of messages) {
                await handleMessage(sock, message);
            }
        });

    } catch (error) {
        logger.error('Error in WhatsApp connection:', error);
        // Attempt to reconnect after a delay
        setTimeout(connectToWhatsApp, 5000);
    }
}

// Start the bot
connectToWhatsApp();
