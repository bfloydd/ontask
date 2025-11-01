import { TaskLoadingService } from './TaskLoadingService';
import { DOMRenderingService } from './DOMRenderingService';
import { TopTaskProcessingService } from './TopTaskProcessingService';
import { OnTaskViewFiltering } from '../OnTaskViewFiltering';
import { SettingsService } from '../../settings';
import { EventSystem } from '../../events';
import { Logger } from '../../logging/Logger';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';

export interface ViewRefreshCallbacks {
	onFilterChange: (filter: string) => void;
	onClearFilter: () => void;
	onLoadMore: () => Promise<void>;
	onRefreshComplete: (checkboxCount: number) => void;
}

export interface ViewRefreshServiceInterface {
	refreshCheckboxes(contentArea: HTMLElement, checkboxes: CheckboxItem[], displayedTasksCount: number, currentFilter: string): Promise<{ checkboxes: CheckboxItem[]; displayedTasksCount: number }>;
	loadMoreTasks(contentArea: HTMLElement, checkboxes: CheckboxItem[], displayedTasksCount: number, currentFilter: string): Promise<{ checkboxes: CheckboxItem[]; displayedTasksCount: number; hasMoreTasks: boolean }>;
	scheduleRefresh(callback: () => void): void;
	cleanup(): void;
}

/**
 * Service responsible for coordinating view refresh operations including
 * loading tasks, rendering, and managing refresh state.
 */
export class ViewRefreshService implements ViewRefreshServiceInterface {
	private refreshTimeout: number | null = null;
	private isRefreshing: boolean = false;

	constructor(
		private taskLoadingService: TaskLoadingService,
		private domRenderingService: DOMRenderingService,
		private topTaskProcessingService: TopTaskProcessingService,
		private filtering: OnTaskViewFiltering,
		private settingsService: SettingsService,
		private eventSystem: EventSystem,
		private logger: Logger,
		private callbacks: ViewRefreshCallbacks
	) {}

	/**
	 * Refreshes the checkboxes by loading tasks and rendering them
	 */
	async refreshCheckboxes(contentArea: HTMLElement, checkboxes: CheckboxItem[], displayedTasksCount: number, currentFilter: string): Promise<{ checkboxes: CheckboxItem[]; displayedTasksCount: number }> {
		if (this.isRefreshing) {
			return { checkboxes, displayedTasksCount };
		}
		
		this.isRefreshing = true;
		
		try {
			contentArea.empty();
			
			const settings = this.settingsService.getSettings();
			displayedTasksCount = settings.loadMoreLimit;
			
			this.taskLoadingService.resetTracking();
			
			const loadingEl = contentArea.createDiv('ontask-loading');
			loadingEl.textContent = 'Loading tasks...';
			
			const onlyShowToday = settings.dateFilter === 'today';
			await this.taskLoadingService.initializeFileTracking(onlyShowToday);
			const result = await this.taskLoadingService.loadTasksWithFiltering(settings);
			const newCheckboxes = result.tasks;
			this.topTaskProcessingService.processTopTasksFromDisplayedTasks(newCheckboxes);
			
			loadingEl.remove();
			
			this.domRenderingService.renderCheckboxes(
				contentArea,
				newCheckboxes,
				displayedTasksCount,
				currentFilter,
				this.callbacks.onFilterChange,
				this.callbacks.onClearFilter,
				this.callbacks.onLoadMore,
				onlyShowToday
			);
			
			this.callbacks.onRefreshComplete(newCheckboxes.length);
			
			return { checkboxes: newCheckboxes, displayedTasksCount };
			
		} catch (error) {
			this.logger.error('[OnTask ViewRefresh] Error refreshing checkboxes:', error);
			contentArea.empty();
			const errorEl = contentArea.createDiv('ontask-error');
			errorEl.textContent = 'Error loading tasks. Please try again.';
			return { checkboxes, displayedTasksCount };
		} finally {
			this.isRefreshing = false;
		}
	}

	/**
	 * Loads more tasks and appends them to the view
	 */
	async loadMoreTasks(contentArea: HTMLElement, checkboxes: CheckboxItem[], displayedTasksCount: number, currentFilter: string): Promise<{ checkboxes: CheckboxItem[]; displayedTasksCount: number; hasMoreTasks: boolean }> {
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
		
		const newCheckboxes = [...checkboxes, ...result.tasks];
		const newDisplayedTasksCount = displayedTasksCount + result.tasks.length;
		
		this.domRenderingService.renderAdditionalTasks(
			contentArea,
			result.tasks
		);
		
		// Apply current filter to newly loaded tasks
		if (currentFilter.trim() !== '') {
			this.filtering.applyFilter(currentFilter);
		}
		
		// Remove loading indicator
		const loadingIndicator = contentArea.querySelector('.ontask-load-more-section');
		if (loadingIndicator) {
			loadingIndicator.remove();
		}
		
		// Add appropriate indicator based on whether there are more tasks
		if (settings.dateFilter !== 'today') {
			if (result.hasMoreTasks) {
				const loadMoreSection = this.domRenderingService.createLoadMoreButtonElement(this.callbacks.onLoadMore);
				contentArea.appendChild(loadMoreSection);
			} else {
				const noMoreSection = this.domRenderingService.createNoMoreTasksIndicatorElement();
				contentArea.appendChild(noMoreSection);
			}
		}
		
		return {
			checkboxes: newCheckboxes,
			displayedTasksCount: newDisplayedTasksCount,
			hasMoreTasks: result.hasMoreTasks
		};
	}

	/**
	 * Schedules a debounced refresh
	 */
	scheduleRefresh(callback: () => void): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		
		this.refreshTimeout = window.setTimeout(() => {
			if (!this.isRefreshing) {
				callback();
			}
		}, 500);
	}

	/**
	 * Cleans up resources (timers, etc.)
	 */
	cleanup(): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	/**
	 * Gets the current refreshing state
	 */
	isCurrentlyRefreshing(): boolean {
		return this.isRefreshing;
	}
}

