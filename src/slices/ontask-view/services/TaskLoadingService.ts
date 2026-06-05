import { TFile, App } from 'obsidian';
import { TaskFinderFactoryImpl } from '../../task-finder/TaskFinderFactoryImpl';
import { SettingsService } from '../../settings';
import { StatusConfigService } from '../../settings/StatusConfig';
import { StreamsService } from '../../streams';
import { Logger } from '../../logging/Logger';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';
import { OnTaskSettings } from '../../settings/SettingsServiceInterface';

import { AppWithPlugins } from '../../../shared/ObsidianInternal';
import { DateFilterService } from '../date-filter';
import { CheckboxParsingUtils } from '../../../shared/CheckboxParsingUtils';
import { VaultUtils } from '../../../shared/VaultUtils';

export interface TaskLoadingResult {
	tasks: CheckboxItem[];
	hasMoreTasks: boolean;
}

export interface TaskLoadingServiceInterface {
	loadTasksWithFiltering(settings: OnTaskSettings): Promise<TaskLoadingResult>;
	getFilesFromStrategies(dateFilter: OnTaskSettings['dateFilter']): Promise<string[]>;
	initializeFileTracking(dateFilter: OnTaskSettings['dateFilter']): Promise<void>;
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
	private dateFilterService: DateFilterService;
	private streamsService: StreamsService;
	private app: App;
	private logger: Logger;

	private currentFileIndex = 0;
	private currentTaskIndex = 0;
	private trackedFiles: string[] = [];

	constructor(
		streamsService: StreamsService,
		settingsService: SettingsService,
		statusConfigService: StatusConfigService,
		dateFilterService: DateFilterService,
		app: App,
		logger: Logger
	) {
		this.streamsService = streamsService;
		this.taskFinderFactory = new TaskFinderFactoryImpl(app, streamsService);
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
		this.dateFilterService = dateFilterService;
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
			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (!(file instanceof TFile)) {
				this.logger.warn(`TaskLoadingService: File not found: ${filePath}`);
				continue;
			}

			try {
				const content = await this.app.vault.cachedRead(file);
				const lines = content.split('\n');
				const fileCache = this.app.metadataCache.getFileCache(file);
				const listItems = fileCache?.listItems;

				// If we're resuming within a file, skip the first N matching tasks (not the first N lines).
				const startTaskIndex = (fileIndex === this.currentFileIndex) ? this.currentTaskIndex : 0;

				// We intentionally avoid building a full list of tasks for the file.
				// Instead, we scan line-by-line and stop as soon as we have enough tasks.
				let matchedTasksInFile = 0;
				let loadedFromThisFile = 0;
				let inCodeBlock = false;

				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					const line = lines[lineIndex];

					const trimmedLine = line.trim();
					if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
						inCodeBlock = !inCodeBlock;
						continue;
					}

					if (inCodeBlock) continue;

					// Use test() to avoid allocations from match().
					if (!checkboxRegex.test(line)) continue;

					// This is the Nth task match inside this file.
					const matchIndex = matchedTasksInFile;
					matchedTasksInFile++;

					// Skip tasks we've already loaded from this file on previous batches.
					if (matchIndex < startTaskIndex) continue;

					const indentationLevel = CheckboxParsingUtils.calculateTaskIndentation(lineIndex, listItems);
					const trimmed = line.trim();
					loadedTasks.push({
						file,
						lineNumber: lineIndex + 1,
						lineContent: trimmed,
						checkboxText: trimmed,
						sourceName: 'file',
						sourcePath: file.path,
						indentationLevel
					});
					loadedFromThisFile++;

					if (loadedTasks.length >= targetTasks) {
						this.currentFileIndex = fileIndex;
						// Resume at the *next* task match inside this file.
						this.currentTaskIndex = matchIndex + 1;
						this.logger.debug(
							`Target reached! Stopped at file ${fileIndex + 1}/${this.trackedFiles.length}, ` +
							`taskMatchIndex ${this.currentTaskIndex} - Final progress: ${loadedTasks.length}/${targetTasks}`
						);

						const hasMoreTasks = this.hasMoreTasksToLoad();
						return { tasks: loadedTasks, hasMoreTasks };
					}
				}

				this.logger.debug(
					`Processed file ${fileIndex + 1}/${this.trackedFiles.length}: ` +
					`${loadedFromThisFile} added, ${matchedTasksInFile} matched, total ${loadedTasks.length}/${targetTasks}`
				);

				// Move to next file if we haven't reached the target yet.
				this.currentFileIndex = fileIndex + 1;
				this.currentTaskIndex = 0;

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



	async getFilesFromStrategies(dateFilter: OnTaskSettings['dateFilter']): Promise<string[]> {
		const allFiles: string[] = [];
		const settings = this.settingsService.getSettings();

		switch (settings.checkboxSource) {
			case 'streams': {
				const streamsService = this.taskFinderFactory.getStreamsService();
				if (streamsService && streamsService.isStreamsPluginAvailable()) {
					const allStreams = streamsService.getAllStreams();
					const streams = allStreams.filter(stream => {
						const folder = streamsService.getStreamBaseFolder(stream);
						return folder && folder.trim() !== '';
					});

					for (const stream of streams) {
						const streamFolderStr = streamsService.getStreamBaseFolder(stream);
						if (streamFolderStr) {
							const streamFiles = VaultUtils.getMarkdownFilesInFolder(this.app.vault, streamFolderStr);
							allFiles.push(...streamFiles.map((file: TFile) => file.path));
						}
					}
				}
				break;
			}
			case 'daily-notes': {
				// Get the daily notes folder from the core plugin settings, default to root
				const appWithPlugins = this.app as AppWithPlugins;
				const dailyNotesPlugin = appWithPlugins.internalPlugins?.plugins?.['daily-notes']?.instance;
				const dailyNotesFolderStr = dailyNotesPlugin?.options?.folder || '/';
				
				const dailyNotesFolderFiles = VaultUtils.getMarkdownFilesInFolder(this.app.vault, dailyNotesFolderStr);
				
				const dailyNotes = dailyNotesFolderFiles.filter((file: TFile) => {
					const fileName = file.name.toLowerCase();
					return fileName.match(/\d{4}-\d{2}-\d{2}/) ||
						fileName.match(/\d{2}-\d{2}-\d{4}/) ||
						fileName.match(/\d{4}\d{2}\d{2}/);
				});
				allFiles.push(...dailyNotes.map((file: TFile) => file.path));
				break;
			}
			case 'folder': {
				if (settings.customFolderPath) {
					const folderFiles = VaultUtils.getMarkdownFilesInFolder(this.app.vault, settings.customFolderPath);
					allFiles.push(...folderFiles.map((file: TFile) => file.path));
				}
				break;
			}
		}

		// De-duplicate early; filter implementations should not need to handle duplicates.
		const uniqueFiles = [...new Set(allFiles)];
		return this.dateFilterService.filterFilePaths(dateFilter, uniqueFiles, this.app);
	}

	async initializeFileTracking(dateFilter: OnTaskSettings['dateFilter']): Promise<void> {
		const allFiles = await this.getFilesFromStrategies(dateFilter);

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

	private createSingleStatusCheckboxRegex(statusSymbol: string): RegExp {
		const escaped = statusSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// `statusSymbol` can be a space for "to-do" statuses; keep it literal.
		return new RegExp(`^\\s*-\\s*\\[${escaped}\\]\\s.*`);
	}

	// Note: Date-based filtering is delegated to DateFilterService strategies.
}

