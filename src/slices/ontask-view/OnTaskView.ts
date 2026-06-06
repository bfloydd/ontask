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
import { DateFilterService } from './date-filter';
import { DayPlannerService } from '../day-planner/DayPlannerService';
import { DayPlannerViewService } from '../day-planner/DayPlannerViewService';
import { OnTaskPlugin } from '../../shared/ObsidianInternal';

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
	private isUpdatingStatus = false;
	private displayedTasksCount = 10;
	private currentFilter = '';
	private isSearchFilterVisible = false;
	private settingsUnsubscribe: (() => void) | null = null;
	
	private isDayPlannerVisible = false;
	private dayPlannerService: DayPlannerService;
	private dayPlannerViewService: DayPlannerViewService;
	private dayPlannerContainer: HTMLElement;

	constructor(
		leaf: WorkspaceLeaf,
		taskLoadingService: TaskLoadingService,
		settingsService: SettingsService,
		statusConfigService: StatusConfigService,
		dataService: DataService,
		dateFilterService: DateFilterService,
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
		this.dayPlannerService = new DayPlannerService(this.logger);

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
			dateFilterService,
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
		this.applyViewStyle();
		
		this.viewHeaderService.createHeader(this.contentEl, {
			onRefresh: () => this.refreshCheckboxes(),
			onSearch: () => this.toggleSearchFilter(),
			onFilters: () => this.contextMenuService.showFiltersMenu(),
			onSettings: () => this.openSettings(),
			onToggleDayPlanner: () => this.toggleDayPlanner()
		});
		
		this.contentEl.createDiv('ontask-content');
		
		this.dayPlannerContainer = this.contentEl.createDiv('ontask-day-planner-wrapper');
		this.dayPlannerContainer.hide();
		this.dayPlannerViewService = new DayPlannerViewService(this.dayPlannerContainer, this.domRenderingService, () => { void this.generateDayPlan(); });
		
		await this.refreshCheckboxes();

		const settings = this.settingsService.getSettings();
		if (settings.lastDayPlan) {
			this.dayPlannerViewService.renderPlan(settings.lastDayPlan, settings.dayPlannerScheduleFromNow, this.checkboxes);
		} else {
			this.dayPlannerViewService.renderInitialState(false);
		}
		this.eventHandlingService.setupEventListeners();
		
		this.scrollToTopService.initialize(this.contentEl);
		
		// Listen for settings changes to update style dynamically
		this.settingsUnsubscribe = this.settingsService.onSettingsChange((event) => {
			if (event.key === 'viewStyle') {
				this.applyViewStyle();
			}
		});
	}

	async onClose(): Promise<void> {
		this.eventHandlingService.cleanupEventListeners();
		
		this.scrollToTopService.destroy();
		
		this.viewRefreshService.cleanup();
		
		// Clean up settings change listener
		if (this.settingsUnsubscribe) {
			this.settingsUnsubscribe();
			this.settingsUnsubscribe = null;
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

	private toggleDayPlanner(): void {
		this.isDayPlannerVisible = !this.isDayPlannerVisible;
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		const plannerBtn = this.contentEl.querySelector('.ontask-day-planner-btn') as HTMLElement;
		if (!contentArea) return;
		
		if (this.isDayPlannerVisible) {
			contentArea.hide();
			this.dayPlannerContainer.show();
			if (plannerBtn) plannerBtn.addClass('is-active');
			this.contentEl.addClass('day-planner-active');
		} else {
			contentArea.show();
			this.dayPlannerContainer.hide();
			if (plannerBtn) plannerBtn.removeClass('is-active');
			this.contentEl.removeClass('day-planner-active');
		}
	}

	private async generateDayPlan(): Promise<void> {
		this.dayPlannerViewService.renderInitialState(true);
		const settings = this.settingsService.getSettings();
		const result = await this.dayPlannerService.generateDayPlan(
			settings.geminiApiKey,
			settings.geminiModel,
			settings.dayPlannerPrompt,
			settings.dayPlannerSchedule,
			settings.dayPlannerScheduleFromNow,
			settings.dayPlannerStartTime,
			settings.dayPlannerEndTime,
			this.checkboxes
		);

		if (result) {
			await this.settingsService.updateSetting('lastDayPlan', result);
			this.dayPlannerViewService.renderPlan(result, settings.dayPlannerScheduleFromNow, this.checkboxes);
		} else {
			this.dayPlannerViewService.renderError('Failed to generate day plan. Check your API key and try again.');
		}
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
		
		const settings = this.settingsService.getSettings();
		if (settings.lastDayPlan) {
			this.dayPlannerViewService.renderPlan(settings.lastDayPlan, settings.dayPlannerScheduleFromNow, this.checkboxes);
		}
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
		
		const settings = this.settingsService.getSettings();
		if (settings.lastDayPlan) {
			this.dayPlannerViewService.renderPlan(settings.lastDayPlan, settings.dayPlannerScheduleFromNow, this.checkboxes);
		}
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
		this.viewRefreshService.scheduleRefresh(() => { void this.refreshCheckboxes(); });
	}

	private async scheduleDebouncedRefresh(file: TFile): Promise<void> {
		const hasChanges = await this.contentTrackingService.checkForChanges(file, this.checkboxes);
		
		if (hasChanges) {
			this.logger.debug('[OnTask View] Emitting file:modified event for', file.path);
			this.eventSystem.emit('file:modified', { path: file.path });
			void this.refreshCheckboxes();
		}
	}

	private applyViewStyle(): void {
		const settings = this.settingsService.getSettings();
		const styleClass = `ontask-view-style-${settings.viewStyle}`;
		
		// Remove any existing style classes
		this.contentEl.removeClass('ontask-view-style-default');
		this.contentEl.removeClass('ontask-view-style-alt1');
		this.contentEl.removeClass('ontask-view-style-modern');
		
		// Add the current style class
		this.contentEl.addClass(styleClass);
	}

	private openSettings(): void {
		const appWithSettings = this.app as AppWithSettings;
		if (appWithSettings.setting) {
			appWithSettings.setting.open();
			appWithSettings.setting.openTabById(this.plugin.manifest.id);
			
			if (this.isDayPlannerVisible) {
				const myPlugin = this.plugin as OnTaskPlugin;
				if (myPlugin.settingsTab && typeof myPlugin.settingsTab.navigateToTab === 'function') {
					myPlugin.settingsTab.navigateToTab('day-planner');
				}
			}
		}
	}
}
