const config = require('../config');
const logger = require('../utils/logger');
const whatsapp = require('../services/whatsapp');
const messageLogger = require('../utils/messageLogger');

class MessageHandler {
    constructor() {
        this.greetedUsers = new Set();
    }

    async handleMessage(sock, message) {
        try {
            const { remoteJid, fromMe, id } = message.key;
            const messageText = message?.message?.conversation || 
                              message?.message?.extendedTextMessage?.text || '';
            const messageType = Object.keys(message.message)[0];

            // Ignore self messages except from CS
            if (fromMe && remoteJid !== config.CS_CONTACT_ID) return;

            logger.messageProcess(remoteJid, messageType, messageText, null);

            // Send welcome message for new users
            if (!this.greetedUsers.has(remoteJid)) {
                await this.sendWelcomeMessage(sock, remoteJid);
                this.greetedUsers.add(remoteJid);
                whatsapp.setUserState(remoteJid, config.STATES.MAIN_MENU);
                return;
            }

            let response = '';
            const currentState = whatsapp.getUserState(remoteJid);

            switch (currentState) {
                case config.STATES.MAIN_MENU:
                    response = await this.handleMainMenu(sock, remoteJid, messageText);
                    break;

                case config.STATES.WAITING_CS:
                case config.STATES.CHATTING_CS:
                    // Messages in waiting or chatting state are forwarded to CS
                    await whatsapp.forwardToCS(remoteJid, messageText);
                    return;

                case config.STATES.INFO_MENU:
                    response = await this.handleInfoMenu(sock, remoteJid, messageText);
                    break;

                case config.STATES.PDRB_MENU:
                    response = await this.handlePDRBMenu(sock, remoteJid, messageText);
                    break;

                default:
                    response = 'Maaf, terjadi kesalahan. Ketik "menu" untuk kembali ke menu utama.';
                    whatsapp.setUserState(remoteJid, config.STATES.MAIN_MENU);
                    break;
            }

            if (response) {
                await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
                logger.messageProcess(remoteJid, 'bot_response', messageText, response);
                
                // Log to spreadsheet
                await messageLogger.logMessage(
                    remoteJid,
                    messageType,
                    messageText,
                    response
                );
            }

        } catch (error) {
            logger.errorWithContext(error, {
                handler: 'MessageHandler',
                method: 'handleMessage'
            });
        }
    }

    async sendWelcomeMessage(sock, remoteJid) {
        try {
            await sock.sendMessage(remoteJid, { text: config.MESSAGES.WELCOME });
            logger.messageProcess(remoteJid, 'welcome', '', config.MESSAGES.WELCOME);
        } catch (error) {
            logger.errorWithContext(error, {
                handler: 'MessageHandler',
                method: 'sendWelcomeMessage'
            });
        }
    }

    async handleMainMenu(sock, remoteJid, messageText) {
        const text = messageText.toLowerCase();
        let response = '';

        try {
            if (text === 'tidak' || text === '6') {
                response = config.MESSAGES.CLOSING;
                this.greetedUsers.delete(remoteJid);
                whatsapp.setUserState(remoteJid, config.STATES.MAIN_MENU);
            } else if (text === 'menu') {
                response = '📋 Menu:\n1. Produk\n2. Layanan\n3. Kontak\n4. Chat dengan CS\n5. Info\n6. Akhiri Obrolan\n\nSilakan ketik angka pilihan Anda.';
            } else if (text === '1') {
                response = '📦 Produk kami meliputi:\n- Produk A\n- Produk B\n- Produk C\n\nKetik "menu" untuk kembali ke menu utama.';
            } else if (text === '2') {
                response = '🛠️ Layanan kami meliputi:\n- Layanan X\n- Layanan Y\n- Layanan Z\n\nKetik "menu" untuk kembali ke menu utama.';
            } else if (text === '3') {
                response = '📞 Anda dapat menghubungi kami di:\n- Telepon: +62xxxxxxxxxxx\n- Email: support@example.com\n\nKetik "menu" untuk kembali ke menu utama.';
            } else if (text === '4') {
                // Start CS chat process
                await whatsapp.startCSChat(remoteJid);
                return ''; // Empty response as startCSChat handles messaging
            } else if (text === '5') {
                response = 'ℹ️ Info:\n1. Nilai PDRB tahun ini\n2. Laju PDRB tahun ini\n\nKetik angka 1 atau 2 untuk informasi lebih lanjut, atau "menu" untuk kembali.';
                whatsapp.setUserState(remoteJid, config.STATES.INFO_MENU);
            } else {
                response = 'Maaf, pilihan tidak dikenali. Silakan ketik angka sesuai menu.';
            }
        } catch (error) {
            logger.errorWithContext(error, {
                handler: 'MessageHandler',
                method: 'handleMainMenu'
            });
            response = 'Maaf, terjadi kesalahan. Silakan coba lagi.';
        }

        return response;
    }

