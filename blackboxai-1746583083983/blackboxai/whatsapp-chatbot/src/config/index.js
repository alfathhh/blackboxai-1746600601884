require('dotenv').config();

const config = {
    // WhatsApp Configuration
    CS_CONTACT_ID: process.env.CS_CONTACT_ID,
    CS_TIMEOUT: parseInt(process.env.CS_TIMEOUT || '300000'), // 5 minutes in milliseconds

    // Google Sheets Configuration
    SPREADSHEET_ID: process.env.SPREADSHEET_ID || '1VottezUELAmmHkwheXXgYNmvAxmcnMjtit5SI4irol0',
    SHEET_NAME: process.env.SHEET_NAME || 'Chat Logs',
    CREDENTIALS_PATH: process.env.CREDENTIALS_PATH || './credentials.json',

    // Application Configuration
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // State Management
    STATES: {
        MAIN_MENU: 'main_menu',
        WAITING_CS: 'waiting_cs',
        CHATTING_CS: 'chatting_cs',
        INFO_MENU: 'info_menu',
        PDRB_MENU: 'pdrb_menu'
    },

    // Messages
    MESSAGES: {
        WELCOME: `Selamat datang! Saya adalah chatbot yang dapat membantu Anda. Berikut fitur yang tersedia:

1. Produk
2. Layanan
3. Kontak
4. Chat dengan CS
5. Info
6. Akhiri Obrolan

Silakan ketik angka pilihan Anda.`,
        WAITING_CS: 'Silahkan menunggu, CS akan membalas dalam waktu 5 menit.',
        CS_BUSY: 'Maaf, CS sedang sibuk. Silakan coba lagi nanti atau pilih menu lain.',
        CS_TIMEOUT: 'Maaf, CS tidak merespons dalam waktu 5 menit. Anda dikembalikan ke menu utama.',
        CLOSING: 'Terima kasih telah menghubungi kami. Semoga hari Anda menyenangkan! Jika Anda membutuhkan bantuan lagi, silakan hubungi kami kembali.'
    }
};

// Validate required configuration
const requiredConfigs = ['CS_CONTACT_ID', 'SPREADSHEET_ID'];
for (const configKey of requiredConfigs) {
    if (!process.env[configKey]) {
        console.error(`Missing required configuration: ${configKey}`);
        process.exit(1);
    }
}

module.exports = config;
