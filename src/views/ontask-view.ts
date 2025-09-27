import { ItemView, WorkspaceLeaf, Notice, MarkdownView } from 'obsidian';
import { CheckboxItem } from '../services/checkbox-finder/interfaces';
import { CheckboxFinderService } from '../services/checkbox-finder/checkbox-finder-service';
import { OnTaskSettings } from '../types';
import { Plugin } from 'obsidian';

export const ONTASK_VIEW_TYPE = 'ontask-view';

interface TaskStatus {
	symbol: string;
	name: string;
	description: string;
}

const TASK_STATUSES: TaskStatus[] = [
	{ symbol: ' ', name: 'To-do', description: 'Empty checkbox' },
	{ symbol: '/', name: 'Incomplete', description: 'Partially done' },
	{ symbol: 'x', name: 'Done', description: 'Completed task' },
	{ symbol: '-', name: 'Canceled', description: 'Cancelled task' },
	{ symbol: '>', name: 'Forward', description: 'Forwarded task' },
	{ symbol: '?', name: 'Question', description: 'Question or inquiry' },
	{ symbol: '!', name: 'Important', description: 'Important task' },
	{ symbol: '*', name: 'Star', description: 'Starred task' },
	{ symbol: '+', name: 'Add', description: 'Add to list' },
	{ symbol: 'i', name: 'Idea', description: 'Idea or concept' },
	{ symbol: 'r', name: 'Research', description: 'Research needed' },
	{ symbol: 'b', name: 'Brainstorm', description: 'Brainstorming' },
	{ symbol: '<', name: 'Scheduling', description: 'Scheduled task' },
	{ symbol: 'd', name: 'Date', description: 'Date-specific' },
	{ symbol: '"', name: 'Quote', description: 'Quote or reference' },
	{ symbol: 'l', name: 'Location', description: 'Location-based' },
	{ symbol: 'b', name: 'Bookmark', description: 'Bookmark' }
];

export class OnTaskView extends ItemView {
	private checkboxFinder: CheckboxFinderService;
	private settings: OnTaskSettings;
	private plugin: Plugin;
	private checkboxes: CheckboxItem[] = [];
	private itemsPerLoad: number = 20;
	private hideCompleted: boolean = false;
	private onlyShowToday: boolean = false;
	private currentlyDisplayed: number = 0;

	constructor(leaf: WorkspaceLeaf, checkboxFinder: CheckboxFinderService, settings: OnTaskSettings, plugin: Plugin) {
		super(leaf);
		this.checkboxFinder = checkboxFinder;
		this.settings = settings;
		this.plugin = plugin;
		this.hideCompleted = settings.hideCompletedTasks;
		this.onlyShowToday = settings.onlyShowToday;
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
		
		// Add only show today button
		const onlyTodayButton = buttonsContainer.createEl('button', { 
			text: this.onlyShowToday ? 'Show All Days' : 'Only Show Today',
			cls: 'ontask-only-today-btn'
		});
		onlyTodayButton.addEventListener('click', () => this.toggleOnlyShowToday());
		
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
		
		// Load checkboxes with retry mechanism
		await this.loadCheckboxesWithRetry();
		
		// Remove loading indicator
		loadingEl.remove();
	}

	async onClose() {
		// Cleanup if needed
	}

