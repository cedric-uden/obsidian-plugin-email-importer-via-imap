import { EventEmitter } from "events";

declare interface FetchOptions {
    bodies?: string[] | string;
    struct?: boolean;
    envelope?: boolean;
    size?: boolean;
    extensions?: string[];
    markSeen?: boolean;
    modifiers?: Record<string, any>;
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

declare class Connection extends EventEmitter {
    constructor(config: any);

    connect(): void;
    end(): void;
    destroy(): void;

    openBox(name: string, readOnly: boolean, cb: (err: Error | null, box?: Box) => void): void;
    closeBox(shouldExpunge: boolean, cb: (err: Error | null) => void): void;
    getBoxes(namespace: string, cb: (err: Error | null, boxes?: Record<string, any>) => void): void;
    getSubscribedBoxes(namespace: string, cb: (err: Error | null, boxes?: Record<string, any>) => void): void;
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
    search(criteria: any[], cb: (err: Error | null, results?: number[]) => void): void;

    getBoxes(cb: (err: Error | null, boxes?: Record<string, any>) => void): void;

    seq: {
        fetch(seqnos: number | number[] | string, options?: FetchOptions): EventEmitter;
        setFlags(seqnos: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;
        addFlags(seqnos: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;
        delFlags(seqnos: number | number[], flags: string | string[], cb: (err: Error | null) => void): void;
        // ... other seq methods as needed
    };

    static parseHeader(header: string): any;
}

export = Connection;
