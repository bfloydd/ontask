import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Logger } from '../logging/Logger';
import { EventSystem } from '../events';
import { SettingsService } from '../settings';
import { StatusConfigService } from '../settings/status-config';
import { DataService } from '../data/DataServiceInterface';
import { ContextMenuService } from './services/ContextMenuService';
import { TaskLoadingService } from './services/TaskLoadingService';
import { DOMRenderingService } from './services/DOMRenderingService';
import { TopTaskProcessingService } from './services/TopTaskProcessingService';
import { EventHandlingService } from './services/EventHandlingService';
import { FileOperationsService } from './services/FileOperationsService';
import { MobileTouchService } from './services/MobileTouchService';
import { ScrollToTopService } from './services/ScrollToTopService';
import { IconService } from '../../shared/icon-service';
import { OnTaskViewHelpers } from './OnTaskViewHelpers';
import { OnTaskViewFiltering } from './OnTaskViewFiltering';
import { OnTaskViewDateControls } from './OnTaskViewDateControls';

export const ONTASK_VIEW_TYPE = 'ontask-view';

export class OnTaskViewImpl extends ItemView {
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private dataService: DataService;
	private plugin: any;
	private eventSystem: EventSystem;
	private logger: Logger;
	private contextMenuService: ContextMenuService;
	private taskLoadingService: TaskLoadingService;
	private domRenderingService: DOMRenderingService;
	private topTaskProcessingService: TopTaskProcessingService;
	private eventHandlingService: EventHandlingService;
	private fileOperationsService: FileOperationsService;
	private mobileTouchService: MobileTouchService;
	private scrollToTopService: ScrollToTopService;
	private helpers: OnTaskViewHelpers;
	private filtering: OnTaskViewFiltering;
	private dateControls: OnTaskViewDateControls;
	private checkboxes: any[] = [];
	private refreshTimeout: number | null = null;
	private isRefreshing: boolean = false;
	private isUpdatingStatus: boolean = false;
	private displayedTasksCount: number = 10;
	private loadMoreButton: HTMLButtonElement | null = null;
	private lastCheckboxContent: Map<string, string> = new Map(); 
	private currentFilter: string = '';
	private isSearchFilterVisible: boolean = false;
	


