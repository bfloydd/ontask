import { TFile } from 'obsidian';
import { StatusConfigService } from '../../settings/status-config';
import { ContextMenuService } from './context-menu-service';
import { SettingsService } from '../../settings';

export interface DOMRenderingServiceInterface {
	renderCheckboxes(contentArea: HTMLElement, checkboxes: any[], displayedTasksCount: number, currentFilter?: string, onFilterChange?: (filter: string) => void, onClearFilter?: () => void, onLoadMore?: () => Promise<void>, onlyShowToday?: boolean): void;
	createCheckboxElement(checkbox: any): HTMLElement;
	createTopTaskSectionElement(topTask: any): HTMLElement;
	createTopTaskSection(contentArea: HTMLElement, topTask: any): void;
	createFilterSectionElement(currentFilter: string, onFilterChange: (filter: string) => void, onClearFilter: () => void): HTMLElement;
	createFileSectionElement(filePath: string, fileCheckboxes: any[], maxTasksToShow: number, tasksShown: number): HTMLElement;
	createLoadMoreButtonElement(onLoadMore: () => Promise<void>): HTMLElement;
	renderAdditionalTasks(contentArea: HTMLElement, additionalTasks: any[]): void;
	appendTasksToExistingFile(fileSection: HTMLElement, fileTasks: any[], filePath: string): void;
	createNewFileSection(contentArea: HTMLElement, fileTasks: any[], filePath: string): void;
	updateTopTaskSection(contentArea: HTMLElement, checkboxes: any[]): void;
	groupCheckboxesByFile(checkboxes: any[]): Map<string, any[]>;
	sortFilesByDate(checkboxesByFile: Map<string, any[]>): Map<string, any[]>;
}

