import { EmailInfo } from "./models";

interface EmailFilterStrategy {
	shouldInclude(email: EmailInfo): boolean;
}

class PrefixFilterStrategy implements EmailFilterStrategy {
	constructor(private prefix: string) {}

	shouldInclude(email: EmailInfo): boolean {
		if (!this.prefix) return true;
		return email.subject.startsWith(this.prefix);
	}
}

class UnreadFilterStrategy implements EmailFilterStrategy {
	shouldInclude(email: EmailInfo): boolean {
		return email.isUnread === true;
	}
}

class EmailFilterManager {
	private filters: EmailFilterStrategy[] = [];

	addFilter(filter: EmailFilterStrategy): void {
		this.filters.push(filter);
	}

	clearFilters(): void {
		this.filters = [];
	}

	filterEmails(emails: EmailInfo[]): EmailInfo[] {
		return emails.filter(email =>
			this.filters.every(filter => filter.shouldInclude(email))
		);
	}
}

export {
	PrefixFilterStrategy,
	UnreadFilterStrategy,
	EmailFilterManager
}

export type {
	EmailFilterStrategy
}
