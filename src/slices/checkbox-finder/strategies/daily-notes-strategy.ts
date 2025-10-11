import { App, TFile } from 'obsidian';
import { CheckboxFinderStrategy, CheckboxItem, CheckboxFinderContext } from '../interfaces';

export class DailyNotesCheckboxStrategy implements CheckboxFinderStrategy {
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
		const hasDailyNotesCore = dailyNotesCore && dailyNotesCore.enabled;
		
		console.log('OnTask: Daily Notes availability check:', {
			plugin: dailyNotesPlugin,
			hasPlugin: hasDailyNotesPlugin,
			corePlugin: dailyNotesCore,
			hasCore: hasDailyNotesCore,
			coreEnabled: dailyNotesCore?.enabled,
			corePlugins: Object.keys((this.app as any).internalPlugins?.plugins || {})
		});
		
		return hasDailyNotesPlugin || hasDailyNotesCore;
	}

	async findCheckboxes(context: CheckboxFinderContext): Promise<CheckboxItem[]> {
		const checkboxes: CheckboxItem[] = [];
		
		try {
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

			// Filter files by today if onlyShowToday is enabled
			let filesToProcess = dailyNotesFiles;
			if (context.onlyShowToday) {
				filesToProcess = dailyNotesFiles.filter(file => this.isTodayFile(file));
			}

			// Process each Daily Notes file
			for (const file of filesToProcess) {
				const fileCheckboxes = await this.findCheckboxesInFile(file, context);
				checkboxes.push(...fileCheckboxes);
			}

		} catch (error) {
			console.error('Error finding checkboxes in daily notes:', error);
		}

		return this.processTopTasks(checkboxes);
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

	private async findCheckboxesInFile(file: TFile, context: CheckboxFinderContext): Promise<CheckboxItem[]> {
		const checkboxes: CheckboxItem[] = [];
		
		try {
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const checkboxMatch = this.findCheckboxInLine(line);
				
				if (checkboxMatch) {
					// Check if this is a completed checkbox and if we should hide it
					const isCompleted = this.isCheckboxCompleted(line);
					if (context.hideCompleted && isCompleted) {
						continue;
					}
					
					checkboxes.push({
						file: file,
						lineNumber: i + 1,
						lineContent: line.trim(),
						checkboxText: line.trim(),
						sourceName: 'Daily Notes',
						sourcePath: file.path
					});
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

	private processTopTasks(checkboxes: CheckboxItem[]): CheckboxItem[] {
		// First, identify all top task contenders
		const slashTasks: CheckboxItem[] = [];
		const exclamationTasks: CheckboxItem[] = [];
		const regularTasks: CheckboxItem[] = [];

		for (const checkbox of checkboxes) {
			if (this.isSlashTopTask(checkbox)) {
				checkbox.isTopTaskContender = true;
				checkbox.isTopTask = false; // Will be set to true only for the winner
				slashTasks.push(checkbox);
			} else if (this.isExclamationTopTask(checkbox)) {
				checkbox.isTopTaskContender = true;
				checkbox.isTopTask = false; // Will be set to true only for the winner
				exclamationTasks.push(checkbox);
			} else {
				checkbox.isTopTaskContender = false;
				checkbox.isTopTask = false;
				regularTasks.push(checkbox);
			}
		}

		// Determine the final top task with priority: '/' tasks first, then '!' tasks
		let finalTopTask: CheckboxItem | null = null;
		let allTopTaskContenders: CheckboxItem[] = [];

		if (slashTasks.length > 0) {
			// Sort by file modification time (most recent first)
			slashTasks.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
			finalTopTask = slashTasks[0];
			finalTopTask.isTopTask = true; // Mark the winner as the actual top task
			allTopTaskContenders = [...slashTasks, ...exclamationTasks]; // Include both slash and exclamation tasks
		} else if (exclamationTasks.length > 0) {
			// Sort by file modification time (most recent first)
			exclamationTasks.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
			finalTopTask = exclamationTasks[0];
			finalTopTask.isTopTask = true; // Mark the winner as the actual top task
			allTopTaskContenders = exclamationTasks;
		}

		// All contenders (including the winner) should be in the regular tasks list
		// The winner will be moved to the top section by the view logic
		regularTasks.push(...allTopTaskContenders);

		// Return all tasks (the view will handle the top task display)
		const result: CheckboxItem[] = [];
		result.push(...regularTasks);

		
		return result;
	}

	private isTopTask(checkbox: CheckboxItem): boolean {
		const line = checkbox.lineContent;
		
		// Look for the pattern: - [/] or - [/x] or - [/ ] etc.
		const checkboxMatch = line.match(/^-\s*\[\/([^\]]*)\]/);
		
		return checkboxMatch !== null;
	}

	private isSlashTopTask(checkbox: CheckboxItem): boolean {
		const line = checkbox.lineContent;
		
		// Look for the pattern: - [/] or - [/x] or - [/ ] etc.
		const checkboxMatch = line.match(/^-\s*\[\/([^\]]*)\]/);
		
		return checkboxMatch !== null;
	}

	private isExclamationTopTask(checkbox: CheckboxItem): boolean {
		const line = checkbox.lineContent;
		
		// Look for the pattern: - [!] or - [!x] or - [! ] etc.
		const checkboxMatch = line.match(/^-\s*\[!([^\]]*)\]/);
		
		return checkboxMatch !== null;
	}

	private isTodayFile(file: TFile): boolean {
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
