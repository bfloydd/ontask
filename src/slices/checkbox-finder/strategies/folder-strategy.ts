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
				const folder = this.app.vault.getAbstractFileByPath(this.config.folderPath);
				if (!folder) {
					return checkboxes;
				}

				// Get all markdown files in the folder
				const files = this.getFilesInFolder(folder);
				
				// Performance optimization: Filter files by today before reading their content
				let filesToProcess = files;
				if (context.onlyShowToday) {
					filesToProcess = files.filter(file => this.isTodayFile(file));
				}
				
				// Process files sequentially with early termination for performance
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
			console.error(`Error finding checkboxes in folder ${this.config.folderPath}:`, error);
		}

		// Process and prioritize top tasks
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
				return true;
			}
		}
		
		// Check for date patterns in the filename using regex
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
}
