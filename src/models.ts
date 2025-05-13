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

class ImapConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    mailbox: string;

    constructor(
        user: string = '',
        password: string = '',
        host: string = '',
        port: string = '993',
        tls: boolean = true,
        mailbox: string = 'INBOX',
    ) {
        this.user = user;
        this.password = password;
        this.host = host;
        this.port = parseInt(port);
        this.tls = tls;
        this.mailbox = mailbox;
    }
}

export { EmailInfo, ImapConfig };
