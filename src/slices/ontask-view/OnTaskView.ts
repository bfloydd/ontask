import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
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
import { CheckboxContentTrackingService } from './services/CheckboxContentTrackingService';
import { ViewHeaderService } from './services/ViewHeaderService';
import { ViewRefreshService } from './services/ViewRefreshService';
import { CheckboxUpdateService } from './services/CheckboxUpdateService';
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
	private contentTrackingService: CheckboxContentTrackingService;
	private viewHeaderService: ViewHeaderService;
	private viewRefreshService: ViewRefreshService;
	private checkboxUpdateService: CheckboxUpdateService;
	private checkboxes: any[] = [];
	private isUpdatingStatus: boolean = false;
	private displayedTasksCount: number = 10;
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
		
		this.helpers = new OnTaskViewHelpers(
			this.app,
			this.statusConfigService,
			this.settingsService,
			this.taskLoadingService,
			this.logger
		);
		
		this.topTaskProcessingService = new TopTaskProcessingService(this.eventSystem, this.logger, this.statusConfigService);
		
		this.scrollToTopService = new ScrollToTopService(this.eventSystem, this.app);
		
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
		
		this.mobileTouchService = new MobileTouchService(this.contextMenuService);
		
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
		
		this.fileOperationsService = new FileOperationsService(
			this.app,
			this.eventSystem,
			this.checkboxes,
			this.isUpdatingStatus,
			() => this.scheduleRefresh(),
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

		this.contentTrackingService = new CheckboxContentTrackingService(this.app, this.logger);

		this.viewRefreshService = new ViewRefreshService(
			this.taskLoadingService,
			this.domRenderingService,
			this.topTaskProcessingService,
			this.filtering,
			this.settingsService,
			this.eventSystem,
			this.logger,
			{
				onFilterChange: (filter: string) => this.onFilterChange(filter),
				onClearFilter: () => this.clearFilter(),
				onLoadMore: () => this.loadMoreTasks(),
				onRefreshComplete: (checkboxCount: number) => {
					this.logger.debug('[OnTask View] Emitting view:refreshed event with', checkboxCount, 'checkboxes');
					this.eventSystem.emit('view:refreshed', {
						viewType: ONTASK_VIEW_TYPE,
						checkboxCount: checkboxCount
					});
				}
			}
		);

		this.checkboxUpdateService = new CheckboxUpdateService(
			this.statusConfigService,
			this.topTaskProcessingService,
			this.domRenderingService,
			this.contentTrackingService,
			this.helpers,
			this.logger,
			{
				onRefreshNeeded: () => this.scheduleRefresh()
			}
		);

		this.viewHeaderService = new ViewHeaderService(
			this.dateControls,
			this.contextMenuService
		);
		
		this.eventHandlingService = new EventHandlingService(
			this.eventSystem,
			this.app,
			this.checkboxes,
			this.isUpdatingStatus,
			() => this.refreshCheckboxes(),
			(contentArea: HTMLElement, checkboxes: any[]) => this.domRenderingService.updateTopTaskSection(contentArea, checkboxes),
			(file: TFile) => this.scheduleDebouncedRefresh(file),
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
		this.viewHeaderService.createHeader(this.contentEl, {
			onRefresh: () => this.refreshCheckboxes(),
			onSearch: () => this.toggleSearchFilter(),
			onFilters: () => this.contextMenuService.showFiltersMenu(),
			onSettings: () => this.openSettings()
		});
		
		const contentArea = this.contentEl.createDiv('ontask-content');
		
		await this.refreshCheckboxes();
		this.eventHandlingService.setupEventListeners();
		
		this.scrollToTopService.initialize(this.contentEl);
	}

	async onClose(): Promise<void> {
		this.eventHandlingService.cleanupEventListeners();
		
		this.scrollToTopService.destroy();
		
		this.viewRefreshService.cleanup();
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
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			this.logger.error('[OnTask View] Content area not found');
			return;
		}
		
		const result = await this.viewRefreshService.refreshCheckboxes(
			contentArea,
			this.checkboxes,
			this.displayedTasksCount,
			this.currentFilter
		);
		
		this.checkboxes = result.checkboxes;
		this.displayedTasksCount = result.displayedTasksCount;
		
		this.dateControls.updateDateFilterState();
		this.contentTrackingService.initializeTracking(this.checkboxes);
	}

	private updateCheckboxRowInPlace(checkbox: any, newLineContent: string): void {
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			this.logger.debug('[OnTask View] Content area not found for in-place update, falling back to refresh');
			this.scheduleRefresh();
			return;
		}

		this.checkboxUpdateService.updateCheckboxRowInPlace(
			contentArea,
			checkbox,
			newLineContent,
			this.checkboxes
		);
	}

	private async loadMoreTasks(): Promise<void> {
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) {
			this.logger.error('[OnTask View] Content area not found');
			return;
		}
		
		const result = await this.viewRefreshService.loadMoreTasks(
			contentArea,
			this.checkboxes,
			this.displayedTasksCount,
			this.currentFilter
		);
		
		this.checkboxes = result.checkboxes;
		this.displayedTasksCount = result.displayedTasksCount;
	}


	private scheduleRefresh(): void {
		this.viewRefreshService.scheduleRefresh(() => this.refreshCheckboxes());
	}

	private async scheduleDebouncedRefresh(file: TFile): Promise<void> {
		const hasChanges = await this.contentTrackingService.checkForChanges(file, this.checkboxes);
		
		if (hasChanges) {
			this.logger.debug('[OnTask View] Emitting file:modified event for', file.path);
			this.eventSystem.emit('file:modified', { path: file.path });
			this.refreshCheckboxes();
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
