import { TFile } from 'obsidian';
import { TaskFinderFactoryImpl } from '../../task-finder/TaskFinderFactoryImpl';
import { SettingsService } from '../../settings';
import { StatusConfigService } from '../../settings/status-config';
import { StreamsService } from '../../streams';

export interface TaskLoadingServiceInterface {
	loadTasksWithFiltering(settings: any): Promise<any[]>;
	getFilesFromStrategies(onlyShowToday: boolean): Promise<string[]>;
	initializeFileTracking(onlyShowToday: boolean): Promise<void>;
	resetTracking(): void;
	getCurrentFileIndex(): number;
	getCurrentTaskIndex(): number;
	setCurrentFileIndex(index: number): void;
	setCurrentTaskIndex(index: number): void;
}

export class TaskLoadingService implements TaskLoadingServiceInterface {
	private taskFinderFactory: TaskFinderFactoryImpl;
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private streamsService: StreamsService;
	private app: any;
	
	// File tracking for precise Load More functionality
	private currentFileIndex: number = 0; // Current position in trackedFiles array
	private currentTaskIndex: number = 0; // Current task index within the current file
	private trackedFiles: string[] = []; // Sorted array of all files (Z-A by filename)

	constructor(
		streamsService: StreamsService,
		settingsService: SettingsService,
		statusConfigService: StatusConfigService,
		app: any
	) {
		this.streamsService = streamsService;
		this.taskFinderFactory = new TaskFinderFactoryImpl(app, streamsService);
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
		this.app = app;
	}

	getStreamsService(): StreamsService {
		return this.streamsService;
	}

	async loadTasksWithFiltering(settings: any): Promise<any[]> {
		const targetTasks = settings.loadMoreLimit;
		const loadedTasks: any[] = [];
		const statusFilters = this.statusConfigService.getStatusFilters();
		
		console.log(`TaskLoadingService: Loading ${targetTasks} tasks starting from file index ${this.currentFileIndex}, task index ${this.currentTaskIndex}`);
		
		// Create regex pattern for allowed statuses only
		const allowedStatuses = this.getAllowedStatuses(statusFilters);
		const checkboxRegex = this.createCheckboxRegex(allowedStatuses);
		
		console.log(`TaskLoadingService: Using regex pattern: ${checkboxRegex}`);
		console.log(`TaskLoadingService: Allowed statuses: ${allowedStatuses.join(', ')}`);
		
		// Loop through files starting from current position
		for (let fileIndex = this.currentFileIndex; fileIndex < this.trackedFiles.length; fileIndex++) {
			const filePath = this.trackedFiles[fileIndex];
			const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
			
			if (!file) {
				console.log(`TaskLoadingService: File not found: ${filePath}`);
				continue;
			}
			
			try {
				// Read file content
				const content = await this.app.vault.read(file);
				const lines = content.split('\n');
				
				// Find checkboxes in this file using regex filtering
				const fileTasks: any[] = [];
				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					const line = lines[lineIndex];
					
					// Use regex to find only allowed checkboxes
					if (line.match(checkboxRegex)) {
						fileTasks.push({
							file: file,
							lineNumber: lineIndex + 1,
							lineContent: line.trim(),
							sourceName: 'file'
						});
					}
				}
				
				// Add tasks from this file, starting from current task index if it's the current file
				const startTaskIndex = (fileIndex === this.currentFileIndex) ? this.currentTaskIndex : 0;
				const tasksToAdd = fileTasks.slice(startTaskIndex);
				
				// Add tasks until we reach the target
				for (const task of tasksToAdd) {
					loadedTasks.push(task);
					
					// Check immediately after adding each task
					if (loadedTasks.length >= targetTasks) {
						// We've reached our target, remember where we stopped
						this.currentFileIndex = fileIndex;
						this.currentTaskIndex = fileTasks.indexOf(task);
						console.log(`TaskLoadingService: Stopped at file ${fileIndex} (${filePath}), task ${this.currentTaskIndex} of ${fileTasks.length} - Final Progress: ${loadedTasks.length}/${targetTasks}`);
						return loadedTasks;
					}
				}
				
				// Log after adding tasks to show correct progress (only if we didn't reach target)
				console.log(`TaskLoadingService: Processing file ${fileIndex + 1}/${this.trackedFiles.length}: ${filePath} - Found ${fileTasks.length} tasks, added ${tasksToAdd.length} (start from index ${startTaskIndex}) - Progress: ${loadedTasks.length}/${targetTasks}`);
				
				// Update tracking for next file (only if we didn't reach target)
				if (loadedTasks.length < targetTasks) {
					this.currentFileIndex = fileIndex + 1;
					this.currentTaskIndex = 0;
				}
				
			} catch (error) {
				console.error(`TaskLoadingService: Error reading file ${filePath}:`, error);
				continue;
			}
		}
		
