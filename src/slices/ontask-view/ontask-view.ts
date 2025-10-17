import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { CheckboxFinderService } from '../checkbox-finder';
import { EventSystem } from '../events';
import { SettingsService } from '../settings';
import { StatusConfigService } from '../settings/status-config';
import { DataService } from '../data/data-service-interface';
import { ContextMenuService } from './services/context-menu-service';
import { TaskLoadingService } from './services/task-loading-service';
import { DOMRenderingService } from './services/dom-rendering-service';
import { TopTaskProcessingService } from './services/top-task-processing-service';
import { EventHandlingService } from './services/event-handling-service';
import { FileOperationsService } from './services/file-operations-service';
import { MobileTouchService } from './services/mobile-touch-service';

export const ONTASK_VIEW_TYPE = 'ontask-view';

export class OnTaskView extends ItemView {
	private checkboxFinderService: CheckboxFinderService;
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private dataService: DataService;
	private plugin: any;
	private eventSystem: EventSystem;
	private contextMenuService: ContextMenuService;
	private taskLoadingService: TaskLoadingService;
	private domRenderingService: DOMRenderingService;
	private topTaskProcessingService: TopTaskProcessingService;
	private eventHandlingService: EventHandlingService;
	private fileOperationsService: FileOperationsService;
	private mobileTouchService: MobileTouchService;
	private checkboxes: any[] = [];
	private refreshTimeout: number | null = null;
	private onlyTodayButton: HTMLButtonElement;
	private isRefreshing: boolean = false;
	private isUpdatingStatus: boolean = false;
	private displayedTasksCount: number = 10; // Will be updated from settings
	private loadMoreButton: HTMLButtonElement | null = null;
	private lastCheckboxContent: Map<string, string> = new Map(); // Track checkbox content to detect actual changes
	


	constructor(
		leaf: WorkspaceLeaf, 
		checkboxFinderService: CheckboxFinderService, 
		settingsService: SettingsService, 
		statusConfigService: StatusConfigService,
		dataService: DataService,
		plugin: any, 
		eventSystem: EventSystem
	) {
		super(leaf);
		this.checkboxFinderService = checkboxFinderService;
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
		this.dataService = dataService;
		this.plugin = plugin;
		this.eventSystem = eventSystem;
		
		// Initialize task loading service
		this.taskLoadingService = new TaskLoadingService(
			this.checkboxFinderService,
			this.settingsService,
			this.statusConfigService,
			this.app
		);
		
		// Initialize context menu service
		this.contextMenuService = new ContextMenuService(
			this.eventSystem,
			this.statusConfigService,
			this.settingsService,
			this.dataService,
			this.contentEl,
			(checkbox: any, newStatus: string) => this.fileOperationsService.updateCheckboxStatus(checkbox, newStatus),
			() => this.refreshCheckboxes(),
			() => this.taskLoadingService.resetTracking()
		);
		
		// Initialize DOM rendering service
		this.domRenderingService = new DOMRenderingService(
			this.statusConfigService,
			this.contextMenuService,
			this.app,
			(filePath: string, lineNumber: number) => this.openFile(filePath, lineNumber),
			(filePath: string) => this.getFileName(filePath),
			(line: string) => this.parseCheckboxLine(line),
			(statusSymbol: string) => this.getStatusDisplayText(statusSymbol),
			(element: HTMLElement, task: any) => this.mobileTouchService.addMobileTouchHandlers(element, task)
		);
		
		// Initialize top task processing service
		this.topTaskProcessingService = new TopTaskProcessingService(this.eventSystem);
		
		// Initialize file operations service
		this.fileOperationsService = new FileOperationsService(
			this.app,
			this.eventSystem,
			this.checkboxes,
			this.isUpdatingStatus,
			() => this.scheduleRefresh()
		);
		
		// Initialize mobile touch service
		this.mobileTouchService = new MobileTouchService(this.contextMenuService);
		
		// Initialize event handling service
		this.eventHandlingService = new EventHandlingService(
			this.eventSystem,
			this.app,
			this.checkboxes,
			this.isUpdatingStatus,
			() => this.refreshCheckboxes(),
			(contentArea: HTMLElement, checkboxes: any[]) => this.domRenderingService.updateTopTaskSection(contentArea, checkboxes),
			(file: any) => this.scheduleDebouncedRefresh(file)
		);
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
		filtersButton.addEventListener('click', () => this.contextMenuService.showFiltersMenu());
		
		this.onlyTodayButton = buttonsContainer.createEl('button', { text: 'Show All' });
		this.onlyTodayButton.addClass('ontask-header-button');
		this.onlyTodayButton.innerHTML = '<svg class="lucide lucide-calendar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Show All';
		this.onlyTodayButton.addEventListener('click', () => this.toggleOnlyToday());
		
		// Create configure button
		const configureButton = buttonsContainer.createEl('button', { text: 'Config' });
		configureButton.addClass('ontask-header-button');
		configureButton.innerHTML = '<svg class="lucide lucide-settings" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> Config';
		configureButton.addEventListener('click', () => this.openSettings());
		
		// Set initial button states
		this.updateButtonStates();
		
		// Create content area
		const contentArea = this.contentEl.createDiv('ontask-content');
		
		// Load initial checkboxes
		await this.refreshCheckboxes();
		
		// Set up event listeners
		this.eventHandlingService.setupEventListeners();
	}

