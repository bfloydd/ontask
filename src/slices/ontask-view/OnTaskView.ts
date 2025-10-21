import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { MarkdownView } from 'obsidian';
import { EventSystem } from '../events';
import { SettingsService } from '../settings';
import { StatusConfigService } from '../settings/status-config';
import { DataService } from '../data/DataServiceInterface';
import { ContextMenuService } from './services/context-menu-service';
import { TaskLoadingService } from './services/task-loading-service';
import { DOMRenderingService } from './services/dom-rendering-service';
import { TopTaskProcessingService } from './services/top-task-processing-service';
import { EventHandlingService } from './services/event-handling-service';
import { FileOperationsService } from './services/file-operations-service';
import { MobileTouchService } from './services/mobile-touch-service';

export const ONTASK_VIEW_TYPE = 'ontask-view';

export class OnTaskViewImpl extends ItemView {
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
		taskLoadingService: TaskLoadingService, 
		settingsService: SettingsService, 
		statusConfigService: StatusConfigService,
		dataService: DataService,
		plugin: any, 
		eventSystem: EventSystem
	) {
		super(leaf);
		this.taskLoadingService = taskLoadingService;
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
		this.dataService = dataService;
		this.plugin = plugin;
		this.eventSystem = eventSystem;
		
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
		
		this.topTaskProcessingService = new TopTaskProcessingService(this.eventSystem);
		
		this.fileOperationsService = new FileOperationsService(
			this.app,
			this.eventSystem,
			this.checkboxes,
			this.isUpdatingStatus,
			() => this.scheduleRefresh()
		);
		
		this.mobileTouchService = new MobileTouchService(this.contextMenuService);
		
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
		
		const header = this.contentEl.createDiv('ontask-header');
		const buttonsContainer = header.createDiv('ontask-buttons-container');
		
		const refreshButton = buttonsContainer.createEl('button', { text: 'Refresh' });
		refreshButton.addClass('ontask-header-button');
		refreshButton.innerHTML = '<svg class="lucide lucide-refresh-cw" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg> Refresh';
		refreshButton.addEventListener('click', () => this.refreshCheckboxes());
		
		const filtersButton = buttonsContainer.createEl('button', { text: 'Filters' });
		filtersButton.addClass('ontask-header-button');
		filtersButton.innerHTML = '<svg class="lucide lucide-filter" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg> Filters';
		filtersButton.addEventListener('click', () => this.contextMenuService.showFiltersMenu());
		
		this.onlyTodayButton = buttonsContainer.createEl('button', { text: 'Show All' });
		this.onlyTodayButton.addClass('ontask-header-button');
		this.onlyTodayButton.innerHTML = '<svg class="lucide lucide-calendar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Show All';
		this.onlyTodayButton.addEventListener('click', () => this.toggleOnlyToday());
		
		const configureButton = buttonsContainer.createEl('button', { text: 'Config' });
		configureButton.addClass('ontask-header-button');
		configureButton.innerHTML = '<svg class="lucide lucide-settings" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> Config';
		configureButton.addEventListener('click', () => this.openSettings());
		
		this.updateButtonStates();
		
		const contentArea = this.contentEl.createDiv('ontask-content');
		
		await this.refreshCheckboxes();
		this.eventHandlingService.setupEventListeners();
	}

	async onClose(): Promise<void> {
		this.eventHandlingService.cleanupEventListeners();
		
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	async refreshCheckboxes(): Promise<void> {
		console.log('OnTask View: refreshCheckboxes called');
		if (this.isRefreshing) {
			console.log('OnTask View: Already refreshing, skipping');
			return;
		}
		
		this.isRefreshing = true;
		
		try {
			const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
			if (!contentArea) {
				console.error('Content area not found');
				return;
			}
			
			contentArea.empty();
			
			const settings = this.settingsService.getSettings();
			this.displayedTasksCount = settings.loadMoreLimit;
			this.loadMoreButton = null;
			
			this.taskLoadingService.resetTracking();
			
			const loadingEl = contentArea.createDiv('ontask-loading');
			loadingEl.textContent = 'Loading checkboxes...';
			
			await this.taskLoadingService.initializeFileTracking(settings.onlyShowToday);
			this.checkboxes = await this.taskLoadingService.loadTasksWithFiltering(settings);
			console.log('OnTask View: Loaded checkboxes:', this.checkboxes.length);
			
			this.topTaskProcessingService.processTopTasksFromDisplayedTasks(this.checkboxes);
			
			console.log('OnTask View: Checkbox details after top task processing:', this.checkboxes.map(cb => ({
				lineContent: cb.lineContent,
				isTopTask: cb.isTopTask,
				file: cb.file?.path
			})));
			
			loadingEl.remove();
			
			this.domRenderingService.renderCheckboxes(contentArea, this.checkboxes, this.displayedTasksCount);
			this.loadMoreButton = this.domRenderingService.addLoadMoreButton(contentArea, this.loadMoreButton, () => this.loadMoreTasks());
			this.updateButtonStates();
			this.initializeCheckboxContentTracking();
			
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
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			console.error('Content area not found for top task update');
			return;
		}
		
		const existingTopTaskSection = contentArea.querySelector('.ontask-toptask-hero-section');
		const topTask = this.checkboxes.find(checkbox => checkbox.isTopTask);
		
		if (topTask) {
			if (existingTopTaskSection) {
				const topTaskStatusDisplay = existingTopTaskSection.querySelector('.ontask-checkbox-display');
				if (topTaskStatusDisplay) {
					const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
					topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
					topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
				}
				
				const topTaskText = existingTopTaskSection.querySelector('.ontask-toptask-hero-text');
				if (topTaskText) {
					const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
					topTaskText.textContent = remainingText || 'Top Task';
				}
				
			} else {
				this.domRenderingService.createTopTaskSection(contentArea, topTask);
			}
		} else {
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
		return fileName.replace(/\.md$/i, '');
	}

	private async handleStreamUpdate(filePath: string): Promise<void> {
		try {
			const settings = this.settingsService.getSettings();
			if (settings.checkboxSource !== 'streams') {
				console.log(`OnTask: Streams not active checkbox source (current: ${settings.checkboxSource}), skipping stream detection`);
				return;
			}

			const streamsService = this.taskLoadingService.getStreamsService();
			
			if (!streamsService || !streamsService.isStreamsPluginAvailable()) {
				console.log('OnTask: Streams plugin not available, skipping stream detection');
				return;
			}

			const stream = streamsService.isFileInStream(filePath);
			if (stream) {
				console.log(`OnTask: File ${filePath} is in stream "${stream.name}"`);
				
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
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		
		this.refreshTimeout = window.setTimeout(() => {
			if (!this.isRefreshing) {
				this.refreshCheckboxes();
			}
		}, 500);
	}

	private scheduleDebouncedRefresh(file: any): void {
		this.checkForCheckboxChanges(file);
	}

	private async checkForCheckboxChanges(file: any): Promise<void> {
		try {
			const fileCheckboxes = this.checkboxes.filter(checkbox => checkbox.file?.path === file.path);
			if (fileCheckboxes.length === 0) {
				return;
			}
			
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			let hasCheckboxChanges = false;
			
			for (const checkbox of fileCheckboxes) {
				const lineIndex = checkbox.lineNumber - 1;
				if (lineIndex >= 0 && lineIndex < lines.length) {
					const currentLine = lines[lineIndex].trim();
					const checkboxKey = `${file.path}:${checkbox.lineNumber}`;
					const lastContent = this.lastCheckboxContent.get(checkboxKey);
					
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
						this.lastCheckboxContent.set(checkboxKey, currentLine);
					}
				}
			}
			
			if (hasCheckboxChanges) {
				console.log('OnTask View: Checkbox changes detected, refreshing view');
				this.eventSystem.emit('file:modified', { path: file.path });
				this.refreshCheckboxes();
			}
		} catch (error) {
			console.error('OnTask View: Error checking for checkbox changes:', error);
			this.refreshCheckboxes();
		}
	}

	private initializeCheckboxContentTracking(): void {
		this.lastCheckboxContent.clear();
		
		for (const checkbox of this.checkboxes) {
			const checkboxKey = `${checkbox.file.path}:${checkbox.lineNumber}`;
			this.lastCheckboxContent.set(checkboxKey, checkbox.lineContent?.trim() || '');
		}
		
		console.log(`OnTask View: Initialized content tracking for ${this.checkboxes.length} checkboxes`);
	}

	private showStatusSelectionForCheckboxes(selectedStatus: string): void {
		console.log('OnTask View: Status selection for checkboxes', selectedStatus);
		
		const checkboxElements = this.contentEl.querySelectorAll('.ontask-checkbox-item');
		const promises: Promise<void>[] = [];
		
		for (const checkboxEl of Array.from(checkboxElements)) {
			const checkboxData = this.checkboxes.find(cb => {
				const textEl = checkboxEl.querySelector('.ontask-checkbox-text');
				return textEl && textEl.textContent === cb.lineContent;
			});
			
			if (checkboxData) {
				promises.push(this.fileOperationsService.updateCheckboxStatus(checkboxData, selectedStatus));
			}
		}
		
		Promise.all(promises).then(() => {
			this.refreshCheckboxes();
		});
	}


	private openSettings(): void {
		(this.app as any).setting.open();
		(this.app as any).setting.openTabById(this.plugin.manifest.id);
	}










	private applyStatusFilters(checkboxes: any[], statusFilters: Record<string, boolean>): any[] {
		if (!statusFilters) {
			return checkboxes;
		}

		return checkboxes.filter(checkbox => {
			const { statusSymbol } = this.parseCheckboxLine(checkbox.lineContent);
			return statusFilters[statusSymbol] !== false;
		});
	}

	private async toggleOnlyToday(): Promise<void> {
		const settings = this.settingsService.getSettings();
		const newValue = !settings.onlyShowToday;
		await this.settingsService.updateSetting('onlyShowToday', newValue);
		this.updateButtonStates();
		this.refreshCheckboxes();
	}

	private toggleTopTaskVisibility(): void {
		this.eventSystem.emit('ui:toggle-top-task-visibility', {});
	}

	private updateButtonStates(): void {
		const settings = this.settingsService.getSettings();
		
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
		
		const bracketIndex = trimmedLine.indexOf(']');
		if (bracketIndex !== -1) {
			const statusSymbol = trimmedLine.substring(0, bracketIndex).replace(/^-\s*\[/, '').trim() || this.getToDoSymbol();
			const remainingText = trimmedLine.substring(bracketIndex + 1).trim();
			return { statusSymbol, remainingText };
		}
		
		return { statusSymbol: this.getToDoSymbol(), remainingText: trimmedLine };
	}

	private getToDoSymbol(): string {
		const statusConfigs = this.statusConfigService.getStatusConfigs();
		const toDoConfig = statusConfigs.find(config => config.name === 'To-do');
		return toDoConfig?.symbol || ' ';
	}
}
