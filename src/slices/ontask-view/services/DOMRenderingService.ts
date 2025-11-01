import { StatusConfigService } from '../../settings/status-config';
import { ContextMenuService } from './ContextMenuService';
import { SettingsService } from '../../settings';
import { CheckboxRenderer } from '../renderers/CheckboxRenderer';
import { TopTaskRenderer } from '../renderers/TopTaskRenderer';
import { FileSectionRenderer } from '../renderers/FileSectionRenderer';
import { FilterSectionRenderer } from '../renderers/FilterSectionRenderer';
import { LoadingIndicatorRenderer } from '../renderers/LoadingIndicatorRenderer';
import { CheckboxDataProcessor } from '../renderers/CheckboxDataProcessor';

export interface DOMRenderingServiceInterface {
	renderCheckboxes(contentArea: HTMLElement, checkboxes: any[], displayedTasksCount: number, currentFilter?: string, onFilterChange?: (filter: string) => void, onClearFilter?: () => void, onLoadMore?: () => Promise<void>, onlyShowToday?: boolean): void;
	createCheckboxElement(checkbox: any): HTMLElement;
	createTopTaskSectionElement(topTask: any): HTMLElement;
	createTopTaskSection(contentArea: HTMLElement, topTask: any): void;
	createFilterSectionElement(currentFilter: string, onFilterChange: (filter: string) => void, onClearFilter: () => void): HTMLElement;
	createFileSectionElement(filePath: string, fileCheckboxes: any[], maxTasksToShow: number, tasksShown: number): HTMLElement;
	createLoadMoreButtonElement(onLoadMore: () => Promise<void>): HTMLElement;
	createLoadingIndicatorElement(): HTMLElement;
	createNoMoreTasksIndicatorElement(): HTMLElement;
	renderAdditionalTasks(contentArea: HTMLElement, additionalTasks: any[]): void;
	appendTasksToExistingFile(fileSection: HTMLElement, fileTasks: any[], filePath: string): void;
	createNewFileSection(contentArea: HTMLElement, fileTasks: any[], filePath: string): void;
	updateTopTaskSection(contentArea: HTMLElement, checkboxes: any[]): void;
	groupCheckboxesByFile(checkboxes: any[]): Map<string, any[]>;
	sortFilesByDate(checkboxesByFile: Map<string, any[]>): Map<string, any[]>;
}

/**
 * Main rendering service that coordinates all renderers.
 * Acts as a facade/coordinator for the various specialized renderers.
 */
export class DOMRenderingService implements DOMRenderingServiceInterface {
	private checkboxRenderer: CheckboxRenderer;
	private topTaskRenderer: TopTaskRenderer;
	private fileSectionRenderer: FileSectionRenderer;
	private filterSectionRenderer: FilterSectionRenderer;
	private loadingIndicatorRenderer: LoadingIndicatorRenderer;
	private dataProcessor: CheckboxDataProcessor;

	constructor(
		statusConfigService: StatusConfigService,
		contextMenuService: ContextMenuService,
		settingsService: SettingsService,
		app: any,
		onOpenFile: (filePath: string, lineNumber: number) => Promise<void>,
		getFileName: (filePath: string) => string,
		parseCheckboxLine: (line: string) => { statusSymbol: string; remainingText: string },
		getStatusDisplayText: (statusSymbol: string) => string,
		addMobileTouchHandlers: (element: HTMLElement, task: any) => void
	) {
		// Initialize all renderers
		this.checkboxRenderer = new CheckboxRenderer(
			statusConfigService,
			contextMenuService,
			onOpenFile,
			parseCheckboxLine,
			getStatusDisplayText,
			addMobileTouchHandlers
		);

		this.topTaskRenderer = new TopTaskRenderer(
			statusConfigService,
			contextMenuService,
			settingsService,
			onOpenFile,
			getFileName,
			parseCheckboxLine,
			getStatusDisplayText,
			addMobileTouchHandlers
		);

		this.fileSectionRenderer = new FileSectionRenderer(
			this.checkboxRenderer,
			getFileName
		);

		this.filterSectionRenderer = new FilterSectionRenderer();
		this.loadingIndicatorRenderer = new LoadingIndicatorRenderer();
		this.dataProcessor = new CheckboxDataProcessor(app, getFileName);
	}

