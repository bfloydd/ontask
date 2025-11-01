import { App, TFile } from 'obsidian';
import { TaskFinderStrategy, TaskItem, TaskFinderContext } from '../TaskFinderInterfaces';
import { StreamsService } from '../../streams';
import { Logger } from '../../logging/Logger';

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
					files = files.filter(file => this.isTodayFile(file));
				}
				
				for (const file of files) {
					const fileCheckboxes = await this.findCheckboxesInFile(file, stream, context);
					checkboxes.push(...fileCheckboxes);
				}
			} else {
				if (context.onlyShowToday && !this.isTodayFile(streamFolder)) {
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
				const checkboxMatch = this.findCheckboxInLine(line);
				
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

	private findCheckboxInLine(line: string): string | null {
		const trimmedLine = line.trim();
		
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]])\]\s*(.*)$/);
		if (!checkboxMatch) return null;
		
		const checkboxContent = checkboxMatch[1];
		
		return `- [${checkboxContent}]`;
	}

	private isCheckboxCompleted(line: string): boolean {
		const trimmedLine = line.trim();
		
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]])\]\s*(.*)$/);
		if (!checkboxMatch) return false;
		
		const checkboxContent = checkboxMatch[1].trim().toLowerCase();
		
		return checkboxContent === 'x' || checkboxContent === 'checked';
	}

	public isTodayFile(file: TFile): boolean {
		const today = new Date();
		
		const todayFormats = this.getTodayDateFormats(today);
		const fileName = file.name.toLowerCase();
		const filePath = file.path.toLowerCase();
		
		for (const dateFormat of todayFormats) {
			if (fileName.includes(dateFormat) || filePath.includes(dateFormat)) {
				return true;
			}
		}
		
		const datePatterns = this.getDatePatterns(today);
		for (const pattern of datePatterns) {
			if (pattern.test(fileName) || pattern.test(filePath)) {
				return true;
			}
		}
		
		return false;
	}

	private getTodayDateFormats(today: Date): string[] {
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		
		return [
			`${year}-${month}-${day}`,           // 2024-01-15
			`${year}${month}${day}`,             // 20240115
			`${month}-${day}-${year}`,           // 01-15-2024
			`${month}/${day}/${year}`,           // 01/15/2024
			`${day}-${month}-${year}`,           // 15-01-2024
			`${day}/${month}/${year}`,           // 15/01/2024
		];
	}

	private getDatePatterns(today: Date): RegExp[] {
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		
		return [
			new RegExp(`${year}-${month}-${day}`),
			new RegExp(`${year}${month}${day}`),
			new RegExp(`${month}-${day}-${year}`),
			new RegExp(`${month}/${day}/${year}`),
			new RegExp(`${day}-${month}-${year}`),
			new RegExp(`${day}/${month}/${year}`),
		];
	}

}
