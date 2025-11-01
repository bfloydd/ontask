import { App, TFile } from 'obsidian';
import { TaskFinderStrategy, TaskItem, TaskFinderContext } from '../TaskFinderInterfaces';
import { StreamsService } from '../../streams';
import { Logger } from '../../logging/Logger';
import { CheckboxParsingUtils } from '../../../shared/CheckboxParsingUtils';
import { DateFileUtils } from '../../../shared/DateFileUtils';

export class StreamsTaskStrategy implements TaskFinderStrategy {
	private app: App;
	private streamsService: StreamsService;
	private logger?: Logger;

	constructor(app: App, streamsService: StreamsService, logger?: Logger) {
		this.app = app;
		this.streamsService = streamsService;
		this.logger = logger;
	}

	getName(): string {
		return 'streams';
	}

	isAvailable(): boolean {
		return this.streamsService.isStreamsPluginAvailable();
	}

	async findCheckboxes(context: TaskFinderContext): Promise<TaskItem[]> {
		if (!this.isAvailable()) {
			return [];
		}

		const allCheckboxes: TaskItem[] = [];
		
		if (context.filePaths && context.filePaths.length > 0) {
			for (const filePath of context.filePaths) {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file && file instanceof TFile) {
					const fileCheckboxes = await this.findCheckboxesInFile(file, { name: 'stream', folder: '' }, context);
					allCheckboxes.push(...fileCheckboxes);
				}
			}
		} else {
			const allStreams = this.streamsService.getAllStreams();
			const streams = allStreams.filter(stream => stream.folder && stream.folder.trim() !== '');
			const limit = context.limit;

			for (const stream of streams) {
				const streamCheckboxes = await this.findCheckboxesInStream(stream, context);
				allCheckboxes.push(...streamCheckboxes);
				
				if (limit && allCheckboxes.length >= limit) {
					break;
				}
			}
		}

		return allCheckboxes;
	}

	public async findCheckboxesInStream(stream: { name: string; folder: string }, context: TaskFinderContext): Promise<TaskItem[]> {
		const checkboxes: TaskItem[] = [];
		
		try {
			const streamFolder = this.app.vault.getAbstractFileByPath(stream.folder);
			
			if (!streamFolder || !(streamFolder instanceof TFile)) {
				let files = this.app.vault.getMarkdownFiles().filter(file => 
					file.path.startsWith(stream.folder)
				);
				
				if (context.onlyShowToday) {
					files = files.filter(file => DateFileUtils.isTodayFile(file));
				}
				
				for (const file of files) {
					const fileCheckboxes = await this.findCheckboxesInFile(file, stream, context);
					checkboxes.push(...fileCheckboxes);
				}
			} else {
				if (context.onlyShowToday && !DateFileUtils.isTodayFile(streamFolder)) {
					return checkboxes;
				}
				
				const fileCheckboxes = await this.findCheckboxesInFile(streamFolder, stream, context);
				checkboxes.push(...fileCheckboxes);
			}
		} catch (error) {
			if (this.logger) {
				this.logger.error(`[OnTask StreamsStrategy] Error searching stream ${stream.name}:`, error);
			}
		}

		return checkboxes;
	}

	private async findCheckboxesInFile(file: TFile, stream: { name: string; folder: string }, context: TaskFinderContext): Promise<TaskItem[]> {
		const checkboxes: TaskItem[] = [];
		
		try {
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const checkboxMatch = CheckboxParsingUtils.findCheckboxInLine(line);
				
				if (checkboxMatch) {
					checkboxes.push({
						file: file,
						lineNumber: i + 1, // 1-based line numbers
						lineContent: line.trim(),
						checkboxText: line.trim(),
						sourceName: 'Streams',
						sourcePath: stream.folder
					});
					
					if (context.limit && checkboxes.length >= context.limit) {
						break;
					}
				}
			}
		} catch (error) {
			if (this.logger) {
				this.logger.error(`[OnTask StreamsStrategy] Error reading file ${file.path}:`, error);
			}
		}

		return checkboxes;
	}

	public isTodayFile(file: TFile): boolean {
		return DateFileUtils.isTodayFile(file);
	}

}