	constructor(
		leaf: WorkspaceLeaf, 
		taskLoadingService: TaskLoadingService, 
		settingsService: SettingsService, 
		statusConfigService: StatusConfigService,
		dataService: DataService,
		plugin: any, 
		eventSystem: EventSystem,
		logger: Logger
	) {
		super(leaf);
		this.taskLoadingService = taskLoadingService;
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
		this.dataService = dataService;
		this.plugin = plugin;
		this.eventSystem = eventSystem;
		this.logger = logger;
		
		this.contextMenuService = new ContextMenuService(
			this.app,
			this.eventSystem,
			this.statusConfigService,
			this.settingsService,
			this.dataService,
			this.contentEl,
			(checkbox: any, newStatus: string) => this.fileOperationsService.updateCheckboxStatus(
				checkbox, 
				newStatus, 
				(newLineContent: string) => this.updateCheckboxRowInPlace(checkbox, newLineContent)
			),
			() => this.refreshCheckboxes(),
			() => this.taskLoadingService.resetTracking(),
			this.plugin
		);
		
		this.domRenderingService = new DOMRenderingService(
			this.statusConfigService,
			this.contextMenuService,
			this.settingsService,
			this.app,
			(filePath: string, lineNumber: number) => this.helpers.openFile(filePath, lineNumber),
			(filePath: string) => this.helpers.getFileName(filePath),
			(line: string) => this.helpers.parseCheckboxLine(line),
			(statusSymbol: string) => this.helpers.getStatusDisplayText(statusSymbol),
			(element: HTMLElement, task: any) => this.mobileTouchService.addMobileTouchHandlers(element, task)
		);
		
		this.topTaskProcessingService = new TopTaskProcessingService(this.eventSystem, this.logger, this.statusConfigService);
		
		this.fileOperationsService = new FileOperationsService(
			this.app,
			this.eventSystem,
			this.checkboxes,
			this.isUpdatingStatus,
			() => this.scheduleRefresh(),
			this.logger
		);
		
		this.mobileTouchService = new MobileTouchService(this.contextMenuService);
		
		this.scrollToTopService = new ScrollToTopService(this.eventSystem, this.app);
		
		this.helpers = new OnTaskViewHelpers(
			this.app,
			this.statusConfigService,
			this.settingsService,
			this.taskLoadingService,
			this.logger
		);
		
		this.filtering = new OnTaskViewFiltering(
			this.contentEl,
			(line: string) => this.helpers.parseCheckboxLine(line)
		);
		
		this.dateControls = new OnTaskViewDateControls(
			this.settingsService,
			this.eventSystem,
			this.logger
		);
		
		this.eventHandlingService = new EventHandlingService(
			this.eventSystem,
			this.app,
			this.checkboxes,
			this.isUpdatingStatus,
			() => this.refreshCheckboxes(),
			(contentArea: HTMLElement, checkboxes: any[]) => this.domRenderingService.updateTopTaskSection(contentArea, checkboxes),
			(file: any) => this.scheduleDebouncedRefresh(file),
			this.logger
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
		
		// Left button group
		const leftButtonsContainer = header.createDiv('ontask-buttons-left');
		this.dateControls.createDateFilterControl(leftButtonsContainer, () => this.refreshCheckboxes());
		
		// Right button group
		const rightButtonsContainer = header.createDiv('ontask-buttons-right');
		const searchButton = rightButtonsContainer.createEl('button');
		searchButton.addClass('ontask-header-button');
		searchButton.innerHTML = IconService.getIcon('search');
		searchButton.title = 'Search Tasks';
		searchButton.addEventListener('click', () => this.toggleSearchFilter(), { passive: true });
		
		const filtersButton = rightButtonsContainer.createEl('button');
		filtersButton.addClass('ontask-header-button');
		filtersButton.innerHTML = IconService.getIcon('filter');
		filtersButton.title = 'Filter Statuses';
		filtersButton.addEventListener('click', () => this.contextMenuService.showFiltersMenu(), { passive: true });
		
		const refreshButton = rightButtonsContainer.createEl('button');
		refreshButton.addClass('ontask-header-button');
		refreshButton.innerHTML = IconService.getIcon('refresh-cw');
		refreshButton.title = 'Refresh';
		refreshButton.addEventListener('click', () => this.refreshCheckboxes(), { passive: true });
		
		const configureButton = rightButtonsContainer.createEl('button');
		configureButton.addClass('ontask-header-button');
		configureButton.innerHTML = IconService.getIcon('settings');
		configureButton.title = 'Settings';
		configureButton.addEventListener('click', () => this.openSettings(), { passive: true });
		
		this.dateControls.updateDateFilterState();
		
		const contentArea = this.contentEl.createDiv('ontask-content');
		
		await this.refreshCheckboxes();
		this.eventHandlingService.setupEventListeners();
		
		this.scrollToTopService.initialize(this.contentEl);
	}

	async onClose(): Promise<void> {
		this.eventHandlingService.cleanupEventListeners();
		
		this.scrollToTopService.destroy();
		
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	private onFilterChange(filter: string): void {
		this.filtering.onFilterChange(filter, (newFilter: string) => {
			this.currentFilter = newFilter;
		});
	}

	private clearFilter(): void {
		this.filtering.clearFilter((newFilter: string) => {
			this.currentFilter = newFilter;
		});
	}

	private toggleSearchFilter(): void {
		this.isSearchFilterVisible = this.filtering.toggleSearchFilter(
			this.isSearchFilterVisible,
			() => this.clearFilter()
		);
	}

	async refreshCheckboxes(): Promise<void> {
		if (this.isRefreshing) {
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
			loadingEl.textContent = 'Loading tasks...';
			
			const onlyShowToday = settings.dateFilter === 'today';
			await this.taskLoadingService.initializeFileTracking(onlyShowToday);
			const result = await this.taskLoadingService.loadTasksWithFiltering(settings);
			this.checkboxes = result.tasks;
			this.topTaskProcessingService.processTopTasksFromDisplayedTasks(this.checkboxes);
			
			loadingEl.remove();
			
			this.domRenderingService.renderCheckboxes(contentArea, this.checkboxes, this.displayedTasksCount, this.currentFilter, (filter: string) => this.onFilterChange(filter), () => this.clearFilter(), () => this.loadMoreTasks(), onlyShowToday);
			
			this.dateControls.updateDateFilterState();
			this.initializeCheckboxContentTracking();
			
			this.logger.debug('[OnTask View] Emitting view:refreshed event with', this.checkboxes.length, 'checkboxes');
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
				errorEl.textContent = 'Error loading tasks. Please try again.';
			}
		} finally {
			this.isRefreshing = false;
		}
	}

	private updateCheckboxRowInPlace(checkbox: any, newLineContent: string): void {
		try {
			const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
			if (!contentArea) {
				this.logger.debug('[OnTask View] Content area not found for in-place update, falling back to refresh');
				this.scheduleRefresh();
				return;
			}

			// Store the previous top task to detect changes
			const previousTopTask = this.checkboxes.find(cb => cb.isTopTask);

			// Update the checkbox object's lineContent
			checkbox.lineContent = newLineContent;

			// Find the DOM element using data attributes
			const filePath = checkbox.file?.path || '';
			const lineNumber = checkbox.lineNumber?.toString() || '';
			// Use querySelector with proper escaping for file paths that may contain special characters
			const allCheckboxItems = contentArea.querySelectorAll('.ontask-checkbox-item');
			let checkboxElement: HTMLElement | null = null;
			for (const item of Array.from(allCheckboxItems)) {
				const itemPath = item.getAttribute('data-file-path');
				const itemLineNumber = item.getAttribute('data-line-number');
				if (itemPath === filePath && itemLineNumber === lineNumber) {
					checkboxElement = item as HTMLElement;
					break;
				}
			}

			if (!checkboxElement) {
				this.logger.debug('[OnTask View] Checkbox element not found for in-place update, falling back to refresh');
				this.scheduleRefresh();
				return;
			}

			// Re-process top tasks to determine if top task has changed
			this.topTaskProcessingService.processTopTasksFromDisplayedTasks(this.checkboxes);
			const newTopTask = this.checkboxes.find(cb => cb.isTopTask);
			const topTaskChanged = previousTopTask !== newTopTask;

			// Parse the new line content
			const { statusSymbol, remainingText } = this.helpers.parseCheckboxLine(newLineContent);
			
			// Ensure topTaskRanking is cleared if the checkbox no longer matches any ranked status
			// (processTopTasksFromDisplayedTasks only sets it on matching tasks, but doesn't clear it from non-matching ones)
			const rankedConfigs = this.topTaskProcessingService.getTopTaskConfig();
			const matchesRankedStatus = rankedConfigs.some(config => 
				this.topTaskProcessingService.isTopTaskByConfig(checkbox, config)
			);
			if (!matchesRankedStatus) {
				checkbox.topTaskRanking = undefined;
			}

			// Update the status display element
			const statusDisplay = checkboxElement.querySelector('.ontask-checkbox-display') as HTMLElement;
			if (statusDisplay) {
				statusDisplay.setAttribute('data-status', statusSymbol);
				statusDisplay.textContent = this.helpers.getStatusDisplayText(statusSymbol);

				// Update colors from status config
				const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
				const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
				const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);

				if (statusConfig) {
					statusDisplay.style.setProperty('--ontask-status-color', statusColor);
					statusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);

					// Handle dynamic styling attributes
					// Always apply dynamic color since CSS variables are set for all statuses
					statusDisplay.setAttribute('data-dynamic-color', 'true');
				}

				// Handle data-custom-status attribute based on built-in status
				// This should be outside the statusConfig check since isBuiltInStatus doesn't depend on it
				if (!StatusConfigService.isBuiltInStatus(statusSymbol)) {
					statusDisplay.setAttribute('data-custom-status', 'true');
				} else {
					statusDisplay.removeAttribute('data-custom-status');
				}
			}

			// Update checkbox element's top task class
			if (checkbox.isTopTask) {
				checkboxElement.addClass('ontask-toptask-hero');
			} else {
				checkboxElement.removeClass('ontask-toptask-hero');
			}

			// Update the task text element
			const textEl = checkboxElement.querySelector('.ontask-checkbox-text') as HTMLElement;
			if (textEl) {
				textEl.textContent = remainingText || 'Task';
				// Remove existing ranking badge if any
				const existingRanking = textEl.querySelector('.ontask-task-ranking');
				if (existingRanking) {
					existingRanking.remove();
				}
				// Add ranking badge if task has topTaskRanking
				if (checkbox.topTaskRanking !== undefined) {
					const rankingElement = document.createElement('span');
					rankingElement.textContent = `Rank ${checkbox.topTaskRanking}`;
					rankingElement.addClass('ontask-task-ranking');
					rankingElement.setAttribute('data-rank', checkbox.topTaskRanking.toString());
					textEl.appendChild(rankingElement);
				}
			}

			// Update top task section if top task changed or if this is the current top task
			if (topTaskChanged || checkbox.isTopTask) {
				this.domRenderingService.updateTopTaskSection(contentArea, this.checkboxes);
			}

			// If top task changed, update both the previous and new top task elements
			if (topTaskChanged) {
				// Update the previous top task element (if it exists and isn't the current checkbox)
				if (previousTopTask && previousTopTask !== checkbox) {
					const previousTopTaskFilePath = previousTopTask.file?.path || '';
					const previousTopTaskLineNumber = previousTopTask.lineNumber?.toString() || '';
					for (const item of Array.from(allCheckboxItems)) {
						const itemPath = item.getAttribute('data-file-path');
						const itemLineNumber = item.getAttribute('data-line-number');
						if (itemPath === previousTopTaskFilePath && itemLineNumber === previousTopTaskLineNumber) {
							const previousTopTaskElement = item as HTMLElement;
							previousTopTaskElement.removeClass('ontask-toptask-hero');
							// Remove ranking badge if it exists
							const prevTextEl = previousTopTaskElement.querySelector('.ontask-checkbox-text') as HTMLElement;
							if (prevTextEl) {
								const prevRanking = prevTextEl.querySelector('.ontask-task-ranking');
								if (prevRanking) {
									prevRanking.remove();
								}
							}
							break;
						}
					}
				}

				// Update the new top task element (if it exists and isn't the current checkbox)
				if (newTopTask && newTopTask !== checkbox) {
					const newTopTaskFilePath = newTopTask.file?.path || '';
					const newTopTaskLineNumber = newTopTask.lineNumber?.toString() || '';
					for (const item of Array.from(allCheckboxItems)) {
						const itemPath = item.getAttribute('data-file-path');
						const itemLineNumber = item.getAttribute('data-line-number');
						if (itemPath === newTopTaskFilePath && itemLineNumber === newTopTaskLineNumber) {
							const newTopTaskElement = item as HTMLElement;
							newTopTaskElement.addClass('ontask-toptask-hero');
							// Add ranking badge if task has topTaskRanking
							const newTextEl = newTopTaskElement.querySelector('.ontask-checkbox-text') as HTMLElement;
							if (newTextEl && newTopTask.topTaskRanking !== undefined) {
								// Remove existing ranking badge if any
								const existingRanking = newTextEl.querySelector('.ontask-task-ranking');
								if (existingRanking) {
									existingRanking.remove();
								}
								const rankingElement = document.createElement('span');
								rankingElement.textContent = `Rank ${newTopTask.topTaskRanking}`;
								rankingElement.addClass('ontask-task-ranking');
								rankingElement.setAttribute('data-rank', newTopTask.topTaskRanking.toString());
								newTextEl.appendChild(rankingElement);
							}
							break;
						}
					}
				}
			}

			// Update content tracking
			const checkboxKey = `${filePath}:${lineNumber}`;
			this.lastCheckboxContent.set(checkboxKey, newLineContent.trim());

			this.logger.debug('[OnTask View] Successfully updated checkbox row in-place for', filePath, 'line', lineNumber);
		} catch (error) {
			console.error('OnTask View: Error updating checkbox row in-place:', error);
			// Fall back to full refresh on error
			this.scheduleRefresh();
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
					const { statusSymbol } = this.helpers.parseCheckboxLine(topTask.lineContent);
					topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
					topTaskStatusDisplay.textContent = this.helpers.getStatusDisplayText(statusSymbol);
				}
				
