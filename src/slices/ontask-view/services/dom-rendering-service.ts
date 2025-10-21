import { TFile } from 'obsidian';
import { StatusConfigService } from '../../settings/status-config';
import { ContextMenuService } from './context-menu-service';
import { Logger } from '../../logging/Logger';

export interface DOMRenderingServiceInterface {
	renderCheckboxes(contentArea: HTMLElement, checkboxes: any[], displayedTasksCount: number): void;
	createCheckboxElement(checkbox: any): HTMLElement;
	createTopTaskSectionElement(topTask: any): HTMLElement;
	createTopTaskSection(contentArea: HTMLElement, topTask: any): void;
	createFileSectionElement(filePath: string, fileCheckboxes: any[], maxTasksToShow: number, tasksShown: number): HTMLElement;
	addLoadMoreButton(contentArea: HTMLElement, loadMoreButton: HTMLButtonElement | null, onLoadMore: () => Promise<void>): HTMLButtonElement;
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
	private app: any;
	private onOpenFile: (filePath: string, lineNumber: number) => Promise<void>;
	private getFileName: (filePath: string) => string;
	private parseCheckboxLine: (line: string) => { statusSymbol: string; remainingText: string };
	private getStatusDisplayText: (statusSymbol: string) => string;
	private addMobileTouchHandlers: (element: HTMLElement, task: any) => void;

	constructor(
		statusConfigService: StatusConfigService,
		contextMenuService: ContextMenuService,
		app: any,
		onOpenFile: (filePath: string, lineNumber: number) => Promise<void>,
		getFileName: (filePath: string) => string,
		parseCheckboxLine: (line: string) => { statusSymbol: string; remainingText: string },
		getStatusDisplayText: (statusSymbol: string) => string,
		addMobileTouchHandlers: (element: HTMLElement, task: any) => void
	) {
		this.statusConfigService = statusConfigService;
		this.contextMenuService = contextMenuService;
		this.app = app;
		this.onOpenFile = onOpenFile;
		this.getFileName = getFileName;
		this.parseCheckboxLine = parseCheckboxLine;
		this.getStatusDisplayText = getStatusDisplayText;
		this.addMobileTouchHandlers = addMobileTouchHandlers;
	}

	renderCheckboxes(contentArea: HTMLElement, checkboxes: any[], displayedTasksCount: number): void {
		if (checkboxes.length === 0) {
			const emptyEl = contentArea.createDiv('ontask-empty');
			emptyEl.textContent = 'No checkboxes found.';
			return;
		}

		// Find the top task (the winner)
		const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
		Logger.getInstance().debug('DOMRenderingService: Looking for top task. Total checkboxes:', checkboxes.length);
		Logger.getInstance().debug('DOMRenderingService: Top task found:', topTask ? 'YES' : 'NO');
		if (topTask) {
			Logger.getInstance().debug('DOMRenderingService: Top task details:', {
				lineContent: topTask.lineContent,
				isTopTask: topTask.isTopTask,
				file: topTask.file?.path
			});
		}

		// Render top task prominently at the top if it exists
		if (topTask) {
			this.createTopTaskSection(contentArea, topTask);
		}

		// Group all checkboxes by file (including the top task - it should appear in both the Hero section and list per spec)
		const checkboxesByFile = this.groupCheckboxesByFile(checkboxes);
		
		// Sort files by modification date (latest first)
		const sortedFiles = this.sortFilesByDate(checkboxesByFile);
		
		// Calculate how many tasks to show based on pagination
		let tasksShown = 0;
		const maxTasksToShow = displayedTasksCount;
		
		// Render each file's checkboxes with pagination
		for (const [filePath, fileCheckboxes] of sortedFiles) {
			if (tasksShown >= maxTasksToShow) {
				break; // Stop rendering if we've reached the limit
			}
			
			const fileSection = contentArea.createDiv('ontask-file-section');
			fileSection.setAttribute('data-file-path', filePath);
			
			// File header
			const fileHeader = fileSection.createDiv('ontask-file-header');
			fileHeader.createEl('h3', { text: this.getFileName(filePath) });
			
			// Calculate how many tasks from this file we can show
			const remainingSlots = maxTasksToShow - tasksShown;
			const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
			
			// Checkboxes list
			const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
			
			for (let i = 0; i < tasksToShowFromFile; i++) {
				const checkbox = fileCheckboxes[i];
				const checkboxEl = this.createCheckboxElement(checkbox);
				checkboxesList.appendChild(checkboxEl);
				tasksShown++;
			}
		}
	}

