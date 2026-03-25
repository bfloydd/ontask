import { TFile, App, normalizePath } from 'obsidian';
import { AppWithPlugins } from '../../../types';
import { TaskFinderFactoryImpl } from '../../task-finder/TaskFinderFactoryImpl';
import { SettingsService } from '../../settings';
import { StatusConfigService } from '../../settings/StatusConfig';
import { StreamsService } from '../../streams';
import { Logger } from '../../logging/Logger';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';
import { OnTaskSettings } from '../../settings/SettingsServiceInterface';
import { DateFilterService } from '../date-filter';
import { CheckboxParsingUtils } from '../../../shared/CheckboxParsingUtils';

export interface TaskLoadingResult {
	tasks: CheckboxItem[];
	hasMoreTasks: boolean;
}

export interface TaskLoadingServiceInterface {
	loadTasksWithFiltering(settings: OnTaskSettings): Promise<TaskLoadingResult>;
	/**
	 * Finds the current top task across all tracked files (based on topTaskRanking
	 * in status configs), regardless of loadMoreLimit. Returns null if no top task
	 * contenders exist or file tracking has not been initialized.
	 */
	findTopTaskAcrossTrackedFiles(): Promise<CheckboxItem | null>;
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

	private currentFileIndex: number = 0;
	private currentTaskIndex: number = 0;
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
			const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;

			if (!file) {
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

	/**
	 * Finds the top task across all tracked files (sorted by file mtime desc).
	 *
	 * This is intentionally independent of loadMoreLimit so the UI can always display
	 * the top task even when it lives outside the currently loaded batch.
	 */
	async findTopTaskAcrossTrackedFiles(): Promise<CheckboxItem | null> {
		if (this.trackedFiles.length === 0) {
			return null;
		}

		const rankedStatusConfigs = this.statusConfigService
			.getStatusConfigs()
			.filter((config) => config.topTaskRanking !== undefined)
			.sort((a, b) => (a.topTaskRanking ?? 0) - (b.topTaskRanking ?? 0));

		if (rankedStatusConfigs.length === 0) {
			return null;
		}

		// Sort tracked files by mtime desc (top task algorithm breaks ties using file mtime)
		const files = this.trackedFiles
			.map((filePath) => this.app.vault.getAbstractFileByPath(filePath))
			.filter((f): f is TFile => f instanceof TFile)
			.sort((a, b) => (b.stat?.mtime ?? 0) - (a.stat?.mtime ?? 0));

		// Single-pass scan: read each file at most once.
		// We still preserve original semantics:
		// - Lower ranking (e.g. 1) always beats higher rankings.
		// - For the same ranking, the newest file (mtime desc) wins.
		// - Within a file, the first matching line wins.
		const rankBySymbol = new Map<string, number>();
		for (const config of rankedStatusConfigs) {
			if (config.topTaskRanking === undefined) continue;
			rankBySymbol.set(config.symbol, config.topTaskRanking);
		}

		const rankedSymbols = rankedStatusConfigs
			.map((c) => c.symbol)
			.filter((s) => s !== undefined);
		const rankedCaptureRegex = this.createCheckboxRegex(rankedSymbols);

		let bestTask: CheckboxItem | null = null;
		let bestRank: number | null = null;

		for (const file of files) {
			try {
				const content = await this.app.vault.cachedRead(file);
				const lines = content.split('\n');
				const fileCache = this.app.metadataCache.getFileCache(file);
				const listItems = fileCache?.listItems;

				let bestInFile: CheckboxItem | null = null;
				let bestRankInFile: number | null = null;
				let inCodeBlock = false;

				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					const line = lines[lineIndex];

					const trimmedLine = line.trim();
					if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
						inCodeBlock = !inCodeBlock;
						continue;
					}

					if (inCodeBlock) continue;

					const match = rankedCaptureRegex.exec(line);
					if (!match) continue;

					// createCheckboxRegex uses a capture group for the symbol: \[(${statusPattern})\]
					const symbol = match[1];
					const ranking = rankBySymbol.get(symbol);
					if (ranking === undefined) continue;

					// First match of this rank in the file wins for that rank (line order).
					if (bestRankInFile === null || ranking < bestRankInFile) {
						const indentationLevel = CheckboxParsingUtils.calculateTaskIndentation(lineIndex, listItems);
						const trimmed = line.trim();
						bestRankInFile = ranking;
						bestInFile = {
							file,
							lineNumber: lineIndex + 1,
							lineContent: trimmed,
							checkboxText: trimmed,
							sourceName: 'file',
							sourcePath: file.path,
							topTaskRanking: ranking,
							indentationLevel
						};

						// Can't beat rank 1 within the file.
						if (bestRankInFile === 1) break;
					}
				}

				if (!bestInFile || bestRankInFile === null) continue;

				// If this file has a better rank than anything seen, it becomes the global best.
				// If it's equal rank, keep the existing one since we're scanning newest->oldest.
				if (bestRank === null || bestRankInFile < bestRank) {
					bestRank = bestRankInFile;
					bestTask = bestInFile;

					// Rank 1 is globally unbeatable; because we're scanning newest->oldest,
					// the first rank-1 found is the correct winner.
					if (bestRank === 1) return bestTask;
				}
			} catch (error) {
				this.logger.error('[OnTask TaskLoading] Error reading file while searching for top task:', file.path, error);
				continue;
			}
		}

		return bestTask;
	}

	async getFilesFromStrategies(dateFilter: OnTaskSettings['dateFilter']): Promise<string[]> {
		const allFiles: string[] = [];

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
					const streamFolder = this.app.vault.getAbstractFileByPath(streamFolderStr);
					if (streamFolder) {
						if (streamFolder instanceof TFile) {
							allFiles.push(streamFolderStr);
						} else {
							// For folders, ensure we match exactly the folder or its subfolders,
							// not just another folder with the same prefix string
							const targetFolder = streamFolderStr.endsWith('/') ? streamFolderStr : `${streamFolderStr}/`;
							const streamFiles = this.app.vault.getMarkdownFiles().filter((file: TFile) =>
								file.path === streamFolderStr || file.path.startsWith(targetFolder)
							);
							allFiles.push(...streamFiles.map((file: TFile) => file.path));
						}
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
			const normalizedFolderPath = normalizePath(settings.customFolderPath);
			const folderFiles = this.app.vault.getMarkdownFiles().filter((file: TFile) =>
				normalizePath(file.path).startsWith(normalizedFolderPath)
			);
			allFiles.push(...folderFiles.map((file: TFile) => file.path));
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

