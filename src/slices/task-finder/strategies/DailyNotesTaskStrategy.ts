import { App, TFile } from 'obsidian';
import { TaskFinderStrategy, TaskItem, TaskFinderContext } from '../TaskFinderInterfaces';
import { Logger } from '../../logging/Logger';

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
		const dailyNotesPlugin = (this.app as any).plugins?.getPlugin('daily-notes');
		const hasDailyNotesPlugin = dailyNotesPlugin !== null;
		
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
					filesToProcess = dailyNotesFiles.filter(file => this.isTodayFile(file));
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

	private async getTodaysDailyNote(dailyNotesPlugin: any, today: Date): Promise<TFile | null> {
		try {
			if (dailyNotesPlugin.getDailyNote) {
				return await dailyNotesPlugin.getDailyNote(today);
			}
			
			const dateStr = today.toISOString().split('T')[0];
			const files = this.app.vault.getMarkdownFiles();
			
			for (const file of files) {
				if (file.name.includes(dateStr) || file.path.includes(dateStr)) {
					return file;
				}
			}
			
			return null;
		} catch (error) {
			if (this.logger) {
				this.logger.error('[OnTask DailyNotesStrategy] Error getting today\'s daily note:', error);
			}
			return null;
		}
	}

	private async getRecentDailyNotes(dailyNotesPlugin: any, days: number): Promise<TFile[]> {
		const notes: TFile[] = [];
		
		try {
			for (let i = 1; i <= days; i++) {
				const date = new Date();
				date.setDate(date.getDate() - i);
				
				const note = await this.getTodaysDailyNote(dailyNotesPlugin, date);
				if (note) {
					notes.push(note);
				}
			}
		} catch (error) {
			if (this.logger) {
				this.logger.error('[OnTask DailyNotesStrategy] Error getting recent daily notes:', error);
			}
		}
		
		return notes;
	}

	private async findCheckboxesInFile(file: TFile, context: TaskFinderContext): Promise<TaskItem[]> {
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
