import { TFile } from 'obsidian';

/**
 * Utility functions for working with date-based file naming patterns
 */
export class DateFileUtils {
	/**
	 * Checks if a file name or path contains today's date in various formats
	 * @param file - The file to check
	 * @returns true if the file appears to be from today
	 */
	static isTodayFile(file: TFile): boolean {
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

	/**
	 * Gets date format strings for today in various formats
	 * @param today - The date to format
	 * @returns Array of date format strings
	 */
	private static getTodayDateFormats(today: Date): string[] {
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

	/**
	 * Gets regex patterns for matching today's date in various formats
	 * @param today - The date to create patterns for
	 * @returns Array of regex patterns
	 */
	private static getDatePatterns(today: Date): RegExp[] {
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



