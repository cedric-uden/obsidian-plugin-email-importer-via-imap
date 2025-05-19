import {App} from "obsidian";
import MyPlugin from "./main";

export class FolderSuggestions {
	app: App;
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		this.app = app;
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

	setupFolderSuggestions(inputEl: HTMLInputElement): void {
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
				position: 'fixed',
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

			// Append to settings panel if we're in it, otherwise to body
			const settingsPanel = inputEl.closest('.vertical-tab-content');
			const parent = settingsPanel || document.body;
			parent.appendChild(container);

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
