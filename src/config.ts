// Load environment variables from .env file
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import {ImapConfig} from "./models";

dotenv.config();

const loadConfigFile = (): Partial<ImapConfig> => {
    const configPath = path.join(__dirname, '../config.json');

    if (!fs.existsSync(configPath)) {
        return {};
    }

    try {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(fileContents) as Partial<ImapConfig>;
    } catch (err) {
        console.error('Error loading config file:', err);
        return {};
    }
};


const fileConfig = loadConfigFile();

const config = new ImapConfig(
    process.env.IMAP_USER || fileConfig.user || '',
    process.env.IMAP_PASSWORD || fileConfig.password || '',
    process.env.IMAP_HOST || fileConfig.host || '',
    process.env.IMAP_PORT || fileConfig.port || '993',
    process.env.IMAP_TLS !== 'false',
    process.env.IMAP_MAILBOX || fileConfig.mailbox || 'INBOX',
)

// Validate required configuration
if (!config.user || !config.password || !config.host) {
    console.error('Missing required IMAP configuration. Please check your environment variables or config file.');
    process.exit(1);
}

export { config };