export class DOMRenderingService implements DOMRenderingServiceInterface {
	private statusConfigService: StatusConfigService;
	private contextMenuService: ContextMenuService;
	private settingsService: SettingsService;
	private app: any;
	private onOpenFile: (filePath: string, lineNumber: number) => Promise<void>;
	private getFileName: (filePath: string) => string;
	private parseCheckboxLine: (line: string) => { statusSymbol: string; remainingText: string };
	private getStatusDisplayText: (statusSymbol: string) => string;
	private addMobileTouchHandlers: (element: HTMLElement, task: any) => void;

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
		this.statusConfigService = statusConfigService;
		this.contextMenuService = contextMenuService;
		this.settingsService = settingsService;
		this.app = app;
		this.onOpenFile = onOpenFile;
		this.getFileName = getFileName;
		this.parseCheckboxLine = parseCheckboxLine;
		this.getStatusDisplayText = getStatusDisplayText;
		this.addMobileTouchHandlers = addMobileTouchHandlers;
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
			const topTaskSection = this.createTopTaskSectionElement(topTask);
			fragment.appendChild(topTaskSection);
		}

		// Add filter section after top task (always create it, but start collapsed)
		if (onFilterChange && onClearFilter) {
			const filterSection = this.createFilterSectionElement(currentFilter || '', onFilterChange, onClearFilter);
			fragment.appendChild(filterSection);
		}

		const checkboxesByFile = this.groupCheckboxesByFile(checkboxes);
		const sortedFiles = this.sortFilesByDate(checkboxesByFile);
		
		let tasksShown = 0;
		const maxTasksToShow = displayedTasksCount;
		const fileSections: HTMLElement[] = [];
		
		for (const [filePath, fileCheckboxes] of sortedFiles) {
			if (tasksShown >= maxTasksToShow) {
				break;
			}
			
			const fileSection = this.createFileSectionElement(filePath, fileCheckboxes, maxTasksToShow, tasksShown);
			fileSections.push(fileSection);
			
			const remainingSlots = maxTasksToShow - tasksShown;
			const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
			tasksShown += tasksToShowFromFile;
		}
		
		fileSections.forEach(section => fragment.appendChild(section));
		
		// Only show load more button when not filtering by today
		if (!onlyShowToday && onLoadMore) {
			const loadMoreSection = this.createLoadMoreButtonElement(onLoadMore);
			fragment.appendChild(loadMoreSection);
		}
		
		// Single DOM update for optimal performance
		contentArea.appendChild(fragment);
	}

	createCheckboxElement(checkbox: any): HTMLElement {
		const checkboxEl = document.createElement('div');
		checkboxEl.addClass('ontask-checkbox-item');
		
		if (checkbox.isTopTask) {
			checkboxEl.addClass('ontask-toptask-hero');
		}
		
		const checkboxContainer = document.createElement('div');
		checkboxContainer.addClass('ontask-checkbox-label');
		
		const statusDisplay = document.createElement('div');
		statusDisplay.addClass('ontask-checkbox-display');
		
		const { statusSymbol, remainingText } = this.parseCheckboxLine(checkbox.lineContent);
		statusDisplay.setAttribute('data-status', statusSymbol);
		statusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		
		// Apply colors from status config for all statuses
		const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);
		if (statusConfig) {
			statusDisplay.style.setProperty('--ontask-status-color', statusColor);
			statusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);
			
			// Only apply dynamic styling attributes if this is a truly custom status configuration
			// (not one of the built-in default statuses that have predefined colors)
			const isBuiltInStatus = ['x', '!', '?', '*', 'r', 'b', '<', '>', '-', '/', '+', '.', '#'].includes(statusSymbol);
			if (!isBuiltInStatus) {
				statusDisplay.setAttribute('data-dynamic-color', 'true');
				statusDisplay.setAttribute('data-custom-status', 'true');
			}
		}
		
		const textEl = document.createElement('span');
		textEl.textContent = remainingText || 'Task';
		textEl.addClass('ontask-checkbox-text');
		
		// Add ranking badge if task has topTaskRanking
		if (checkbox.topTaskRanking !== undefined) {
			const rankingEl = document.createElement('span');
			rankingEl.textContent = `Rank ${checkbox.topTaskRanking}`;
			rankingEl.addClass('ontask-task-ranking');
			rankingEl.setAttribute('data-rank', checkbox.topTaskRanking.toString());
			textEl.appendChild(rankingEl);
		}
		
		statusDisplay.addEventListener('click', () => {
			this.onOpenFile(checkbox.file?.path || '', checkbox.lineNumber);
		}, { passive: true });
		
		textEl.addEventListener('click', () => {
			this.onOpenFile(checkbox.file?.path || '', checkbox.lineNumber);
		}, { passive: true });
		
		checkboxEl.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.contextMenuService.showContextMenu(e, checkbox);
		}, { passive: false });

		this.addMobileTouchHandlers(checkboxEl, checkbox);
		
		checkboxContainer.appendChild(statusDisplay);
		checkboxContainer.appendChild(textEl);
		checkboxEl.appendChild(checkboxContainer);
		
		return checkboxEl;
	}

	createTopTaskSectionElement(topTask: any): HTMLElement {
		const topTaskSection = document.createElement('div');
		topTaskSection.className = 'ontask-toptask-hero-section ontask-file-section';
		
		// Apply the configurable top task color
		const settings = this.settingsService.getSettings();
		const colorToUse = settings.useThemeDefaultColor ? 'var(--text-error)' : settings.topTaskColor;
		
		// Calculate and apply shadow color that complements the chosen color
		const shadowColor = this.calculateShadowColor(colorToUse);
		
		// Set the status color CSS variable for the checkbox display
		const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		
		topTaskSection.setAttribute('data-dynamic-color', 'true');
		topTaskSection.style.setProperty('--ontask-dynamic-color', colorToUse);
		topTaskSection.style.setProperty('--ontask-dynamic-shadow-color', shadowColor);
		topTaskSection.style.setProperty('--ontask-dynamic-status-color', statusColor);
		
		const topTaskHeader = topTaskSection.createDiv('ontask-toptask-hero-header');
		topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
		
		const topTaskDisplay = topTaskSection.createDiv('ontask-toptask-hero-display');
		topTaskDisplay.addClass('ontask-toptask-hero-item');
		
		const topTaskContent = topTaskDisplay.createDiv('ontask-toptask-hero-content');
		
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		
		// For top task items, always apply dynamic styling to ensure proper status colors
		// Top task items have special CSS rules that require CSS custom properties
		const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);
		if (statusConfig) {
			topTaskStatusDisplay.setAttribute('data-dynamic-color', 'true');
			topTaskStatusDisplay.setAttribute('data-custom-status', 'true');
			topTaskStatusDisplay.style.setProperty('--ontask-status-color', statusColor);
			topTaskStatusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);
		}
		
		topTaskStatusDisplay.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		}, { passive: true });
		
		const topTaskText = topTaskDisplay.createDiv('ontask-toptask-hero-text');
		topTaskText.textContent = remainingText || 'Top Task';
		topTaskText.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		}, { passive: true });
		
		const topTaskSource = topTaskDisplay.createDiv('ontask-toptask-hero-source');
		topTaskSource.textContent = `From: ${this.getFileName(topTask.file?.path || '')}`;
		
		topTaskContent.appendChild(topTaskStatusDisplay);
		topTaskContent.appendChild(topTaskText);
		topTaskContent.appendChild(topTaskSource);
		
		topTaskDisplay.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.contextMenuService.showContextMenu(e, topTask);
		}, { passive: false });
		this.addMobileTouchHandlers(topTaskDisplay, topTask);
		
		return topTaskSection;
	}

	createTopTaskSection(contentArea: HTMLElement, topTask: any): void {
		const topTaskSection = contentArea.createDiv('ontask-toptask-hero-section');
		topTaskSection.addClass('ontask-file-section');
		
		// Apply the configurable top task color
		const settings = this.settingsService.getSettings();
		const colorToUse = settings.useThemeDefaultColor ? 'var(--text-error)' : settings.topTaskColor;
		topTaskSection.style.setProperty('--ontask-toptask-color', colorToUse);
		
		// Calculate and apply shadow color that complements the chosen color
		const shadowColor = this.calculateShadowColor(colorToUse);
		topTaskSection.style.setProperty('--ontask-toptask-shadow-color', shadowColor);
		
		// Set the status color CSS variable for the checkbox display
		const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		topTaskSection.style.setProperty('--ontask-toptask-status-color', statusColor);
		
		const topTaskHeader = topTaskSection.createDiv('ontask-toptask-hero-header');
		topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
		
		const topTaskDisplay = topTaskSection.createDiv('ontask-toptask-hero-display');
		topTaskDisplay.addClass('ontask-toptask-hero-item');
		
		const topTaskContent = topTaskDisplay.createDiv('ontask-toptask-hero-content');
		
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		
		// Apply status colors from status config
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		
		// For top task items, always apply dynamic styling to ensure proper status colors
		// Top task items have special CSS rules that require CSS custom properties
		const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);
		if (statusConfig) {
			topTaskStatusDisplay.setAttribute('data-dynamic-color', 'true');
			topTaskStatusDisplay.setAttribute('data-custom-status', 'true');
			topTaskStatusDisplay.style.setProperty('--ontask-status-color', statusColor);
			topTaskStatusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);
		}
		
		topTaskStatusDisplay.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		}, { passive: true });
		
		const topTaskText = topTaskDisplay.createDiv('ontask-toptask-hero-text');
		topTaskText.textContent = remainingText || 'Top Task';
		topTaskText.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		}, { passive: true });
		
		const topTaskSource = topTaskDisplay.createDiv('ontask-toptask-hero-source');
		topTaskSource.textContent = `From: ${this.getFileName(topTask.file?.path || '')}`;
		
		topTaskContent.appendChild(topTaskStatusDisplay);
		topTaskContent.appendChild(topTaskText);
		topTaskContent.appendChild(topTaskSource);
		
		topTaskDisplay.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.contextMenuService.showContextMenu(e, topTask);
		}, { passive: false });
		
		contentArea.insertBefore(topTaskSection, contentArea.firstChild);
	}

	createFilterSectionElement(currentFilter: string, onFilterChange: (filter: string) => void, onClearFilter: () => void): HTMLElement {
		const filterSection = document.createElement('div');
		filterSection.className = 'ontask-filter-section ontask-file-section ontask-filter-collapsed';
		
		const filterContainer = filterSection.createDiv('ontask-filter-container');
		
		const filterInput = filterContainer.createEl('input', {
			type: 'text',
			placeholder: 'Filter tasks...',
			value: currentFilter
		});
		filterInput.addClass('ontask-filter-input');
		
		// Add clear button
		const clearButton = filterContainer.createEl('button', { text: 'Clear' });
		clearButton.addClass('ontask-filter-clear-button');
		clearButton.addEventListener('click', onClearFilter, { passive: true });
		
		// Add filter event listener
		filterInput.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			onFilterChange(target.value);
		}, { passive: true });
		
		return filterSection;
	}

	createFileSectionElement(filePath: string, fileCheckboxes: any[], maxTasksToShow: number, tasksShown: number): HTMLElement {
		const fileSection = document.createElement('div');
		fileSection.className = 'ontask-file-section';
		fileSection.setAttribute('data-file-path', filePath);
		
		const fileHeader = fileSection.createDiv('ontask-file-header');
		fileHeader.createEl('h3', { text: this.getFileName(filePath) });
		
		const remainingSlots = maxTasksToShow - tasksShown;
		const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
		
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (let i = 0; i < tasksToShowFromFile; i++) {
			const checkbox = fileCheckboxes[i];
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		return fileSection;
	}


	createLoadMoreButtonElement(onLoadMore: () => Promise<void>): HTMLElement {
		const loadMoreSection = document.createElement('div');
		loadMoreSection.className = 'ontask-load-more-section';
		
		const loadMoreButton = document.createElement('button');
		loadMoreButton.textContent = 'Load More';
		loadMoreButton.className = 'ontask-load-more-button';
		loadMoreSection.appendChild(loadMoreButton);
		
		loadMoreButton.addEventListener('click', async () => {
			await onLoadMore();
		}, { passive: true });
		
		return loadMoreSection;
	}

	createLoadingIndicatorElement(): HTMLElement {
		const loadingSection = document.createElement('div');
		loadingSection.className = 'ontask-load-more-section';
		
		const loadingIndicator = document.createElement('div');
		loadingIndicator.textContent = 'Loading tasks...';
		loadingIndicator.className = 'ontask-loading-indicator';
		loadingSection.appendChild(loadingIndicator);
		
		return loadingSection;
	}

	createNoMoreTasksIndicatorElement(): HTMLElement {
		const noMoreSection = document.createElement('div');
		noMoreSection.className = 'ontask-load-more-section';
		
		const noMoreIndicator = document.createElement('div');
		noMoreIndicator.textContent = 'No more tasks to load';
		noMoreIndicator.className = 'ontask-no-more-tasks-indicator';
		noMoreSection.appendChild(noMoreIndicator);
		
		return noMoreSection;
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
				this.appendTasksToExistingFile(existingFileSection, fileTasks, filePath);
			} else {
				this.createNewFileSection(contentArea, fileTasks, filePath);
			}
		}
	}

	appendTasksToExistingFile(fileSection: HTMLElement, fileTasks: any[], filePath: string): void {
		const checkboxesList = fileSection.querySelector('.ontask-checkboxes-list') as HTMLElement;
		if (!checkboxesList) {
			console.error('Checkboxes list not found in existing file section');
			return;
		}
		for (const checkbox of fileTasks) {
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		const fileCount = fileSection.querySelector('.ontask-file-count') as HTMLElement;
		if (fileCount) {
			const currentCount = checkboxesList.children.length;
			fileCount.textContent = `${currentCount} task${currentCount === 1 ? '' : 's'}`;
		}
	}

	createNewFileSection(contentArea: HTMLElement, fileTasks: any[], filePath: string): void {
		const fileSection = contentArea.createDiv('ontask-file-section');
		fileSection.setAttribute('data-file-path', filePath);
		
		const fileHeader = fileSection.createDiv('ontask-file-header');
		fileHeader.createEl('h3', { text: this.getFileName(filePath) });
		
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (const checkbox of fileTasks) {
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
	}

	updateTopTaskSection(contentArea: HTMLElement, checkboxes: any[]): void {
		const existingTopTaskSection = contentArea.querySelector('.ontask-toptask-hero-section');
		
		const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
		
		if (topTask) {
			if (existingTopTaskSection) {
				// Set the status color CSS variable for the checkbox display
				const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
				const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
				(existingTopTaskSection as HTMLElement).style.setProperty('--ontask-toptask-status-color', statusColor);
				
				const topTaskStatusDisplay = existingTopTaskSection.querySelector('.ontask-checkbox-display') as HTMLElement;
				if (topTaskStatusDisplay) {
					topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
					topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
					
					// Apply status colors from status config
					const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
					
					// For top task items, we need to apply dynamic styling even for built-in statuses
					// because the top task CSS rules require the custom properties to work correctly
					// But we still need to check if this is a built-in status to avoid conflicts
					const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);
					const isBuiltInStatus = ['x', '!', '?', '*', 'r', 'b', '<', '>', '-', '/', '+', '.', '#'].includes(statusSymbol);
					
					if (statusConfig) {
						if (!isBuiltInStatus) {
							topTaskStatusDisplay.setAttribute('data-dynamic-color', 'true');
							topTaskStatusDisplay.setAttribute('data-custom-status', 'true');
						}
						topTaskStatusDisplay.style.setProperty('--ontask-status-color', statusColor);
						topTaskStatusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);
					}
				}
				
				const topTaskText = existingTopTaskSection.querySelector('.ontask-toptask-hero-text');
				if (topTaskText) {
					const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
					topTaskText.textContent = remainingText || 'Top Task';
				}
				
			} else {
				this.createTopTaskSection(contentArea, topTask);
			}
		} else {
			if (existingTopTaskSection) {
				existingTopTaskSection.remove();
			}
		}
	}

	groupCheckboxesByFile(checkboxes: any[]): Map<string, any[]> {
		const grouped = new Map<string, any[]>();
		
		for (const checkbox of checkboxes) {
			const filePath = checkbox.file?.path || 'Unknown';
			if (!grouped.has(filePath)) {
				grouped.set(filePath, []);
			}
			grouped.get(filePath)!.push(checkbox);
		}
		
		return grouped;
	}

	sortFilesByDate(checkboxesByFile: Map<string, any[]>): Map<string, any[]> {
		const fileEntries = Array.from(checkboxesByFile.entries());
		
		fileEntries.sort((a, b) => {
			try {
				const fileNameA = this.getFileName(a[0]);
				const fileNameB = this.getFileName(b[0]);
				
				const dateMatchA = fileNameA.match(/(\d{4}-\d{2}-\d{2})/);
				const dateMatchB = fileNameB.match(/(\d{4}-\d{2}-\d{2})/);
				
				if (!dateMatchA || !dateMatchB) {
					const fileA = this.app.vault.getAbstractFileByPath(a[0]) as TFile;
					const fileB = this.app.vault.getAbstractFileByPath(b[0]) as TFile;
					
				if (!fileA || !fileB) {
					return 0;
				}
					
					const dateA = fileA.stat?.mtime || fileA.stat?.ctime || 0;
					const dateB = fileB.stat?.mtime || fileB.stat?.ctime || 0;
					
					return dateB - dateA;
				}
				
				const dateA = new Date(dateMatchA[1]);
				const dateB = new Date(dateMatchB[1]);
				
				return dateB.getTime() - dateA.getTime();
			} catch (error) {
				console.error('DOMRenderingService: Error sorting files by date:', error);
				return 0;
			}
		});
		const sortedMap = new Map<string, any[]>();
		for (const [filePath, checkboxes] of fileEntries) {
			sortedMap.set(filePath, checkboxes);
		}
		
		return sortedMap;
	}

	/**
	 * Calculate a shadow color that complements the chosen top task color
	 */
	private calculateShadowColor(color: string): string {
		// For CSS variables, use a default shadow color
		if (color.startsWith('var(')) {
			return 'rgba(255, 0, 0, 0.25)'; // More prominent red shadow for theme colors
		}
		
		// For hex colors, convert to RGB and create a shadow color
		try {
			// Remove # if present
			const hex = color.replace('#', '');
			
			// Convert hex to RGB
			const r = parseInt(hex.substr(0, 2), 16);
			const g = parseInt(hex.substr(2, 2), 16);
			const b = parseInt(hex.substr(4, 2), 16);
			
			// Create shadow colors with higher opacity for more prominence
			const shadowColor1 = `rgba(${r}, ${g}, ${b}, 0.25)`;
			const shadowColor2 = `rgba(${r}, ${g}, ${b}, 0.15)`;
			
			return shadowColor1;
		} catch (error) {
			// Fallback to default red shadow if color parsing fails
			return 'rgba(255, 0, 0, 0.25)';
		}
	}
}