	async onClose(): Promise<void> {
		// Clean up event listeners
		this.eventHandlingService.cleanupEventListeners();
		
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
			this.taskLoadingService.resetTracking();
			
			// Show loading state with progress indication
			const loadingEl = contentArea.createDiv('ontask-loading');
			loadingEl.textContent = 'Loading checkboxes...';
			
			// Initialize file list and tracking for fresh start
			await this.taskLoadingService.initializeFileTracking(settings.onlyShowToday);
			
			// Load tasks with proper filtering and tracking
			this.checkboxes = await this.taskLoadingService.loadTasksWithFiltering(settings);
			console.log('OnTask View: Loaded checkboxes:', this.checkboxes.length);
			
			// Process top tasks from the displayed tasks (as per spec)
			this.topTaskProcessingService.processTopTasksFromDisplayedTasks(this.checkboxes);
			
			console.log('OnTask View: Checkbox details after top task processing:', this.checkboxes.map(cb => ({
				lineContent: cb.lineContent,
				isTopTask: cb.isTopTask,
				file: cb.file?.path
			})));
			
			// Clear loading state
			loadingEl.remove();
			
			// Render checkboxes
			this.domRenderingService.renderCheckboxes(contentArea, this.checkboxes, this.displayedTasksCount);
			
			// Always add Load More button - it will find more tasks if available
			this.loadMoreButton = this.domRenderingService.addLoadMoreButton(contentArea, this.loadMoreButton, () => this.loadMoreTasks());
			
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
				this.domRenderingService.createTopTaskSection(contentArea, topTask);
			}
		} else {
			// If no top task, remove the section if it exists
			if (existingTopTaskSection) {
				existingTopTaskSection.remove();
			}
		}
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
			const topTaskSection = this.domRenderingService.createTopTaskSectionElement(topTask);
			fragment.appendChild(topTaskSection);
		}

		// Group all checkboxes by file (including the top task - it should appear in both the Hero section and list per spec)
		const checkboxesByFile = this.domRenderingService.groupCheckboxesByFile(this.checkboxes);
		
		// Sort files by modification date (latest first)
		const sortedFiles = this.domRenderingService.sortFilesByDate(checkboxesByFile);
		
		// Calculate how many tasks to show based on pagination
		let tasksShown = 0;
		const maxTasksToShow = this.displayedTasksCount;
		
		// Render each file's checkboxes with pagination using batch processing
		const fileSections: HTMLElement[] = [];
		
		for (const [filePath, fileCheckboxes] of sortedFiles) {
			if (tasksShown >= maxTasksToShow) {
				break; // Stop rendering if we've reached the limit
			}
			
			const fileSection = this.domRenderingService.createFileSectionElement(filePath, fileCheckboxes, maxTasksToShow, tasksShown);
			fileSections.push(fileSection);
			
			// Update tasks shown count
			const remainingSlots = maxTasksToShow - tasksShown;
			const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
			tasksShown += tasksToShowFromFile;
		}
		
		// Append all file sections to fragment
		fileSections.forEach(section => fragment.appendChild(section));
		
		// Always show Load More button - it will find more tasks if available
		const loadMoreSection = this.domRenderingService.createLoadMoreButtonElement(() => this.loadMoreTasks());
		fragment.appendChild(loadMoreSection);
		
		// Append fragment to content area in one operation
		contentArea.appendChild(fragment);
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
		const additionalTasks = await this.taskLoadingService.loadTasksWithFiltering(settings);
		
		// Add new tasks to existing ones
		this.checkboxes.push(...additionalTasks);
		
		// Update displayed count
		this.displayedTasksCount += additionalTasks.length;
		
		// Render the additional tasks
		this.domRenderingService.renderAdditionalTasks(contentArea, additionalTasks.map(task => ({
			checkbox: task,
			filePath: task.file?.path || ''
		})));
		
		// Always add Load More button - it will find more tasks if available
		this.loadMoreButton = this.domRenderingService.addLoadMoreButton(contentArea, this.loadMoreButton, () => this.loadMoreTasks());
		
		console.log(`OnTask View: Loaded ${additionalTasks.length} additional tasks. Total shown: ${this.displayedTasksCount} of ${this.checkboxes.length}`);
		console.log(`OnTask View: Current position - file ${this.taskLoadingService.getCurrentFileIndex()}, task ${this.taskLoadingService.getCurrentTaskIndex()}`);
	}






	/**
	 * Centralized method for displaying status symbols consistently across the plugin
	 * @param statusSymbol The raw status symbol from the checkbox
	 * @returns The display text for the status symbol
	 */
	private getStatusDisplayText(statusSymbol: string): string {
		return statusSymbol;
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
				promises.push(this.fileOperationsService.updateCheckboxStatus(checkboxData, selectedStatus));
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
				this.onlyTodayButton.innerHTML = '<svg class="lucide lucide-calendar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Today';
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
}
