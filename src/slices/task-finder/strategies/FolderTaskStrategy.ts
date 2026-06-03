import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { TaskFinderStrategy, TaskItem, TaskFinderContext } from '../TaskFinderInterfaces';
import { Logger } from '../../logging/Logger';
import { CheckboxParsingUtils } from '../../../shared/CheckboxParsingUtils';
import { DateFileUtils } from '../../../shared/DateFileUtils';
import { VaultUtils } from '../../../shared/VaultUtils';

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
		this.config = {
			...config,
			folderPath: normalizePath(config.folderPath)
		};
		this.logger = logger;
	}

	getName(): string {
		return 'folder';
	}

	isAvailable(): boolean {
		const normalizedPath = normalizePath(this.config.folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
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
				const normalizedPath = normalizePath(this.config.folderPath);
				const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
				if (!folder || !(folder instanceof TFolder)) {
					return checkboxes;
				}

				const files = this.getFilesInFolder(folder);
				
				let filesToProcess = files;
				if (context.onlyShowToday) {
					filesToProcess = files.filter(file => DateFileUtils.isTodayFile(file));
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
			}
		}

		return checkboxes;
	}

	public getFilesInFolder(folder: TFolder): TFile[] {
		if (folder instanceof TFile) {
			return [folder];
		}
		const files = VaultUtils.getMarkdownFilesInFolder(this.app.vault, this.config.folderPath, this.config.recursive);
		return files;
	}

	private async findCheckboxesInFile(file: TFile, context: TaskFinderContext): Promise<TaskItem[]> {
		const checkboxes: TaskItem[] = [];
		
		try {
			const content = await this.app.vault.cachedRead(file);
			const lines = content.split('\n');
			const fileCache = this.app.metadataCache.getFileCache(file);
			const listItems = fileCache?.listItems;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const checkboxMatch = CheckboxParsingUtils.findCheckboxInLine(line);
				
				if (checkboxMatch) {
					const indentationLevel = CheckboxParsingUtils.calculateTaskIndentation(i, listItems);

					checkboxes.push({
						file: file,
						lineNumber: i + 1,
						lineContent: line.trim(),
						checkboxText: line.trim(),
						sourceName: `Folder: ${this.config.folderPath}`,
						sourcePath: this.config.folderPath,
						indentationLevel
					});
					
					if (context.limit && checkboxes.length >= context.limit) {
						break;
					}
				}
			}
		} catch (error) {
			if (this.logger) {
				this.logger.error(`[OnTask FolderStrategy] Error reading file ${file.path}:`, error);
			}
		}

		return checkboxes;
	}

	public isTodayFile(file: TFile): boolean {
		return DateFileUtils.isTodayFile(file);
	}
}
