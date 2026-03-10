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
		return this.isFileForDate(file, new Date());
	}

	/**
	 * Checks if a file name or path contains a date within the current week
	 * (Monday through Sunday of the current week, based on the local clock).
	 */
	static isCurrentWeekFile(file: TFile): boolean {
		const moment = (window as any).moment;
		if (moment) {
			const currentMoment = moment();
			const weekStart = currentMoment.clone().startOf('week');

			// Check standard YYYY-MM-DD patterns for each day of the week
			for (let i = 0; i < 7; i++) {
				const day = weekStart.clone().add(i, 'days').toDate();
				if (this.isFileForDate(file, day)) {
					return true;
				}
			}

			// Also support literal weekly patterns in the filename (e.g. 2026-W11)
			const weekFormats = [
				currentMoment.format('GGGG-[W]WW'),
				currentMoment.format('gggg-[w]ww'),
				currentMoment.format('YYYY-[W]ww')
			];

			const fileName = file.name.toLowerCase();
			const filePath = file.path.toLowerCase();

			for (const fmt of weekFormats) {
				const fmtLower = fmt.toLowerCase();
				if (fileName.includes(fmtLower) || filePath.includes(fmtLower)) {
					return true;
				}
			}
			return false;
		}

		// Fallback if moment is unavailable
		const weekStartFallback = this.getStartOfCurrentWeek(new Date());
		for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
			const day = new Date(weekStartFallback);
			day.setDate(weekStartFallback.getDate() + dayOffset);
			if (this.isFileForDate(file, day)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Checks if a file name/path contains the specified date in any supported format.
	 */
	private static isFileForDate(file: TFile, date: Date): boolean {
		const dateFormats = this.getDateFormats(date);
		const fileName = file.name.toLowerCase();
		const filePath = file.path.toLowerCase();

		for (const dateFormat of dateFormats) {
			if (fileName.includes(dateFormat) || filePath.includes(dateFormat)) {
				return true;
			}
		}

		const datePatterns = this.getDatePatterns(date);
		for (const pattern of datePatterns) {
			if (pattern.test(fileName) || pattern.test(filePath)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Gets the Monday (start of day) for the week containing the given date.
	 */
	private static getStartOfCurrentWeek(referenceDate: Date): Date {
		const date = new Date(referenceDate);
		date.setHours(0, 0, 0, 0);

		// JS: Sunday=0, Monday=1, ... Saturday=6
		// Convert to Monday-based offset where Monday=0 ... Sunday=6
		const day = date.getDay();
		const diffToMonday = (day + 6) % 7;
		date.setDate(date.getDate() - diffToMonday);

		return date;
	}

	/**
	 * Gets date format strings in various formats
	 * @param date - The date to format
	 * @returns Array of date format strings
	 */
	private static getDateFormats(date: Date): string[] {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

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
	 * @param date - The date to create patterns for
	 * @returns Array of regex patterns
	 */
	private static getDatePatterns(date: Date): RegExp[] {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

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