	renderCheckboxes(contentArea: HTMLElement, checkboxes: any[], displayedTasksCount: number, currentFilter?: string, onFilterChange?: (filter: string) => void, onClearFilter?: () => void, onLoadMore?: () => Promise<void>, onlyShowToday?: boolean): void {
		if (checkboxes.length === 0) {
			const emptyEl = contentArea.createDiv('ontask-empty');
			emptyEl.textContent = 'No tasks found.';
			return;
		}

		// Use DocumentFragment for optimized DOM manipulation
		const fragment = document.createDocumentFragment();
		const topTask = checkboxes.find(checkbox => checkbox.isTopTask);

		if (topTask) {
			const topTaskSection = this.topTaskRenderer.createTopTaskSectionElement(topTask);
			fragment.appendChild(topTaskSection);
		}

		// Add filter section after top task (always create it, but start collapsed)
		if (onFilterChange && onClearFilter) {
			const filterSection = this.filterSectionRenderer.createFilterSectionElement(currentFilter || '', onFilterChange, onClearFilter);
			fragment.appendChild(filterSection);
		}

		const checkboxesByFile = this.dataProcessor.groupCheckboxesByFile(checkboxes);
		const sortedFiles = this.dataProcessor.sortFilesByDate(checkboxesByFile);
		
		let tasksShown = 0;
		const maxTasksToShow = displayedTasksCount;
		const fileSections: HTMLElement[] = [];
		
		for (const [filePath, fileCheckboxes] of sortedFiles) {
			if (tasksShown >= maxTasksToShow) {
				break;
			}
			
			const fileSection = this.fileSectionRenderer.createFileSectionElement(filePath, fileCheckboxes, maxTasksToShow, tasksShown);
			fileSections.push(fileSection);
			
			const remainingSlots = maxTasksToShow - tasksShown;
			const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
			tasksShown += tasksToShowFromFile;
		}
		
		fileSections.forEach(section => fragment.appendChild(section));
		
		// Only show load more button when not filtering by today
		if (!onlyShowToday && onLoadMore) {
			const loadMoreSection = this.loadingIndicatorRenderer.createLoadMoreButtonElement(onLoadMore);
			fragment.appendChild(loadMoreSection);
		}
		
		// Single DOM update for optimal performance
		contentArea.appendChild(fragment);
	}

	createCheckboxElement(checkbox: any): HTMLElement {
		return this.checkboxRenderer.createCheckboxElement(checkbox);
	}

	createTopTaskSectionElement(topTask: any): HTMLElement {
		return this.topTaskRenderer.createTopTaskSectionElement(topTask);
	}

	createTopTaskSection(contentArea: HTMLElement, topTask: any): void {
		this.topTaskRenderer.createTopTaskSection(contentArea, topTask);
	}

	createFilterSectionElement(currentFilter: string, onFilterChange: (filter: string) => void, onClearFilter: () => void): HTMLElement {
		return this.filterSectionRenderer.createFilterSectionElement(currentFilter, onFilterChange, onClearFilter);
	}

	createFileSectionElement(filePath: string, fileCheckboxes: any[], maxTasksToShow: number, tasksShown: number): HTMLElement {
		return this.fileSectionRenderer.createFileSectionElement(filePath, fileCheckboxes, maxTasksToShow, tasksShown);
	}

	createLoadMoreButtonElement(onLoadMore: () => Promise<void>): HTMLElement {
		return this.loadingIndicatorRenderer.createLoadMoreButtonElement(onLoadMore);
	}

	createLoadingIndicatorElement(): HTMLElement {
		return this.loadingIndicatorRenderer.createLoadingIndicatorElement();
	}

	createNoMoreTasksIndicatorElement(): HTMLElement {
		return this.loadingIndicatorRenderer.createNoMoreTasksIndicatorElement();
	}

	renderAdditionalTasks(contentArea: HTMLElement, additionalTasks: any[]): void {
		const tasksByFile = new Map<string, any[]>();
		for (const task of additionalTasks) {
			if (!tasksByFile.has(task.filePath)) {
				tasksByFile.set(task.filePath, []);
			}
			tasksByFile.get(task.filePath)!.push(task.checkbox);
		}
		
		for (const [filePath, fileTasks] of tasksByFile) {
			let existingFileSection = contentArea.querySelector(`[data-file-path="${filePath}"]`) as HTMLElement;
			
			if (existingFileSection) {
				this.fileSectionRenderer.appendTasksToExistingFile(existingFileSection, fileTasks, filePath);
			} else {
				this.fileSectionRenderer.createNewFileSection(contentArea, fileTasks, filePath);
			}
		}
	}

	appendTasksToExistingFile(fileSection: HTMLElement, fileTasks: any[], filePath: string): void {
		this.fileSectionRenderer.appendTasksToExistingFile(fileSection, fileTasks, filePath);
	}

	createNewFileSection(contentArea: HTMLElement, fileTasks: any[], filePath: string): void {
		this.fileSectionRenderer.createNewFileSection(contentArea, fileTasks, filePath);
	}

	updateTopTaskSection(contentArea: HTMLElement, checkboxes: any[]): void {
		this.topTaskRenderer.updateTopTaskSection(contentArea, checkboxes);
	}

	groupCheckboxesByFile(checkboxes: any[]): Map<string, any[]> {
		return this.dataProcessor.groupCheckboxesByFile(checkboxes);
	}

	sortFilesByDate(checkboxesByFile: Map<string, any[]>): Map<string, any[]> {
		return this.dataProcessor.sortFilesByDate(checkboxesByFile);
	}
}

