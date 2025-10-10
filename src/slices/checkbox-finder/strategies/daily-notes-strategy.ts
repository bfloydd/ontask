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
				console.log('OnTask: Daily Notes core plugin not available or disabled');
				return checkboxes;
			}

			// Get Daily Notes folder path from settings
			const dailyNotesFolder = dailyNotesCore.instance?.options?.folder || '';
			console.log('OnTask: Daily Notes folder:', dailyNotesFolder);

			if (!dailyNotesFolder) {
				console.log('OnTask: Daily Notes folder not configured');
				return checkboxes;
			}

			// Get all markdown files in the Daily Notes folder
			const allFiles = this.app.vault.getMarkdownFiles();
			const dailyNotesFiles = allFiles.filter(file => 
				file.path.startsWith(dailyNotesFolder)
			);

			console.log('OnTask: Found Daily Notes files:', dailyNotesFiles.map(f => f.path));

			// Filter files by today if onlyShowToday is enabled
			let filesToProcess = dailyNotesFiles;
			if (context.onlyShowToday) {
				const originalCount = filesToProcess.length;
				filesToProcess = dailyNotesFiles.filter(file => this.isTodayFile(file));
				console.log(`OnTask: Filtered ${originalCount} Daily Notes files to ${filesToProcess.length} today's files`);
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
		
		// Look for the pattern: - [ ]
		const checkboxStart = trimmedLine.indexOf('- [');
		if (checkboxStart === -1) return null;
		
		// Find the closing bracket
		const closingBracket = trimmedLine.indexOf(']', checkboxStart);
		if (closingBracket === -1) return null;
		
		// Extract the checkbox content
		const checkboxContent = trimmedLine.substring(checkboxStart + 3, closingBracket);
		
		// Return the full checkbox pattern
		return `- [${checkboxContent}]`;
	}

	private isCheckboxCompleted(line: string): boolean {
		const trimmedLine = line.trim();
		
		// Look for the pattern: - [x] or - [X] or - [checked]
		const checkboxStart = trimmedLine.indexOf('- [');
		if (checkboxStart === -1) return false;
		
		// Find the closing bracket
		const closingBracket = trimmedLine.indexOf(']', checkboxStart);
		if (closingBracket === -1) return false;
		
		// Extract the checkbox content
		const checkboxContent = trimmedLine.substring(checkboxStart + 3, closingBracket).trim().toLowerCase();
		
		// Check if it's completed (only 'x' and 'checked' are considered completed)
		return checkboxContent === 'x' || checkboxContent === 'checked';
	}

	private processTopTasks(checkboxes: CheckboxItem[]): CheckboxItem[] {
		// First, identify all top tasks
		const topTasks: CheckboxItem[] = [];
		const regularTasks: CheckboxItem[] = [];

		for (const checkbox of checkboxes) {
			if (this.isTopTask(checkbox)) {
				checkbox.isTopTask = true;
				topTasks.push(checkbox);
			} else {
				checkbox.isTopTask = false;
				regularTasks.push(checkbox);
			}
		}

		// If there are multiple top tasks, only keep the most recent one
		let finalTopTask: CheckboxItem | null = null;
		if (topTasks.length > 0) {
			// Sort by file modification time (most recent first)
			topTasks.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
			finalTopTask = topTasks[0];
			
			// Mark all other top tasks as regular tasks
			for (let i = 1; i < topTasks.length; i++) {
				topTasks[i].isTopTask = false;
				regularTasks.push(topTasks[i]);
			}
		}

		// Return top task first, then regular tasks
		const result: CheckboxItem[] = [];
		if (finalTopTask) {
			result.push(finalTopTask);
		}
		result.push(...regularTasks);

		console.log(`OnTask: Found ${topTasks.length} top tasks in daily notes, using most recent: ${finalTopTask ? finalTopTask.file.name : 'none'}`);
		
		return result;
	}

	private isTopTask(checkbox: CheckboxItem): boolean {
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
