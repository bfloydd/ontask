/** @jest-environment jsdom */

import { ViewRefreshService } from '../ViewRefreshService';

describe('ViewRefreshService.loadMoreTasks', () => {
	function createTask(path: string, lineNumber: number, lineContent: string) {
		return {
			file: { path } as any,
			lineNumber,
			lineContent,
			checkboxText: lineContent,
			sourceName: 'file',
			sourcePath: path
		} as any;
	}

	function createLoadMoreSection(marker: string): HTMLElement {
		const el = document.createElement('div');
		el.className = 'ontask-load-more-section';
		el.setAttribute('data-marker', marker);
		return el;
	}

	it('uses TaskLoadingService.loadTasksWithFiltering and does not call findTopTaskAcrossTrackedFiles', async () => {
		const taskLoadingService = {
			loadTasksWithFiltering: jest.fn().mockResolvedValue({
				tasks: [createTask('a.md', 1, '- [ ] A'), createTask('b.md', 2, '- [ ] B')],
				hasMoreTasks: true
			}),
			findTopTaskAcrossTrackedFiles: jest.fn()
		} as any;

		const domRenderingService = {
			createLoadingIndicatorElement: jest.fn(() => createLoadMoreSection('loading')),
			createLoadMoreButtonElement: jest.fn(() => {
				const el = createLoadMoreSection('new-button');
				const button = document.createElement('button');
				button.className = 'ontask-load-more-button';
				el.appendChild(button);
				return el;
			}),
			createNoMoreTasksIndicatorElement: jest.fn(() => createLoadMoreSection('no-more')),
			renderAdditionalTasks: jest.fn(),
			updateTopTaskSection: jest.fn()
		} as any;

		const topTaskProcessingService = {
			processTopTasksFromDisplayedTasks: jest.fn()
		} as any;

		const filtering = {
			applyFilter: jest.fn()
		} as any;

		const settings = { loadMoreLimit: 10, dateFilter: 'all' };
		const settingsService = {
			getSettings: jest.fn(() => settings)
		} as any;

		const dateFilterService = {
			supportsLoadMore: jest.fn(() => true)
		} as any;

		const eventSystem = {} as any;
		const logger = { error: jest.fn() } as any;
		const callbacks = {
			onFilterChange: jest.fn(),
			onClearFilter: jest.fn(),
			onLoadMore: jest.fn(async () => {}),
			onRefreshComplete: jest.fn()
		};

		const viewRefreshService = new ViewRefreshService(
			taskLoadingService,
			domRenderingService,
			topTaskProcessingService,
			filtering,
			settingsService,
			dateFilterService,
			eventSystem,
			logger,
			callbacks
		);

		const contentArea = document.createElement('div');
		contentArea.appendChild(createLoadMoreSection('old-button'));

		const existingCheckboxes = [createTask('existing.md', 1, '- [ ] Existing')];

		const result = await viewRefreshService.loadMoreTasks(contentArea, existingCheckboxes, 10, 'abc');

		expect(taskLoadingService.loadTasksWithFiltering).toHaveBeenCalledTimes(1);
		expect(taskLoadingService.loadTasksWithFiltering).toHaveBeenCalledWith(settings);

		// Critical perf guarantee: Load More must NOT trigger the cross-file scan.
		expect(taskLoadingService.findTopTaskAcrossTrackedFiles).not.toHaveBeenCalled();

		// Existing load-more section should have been removed, then replaced with a new one.
		expect(contentArea.querySelector('[data-marker="old-button"]')).toBeNull();
		expect(contentArea.querySelectorAll('.ontask-load-more-section')).toHaveLength(1);
		expect(contentArea.querySelector('.ontask-load-more-button')).not.toBeNull();

		expect(domRenderingService.createLoadingIndicatorElement).toHaveBeenCalledTimes(1);
		expect(domRenderingService.renderAdditionalTasks).toHaveBeenCalledTimes(1);
		expect(topTaskProcessingService.processTopTasksFromDisplayedTasks).toHaveBeenCalledTimes(1);
		expect(filtering.applyFilter).toHaveBeenCalledTimes(1);

		expect(result.checkboxes).toHaveLength(3);
		expect(result.displayedTasksCount).toBe(12);
		expect(result.hasMoreTasks).toBe(true);
	});

	it('shows no-more indicator when there are no more tasks', async () => {
		const taskLoadingService = {
			loadTasksWithFiltering: jest.fn().mockResolvedValue({
				tasks: [createTask('a.md', 1, '- [ ] A')],
				hasMoreTasks: false
			}),
			findTopTaskAcrossTrackedFiles: jest.fn()
		} as any;

		const domRenderingService = {
			createLoadingIndicatorElement: jest.fn(() => createLoadMoreSection('loading')),
			createLoadMoreButtonElement: jest.fn(() => createLoadMoreSection('new-button')),
			createNoMoreTasksIndicatorElement: jest.fn(() => {
				const el = createLoadMoreSection('no-more');
				const indicator = document.createElement('div');
				indicator.className = 'ontask-no-more-tasks-indicator';
				el.appendChild(indicator);
				return el;
			}),
			renderAdditionalTasks: jest.fn(),
			updateTopTaskSection: jest.fn()
		} as any;

		const topTaskProcessingService = {
			processTopTasksFromDisplayedTasks: jest.fn()
		} as any;

		const filtering = {
			applyFilter: jest.fn()
		} as any;

		const settings = { loadMoreLimit: 10, dateFilter: 'all' };
		const settingsService = {
			getSettings: jest.fn(() => settings)
		} as any;

		const dateFilterService = {
			supportsLoadMore: jest.fn(() => true)
		} as any;

		const eventSystem = {} as any;
		const logger = { error: jest.fn() } as any;
		const callbacks = {
			onFilterChange: jest.fn(),
			onClearFilter: jest.fn(),
			onLoadMore: jest.fn(async () => {}),
			onRefreshComplete: jest.fn()
		};

		const viewRefreshService = new ViewRefreshService(
			taskLoadingService,
			domRenderingService,
			topTaskProcessingService,
			filtering,
			settingsService,
			dateFilterService,
			eventSystem,
			logger,
			callbacks
		);

		const contentArea = document.createElement('div');
		contentArea.appendChild(createLoadMoreSection('old-button'));

		await viewRefreshService.loadMoreTasks(contentArea, [], 0, '');

		expect(taskLoadingService.loadTasksWithFiltering).toHaveBeenCalledTimes(1);
		expect(taskLoadingService.findTopTaskAcrossTrackedFiles).not.toHaveBeenCalled();

		expect(contentArea.querySelector('[data-marker="old-button"]')).toBeNull();
		expect(contentArea.querySelectorAll('.ontask-load-more-section')).toHaveLength(1);
		expect(contentArea.querySelector('.ontask-no-more-tasks-indicator')).not.toBeNull();
	});
});

