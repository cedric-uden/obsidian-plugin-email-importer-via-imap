import ImapClient from "./client";
import {App, Plugin, PluginSettingTab, Setting, moment, Notice, DropdownComponent} from 'obsidian';
import {ImapConfig} from "./models";


// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	username: string;
	password: string;
	host: string;
	port: string;
	mailbox: string;
	nLastMessages: string;
	savePath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	username: 'username',
	password: 'password',
	host: 'imap.example.com',
	port: '993',
	mailbox: 'INBOX',
	nLastMessages: '5',
	savePath: '/',
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	client: UseImapClient;

	async onload() {
		await this.loadSettings();
		this.client = new UseImapClient(this);

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
	private plugin: MyPlugin;

	constructor(plugin: MyPlugin) {
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

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	mailboxDropdown: HTMLSelectElement;
	folderInput: HTMLInputElement;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private getFolders(): string[] {
		const folders: string[] = [];
		this.app.vault.getAllLoadedFiles().forEach((file: any) => {
			if (file.children) {
				folders.push(file.path);
			}
		});
		return folders;
	}

	private async loadFolders(dropdown: any): Promise<void> {
		dropdown.selectEl.innerHTML = '';

		const folders = this.getFolders();

		folders.forEach(folder => {
			dropdown.addOption(folder, folder);
		});

		if (folders.includes(this.plugin.settings.savePath)) {
			dropdown.setValue(this.plugin.settings.savePath);
		} else {
			dropdown.setValue('/');
		}
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

		new Setting(containerEl)
			.setName('N Last Messages')
			.setDesc("Determine how many emails to load to find unread emails.")
			.addText(text => text
				.setPlaceholder('N Last Messages')
				.setValue(this.plugin.settings.nLastMessages)
				.onChange(async (value) => {
					this.plugin.settings.nLastMessages = value;
					await this.plugin.saveSettings();
				}));

		const folderSetting = new Setting(containerEl)
			.setName('Email Notes Location')
			.setDesc('Choose where to save email notes')
			.addText(text => {
				this.folderInput = text.inputEl;
				text.setValue(this.plugin.settings.savePath)
					.onChange(async (value) => {
						this.plugin.settings.savePath = value;
						await this.plugin.saveSettings();
					});

				// Add the suggestion functionality
				this.setupFolderSuggestions(this.folderInput);

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

	private setupFolderSuggestions(inputEl: HTMLInputElement): void {
		// Store reference to this for use in callbacks
		const self = this;

		inputEl.addEventListener('click', async () => {
			// Get all folders
			const folders = this.getFolders();

			// Create the suggestion popup
			const suggestionEl = createSuggestionContainer(inputEl);

			// Add search functionality
			const searchInputEl = createSearchInput(suggestionEl, folders, (selectedPath) => {
				inputEl.value = selectedPath;
				this.plugin.settings.savePath = selectedPath;
				this.plugin.saveSettings();
				suggestionEl.remove();
			});

			// Focus the search input
			searchInputEl.focus();
		});

		// Create a suggestion container element positioned below the input
		function createSuggestionContainer(inputEl: HTMLInputElement): HTMLElement {
			// Remove any existing suggestion container
			document.querySelectorAll('.folder-suggestion-container').forEach(el => el.remove());

			const rect = inputEl.getBoundingClientRect();
			const container = document.createElement('div');
			container.addClass('folder-suggestion-container');

			// Style the container
			Object.assign(container.style, {
				position: 'absolute',
				width: rect.width + 'px',
				maxHeight: '200px',
				overflowY: 'auto',
				zIndex: '999',
				background: 'var(--background-primary)',
				border: '1px solid var(--background-modifier-border)',
				borderRadius: '4px',
				boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
				top: (rect.bottom + 5) + 'px',
				left: rect.left + 'px'
			});

			document.body.appendChild(container);

			// Add event listener to close the popup when clicking outside
			setTimeout(() => {
				document.addEventListener('click', (e) => {
					if (!container.contains(e.target as Node) && e.target !== inputEl) {
						container.remove();
					}
				}, {once: true});
			}, 100);

			return container;
		}

		// Create a search input and suggestion list
		function createSearchInput(container: HTMLElement, folders: string[], onSelect: (path: string) => void): HTMLInputElement {
			// Create search input
			const searchContainer = document.createElement('div');
			searchContainer.style.padding = '8px';

			const searchInput = document.createElement('input');
			searchInput.type = 'text';
			searchInput.placeholder = 'Search folders...';
			searchInput.style.width = '100%';
			searchInput.style.padding = '4px';

			searchContainer.appendChild(searchInput);
			container.appendChild(searchContainer);

			const resultsList = document.createElement('div');
			resultsList.addClass('suggestion-list');
			container.appendChild(resultsList);

			// Initial population of all folders
			updateSuggestions(folders, resultsList, onSelect, '');

			// Update on search input change
			searchInput.addEventListener('input', () => {
				const query = searchInput.value.toLowerCase();
				updateSuggestions(folders, resultsList, onSelect, query);
			});

			return searchInput;
		}

		function updateSuggestions(folders: string[], resultsList: HTMLElement, onSelect: (path: string) => void, query: string) {
			resultsList.empty();

			folders
				.filter(folder => folder.toLowerCase().includes(query.toLowerCase()))
				.forEach(folder => addSuggestionItem(folder, resultsList, onSelect, query));

			if (resultsList.childElementCount === 0) {
				const noResults = document.createElement('div');
				noResults.textContent = 'No matching folders found';
				noResults.style.padding = '8px';
				noResults.style.color = 'var(--text-muted)';
				noResults.style.textAlign = 'center';
				resultsList.appendChild(noResults);
			}
		}

		function addSuggestionItem(path: string, resultsList: HTMLElement, onSelect: (path: string) => void, query: string) {
			const item = document.createElement('div');
			item.addClass('suggestion-item');

			Object.assign(item.style, {
				padding: '6px 8px',
				cursor: 'pointer',
				borderBottom: '1px solid var(--background-modifier-border)'
			});

			// Highlight the matching part if there's a query
			if (query && path !== '/') {
				const lowerPath = path.toLowerCase();
				const lowerQuery = query.toLowerCase();
				const index = lowerPath.indexOf(lowerQuery);

				if (index >= 0) {
					const before = path.substring(0, index);
					const match = path.substring(index, index + query.length);
					const after = path.substring(index + query.length);

					item.innerHTML = before + '<strong>' + match + '</strong>' + after;
				} else {
					item.textContent = path;
				}
			} else {
				item.textContent = path === '/' ? 'Root folder (/)' : path;
			}

			// Hover effect
			item.addEventListener('mouseenter', () => {
				item.style.backgroundColor = 'var(--interactive-accent)';
				item.style.color = 'var(--text-on-accent)';
			});

			item.addEventListener('mouseleave', () => {
				item.style.backgroundColor = '';
				item.style.color = '';
			});

			// Select on click
			item.addEventListener('click', () => {
				onSelect(path);
			});

			resultsList.appendChild(item);
		}
	}
}
