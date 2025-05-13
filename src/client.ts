import Imap from "imap";
import {EmailInfo, ImapConfig} from "./models";
import {inspect} from "util";

class ImapClient {
    private imap: Imap;
    private readonly config: ImapConfig;

    constructor(config: ImapConfig) {
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

                const f = this.imap.seq.fetch(range, {
                    bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
                    struct: true
                });
                f.on('message', function (msg: any) {
                    let emailInfo = new EmailInfo();
                    msg.on('body', function (stream: any, info: any) {
                        let buffer = '';
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
            }).then(() => {
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

    async getAvailableMailboxes(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            this.imap.getBoxes((err, boxes) => {
                if (err) {
                    console.error('Error getting mailboxes:', err);
                    reject(err);
                    return;
                }
                resolve(Object.keys(boxes));
            });
        });
    }

    private async printAvailableMailboxes() {
        const mailboxes = await this.getAvailableMailboxes();
        console.log('Available mailboxes: ' + mailboxes.join(", "));
    }

    private async openInbox(cb: (err: Error | null, box: Imap.Box) => void) {
        await this.printAvailableMailboxes();
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

export default ImapClient;
