import ImapClient from "./client";
import {App, Plugin, PluginSettingTab, Setting, moment, Notice, DropdownComponent} from 'obsidian';
import {ImapConfig} from "./models";
import {FolderSuggestions} from "./folderSuggestions";


interface EmailImporterSettings {
	username: string;
	password: string;
	host: string;
	port: string;
	mailbox: string;
	nLastMessages: string;
	savePath: string;
}

const DEFAULT_SETTINGS: EmailImporterSettings = {
	username: 'username',
	password: 'password',
	host: 'imap.example.com',
	port: '993',
	mailbox: 'INBOX',
	nLastMessages: '5',
	savePath: '/',
}

export default class EmailImporterPlugin extends Plugin {
	settings: EmailImporterSettings;
	client: UseImapClient;

	async onload() {
		await this.loadSettings();
		this.client = new UseImapClient(this);

		this.addCommand({
			id: 'email-import',
			name: 'Email import',
			callback: () => {
				this.client.do();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EmailImporterSettingsTab(this.app, this));
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
	private plugin: EmailImporterPlugin;

	constructor(plugin: EmailImporterPlugin) {
		this.plugin = plugin;
		const config = new ImapConfig(plugin.settings.username, plugin.settings.password, plugin.settings.host, plugin.settings.port, true, plugin.settings.mailbox);
		this.client = new ImapClient(config);
	}

	async getMailboxNames() {
		await this.client.connect();
		const mailboxes = await this.client.getAvailableMailboxes()
		this.client.terminate();
		return mailboxes;
	}

	async do() {
		await this.client.connect();
		const n = parseInt(this.plugin.settings.nLastMessages)
		const emailInfos = await this.client.fetch(n, true);
		const unreadEmails = emailInfos.filter(email => email.isUnread);

		for (const email of unreadEmails) {
			const formattedDate = moment(email.date).format('YYYYMMDD.HHmmss');
			const noteContent = email.body;
			const noteName = `${formattedDate}-EmailToNote`;

			// Construct the full file path using the configured save path
			const savePath = this.plugin.settings.savePath === '/'
				? `${noteName}.md`
				: `${this.plugin.settings.savePath}/${noteName}.md`;
			try {
				await this.plugin.app.vault.create(savePath, noteContent);
			} catch (error) {
				console.error(`Failed to create file for email: ${savePath}`, error);
			}
		}

		new Notice(`Processed ${unreadEmails.length} unread emails.`);

		if (unreadEmails.length > 0) {
			await this.client.markAsRead(unreadEmails.map(x => x.uid));
		}
		this.client.terminate();
	}
}

class EmailImporterSettingsTab extends PluginSettingTab {
	plugin: EmailImporterPlugin;
	mailboxDropdown: HTMLSelectElement;
	folderInput: HTMLInputElement;

	constructor(app: App, plugin: EmailImporterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Email address')
			.addText(text => text
				.setPlaceholder('Enter username')
				.setValue(this.plugin.settings.username)
				.onChange(async (value) => {
					this.plugin.settings.username = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('IMAP password')
			.addText(text => text
				.setPlaceholder('Enter password')
				.setValue(this.plugin.settings.password)
				.onChange(async (value) => {
					this.plugin.settings.password = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('IMAP hostname')
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
			.setName('IMAP mailbox')
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

		new Setting(containerEl)
			.setName('N last messages')
			.setDesc("Determine how many emails to load to find unread emails.")
			.addText(text => text
				.setPlaceholder('N Last Messages')
				.setValue(this.plugin.settings.nLastMessages)
				.onChange(async (value) => {
					this.plugin.settings.nLastMessages = value;
					await this.plugin.saveSettings();
				}));

		const folderSetting = new Setting(containerEl)
			.setName('Email motes location')
			.setDesc('Choose where to save email notes')
			.addText(text => {
				this.folderInput = text.inputEl;
				text.setValue(this.plugin.settings.savePath)
					.onChange(async (value) => {
						this.plugin.settings.savePath = value;
						await this.plugin.saveSettings();
					});

				// Add the suggestion functionality
				new FolderSuggestions(this.app, this.plugin).setupFolderSuggestions(this.folderInput);

				return text;
			});

		folderSetting.addButton(button => {
			button
				.setIcon('folder')
				.setTooltip('Browse folders')
				.onClick(() => {
					// Trigger the suggestions popup
					const event = new MouseEvent('click');
					this.folderInput.dispatchEvent(event);
				});
		});
	}
}