    async handleInfoMenu(sock, remoteJid, messageText) {
        const text = messageText.toLowerCase();
        let response = '';

        try {
            if (text === '1') {
                response = 'Nilai PDRB sebesar 100m.\n\nKetik "menu sebelumnya" untuk kembali ke menu sebelumnya.';
                whatsapp.setUserState(remoteJid, config.STATES.PDRB_MENU);
            } else if (text === '2') {
                response = 'Laju PDRB tahun ini adalah 5%.\n\nKetik "menu sebelumnya" untuk kembali ke menu sebelumnya.';
                whatsapp.setUserState(remoteJid, config.STATES.PDRB_MENU);
            } else if (text === 'menu sebelumnya') {
                response = 'ℹ️ Info:\n1. Nilai PDRB tahun ini\n2. Laju PDRB tahun ini\n\nKetik angka 1 atau 2 untuk informasi lebih lanjut, atau "menu" untuk kembali.';
            } else if (text === 'menu') {
                response = '📋 Menu:\n1. Produk\n2. Layanan\n3. Kontak\n4. Chat dengan CS\n5. Info\n6. Akhiri Obrolan\n\nSilakan ketik angka pilihan Anda.';
                whatsapp.setUserState(remoteJid, config.STATES.MAIN_MENU);
            } else {
                response = 'Pilihan tidak dikenali. Ketik angka 1 atau 2, "menu sebelumnya", atau "menu" untuk kembali.';
            }
        } catch (error) {
            logger.errorWithContext(error, {
                handler: 'MessageHandler',
                method: 'handleInfoMenu'
            });
            response = 'Maaf, terjadi kesalahan. Silakan coba lagi.';
        }

        return response;
    }

    async handlePDRBMenu(sock, remoteJid, messageText) {
        const text = messageText.toLowerCase();
        let response = '';

        try {
            if (text === 'menu sebelumnya') {
                response = 'ℹ️ Info:\n1. Nilai PDRB tahun ini\n2. Laju PDRB tahun ini\n\nKetik angka 1 atau 2 untuk informasi lebih lanjut, atau "menu" untuk kembali.';
                whatsapp.setUserState(remoteJid, config.STATES.INFO_MENU);
            } else if (text === 'menu') {
                response = '📋 Menu:\n1. Produk\n2. Layanan\n3. Kontak\n4. Chat dengan CS\n5. Info\n6. Akhiri Obrolan\n\nSilakan ketik angka pilihan Anda.';
                whatsapp.setUserState(remoteJid, config.STATES.MAIN_MENU);
            } else {
                response = 'Ketik "menu sebelumnya" untuk kembali ke menu Info atau "menu" untuk ke menu utama.';
            }
        } catch (error) {
            logger.errorWithContext(error, {
                handler: 'MessageHandler',
                method: 'handlePDRBMenu'
            });
            response = 'Maaf, terjadi kesalahan. Silakan coba lagi.';
        }

        return response;
    }
}

module.exports = new MessageHandler();
