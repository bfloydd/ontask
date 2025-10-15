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
	private onlyTodayButton: HTMLButtonElement;
	private isRefreshing: boolean = false;
	private isUpdatingStatus: boolean = false;
	private displayedTasksCount: number = 10; // Will be updated from settings
	private loadMoreButton: HTMLButtonElement | null = null;
	private lastCheckboxContent: Map<string, string> = new Map(); // Track checkbox content to detect actual changes
	
	// File tracking for precise Load More functionality
	private currentFileIndex: number = 0; // Current position in trackedFiles array
	private currentTaskIndex: number = 0; // Current task index within the current file
	private trackedFiles: string[] = []; // Sorted array of all files (Z-A by filename)

	/**
	 * Top task configuration - easily modifiable priority order
	 * Each entry defines: symbol, name, and regex pattern for detection
	 */
	private static readonly TOP_TASK_CONFIG = [
		{
			symbol: '/',
			name: 'slash',
			pattern: /^-\s*\[\/([^\]]*)\]/
		},
		{
			symbol: '!',
			name: 'exclamation', 
			pattern: /^-\s*\[!([^\]]*)\]/
		},
		{
			symbol: '+',
			name: 'plus',
			pattern: /^-\s*\[\+([^\]]*)\]/
		}
	] as const;

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
		// header.createEl('h2', { text: 'On Task' });
		
		// Create buttons container
		const buttonsContainer = header.createDiv('ontask-buttons-container');
		
		// Create refresh button
		const refreshButton = buttonsContainer.createEl('button', { text: 'Refresh' });
		refreshButton.addClass('ontask-header-button');
		refreshButton.innerHTML = '<svg class="lucide lucide-refresh-cw" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg> Refresh';
		refreshButton.addEventListener('click', () => this.refreshCheckboxes());
		
		// Create filter buttons
		const filtersButton = buttonsContainer.createEl('button', { text: 'Filters' });
		filtersButton.addClass('ontask-header-button');
		filtersButton.innerHTML = '<svg class="lucide lucide-filter" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg> Filters';
		filtersButton.addEventListener('click', () => this.showFiltersMenu());
		
		this.onlyTodayButton = buttonsContainer.createEl('button', { text: 'Show All' });
		this.onlyTodayButton.addClass('ontask-header-button');
		this.onlyTodayButton.innerHTML = '<svg class="lucide lucide-calendar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Show All';
		this.onlyTodayButton.addEventListener('click', () => this.toggleOnlyToday());
		
		// Create configure button
		const configureButton = buttonsContainer.createEl('button', { text: 'Configure' });
		configureButton.addClass('ontask-header-button');
		configureButton.innerHTML = '<svg class="lucide lucide-settings" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> Configure';
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
		console.log('OnTask View: refreshCheckboxes called');
		// Prevent multiple simultaneous refreshes
		if (this.isRefreshing) {
			console.log('OnTask View: Already refreshing, skipping');
			return;
		}
		
		this.isRefreshing = true;
		
		try {
			// Find the content area
			const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
			if (!contentArea) {
				console.error('Content area not found');
				return;
			}
			
			// Clear existing content
			contentArea.empty();
			
			// Get current settings first
			const settings = this.settingsService.getSettings();
			
			// Reset pagination state using settings
			this.displayedTasksCount = settings.loadMoreLimit;
			this.loadMoreButton = null;
			
			// Reset file tracking for fresh start
			this.checkboxFinderService.resetFileTracking();
			
			// Reset our tracking variables for fresh start
			this.resetTracking();
			
			// Show loading state with progress indication
			const loadingEl = contentArea.createDiv('ontask-loading');
			loadingEl.textContent = 'Loading checkboxes...';
			
			// Initialize file list and tracking for fresh start
			await this.initializeFileTracking(settings.onlyShowToday);
			this.currentFileIndex = 0;
			this.currentTaskIndex = 0;
			
			// Load tasks with proper filtering and tracking
			this.checkboxes = await this.loadTasksWithFiltering(settings);
			console.log('OnTask View: Loaded checkboxes:', this.checkboxes.length);
			
			// Process top tasks from the displayed tasks (as per spec)
			this.processTopTasksFromDisplayedTasks();
			
			console.log('OnTask View: Checkbox details after top task processing:', this.checkboxes.map(cb => ({
				lineContent: cb.lineContent,
				isTopTask: cb.isTopTask,
				file: cb.file?.path
			})));
			
			// Clear loading state
			loadingEl.remove();
			
			// Render checkboxes
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
		// Find the content area
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			console.error('Content area not found for top task update');
			return;
		}
		
		// Find the existing top task section
		const existingTopTaskSection = contentArea.querySelector('.ontask-toptask-hero-section');
		
		// Find the current top task
		const topTask = this.checkboxes.find(checkbox => checkbox.isTopTask);
		
		if (topTask) {
			if (existingTopTaskSection) {
				// Update existing top task section
				const topTaskStatusDisplay = existingTopTaskSection.querySelector('.ontask-checkbox-display');
				if (topTaskStatusDisplay) {
					const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
					topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
					topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
				}
				
				// Update the top task text
				const topTaskText = existingTopTaskSection.querySelector('.ontask-toptask-hero-text');
				if (topTaskText) {
					const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
					topTaskText.textContent = remainingText || 'Top Task';
				}
				
			} else {
				// Create new top task section immediately
				this.createTopTaskSection(contentArea, topTask);
			}
		} else {
			// If no top task, remove the section if it exists
			if (existingTopTaskSection) {
				existingTopTaskSection.remove();
			}
		}
	}

	private createTopTaskSection(contentArea: HTMLElement, topTask: any): void {
		const topTaskSection = contentArea.createDiv('ontask-toptask-hero-section');
		topTaskSection.addClass('ontask-file-section');
		
		// Top task header
		const topTaskHeader = topTaskSection.createDiv('ontask-toptask-hero-header');
		topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
		
		// Top task display
		const topTaskDisplay = topTaskSection.createDiv('ontask-toptask-hero-display');
		topTaskDisplay.addClass('ontask-toptask-hero-item');
		
		// Create top task content
		const topTaskContent = topTaskDisplay.createDiv('ontask-toptask-hero-content');
		
		// Top task status display
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { statusSymbol, remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		topTaskStatusDisplay.style.cursor = 'pointer';
		topTaskStatusDisplay.addEventListener('click', () => {
			this.openFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task text
		const topTaskText = topTaskDisplay.createDiv('ontask-toptask-hero-text');
		topTaskText.textContent = remainingText || 'Top Task';
		topTaskText.style.cursor = 'pointer';
		topTaskText.addEventListener('click', () => {
			this.openFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task source
		const topTaskSource = topTaskDisplay.createDiv('ontask-toptask-hero-source');
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

		// Group all checkboxes by file (including the top task - it should appear in both the Hero section and list per spec)
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
		
		// Always show Load More button - it will find more tasks if available
		const loadMoreSection = this.createLoadMoreButtonElement();
		fragment.appendChild(loadMoreSection);
		
		// Append fragment to content area in one operation
		contentArea.appendChild(fragment);
	}

	private renderCheckboxes(contentArea: HTMLElement): void {
		
		if (this.checkboxes.length === 0) {
			const emptyEl = contentArea.createDiv('ontask-empty');
			emptyEl.textContent = 'No checkboxes found.';
			return;
		}

		// Find the top task (the winner)
		const topTask = this.checkboxes.find(checkbox => checkbox.isTopTask);
		console.log('OnTask View: Looking for top task. Total checkboxes:', this.checkboxes.length);
		console.log('OnTask View: Top task found:', topTask ? 'YES' : 'NO');
		if (topTask) {
			console.log('OnTask View: Top task details:', {
				lineContent: topTask.lineContent,
				isTopTask: topTask.isTopTask,
				file: topTask.file?.path
			});
		}

		// Render top task prominently at the top if it exists
		if (topTask) {
			const topTaskSection = contentArea.createDiv('ontask-toptask-hero-section');
			topTaskSection.addClass('ontask-file-section');
			
			// Top task header
			const topTaskHeader = topTaskSection.createDiv('ontask-toptask-hero-header');
			topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
			
			// Top task display
			const topTaskDisplay = topTaskSection.createDiv('ontask-toptask-hero-display');
			topTaskDisplay.addClass('ontask-toptask-hero-item');
			
			// Create top task content
			const topTaskContent = topTaskDisplay.createDiv('ontask-toptask-hero-content');
			
			// Top task status display with colors
			const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
			const { statusSymbol, remainingText } = this.parseCheckboxLine(topTask.lineContent);
			topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
			topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
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
			const topTaskText = topTaskDisplay.createDiv('ontask-toptask-hero-text');
			topTaskText.textContent = remainingText || 'Top Task';
			topTaskText.style.cursor = 'pointer';
			topTaskText.addEventListener('click', () => {
				this.openFile(topTask.file?.path || '', topTask.lineNumber);
			});
			
			// Top task source
			const topTaskSource = topTaskDisplay.createDiv('ontask-toptask-hero-source');
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

		// Group all checkboxes by file (including the top task - it should appear in both the Hero section and list per spec)
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
			
			// Checkboxes list
			const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
			
			for (let i = 0; i < tasksToShowFromFile; i++) {
				const checkbox = fileCheckboxes[i];
				const checkboxEl = this.createCheckboxElement(checkbox);
				checkboxesList.appendChild(checkboxEl);
				tasksShown++;
			}
		}
		
		// Always show Load More button - it will find more tasks if available
		this.addLoadMoreButton(contentArea);
	}

	private addLoadMoreButton(contentArea: HTMLElement): void {
		// Remove existing load more button if it exists
		if (this.loadMoreButton) {
			this.loadMoreButton.remove();
		}

		// Remove any existing load more sections to prevent duplicates
		const existingSections = contentArea.querySelectorAll('.ontask-load-more-section');
		existingSections.forEach(section => section.remove());

		const loadMoreSection = contentArea.createDiv('ontask-load-more-section');
		loadMoreSection.addClass('ontask-file-section');
		
		this.loadMoreButton = loadMoreSection.createEl('button', {
			text: 'Load More',
			cls: 'ontask-load-more-button'
		});
		
		this.loadMoreButton.addEventListener('click', async () => {
			await this.loadMoreTasks();
		});
	}

	private async loadMoreTasks(): Promise<void> {
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
		
		// Get current settings
		const settings = this.settingsService.getSettings();
		
		// Load more tasks using the new tracking system
		const additionalTasks = await this.loadTasksWithFiltering(settings);
		
		// Add new tasks to existing ones
		this.checkboxes.push(...additionalTasks);
		
		// Update displayed count
		this.displayedTasksCount += additionalTasks.length;
		
		// Render the additional tasks
		this.renderAdditionalTasks(contentArea, additionalTasks.map(task => ({
			checkbox: task,
			filePath: task.file?.path || ''
		})));
		
		// Always add Load More button - it will find more tasks if available
		this.addLoadMoreButton(contentArea);
		
		console.log(`OnTask View: Loaded ${additionalTasks.length} additional tasks. Total shown: ${this.displayedTasksCount} of ${this.checkboxes.length}`);
		console.log(`OnTask View: Current position - file ${this.currentFileIndex}, task ${this.currentTaskIndex}`);
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
		
		// Checkboxes list
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (const checkbox of fileTasks) {
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
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
					return 0;
				}
					
					const dateA = fileA.stat?.mtime || fileA.stat?.ctime || 0;
					const dateB = fileB.stat?.mtime || fileB.stat?.ctime || 0;
					
					return dateB - dateA;
				}
				
				// Parse dates from filename
				const dateA = new Date(dateMatchA[1]);
				const dateB = new Date(dateMatchB[1]);
				
				
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
		
		return sortedMap;
	}

	/**
	 * Centralized method for displaying status symbols consistently across the plugin
	 * @param statusSymbol The raw status symbol from the checkbox
	 * @returns The display text for the status symbol
	 */
	private getStatusDisplayText(statusSymbol: string): string {
		return statusSymbol;
	}

	private createCheckboxElement(checkbox: any): HTMLElement {
		const checkboxEl = document.createElement('div');
		checkboxEl.addClass('ontask-checkbox-item');
		
		// Add top task indicator
		if (checkbox.isTopTask) {
			checkboxEl.addClass('ontask-toptask-hero');
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
		statusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		
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

	private async openFile(filePath: string, lineNumber: number): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
		if (file) {
			// Check if the file is in a stream and update stream date if needed
			await this.handleStreamUpdate(filePath);
			
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
		const fileName = parts[parts.length - 1] || filePath;
		// Remove .md extension for display
		return fileName.replace(/\.md$/i, '');
	}

	/**
	 * Handle stream update when a file is opened
	 */
	private async handleStreamUpdate(filePath: string): Promise<void> {
		try {
			// Check if streams is the active checkbox source
			const settings = this.settingsService.getSettings();
			if (settings.checkboxSource !== 'streams') {
				console.log(`OnTask: Streams not active checkbox source (current: ${settings.checkboxSource}), skipping stream detection`);
				return;
			}

			// Get the streams service from the plugin orchestration
			const streamsService = this.checkboxFinderService.getStreamsService();
			
			if (!streamsService || !streamsService.isStreamsPluginAvailable()) {
				console.log('OnTask: Streams plugin not available, skipping stream detection');
				return;
			}

			// Check if the file is in a stream
			const stream = streamsService.isFileInStream(filePath);
			if (stream) {
				console.log(`OnTask: File ${filePath} is in stream "${stream.name}"`);
				
				// Update the stream bar from this file
				const success = await streamsService.updateStreamBarFromFile(filePath);
				
				if (success) {
					console.log(`OnTask: Successfully updated stream bar from file ${filePath}`);
				} else {
					console.log(`OnTask: Failed to update stream bar from file ${filePath}`);
				}
			} else {
				console.log(`OnTask: File ${filePath} is not in any stream`);
			}
		} catch (error) {
			console.error('OnTask: Error handling stream detection:', error);
		}
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
			if (event.data.key === 'onlyShowToday') {
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
			statusDisplay.textContent = this.getStatusDisplayText(status.symbol);
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


	private showFiltersMenu(): void {
		// Check if menu is already open and toggle it
		const existingMenu = document.querySelector('.ontask-filters-menu');
		if (existingMenu) {
			existingMenu.remove();
			return; // Menu was open, now it's closed - we're done
		}

		// Create filter menu
		const menu = document.createElement('div');
		menu.className = 'ontask-filters-menu';
		menu.style.position = 'fixed';
		menu.style.zIndex = '1000';
		menu.style.background = 'var(--background-primary)';
		menu.style.border = '1px solid var(--background-modifier-border)';
		menu.style.borderRadius = '6px';
		menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
		menu.style.padding = '12px';
		menu.style.maxWidth = '400px';

		// Get current settings and status configs
		const settings = this.settingsService.getSettings();
		const statusConfigs = this.statusConfigService.getStatusConfigs();

		// Create header
		const header = menu.createDiv();
		header.createEl('h3', { text: 'Status Filters' });
		header.style.marginBottom = '12px';
		header.style.borderBottom = '1px solid var(--background-modifier-border)';
		header.style.paddingBottom = '8px';

		// Create checkboxes for each status
		const checkboxesContainer = menu.createDiv();
		checkboxesContainer.style.display = 'flex';
		checkboxesContainer.style.flexDirection = 'column';
		checkboxesContainer.style.gap = '8px';

		// Track checkbox elements for save functionality
		const checkboxElements: { [key: string]: HTMLInputElement } = {};

		for (const status of statusConfigs) {
			const checkboxItem = checkboxesContainer.createDiv();
			checkboxItem.style.display = 'flex';
			checkboxItem.style.alignItems = 'center';
			checkboxItem.style.gap = '8px';

			// Create checkbox
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = `filter-${status.symbol}`;
			checkbox.checked = status.filtered !== false;
			checkboxElements[status.symbol] = checkbox;

			// Create status display
			const statusDisplay = document.createElement('div');
			statusDisplay.className = 'ontask-checkbox-display';
			statusDisplay.setAttribute('data-status', status.symbol);
			statusDisplay.textContent = this.getStatusDisplayText(status.symbol);
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

			// Create label
			const label = document.createElement('label');
			label.htmlFor = `filter-${status.symbol}`;
			label.style.display = 'flex';
			label.style.flexDirection = 'column';
			label.style.gap = '2px';
			label.style.cursor = 'pointer';
			label.style.flex = '1';

			const nameEl = document.createElement('div');
			nameEl.textContent = status.name;
			nameEl.style.fontWeight = '500';

			const descEl = document.createElement('div');
			descEl.textContent = status.description;
			descEl.style.fontSize = '12px';
			descEl.style.color = 'var(--text-muted)';

			label.appendChild(nameEl);
			label.appendChild(descEl);

			checkboxItem.appendChild(checkbox);
			checkboxItem.appendChild(statusDisplay);
			checkboxItem.appendChild(label);

			// Add click handler to the entire item
			checkboxItem.addEventListener('click', (e) => {
				if (e.target !== checkbox) {
					checkbox.checked = !checkbox.checked;
				}
			});
		}

		// Create buttons container
		const buttonsContainer = menu.createDiv();
		buttonsContainer.style.display = 'flex';
		buttonsContainer.style.justifyContent = 'center';
		buttonsContainer.style.gap = '8px';
		buttonsContainer.style.marginTop = '12px';
		buttonsContainer.style.borderTop = '1px solid var(--background-modifier-border)';
		buttonsContainer.style.paddingTop = '8px';

		// Create Save button
		const saveButton = buttonsContainer.createEl('button', { text: 'Save' });
		saveButton.addClass('mod-cta');
		saveButton.addEventListener('click', async () => {
			// Collect filter states
			const newFilters: Record<string, boolean> = {};
			for (const [symbol, checkbox] of Object.entries(checkboxElements)) {
				newFilters[symbol] = checkbox.checked;
			}

			// Update settings - update each status config's filtered property
			for (const [symbol, filtered] of Object.entries(newFilters)) {
				await this.settingsService.updateStatusFiltered(symbol, filtered);
			}
			
			// Close menu
			menu.remove();
			
			// Reset tracking when filters change
			this.resetTracking();
			
			// Refresh the view to apply filters
			await this.refreshCheckboxes();
		});

		// Add to document
		document.body.appendChild(menu);

		// Position the menu
		this.positionFilterMenu(menu);

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

	private positionFilterMenu(menu: HTMLElement): void {
		// Find the filters button to position the menu below it
		const filtersButton = this.contentEl.querySelector('.ontask-header-button') as HTMLElement;
		if (!filtersButton) {
			// Fallback to center positioning if button not found
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const menuRect = menu.getBoundingClientRect();
			const menuWidth = menuRect.width;
			const menuHeight = menuRect.height;

			const left = (viewportWidth - menuWidth) / 2;
			const top = (viewportHeight - menuHeight) / 2;

			menu.style.left = `${Math.max(10, left)}px`;
			menu.style.top = `${Math.max(10, top)}px`;
			return;
		}

		// Get button position and dimensions
		const buttonRect = filtersButton.getBoundingClientRect();
		const menuRect = menu.getBoundingClientRect();
		
		// Calculate position below the button
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuWidth = menuRect.width;
		const menuHeight = menuRect.height;
		
		// Position below the button with some spacing
		let left = buttonRect.left;
		let top = buttonRect.bottom + 8; // 8px spacing below button
		
		// Ensure menu doesn't go off the right edge
		if (left + menuWidth > viewportWidth - 10) {
			left = viewportWidth - menuWidth - 10;
		}
		
		// Ensure menu doesn't go off the left edge
		if (left < 10) {
			left = 10;
		}
		
		// If menu would go off the bottom edge, position it above the button instead
		if (top + menuHeight > viewportHeight - 10) {
			top = buttonRect.top - menuHeight - 8; // 8px spacing above button
		}
		
		// Ensure menu doesn't go off the top edge
		if (top < 10) {
			top = 10;
		}
		
		// Apply the calculated position
		menu.style.left = `${left}px`;
		menu.style.top = `${top}px`;
	}

	private async initializeFileTracking(onlyShowToday: boolean): Promise<void> {
		// Get all files from the checkbox finder service
		const allFiles = await this.getFilesFromStrategies(onlyShowToday);
		
		// Sort files by filename Z-A (ignoring path)
		this.trackedFiles = allFiles.sort((a, b) => {
			const filenameA = a.split('/').pop() || a;
			const filenameB = b.split('/').pop() || b;
			return filenameB.localeCompare(filenameA);
		});
		
		console.log(`OnTask: Initialized file tracking with ${this.trackedFiles.length} files`);
		console.log('OnTask: First few files:', this.trackedFiles.slice(0, 5));
	}

	private async getFilesFromStrategies(onlyShowToday: boolean): Promise<string[]> {
		// Get files from all active strategies
		const allFiles: string[] = [];
		
		// Get files from streams strategy
		const streamsService = this.checkboxFinderService.getStreamsService();
		if (streamsService && streamsService.isStreamsPluginAvailable()) {
			const allStreams = streamsService.getAllStreams();
			const streams = allStreams.filter(stream => stream.folder && stream.folder.trim() !== '');
			
			for (const stream of streams) {
				const streamFolder = this.app.vault.getAbstractFileByPath(stream.folder);
				if (streamFolder) {
					if (streamFolder instanceof TFile) {
						// Single file
						allFiles.push(stream.folder);
					} else {
						// Directory - get all markdown files
						const streamFiles = this.app.vault.getMarkdownFiles().filter(file => 
							file.path.startsWith(stream.folder)
						);
						allFiles.push(...streamFiles.map(file => file.path));
					}
				}
			}
		}
		
		// Get files from daily notes if available
		const dailyNotesPlugin = (this.app as any).plugins?.getPlugin('daily-notes');
		if (dailyNotesPlugin) {
			const dailyNotes = this.app.vault.getMarkdownFiles().filter(file => {
				const fileName = file.name.toLowerCase();
				// Check for common daily note patterns
				return fileName.match(/\d{4}-\d{2}-\d{2}/) || 
					   fileName.match(/\d{2}-\d{2}-\d{4}/) ||
					   fileName.match(/\d{4}\d{2}\d{2}/);
			});
			allFiles.push(...dailyNotes.map(file => file.path));
		}
		
		// Get files from custom folder if configured
		const settings = this.settingsService.getSettings();
		if (settings.checkboxSource === 'folder' && settings.customFolderPath) {
			const folderFiles = this.app.vault.getMarkdownFiles().filter(file => 
				file.path.startsWith(settings.customFolderPath)
			);
			allFiles.push(...folderFiles.map(file => file.path));
		}
		
		// Filter by today if needed
		if (onlyShowToday) {
			return allFiles.filter(filePath => {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				return file && this.isTodayFile(file);
			});
		}
		
		// Remove duplicates
		return [...new Set(allFiles)];
	}

	private isTodayFile(file: any): boolean {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		
		const todayFormats = [
			`${year}-${month}-${day}`,
			`${month}-${day}-${year}`,
			`${day}-${month}-${year}`,
			`${year}${month}${day}`,
			`${month}${day}${year}`,
			`${day}${month}${year}`
		];
		
		const fileName = file.name.toLowerCase();
		const filePath = file.path.toLowerCase();
		
		return todayFormats.some(format => 
			fileName.includes(format) || filePath.includes(format)
		);
	}

	private async loadTasksWithFiltering(settings: any): Promise<any[]> {
		const targetTasks = settings.loadMoreLimit;
		const loadedTasks: any[] = [];
		const statusFilters = this.settingsService.getStatusFilters();
		
		console.log(`OnTask: Loading ${targetTasks} tasks starting from file index ${this.currentFileIndex}, task index ${this.currentTaskIndex}`);
		
		// Create regex pattern for allowed statuses only
		const allowedStatuses = this.getAllowedStatuses(statusFilters);
		const checkboxRegex = this.createCheckboxRegex(allowedStatuses);
		
		console.log(`OnTask: Using regex pattern: ${checkboxRegex}`);
		console.log(`OnTask: Allowed statuses: ${allowedStatuses.join(', ')}`);
		
		// Loop through files starting from current position
		for (let fileIndex = this.currentFileIndex; fileIndex < this.trackedFiles.length; fileIndex++) {
			const filePath = this.trackedFiles[fileIndex];
			const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
			
			console.log(`OnTask: Processing file ${fileIndex + 1}/${this.trackedFiles.length}: ${filePath}`);
			
			if (!file) {
				console.log(`OnTask: File not found: ${filePath}`);
				continue;
			}
			
			try {
				// Read file content
				const content = await this.app.vault.read(file);
				const lines = content.split('\n');
				
				// Find checkboxes in this file using regex filtering
				const fileTasks: any[] = [];
				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					const line = lines[lineIndex];
					
					// Use regex to find only allowed checkboxes
					if (line.match(checkboxRegex)) {
						fileTasks.push({
							file: file,
							lineNumber: lineIndex + 1,
							lineContent: line.trim(),
							sourceName: 'file'
						});
					}
				}
				
				// Add tasks from this file, starting from current task index if it's the current file
				const startTaskIndex = (fileIndex === this.currentFileIndex) ? this.currentTaskIndex : 0;
				const tasksToAdd = fileTasks.slice(startTaskIndex);
				
				console.log(`OnTask: Found ${fileTasks.length} tasks in ${filePath}, adding ${tasksToAdd.length} (start from index ${startTaskIndex})`);
				
				// Add tasks until we reach the target
				for (const task of tasksToAdd) {
					if (loadedTasks.length >= targetTasks) {
						// We've reached our target, remember where we stopped
						this.currentFileIndex = fileIndex;
						this.currentTaskIndex = fileTasks.indexOf(task);
						console.log(`OnTask: Stopped at file ${fileIndex} (${filePath}), task ${this.currentTaskIndex} of ${fileTasks.length}`);
						return loadedTasks;
					}
					
					loadedTasks.push(task);
				}
				
				// Update tracking for next file (only if we didn't reach target)
				if (loadedTasks.length < targetTasks) {
					this.currentFileIndex = fileIndex + 1;
					this.currentTaskIndex = 0;
				}
				
			} catch (error) {
				console.error(`OnTask: Error reading file ${filePath}:`, error);
				continue;
			}
		}
		
		console.log(`OnTask: Loaded ${loadedTasks.length} tasks from ${this.trackedFiles.length} files`);
		return loadedTasks;
	}

	private getAllowedStatuses(statusFilters: Record<string, boolean>): string[] {
		const allowedStatuses = Object.entries(statusFilters)
			.filter(([_, isAllowed]) => isAllowed !== false)
			.map(([status, _]) => status);
		
		// Add space as synonym for dot (to-do task) if dot is allowed
		if (allowedStatuses.includes('.')) {
			allowedStatuses.push(' '); // Space is synonym for dot
		}
		
		return allowedStatuses;
	}

	private createCheckboxRegex(allowedStatuses: string[]): RegExp {
		if (allowedStatuses.length === 0) {
			// If no statuses are allowed, match nothing
			return /^$/; // This will never match
		}
		
		// Escape special regex characters in status symbols
		const escapedStatuses = allowedStatuses.map(status => 
			status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		);
		
		// Create regex pattern: -\s\[(ALLOWED_STATUS_1|ALLOWED_STATUS_2|...)\]\s.*
		const statusPattern = escapedStatuses.join('|');
		const regexPattern = `^\\s*-\\s*\\[(${statusPattern})\\]\\s.*`;
		
		return new RegExp(regexPattern);
	}

	private resetTracking(): void {
		this.currentFileIndex = 0;
		this.currentTaskIndex = 0;
		this.trackedFiles = [];
		this.checkboxes = []; // Clear existing checkboxes
		console.log('OnTask: Reset tracking for fresh start');
	}

	private applyStatusFilters(checkboxes: any[], statusFilters: Record<string, boolean>): any[] {
		if (!statusFilters) {
			return checkboxes;
		}

		return checkboxes.filter(checkbox => {
			// Parse the status symbol from the checkbox content
			const { statusSymbol } = this.parseCheckboxLine(checkbox.lineContent);
			
			// Check if this status is enabled in the filters
			// Default to true if the status is not in the filters (for backward compatibility)
			return statusFilters[statusSymbol] !== false;
		});
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
		
		
		// Update Only Today button state
		if (this.onlyTodayButton) {
			if (settings.onlyShowToday) {
				this.onlyTodayButton.innerHTML = '<svg class="lucide lucide-calendar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Show Today';
			} else {
				this.onlyTodayButton.innerHTML = '<svg class="lucide lucide-calendar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Show All';
			}
		}
	}

	private parseCheckboxLine(line: string): { statusSymbol: string; remainingText: string } {
		const trimmedLine = line.trim();
		
		// Simple approach: find the first occurrence of ']' and take everything after it
		const bracketIndex = trimmedLine.indexOf(']');
		if (bracketIndex !== -1) {
			const statusSymbol = trimmedLine.substring(0, bracketIndex).replace(/^-\s*\[/, '').trim() || this.getToDoSymbol();
			const remainingText = trimmedLine.substring(bracketIndex + 1).trim();
			return { statusSymbol, remainingText };
		}
		
		// If no match, return default values
		return { statusSymbol: this.getToDoSymbol(), remainingText: trimmedLine };
	}

	/**
	 * Get the to-do symbol from the status configuration
	 * @returns The to-do symbol from data.json, or ' ' as fallback
	 */
	private getToDoSymbol(): string {
		const statusConfigs = this.statusConfigService.getStatusConfigs();
		const toDoConfig = statusConfigs.find(config => config.name === 'To-do');
		return toDoConfig?.symbol || ' ';
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
		topTaskSection.className = 'ontask-toptask-hero-section ontask-file-section';
		
		// Top task header
		const topTaskHeader = topTaskSection.createDiv('ontask-toptask-hero-header');
		topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
		
		// Top task display
		const topTaskDisplay = topTaskSection.createDiv('ontask-toptask-hero-display');
		topTaskDisplay.addClass('ontask-toptask-hero-item');
		
		// Create top task content
		const topTaskContent = topTaskDisplay.createDiv('ontask-toptask-hero-content');
		
		// Top task status display with colors
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { statusSymbol, remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
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
		const topTaskText = topTaskDisplay.createDiv('ontask-toptask-hero-text');
		topTaskText.textContent = remainingText || 'Top Task';
		topTaskText.style.cursor = 'pointer';
		topTaskText.addEventListener('click', () => {
			this.openFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task source
		const topTaskSource = topTaskDisplay.createDiv('ontask-toptask-hero-source');
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
	 * Process top tasks from the displayed tasks (as per spec)
	 * Uses declarative configuration for easy modification of top task priorities
	 */
	private processTopTasksFromDisplayedTasks(): void {
		console.log('OnTask View: Processing top tasks from displayed tasks');
		
		// First, clear any existing top task markers
		this.checkboxes.forEach(checkbox => {
			checkbox.isTopTask = false;
			checkbox.isTopTaskContender = false;
		});
		
		// Find tasks for each priority level using declarative config
		const taskCounts: Record<string, number> = {};
		const tasksByType: Record<string, any[]> = {};
		
		OnTaskView.TOP_TASK_CONFIG.forEach(config => {
			const matchingTasks = this.checkboxes.filter(checkbox => this.isTopTaskByConfig(checkbox, config));
			taskCounts[config.name] = matchingTasks.length;
			tasksByType[config.name] = matchingTasks;
		});
		
		console.log('OnTask View: Found tasks:', taskCounts);
		
		// Find the highest priority task type that has tasks
		let finalTopTask: any = null;
		for (const config of OnTaskView.TOP_TASK_CONFIG) {
			const tasks = tasksByType[config.name];
			if (tasks.length > 0) {
				// Sort by file modification time (most recent first)
				tasks.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				finalTopTask = tasks[0];
				finalTopTask.isTopTask = true;
				console.log(`OnTask View: Selected ${config.name} task as top task:`, finalTopTask.lineContent);
				break;
			}
		}
		
		if (finalTopTask) {
			console.log('OnTask View: Top task selected:', {
				lineContent: finalTopTask.lineContent,
				file: finalTopTask.file?.path,
				isTopTask: finalTopTask.isTopTask
			});
			
			// Emit top task found event for other components to use
			this.eventSystem.emit('top-task:found', {
				topTask: finalTopTask
			});
		} else {
			console.log('OnTask View: No top task found in displayed tasks');
			
			// Emit top task cleared event
			this.eventSystem.emit('top-task:cleared', {});
		}
	}
	
	/**
	 * Generic method to check if a checkbox matches a top task configuration
	 * Uses the declarative config for pattern matching
	 */
	private isTopTaskByConfig(checkbox: any, config: { symbol: string; name: string; pattern: RegExp }): boolean {
		const line = checkbox.lineContent;
		return config.pattern.test(line);
	}

	/**
	 * Create load more button element for optimized rendering
	 */
	private createLoadMoreButtonElement(): HTMLElement {
		const loadMoreSection = document.createElement('div');
		loadMoreSection.className = 'ontask-load-more-section ontask-file-section';
		
		// Create button using vanilla DOM methods instead of createEl
		this.loadMoreButton = document.createElement('button');
		this.loadMoreButton.textContent = 'Load More';
		this.loadMoreButton.className = 'ontask-load-more-button';
		loadMoreSection.appendChild(this.loadMoreButton);
		
		this.loadMoreButton.addEventListener('click', async () => {
			await this.loadMoreTasks();
		});
		
		return loadMoreSection;
	}
}
