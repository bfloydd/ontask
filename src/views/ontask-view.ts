import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { CheckboxFinderService } from '../services/checkbox-finder/checkbox-finder-service';
import { EventSystem } from '../slices/events';

export const ONTASK_VIEW_TYPE = 'ontask-view';

export class OnTaskView extends ItemView {
	private checkboxFinderService: CheckboxFinderService;
	private settings: any;
	private plugin: any;
	private eventSystem: EventSystem;
	private checkboxes: any[] = [];
	private refreshTimeout: number | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		checkboxFinderService: CheckboxFinderService,
		settings: any,
		plugin: any,
		eventSystem: EventSystem
	) {
		super(leaf);
		this.checkboxFinderService = checkboxFinderService;
		this.settings = settings;
		this.plugin = plugin;
		this.eventSystem = eventSystem;
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

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('ontask-view');
		
		// Create header
		const header = this.contentEl.createDiv('ontask-header');
		header.createEl('h2', { text: 'On Task' });
		
		// Create buttons container
		const buttonsContainer = header.createDiv('ontask-buttons-container');
		
		// Create refresh button
		const refreshButton = buttonsContainer.createEl('button', { text: 'Refresh' });
		refreshButton.addClass('ontask-refresh-button');
		refreshButton.addEventListener('click', () => this.refreshCheckboxes());
		
		// Create filter buttons
		const hideCompletedButton = buttonsContainer.createEl('button', { text: 'Hide Completed' });
		hideCompletedButton.addClass('ontask-filter-button');
		hideCompletedButton.addEventListener('click', () => this.toggleHideCompleted());
		
		const onlyTodayButton = buttonsContainer.createEl('button', { text: 'Only Today' });
		onlyTodayButton.addClass('ontask-filter-button');
		onlyTodayButton.addEventListener('click', () => this.toggleOnlyToday());
		
		// Create content area
		const contentArea = this.contentEl.createDiv('ontask-content');
		
		// Add context menu event listener to the view
		this.contentEl.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showContextMenu(e);
		});
		
		// Load initial checkboxes
		await this.refreshCheckboxes();
		
		// Set up event listeners
		this.setupEventListeners();
	}

	async onClose(): Promise<void> {
		// Clean up event listeners
		this.cleanupEventListeners();
		
		// Clear refresh timeout
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	async refreshCheckboxes(): Promise<void> {
		try {
			// Find the content area
			const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
			if (!contentArea) {
				console.error('Content area not found');
				return;
			}
			
			// Clear existing content
			contentArea.empty();
			
			// Show loading state
			const loadingEl = contentArea.createDiv('ontask-loading');
			loadingEl.textContent = 'Loading checkboxes...';
			
			// Find checkboxes
			this.checkboxes = await this.checkboxFinderService.findAllCheckboxes(
				this.settings.hideCompletedTasks,
				this.settings.onlyShowToday
			);
			
			// Clear loading state
			loadingEl.remove();
			
			// Render checkboxes
			this.renderCheckboxes(contentArea);
			
			// Emit refresh event
			this.eventSystem.emit('view:refreshed', { 
				viewType: ONTASK_VIEW_TYPE,
				checkboxCount: this.checkboxes.length 
			});
			
		} catch (error) {
			console.error('Error refreshing checkboxes:', error);
			const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
			if (contentArea) {
				contentArea.empty();
				const errorEl = contentArea.createDiv('ontask-error');
				errorEl.textContent = 'Error loading checkboxes. Please try again.';
			}
		}
	}

	private renderCheckboxes(contentArea: HTMLElement): void {
		if (this.checkboxes.length === 0) {
			const emptyEl = contentArea.createDiv('ontask-empty');
			emptyEl.textContent = 'No checkboxes found.';
			return;
		}

		// Find the top task
		const topTask = this.checkboxes.find(checkbox => checkbox.isTopTask);
		const regularTasks = this.checkboxes.filter(checkbox => !checkbox.isTopTask);

		// Render top task prominently at the top if it exists
		if (topTask) {
			const topTaskSection = contentArea.createDiv('ontask-top-task-section');
			topTaskSection.addClass('ontask-file-section');
			
			// Top task header
			const topTaskHeader = topTaskSection.createDiv('ontask-file-header');
			topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
			
			// Top task display
			const topTaskDisplay = topTaskSection.createDiv('ontask-top-task-display');
			topTaskDisplay.addClass('ontask-top-task-item');
			
			// Create top task content
			const topTaskContent = topTaskDisplay.createDiv('ontask-top-task-content');
			
			// Top task checkbox
			const topTaskCheckbox = document.createElement('input');
			topTaskCheckbox.type = 'checkbox';
			topTaskCheckbox.checked = topTask.isCompleted;
			topTaskCheckbox.addClass('ontask-checkbox-input');
			topTaskCheckbox.addEventListener('change', async () => {
				await this.toggleCheckbox(topTask, topTaskCheckbox.checked);
			});
			
			// Top task text
			const topTaskText = topTaskDisplay.createDiv('ontask-top-task-text');
			topTaskText.textContent = topTask.lineContent;
			topTaskText.style.cursor = 'pointer';
			topTaskText.addEventListener('click', () => {
				this.openFile(topTask.file?.path || '', topTask.lineNumber);
			});
			
			// Top task source
			const topTaskSource = topTaskDisplay.createDiv('ontask-top-task-source');
			topTaskSource.textContent = `From: ${this.getFileName(topTask.file?.path || '')}`;
			topTaskSource.style.fontSize = '12px';
			topTaskSource.style.color = 'var(--text-muted)';
			topTaskSource.style.marginTop = '4px';
			
			topTaskContent.appendChild(topTaskCheckbox);
			topTaskContent.appendChild(topTaskText);
			topTaskContent.appendChild(topTaskSource);
		}

		// Group regular checkboxes by file
		const checkboxesByFile = this.groupCheckboxesByFile(regularTasks);
		
		// Render each file's checkboxes
		for (const [filePath, fileCheckboxes] of checkboxesByFile) {
			const fileSection = contentArea.createDiv('ontask-file-section');
			
			// File header
			const fileHeader = fileSection.createDiv('ontask-file-header');
			fileHeader.createEl('h3', { text: this.getFileName(filePath) });
			fileHeader.createEl('span', { 
				text: `${fileCheckboxes.length} task${fileCheckboxes.length === 1 ? '' : 's'}`,
				cls: 'ontask-file-count'
			});
			
			// Checkboxes list
			const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
			
			for (const checkbox of fileCheckboxes) {
				const checkboxEl = this.createCheckboxElement(checkbox);
				checkboxesList.appendChild(checkboxEl);
			}
		}
	}

	private groupCheckboxesByFile(checkboxes: any[]): Map<string, any[]> {
		const grouped = new Map<string, any[]>();
		
		for (const checkbox of checkboxes) {
			const filePath = checkbox.file?.path || 'Unknown';
			if (!grouped.has(filePath)) {
				grouped.set(filePath, []);
			}
			grouped.get(filePath)!.push(checkbox);
		}
		
		return grouped;
	}

	private createCheckboxElement(checkbox: any): HTMLElement {
		const checkboxEl = document.createElement('div');
		checkboxEl.addClass('ontask-checkbox-item');
		
		// Add top task indicator
		if (checkbox.isTopTask) {
			checkboxEl.addClass('ontask-top-task');
		}
		
		// Create checkbox
		const checkboxInput = document.createElement('input');
		checkboxInput.type = 'checkbox';
		checkboxInput.checked = checkbox.isCompleted;
		checkboxInput.addClass('ontask-checkbox-input');
		
		// Create text content
		const textEl = document.createElement('span');
		textEl.textContent = checkbox.lineContent;
		textEl.addClass('ontask-checkbox-text');
		
		// Add click handler for checkbox
		checkboxInput.addEventListener('change', async () => {
			await this.toggleCheckbox(checkbox, checkboxInput.checked);
		});
		
		// Add click handler for text (to open file)
		textEl.addEventListener('click', () => {
			this.openFile(checkbox.file?.path || '', checkbox.lineNumber);
		});
		textEl.style.cursor = 'pointer';
		
		checkboxEl.appendChild(checkboxInput);
		checkboxEl.appendChild(textEl);
		
		return checkboxEl;
	}

	private async toggleCheckbox(checkbox: any, isCompleted: boolean): Promise<void> {
		try {
			// Get the file
			const file = checkbox.file;
			if (!file) {
				console.error('File not found in checkbox:', checkbox);
				return;
			}
			
			// Read file content
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			// Update the specific line
			const lineIndex = checkbox.lineNumber - 1;
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const line = lines[lineIndex];
				const updatedLine = line.replace(
					/^(-\s*\[)([^\]]*)(\])/,
					`$1${isCompleted ? 'x' : ' '}$3`
				);
				lines[lineIndex] = updatedLine;
				
				// Write back to file
				await this.app.vault.modify(file, lines.join('\n'));
				
				// Update local state
				checkbox.isCompleted = isCompleted;
				
				// Emit checkbox toggled event
				this.eventSystem.emit('checkbox:toggled', {
					filePath: file.path,
					lineNumber: checkbox.lineNumber,
					isCompleted
				});
				
				// Refresh the view after a short delay
				this.scheduleRefresh();
			}
		} catch (error) {
			console.error('Error toggling checkbox:', error);
		}
	}

	private openFile(filePath: string, lineNumber: number): void {
		const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
		if (file) {
			// Open the file
			this.app.workspace.openLinkText(filePath, '');
			
			// Try to scroll to the specific line (if editor is open)
			setTimeout(() => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && markdownView.editor) {
					try {
						const line = lineNumber - 1;
						markdownView.editor.setCursor({ line, ch: 0 });
						markdownView.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } });
					} catch (error) {
						console.error('OnTask: Error scrolling to line:', error);
					}
				}
			}, 100);
		}
	}

	private getFileName(filePath: string): string {
		const parts = filePath.split('/');
		return parts[parts.length - 1] || filePath;
	}

	private scheduleRefresh(): void {
		// Clear existing timeout
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		
		// Schedule refresh after 500ms
		this.refreshTimeout = window.setTimeout(() => {
			this.refreshCheckboxes();
		}, 500);
	}

	private setupEventListeners(): void {
		// Listen for settings changes
		const settingsSubscription = this.eventSystem.on('settings:changed', (event) => {
			if (event.data.key === 'hideCompletedTasks' || event.data.key === 'onlyShowToday') {
				this.refreshCheckboxes();
			}
		});
		
		// Listen for file modifications
		const fileModifyListener = (file: any) => {
			// Check if any of our checkboxes are in this file
			const isRelevantFile = this.checkboxes.some(checkbox => checkbox.file?.path === file.path);
			if (isRelevantFile) {
				this.scheduleRefresh();
			}
		};
		
		this.app.vault.on('modify', fileModifyListener);
		
		// Store cleanup functions
		this.eventListeners = [
			() => settingsSubscription.unsubscribe(),
			() => this.app.vault.off('modify', fileModifyListener)
		];
	}

	private cleanupEventListeners(): void {
		if (this.eventListeners) {
			this.eventListeners.forEach(cleanup => cleanup());
			this.eventListeners = [];
		}
	}

	private eventListeners: (() => void)[] = [];

	private showContextMenu(event: MouseEvent): void {
		console.log('OnTask View: Context menu triggered', event);
		
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
		menu.style.padding = '4px';
		menu.style.minWidth = '200px';

		// Define task statuses
		const statuses = [
			{ symbol: ' ', name: 'Incomplete', description: 'Not started' },
			{ symbol: 'x', name: 'Complete', description: 'Finished' },
			{ symbol: '!', name: 'Important', description: 'High priority' },
			{ symbol: '?', name: 'Question', description: 'Needs clarification' },
			{ symbol: '*', name: 'Star', description: 'Marked' },
			{ symbol: 'r', name: 'Review', description: 'Needs review' },
			{ symbol: 'b', name: 'Blocked', description: 'Cannot proceed' },
			{ symbol: '<', name: 'Scheduled', description: 'Planned for later' },
			{ symbol: '>', name: 'In Progress', description: 'Currently working' },
			{ symbol: '-', name: 'Cancelled', description: 'No longer needed' }
		];

		// Add menu items for each status
		for (const status of statuses) {
			const menuItem = document.createElement('div');
			menuItem.className = 'ontask-context-menu-item';
			menuItem.style.padding = '8px 12px';
			menuItem.style.cursor = 'pointer';
			menuItem.style.fontSize = '14px';
			menuItem.style.color = 'var(--text-normal)';
			menuItem.style.borderRadius = '4px';
			menuItem.style.display = 'flex';
			menuItem.style.alignItems = 'center';
			menuItem.style.gap = '8px';

			// Create status display
			const statusDisplay = document.createElement('div');
			statusDisplay.className = 'ontask-checkbox-display';
			statusDisplay.setAttribute('data-status', status.symbol);
			statusDisplay.textContent = `[${status.symbol}]`;
			statusDisplay.style.fontSize = '12px';
			statusDisplay.style.minWidth = '24px';
			statusDisplay.style.height = '20px';
			statusDisplay.style.display = 'flex';
			statusDisplay.style.alignItems = 'center';
			statusDisplay.style.justifyContent = 'center';

			// Create text content
			const textContent = document.createElement('div');
			textContent.style.display = 'flex';
			textContent.style.flexDirection = 'column';
			textContent.style.gap = '2px';
			
			const nameEl = document.createElement('div');
			nameEl.textContent = status.name;
			nameEl.style.fontWeight = '500';
			
			const descEl = document.createElement('div');
			descEl.textContent = status.description;
			descEl.style.fontSize = '12px';
			descEl.style.color = 'var(--text-muted)';
			
			textContent.appendChild(nameEl);
			textContent.appendChild(descEl);

			menuItem.appendChild(statusDisplay);
			menuItem.appendChild(textContent);

			// Add hover effect
			menuItem.addEventListener('mouseenter', () => {
				menuItem.style.background = 'var(--background-modifier-hover)';
			});
			menuItem.addEventListener('mouseleave', () => {
				menuItem.style.background = 'transparent';
			});

			// Add click handler
			menuItem.addEventListener('click', () => {
				this.showStatusSelectionForCheckboxes(status.symbol);
				menu.remove();
			});

			menu.appendChild(menuItem);
		}

		// Add to document
		document.body.appendChild(menu);
		console.log('OnTask View: Context menu added to DOM', menu);

		// Close menu when clicking outside
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu);
			}
		};

		// Use requestAnimationFrame to avoid immediate closure
		requestAnimationFrame(() => {
			document.addEventListener('click', closeMenu);
		});
	}


	private showStatusSelectionForCheckboxes(selectedStatus: string): void {
		console.log('OnTask View: Status selection for checkboxes', selectedStatus);
		
		// Find all visible checkboxes and update their status
		const checkboxElements = this.contentEl.querySelectorAll('.ontask-checkbox-item');
		const promises: Promise<void>[] = [];
		
		for (const checkboxEl of Array.from(checkboxElements)) {
			// Find the corresponding checkbox data
			const checkboxData = this.checkboxes.find(cb => {
				const textEl = checkboxEl.querySelector('.ontask-checkbox-text');
				return textEl && textEl.textContent === cb.lineContent;
			});
			
			if (checkboxData) {
				promises.push(this.updateCheckboxStatus(checkboxData, selectedStatus));
			}
		}
		
		// Wait for all updates to complete, then refresh
		Promise.all(promises).then(() => {
			this.refreshCheckboxes();
		});
	}

	private async updateCheckboxStatus(checkbox: any, newStatus: string): Promise<void> {
		try {
			// Get the file
			const file = checkbox.file;
			if (!file) {
				console.error('File not found in checkbox:', checkbox);
				return;
			}
			
			// Read file content
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			// Update the specific line
			const lineIndex = checkbox.lineNumber - 1;
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const line = lines[lineIndex];
				const updatedLine = line.replace(
					/^(-\s*\[)([^\]]*)(\])/,
					`$1${newStatus}$3`
				);
				lines[lineIndex] = updatedLine;
				
				// Write back to file
				await this.app.vault.modify(file, lines.join('\n'));
				
				// Update local state
				checkbox.isCompleted = newStatus === 'x';
				
				// Emit checkbox toggled event
				this.eventSystem.emit('checkbox:toggled', {
					filePath: file.path,
					lineNumber: checkbox.lineNumber,
					isCompleted: newStatus === 'x',
					status: newStatus
				});
			}
		} catch (error) {
			console.error('Error updating checkbox status:', error);
		}
	}

	private openSettings(): void {
		// Open the plugin settings
		(this.app as any).setting.open();
		(this.app as any).setting.openTabById(this.plugin.manifest.id);
	}

	private toggleHideCompleted(): void {
		const settings = this.settings;
		const newValue = !settings.hideCompletedTasks;
		// Update settings through event system
		this.eventSystem.emit('settings:changed', { 
			key: 'hideCompletedTasks', 
			value: newValue 
		});
		this.refreshCheckboxes();
	}

	private toggleOnlyToday(): void {
		const settings = this.settings;
		const newValue = !settings.onlyShowToday;
		// Update settings through event system
		this.eventSystem.emit('settings:changed', { 
			key: 'onlyShowToday', 
			value: newValue 
		});
		this.refreshCheckboxes();
	}

	private toggleTopTaskVisibility(): void {
		// Emit event to toggle top task visibility
		this.eventSystem.emit('ui:toggle-top-task-visibility', {});
	}
}
