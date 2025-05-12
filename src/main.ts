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
    tls: process.env.IMAP_TLS !== 'false'
};

// Validate required configuration
if (!config.user || !config.password || !config.host) {
    console.error('Missing required IMAP configuration. Please check your environment variables or config file.');
    process.exit(1);
}

const imap = new Imap(config);

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
    imap.openBox('INBOX', true, cb);
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
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true
        });
        f.on('message', function (msg: any, seqno: any) {
            console.log('Message #%d', seqno);
            var prefix = '(#' + seqno + ') ';
            msg.on('body', function (stream: any, info: any) {
                var buffer = '';
                stream.on('data', function (chunk: any) {
                    buffer += chunk.toString('utf8');
                });
                stream.once('end', function () {
                    console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
                });
            });
            msg.once('attributes', function (attrs: any) {
                console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
            });
            msg.once('end', function () {
                console.log(prefix + 'Finished');
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
