import { App, TFile } from 'obsidian';
import { CheckboxFinderStrategy, CheckboxItem, CheckboxFinderContext } from '../interfaces';

export interface FolderStrategyConfig {
	folderPath: string;
	recursive: boolean;
	includeSubfolders: boolean;
}

export class FolderCheckboxStrategy implements CheckboxFinderStrategy {
	private app: App;
	private config: FolderStrategyConfig;

	constructor(app: App, config: FolderStrategyConfig) {
		this.app = app;
		this.config = config;
	}

	getName(): string {
		return 'folder';
	}

	isAvailable(): boolean {
		// Check if the configured folder exists
		const folder = this.app.vault.getAbstractFileByPath(this.config.folderPath);
		return folder !== null;
	}

	getConfiguration(): Record<string, any> {
		return {
			folderPath: this.config.folderPath,
			recursive: this.config.recursive,
			includeSubfolders: this.config.includeSubfolders
		};
	}

	async findCheckboxes(context: CheckboxFinderContext): Promise<CheckboxItem[]> {
		const checkboxes: CheckboxItem[] = [];
		
		try {
			const folder = this.app.vault.getAbstractFileByPath(this.config.folderPath);
			if (!folder) {
				console.log(`OnTask: Folder ${this.config.folderPath} not found`);
				return checkboxes;
			}

			// Get all markdown files in the folder
			const files = this.getFilesInFolder(folder);
			
			// Performance optimization: Filter files by today before reading their content
			let filesToProcess = files;
			if (context.onlyShowToday) {
				const originalCount = files.length;
				filesToProcess = files.filter(file => this.isTodayFile(file));
				console.log(`OnTask: Filtered ${originalCount} files to ${filesToProcess.length} today's files for performance`);
			}
			
			for (const file of filesToProcess) {
				const fileCheckboxes = await this.findCheckboxesInFile(file, context);
				checkboxes.push(...fileCheckboxes);
			}

		} catch (error) {
			console.error(`Error finding checkboxes in folder ${this.config.folderPath}:`, error);
		}

		return this.processTopTasks(checkboxes);
	}

	private getFilesInFolder(folder: any): TFile[] {
		const files: TFile[] = [];
		
		if (folder instanceof TFile) {
			// If it's a single file, return it
			files.push(folder);
		} else {
			// If it's a folder, get all markdown files
			const allFiles = this.app.vault.getMarkdownFiles();
			
			for (const file of allFiles) {
				if (this.config.recursive) {
					// Include files in subfolders
					if (file.path.startsWith(this.config.folderPath)) {
						files.push(file);
					}
				} else {
					// Only include files directly in the folder
					const relativePath = file.path.substring(this.config.folderPath.length + 1);
					if (!relativePath.includes('/') && file.path.startsWith(this.config.folderPath)) {
						files.push(file);
					}
				}
			}
		}
		
		return files;
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
						sourceName: `Folder: ${this.config.folderPath}`,
						sourcePath: this.config.folderPath
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

		console.log(`OnTask: Found ${topTasks.length} top tasks in folder, using most recent: ${finalTopTask ? finalTopTask.file.name : 'none'}`);
		
		return result;
	}

	private isTopTask(checkbox: CheckboxItem): boolean {
		const line = checkbox.lineContent;
		
		// Look for the pattern: - [!] or - [!x] or - [! ] etc.
		const checkboxMatch = line.match(/^-\s*\[!([^\]]*)\]/);
		
		return checkboxMatch !== null;
	}
}
