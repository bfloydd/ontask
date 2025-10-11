import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { CheckboxFinderService } from '../checkbox-finder';
import { EventSystem } from '../events';
import { SettingsService } from '../settings';
import { StatusConfigService } from '../settings/status-config';

export const ONTASK_VIEW_TYPE = 'ontask-view';

export class OnTaskView extends ItemView {
	private checkboxFinderService: CheckboxFinderService;
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private plugin: any;
	private eventSystem: EventSystem;
	private checkboxes: any[] = [];
	private refreshTimeout: number | null = null;
	private hideCompletedButton: HTMLButtonElement;
	private onlyTodayButton: HTMLButtonElement;
	private isRefreshing: boolean = false;
	private isUpdatingStatus: boolean = false;
	private displayedTasksCount: number = 10;
	private loadMoreButton: HTMLButtonElement | null = null;
	private lastCheckboxContent: Map<string, string> = new Map(); // Track checkbox content to detect actual changes

	constructor(
		leaf: WorkspaceLeaf,
		checkboxFinderService: CheckboxFinderService,
		settingsService: SettingsService,
		plugin: any,
		eventSystem: EventSystem
	) {
		super(leaf);
		this.checkboxFinderService = checkboxFinderService;
		this.settingsService = settingsService;
		this.statusConfigService = new StatusConfigService(settingsService);
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
		this.hideCompletedButton = buttonsContainer.createEl('button', { text: 'Hide Completed' });
		this.hideCompletedButton.addClass('ontask-filter-button');
		this.hideCompletedButton.addEventListener('click', () => this.toggleHideCompleted());
		
		this.onlyTodayButton = buttonsContainer.createEl('button', { text: 'Show All' });
		this.onlyTodayButton.addClass('ontask-filter-button');
		this.onlyTodayButton.addEventListener('click', () => this.toggleOnlyToday());
		
		// Create configure button
		const configureButton = buttonsContainer.createEl('button', { text: 'Configure' });
		configureButton.addClass('ontask-configure-button');
		configureButton.addEventListener('click', () => this.openSettings());
		
		// Set initial button states
		this.updateButtonStates();
		
		// Create content area
		const contentArea = this.contentEl.createDiv('ontask-content');
		
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
		// Prevent multiple simultaneous refreshes
		if (this.isRefreshing) {
			console.log('OnTask View: Refresh already in progress, skipping');
			return;
		}
		
		this.isRefreshing = true;
		
		try {
			console.log('OnTask View: Starting refreshCheckboxes');
			
			// Find the content area
			const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
			if (!contentArea) {
				console.error('Content area not found');
				return;
			}
			
			// Clear existing content
			console.log('OnTask View: Clearing content area');
			contentArea.empty();
			
			// Reset pagination state
			this.displayedTasksCount = 10;
			this.loadMoreButton = null;
			
			// Verify content is cleared
			console.log('OnTask View: Content area children after clearing:', contentArea.children.length);
			
			// Show loading state with progress indication
			const loadingEl = contentArea.createDiv('ontask-loading');
			loadingEl.textContent = 'Loading checkboxes...';
			
			// Get current settings
			const settings = this.settingsService.getSettings();
			
			// Remove unnecessary requestAnimationFrame delay
			
			// Find checkboxes with performance timing
			const startTime = performance.now();
			this.checkboxes = await this.checkboxFinderService.findAllCheckboxes(
				settings.hideCompletedTasks,
				settings.onlyShowToday
			);
			const endTime = performance.now();
			console.log(`OnTask View: Checkbox loading took ${(endTime - startTime).toFixed(2)}ms`);
			
			// Clear loading state
			loadingEl.remove();
			
			// Debug logging
			console.log(`OnTask View: Rendering ${this.checkboxes.length} checkboxes`);
			console.log('OnTask View: Checkboxes data:', this.checkboxes.map(cb => ({
				file: cb.file?.path,
				lineNumber: cb.lineNumber,
				content: cb.lineContent?.trim(),
				sourceName: cb.sourceName
			})));
			
			// Render checkboxes using the original method for now
			this.renderCheckboxes(contentArea);
			
			// Update button states
			this.updateButtonStates();
			
			// Initialize checkbox content tracking for change detection
			this.initializeCheckboxContentTracking();
			
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
		} finally {
			this.isRefreshing = false;
			console.log('OnTask View: Finished refreshCheckboxes');
		}
	}

	private updateTopTaskSection(): void {
		console.log('OnTask View: Updating top task section immediately');
		
		// Find the content area
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			console.error('Content area not found for top task update');
			return;
		}
		
		// Find the existing top task section
		const existingTopTaskSection = contentArea.querySelector('.ontask-top-task-section');
		
		// Find the current top task
		const topTask = this.checkboxes.find(checkbox => checkbox.isTopTask);
		