		console.log(`TaskLoadingService: Loaded ${loadedTasks.length} tasks from ${this.trackedFiles.length} files`);
		return loadedTasks;
	}

	async getFilesFromStrategies(onlyShowToday: boolean): Promise<string[]> {
		// Get files from all active strategies
		const allFiles: string[] = [];
		
		// Get files from streams strategy
		const streamsService = this.taskFinderFactory.getStreamsService();
		if (streamsService && streamsService.isStreamsPluginAvailable()) {
			const allStreams = streamsService.getAllStreams();
			const streams = allStreams.filter(stream => stream.folder && stream.folder.trim() !== '');
			
			for (const stream of streams) {
				const streamFolder = this.app.vault.getAbstractFileByPath(stream.folder);
				if (streamFolder) {
					if (streamFolder instanceof TFile) {
						// Single file
						allFiles.push(stream.folder);
					} else {
						// Directory - get all markdown files
						const streamFiles = this.app.vault.getMarkdownFiles().filter((file: TFile) => 
							file.path.startsWith(stream.folder)
						);
						allFiles.push(...streamFiles.map((file: TFile) => file.path));
					}
				}
			}
		}
		
		// Get files from daily notes if available
		const dailyNotesPlugin = this.app.plugins?.getPlugin('daily-notes');
		if (dailyNotesPlugin) {
			const dailyNotes = this.app.vault.getMarkdownFiles().filter((file: TFile) => {
				const fileName = file.name.toLowerCase();
				// Check for common daily note patterns
				return fileName.match(/\d{4}-\d{2}-\d{2}/) || 
					   fileName.match(/\d{2}-\d{2}-\d{4}/) ||
					   fileName.match(/\d{4}\d{2}\d{2}/);
			});
			allFiles.push(...dailyNotes.map((file: TFile) => file.path));
		}
		
		// Get files from custom folder if configured
		const settings = this.settingsService.getSettings();
		if (settings.checkboxSource === 'folder' && settings.customFolderPath) {
			const folderFiles = this.app.vault.getMarkdownFiles().filter((file: TFile) => 
				file.path.startsWith(settings.customFolderPath)
			);
			allFiles.push(...folderFiles.map((file: TFile) => file.path));
		}
		
		// Filter by today if needed
		if (onlyShowToday) {
			return allFiles.filter(filePath => {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				return file && this.isTodayFile(file);
			});
		}
		
		// Remove duplicates
		return [...new Set(allFiles)];
	}

	async initializeFileTracking(onlyShowToday: boolean): Promise<void> {
		// Get all files from the checkbox finder service
		const allFiles = await this.getFilesFromStrategies(onlyShowToday);
		
		// Sort files by filename Z-A (ignoring path)
		this.trackedFiles = allFiles.sort((a, b) => {
			const filenameA = a.split('/').pop() || a;
			const filenameB = b.split('/').pop() || b;
			return filenameB.localeCompare(filenameA);
		});
		
		console.log(`TaskLoadingService: Initialized file tracking with ${this.trackedFiles.length} files`);
		console.log('TaskLoadingService: First few files:', this.trackedFiles.slice(0, 5));
	}

	resetTracking(): void {
		this.currentFileIndex = 0;
		this.currentTaskIndex = 0;
		this.trackedFiles = [];
		console.log('TaskLoadingService: Reset tracking for fresh start');
	}

	getCurrentFileIndex(): number {
		return this.currentFileIndex;
	}

	getCurrentTaskIndex(): number {
		return this.currentTaskIndex;
	}

	setCurrentFileIndex(index: number): void {
		this.currentFileIndex = index;
	}

	setCurrentTaskIndex(index: number): void {
		this.currentTaskIndex = index;
	}

	private getAllowedStatuses(statusFilters: Record<string, boolean>): string[] {
		const allowedStatuses = Object.entries(statusFilters)
			.filter(([_, isAllowed]) => isAllowed !== false)
			.map(([status, _]) => status);
		
		// Add space as synonym for dot (to-do task) if dot is allowed
		if (allowedStatuses.includes('.')) {
			allowedStatuses.push(' '); // Space is synonym for dot
		}
		
		return allowedStatuses;
	}

	private createCheckboxRegex(allowedStatuses: string[]): RegExp {
		if (allowedStatuses.length === 0) {
			// If no statuses are allowed, match nothing
			return /^$/; // This will never match
		}
		
		// Escape special regex characters in status symbols
		const escapedStatuses = allowedStatuses.map(status => 
			status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		);
		
		// Create regex pattern: -\s\[(ALLOWED_STATUS_1|ALLOWED_STATUS_2|...)\]\s.*
		const statusPattern = escapedStatuses.join('|');
		const regexPattern = `^\\s*-\\s*\\[(${statusPattern})\\]\\s.*`;
		
		return new RegExp(regexPattern);
	}

	private isTodayFile(file: any): boolean {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		
		const todayFormats = [
			`${year}-${month}-${day}`,
			`${month}-${day}-${year}`,
			`${day}-${month}-${year}`,
			`${year}${month}${day}`,
			`${month}${day}${year}`,
			`${day}${month}${year}`
		];
		
		const fileName = file.name.toLowerCase();
		const filePath = file.path.toLowerCase();
		
		return todayFormats.some(format => 
			fileName.includes(format) || filePath.includes(format)
		);
	}
}
