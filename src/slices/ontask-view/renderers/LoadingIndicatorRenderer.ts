/**
 * Renders loading indicators, load more buttons, and "no more tasks" messages.
 */
export class LoadingIndicatorRenderer {
	/**
	 * Creates a load more button element.
	 */
	createLoadMoreButtonElement(onLoadMore: () => Promise<void>): HTMLElement {
		const loadMoreSection = document.createElement('div');
		loadMoreSection.className = 'ontask-load-more-section';
		
		const loadMoreButton = document.createElement('button');
		loadMoreButton.textContent = 'Load more';
		loadMoreButton.className = 'ontask-load-more-button';
		loadMoreSection.appendChild(loadMoreButton);
		
		loadMoreButton.addEventListener('click', async () => {
			await onLoadMore();
		}, { passive: true });
		
		return loadMoreSection;
	}

	/**
	 * Creates a loading indicator element.
	 */
	createLoadingIndicatorElement(): HTMLElement {
		const loadingSection = document.createElement('div');
		loadingSection.className = 'ontask-load-more-section';
		
		const loadingIndicator = document.createElement('div');
		loadingIndicator.textContent = 'Loading tasks...';
		loadingIndicator.className = 'ontask-loading-indicator';
		loadingSection.appendChild(loadingIndicator);
		
		return loadingSection;
	}

	/**
	 * Creates a "no more tasks" indicator element.
	 */
	createNoMoreTasksIndicatorElement(): HTMLElement {
		const noMoreSection = document.createElement('div');
		noMoreSection.className = 'ontask-load-more-section';
		
		const noMoreIndicator = document.createElement('div');
		noMoreIndicator.textContent = 'No more tasks';
		noMoreIndicator.className = 'ontask-no-more-tasks-indicator';
		noMoreSection.appendChild(noMoreIndicator);
		
		return noMoreSection;
	}
}

