const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.csStatus = {
            isAvailable: true,
            lastActivity: null
        };
        this.userStates = new Map();
        this.csChats = new Map(); // Track ongoing CS chats: userId -> { startTime, timeoutId }
        this.messageHandler = null; // Store message handler instance
    }

    async initialize(messageHandler) {
        try {
            // Store the message handler instance
            this.messageHandler = messageHandler;

            // Create auth folder if it doesn't exist
            const AUTH_FOLDER = './auth';
            if (!fs.existsSync(AUTH_FOLDER)) {
                fs.mkdirSync(AUTH_FOLDER);
            }

            // Load or create auth state
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

            // Create WhatsApp socket connection
            this.sock = makeWASocket({
                printQRInTerminal: true,
                auth: state,
                logger: logger
            });

            // Handle connection updates
            this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));

            // Handle credentials updates
            this.sock.ev.on('creds.update', saveCreds);

            // Handle incoming messages
            this.sock.ev.on('messages.upsert', async ({ messages }) => {
                for (const message of messages) {
                    await this.handleIncomingMessage(message, this.messageHandler);
                }
            });

        } catch (error) {
            logger.errorWithContext(error, {
                service: 'WhatsAppService',
                method: 'initialize'
            });
            throw error;
        }
    }

    handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.info({
                type: 'connection_update',
                status: 'closed',
                shouldReconnect,
                error: lastDisconnect?.error
            });
            
            if (shouldReconnect) {
                this.initialize();
            }
        } else if (connection === 'open') {
            logger.info({
                type: 'connection_update',
                status: 'opened'
            });
        }

        if (qr) {
            qrcode.generate(qr, { small: true });
        }
    }

    async handleIncomingMessage(message, messageHandler) {
        try {
            const { remoteJid, fromMe, id } = message.key;
            const messageText = message?.message?.conversation || 
                              message?.message?.extendedTextMessage?.text || '';
            const messageType = Object.keys(message.message)[0];

            // Jika pesan dari bot sendiri (CS), cek apakah pesan "Terima kasih sudah menghubungi kami"
            if (fromMe) {
                const targetUser = this.findUserInCSChat(remoteJid);
                if (targetUser) {
                    logger.csInteraction('cs_to_user', targetUser, 'CS', messageText);
                    if (messageText.toLowerCase().includes('terima kasih sudah menghubungi kami')) {
                        // Kembalikan status user ke main menu
                        this.setUserState(targetUser, config.STATES.MAIN_MENU);
                        // Kirim pesan konfirmasi ke user
                        await this.sock.sendMessage(targetUser, { text: 'Sesi chat dengan CS telah selesai. Anda kembali ke menu utama.' });
                    }
                }
                return;
            }


            // Handle user messages
            const currentState = this.userStates.get(remoteJid);
            if (currentState === config.STATES.CHATTING_CS || currentState === config.STATES.WAITING_CS) {
                // Pesan langsung diteruskan karena CS menggunakan WhatsApp yang sama
                logger.csInteraction('user_to_cs', remoteJid, 'CS', messageText);
            } else {
                // Call handleMessage method on the messageHandler object
                await messageHandler.handleMessage(this.sock, message);
            }

        } catch (error) {
            logger.errorWithContext(error, {
                service: 'WhatsAppService',
                method: 'handleIncomingMessage'
            });
        }
    }

    // Mencari user yang sedang dalam sesi chat dengan CS
    findUserInCSChat(userId) {
        for (const [user, state] of this.userStates.entries()) {
            if ((state === config.STATES.CHATTING_CS || state === config.STATES.WAITING_CS) && 
                this.csChats.has(user)) {
                return user;
            }
        }
        return null;
    }

    async startCSChat(userId) {
        try {
            // Set user state to chatting with CS
            this.userStates.set(userId, config.STATES.CHATTING_CS);
            
            // Notify user
            await this.sock.sendMessage(userId, { text: config.MESSAGES.WAITING_CS });

            // Set timeout for CS response
            const timeoutId = setTimeout(async () => {
                if (this.userStates.get(userId) === config.STATES.WAITING_CS) {
                    await this.handleCSTimeout(userId);
                }
            }, config.CS_TIMEOUT);

            // Track CS chat
            this.csChats.set(userId, {
                startTime: Date.now(),
                timeoutId
            });

            logger.csInteraction('chat_request', userId, 'CS', 'Chat request initiated');

        } catch (error) {
            logger.errorWithContext(error, {
                service: 'WhatsAppService',
                method: 'startCSChat'
            });
        }
    }

    async handleCSTimeout(userId) {
        try {
            // Send timeout message to user
            await this.sock.sendMessage(userId, { text: config.MESSAGES.CS_TIMEOUT });
            
            // Reset user state
            this.userStates.set(userId, config.STATES.MAIN_MENU);
            
            // Clean up CS chat tracking
            const chatInfo = this.csChats.get(userId);
            if (chatInfo) {
                clearTimeout(chatInfo.timeoutId);
                this.csChats.delete(userId);
            }

            logger.csInteraction('cs_timeout', userId, 'CS', 'CS response timeout');

        } catch (error) {
            logger.errorWithContext(error, {
                service: 'WhatsAppService',
                method: 'handleCSTimeout'
            });
        }
    }

    // Getter for user states
    getUserState(userId) {
        return this.userStates.get(userId) || config.STATES.MAIN_MENU;
    }

    // Setter for user states
    setUserState(userId, state) {
        const oldState = this.getUserState(userId);
        this.userStates.set(userId, state);
        logger.stateChange(userId, oldState, state);
    }
}

module.exports = new WhatsAppService();
