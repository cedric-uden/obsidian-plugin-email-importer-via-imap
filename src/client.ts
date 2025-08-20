import Connection, {Box} from "./imap/lib/Connection";
import {EmailInfo, ImapConfig} from "./models";
import {EmailFilterManager, PrefixFilterStrategy, UnreadFilterStrategy} from "./filterStategy";

// Define interfaces for IMAP types
interface ImapMessage {
	on(event: 'body', listener: (stream: NodeJS.ReadableStream, info: BodyInfo) => void): this;

	once(event: 'attributes', listener: (attrs: MessageAttributes) => void): this;

	once(event: 'end', listener: () => void): this;
}

interface BodyInfo {
	which: string;
}

interface MessageAttributes {
	flags: string[];
	uid: number;
}

interface ImapFetch {
	on(event: 'message', listener: (msg: ImapMessage) => void): this;

	once(event: 'error', listener: (err: Error) => void): this;

	once(event: 'end', listener: () => void): this;
}

interface Mailboxes {
	[key: string]: unknown;
}

class ImapClient {
	private imap: Connection;
	private readonly config: ImapConfig;

	constructor(config: ImapConfig) {
		this.config = config;
		this.imap = new Connection(this.config);
		this.onError();
		this.onEnd();
	}

	private calculateFetchRange(totalMessages: number, maxToFetch: number): string {
		const start = Math.max(1, totalMessages - maxToFetch + 1);
		return `${start}:${totalMessages}`;
	}

	private getMessages(msg: ImapMessage): Promise<EmailInfo> {
		return new Promise((resolve) => {
			const emailInfo = new EmailInfo(new Date());

			msg.on('body', (stream: NodeJS.ReadableStream, info: BodyInfo) => this.processMessageBody(stream, info, emailInfo));
			msg.once('attributes', (attrs: MessageAttributes) => this.processMessageAttributes(attrs, emailInfo));
			msg.once('end', () => resolve(emailInfo));
		});
	}

	private decodeQuotedPrintable(input: string): string {
		// Replace =XX patterns with their corresponding characters
		return input.replace(/=([0-9A-F]{2})/gi, (_, hexCode) => {
			return String.fromCharCode(parseInt(hexCode, 16));
		})
			.replace(/=\r\n/g, '') // Remove soft line breaks
			.replace(/=\n/g, '');  // Remove soft line breaks (Unix style)
	}

	private processMessageBody(stream: NodeJS.ReadableStream, info: BodyInfo, emailInfo: EmailInfo) {
		let buffer = Buffer.alloc(0);
		stream.on('data', (chunk: Buffer) => {
			buffer = Buffer.concat([buffer, chunk]);
		});
		stream.once('end', () => {
			if (info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)') {
				const header = Connection.parseHeader(buffer.toString('utf8'));
				emailInfo.subject = header.subject ? header.subject[0] : '';
				emailInfo.date = header.date ? new Date(header.date[0]) : new Date();
			} else if (info.which === 'TEXT') {
				// First get the raw text
				let bodyText = buffer.toString('utf8');

				// Check if it's quoted-printable encoded
				if (bodyText.includes('=C3=')) {
					// Decode quoted-printable to get UTF-8 bytes
					const qpDecoded = this.decodeQuotedPrintable(bodyText);

					// Convert the decoded string back to bytes, then properly interpret as UTF-8
					const bytes = Buffer.from(qpDecoded, 'binary');
					bodyText = bytes.toString('utf8');
				}

				// Clean up line endings
				emailInfo.body = bodyText
					.replace(/\r\n/g, "\n")
					.replace(/\n+$/g, "");
			}
		});
	}

	private processMessageAttributes(attrs: MessageAttributes, emailInfo: EmailInfo) {
		emailInfo.isUnread = !attrs['flags'].includes('\\Seen');
		emailInfo.uid = attrs['uid'];
	}

	private onError() {
		this.imap.once('error', function (err: Error) {
			console.error(err);
		});
	}

	private onEnd() {
		this.imap.once('end', function () {
		});
	}

	private async openInbox(cb: (err: Error | null, box?: Box) => void) {
		this.imap.openBox(this.config.mailbox, false, cb);
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const readyHandler = () => {
				this.imap.removeListener('error', errorHandler);
				resolve();
			};

			const errorHandler = (err: Error) => {
				this.imap.removeListener('ready', readyHandler);
				console.error('Connection attempt failed:', err);
				reject(err);
			};

			this.imap.once('ready', readyHandler);
			this.imap.once('error', errorHandler);

			try {
				this.imap.connect();
			} catch (connectError) {
				// In case .connect() throws synchronously, though unlikely for I/O
				this.imap.removeListener('ready', readyHandler);
				this.imap.removeListener('error', errorHandler);
				reject(connectError);
			}
		});
	}

	terminate() {
		this.imap.end();
	}

	async markAsRead(uid: number | number[]): Promise<void> {
		return new Promise((resolve, reject) => {
			this.openInbox((err) => {
				if (err) {
					console.error('Error opening mailbox:', err);
					reject(err);
					return;
				}

				this.imap.setFlags(uid, ['\\Seen'], (flagErr: Error | null) => {
					if (flagErr) {
						console.error('Error marking message as read:', flagErr);
						reject(flagErr);
					} else {
						resolve();
					}
				});
			});
		});
	}

	async getAvailableMailboxes(): Promise<string[]> {
		return new Promise((resolve, reject) => {
			this.imap.getBoxes((err: Error | null, boxes: Mailboxes) => {
				if (err) {
					console.error('Error getting mailboxes:', err);
					reject(err);
					return;
				}
				resolve(Object.keys(boxes || {}));
			});
		});
	}

	fetch(nRecentMails = 5, onlyUnread = false): Promise<EmailInfo[]> {

		const messagePromises: Promise<EmailInfo>[] = [];
		return new Promise((resolve, reject) => {
			this.openInbox((err: Error | null, box: Box) => {
				if (err) {
					reject(err);
					return;
				}

				if (box.messages.total === 0) {
					resolve([]);
					return;
				}

				const range = this.calculateFetchRange(box.messages.total, nRecentMails);
				const emails: EmailInfo[] = [];
				const f = this.imap.seq.fetch(range, {
					bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
					struct: true
				}) as ImapFetch;

				f.on('message', (msg: ImapMessage) => {
					const messagePromise = this.getMessages(msg).then(emailInfo => {
						emails.push(emailInfo);
						return emailInfo;
					});
					messagePromises.push(messagePromise);
				});

				f.once('error', (err: Error) => {
					console.error('Fetch error: ' + err);
					reject(err);
				});

				f.once('end', () => {
					Promise.all(messagePromises)
						.then(() => {
							const filterManager = new EmailFilterManager();
							if (onlyUnread) {
								filterManager.addFilter(new UnreadFilterStrategy());
							}
							if (this.config.matchPrefix.trim() !== '') {
								filterManager.addFilter(new PrefixFilterStrategy(this.config.matchPrefix));
							}
							const filteredEmails = filterManager.filterEmails(emails);
							resolve(filteredEmails);
						})
						.catch(err => {
							reject(err);
						});
				});
			}).then();
			this.imap.once('error', (err: Error) => reject(err));
		});
	}
}

export default ImapClient;
