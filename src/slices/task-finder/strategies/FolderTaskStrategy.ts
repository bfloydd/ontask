import { App, TFile } from 'obsidian';
import { TaskFinderStrategy, TaskItem, TaskFinderContext } from '../TaskFinderInterfaces';
import { Logger } from '../../logging/Logger';

export interface FolderStrategyConfig {
	folderPath: string;
	recursive: boolean;
	includeSubfolders: boolean;
}

export class FolderTaskStrategy implements TaskFinderStrategy {
	private app: App;
	private config: FolderStrategyConfig;
	private logger?: Logger;

	constructor(app: App, config: FolderStrategyConfig, logger?: Logger) {
		this.app = app;
		this.config = config;
		this.logger = logger;
	}

	getName(): string {
		return 'folder';
	}

	isAvailable(): boolean {
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
			if (context.filePaths && context.filePaths.length > 0) {
				for (const filePath of context.filePaths) {
					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (file && file instanceof TFile) {
						const fileCheckboxes = await this.findCheckboxesInFile(file, context);
						checkboxes.push(...fileCheckboxes);
					}
				}
			} else {
				const folder = this.app.vault.getAbstractFileByPath(this.config.folderPath);
				if (!folder) {
					return checkboxes;
				}

				const files = this.getFilesInFolder(folder);
				
				let filesToProcess = files;
				if (context.onlyShowToday) {
					filesToProcess = files.filter(file => this.isTodayFile(file));
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
				this.logger.error(`[OnTask FolderStrategy] Error finding checkboxes in folder ${this.config.folderPath}:`, error);
			} else {
				console.error(`Error finding checkboxes in folder ${this.config.folderPath}:`, error);
			}
		}

		return checkboxes;
	}

	public getFilesInFolder(folder: any): TFile[] {
		const files: TFile[] = [];
		
		if (folder instanceof TFile) {
			files.push(folder);
		} else {
			const allFiles = this.app.vault.getMarkdownFiles();
			
			for (const file of allFiles) {
				if (this.config.recursive) {
					if (file.path.startsWith(this.config.folderPath)) {
						files.push(file);
					}
				} else {
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
					
					if (context.limit && checkboxes.length >= context.limit) {
						break;
					}
				}
			}
		} catch (error) {
			if (this.logger) {
				this.logger.error(`[OnTask FolderStrategy] Error reading file ${file.path}:`, error);
			} else {
				console.error(`Error reading file ${file.path}:`, error);
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
