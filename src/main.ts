import Imap from 'imap';
import {config} from './config';

const inspect = require('util').inspect;

const imap = new Imap(config);

class EmailInfo {
    subject: string;
    date: Date | null;
    body: string;
    isUnread: boolean | null;
    uid: number;

    constructor(
        subject: string = '',
        date: Date | null = null,
        body: string = '',
        isUnread: boolean | null = null,
        uid: number = 0,
    ) {
        this.subject = subject;
        this.date = date;
        this.body = body;
        this.isUnread = isUnread;
        this.uid = uid;
    }
}

function markAsRead(uid: number | number[]) {
    imap.setFlags(uid, ['\\Seen'], (err) => {
        if (err) {
            console.error('Error marking message as read:', err);
        } else {
            console.log(`Message(s) ${uid} marked as read`);
        }
    });
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
    imap.openBox(config.mailbox, false, cb);
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
        const total = box.messages.total;
        // Calculate the range to fetch the most recent messages,
        // if the total is 100 and maxToFetch is 20, we want 81:100
        const start = Math.max(1, total - maxToFetch + 1);
        const range = `${start}:${total}`;

        let messageUids: number[] = [];

        var f = imap.seq.fetch(range, {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true
        });
        f.on('message', function (msg: any) {
            let emailInfo = new EmailInfo();
            let uid: number;
            msg.on('body', function (stream: any, info: any) {
                var buffer = '';
                stream.on('data', function (chunk: any) {
                    buffer += chunk.toString('utf8');
                });
                stream.once('end', function () {
                    if (info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)') {
                        let header = Imap.parseHeader(buffer);
                        emailInfo.subject = header.subject ? header.subject[0] : '';
                        emailInfo.date = header.date ? new Date(header.date[0]) : null;
                    } else if (info.which === 'TEXT') {
                        let text = buffer.replace(/\r\n/g, "\n");
                        text = text.replace(/\n+$/g, "");
                        emailInfo.body = text;
                    }
                });
            });
            msg.once('attributes', function (attrs: any) {
                emailInfo.isUnread = !attrs['flags'].includes('\\Seen');
                emailInfo.uid = attrs['uid'];
                if (emailInfo.isUnread) {
                    messageUids.push(emailInfo.uid);
                }
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

            if (messageUids.length > 0) {
                markAsRead(messageUids);
            }

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
