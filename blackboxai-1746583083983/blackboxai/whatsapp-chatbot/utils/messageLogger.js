const { google } = require('googleapis');
const path = require('path');
const config = require('../config');

class MessageLogger {
    constructor() {
        this.auth = null;
        this.sheets = null;
    }

    async initialize() {
        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: path.join(__dirname, '..', 'credentials.json'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.auth = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });

            // Check if sheet exists, if not create it
            await this.initializeSheet();
        } catch (error) {
            console.error('Error initializing message logger:', error);
        }
    }

    async initializeSheet() {
        try {
            // Check if sheet exists
            await this.sheets.spreadsheets.get({
                spreadsheetId: config.SPREADSHEET_ID
            });

            // Add headers if sheet is empty
            const headers = [
                ['Timestamp', 'Sender', 'Message Type', 'Message Content', 'Response']
            ];

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: config.SPREADSHEET_ID,
                range: `${config.SHEET_NAME}!A1:E1`,
                valueInputOption: 'RAW',
                resource: { values: headers },
            });
        } catch (error) {
            console.error('Error initializing sheet:', error);
        }
    }

    async logMessage(sender, messageType, messageContent, response) {
        try {
            const timestamp = new Date().toISOString();
            const values = [[timestamp, sender, messageType, messageContent, response]];

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: config.SPREADSHEET_ID,
                range: `${config.SHEET_NAME}!A:E`,
                valueInputOption: 'RAW',
                resource: { values },
            });
        } catch (error) {
            console.error('Error logging message:', error);
        }
    }
}

module.exports = new MessageLogger();
