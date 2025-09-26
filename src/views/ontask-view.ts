import { ItemView, WorkspaceLeaf, Notice, MarkdownView } from 'obsidian';
import { CheckboxItem, CheckboxFinderService } from '../services/checkbox-finder';
import { OnTaskSettings } from '../types';
import { Plugin } from 'obsidian';

export const ONTASK_VIEW_TYPE = 'ontask-view';

export class OnTaskView extends ItemView {
	private checkboxFinder: CheckboxFinderService;
	private settings: OnTaskSettings;
	private plugin: Plugin;
	private checkboxes: CheckboxItem[] = [];
	private displayedCount: number = 100;
	private currentPage: number = 0;
	private hideCompleted: boolean = false;

	constructor(leaf: WorkspaceLeaf, checkboxFinder: CheckboxFinderService, settings: OnTaskSettings, plugin: Plugin) {
		super(leaf);
		this.checkboxFinder = checkboxFinder;
		this.settings = settings;
		this.plugin = plugin;
		this.hideCompleted = settings.hideCompletedTasks;
	}

	getViewType(): string {
		return ONTASK_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'On Task';
	}

	getIcon(): string {
		return 'checkmark';
	}

	async onOpen() {
		this.contentEl.empty();
		
		// Add header
		const header = this.contentEl.createEl('div', { cls: 'ontask-header' });
		header.createEl('h2', { text: 'On Task' });
		
		// Add buttons container
		const buttonsContainer = header.createEl('div', { cls: 'ontask-buttons-container' });
		
		// Add hide completed tasks button
		const hideCompletedButton = buttonsContainer.createEl('button', { 
			text: this.hideCompleted ? 'Show Completed' : 'Hide Completed',
			cls: 'ontask-hide-completed-btn'
		});
		hideCompletedButton.addEventListener('click', () => this.toggleHideCompleted());
		
		// Add refresh button
		const refreshButton = buttonsContainer.createEl('button', { 
			text: 'Refresh',
			cls: 'ontask-refresh-btn'
		});
		refreshButton.addEventListener('click', () => this.refreshCheckboxes());
		
		// Add loading indicator
		const loadingEl = this.contentEl.createEl('div', { 
			text: 'Loading checkboxes...',
			cls: 'ontask-loading'
		});
		
		// Load checkboxes
		await this.loadCheckboxes();
		
		// Remove loading indicator
		loadingEl.remove();
	}

	async onClose() {
		// Cleanup if needed
	}

	private async loadCheckboxes() {
		try {
			this.checkboxes = await this.checkboxFinder.findAllCheckboxes(this.hideCompleted);
			this.renderCheckboxes();
		} catch (error) {
			console.error('Error loading checkboxes:', error);
			this.showError('Failed to load checkboxes');
		}
	}

	private async refreshCheckboxes() {
		const loadingEl = this.contentEl.createEl('div', { 
			text: 'Refreshing...',
			cls: 'ontask-loading'
		});
		
		// Reset pagination
		this.currentPage = 0;
		
		await this.loadCheckboxes();
		loadingEl.remove();
	}

	private async toggleHideCompleted() {
		this.hideCompleted = !this.hideCompleted;
		this.settings.hideCompletedTasks = this.hideCompleted;
		
		// Save the setting to data.json
		await this.plugin.saveData(this.settings);
		
		// Update button text
		const hideCompletedButton = this.contentEl.querySelector('.ontask-hide-completed-btn') as HTMLButtonElement;
		if (hideCompletedButton) {
			hideCompletedButton.textContent = this.hideCompleted ? 'Show Completed' : 'Hide Completed';
		}
		
		// Reload checkboxes with new setting
		await this.refreshCheckboxes();
	}

