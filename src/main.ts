import Imap from 'imap';

const inspect = require('util').inspect;

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
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

const imap = new Imap(config);

class EmailInfo {
    subject: string;
    date: string;
    body: string;
    isUnread: boolean | null;

    constructor(
        subject: string = '',
        date: string = '',
        body: string = '',
        isUnread: boolean | null = null
    ) {
        this.subject = subject;
        this.date = date;
        this.body = body;
        this.isUnread = isUnread;
    }
}
function printAvailableMailboxes() {
    imap.getBoxes((err, boxes) => {
        if (err) {
            console.error('Error getting mailboxes:', err);
            return;
        }
        let mailboxNames = Object.keys(boxes);
        console.log('Available mailboxes: ' + mailboxNames.join(", "));
    });
}

function openInbox(cb: (err: Error | null, box: Imap.Box) => void) {
    printAvailableMailboxes();
    imap.openBox(config.mailbox, true, cb);
}

imap.once('ready', function () {
    openInbox(function (err: any, box: any) {
        if (err) throw err;

        if (box.messages.total === 0) {
            console.log('No messages in mailbox');
            imap.end();
            return;
        }

        const maxToFetch = 20;
        const count = Math.min(box.messages.total, maxToFetch);
        const range = `1:${count}`;

        var f = imap.seq.fetch(range, {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true
        });
        f.on('message', function (msg: any) {
            let emailInfo = new EmailInfo();
            msg.on('body', function (stream: any, info: any) {
                var buffer = '';
                stream.on('data', function (chunk: any) {
                    buffer += chunk.toString('utf8');
                });
                stream.once('end', function () {
                    if (info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)') {
                        let header = Imap.parseHeader(buffer);
                        emailInfo.subject = header.subject ? header.subject[0] : '';
                        emailInfo.date = header.date ? header.date[0] : '';
                    } else if (info.which === 'TEXT') {
                        let text = buffer.replace(/\r\n/g, "\n");
                        text = text.replace(/\n+$/g, "");
                        emailInfo.body = text;
                    }
                });
            });
            msg.once('attributes', function (attrs: any) {
                emailInfo.isUnread = !attrs['flags'].includes('\\Seen');
            });
            msg.once('end', function () {
                console.log(inspect(emailInfo, false, 8));
            });
        });
        f.once('error', function (err: string) {
            console.log('Fetch error: ' + err);
        });
        f.once('end', function () {
            console.log('Done fetching all messages!');
            imap.end();
        });
    });
});

imap.once('error', function (err: any) {
    console.log(err);
});

imap.once('end', function () {
    console.log('Connection ended');
});

imap.connect();
