import { App, TFile } from 'obsidian';
import { TaskFinderStrategy, TaskItem, TaskFinderContext } from '../interfaces';

export class DailyNotesTaskStrategy implements TaskFinderStrategy {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	getName(): string {
		return 'daily-notes';
	}

	isAvailable(): boolean {
		// Check if Daily Notes plugin is available or if Daily Notes is a core feature
		const dailyNotesPlugin = (this.app as any).plugins?.getPlugin('daily-notes');
		const hasDailyNotesPlugin = dailyNotesPlugin !== null;
		
		// Check if Daily Notes core feature is enabled
		const dailyNotesCore = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
		const hasDailyNotesCore = !!(dailyNotesCore && dailyNotesCore.enabled);
		
		return hasDailyNotesPlugin || hasDailyNotesCore;
	}

	async findCheckboxes(context: TaskFinderContext): Promise<TaskItem[]> {
		const checkboxes: TaskItem[] = [];
		
		try {
			// If specific files are provided, scan only those files for performance
			if (context.filePaths && context.filePaths.length > 0) {
				for (const filePath of context.filePaths) {
					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (file && file instanceof TFile) {
						const fileCheckboxes = await this.findCheckboxesInFile(file, context);
						checkboxes.push(...fileCheckboxes);
					}
				}
			} else {
				// Fallback to original behavior if no specific files provided
				// Get Daily Notes configuration from core plugin
				const dailyNotesCore = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
				if (!dailyNotesCore || !dailyNotesCore.enabled) {
					return checkboxes;
				}

				// Get Daily Notes folder path from settings
				const dailyNotesFolder = dailyNotesCore.instance?.options?.folder || '';

				if (!dailyNotesFolder) {
					return checkboxes;
				}

				// Get all markdown files in the Daily Notes folder
				const allFiles = this.app.vault.getMarkdownFiles();
				const dailyNotesFiles = allFiles.filter(file => 
					file.path.startsWith(dailyNotesFolder)
				);

				// Filter files by today before reading their content
				let filesToProcess = dailyNotesFiles;
				if (context.onlyShowToday) {
					filesToProcess = dailyNotesFiles.filter(file => this.isTodayFile(file));
				}

				// Process each Daily Notes file with early termination for performance
				for (const file of filesToProcess) {
					const fileCheckboxes = await this.findCheckboxesInFile(file, context);
					checkboxes.push(...fileCheckboxes);
					
					// Early termination if limit is reached
					if (context.limit && checkboxes.length >= context.limit) {
						break;
					}
				}
			}

		} catch (error) {
			console.error('Error finding checkboxes in daily notes:', error);
		}

		// Return checkboxes without top task processing (handled at view level)
		console.log(`Daily Notes Strategy: Found ${checkboxes.length} checkboxes`);
		return checkboxes;
	}

	private async getTodaysDailyNote(dailyNotesPlugin: any, today: Date): Promise<TFile | null> {
		try {
			// Use the daily notes plugin's method to get today's note
			if (dailyNotesPlugin.getDailyNote) {
				return await dailyNotesPlugin.getDailyNote(today);
			}
			
			// Fallback: try to find today's note manually
			const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
			const files = this.app.vault.getMarkdownFiles();
			
			// Look for files that match today's date pattern
			for (const file of files) {
				if (file.name.includes(dateStr) || file.path.includes(dateStr)) {
					return file;
				}
			}
			
			return null;
		} catch (error) {
			console.error('Error getting today\'s daily note:', error);
			return null;
		}
	}

	private async getRecentDailyNotes(dailyNotesPlugin: any, days: number): Promise<TFile[]> {
		const notes: TFile[] = [];
		
		try {
			// Get notes for the last N days
			for (let i = 1; i <= days; i++) {
				const date = new Date();
				date.setDate(date.getDate() - i);
				
				const note = await this.getTodaysDailyNote(dailyNotesPlugin, date);
				if (note) {
					notes.push(note);
				}
			}
		} catch (error) {
			console.error('Error getting recent daily notes:', error);
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
					
					// Early termination if limit is reached
					if (context.limit && checkboxes.length >= context.limit) {
						break;
					}
				}
			}
		} catch (error) {
			console.error(`Error reading file ${file.path}:`, error);
		}

		return checkboxes;
	}

	private findCheckboxInLine(line: string): string | null {
		const trimmedLine = line.trim();
		
		// Look for the pattern: - [X] at the beginning of the line only, where X is a single character
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]])\]\s*(.*)$/);
		if (!checkboxMatch) return null;
		
		// Extract the checkbox content (single character)
		const checkboxContent = checkboxMatch[1];
		
		// Return the full checkbox pattern
		return `- [${checkboxContent}]`;
	}

	private isCheckboxCompleted(line: string): boolean {
		const trimmedLine = line.trim();
		
		// Look for the pattern: - [X] at the beginning of the line only, where X is a single character
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]])\]\s*(.*)$/);
		if (!checkboxMatch) return false;
		
		// Extract the checkbox content (single character)
		const checkboxContent = checkboxMatch[1].trim().toLowerCase();
		
		// Check if it's completed (only 'x' and 'checked' are considered completed)
		return checkboxContent === 'x' || checkboxContent === 'checked';
	}


	public isTodayFile(file: TFile): boolean {
		const today = new Date();
		
		// Generate multiple date formats that might be used in filenames
		const todayFormats = this.getTodayDateFormats(today);
		
		// Check if filename contains today's date in any common format
		const fileName = file.name.toLowerCase();
		const filePath = file.path.toLowerCase();
		
		// Check both filename and full path for date patterns
		for (const dateFormat of todayFormats) {
			if (fileName.includes(dateFormat) || filePath.includes(dateFormat)) {
				console.log(`OnTask: Found today's file: ${file.name} (matches date: ${dateFormat})`);
				return true;
			}
		}
		
		// Check for date patterns in the filename using regex
		const datePatterns = this.getDatePatterns(today);
		for (const pattern of datePatterns) {
			if (pattern.test(fileName) || pattern.test(filePath)) {
				console.log(`OnTask: Found today's file: ${file.name} (matches pattern: ${pattern})`);
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
			// YYYY-MM-DD pattern
			new RegExp(`${year}-${month}-${day}`),
			// YYYYMMDD pattern
			new RegExp(`${year}${month}${day}`),
			// MM-DD-YYYY pattern
			new RegExp(`${month}-${day}-${year}`),
			// MM/DD/YYYY pattern
			new RegExp(`${month}/${day}/${year}`),
			// DD-MM-YYYY pattern
			new RegExp(`${day}-${month}-${year}`),
			// DD/MM/YYYY pattern
			new RegExp(`${day}/${month}/${year}`),
		];
	}
}
