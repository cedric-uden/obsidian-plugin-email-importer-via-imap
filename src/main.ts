import ImapClient from "./client";
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {ImapConfig} from "./models";


// Remember to rename these classes and interfaces!

interface MyPluginSettings {
    username: string;
    password: string;
    host: string;
    port: string;
    mailbox: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    username: 'username',
    password: 'password',
    host: 'imap.example.com',
    port: '993',
    mailbox: 'INBOX'
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'email-to-obsidian-note',
            name: 'Fetch email to Obsidian note',
            callback: () => {
                new UseImapClient(this.settings).do();
            }
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new SampleSettingTab(this.app, this));

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}


class UseImapClient {
    private client: ImapClient;

    constructor(settings: MyPluginSettings) {
        const config = new ImapConfig(settings.username, settings.password, settings.host, settings.port, true, settings.mailbox);
        this.client = new ImapClient(config);
    }

    do(n: number = 3) {
        this.client.connect();
        this.client.fetch(n).then(
            (emailInfos) => {
                console.log('Fetched emails:', emailInfos);
            }
        ).catch((err) => {
                console.error('Error fetching emails:', err);
            }
        );

        this.client.markAsRead([1]).then();

        this.client.getAvailableMailboxes().then(
            (mailboxes) => {
                console.log('Available mailboxes:', mailboxes);
                this.client.terminate();
            }
        ).catch((err) => {
                console.error('Error fetching mailboxes:', err);
                this.client.terminate();
            }
        );
    }
}

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('IMAP Username')
            .addText(text => text
                .setPlaceholder('Enter username')
                .setValue(this.plugin.settings.username)
                .onChange(async (value) => {
                    this.plugin.settings.username = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('IMAP Password')
            .addText(text => text
                .setPlaceholder('Enter password')
                .setValue(this.plugin.settings.password)
                .onChange(async (value) => {
                    this.plugin.settings.password = value;
                    await this.plugin.saveSettings();
                }));


        new Setting(containerEl)
            .setName('IMAP Hostname')
            .addText(text => text
                .setPlaceholder('Enter hostname')
                .setValue(this.plugin.settings.host)
                .onChange(async (value) => {
                    this.plugin.settings.host = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('IMAP Port')
            .addText(text => text
                .setPlaceholder('Enter port')
                .setValue(this.plugin.settings.port)
                .onChange(async (value) => {
                    this.plugin.settings.port = value;
                    await this.plugin.saveSettings();
                }));


        new Setting(containerEl)
            .setName('IMAP Mailbox')
            .addText(text => text
                .setPlaceholder('Enter mailbox')
                .setValue(this.plugin.settings.mailbox)
                .onChange(async (value) => {
                    this.plugin.settings.mailbox = value;
                    await this.plugin.saveSettings();
                }));
    }
}
