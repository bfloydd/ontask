import { App, TFile } from 'obsidian';
import { TaskFinderStrategy, TaskItem, TaskFinderContext } from '../TaskFinderInterfaces';

export interface FolderStrategyConfig {
	folderPath: string;
	recursive: boolean;
	includeSubfolders: boolean;
}

export class FolderTaskStrategy implements TaskFinderStrategy {
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

		// Return checkboxes without top task processing (handled at view level)
		console.log(`Folder Strategy: Found ${checkboxes.length} checkboxes`);
		return checkboxes;
	}

	public getFilesInFolder(folder: any): TFile[] {
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
						sourceName: `Folder: ${this.config.folderPath}`,
						sourcePath: this.config.folderPath
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

}
