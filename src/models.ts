class EmailInfo {
    date: Date;
    subject: string;
    body: string;
    isUnread: boolean | null;
    uid: number;

    constructor(
        date: Date,
        subject: string = '',
        body: string = '',
        isUnread: boolean | null = null,
        uid: number = 0,
    ) {
        this.date = date;
        this.subject = subject;
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
        user: string,
        password: string,
        host: string,
        port: string,
        tls: boolean,
        mailbox: string,
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
