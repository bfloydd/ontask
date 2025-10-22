import { TFile } from 'obsidian';
import { TaskFinderFactoryImpl } from '../../task-finder/TaskFinderFactoryImpl';
import { SettingsService } from '../../settings';
import { StatusConfigService } from '../../settings/status-config';
import { StreamsService } from '../../streams';
import { Logger } from '../../logging/Logger';

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
	private logger: Logger;
	
	private currentFileIndex: number = 0;
	private currentTaskIndex: number = 0;
	private trackedFiles: string[] = [];

	constructor(
		streamsService: StreamsService,
		settingsService: SettingsService,
		statusConfigService: StatusConfigService,
		app: any,
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

	async loadTasksWithFiltering(settings: any): Promise<any[]> {
		const targetTasks = settings.loadMoreLimit;
		const loadedTasks: any[] = [];
		const statusFilters = this.statusConfigService.getStatusFilters();
		
		const allowedStatuses = this.getAllowedStatuses(statusFilters);
		const checkboxRegex = this.createCheckboxRegex(allowedStatuses);
		
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
				
				const fileTasks: any[] = [];
				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					const line = lines[lineIndex];
					
					if (line.match(checkboxRegex)) {
						fileTasks.push({
							file: file,
							lineNumber: lineIndex + 1,
							lineContent: line.trim(),
							sourceName: 'file'
						});
					}
				}
				
				const startTaskIndex = (fileIndex === this.currentFileIndex) ? this.currentTaskIndex : 0;
				const tasksToAdd = fileTasks.slice(startTaskIndex);
				
				for (const task of tasksToAdd) {
					loadedTasks.push(task);
					
					if (loadedTasks.length >= targetTasks) {
						this.currentFileIndex = fileIndex;
						this.currentTaskIndex = fileTasks.indexOf(task);
						return loadedTasks;
					}
				}
				
				
				if (loadedTasks.length < targetTasks) {
					this.currentFileIndex = fileIndex + 1;
					this.currentTaskIndex = 0;
				}
				
			} catch (error) {
				console.error(`TaskLoadingService: Error reading file ${filePath}:`, error);
				continue;
			}
		}
		
		return loadedTasks;
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
		
		const dailyNotesPlugin = this.app.plugins?.getPlugin('daily-notes');
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
				return file && this.isTodayFile(file);
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
			return /^$/;
		}
		
		const escapedStatuses = allowedStatuses.map(status => 
			status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		);
		
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
