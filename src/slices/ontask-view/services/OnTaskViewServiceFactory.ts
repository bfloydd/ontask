import { App, WorkspaceLeaf, TFile, Plugin } from 'obsidian';
import { Logger } from '../../logging/Logger';
import { EventSystem } from '../../events';
import { SettingsService } from '../../settings';
import { StatusConfigService } from '../../settings/status-config';
import { DataService } from '../../data/DataServiceInterface';
import { ContextMenuService } from './ContextMenuService';
import { TaskLoadingService } from './TaskLoadingService';
import { DOMRenderingService } from './DOMRenderingService';
import { TopTaskProcessingService } from './TopTaskProcessingService';
import { EventHandlingService } from './EventHandlingService';
import { FileOperationsService } from './FileOperationsService';
import { MobileTouchService } from './MobileTouchService';
import { ScrollToTopService } from './ScrollToTopService';
import { CheckboxContentTrackingService } from './CheckboxContentTrackingService';
import { ViewHeaderService } from './ViewHeaderService';
import { ViewRefreshService, ViewRefreshCallbacks } from './ViewRefreshService';
import { CheckboxUpdateService, CheckboxUpdateServiceCallbacks } from './CheckboxUpdateService';
import { OnTaskViewHelpers } from '../OnTaskViewHelpers';
import { OnTaskViewFiltering } from '../OnTaskViewFiltering';
import { OnTaskViewDateControls } from '../OnTaskViewDateControls';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';

export interface OnTaskViewDependencies {
	app: App;
	leaf: WorkspaceLeaf;
	taskLoadingService: TaskLoadingService;
	settingsService: SettingsService;
	statusConfigService: StatusConfigService;
	dataService: DataService;
	plugin: Plugin;
	eventSystem: EventSystem;
	logger: Logger;
	contentEl: HTMLElement;
}

export interface OnTaskViewCallbacks {
	onFilterChange: (filter: string) => void;
	onClearFilter: () => void;
	onLoadMore: () => Promise<void>;
	onRefreshComplete: (checkboxCount: number) => void;
	onRefreshNeeded: () => void;
	updateCheckboxRowInPlace: (checkbox: CheckboxItem, newLineContent: string) => void;
	refreshCheckboxes: () => Promise<void>;
	scheduleRefresh: () => void;
	scheduleDebouncedRefresh: (file: TFile) => Promise<void>;
}

export interface OnTaskViewServices {
	helpers: OnTaskViewHelpers;
	topTaskProcessingService: TopTaskProcessingService;
	scrollToTopService: ScrollToTopService;
	contextMenuService: ContextMenuService;
	mobileTouchService: MobileTouchService;
	domRenderingService: DOMRenderingService;
	fileOperationsService: FileOperationsService;
	filtering: OnTaskViewFiltering;
	dateControls: OnTaskViewDateControls;
	contentTrackingService: CheckboxContentTrackingService;
	viewRefreshService: ViewRefreshService;
	checkboxUpdateService: CheckboxUpdateService;
	viewHeaderService: ViewHeaderService;
	eventHandlingService: EventHandlingService;
}

/**
 * Factory class responsible for creating and initializing all services
 * required by OnTaskView. Follows Single Responsibility Principle by
 * isolating service creation logic from the view class.
 */
export class OnTaskViewServiceFactory {
	static createServices(
		dependencies: OnTaskViewDependencies,
		callbacks: OnTaskViewCallbacks
	): OnTaskViewServices {
		const { app, statusConfigService, settingsService, taskLoadingService, logger, eventSystem, contentEl, plugin, dataService } = dependencies;

		// Create helper service
		const helpers = new OnTaskViewHelpers(
			app,
			statusConfigService,
			settingsService,
			taskLoadingService,
			logger
		);

		// Create processing services
		const topTaskProcessingService = new TopTaskProcessingService(eventSystem, logger, statusConfigService);
		const scrollToTopService = new ScrollToTopService(eventSystem, app);
		const contentTrackingService = new CheckboxContentTrackingService(app, logger);

		// Create file operations service (needs checkboxes reference)
		const fileOperationsService = new FileOperationsService(
			app,
			eventSystem,
			[] as any[], // Will be set by view
			false, // isUpdatingStatus - will be set by view
			callbacks.scheduleRefresh,
			logger
		);

		// Create filtering and date controls
		const filtering = new OnTaskViewFiltering(
			contentEl,
			(line: string) => helpers.parseCheckboxLine(line)
		);

		const dateControls = new OnTaskViewDateControls(
			settingsService,
			eventSystem,
			logger
		);

		// Create context menu service
		const contextMenuService = new ContextMenuService(
			app,
			eventSystem,
			statusConfigService,
			settingsService,
			dataService,
			contentEl,
			(checkbox: CheckboxItem, newStatus: string) => fileOperationsService.updateCheckboxStatus(
				checkbox,
				newStatus,
				(newLineContent: string) => callbacks.updateCheckboxRowInPlace(checkbox, newLineContent)
			),
			callbacks.refreshCheckboxes,
			() => taskLoadingService.resetTracking(),
			plugin
		);

		// Create mobile touch service
		const mobileTouchService = new MobileTouchService(contextMenuService);

		// Create DOM rendering service
		const domRenderingService = new DOMRenderingService(
			statusConfigService,
			contextMenuService,
			settingsService,
			app,
			(filePath: string, lineNumber: number) => helpers.openFile(filePath, lineNumber),
			(filePath: string) => helpers.getFileName(filePath),
			(line: string) => helpers.parseCheckboxLine(line),
			(statusSymbol: string) => helpers.getStatusDisplayText(statusSymbol),
			(element: HTMLElement, task: CheckboxItem) => mobileTouchService.addMobileTouchHandlers(element, task),
			logger
		);

		// Create view refresh service
		const viewRefreshCallbacks: ViewRefreshCallbacks = {
			onFilterChange: callbacks.onFilterChange,
			onClearFilter: callbacks.onClearFilter,
			onLoadMore: callbacks.onLoadMore,
			onRefreshComplete: callbacks.onRefreshComplete
		};

		const viewRefreshService = new ViewRefreshService(
			taskLoadingService,
			domRenderingService,
			topTaskProcessingService,
			filtering,
			settingsService,
			eventSystem,
			logger,
			viewRefreshCallbacks
		);

		// Create checkbox update service
		const checkboxUpdateCallbacks: CheckboxUpdateServiceCallbacks = {
			onRefreshNeeded: callbacks.onRefreshNeeded
		};

		const checkboxUpdateService = new CheckboxUpdateService(
			statusConfigService,
			topTaskProcessingService,
			domRenderingService,
			contentTrackingService,
			helpers,
			logger,
			checkboxUpdateCallbacks
		);

		// Create view header service
		const viewHeaderService = new ViewHeaderService(
			dateControls,
			contextMenuService
		);

		// Create event handling service
		const eventHandlingService = new EventHandlingService(
			eventSystem,
			app,
			[] as CheckboxItem[], // Will be set by view
			false, // isUpdatingStatus - will be set by view
			callbacks.refreshCheckboxes,
			(contentArea: HTMLElement, checkboxes: CheckboxItem[]) => domRenderingService.updateTopTaskSection(contentArea, checkboxes),
			callbacks.scheduleDebouncedRefresh,
			logger
		);

		return {
			helpers,
			topTaskProcessingService,
			scrollToTopService,
			contextMenuService,
			mobileTouchService,
			domRenderingService,
			fileOperationsService,
			filtering,
			dateControls,
			contentTrackingService,
			viewRefreshService,
			checkboxUpdateService,
			viewHeaderService,
			eventHandlingService
		};
	}
}

