import Imap from 'imap';
import {config} from './config';
import {EmailInfo} from './models';

const inspect = require('util').inspect;


class ImapClient {
    private imap: Imap;
    config: any;

    constructor(config: any) {
        this.config = config;
        this.imap = new Imap(this.config);
        this.onError();
        this.onEnd();
    }


    connect() {
        this.imap.connect();
    }

    fetch() {

        this.imap.once('ready', () => {
            this.openInbox((err: any, box: any) => {
                if (err) throw err;

                if (box.messages.total === 0) {
                    console.log('No messages in mailbox');
                    this.imap.end();
                    return;
                }

                const maxToFetch = 20;
                const total = box.messages.total;
                // Calculate the range to fetch the most recent messages,
                // if the total is 100 and maxToFetch is 20, we want 81:100
                const start = Math.max(1, total - maxToFetch + 1);
                const range = `${start}:${total}`;

                let messageUids: number[] = [];

                var f = this.imap.seq.fetch(range, {
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
                f.once('end', () => {
                    console.log('Done fetching all messages!');

                    if (messageUids.length > 0) {
                        this.markAsRead(messageUids);
                    }

                    this.terminate();
                });
            });
        });
    }

    private terminate() {
        this.imap.end();
    }

    private onError() {
        this.imap.once('error', function (err: any) {
            console.log(err);
        });
    }

    private onEnd() {
        this.imap.once('end', function () {
            console.log('Connection ended');
        });
    }

    private printAvailableMailboxes() {
        this.imap.getBoxes((err, boxes) => {
            if (err) {
                console.error('Error getting mailboxes:', err);
                return;
            }
            let mailboxNames = Object.keys(boxes);
            console.log('Available mailboxes: ' + mailboxNames.join(", "));
        });
    }

    private openInbox(cb: (err: Error | null, box: Imap.Box) => void) {
        this.printAvailableMailboxes();
        this.imap.openBox(this.config.mailbox, false, cb);
    }

    private markAsRead(uid: number | number[]) {
        this.imap.setFlags(uid, ['\\Seen'], (err) => {
            if (err) {
                console.error('Error marking message as read:', err);
            } else {
                console.log(`Message(s) ${uid} marked as read`);
            }
        });
    }
}

const client = new ImapClient(config);
client.connect();
client.fetch();