	private renderCheckboxes() {
		// Clear existing content (except header)
		const contentEl = this.contentEl.querySelector('.ontask-content') || this.contentEl.createEl('div', { cls: 'ontask-content' });
		contentEl.empty();
		
		if (this.checkboxes.length === 0) {
			contentEl.createEl('div', { 
				text: 'No checkboxes found in any streams.',
				cls: 'ontask-empty'
			});
			return;
		}

		// Calculate pagination
		const startIndex = this.currentPage * this.displayedCount;
		const endIndex = Math.min(startIndex + this.displayedCount, this.checkboxes.length);
		const displayedCheckboxes = this.checkboxes.slice(startIndex, endIndex);
		const hasMore = endIndex < this.checkboxes.length;

		// Add pagination info
		const paginationInfo = contentEl.createEl('div', { cls: 'ontask-pagination-info' });
		paginationInfo.createEl('span', { 
			text: `Showing ${startIndex + 1}-${endIndex} of ${this.checkboxes.length} checkboxes`,
			cls: 'ontask-pagination-text'
		});

		// Group displayed checkboxes by file
		const checkboxesByFile = this.groupCheckboxesByFile(displayedCheckboxes);
		
		// Render each file
		for (const [fileName, fileCheckboxes] of checkboxesByFile) {
			const fileSection = contentEl.createEl('div', { cls: 'ontask-file-section' });
			
			// File header
			const fileHeader = fileSection.createEl('div', { cls: 'ontask-file-header' });
			fileHeader.createEl('h3', { text: fileName });
			fileHeader.createEl('span', { 
				text: `${fileCheckboxes.length} checkbox${fileCheckboxes.length !== 1 ? 'es' : ''}`,
				cls: 'ontask-count'
			});
			
			// Add stream info to file header
			const streamInfo = fileHeader.createEl('div', { cls: 'ontask-stream-info' });
			const streamNames = [...new Set(fileCheckboxes.map(cb => cb.streamName))];
			streamInfo.createEl('span', { 
				text: `Streams: ${streamNames.join(', ')}`,
				cls: 'ontask-stream-names'
			});
			
			// Checkboxes list
			const checkboxesList = fileSection.createEl('div', { cls: 'ontask-checkboxes-list' });
			
			for (const checkbox of fileCheckboxes) {
				const checkboxEl = checkboxesList.createEl('div', { cls: 'ontask-checkbox-item' });
				
				// Create a container for the checkbox, text, and button
				const checkboxContainer = checkboxEl.createEl('div', { cls: 'ontask-checkbox-container' });
				
				// Extract checkbox state and text
				const { isChecked, checkboxText, remainingText } = this.parseCheckboxLine(checkbox.lineContent);
				
				// Create the actual checkbox input
				const checkboxInput = checkboxContainer.createEl('input', {
					type: 'checkbox',
					cls: 'ontask-checkbox-input'
				}) as HTMLInputElement;
				checkboxInput.checked = isChecked;
				
				// Add click handler to toggle checkbox
				checkboxInput.addEventListener('change', async () => {
					await this.toggleCheckbox(checkbox, checkboxInput.checked);
				});
				
				// Create label for the checkbox
				const checkboxLabel = checkboxContainer.createEl('label', { cls: 'ontask-checkbox-label' });
				checkboxLabel.appendChild(checkboxInput);
				
				// Add the remaining text (without the checkbox mark)
				if (remainingText) {
					checkboxLabel.createEl('span', { 
						text: remainingText,
						cls: 'ontask-checkbox-text'
					});
				}
				
				// Add Go to button inline with the task
				const linkButton = checkboxLabel.createEl('button', {
					text: 'Go to',
					cls: 'ontask-link-btn'
				});
				linkButton.addEventListener('click', (e) => {
					e.stopPropagation(); // Prevent checkbox toggle when clicking button
					this.goToFile(checkbox);
				});
			}
		}

		// Add Load More button if there are more checkboxes
		if (hasMore) {
			const loadMoreContainer = contentEl.createEl('div', { cls: 'ontask-load-more-container' });
			const loadMoreButton = loadMoreContainer.createEl('button', {
				text: 'Load More',
				cls: 'ontask-load-more-btn'
			});
			
			loadMoreButton.addEventListener('click', () => {
				this.loadMoreCheckboxes();
			});
		}
	}

	private groupCheckboxesByStream(checkboxes: CheckboxItem[] = this.checkboxes): Map<string, CheckboxItem[]> {
		const grouped = new Map<string, CheckboxItem[]>();
		
		for (const checkbox of checkboxes) {
			if (!grouped.has(checkbox.streamName)) {
				grouped.set(checkbox.streamName, []);
			}
			grouped.get(checkbox.streamName)!.push(checkbox);
		}
		
		return grouped;
	}

