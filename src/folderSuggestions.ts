import {App, TAbstractFile, TFolder} from "obsidian";
import EmailImporterPlugin from "./main";

export class FolderSuggestions {
	app: App;
	plugin: EmailImporterPlugin;

	constructor(app: App, plugin: EmailImporterPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	setupFolderSuggestions(inputEl: HTMLInputElement): void {
		inputEl.addEventListener('click', async () => {
			const folders = this.getFolders();
			const suggestionEl = this.createSuggestionContainer(inputEl);

			const searchInputEl = this.createSearchInput(suggestionEl, folders, (selectedPath) => {
				inputEl.value = selectedPath;
				this.plugin.settings.savePath = selectedPath;
				this.plugin.saveSettings();
				suggestionEl.remove();
			});

			searchInputEl.focus();
		});
	}

	private getFolders(): string[] {
		const folders: string[] = [];
		this.app.vault.getAllLoadedFiles().forEach((file: TAbstractFile) => {
			if (file instanceof TFolder) {
				folders.push(file.path);
			}
		});
		return folders;
	}

	private createSuggestionContainer(inputEl: HTMLInputElement): HTMLElement {
		// Remove any existing suggestion container
		document.querySelectorAll('.folder-suggestion-container').forEach(el => el.remove());

		const rect = inputEl.getBoundingClientRect();
		const container = document.createDiv('div');
		container.addClass('folder-suggestion-container');

		container.setCssStyles({
			width: rect.width + 'px',
			top: (rect.bottom + 5) + 'px',
			left: rect.left + 'px'
		});

		const settingsPanel = inputEl.closest('.vertical-tab-content');
		const parent = settingsPanel || document.body;
		parent.appendChild(container);

		// Add event listener to close the popup when clicking outside
		window.setTimeout(() => {
			document.addEventListener('click', (e) => {
				if (!container.contains(e.target as Node) && e.target !== inputEl) {
					container.remove();
				}
			}, {once: true});
		}, 100);

		return container;
	}

	private updateSuggestions(folders: string[], resultsList: HTMLElement, onSelect: (path: string) => void, query: string) {
		resultsList.empty();

		folders
			.filter(folder => folder.toLowerCase().includes(query.toLowerCase()))
			.forEach(folder => this.addSuggestionItem(folder, resultsList, onSelect, query));

		if (resultsList.childElementCount === 0) {
			const noResults = document.createDiv();
			noResults.textContent = 'No matching folders found';
			noResults.classList.add('folder-suggestion-no-results-message');
			resultsList.appendChild(noResults);
		}
	}

	private addSuggestionItem(path: string, resultsList: HTMLElement, onSelect: (path: string) => void, query: string) {
		const item = document.createDiv();
		item.addClass('suggestion-item');
		item.setAttribute('data-path', path);
		item.addClass('folder-suggestion-suggestion-item');

		// Highlight the matching part if there's a query
		if (query && path !== '/') {
			const lowerPath = path.toLowerCase();
			const lowerQuery = query.toLowerCase();
			const index = lowerPath.indexOf(lowerQuery);

			if (index >= 0) {
				const before = path.substring(0, index);
				const match = path.substring(index, index + query.length);
				const after = path.substring(index + query.length);

				item.appendText(before);
				const strong = document.createEl('strong');
				strong.textContent = match;
				item.appendChild(strong);
				item.appendText(after);
			} else {
				item.textContent = path;
			}
		} else {
			item.textContent = path === '/' ? 'Root folder (/)' : path;
		}

		// Hover effect
		item.addEventListener('mouseenter', () => {
			resultsList.querySelectorAll('.suggestion-item').forEach(el =>
				el.classList.remove('is-selected'));
		});

		item.addEventListener('mouseleave', () => {
		});

		// Select on click
		item.addEventListener('click', () => {
			onSelect(path);
		});

		resultsList.appendChild(item);
	}

	private createSearchInput(container: HTMLElement, folders: string[], onSelect: (path: string) => void): HTMLInputElement {
		// Create search input
		const searchContainer = document.createDiv();
		searchContainer.classList.add('folder-suggestion-search-container');

		const searchInput = document.createEl('input');
		searchInput.type = 'text';
		searchInput.placeholder = 'Search folders...';
		searchInput.addClass('folder-suggestion-search-input');

		searchContainer.appendChild(searchInput);
		container.appendChild(searchContainer);

		const resultsList = document.createDiv();
		resultsList.addClass('suggestion-list');
		container.appendChild(resultsList);

		// Initial population of all folders
		this.updateSuggestions(folders, resultsList, onSelect, '');

		// Track currently selected index
		let selectedIndex = -1;

		// Handle keyboard navigation
		searchInput.addEventListener('keydown', (e) => {
			const items = resultsList.querySelectorAll('.suggestion-item');

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedIndex = (selectedIndex + 1) % items.length;
				this.updateSelection(items, selectedIndex);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
				this.updateSelection(items, selectedIndex);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (selectedIndex >= 0 && items[selectedIndex]) {
					const path = items[selectedIndex].getAttribute('data-path');
					if (path) onSelect(path);
				}
			} else if (e.key === 'Escape') {
				container.remove();
			}
		});


		// Update on search input change
		searchInput.addEventListener('input', () => {
			const query = searchInput.value.toLowerCase();
			this.updateSuggestions(folders, resultsList, onSelect, query);
			selectedIndex = -1; // Reset selection when input changes
		});

		return searchInput;
	}

	private updateSelection(items: NodeListOf<Element>, index: number) {
		// Clear previous selection
		items.forEach(item => {
			const htmlItem = item as HTMLElement;
			htmlItem.classList.remove('is-selected');
			htmlItem.addClass('folder-suggestion-update-selection-html-item')
		});

		// Apply selection styling
		if (index >= 0 && items[index]) {
			const selectedItem = items[index] as HTMLElement;
			selectedItem.classList.add('is-selected');
			selectedItem.addClass('folder-suggestion-update-selection-selected-item');
			selectedItem.scrollIntoView({block: 'nearest'});
		}
	}
}
