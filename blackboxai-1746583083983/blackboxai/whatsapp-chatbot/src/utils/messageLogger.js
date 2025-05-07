const { google } = require('googleapis');
const path = require('path');
const config = require('../config');
const logger = require('./logger');

class MessageLogger {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.initialized = false;
        this.initPromise = null;
    }

    async initialize() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const auth = new google.auth.GoogleAuth({
                    keyFile: path.resolve(process.cwd(), config.CREDENTIALS_PATH),
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });

                this.auth = await auth.getClient();
                this.sheets = google.sheets({ version: 'v4', auth: this.auth });

                // Check if sheet exists and initialize it
                await this.initializeSheet();
                
                this.initialized = true;
                logger.info('Google Sheets logger initialized successfully');

            } catch (error) {
                logger.errorWithContext(error, {
                    service: 'MessageLogger',
                    method: 'initialize'
                });
                throw error;
            }
        })();

        return this.initPromise;
    }

    async initializeSheet() {
        try {
            // Check if sheet exists
            await this.sheets.spreadsheets.get({
                spreadsheetId: config.SPREADSHEET_ID
            });

            // Add headers if sheet is empty
            const headers = [
                ['Timestamp', 'Sender', 'Message Type', 'Message Content', 'Response', 'State']
            ];

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: config.SPREADSHEET_ID,
                range: `${config.SHEET_NAME}!A1:F1`,
                valueInputOption: 'RAW',
                resource: { values: headers },
            });

            logger.info('Sheet initialized successfully');

        } catch (error) {
            logger.errorWithContext(error, {
                service: 'MessageLogger',
                method: 'initializeSheet',
                spreadsheetId: config.SPREADSHEET_ID,
                sheetName: config.SHEET_NAME
            });
            throw error;
        }
    }

    async logMessage(sender, messageType, messageContent, response, state = 'N/A') {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const timestamp = new Date().toISOString();
            const values = [[timestamp, sender, messageType, messageContent, response, state]];

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: config.SPREADSHEET_ID,
                range: `${config.SHEET_NAME}!A:F`,
                valueInputOption: 'RAW',
                resource: { values },
            });

            logger.info({
                type: 'sheet_log',
                sender,
                messageType,
                timestamp
            });

        } catch (error) {
            logger.errorWithContext(error, {
                service: 'MessageLogger',
                method: 'logMessage',
                sender,
                messageType
            });
            
            // Don't throw the error - we don't want to break the bot if logging fails
            // But we do want to know about it
            logger.error('Failed to log message to spreadsheet');
        }
    }

    async logCSInteraction(sender, csId, messageType, content, response) {
        await this.logMessage(
            sender,
            `CS_${messageType}`,
            `CS ID: ${csId}, Content: ${content}`,
            response,
            'CS_CHAT'
        );
    }
}

module.exports = new MessageLogger();
