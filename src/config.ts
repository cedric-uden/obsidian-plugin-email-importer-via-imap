// Load environment variables from .env file
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

// Load config from a file if it exists, or use a default empty object
let fileConfig = {
    user: "",
    password: "",
    host: "",
    port: "993",
    tls: true,
    mailbox: "INBOX",
};
const configPath = path.join(__dirname, '../config.json');
if (fs.existsSync(configPath)) {
    try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
        console.error('Error loading config file:', err);
    }
}

// Config object with environment variables taking precedence over file config
const config = {
    user: process.env.IMAP_USER || fileConfig.user || '',
    password: process.env.IMAP_PASSWORD || fileConfig.password || '',
    host: process.env.IMAP_HOST || fileConfig.host || '',
    port: parseInt(process.env.IMAP_PORT || fileConfig.port || '993'),
    tls: process.env.IMAP_TLS !== 'false',
    mailbox: process.env.IMAP_MAILBOX || fileConfig.mailbox || 'INBOX',
};

// Validate required configuration
if (!config.user || !config.password || !config.host) {
    console.error('Missing required IMAP configuration. Please check your environment variables or config file.');
    process.exit(1);
}

export { config };
