import ImapClient from "./client";
import {App, Plugin, PluginSettingTab, Setting} from 'obsidian';
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
	client: UseImapClient;

	async onload() {
		await this.loadSettings();
		this.client = new UseImapClient(this.settings);

		this.addCommand({
			id: 'email-to-obsidian-note',
			name: 'Fetch email to Obsidian note',
			callback: () => {
				this.client.do();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
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

	async getMailboxNames() {
		await this.client.connect();
		const mailboxes = await this.client.getAvailableMailboxes()
		this.client.terminate();
		return mailboxes;
	}

	async do(n: number = 3) {
		await this.client.connect();
		const emailInfos = await this.client.fetch(n, true);
		const unreadEmails = emailInfos.filter(email => email.isUnread);
		if (unreadEmails.length > 0) {
			await this.client.markAsRead(unreadEmails.map(x => x.uid));
		}
		this.client.terminate();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	mailboxDropdown: HTMLSelectElement;

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

		const mailboxSetting = new Setting(containerEl)
			.setName('IMAP Mailbox')
			.setDesc('Select a mailbox or press refresh to load available mailboxes')
			.addDropdown(dropdown => {
				this.mailboxDropdown = dropdown.selectEl;
				// Only add the current mailbox initially
				dropdown.addOption(this.plugin.settings.mailbox, this.plugin.settings.mailbox);
				dropdown.setValue(this.plugin.settings.mailbox);
				dropdown.onChange(async (value) => {
					this.plugin.settings.mailbox = value;
					await this.plugin.saveSettings();
				});
			});

		mailboxSetting.addButton(button => {
			button
				.setIcon('refresh-cw')
				.setTooltip('Load available mailboxes')
				.onClick(async () => {
					button.setDisabled(true);
					const currentValue = this.plugin.settings.mailbox;

					try {
						// Clear the dropdown first
						this.mailboxDropdown.innerHTML = '';

						// Add a placeholder option while loading
						const loadingOption = document.createElement('option');
						loadingOption.text = 'Loading mailboxes...';
						loadingOption.disabled = true;
						this.mailboxDropdown.appendChild(loadingOption);
						this.mailboxDropdown.value = 'Loading mailboxes...';

						// Fetch mailboxes
						const mailboxes = await this.plugin.client.getMailboxNames();

						// Clear the dropdown again
						this.mailboxDropdown.innerHTML = '';

						// Add all the mailboxes
						mailboxes.forEach(mailbox => {
							const option = document.createElement('option');
							option.value = mailbox;
							option.text = mailbox;
							this.mailboxDropdown.appendChild(option);
						});

						// Set the value back to the current setting if it exists in the list
						if (mailboxes.includes(currentValue)) {
							this.mailboxDropdown.value = currentValue;
						} else if (mailboxes.length > 0) {
							// Set to the first mailbox if current doesn't exist
							this.plugin.settings.mailbox = mailboxes[0];
							this.mailboxDropdown.value = mailboxes[0];
							await this.plugin.saveSettings();
						}
					} catch (error) {
						console.error('Error fetching mailboxes:', error);

						// Reset dropdown to just show the current value in case of error
						this.mailboxDropdown.innerHTML = '';
						const option = document.createElement('option');
						option.value = currentValue;
						option.text = currentValue;
						this.mailboxDropdown.appendChild(option);
						this.mailboxDropdown.value = currentValue;
					} finally {
						button.setDisabled(false);
					}
				});
		});

	}
}