	private groupCheckboxesByFile(checkboxes: CheckboxItem[] = this.checkboxes): Map<string, CheckboxItem[]> {
		const grouped = new Map<string, CheckboxItem[]>();
		
		for (const checkbox of checkboxes) {
			const fileName = checkbox.file.name;
			if (!grouped.has(fileName)) {
				grouped.set(fileName, []);
			}
			grouped.get(fileName)!.push(checkbox);
		}
		
		// Sort files in reverse alphabetical order (Z-A)
		const sortedEntries = Array.from(grouped.entries()).sort(([a], [b]) => b.localeCompare(a));
		return new Map(sortedEntries);
	}

	private loadMoreCheckboxes() {
		this.currentPage++;
		this.renderCheckboxes();
	}

	/**
	 * Parse a checkbox line to extract state and text
	 */
	private parseCheckboxLine(line: string): { isChecked: boolean; checkboxText: string; remainingText: string } {
		const trimmedLine = line.trim();
		
		// Look for checkbox pattern: - [ ] or - [x]
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]]*)\]\s*(.*)$/);
		
		if (checkboxMatch) {
			const checkboxContent = checkboxMatch[1].trim();
			const remainingText = checkboxMatch[2].trim();
			const isChecked = checkboxContent.toLowerCase() === 'x' || checkboxContent.toLowerCase() === 'checked';
			
			return {
				isChecked,
				checkboxText: `- [${checkboxContent}]`,
				remainingText
			};
		}
		
		// Fallback if no match
		return {
			isChecked: false,
			checkboxText: trimmedLine,
			remainingText: ''
		};
	}

	/**
	 * Toggle a checkbox in the actual file
	 */
	private async toggleCheckbox(checkbox: CheckboxItem, isChecked: boolean) {
		try {
			// Read the current file content
			const content = await this.app.vault.read(checkbox.file);
			const lines = content.split('\n');
			
			// Update the specific line
			const lineIndex = checkbox.lineNumber - 1; // Convert to 0-based index
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const currentLine = lines[lineIndex];
				const newLine = this.updateCheckboxInLine(currentLine, isChecked);
				lines[lineIndex] = newLine;
				
				// Write the updated content back to the file
				await this.app.vault.modify(checkbox.file, lines.join('\n'));
				
				// Update the checkbox item
				checkbox.lineContent = newLine.trim();
				
				// Show success notification
				new Notice(`Checkbox ${isChecked ? 'checked' : 'unchecked'} in ${checkbox.file.name}`);
			}
		} catch (error) {
			console.error('Error toggling checkbox:', error);
			new Notice('Error updating checkbox');
		}
	}

	/**
	 * Update checkbox state in a line
	 */
	private updateCheckboxInLine(line: string, isChecked: boolean): string {
		const trimmedLine = line.trim();
		const checkboxMatch = trimmedLine.match(/^(-\s*)\[([^\]]*)\](.*)$/);
		
		if (checkboxMatch) {
			const prefix = checkboxMatch[1];
			const suffix = checkboxMatch[3];
			const newCheckboxContent = isChecked ? 'x' : ' ';
			return `${prefix}[${newCheckboxContent}]${suffix}`;
		}
		
		// Fallback - return original line
		return line;
	}

	private showError(message: string) {
		const contentEl = this.contentEl.querySelector('.ontask-content') || this.contentEl.createEl('div', { cls: 'ontask-content' });
		contentEl.empty();
		contentEl.createEl('div', { 
			text: message,
			cls: 'ontask-error'
		});
	}

	/**
	 * Navigate to the file and scroll to the specific line
	 */
	private async goToFile(checkbox: CheckboxItem) {
		try {
			// Open the file in a new leaf
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(checkbox.file);
			
			// Wait a moment for the file to load, then scroll to the line
			setTimeout(() => {
				const view = leaf.view;
				if (view instanceof MarkdownView && view.editor) {
					// Scroll to the specific line (convert to 0-based index)
					const lineIndex = checkbox.lineNumber - 1;
					view.editor.setCursor({ line: lineIndex, ch: 0 });
					view.editor.scrollIntoView({ from: { line: lineIndex, ch: 0 }, to: { line: lineIndex, ch: 0 } }, true);
				}
			}, 100);
		} catch (error) {
			console.error('Error opening file:', error);
			new Notice('Error opening file');
		}
	}
}
