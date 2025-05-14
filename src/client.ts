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


    connect() {
        this.imap.connect();
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
                        this.getMessages(msg, []).then(emailInfo => {
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

    private calculateFetchRange(totalMessages: number, maxToFetch: number): string {
        const start = Math.max(1, totalMessages - maxToFetch + 1);
        return `${start}:${totalMessages}`;
    }

    private fetchMessages(range: string) {
        const messageUids: number[] = [];
        const f = this.imap.seq.fetch(range, {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true
        });

        f.on('message', (msg: any) => this.getMessages(msg, messageUids));
        f.once('error', (err: string) => console.log('Fetch error: ' + err));
        f.once('end', () => this.onFetchEnd(messageUids));
    }

    private getMessages(msg: any, messageUids: number[]): Promise<EmailInfo> {
        return new Promise((resolve) => {
            const emailInfo = new EmailInfo();

            msg.on('body', (stream: any, info: any) => this.processMessageBody(stream, info, emailInfo));
            msg.once('attributes', (attrs: any) => this.processMessageAttributes(attrs, emailInfo, messageUids));
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

    private processMessageAttributes(attrs: any, emailInfo: EmailInfo, messageUids: number[]) {
        emailInfo.isUnread = !attrs['flags'].includes('\\Seen');
        emailInfo.uid = attrs['uid'];
        if (emailInfo.isUnread) {
            messageUids.push(emailInfo.uid);
        }
    }

    private onFetchEnd(messageUids: number[]) {
        console.log('Done fetching all messages!');
        if (messageUids.length > 0) {
            this.markAsRead(messageUids);
        }
    }

    terminate() {
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


    private async openInbox(cb: (err: Error | null, box: Imap.Box) => void) {
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
