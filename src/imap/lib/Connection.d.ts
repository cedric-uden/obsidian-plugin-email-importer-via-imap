import {EventEmitter} from "events";

declare interface FetchOptions {
	bodies?: string[] | string;
	struct?: boolean;
	envelope?: boolean;
	size?: boolean;
	extensions?: string[];
	markSeen?: boolean;
	modifiers?: Record<string, unknown>;
}

export declare interface Box {
	name: string;
	flags: string[];
	readOnly: boolean;
	uidvalidity: number;
	uidnext: number;
	permFlags: string[];
	keywords: string[];
	newKeywords: boolean;
	persistentUIDs: boolean;
	nomodseq: boolean;
	messages: {
		total: number;
		new: number;
		unseen?: number;
	};
	highestmodseq?: string;
}

export declare interface ImapConfig {
	user: string;
	password: string;
	host: string;
	port: number;
	tls: boolean;
	tlsOptions?: Record<string, unknown>;
	autotls?: 'always' | 'required' | 'never';
	connTimeout?: number;
	authTimeout?: number;
	keepalive?: boolean | { interval?: number; idleInterval?: number; forceNoop?: boolean };
}

export declare interface Mailboxes {
	[key: string]: {
		attribs: string[];
		delimiter: string;
		children?: Mailboxes;
		parent?: Mailboxes;
	};
}

export declare interface SearchCriteria {
	[key: string]: string | number | Date | string[] | SearchCriteria;
}

export declare interface ParsedHeaders {
	[key: string]: string[];
}

declare class Connection extends EventEmitter {
	constructor(config: ImapConfig);

	connect(): void;

	end(): void;

	destroy(): void;

	openBox(name: string, readOnly: boolean, cb: (err: Error | null, box?: Box) => void): void;

	closeBox(shouldExpunge: boolean, cb: (err: Error | null) => void): void;

	getBoxes(cb: (err: Error | null, boxes?: Mailboxes) => void): void;
	getBoxes(namespace: string, cb: (err: Error | null, boxes?: Mailboxes) => void): void;

	getSubscribedBoxes(namespace: string, cb: (err: Error | null, boxes?: Mailboxes) => void): void;

	addBox(name: string, cb: (err: Error | null) => void): void;

	delBox(name: string, cb: (err: Error | null) => void): void;

	renameBox(oldname: string, newname: string, cb: (err: Error | null, box?: Box) => void): void;

	subscribeBox(name: string, cb: (err: Error | null) => void): void;

	unsubscribeBox(name: string, cb: (err: Error | null) => void): void;

	setFlags(uids: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;

	addFlags(uids: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;

	delFlags(uids: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;

	setKeywords(uids: number | number[], keywords: string | string[], cb: (err: Error | null) => void): void;

	addKeywords(uids: number | number[], keywords: string | string[], cb: (err: Error | null) => void): void;

	delKeywords(uids: number | number[], keywords: string | string[], cb: (err: Error | null) => void): void;

	fetch(uids: number | number[] | string, options?: FetchOptions): EventEmitter;

	search(criteria: SearchCriteria[], cb: (err: Error | null, results?: number[]) => void): void;

	seq: {
		fetch(seqnos: number | number[] | string, options?: FetchOptions): EventEmitter;
		setFlags(seqnos: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;
		addFlags(seqnos: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;
		delFlags(seqnos: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;
	};

	static parseHeader(header: string): ParsedHeaders;
}

export = Connection;
