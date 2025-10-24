import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { Logger } from '../logging/Logger';
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
	private logger: Logger;
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
	private currentFilter: string = '';
	


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
			this.settingsService,
			this.app,
			(filePath: string, lineNumber: number) => this.openFile(filePath, lineNumber),
			(filePath: string) => this.getFileName(filePath),
			(line: string) => this.parseCheckboxLine(line),
			(statusSymbol: string) => this.getStatusDisplayText(statusSymbol),
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
		const buttonsContainer = header.createDiv('ontask-buttons-container');
		
		const refreshButton = buttonsContainer.createEl('button', { text: 'Refresh' });
		refreshButton.addClass('ontask-header-button');
		refreshButton.innerHTML = '<svg class="lucide lucide-refresh-cw" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg> Refresh';
		refreshButton.addEventListener('click', () => this.refreshCheckboxes(), { passive: true });
		
		const filtersButton = buttonsContainer.createEl('button', { text: 'Filters' });
		filtersButton.addClass('ontask-header-button');
		filtersButton.innerHTML = '<svg class="lucide lucide-filter" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg> Filters';
		filtersButton.addEventListener('click', () => this.contextMenuService.showFiltersMenu(), { passive: true });
		
		this.onlyTodayButton = buttonsContainer.createEl('button', { text: 'Show All' });
		this.onlyTodayButton.addClass('ontask-header-button');
		this.onlyTodayButton.innerHTML = '<svg class="lucide lucide-calendar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Show All';
		this.onlyTodayButton.addEventListener('click', () => this.toggleOnlyToday(), { passive: true });
		
		const configureButton = buttonsContainer.createEl('button', { text: 'Config' });
		configureButton.addClass('ontask-header-button');
		configureButton.innerHTML = '<svg class="lucide lucide-settings" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> Config';
		configureButton.addEventListener('click', () => this.openSettings(), { passive: true });
		
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

	private onFilterChange(filter: string): void {
		this.currentFilter = filter;
		this.applyFilter();
	}

	private clearFilter(): void {
		this.currentFilter = '';
		this.applyFilter();
	}

	private applyFilter(): void {
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) return;

		// Get all task elements (excluding top task and filter sections)
		const taskElements = contentArea.querySelectorAll('.ontask-file-section:not(.ontask-toptask-hero-section):not(.ontask-filter-section)');
		
		if (this.currentFilter.trim() === '') {
			// Show all tasks
			taskElements.forEach(element => {
				(element as HTMLElement).style.display = '';
			});
		} else {
			// Filter tasks based on content
			const filterText = this.currentFilter.toLowerCase();
			taskElements.forEach(element => {
				const taskElement = element as HTMLElement;
				const taskText = taskElement.textContent?.toLowerCase() || '';
				const shouldShow = taskText.includes(filterText);
				taskElement.style.display = shouldShow ? '' : 'none';
			});
		}
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
			loadingEl.textContent = 'Loading checkboxes...';
			
			await this.taskLoadingService.initializeFileTracking(settings.onlyShowToday);
			this.checkboxes = await this.taskLoadingService.loadTasksWithFiltering(settings);
			this.topTaskProcessingService.processTopTasksFromDisplayedTasks(this.checkboxes);
			
			loadingEl.remove();
			
			this.domRenderingService.renderCheckboxes(contentArea, this.checkboxes, this.displayedTasksCount, this.currentFilter, (filter: string) => this.onFilterChange(filter), () => this.clearFilter(), () => this.loadMoreTasks(), settings.onlyShowToday);
			
			this.updateButtonStates();
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
				errorEl.textContent = 'Error loading checkboxes. Please try again.';
			}
		} finally {
			this.isRefreshing = false;
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





	private async loadMoreTasks(): Promise<void> {
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			console.error('Content area not found');
			return;
		}
		
		// Remove existing load more button
		const existingLoadMoreSection = contentArea.querySelector('.ontask-load-more-section');
		if (existingLoadMoreSection) {
			existingLoadMoreSection.remove();
		}
		
		const settings = this.settingsService.getSettings();
		const additionalTasks = await this.taskLoadingService.loadTasksWithFiltering(settings);
		
		this.checkboxes.push(...additionalTasks);
		this.displayedTasksCount += additionalTasks.length;
		
		this.domRenderingService.renderAdditionalTasks(contentArea, additionalTasks.map(task => ({
			checkbox: task,
			filePath: task.file?.path || ''
		})));
		
		// Add new load more button if there are more tasks to load
		if (!settings.onlyShowToday) {
			const loadMoreSection = this.domRenderingService.createLoadMoreButtonElement(() => this.loadMoreTasks());
			contentArea.appendChild(loadMoreSection);
		}
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
			await this.handleStreamUpdate(filePath);
			
			this.app.workspace.openLinkText(filePath, '');
			
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
				return;
			}

			const streamsService = this.taskLoadingService.getStreamsService();
			
			if (!streamsService || !streamsService.isStreamsPluginAvailable()) {
				return;
			}

			const stream = streamsService.isFileInStream(filePath);
			if (stream) {
				
				const success = await streamsService.updateStreamBarFromFile(filePath);
				
				if (success) {
				} else {
					this.logger.warn(`OnTask: Failed to update stream bar from file ${filePath}`);
				}
			} else {
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
		this.logger.debug('[OnTask View] Emitting ui:toggle-top-task-visibility event');
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