		if (topTask) {
			if (existingTopTaskSection) {
				// Update existing top task section
				const topTaskStatusDisplay = existingTopTaskSection.querySelector('.ontask-checkbox-display');
				if (topTaskStatusDisplay) {
					const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
					topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
					topTaskStatusDisplay.textContent = `[${statusSymbol}]`;
				}
				
				// Update the top task text
				const topTaskText = existingTopTaskSection.querySelector('.ontask-top-task-text');
				if (topTaskText) {
					const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
					topTaskText.textContent = remainingText || 'Top Task';
				}
				
				console.log('OnTask View: Top task section updated with new status');
			} else {
				// Create new top task section immediately
				console.log('OnTask View: Creating new top task section immediately');
				this.createTopTaskSection(contentArea, topTask);
			}
		} else {
			// If no top task, remove the section if it exists
			if (existingTopTaskSection) {
				existingTopTaskSection.remove();
				console.log('OnTask View: Top task section removed - no top task found');
			}
		}
	}

	private createTopTaskSection(contentArea: HTMLElement, topTask: any): void {
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
		
		// Top task status display
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { statusSymbol, remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = `[${statusSymbol}]`;
		topTaskStatusDisplay.style.cursor = 'pointer';
		topTaskStatusDisplay.addEventListener('click', () => {
			this.openFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task text
		const topTaskText = topTaskDisplay.createDiv('ontask-top-task-text');
		topTaskText.textContent = remainingText || 'Top Task';
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
		
		topTaskContent.appendChild(topTaskStatusDisplay);
		topTaskContent.appendChild(topTaskText);
		topTaskContent.appendChild(topTaskSource);
		
		// Add context menu event listener to the top task
		topTaskDisplay.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showContextMenu(e, topTask);
		});
		
		// Insert at the beginning of content area
		contentArea.insertBefore(topTaskSection, contentArea.firstChild);
		
		console.log('OnTask View: Top task section created and inserted');
	}

	private async renderCheckboxesOptimized(contentArea: HTMLElement): Promise<void> {
		console.log('OnTask View: Starting optimized renderCheckboxes');
		console.log('OnTask View: Content area children before rendering:', contentArea.children.length);
		
		if (this.checkboxes.length === 0) {
			const emptyEl = contentArea.createDiv('ontask-empty');
			emptyEl.textContent = 'No checkboxes found.';
			return;
		}

		// Use DocumentFragment for better performance
		const fragment = document.createDocumentFragment();
		
		// Find the top task (the winner)
		const topTask = this.checkboxes.find(checkbox => checkbox.isTopTask);

		// Render top task prominently at the top if it exists
		if (topTask) {
			const topTaskSection = this.createTopTaskSectionElement(topTask);
			fragment.appendChild(topTaskSection);
		}

		// Group all checkboxes by file (including the top task)
		const checkboxesByFile = this.groupCheckboxesByFile(this.checkboxes);
		
		// Sort files by modification date (latest first)
		const sortedFiles = this.sortFilesByDate(checkboxesByFile);
		
		// Calculate how many tasks to show based on pagination
		let tasksShown = 0;
		const maxTasksToShow = this.displayedTasksCount;
		
		// Render each file's checkboxes with pagination using batch processing
		const fileSections: HTMLElement[] = [];
		
		for (const [filePath, fileCheckboxes] of sortedFiles) {
			if (tasksShown >= maxTasksToShow) {
				break; // Stop rendering if we've reached the limit
			}
			
			const fileSection = this.createFileSectionElement(filePath, fileCheckboxes, maxTasksToShow, tasksShown);
			fileSections.push(fileSection);
			
			// Update tasks shown count
			const remainingSlots = maxTasksToShow - tasksShown;
			const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
			tasksShown += tasksToShowFromFile;
		}
		
		// Append all file sections to fragment
		fileSections.forEach(section => fragment.appendChild(section));
		
		// Add Load More button if there are more tasks to show
		const totalTasks = this.checkboxes.length;
		if (tasksShown < totalTasks) {
			const loadMoreSection = this.createLoadMoreButtonElement();
			fragment.appendChild(loadMoreSection);
		}
		
		// Append fragment to content area in one operation
		contentArea.appendChild(fragment);
		
		console.log('OnTask View: Finished optimized renderCheckboxes');
		console.log('OnTask View: Content area children after rendering:', contentArea.children.length);
		console.log(`OnTask View: Showing ${tasksShown} of ${totalTasks} total tasks`);
	}

	private renderCheckboxes(contentArea: HTMLElement): void {
		console.log('OnTask View: Starting renderCheckboxes');
		console.log('OnTask View: Content area children before rendering:', contentArea.children.length);
		
		if (this.checkboxes.length === 0) {
			const emptyEl = contentArea.createDiv('ontask-empty');
			emptyEl.textContent = 'No checkboxes found.';
			return;
		}

		// Find the top task (the winner)
		const topTask = this.checkboxes.find(checkbox => checkbox.isTopTask);

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
			
			// Top task status display with colors
			const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
			const { statusSymbol, remainingText } = this.parseCheckboxLine(topTask.lineContent);
			topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
			topTaskStatusDisplay.textContent = `[${statusSymbol}]`;
			topTaskStatusDisplay.style.cursor = 'pointer';
			
			// Apply colors from status configuration
			const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
			const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
			topTaskStatusDisplay.style.color = statusColor;
			topTaskStatusDisplay.style.backgroundColor = statusBackgroundColor;
			topTaskStatusDisplay.style.border = `1px solid ${statusColor}`;
			
			topTaskStatusDisplay.addEventListener('click', () => {
				this.openFile(topTask.file?.path || '', topTask.lineNumber);
			});
			
			// Top task text
			const topTaskText = topTaskDisplay.createDiv('ontask-top-task-text');
			topTaskText.textContent = remainingText || 'Top Task';
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
			
			topTaskContent.appendChild(topTaskStatusDisplay);
			topTaskContent.appendChild(topTaskText);
			topTaskContent.appendChild(topTaskSource);
			
			// Add context menu event listener to the top task
			topTaskDisplay.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.showContextMenu(e, topTask);
			});

			// Add touch support for mobile devices with long-press detection
			this.addMobileTouchHandlers(topTaskDisplay, topTask);
		}

		// Group all checkboxes by file (including the top task)
		const checkboxesByFile = this.groupCheckboxesByFile(this.checkboxes);
		
		// Sort files by modification date (latest first)
		const sortedFiles = this.sortFilesByDate(checkboxesByFile);
		
		// Calculate how many tasks to show based on pagination
		let tasksShown = 0;
		const maxTasksToShow = this.displayedTasksCount;
		
		// Render each file's checkboxes with pagination
		for (const [filePath, fileCheckboxes] of sortedFiles) {
			if (tasksShown >= maxTasksToShow) {
				break; // Stop rendering if we've reached the limit
			}
			
			const fileSection = contentArea.createDiv('ontask-file-section');
			fileSection.setAttribute('data-file-path', filePath);
			
			// File header
			const fileHeader = fileSection.createDiv('ontask-file-header');
			fileHeader.createEl('h3', { text: this.getFileName(filePath) });
			
			// Calculate how many tasks from this file we can show
			const remainingSlots = maxTasksToShow - tasksShown;
			const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
			
			fileHeader.createEl('span', { 
				text: `${tasksToShowFromFile} of ${fileCheckboxes.length} task${fileCheckboxes.length === 1 ? '' : 's'}`,
				cls: 'ontask-file-count'
			});
			
			// Checkboxes list
			const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
			
			for (let i = 0; i < tasksToShowFromFile; i++) {
				const checkbox = fileCheckboxes[i];
				const checkboxEl = this.createCheckboxElement(checkbox);
				checkboxesList.appendChild(checkboxEl);
				tasksShown++;
			}
		}
		
		// Add Load More button if there are more tasks to show
		const totalTasks = this.checkboxes.length;
		if (tasksShown < totalTasks) {
			this.addLoadMoreButton(contentArea);
		}
		
		console.log('OnTask View: Finished renderCheckboxes');
		console.log('OnTask View: Content area children after rendering:', contentArea.children.length);
		console.log(`OnTask View: Showing ${tasksShown} of ${totalTasks} total tasks`);
	}

	private addLoadMoreButton(contentArea: HTMLElement): void {
		// Remove existing load more button if it exists
		if (this.loadMoreButton) {
			this.loadMoreButton.remove();
		}

		const loadMoreSection = contentArea.createDiv('ontask-load-more-section');
		loadMoreSection.addClass('ontask-file-section');
		
		// Calculate remaining tasks
		const remainingTasks = this.checkboxes.length - this.displayedTasksCount;
		
		this.loadMoreButton = loadMoreSection.createEl('button', {
			text: `Load More Tasks (${remainingTasks} remaining)`,
			cls: 'ontask-load-more-button'
		});
		
		this.loadMoreButton.addEventListener('click', () => {
			this.loadMoreTasks();
		});
	}

	private loadMoreTasks(): void {
		console.log('OnTask View: Loading more tasks');
		
		// Find the content area
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			console.error('Content area not found');
			return;
		}
		
		// Remove the existing Load More button
		if (this.loadMoreButton) {
			this.loadMoreButton.remove();
			this.loadMoreButton = null;
		}
		
		// Get current settings to filter tasks
		const settings = this.settingsService.getSettings();
		
		// Calculate how many tasks we've already shown
		const currentShown = this.displayedTasksCount;
		const newLimit = this.displayedTasksCount + 10;
		
		// Group tasks by file and get the additional tasks to show
		const checkboxesByFile = this.groupCheckboxesByFile(this.checkboxes);
		let tasksShown = 0;
		let additionalTasksToRender: any[] = [];
		
		// Find additional tasks to render
		for (const [filePath, fileCheckboxes] of checkboxesByFile) {
			if (tasksShown >= newLimit) break;
			
			const remainingSlots = newLimit - tasksShown;
			const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
			
			// Only add tasks that haven't been shown yet
			const startIndex = Math.max(0, currentShown - tasksShown);
			const endIndex = Math.min(fileCheckboxes.length, startIndex + tasksToShowFromFile);
			
			for (let i = startIndex; i < endIndex; i++) {
				additionalTasksToRender.push({
					checkbox: fileCheckboxes[i],
					filePath: filePath
				});
			}
			
			tasksShown += tasksToShowFromFile;
		}
		
		// Render the additional tasks
		this.renderAdditionalTasks(contentArea, additionalTasksToRender);
		
		// Update the displayed count
		this.displayedTasksCount = newLimit;
		
		// Add Load More button if there are still more tasks
		const totalTasks = this.checkboxes.length;
		if (this.displayedTasksCount < totalTasks) {
			this.addLoadMoreButton(contentArea);
		}
		
		console.log(`OnTask View: Loaded ${additionalTasksToRender.length} additional tasks. Total shown: ${this.displayedTasksCount} of ${totalTasks}`);
	}

	private renderAdditionalTasks(contentArea: HTMLElement, additionalTasks: any[]): void {
		console.log('OnTask View: Rendering additional tasks');
		
		// Group additional tasks by file
		const tasksByFile = new Map<string, any[]>();
		for (const task of additionalTasks) {
			if (!tasksByFile.has(task.filePath)) {
				tasksByFile.set(task.filePath, []);
			}
			tasksByFile.get(task.filePath)!.push(task.checkbox);
		}
		
		// Render tasks for each file
		for (const [filePath, fileTasks] of tasksByFile) {
			// Check if this file section already exists
			let existingFileSection = contentArea.querySelector(`[data-file-path="${filePath}"]`) as HTMLElement;
			
			if (existingFileSection) {
				// Update existing file section
				this.appendTasksToExistingFile(existingFileSection, fileTasks, filePath);
			} else {
				// Create new file section
				this.createNewFileSection(contentArea, fileTasks, filePath);
			}
		}
	}

	private appendTasksToExistingFile(fileSection: HTMLElement, fileTasks: any[], filePath: string): void {
		// Find the checkboxes list in the existing file section
		const checkboxesList = fileSection.querySelector('.ontask-checkboxes-list') as HTMLElement;
		if (!checkboxesList) {
			console.error('Checkboxes list not found in existing file section');
			return;
		}
		
		// Add the new tasks
		for (const checkbox of fileTasks) {
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		// Update the task count in the header
		const fileCount = fileSection.querySelector('.ontask-file-count') as HTMLElement;
		if (fileCount) {
			const currentCount = checkboxesList.children.length;
			fileCount.textContent = `${currentCount} task${currentCount === 1 ? '' : 's'}`;
		}
		
		console.log(`OnTask View: Appended ${fileTasks.length} tasks to existing file section: ${filePath}`);
	}

	private createNewFileSection(contentArea: HTMLElement, fileTasks: any[], filePath: string): void {
		const fileSection = contentArea.createDiv('ontask-file-section');
		fileSection.setAttribute('data-file-path', filePath);
		
		// File header
		const fileHeader = fileSection.createDiv('ontask-file-header');
		fileHeader.createEl('h3', { text: this.getFileName(filePath) });
		fileHeader.createEl('span', { 
			text: `${fileTasks.length} task${fileTasks.length === 1 ? '' : 's'}`,
			cls: 'ontask-file-count'
		});
		
		// Checkboxes list
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (const checkbox of fileTasks) {
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		console.log(`OnTask View: Created new file section with ${fileTasks.length} tasks: ${filePath}`);
	}

	private groupCheckboxesByFile(checkboxes: any[]): Map<string, any[]> {
		const grouped = new Map<string, any[]>();
		
		console.log(`OnTask View: Grouping ${checkboxes.length} checkboxes by file`);
		
		for (const checkbox of checkboxes) {
			const filePath = checkbox.file?.path || 'Unknown';
			if (!grouped.has(filePath)) {
				grouped.set(filePath, []);
				console.log(`OnTask View: Creating new group for file: ${filePath}`);
			}
			grouped.get(filePath)!.push(checkbox);
			console.log(`OnTask View: Added checkbox to ${filePath}: "${checkbox.lineContent?.trim()}"`);
		}
		
		console.log(`OnTask View: Final grouped files:`, Array.from(grouped.keys()));
		console.log(`OnTask View: File counts:`, Array.from(grouped.entries()).map(([file, checkboxes]) => `${file}: ${checkboxes.length}`));
		
		return grouped;
	}

	private sortFilesByDate(checkboxesByFile: Map<string, any[]>): Map<string, any[]> {
		// Convert Map to array of entries for sorting
		const fileEntries = Array.from(checkboxesByFile.entries());
		
		// Sort by date in filename (latest first)
		fileEntries.sort((a, b) => {
			try {
				const fileNameA = this.getFileName(a[0]);
				const fileNameB = this.getFileName(b[0]);
				
				// Extract date from filename (format: YYYY-MM-DD)
				const dateMatchA = fileNameA.match(/(\d{4}-\d{2}-\d{2})/);
				const dateMatchB = fileNameB.match(/(\d{4}-\d{2}-\d{2})/);
				
				if (!dateMatchA || !dateMatchB) {
					// If no date found in filename, fall back to file modification date
					const fileA = this.app.vault.getAbstractFileByPath(a[0]) as TFile;
					const fileB = this.app.vault.getAbstractFileByPath(b[0]) as TFile;
					
					if (!fileA || !fileB) {
						console.log('OnTask View: File not found, maintaining order');
						return 0;
					}
					
					const dateA = fileA.stat?.mtime || fileA.stat?.ctime || 0;
					const dateB = fileB.stat?.mtime || fileB.stat?.ctime || 0;
					
					console.log(`OnTask View: No date in filename, using modification date for ${fileNameA} vs ${fileNameB}`);
					return dateB - dateA;
				}
				
				// Parse dates from filename
				const dateA = new Date(dateMatchA[1]);
				const dateB = new Date(dateMatchB[1]);
				
				console.log(`OnTask View: Sorting by filename date ${fileNameA} (${dateA.toISOString().split('T')[0]}) vs ${fileNameB} (${dateB.toISOString().split('T')[0]})`);
				
				// Sort latest first (descending order)
				return dateB.getTime() - dateA.getTime();
			} catch (error) {
				console.error('OnTask View: Error sorting files by date:', error);
				// If there's an error, maintain original order
				return 0;
			}
		});
		
		// Convert back to Map
		const sortedMap = new Map<string, any[]>();
		for (const [filePath, checkboxes] of fileEntries) {
			sortedMap.set(filePath, checkboxes);
		}
		
		console.log(`OnTask View: Files sorted by filename date (latest first):`, Array.from(sortedMap.keys()).map(path => this.getFileName(path)));
		return sortedMap;
	}

	private createCheckboxElement(checkbox: any): HTMLElement {
		const checkboxEl = document.createElement('div');
		checkboxEl.addClass('ontask-checkbox-item');
		
		// Add top task indicator
		if (checkbox.isTopTask) {
			checkboxEl.addClass('ontask-top-task');
		}
		
		// Create checkbox container
		const checkboxContainer = document.createElement('div');
		checkboxContainer.addClass('ontask-checkbox-label');
		
		// Create status display with colors from configuration
		const statusDisplay = document.createElement('div');
		statusDisplay.addClass('ontask-checkbox-display');
		
		// Extract status symbol from checkbox content
		const { statusSymbol, remainingText } = this.parseCheckboxLine(checkbox.lineContent);
		statusDisplay.setAttribute('data-status', statusSymbol);
		statusDisplay.textContent = `[${statusSymbol}]`;
		
		// Apply colors from status configuration
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		statusDisplay.style.color = statusColor;
		statusDisplay.style.backgroundColor = statusBackgroundColor;
		statusDisplay.style.border = `1px solid ${statusColor}`;
		
		// Create text content
		const textEl = document.createElement('span');
		textEl.textContent = remainingText || 'Task';
		textEl.addClass('ontask-checkbox-text');
		
		// Add click handler for status display (to open file)
		statusDisplay.addEventListener('click', () => {
			this.openFile(checkbox.file?.path || '', checkbox.lineNumber);
		});
		statusDisplay.style.cursor = 'pointer';
		
		// Add click handler for text (to open file)
		textEl.addEventListener('click', () => {
			this.openFile(checkbox.file?.path || '', checkbox.lineNumber);
		});
		textEl.style.cursor = 'pointer';
		
		// Add context menu event listener to the task row
		checkboxEl.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showContextMenu(e, checkbox);
		});

		// Add touch support for mobile devices with long-press detection
		this.addMobileTouchHandlers(checkboxEl, checkbox);
		
		checkboxContainer.appendChild(statusDisplay);
		checkboxContainer.appendChild(textEl);
		checkboxEl.appendChild(checkboxContainer);
		
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
				
				// Trigger immediate status bar update
				this.eventSystem.emit('checkboxes:updated', { 
					count: this.checkboxes.length,
					topTask: this.checkboxes.find(cb => cb.isTopTask)
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
		
		// Schedule refresh after 500ms with debouncing
		this.refreshTimeout = window.setTimeout(() => {
			// Only refresh if we're not already refreshing
			if (!this.isRefreshing) {
				this.refreshCheckboxes();
			}
		}, 500);
	}

	private scheduleDebouncedRefresh(file: any): void {
		// Process immediately since we now only react to meaningful checkbox changes
		this.checkForCheckboxChanges(file);
	}

	private async checkForCheckboxChanges(file: any): Promise<void> {
		try {
			// Quick check: if we don't have any checkboxes in this file, skip processing entirely
			const fileCheckboxes = this.checkboxes.filter(checkbox => checkbox.file?.path === file.path);
			if (fileCheckboxes.length === 0) {
				return; // No checkboxes in this file, no need to process
			}
			
			// Read the current file content
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			let hasCheckboxChanges = false;
			
			// Check if any checkbox content has actually changed
			for (const checkbox of fileCheckboxes) {
				const lineIndex = checkbox.lineNumber - 1;
				if (lineIndex >= 0 && lineIndex < lines.length) {
					const currentLine = lines[lineIndex].trim();
					const checkboxKey = `${file.path}:${checkbox.lineNumber}`;
					const lastContent = this.lastCheckboxContent.get(checkboxKey);
					
					// Check if this line contains a checkbox and if it has changed
					if (currentLine.match(/^\s*-\s*\[[^\]]*\]/)) {
						if (lastContent !== currentLine) {
							hasCheckboxChanges = true;
							console.log('OnTask View: Checkbox content changed:', {
								file: file.path,
								line: checkbox.lineNumber,
								old: lastContent,
								new: currentLine
							});
						}
						// Update the stored content
						this.lastCheckboxContent.set(checkboxKey, currentLine);
					}
				}
			}
			
			if (hasCheckboxChanges) {
				console.log('OnTask View: Checkbox changes detected, refreshing view');
				// Emit file:modified event for editor integration
				this.eventSystem.emit('file:modified', { path: file.path });
				this.refreshCheckboxes();
			}
			// Removed the "no checkbox modifications detected" message to reduce console noise
		} catch (error) {
			console.error('OnTask View: Error checking for checkbox changes:', error);
			// Fallback to refresh if there's an error
			this.refreshCheckboxes();
		}
	}

	private initializeCheckboxContentTracking(): void {
		// Clear existing tracking
		this.lastCheckboxContent.clear();
		
		// Initialize content tracking for all current checkboxes
		for (const checkbox of this.checkboxes) {
			const checkboxKey = `${checkbox.file.path}:${checkbox.lineNumber}`;
			this.lastCheckboxContent.set(checkboxKey, checkbox.lineContent?.trim() || '');
		}
		
		console.log(`OnTask View: Initialized content tracking for ${this.checkboxes.length} checkboxes`);
	}

	private setupEventListeners(): void {
		console.log('OnTask View: Setting up event listeners');
		
		// Clean up any existing listeners first
		this.cleanupEventListeners();
		
		// Listen for settings changes
		const settingsSubscription = this.eventSystem.on('settings:changed', (event) => {
			console.log('OnTask View: Settings changed event received:', event.data.key);
			if (event.data.key === 'hideCompletedTasks' || event.data.key === 'onlyShowToday') {
				console.log('OnTask View: Triggering refresh due to settings change');
				this.refreshCheckboxes();
			}
		});
		
		// Listen for checkbox updates to update top task section immediately
		const checkboxUpdateSubscription = this.eventSystem.on('checkboxes:updated', (event) => {
			console.log('OnTask View: Checkboxes updated event received, updating top task section');
			// Only update the top task section without full refresh
			this.updateTopTaskSection();
		});
		
		// Listen for file modifications
		const fileModifyListener = (file: any) => {
			// Skip refresh if we're currently updating a status ourselves
			if (this.isUpdatingStatus) {
				console.log('OnTask View: Skipping refresh - currently updating status');
				return;
			}
			
			// Only process markdown files
			if (!file.path.endsWith('.md')) {
				return;
			}
			
			// Check if any of our checkboxes are in this file
			const isRelevantFile = this.checkboxes.some(checkbox => checkbox.file?.path === file.path);
			if (isRelevantFile) {
				// Only process if we have checkboxes in this file
				this.scheduleDebouncedRefresh(file);
			}
		};
		
		this.app.vault.on('modify', fileModifyListener);
		
		// Store cleanup functions
		this.eventListeners = [
			() => settingsSubscription.unsubscribe(),
			() => checkboxUpdateSubscription.unsubscribe(),
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

	private showContextMenu(event: MouseEvent, checkbox: any): void {
		console.log('OnTask View: Context menu triggered', event, checkbox);
		
		// Remove any existing context menu
		const existingMenu = document.querySelector('.ontask-context-menu');
		if (existingMenu) {
			existingMenu.remove();
		}

		// Create context menu
		const menu = document.createElement('div');
		menu.className = 'ontask-context-menu';
		menu.style.position = 'fixed';
		menu.style.zIndex = '1000';
		menu.style.background = 'var(--background-primary)';
		menu.style.border = '1px solid var(--background-modifier-border)';
		menu.style.borderRadius = '6px';
		menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
		menu.style.padding = '2px';
		menu.style.minWidth = '200px';

		// Use centralized status configuration
		const statuses = this.statusConfigService.getStatusConfigs();

		// Add menu items for each status
		for (const status of statuses) {
			const menuItem = document.createElement('div');
			menuItem.className = 'ontask-context-menu-item';
			menuItem.style.padding = '6px 10px';
			menuItem.style.cursor = 'pointer';
			menuItem.style.fontSize = '14px';
			menuItem.style.color = 'var(--text-normal)';
			menuItem.style.borderRadius = '4px';
			menuItem.style.display = 'flex';
			menuItem.style.alignItems = 'center';
			menuItem.style.gap = '6px';

			// Create status display with colors from configuration
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
			statusDisplay.style.color = status.color;
			statusDisplay.style.backgroundColor = status.backgroundColor || 'transparent';
			statusDisplay.style.border = `1px solid ${status.color}`;
			statusDisplay.style.borderRadius = '3px';

			// Create text content
			const textContent = document.createElement('div');
			textContent.style.display = 'flex';
			textContent.style.flexDirection = 'column';
			textContent.style.gap = '1px';
			
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
				this.updateCheckboxStatus(checkbox, status.symbol);
				menu.remove();
			});

			menu.appendChild(menuItem);
		}

		// Add to document first to get dimensions
		document.body.appendChild(menu);

		// Smart positioning to prevent off-screen display
		this.positionContextMenu(menu, event);
		console.log('OnTask View: Context menu added to DOM', menu);

		// Close menu when clicking outside, scrolling, or right-clicking anywhere
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu);
				document.removeEventListener('scroll', closeMenu);
				document.removeEventListener('contextmenu', closeMenu);
			}
		};

		// Use requestAnimationFrame to avoid immediate closure
		requestAnimationFrame(() => {
			document.addEventListener('click', closeMenu);
			document.addEventListener('scroll', closeMenu, true); // Use capture phase for scroll events
			document.addEventListener('contextmenu', closeMenu);
		});
	}

	private positionContextMenu(menu: HTMLElement, event: MouseEvent): void {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuRect = menu.getBoundingClientRect();
		const menuWidth = menuRect.width;
		const menuHeight = menuRect.height;
		
		// Get initial position from event
		let left = event.clientX;
		let top = event.clientY;
		
		// Mobile-specific adjustments
		const isMobile = window.innerWidth <= 768;
		const margin = isMobile ? 5 : 10; // Smaller margin on mobile
		
		// Check if menu would go off the right edge
		if (left + menuWidth > viewportWidth - margin) {
			left = viewportWidth - menuWidth - margin;
		}
		
		// Check if menu would go off the left edge
		if (left < margin) {
			left = margin;
		}
		
		// Check if menu would go off the bottom edge
		if (top + menuHeight > viewportHeight - margin) {
			top = viewportHeight - menuHeight - margin;
		}
		
		// Check if menu would go off the top edge
		if (top < margin) {
			top = margin;
		}
		
		// Apply the calculated position
		menu.style.left = `${left}px`;
		menu.style.top = `${top}px`;
		
		// On mobile, ensure the menu is fully visible by adjusting if needed
		if (isMobile) {
			// Double-check positioning after setting styles
			requestAnimationFrame(() => {
				const finalRect = menu.getBoundingClientRect();
				if (finalRect.right > viewportWidth) {
					menu.style.left = `${viewportWidth - finalRect.width - margin}px`;
				}
				if (finalRect.bottom > viewportHeight) {
					menu.style.top = `${viewportHeight - finalRect.height - margin}px`;
				}
			});
		}
	}


	private async updateCheckboxStatus(checkbox: any, newStatus: string): Promise<void> {
		console.log('OnTask View: Updating checkbox status', checkbox, newStatus);
		
		// Set flag to prevent file modification listener from triggering refresh
		this.isUpdatingStatus = true;
		
		try {
			// Get the file
			const file = checkbox.file;
			if (!file) {
				console.error('OnTask View: No file found for checkbox');
				return;
			}

			// Read the file content
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');

			// Update the specific line (lineNumber is 1-based, so subtract 1 for array index)
			const lineIndex = checkbox.lineNumber - 1;
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const line = lines[lineIndex];
				// Update the checkbox status using a flexible regex pattern
				const updatedLine = line.replace(/^(\s*)- \[[^\]]*\]/, `$1- [${newStatus}]`);
				
				// Log for debugging if the line wasn't updated
				if (updatedLine === line) {
					console.log('OnTask View: Warning - line was not updated:', JSON.stringify(line));
					console.log('OnTask View: Expected pattern: - [status] at start of line');
				}
				
				lines[lineIndex] = updatedLine;

				// Write back to file
				await this.app.vault.modify(file, lines.join('\n'));
				
				// Refresh the entire view to ensure UI consistency
				// This is simpler and more reliable than trying to update individual elements
				this.refreshCheckboxes();
			}
		} catch (error) {
			console.error('OnTask View: Error updating checkbox status:', error);
		} finally {
			// Clear the flag to allow future file modification listeners
			this.isUpdatingStatus = false;
		}
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


	private openSettings(): void {
		// Open the plugin settings
		(this.app as any).setting.open();
		(this.app as any).setting.openTabById(this.plugin.manifest.id);
	}

	private async toggleHideCompleted(): Promise<void> {
		const settings = this.settingsService.getSettings();
		const newValue = !settings.hideCompletedTasks;
		// Update settings through settings service
		await this.settingsService.updateSetting('hideCompletedTasks', newValue);
		this.updateButtonStates();
		this.refreshCheckboxes();
	}

	private async toggleOnlyToday(): Promise<void> {
		const settings = this.settingsService.getSettings();
		const newValue = !settings.onlyShowToday;
		// Update settings through settings service
		await this.settingsService.updateSetting('onlyShowToday', newValue);
		this.updateButtonStates();
		this.refreshCheckboxes();
	}

	private toggleTopTaskVisibility(): void {
		// Emit event to toggle top task visibility
		this.eventSystem.emit('ui:toggle-top-task-visibility', {});
	}

	private updateButtonStates(): void {
		const settings = this.settingsService.getSettings();
		
		// Update Hide Completed button state
		if (this.hideCompletedButton) {
			if (settings.hideCompletedTasks) {
				this.hideCompletedButton.textContent = 'Hide Completed';
			} else {
				this.hideCompletedButton.textContent = 'Show Completed';
			}
		}
		
		// Update Only Today button state
		if (this.onlyTodayButton) {
			if (settings.onlyShowToday) {
				this.onlyTodayButton.textContent = 'Show Today';
			} else {
				this.onlyTodayButton.textContent = 'Show All';
			}
		}
	}

	private parseCheckboxLine(line: string): { statusSymbol: string; remainingText: string } {
		const trimmedLine = line.trim();
		
		// Look for checkbox pattern: - [ANYTHING] at the beginning of the line
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]]*)\]\s*(.*)$/);
		
		if (checkboxMatch) {
			const statusSymbol = checkboxMatch[1].trim() || ' ';
			const remainingText = checkboxMatch[2].trim();
			return { statusSymbol, remainingText };
		}
		
		// If no match, return default values
		return { statusSymbol: ' ', remainingText: trimmedLine };
	}

	/**
	 * Adds mobile touch handlers with long-press detection for context menu
	 * Allows normal scrolling while providing long-press for context menu
	 */
	private addMobileTouchHandlers(element: HTMLElement, task: any): void {
		let touchStartTime: number = 0;
		let touchStartX: number = 0;
		let touchStartY: number = 0;
		let longPressTimer: number | null = null;
		let hasMoved: boolean = false;
		const LONG_PRESS_DURATION = 500; // 500ms for long press
		const MOVE_THRESHOLD = 10; // 10px movement threshold

		element.addEventListener('touchstart', (e) => {
			touchStartTime = Date.now();
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
			hasMoved = false;

			// Start long press timer
			longPressTimer = window.setTimeout(() => {
				if (!hasMoved) {
					// Long press detected - show context menu
					const touch = e.touches[0];
					const mouseEvent = new MouseEvent('contextmenu', {
						clientX: touch.clientX,
						clientY: touch.clientY,
						bubbles: true,
						cancelable: true
					});
					this.showContextMenu(mouseEvent, task);
				}
			}, LONG_PRESS_DURATION);
		});

		element.addEventListener('touchmove', (e) => {
			if (longPressTimer) {
				// Check if touch has moved significantly
				const currentX = e.touches[0].clientX;
				const currentY = e.touches[0].clientY;
				const deltaX = Math.abs(currentX - touchStartX);
				const deltaY = Math.abs(currentY - touchStartY);

				if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
					hasMoved = true;
					// Cancel long press timer if user is scrolling
					if (longPressTimer) {
						clearTimeout(longPressTimer);
						longPressTimer = null;
					}
				}
			}
		});

		element.addEventListener('touchend', (e) => {
			// Clear long press timer on touch end
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		});

		element.addEventListener('touchcancel', (e) => {
			// Clear long press timer on touch cancel
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		});
	}

	/**
	 * Create top task section element for optimized rendering
	 */
	private createTopTaskSectionElement(topTask: any): HTMLElement {
		const topTaskSection = document.createElement('div');
		topTaskSection.className = 'ontask-top-task-section ontask-file-section';
		
		// Top task header
		const topTaskHeader = topTaskSection.createDiv('ontask-file-header');
		topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
		
		// Top task display
		const topTaskDisplay = topTaskSection.createDiv('ontask-top-task-display');
		topTaskDisplay.addClass('ontask-top-task-item');
		
		// Create top task content
		const topTaskContent = topTaskDisplay.createDiv('ontask-top-task-content');
		
		// Top task status display with colors
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { statusSymbol, remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = `[${statusSymbol}]`;
		topTaskStatusDisplay.style.cursor = 'pointer';
		
		// Apply colors from status configuration
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		topTaskStatusDisplay.style.color = statusColor;
		topTaskStatusDisplay.style.backgroundColor = statusBackgroundColor;
		topTaskStatusDisplay.style.border = `1px solid ${statusColor}`;
		
		topTaskStatusDisplay.addEventListener('click', () => {
			this.openFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task text
		const topTaskText = topTaskDisplay.createDiv('ontask-top-task-text');
		topTaskText.textContent = remainingText || 'Top Task';
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
		
		topTaskContent.appendChild(topTaskStatusDisplay);
		topTaskContent.appendChild(topTaskText);
		topTaskContent.appendChild(topTaskSource);
		
		// Add context menu event listener to the top task
		topTaskDisplay.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showContextMenu(e, topTask);
		});

		// Add touch support for mobile devices with long-press detection
		this.addMobileTouchHandlers(topTaskDisplay, topTask);
		
		return topTaskSection;
	}

	/**
	 * Create file section element for optimized rendering
	 */
	private createFileSectionElement(filePath: string, fileCheckboxes: any[], maxTasksToShow: number, tasksShown: number): HTMLElement {
		const fileSection = document.createElement('div');
		fileSection.className = 'ontask-file-section';
		fileSection.setAttribute('data-file-path', filePath);
		
		// File header
		const fileHeader = fileSection.createDiv('ontask-file-header');
		fileHeader.createEl('h3', { text: this.getFileName(filePath) });
		
		// Calculate how many tasks from this file we can show
		const remainingSlots = maxTasksToShow - tasksShown;
		const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
		
		fileHeader.createEl('span', { 
			text: `${tasksToShowFromFile} of ${fileCheckboxes.length} task${fileCheckboxes.length === 1 ? '' : 's'}`,
			cls: 'ontask-file-count'
		});
		
		// Checkboxes list
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (let i = 0; i < tasksToShowFromFile; i++) {
			const checkbox = fileCheckboxes[i];
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		return fileSection;
	}

	/**
	 * Create load more button element for optimized rendering
	 */
	private createLoadMoreButtonElement(): HTMLElement {
		const loadMoreSection = document.createElement('div');
		loadMoreSection.className = 'ontask-load-more-section ontask-file-section';
		
		// Calculate remaining tasks
		const remainingTasks = this.checkboxes.length - this.displayedTasksCount;
		
		this.loadMoreButton = loadMoreSection.createEl('button', {
			text: `Load More Tasks (${remainingTasks} remaining)`,
			cls: 'ontask-load-more-button'
		});
		
		this.loadMoreButton.addEventListener('click', () => {
			this.loadMoreTasks();
		});
		
		return loadMoreSection;
	}
}
