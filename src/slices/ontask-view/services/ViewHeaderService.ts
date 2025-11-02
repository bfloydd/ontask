import { ContextMenuService } from './ContextMenuService';
import { OnTaskViewDateControls } from '../OnTaskViewDateControls';
import { IconService } from '../../../shared/IconService';

export interface ViewHeaderCallbacks {
	onRefresh: () => Promise<void>;
	onSearch: () => void;
	onFilters: () => void;
	onSettings: () => void;
}

export interface ViewHeaderServiceInterface {
	createHeader(container: HTMLElement, callbacks: ViewHeaderCallbacks): void;
}

/**
 * Service responsible for creating and managing the view header UI
 * including date filter controls and action buttons.
 */
export class ViewHeaderService implements ViewHeaderServiceInterface {
	constructor(
		private dateControls: OnTaskViewDateControls,
		private contextMenuService: ContextMenuService
	) {}

	/**
	 * Creates the header UI with date filter controls and action buttons
	 */
	createHeader(container: HTMLElement, callbacks: ViewHeaderCallbacks): void {
		container.empty();
		container.addClass('ontask-view');
		
		const header = container.createDiv('ontask-header');
		
		// Left button group - Date filter
		const leftButtonsContainer = header.createDiv('ontask-buttons-left');
		this.dateControls.createDateFilterControl(leftButtonsContainer, callbacks.onRefresh);
		
		// Right button group - Action buttons
		const rightButtonsContainer = header.createDiv('ontask-buttons-right');
		
		const searchButton = rightButtonsContainer.createEl('button');
		searchButton.addClass('ontask-header-button');
		searchButton.innerHTML = IconService.getIcon('search');
		searchButton.title = 'Search Tasks';
		searchButton.addEventListener('click', callbacks.onSearch, { passive: true });
		
		const filtersButton = rightButtonsContainer.createEl('button');
		filtersButton.addClass('ontask-header-button');
		filtersButton.innerHTML = IconService.getIcon('filter');
		filtersButton.title = 'Filter statuses';
		filtersButton.addEventListener('click', callbacks.onFilters, { passive: true });
		
		const refreshButton = rightButtonsContainer.createEl('button');
		refreshButton.addClass('ontask-header-button');
		refreshButton.innerHTML = IconService.getIcon('refresh-cw');
		refreshButton.title = 'Refresh';
		refreshButton.addEventListener('click', callbacks.onRefresh, { passive: true });
		
		const configureButton = rightButtonsContainer.createEl('button');
		configureButton.addClass('ontask-header-button');
		configureButton.innerHTML = IconService.getIcon('settings');
		configureButton.title = 'Settings';
		configureButton.addEventListener('click', callbacks.onSettings, { passive: true });
		
		this.dateControls.updateDateFilterState();
	}
}