				const topTaskText = existingTopTaskSection.querySelector('.ontask-toptask-hero-text');
				if (topTaskText) {
					const { remainingText } = this.helpers.parseCheckboxLine(topTask.lineContent);
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





	private async loadMoreTasks(): Promise<void> {
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			console.error('Content area not found');
			return;
		}
		
		// Remove existing load more button immediately
		const existingLoadMoreSection = contentArea.querySelector('.ontask-load-more-section');
		if (existingLoadMoreSection) {
			existingLoadMoreSection.remove();
		}
		
		// Show loading indicator
		const loadingSection = this.domRenderingService.createLoadingIndicatorElement();
		contentArea.appendChild(loadingSection);
		
		const settings = this.settingsService.getSettings();
		const result = await this.taskLoadingService.loadTasksWithFiltering(settings);
		
		this.checkboxes.push(...result.tasks);
		this.displayedTasksCount += result.tasks.length;
		
		this.domRenderingService.renderAdditionalTasks(contentArea, result.tasks.map(task => ({
			checkbox: task,
			filePath: task.file?.path || ''
		})));
		
		// Apply current filter to newly loaded tasks
		if (this.currentFilter.trim() !== '') {
			this.filtering.applyFilter(this.currentFilter);
		}
		
		// Remove loading indicator
		const loadingIndicator = contentArea.querySelector('.ontask-load-more-section');
		if (loadingIndicator) {
			loadingIndicator.remove();
		}
		
		// Add appropriate indicator based on whether there are more tasks
		if (settings.dateFilter !== 'today') {
			if (result.hasMoreTasks) {
				const loadMoreSection = this.domRenderingService.createLoadMoreButtonElement(() => this.loadMoreTasks());
				contentArea.appendChild(loadMoreSection);
			} else {
				const noMoreSection = this.domRenderingService.createNoMoreTasksIndicatorElement();
				contentArea.appendChild(noMoreSection);
			}
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
						}
						this.lastCheckboxContent.set(checkboxKey, currentLine);
					}
				}
			}
			
			if (hasCheckboxChanges) {
				this.logger.debug('[OnTask View] Emitting file:modified event for', file.path);
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
		
	}

	private showStatusSelectionForCheckboxes(selectedStatus: string): void {
		
		const checkboxElements = this.contentEl.querySelectorAll('.ontask-checkbox-item');
		const promises: Promise<void>[] = [];
		
		for (const checkboxEl of Array.from(checkboxElements)) {
			const checkboxData = this.checkboxes.find(cb => {
				const textEl = checkboxEl.querySelector('.ontask-checkbox-text');
				return textEl && textEl.textContent === cb.lineContent;
			});
			
			if (checkboxData) {
				promises.push(this.fileOperationsService.updateCheckboxStatus(
					checkboxData, 
					selectedStatus,
					(newLineContent: string) => this.updateCheckboxRowInPlace(checkboxData, newLineContent)
				));
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
		return this.filtering.applyStatusFilters(checkboxes, statusFilters);
	}
}