	private async loadCheckboxesWithRetry() {
		const maxRetries = 5;
		const retryDelay = 1000; // 1 second
		
		// Reset display count for fresh load
		this.currentlyDisplayed = 0;
		
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				// Check if streams are available before attempting to load checkboxes
				if (!this.checkboxFinder.streamsService.isStreamsPluginAvailable()) {
					console.log(`OnTask: Waiting for streams plugin to load (attempt ${attempt}/${maxRetries})`);
					if (attempt < maxRetries) {
						await new Promise(resolve => setTimeout(resolve, retryDelay));
						continue;
					}
				}
				
				this.checkboxes = await this.checkboxFinder.findAllCheckboxes(this.hideCompleted, this.onlyShowToday);
				
				// If we found checkboxes or this is the last attempt, render and break
				if (this.checkboxes.length > 0 || attempt === maxRetries) {
					this.renderCheckboxes();
					
					// Update status bar with new top task
					if (this.plugin && typeof (this.plugin as any).updateTopTaskStatusBar === 'function') {
						await (this.plugin as any).updateTopTaskStatusBar();
					}
					break;
				}
				
				// If no checkboxes found and not the last attempt, wait and retry
				if (attempt < maxRetries) {
					await new Promise(resolve => setTimeout(resolve, retryDelay));
				}
			} catch (error) {
				console.error(`Error loading checkboxes (attempt ${attempt}):`, error);
				if (attempt === maxRetries) {
					this.showError('Failed to load checkboxes after multiple attempts');
				} else {
					await new Promise(resolve => setTimeout(resolve, retryDelay));
				}
			}
		}
	}

	private async loadCheckboxes() {
		try {
			// Reset display count for fresh load
			this.currentlyDisplayed = 0;
			
			this.checkboxes = await this.checkboxFinder.findAllCheckboxes(this.hideCompleted, this.onlyShowToday);
			this.renderCheckboxes();
			
			// Update status bar with new top task
			if (this.plugin && typeof (this.plugin as any).updateTopTaskStatusBar === 'function') {
				await (this.plugin as any).updateTopTaskStatusBar();
			}
		} catch (error) {
			console.error('Error loading checkboxes:', error);
			this.showError('Failed to load checkboxes');
		}
	}

	public async refreshCheckboxes() {
		const loadingEl = this.contentEl.createEl('div', { 
			text: 'Refreshing...',
			cls: 'ontask-loading'
		});
		
		// Reset display count
		this.currentlyDisplayed = 0;
		
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

	private async toggleOnlyShowToday() {
		this.onlyShowToday = !this.onlyShowToday;
		this.settings.onlyShowToday = this.onlyShowToday;
		
		// Save the setting to data.json
		await this.plugin.saveData(this.settings);
		
		// Update button text
		const onlyTodayButton = this.contentEl.querySelector('.ontask-only-today-btn') as HTMLButtonElement;
		if (onlyTodayButton) {
			onlyTodayButton.textContent = this.onlyShowToday ? 'Show All Days' : 'Only Show Today';
		}
		
		// Reload checkboxes with new setting
		await this.refreshCheckboxes();
	}

	private renderCheckboxes(append: boolean = false) {
		// Clear existing content (except header) only if not appending
		const contentEl = this.contentEl.querySelector('.ontask-content') || this.contentEl.createEl('div', { cls: 'ontask-content' });
		if (!append) {
			contentEl.empty();
			this.currentlyDisplayed = 0;
		}
		
		if (this.checkboxes.length === 0) {
			// Check if Daily Notes is selected but plugin is not available
			const dailyNotesPlugin = (this.app as any).plugins?.getPlugin('daily-notes');
			const dailyNotesCore = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
			const hasDailyNotesCore = dailyNotesCore && dailyNotesCore.enabled;
			const isDailyNotesAvailable = dailyNotesPlugin !== null || hasDailyNotesCore;
			
			console.log('OnTask: Daily Notes plugin check:', { 
				plugin: dailyNotesPlugin, 
				hasCore: hasDailyNotesCore,
				available: isDailyNotesAvailable,
				settings: this.settings.checkboxSource,
				allPlugins: Object.keys((this.app as any).plugins?.plugins || {}),
				corePlugins: Object.keys((this.app as any).internalPlugins?.plugins || {})
			});
			
			if (this.settings.checkboxSource === 'daily-notes' && !isDailyNotesAvailable) {
				const warningEl = contentEl.createEl('div', { 
					cls: 'ontask-warning'
				});
				warningEl.createEl('div', { 
					text: '⚠️ Daily Notes plugin is not enabled',
					cls: 'ontask-warning-title'
				});
				warningEl.createEl('div', { 
					text: 'Please enable the Daily Notes plugin in Settings → Community plugins to use this feature.',
					cls: 'ontask-warning-description'
				});
				return;
			}
			
			contentEl.createEl('div', { 
				text: 'No checkboxes found.',
				cls: 'ontask-empty'
			});
			return;
		}

		// Separate top task from regular tasks
		const topTask = this.checkboxes.find(checkbox => checkbox.isTopTask);
		const regularTasks = this.checkboxes.filter(checkbox => !checkbox.isTopTask);

		// Render Top Task section if it exists (only on initial render)
		if (topTask && !append) {
			this.renderTopTaskSection(contentEl as HTMLElement, topTask);
		}

		// Calculate how many more tasks to show
		const startIndex = this.currentlyDisplayed;
		const endIndex = Math.min(startIndex + this.itemsPerLoad, regularTasks.length);
		const displayedCheckboxes = regularTasks.slice(startIndex, endIndex);
		const hasMore = endIndex < regularTasks.length;

		// Update currently displayed count
		this.currentlyDisplayed = endIndex;

		// Add or update task count info
		let taskCountInfo = contentEl.querySelector('.ontask-task-count-info') as HTMLElement;
		if (!taskCountInfo) {
			taskCountInfo = contentEl.createEl('div', { cls: 'ontask-task-count-info' });
		}
		taskCountInfo.empty();
		taskCountInfo.createEl('span', { 
			text: `Showing ${endIndex} of ${regularTasks.length} regular tasks${topTask ? ' (plus 1 top task)' : ''}`,
			cls: 'ontask-task-count-text'
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
			
			// Add source info to file header
			const sourceInfo = fileHeader.createEl('div', { cls: 'ontask-source-info' });
			const sourceNames = [...new Set(fileCheckboxes.map(cb => cb.sourceName))];
			sourceInfo.createEl('span', { 
				text: `Sources: ${sourceNames.join(', ')}`,
				cls: 'ontask-source-names'
			});
			
			// Checkboxes list
			const checkboxesList = fileSection.createEl('div', { cls: 'ontask-checkboxes-list' });
			
			for (const checkbox of fileCheckboxes) {
				this.renderCheckboxItem(checkboxesList, checkbox);
			}
		}

		// Remove any existing Load More button first
		const existingLoadMoreContainer = contentEl.querySelector('.ontask-load-more-container') as HTMLElement;
		if (existingLoadMoreContainer) {
			existingLoadMoreContainer.remove();
		}

		// Add Load More button at the bottom if there are more checkboxes
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

	private groupCheckboxesBySource(checkboxes: CheckboxItem[] = this.checkboxes): Map<string, CheckboxItem[]> {
		const grouped = new Map<string, CheckboxItem[]>();
		
		for (const checkbox of checkboxes) {
			if (!grouped.has(checkbox.sourceName)) {
				grouped.set(checkbox.sourceName, []);
			}
			grouped.get(checkbox.sourceName)!.push(checkbox);
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
		
		// Sort checkboxes within each file by line number to maintain file order
		for (const [fileName, fileCheckboxes] of sortedEntries) {
			fileCheckboxes.sort((a, b) => a.lineNumber - b.lineNumber);
		}
		
		return new Map(sortedEntries);
	}

	private loadMoreCheckboxes() {
		this.renderCheckboxes(true); // true = append mode
	}

	/**
	 * Parse a checkbox line to extract state and text
	 */
	private parseCheckboxLine(line: string): { isChecked: boolean; checkboxText: string; remainingText: string; statusSymbol: string } {
		const trimmedLine = line.trim();
		
		// Look for checkbox pattern: - [ ] or - [x] or any other status
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]]*)\]\s*(.*)$/);
		
		if (checkboxMatch) {
			const checkboxContent = checkboxMatch[1].trim();
			const remainingText = checkboxMatch[2].trim();
			// Only 'x' and 'checked' are considered checked for the visual checkbox
			const isChecked = checkboxContent.toLowerCase() === 'x' || checkboxContent.toLowerCase() === 'checked';
			
			return {
				isChecked,
				checkboxText: `- [${checkboxContent}]`,
				remainingText,
				statusSymbol: checkboxContent
			};
		}
		
		// Fallback if no match
		return {
			isChecked: false,
			checkboxText: trimmedLine,
			remainingText: '',
			statusSymbol: ' '
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
				
				// Show success notification
				new Notice(`Checkbox ${isChecked ? 'checked' : 'unchecked'} in ${checkbox.file.name}`);
				
				// Refresh the entire view to update top task and status bar
				await this.refreshCheckboxes();
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

	/**
	 * Show context menu for changing task status
	 */
	private showTaskStatusMenu(event: MouseEvent, checkbox: CheckboxItem) {
		// Remove any existing context menu
		const existingMenu = document.querySelector('.ontask-context-menu');
		if (existingMenu) {
			existingMenu.remove();
		}

		// Create context menu
		const menu = document.createElement('div');
		menu.className = 'ontask-context-menu';
		menu.style.position = 'fixed';
		menu.style.left = `${event.clientX}px`;
		menu.style.top = `${event.clientY}px`;
		menu.style.zIndex = '1000';
		menu.style.background = 'var(--background-primary)';
		menu.style.border = '1px solid var(--background-modifier-border)';
		menu.style.borderRadius = '6px';
		menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
		menu.style.padding = '4px 0';
		menu.style.minWidth = '200px';

		// Add menu items
		for (const status of TASK_STATUSES) {
			const menuItem = document.createElement('div');
			menuItem.className = 'ontask-context-menu-item';
			menuItem.style.padding = '8px 16px';
			menuItem.style.cursor = 'pointer';
			menuItem.style.display = 'flex';
			menuItem.style.alignItems = 'center';
			menuItem.style.gap = '8px';
			menuItem.style.fontSize = '14px';
			menuItem.style.color = 'var(--text-normal)';

			// Add symbol
			const symbol = document.createElement('span');
			symbol.textContent = `[${status.symbol}]`;
			symbol.style.fontFamily = 'var(--font-monospace)';
			symbol.style.fontWeight = 'bold';
			symbol.style.minWidth = '30px';

			// Add name and description
			const text = document.createElement('span');
			text.innerHTML = `<strong>${status.name}</strong><br><small style="color: var(--text-muted);">${status.description}</small>`;

			menuItem.appendChild(symbol);
			menuItem.appendChild(text);

			// Add hover effect
			menuItem.addEventListener('mouseenter', () => {
				menuItem.style.background = 'var(--background-modifier-hover)';
			});
			menuItem.addEventListener('mouseleave', () => {
				menuItem.style.background = 'transparent';
			});

			// Add click handler
			menuItem.addEventListener('click', async () => {
				await this.updateTaskStatus(checkbox, status.symbol);
				menu.remove();
			});

			menu.appendChild(menuItem);
		}

		// Add to document
		document.body.appendChild(menu);

		// Close menu when clicking outside
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu);
			}
		};

		// Use setTimeout to avoid immediate closure
		setTimeout(() => {
			document.addEventListener('click', closeMenu);
		}, 0);
	}

	/**
	 * Update task status in the file
	 */
	private async updateTaskStatus(checkbox: CheckboxItem, newSymbol: string) {
		try {
			// Read the current file content
			const content = await this.app.vault.read(checkbox.file);
			const lines = content.split('\n');
			
			// Update the specific line
			const lineIndex = checkbox.lineNumber - 1;
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const currentLine = lines[lineIndex];
				const newLine = this.updateCheckboxSymbolInLine(currentLine, newSymbol);
				lines[lineIndex] = newLine;
				
				// Write the updated content back to the file
				await this.app.vault.modify(checkbox.file, lines.join('\n'));
				
				// Show success notification
				const statusName = TASK_STATUSES.find(s => s.symbol === newSymbol)?.name || 'Unknown';
				new Notice(`Task status changed to: ${statusName}`);
				
				// Refresh the entire view to update top task and status bar
				await this.refreshCheckboxes();
			}
		} catch (error) {
			console.error('Error updating task status:', error);
			new Notice('Error updating task status');
		}
	}

	/**
	 * Update checkbox symbol in a line
	 */
	private updateCheckboxSymbolInLine(line: string, newSymbol: string): string {
		const trimmedLine = line.trim();
		const checkboxMatch = trimmedLine.match(/^(-\s*)\[([^\]]*)\](.*)$/);
		
		if (checkboxMatch) {
			const prefix = checkboxMatch[1];
			const suffix = checkboxMatch[3];
			return `${prefix}[${newSymbol}]${suffix}`;
		}
		
		// Fallback - return original line
		return line;
	}

	/**
	 * Update the visual display of a checkbox
	 */
	private updateCheckboxDisplay(checkbox: CheckboxItem, newSymbol: string) {
		// Find the specific checkbox display element
		const checkboxId = `${checkbox.file.path}-${checkbox.lineNumber}`;
		const element = this.contentEl.querySelector(`[data-checkbox-id="${checkboxId}"]`) as HTMLElement;
		
		if (element) {
			element.textContent = newSymbol.trim();
			element.setAttribute('data-status', newSymbol.trim());
		}
	}

	/**
	 * Render the top task section prominently at the top
	 */
	private renderTopTaskSection(contentEl: HTMLElement, topTask: CheckboxItem) {
		const topTaskSection = contentEl.createEl('div', { cls: 'ontask-top-task-section' });
		
		// Top task header
		const topTaskHeader = topTaskSection.createEl('div', { cls: 'ontask-top-task-header' });
		topTaskHeader.createEl('h2', { text: '🔥 Top Task' });
		topTaskHeader.createEl('span', { 
			text: `From: ${topTask.file.name}`,
			cls: 'ontask-top-task-source'
		});
		
		// Top task content
		const topTaskContent = topTaskSection.createEl('div', { cls: 'ontask-top-task-content' });
		this.renderCheckboxItem(topTaskContent, topTask, true);
	}

	/**
	 * Render a single checkbox item
	 */
	private renderCheckboxItem(container: HTMLElement, checkbox: CheckboxItem, isTopTask: boolean = false) {
		const checkboxEl = container.createEl('div', { 
			cls: isTopTask ? 'ontask-checkbox-item ontask-top-task-item' : 'ontask-checkbox-item'
		});
		
		// Create a container for the checkbox, text, and button
		const checkboxContainer = checkboxEl.createEl('div', { cls: 'ontask-checkbox-container' });
		
		// Extract checkbox state and text
		const { isChecked, checkboxText, remainingText } = this.parseCheckboxLine(checkbox.lineContent);
		
		// Create a custom checkbox display that shows the actual status
		const checkboxDisplay = checkboxContainer.createEl('div', {
			cls: 'ontask-checkbox-display'
		});
		
		// Extract the current status symbol
		const { statusSymbol } = this.parseCheckboxLine(checkbox.lineContent);
		const cleanSymbol = statusSymbol.trim();
		checkboxDisplay.textContent = cleanSymbol;
		checkboxDisplay.setAttribute('data-status', cleanSymbol);
		checkboxDisplay.setAttribute('data-checkbox-id', `${checkbox.file.path}-${checkbox.lineNumber}`);
		
		// Create label for the checkbox
		const checkboxLabel = checkboxContainer.createEl('label', { cls: 'ontask-checkbox-label' });
		checkboxLabel.appendChild(checkboxDisplay);
		
		// Add click handler to toggle between empty and x
		checkboxDisplay.addEventListener('click', async () => {
			const currentSymbol = statusSymbol.trim();
			const newSymbol = currentSymbol === 'x' ? ' ' : 'x';
			await this.updateTaskStatus(checkbox, newSymbol);
		});
		
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

		// Add right-click context menu for task status
		checkboxEl.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showTaskStatusMenu(e, checkbox);
		});
	}
}
