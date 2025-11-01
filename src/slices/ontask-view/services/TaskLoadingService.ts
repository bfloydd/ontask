import { TFile, App } from 'obsidian';
import { AppWithPlugins } from '../../../types';
import { TaskFinderFactoryImpl } from '../../task-finder/TaskFinderFactoryImpl';
import { SettingsService } from '../../settings';
import { StatusConfigService } from '../../settings/StatusConfig';
import { StreamsService } from '../../streams';
import { Logger } from '../../logging/Logger';
import { DateFileUtils } from '../../../shared/DateFileUtils';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';
import { OnTaskSettings } from '../../settings/SettingsServiceInterface';

export interface TaskLoadingResult {
	tasks: CheckboxItem[];
	hasMoreTasks: boolean;
}

export interface TaskLoadingServiceInterface {
	loadTasksWithFiltering(settings: OnTaskSettings): Promise<TaskLoadingResult>;
	getFilesFromStrategies(onlyShowToday: boolean): Promise<string[]>;
	initializeFileTracking(onlyShowToday: boolean): Promise<void>;
	resetTracking(): void;
	getCurrentFileIndex(): number;
	getCurrentTaskIndex(): number;
	setCurrentFileIndex(index: number): void;
	setCurrentTaskIndex(index: number): void;
	hasMoreTasksToLoad(): boolean;
}

export class TaskLoadingService implements TaskLoadingServiceInterface {
	private taskFinderFactory: TaskFinderFactoryImpl;
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private streamsService: StreamsService;
	private app: App;
	private logger: Logger;
	
	private currentFileIndex: number = 0;
	private currentTaskIndex: number = 0;
	private trackedFiles: string[] = [];

	constructor(
		streamsService: StreamsService,
		settingsService: SettingsService,
		statusConfigService: StatusConfigService,
		app: App,
		logger: Logger
	) {
		this.streamsService = streamsService;
		this.taskFinderFactory = new TaskFinderFactoryImpl(app, streamsService);
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
		this.app = app;
		this.logger = logger;
	}

	getStreamsService(): StreamsService {
		return this.streamsService;
	}

	async loadTasksWithFiltering(settings: OnTaskSettings): Promise<TaskLoadingResult> {
		const targetTasks = settings.loadMoreLimit;
		const loadedTasks: CheckboxItem[] = [];
		const statusFilters = this.statusConfigService.getStatusFilters();
		
		const allowedStatuses = this.getAllowedStatuses(statusFilters);
		const checkboxRegex = this.createCheckboxRegex(allowedStatuses);
		
		this.logger.debug(`Starting task loading: target=${targetTasks}, files=${this.trackedFiles.length}, currentFile=${this.currentFileIndex}, currentTask=${this.currentTaskIndex}`);
		
		for (let fileIndex = this.currentFileIndex; fileIndex < this.trackedFiles.length; fileIndex++) {
			const filePath = this.trackedFiles[fileIndex];
			const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
			
			if (!file) {
				this.logger.warn(`TaskLoadingService: File not found: ${filePath}`);
				continue;
			}
			
			try {
				const content = await this.app.vault.read(file);
				const lines = content.split('\n');
				
				const fileTasks: CheckboxItem[] = [];
				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					const line = lines[lineIndex];
					
					if (line.match(checkboxRegex)) {
						const checkboxItem: CheckboxItem = {
							file: file,
							lineNumber: lineIndex + 1,
							lineContent: line.trim(),
							checkboxText: line.trim(),
							sourceName: 'file',
							sourcePath: file.path
						};
						fileTasks.push(checkboxItem);
					}
				}
				
				const startTaskIndex = (fileIndex === this.currentFileIndex) ? this.currentTaskIndex : 0;
				const tasksToAdd = fileTasks.slice(startTaskIndex);
				
				// Debug log: Show file progress and tasks found
				this.logger.debug(`Loading file ${fileIndex + 1}/${this.trackedFiles.length}: ${filePath}`);
				this.logger.debug(`  Found ${fileTasks.length} total tasks in file`);
				this.logger.debug(`  Adding ${tasksToAdd.length} tasks (starting from index ${startTaskIndex})`);
				
				// Debug log: Show each task being added
				tasksToAdd.forEach((task, taskIndex) => {
					this.logger.debug(`  Task ${taskIndex + 1}: Line ${task.lineNumber} - ${task.lineContent}`);
				});
				
				for (const task of tasksToAdd) {
					loadedTasks.push(task);
					
					if (loadedTasks.length >= targetTasks) {
						this.currentFileIndex = fileIndex;
						this.currentTaskIndex = fileTasks.indexOf(task) + 1;
						this.logger.debug(`Target reached! Stopped at file ${fileIndex + 1}/${this.trackedFiles.length}, task ${this.currentTaskIndex}/${fileTasks.length} - Final progress: ${loadedTasks.length}/${targetTasks}`);
						
						// Check if there are more tasks available
						const hasMoreTasks = this.hasMoreTasksToLoad();
						return { tasks: loadedTasks, hasMoreTasks };
					}
				}
				
				// Debug log: Show progress after processing this file
				this.logger.debug(`  Progress after file ${fileIndex + 1}: ${loadedTasks.length}/${targetTasks} tasks loaded`);
				
				if (loadedTasks.length < targetTasks) {
					this.currentFileIndex = fileIndex + 1;
					this.currentTaskIndex = 0;
				}
				
			} catch (error) {
				this.logger.error(`[OnTask TaskLoading] Error reading file ${filePath}:`, error);
				continue;
			}
		}
		
