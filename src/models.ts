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

export { EmailInfo };