	createCheckboxElement(checkbox: any): HTMLElement {
		const checkboxEl = document.createElement('div');
		checkboxEl.addClass('ontask-checkbox-item');
		
		// Add top task indicator
		if (checkbox.isTopTask) {
			checkboxEl.addClass('ontask-toptask-hero');
		}
		
		// Create checkbox container
		const checkboxContainer = document.createElement('div');
		checkboxContainer.addClass('ontask-checkbox-label');
		
		// Create status display with colors from configuration
		const statusDisplay = document.createElement('div');
		statusDisplay.addClass('ontask-checkbox-display');
		
		// Extract status symbol from checkbox content
		const { statusSymbol, remainingText } = this.parseCheckboxLine(checkbox.lineContent);
		statusDisplay.setAttribute('data-status', statusSymbol);
		statusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		
		// Apply colors from status configuration
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		statusDisplay.style.color = statusColor;
		statusDisplay.style.backgroundColor = statusBackgroundColor;
		statusDisplay.style.border = `1px solid ${statusColor}`;
		
		// Create text content
		const textEl = document.createElement('span');
		textEl.textContent = remainingText || 'Task';
		textEl.addClass('ontask-checkbox-text');
		
		// Add click handler for status display (to open file)
		statusDisplay.addEventListener('click', () => {
			this.onOpenFile(checkbox.file?.path || '', checkbox.lineNumber);
		});
		
		// Add click handler for text (to open file)
		textEl.addEventListener('click', () => {
			this.onOpenFile(checkbox.file?.path || '', checkbox.lineNumber);
		});
		
		// Add context menu event listener to the task row
		checkboxEl.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.contextMenuService.showContextMenu(e, checkbox);
		});

		// Add touch support for mobile devices with long-press detection
		this.addMobileTouchHandlers(checkboxEl, checkbox);
		
		checkboxContainer.appendChild(statusDisplay);
		checkboxContainer.appendChild(textEl);
		checkboxEl.appendChild(checkboxContainer);
		
		return checkboxEl;
	}

	createTopTaskSectionElement(topTask: any): HTMLElement {
		const topTaskSection = document.createElement('div');
		topTaskSection.className = 'ontask-toptask-hero-section ontask-file-section';
		
		// Top task header
		const topTaskHeader = topTaskSection.createDiv('ontask-toptask-hero-header');
		topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
		
		// Top task display
		const topTaskDisplay = topTaskSection.createDiv('ontask-toptask-hero-display');
		topTaskDisplay.addClass('ontask-toptask-hero-item');
		
		// Create top task content
		const topTaskContent = topTaskDisplay.createDiv('ontask-toptask-hero-content');
		
		// Top task status display with colors
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { statusSymbol, remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		// Apply colors from status configuration
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		topTaskStatusDisplay.style.color = statusColor;
		topTaskStatusDisplay.style.backgroundColor = statusBackgroundColor;
		topTaskStatusDisplay.style.border = `1px solid ${statusColor}`;
		
		topTaskStatusDisplay.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task text
		const topTaskText = topTaskDisplay.createDiv('ontask-toptask-hero-text');
		topTaskText.textContent = remainingText || 'Top Task';
		topTaskText.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task source
		const topTaskSource = topTaskDisplay.createDiv('ontask-toptask-hero-source');
		topTaskSource.textContent = `From: ${this.getFileName(topTask.file?.path || '')}`;
		
		topTaskContent.appendChild(topTaskStatusDisplay);
		topTaskContent.appendChild(topTaskText);
		topTaskContent.appendChild(topTaskSource);
		
		// Add context menu event listener to the top task
		topTaskDisplay.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.contextMenuService.showContextMenu(e, topTask);
		});

		// Add touch support for mobile devices with long-press detection
		this.addMobileTouchHandlers(topTaskDisplay, topTask);
		
		return topTaskSection;
	}

	createTopTaskSection(contentArea: HTMLElement, topTask: any): void {
		const topTaskSection = contentArea.createDiv('ontask-toptask-hero-section');
		topTaskSection.addClass('ontask-file-section');
		
		// Top task header
		const topTaskHeader = topTaskSection.createDiv('ontask-toptask-hero-header');
		topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
		
		// Top task display
		const topTaskDisplay = topTaskSection.createDiv('ontask-toptask-hero-display');
		topTaskDisplay.addClass('ontask-toptask-hero-item');
		
		// Create top task content
		const topTaskContent = topTaskDisplay.createDiv('ontask-toptask-hero-content');
		
		// Top task status display
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { statusSymbol, remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		topTaskStatusDisplay.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task text
		const topTaskText = topTaskDisplay.createDiv('ontask-toptask-hero-text');
		topTaskText.textContent = remainingText || 'Top Task';
		topTaskText.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		});
		
		// Top task source
		const topTaskSource = topTaskDisplay.createDiv('ontask-toptask-hero-source');
		topTaskSource.textContent = `From: ${this.getFileName(topTask.file?.path || '')}`;
		
		topTaskContent.appendChild(topTaskStatusDisplay);
		topTaskContent.appendChild(topTaskText);
		topTaskContent.appendChild(topTaskSource);
		
		// Add context menu event listener to the top task
		topTaskDisplay.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.contextMenuService.showContextMenu(e, topTask);
		});
		
		// Insert at the beginning of content area
		contentArea.insertBefore(topTaskSection, contentArea.firstChild);
		
		Logger.getInstance().debug('DOMRenderingService: Top task section created and inserted');
	}

	createFileSectionElement(filePath: string, fileCheckboxes: any[], maxTasksToShow: number, tasksShown: number): HTMLElement {
		const fileSection = document.createElement('div');
		fileSection.className = 'ontask-file-section';
		fileSection.setAttribute('data-file-path', filePath);
		
		// File header
		const fileHeader = fileSection.createDiv('ontask-file-header');
		fileHeader.createEl('h3', { text: this.getFileName(filePath) });
		
		// Calculate how many tasks from this file we can show
		const remainingSlots = maxTasksToShow - tasksShown;
		const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
		
		// Checkboxes list
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (let i = 0; i < tasksToShowFromFile; i++) {
			const checkbox = fileCheckboxes[i];
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		return fileSection;
	}

	addLoadMoreButton(contentArea: HTMLElement, loadMoreButton: HTMLButtonElement | null, onLoadMore: () => Promise<void>): HTMLButtonElement {
		// Remove existing load more button if it exists
		if (loadMoreButton) {
			loadMoreButton.remove();
		}

		// Remove any existing load more sections to prevent duplicates
		const existingSections = contentArea.querySelectorAll('.ontask-load-more-section');
		existingSections.forEach(section => section.remove());

		const loadMoreSection = contentArea.createDiv('ontask-load-more-section');
		
		const newLoadMoreButton = loadMoreSection.createEl('button', {
			text: 'Load More',
			cls: 'ontask-load-more-button'
		});
		
		newLoadMoreButton.addEventListener('click', async () => {
			await onLoadMore();
		});

		return newLoadMoreButton;
	}

	createLoadMoreButtonElement(onLoadMore: () => Promise<void>): HTMLElement {
		const loadMoreSection = document.createElement('div');
		loadMoreSection.className = 'ontask-load-more-section';
		
		// Create button using vanilla DOM methods instead of createEl
		const loadMoreButton = document.createElement('button');
		loadMoreButton.textContent = 'Load More';
		loadMoreButton.className = 'ontask-load-more-button';
		loadMoreSection.appendChild(loadMoreButton);
		
		loadMoreButton.addEventListener('click', async () => {
			await onLoadMore();
		});
		
		return loadMoreSection;
	}

	renderAdditionalTasks(contentArea: HTMLElement, additionalTasks: any[]): void {
		Logger.getInstance().debug('DOMRenderingService: Rendering additional tasks');
		
		// Group additional tasks by file
		const tasksByFile = new Map<string, any[]>();
		for (const task of additionalTasks) {
			if (!tasksByFile.has(task.filePath)) {
				tasksByFile.set(task.filePath, []);
			}
			tasksByFile.get(task.filePath)!.push(task.checkbox);
		}
		
		// Render tasks for each file
		for (const [filePath, fileTasks] of tasksByFile) {
			// Check if this file section already exists
			let existingFileSection = contentArea.querySelector(`[data-file-path="${filePath}"]`) as HTMLElement;
			
			if (existingFileSection) {
				// Update existing file section
				this.appendTasksToExistingFile(existingFileSection, fileTasks, filePath);
			} else {
				// Create new file section
				this.createNewFileSection(contentArea, fileTasks, filePath);
			}
		}
	}

	appendTasksToExistingFile(fileSection: HTMLElement, fileTasks: any[], filePath: string): void {
		// Find the checkboxes list in the existing file section
		const checkboxesList = fileSection.querySelector('.ontask-checkboxes-list') as HTMLElement;
		if (!checkboxesList) {
			console.error('Checkboxes list not found in existing file section');
			return;
		}
		
		// Add the new tasks
		for (const checkbox of fileTasks) {
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		// Update the task count in the header
		const fileCount = fileSection.querySelector('.ontask-file-count') as HTMLElement;
		if (fileCount) {
			const currentCount = checkboxesList.children.length;
			fileCount.textContent = `${currentCount} task${currentCount === 1 ? '' : 's'}`;
		}
		
		Logger.getInstance().debug(`DOMRenderingService: Appended ${fileTasks.length} tasks to existing file section: ${filePath}`);
	}

	createNewFileSection(contentArea: HTMLElement, fileTasks: any[], filePath: string): void {
		const fileSection = contentArea.createDiv('ontask-file-section');
		fileSection.setAttribute('data-file-path', filePath);
		
		// File header
		const fileHeader = fileSection.createDiv('ontask-file-header');
		fileHeader.createEl('h3', { text: this.getFileName(filePath) });
		
		// Checkboxes list
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (const checkbox of fileTasks) {
			const checkboxEl = this.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
	}

	updateTopTaskSection(contentArea: HTMLElement, checkboxes: any[]): void {
		// Find the existing top task section
		const existingTopTaskSection = contentArea.querySelector('.ontask-toptask-hero-section');
		
		// Find the current top task
		const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
		
		if (topTask) {
			if (existingTopTaskSection) {
				// Update existing top task section
				const topTaskStatusDisplay = existingTopTaskSection.querySelector('.ontask-checkbox-display');
				if (topTaskStatusDisplay) {
					const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
					topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
					topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
				}
				
				// Update the top task text
				const topTaskText = existingTopTaskSection.querySelector('.ontask-toptask-hero-text');
				if (topTaskText) {
					const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
					topTaskText.textContent = remainingText || 'Top Task';
				}
				
			} else {
				// Create new top task section immediately
				this.createTopTaskSection(contentArea, topTask);
			}
		} else {
			// If no top task, remove the section if it exists
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
		// Convert Map to array of entries for sorting
		const fileEntries = Array.from(checkboxesByFile.entries());
		
		// Sort by date in filename (latest first)
		fileEntries.sort((a, b) => {
			try {
				const fileNameA = this.getFileName(a[0]);
				const fileNameB = this.getFileName(b[0]);
				
				// Extract date from filename (format: YYYY-MM-DD)
				const dateMatchA = fileNameA.match(/(\d{4}-\d{2}-\d{2})/);
				const dateMatchB = fileNameB.match(/(\d{4}-\d{2}-\d{2})/);
				
				if (!dateMatchA || !dateMatchB) {
					// If no date found in filename, fall back to file modification date
					const fileA = this.app.vault.getAbstractFileByPath(a[0]) as TFile;
					const fileB = this.app.vault.getAbstractFileByPath(b[0]) as TFile;
					
				if (!fileA || !fileB) {
					return 0;
				}
					
					const dateA = fileA.stat?.mtime || fileA.stat?.ctime || 0;
					const dateB = fileB.stat?.mtime || fileB.stat?.ctime || 0;
					
					return dateB - dateA;
				}
				
				// Parse dates from filename
				const dateA = new Date(dateMatchA[1]);
				const dateB = new Date(dateMatchB[1]);
				
				
				// Sort latest first (descending order)
				return dateB.getTime() - dateA.getTime();
			} catch (error) {
				console.error('DOMRenderingService: Error sorting files by date:', error);
				// If there's an error, maintain original order
				return 0;
			}
		});
		
		// Convert back to Map
		const sortedMap = new Map<string, any[]>();
		for (const [filePath, checkboxes] of fileEntries) {
			sortedMap.set(filePath, checkboxes);
		}
		
		return sortedMap;
	}
}