		this.logger.debug(`Task loading completed: ${loadedTasks.length}/${targetTasks} tasks loaded from ${this.trackedFiles.length} files`);
		
		// If we've processed all files, there are no more tasks
		const hasMoreTasks = this.currentFileIndex < this.trackedFiles.length;
		return { tasks: loadedTasks, hasMoreTasks };
	}

	async getFilesFromStrategies(onlyShowToday: boolean): Promise<string[]> {
		const allFiles: string[] = [];
		
		const streamsService = this.taskFinderFactory.getStreamsService();
		if (streamsService && streamsService.isStreamsPluginAvailable()) {
			const allStreams = streamsService.getAllStreams();
			const streams = allStreams.filter(stream => stream.folder && stream.folder.trim() !== '');
			
			for (const stream of streams) {
				const streamFolder = this.app.vault.getAbstractFileByPath(stream.folder);
				if (streamFolder) {
					if (streamFolder instanceof TFile) {
						allFiles.push(stream.folder);
					} else {
						const streamFiles = this.app.vault.getMarkdownFiles().filter((file: TFile) => 
							file.path.startsWith(stream.folder)
						);
						allFiles.push(...streamFiles.map((file: TFile) => file.path));
					}
				}
			}
		}
		
		const dailyNotesPlugin = (this.app as AppWithPlugins).plugins?.getPlugin('daily-notes');
		if (dailyNotesPlugin) {
			const dailyNotes = this.app.vault.getMarkdownFiles().filter((file: TFile) => {
				const fileName = file.name.toLowerCase();
				return fileName.match(/\d{4}-\d{2}-\d{2}/) || 
					   fileName.match(/\d{2}-\d{2}-\d{4}/) ||
					   fileName.match(/\d{4}\d{2}\d{2}/);
			});
			allFiles.push(...dailyNotes.map((file: TFile) => file.path));
		}
		
		const settings = this.settingsService.getSettings();
		if (settings.checkboxSource === 'folder' && settings.customFolderPath) {
			const folderFiles = this.app.vault.getMarkdownFiles().filter((file: TFile) => 
				file.path.startsWith(settings.customFolderPath)
			);
			allFiles.push(...folderFiles.map((file: TFile) => file.path));
		}
		
		if (onlyShowToday) {
			return allFiles.filter(filePath => {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				return file instanceof TFile && this.isTodayFile(file);
			});
		}
		
		return [...new Set(allFiles)];
	}

	async initializeFileTracking(onlyShowToday: boolean): Promise<void> {
		const allFiles = await this.getFilesFromStrategies(onlyShowToday);
		
		this.trackedFiles = allFiles.sort((a, b) => {
			const filenameA = a.split('/').pop() || a;
			const filenameB = b.split('/').pop() || b;
			return filenameB.localeCompare(filenameA);
		});
		
	}

	resetTracking(): void {
		this.currentFileIndex = 0;
		this.currentTaskIndex = 0;
		this.trackedFiles = [];
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

	hasMoreTasksToLoad(): boolean {
		// If we haven't initialized file tracking yet, assume there might be more
		if (this.trackedFiles.length === 0) {
			return true;
		}
		
		// If we've reached the end of all files, there are no more tasks
		if (this.currentFileIndex >= this.trackedFiles.length) {
			return false;
		}
		
		// If we're at the last file and have checked all tasks in it, there are no more tasks
		if (this.currentFileIndex === this.trackedFiles.length - 1) {
			// We can't easily check if we've reached the end of tasks in the last file
			// without reading the file content, so we'll be conservative and return true
			// The actual check will happen during loadTasksWithFiltering
			return true;
		}
		
		// If we're not at the last file, there are definitely more tasks
		return true;
	}

	private getAllowedStatuses(statusFilters: Record<string, boolean>): string[] {
		const allowedStatuses = Object.entries(statusFilters)
			.filter(([_, isAllowed]) => isAllowed !== false)
			.map(([status, _]) => status);
		
		if (allowedStatuses.includes('.')) {
			allowedStatuses.push(' ');
		}
		
		return allowedStatuses;
	}

	private createCheckboxRegex(allowedStatuses: string[]): RegExp {
		if (allowedStatuses.length === 0) {
			return /(?=a)b/; // This regex never matches anything
		}
		
		const escapedStatuses = allowedStatuses.map(status => 
			status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		);
		
		const statusPattern = escapedStatuses.join('|');
		const regexPattern = `^\\s*-\\s*\\[(${statusPattern})\\]\\s.*`;
		
		return new RegExp(regexPattern);
	}

	private isTodayFile(file: TFile): boolean {
		return DateFileUtils.isTodayFile(file);
	}
}

