import Imap from "imap";
import {EmailInfo, ImapConfig} from "./models";

class ImapClient {
    private imap: Imap;
    private readonly config: ImapConfig;

    constructor(config: ImapConfig) {
        this.config = config;
        this.imap = new Imap(this.config);
        this.onError();
        this.onEnd();
    }

    private calculateFetchRange(totalMessages: number, maxToFetch: number): string {
        const start = Math.max(1, totalMessages - maxToFetch + 1);
        return `${start}:${totalMessages}`;
    }

    private getMessages(msg: any): Promise<EmailInfo> {
        return new Promise((resolve) => {
            const emailInfo = new EmailInfo();

            msg.on('body', (stream: any, info: any) => this.processMessageBody(stream, info, emailInfo));
            msg.once('attributes', (attrs: any) => this.processMessageAttributes(attrs, emailInfo));
            msg.once('end', () => resolve(emailInfo));
        });
    }

    private processMessageBody(stream: any, info: any, emailInfo: EmailInfo) {
        let buffer = '';
        stream.on('data', (chunk: any) => buffer += chunk.toString('utf8'));
        stream.once('end', () => {
            if (info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)') {
                const header = Imap.parseHeader(buffer);
                emailInfo.subject = header.subject ? header.subject[0] : '';
                emailInfo.date = header.date ? new Date(header.date[0]) : null;
            } else if (info.which === 'TEXT') {
                emailInfo.body = buffer.replace(/\r\n/g, "\n").replace(/\n+$/g, "");
            }
        });
    }

    private processMessageAttributes(attrs: any, emailInfo: EmailInfo) {
        emailInfo.isUnread = !attrs['flags'].includes('\\Seen');
        emailInfo.uid = attrs['uid'];
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

    private async openInbox(cb: (err: Error | null, box: Imap.Box) => void) {
        this.imap.openBox(this.config.mailbox, false, cb);
    }

    connect() {
        this.imap.connect();
    }

    terminate() {
        this.imap.end();
    }

    async markAsRead(uid: number | number[]) {
        this.imap.once('ready', () => {
            this.openInbox((err: any, box: any) => {
                this.imap.setFlags(uid, ['\\Seen'], (err) => {
                    if (err) {
                        console.error('Error marking message as read:', err);
                    } else {
                        console.log(`Message(s) ${uid} marked as read`);
                    }
                });
            });
        });
    }

    async getAvailableMailboxes(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            this.imap.once('ready', () => {
                this.imap.getBoxes((err, boxes) => {
                    if (err) {
                        console.error('Error getting mailboxes:', err);
                        reject(err);
                        return;
                    }
                    resolve(Object.keys(boxes));
                });
            });
        });
    }

    fetch(): Promise<EmailInfo[]> {
        return new Promise((resolve, reject) => {
            this.imap.once('ready', () => {
                this.openInbox((err: any, box: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (box.messages.total === 0) {
                        console.log('No messages in mailbox');
                        this.terminate();
                        resolve([]);
                        return;
                    }

                    const range = this.calculateFetchRange(box.messages.total, 20);
                    const emailInfos: EmailInfo[] = [];
                    const f = this.imap.seq.fetch(range, {
                        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
                        struct: true
                    });

                    f.on('message', (msg: any) => {
                        this.getMessages(msg).then(emailInfo => {
                            emailInfos.push(emailInfo);
                        });
                    });

                    f.once('error', (err: string) => {
                        console.log('Fetch error: ' + err);
                        reject(err);
                    });

                    f.once('end', () => {
                        console.log('Done fetching all messages!');
                        resolve(emailInfos);
                    });
                }).then();
            });
            this.imap.once('error', (err: any) => reject(err));
        });
    }
}

export default ImapClient;
