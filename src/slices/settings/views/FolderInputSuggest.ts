import { App, AbstractInputSuggest, normalizePath, TFolder } from 'obsidian';

/**
 * Input suggest component for folder selection with type-ahead support
 */
export class FolderInputSuggest extends AbstractInputSuggest<string> {
	// Store reference to input element for triggering onChange events
	private inputElement: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputElement = inputEl;
	}

	getSuggestions(inputStr: string): string[] {
		const normalizedInput = normalizePath(inputStr.toLowerCase());
		const folders: string[] = [];
		
		// Get all folders from the vault
		function getAllFolders(folder: TFolder): void {
			folders.push(folder.path);
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					getAllFolders(child);
				}
			}
		}
		
		const rootFolder = this.app.vault.getRoot();
		if (rootFolder instanceof TFolder) {
			getAllFolders(rootFolder);
		}
		
		// Filter folders that match the input
		const matchingFolders = folders.filter(folder => {
			const normalizedFolder = normalizePath(folder.toLowerCase());
			return normalizedFolder.includes(normalizedInput) || 
				   normalizedFolder === normalizedInput;
		});
		
		// Sort by relevance (exact matches first, then by path length)
		matchingFolders.sort((a, b) => {
			const aNormalized = normalizePath(a.toLowerCase());
			const bNormalized = normalizePath(b.toLowerCase());
			
			// Exact matches first
			if (aNormalized === normalizedInput) return -1;
			if (bNormalized === normalizedInput) return 1;
			
			// Then by path length (shorter paths first)
			return a.length - b.length;
		});
		
		return matchingFolders.slice(0, 10); // Limit to 10 suggestions
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.textContent = folder;
	}

	selectSuggestion(folder: string, evt: MouseEvent | KeyboardEvent): void {
		// Use setValue from base class to set the value
		this.setValue(folder);
		// Trigger input event to fire onChange callback registered in GeneralSettingsView
		this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
		this.close();
	}
}

