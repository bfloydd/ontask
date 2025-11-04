import { ItemView, WorkspaceLeaf, TFile, Plugin } from 'obsidian';
import { Logger } from '../logging/Logger';
import { EventSystem } from '../events';
import { SettingsService } from '../settings';
import { StatusConfigService } from '../settings/StatusConfig';
import { DataService } from '../data/DataServiceInterface';
import { TaskLoadingService } from './services/TaskLoadingService';
import { OnTaskViewServiceFactory, OnTaskViewDependencies, OnTaskViewCallbacks } from './services/OnTaskViewServiceFactory';
import { ContextMenuService } from './services/ContextMenuService';
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
import { CheckboxItem } from '../task-finder/TaskFinderInterfaces';
import { AppWithSettings } from '../../types';

export const ONTASK_VIEW_TYPE = 'ontask-view';

export class OnTaskViewImpl extends ItemView {
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private dataService: DataService;
	private plugin: Plugin;
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
	private checkboxes: CheckboxItem[] = [];
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
		plugin: Plugin,
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

		// Create callbacks for service initialization
		const callbacks: OnTaskViewCallbacks = {
			onFilterChange: (filter: string) => this.onFilterChange(filter),
			onClearFilter: () => this.clearFilter(),
			onLoadMore: () => this.loadMoreTasks(),
			onRefreshComplete: (checkboxCount: number) => {
				this.logger.debug('[OnTask View] Emitting view:refreshed event with', checkboxCount, 'checkboxes');
				this.eventSystem.emit('view:refreshed', {
					viewType: ONTASK_VIEW_TYPE,
					checkboxCount: checkboxCount
				});
			},
			onRefreshNeeded: () => this.scheduleRefresh(),
			updateCheckboxRowInPlace: (checkbox: CheckboxItem, newLineContent: string) => this.updateCheckboxRowInPlace(checkbox, newLineContent),
			refreshCheckboxes: () => this.refreshCheckboxes(),
			scheduleRefresh: () => this.scheduleRefresh(),
			scheduleDebouncedRefresh: (file: TFile) => this.scheduleDebouncedRefresh(file)
		};

		// Initialize services using factory
		const dependencies: OnTaskViewDependencies = {
			app: this.app,
			leaf,
			taskLoadingService,
			settingsService,
			statusConfigService,
			dataService,
			plugin,
			eventSystem,
			logger,
			contentEl: this.contentEl
		};

		const services = OnTaskViewServiceFactory.createServices(dependencies, callbacks);

		// Assign services to instance properties
		this.helpers = services.helpers;
		this.topTaskProcessingService = services.topTaskProcessingService;
		this.scrollToTopService = services.scrollToTopService;
		this.contextMenuService = services.contextMenuService;
		this.mobileTouchService = services.mobileTouchService;
		this.domRenderingService = services.domRenderingService;
		this.fileOperationsService = services.fileOperationsService;
		this.filtering = services.filtering;
		this.dateControls = services.dateControls;
		this.contentTrackingService = services.contentTrackingService;
		this.viewRefreshService = services.viewRefreshService;
		this.checkboxUpdateService = services.checkboxUpdateService;
		this.viewHeaderService = services.viewHeaderService;
		this.eventHandlingService = services.eventHandlingService;

		// Update services that need checkboxes reference (circular dependency workaround)
		this.updateServiceReferences();
	}

	private updateServiceReferences(): void {
		// Update file operations service with checkboxes reference
		this.fileOperationsService.checkboxes = this.checkboxes;
		this.fileOperationsService.isUpdatingStatus = this.isUpdatingStatus;

		// Update event handling service with checkboxes reference
		this.eventHandlingService.checkboxes = this.checkboxes;
		this.eventHandlingService.isUpdatingStatus = this.isUpdatingStatus;
	}

	getViewType(): string {
		return ONTASK_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'OnTask';
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
		this.updateServiceReferences();
	}

	private updateCheckboxRowInPlace(checkbox: CheckboxItem, newLineContent: string): void {
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
		this.updateServiceReferences();
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

	private openSettings(): void {
		const appWithSettings = this.app as AppWithSettings;
		if (appWithSettings.setting) {
			appWithSettings.setting.open();
			appWithSettings.setting.openTabById(this.plugin.manifest.id);
		}
	}
}
