import { App, TFile } from 'obsidian';
import { TaskFinderStrategy, TaskItem, TaskFinderContext } from '../TaskFinderInterfaces';
import { Logger } from '../../logging/Logger';
import { CheckboxParsingUtils } from '../../../shared/CheckboxParsingUtils';
import { DateFileUtils } from '../../../shared/DateFileUtils';

export class DailyNotesTaskStrategy implements TaskFinderStrategy {
	private app: App;
	private logger?: Logger;

	constructor(app: App, logger?: Logger) {
		this.app = app;
		this.logger = logger;
	}

	getName(): string {
		return 'daily-notes';
	}

	isAvailable(): boolean {
		// Type assertion necessary: Obsidian's internal plugin APIs are not fully typed
		// The plugins and internalPlugins properties exist but are not in the public API types
		// This is a known limitation when accessing community plugins or core plugins
		const dailyNotesPlugin = (this.app as any).plugins?.getPlugin('daily-notes');
		const hasDailyNotesPlugin = dailyNotesPlugin !== null;
		
		// Type assertion necessary: internalPlugins is an internal Obsidian API
		// Used to check if the core Daily Notes plugin is enabled
		const dailyNotesCore = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
		const hasDailyNotesCore = !!(dailyNotesCore && dailyNotesCore.enabled);
		
		return hasDailyNotesPlugin || hasDailyNotesCore;
	}

	async findCheckboxes(context: TaskFinderContext): Promise<TaskItem[]> {
		const checkboxes: TaskItem[] = [];
		
		try {
			if (context.filePaths && context.filePaths.length > 0) {
				for (const filePath of context.filePaths) {
					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (file && file instanceof TFile) {
						const fileCheckboxes = await this.findCheckboxesInFile(file, context);
						checkboxes.push(...fileCheckboxes);
					}
				}
			} else {
				// Type assertion necessary: internalPlugins is an internal Obsidian API
				// Used to access the core Daily Notes plugin configuration
				const dailyNotesCore = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
				if (!dailyNotesCore || !dailyNotesCore.enabled) {
					return checkboxes;
				}

				const dailyNotesFolder = dailyNotesCore.instance?.options?.folder || '';

				if (!dailyNotesFolder) {
					return checkboxes;
				}

				const allFiles = this.app.vault.getMarkdownFiles();
				const dailyNotesFiles = allFiles.filter(file => 
					file.path.startsWith(dailyNotesFolder)
				);
				let filesToProcess = dailyNotesFiles;
				if (context.onlyShowToday) {
					filesToProcess = dailyNotesFiles.filter(file => DateFileUtils.isTodayFile(file));
				}

				for (const file of filesToProcess) {
					const fileCheckboxes = await this.findCheckboxesInFile(file, context);
					checkboxes.push(...fileCheckboxes);
					
					if (context.limit && checkboxes.length >= context.limit) {
						break;
					}
				}
			}

		} catch (error) {
			if (this.logger) {
				this.logger.error('[OnTask DailyNotesStrategy] Error finding checkboxes in daily notes:', error);
			}
		}

		return checkboxes;
	}

	private async findCheckboxesInFile(file: TFile, context: TaskFinderContext): Promise<TaskItem[]> {
		const checkboxes: TaskItem[] = [];
		
		try {
			const content = await this.app.vault.cachedRead(file);
			const lines = content.split('\n');

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const checkboxMatch = CheckboxParsingUtils.findCheckboxInLine(line);
				
				if (checkboxMatch) {
					checkboxes.push({
						file: file,
						lineNumber: i + 1,
						lineContent: line.trim(),
						checkboxText: line.trim(),
						sourceName: 'Daily Notes',
						sourcePath: file.path
					});
					
					if (context.limit && checkboxes.length >= context.limit) {
						break;
					}
				}
			}
		} catch (error) {
			if (this.logger) {
				this.logger.error(`[OnTask DailyNotesStrategy] Error reading file ${file.path}:`, error);
			}
		}

		return checkboxes;
	}

	public isTodayFile(file: TFile): boolean {
		return DateFileUtils.isTodayFile(file);
	}
}
