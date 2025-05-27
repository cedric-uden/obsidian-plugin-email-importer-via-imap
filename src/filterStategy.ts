import { EmailInfo } from "./models";

interface EmailFilterStrategy {
	shouldInclude(email: EmailInfo): boolean;
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
	UnreadFilterStrategy,
	EmailFilterManager
}

export type {
	EmailFilterStrategy
}
