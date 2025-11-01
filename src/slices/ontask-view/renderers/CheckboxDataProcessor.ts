import { App, TFile } from 'obsidian';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';
import { Logger } from '../../logging/Logger';

/**
 * Processes checkbox data by grouping and sorting operations.
 */
export class CheckboxDataProcessor {
	constructor(
		private app: App,
		private getFileName: (filePath: string) => string,
		private logger?: Logger
	) {}

	/**
	 * Groups checkboxes by their file path.
	 */
	groupCheckboxesByFile(checkboxes: CheckboxItem[]): Map<string, CheckboxItem[]> {
		const grouped = new Map<string, CheckboxItem[]>();
		
		for (const checkbox of checkboxes) {
			const filePath = checkbox.file?.path || 'Unknown';
			if (!grouped.has(filePath)) {
				grouped.set(filePath, []);
			}
			grouped.get(filePath)!.push(checkbox);
		}
		
		return grouped;
	}

	/**
	 * Sorts files by date, either from filename date pattern or file modification time.
	 */
	sortFilesByDate(checkboxesByFile: Map<string, CheckboxItem[]>): Map<string, CheckboxItem[]> {
		const fileEntries = Array.from(checkboxesByFile.entries());
		
		fileEntries.sort((a, b) => {
			try {
				const fileNameA = this.getFileName(a[0]);
				const fileNameB = this.getFileName(b[0]);
				
				const dateMatchA = fileNameA.match(/(\d{4}-\d{2}-\d{2})/);
				const dateMatchB = fileNameB.match(/(\d{4}-\d{2}-\d{2})/);
				
				if (!dateMatchA || !dateMatchB) {
					const fileA = this.app.vault.getAbstractFileByPath(a[0]) as TFile;
					const fileB = this.app.vault.getAbstractFileByPath(b[0]) as TFile;
					
					if (!fileA || !fileB) {
						return 0;
					}
					
					const dateA = fileA.stat?.mtime || fileA.stat?.ctime || 0;
					const dateB = fileB.stat?.mtime || fileB.stat?.ctime || 0;
					
					return dateB - dateA;
				}
				
				const dateA = new Date(dateMatchA[1]);
				const dateB = new Date(dateMatchB[1]);
				
				return dateB.getTime() - dateA.getTime();
			} catch (error) {
				if (this.logger) {
					this.logger.error('[OnTask CheckboxDataProcessor] Error sorting files by date:', error);
				} else {
					console.error('CheckboxDataProcessor: Error sorting files by date:', error);
				}
				return 0;
			}
		});
		
		const sortedMap = new Map<string, any[]>();
		for (const [filePath, checkboxes] of fileEntries) {
			sortedMap.set(filePath, checkboxes);
		}
		
		return sortedMap;
	}
}

