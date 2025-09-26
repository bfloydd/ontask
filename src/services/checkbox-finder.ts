import { App, TFile } from 'obsidian';
import { StreamsService } from './streams';

export interface CheckboxItem {
	file: TFile;
	lineNumber: number;
	lineContent: string;
	checkboxText: string;
	streamName: string;
	streamPath: string;
}

export class CheckboxFinderService {
	private app: App;
	private streamsService: StreamsService;

	constructor(app: App, streamsService: StreamsService) {
		this.app = app;
		this.streamsService = streamsService;
	}

	/**
	 * Find all checkboxes in all streams
	 */
	public async findAllCheckboxes(hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const streams = this.streamsService.getAllStreams();
		const allCheckboxes: CheckboxItem[] = [];

		if (onlyShowToday) {
			const today = new Date();
			const todayString = today.toISOString().split('T')[0];
			console.log(`OnTask: Searching for files dated ${todayString} (Only Show Today enabled)`);
		}

		for (const stream of streams) {
			const streamCheckboxes = await this.findCheckboxesInStream(stream, hideCompleted, onlyShowToday);
			allCheckboxes.push(...streamCheckboxes);
		}

		if (onlyShowToday) {
			console.log(`OnTask: Found ${allCheckboxes.length} checkboxes from today's files`);
		}

		return allCheckboxes;
	}

	/**
	 * Find checkboxes in a specific stream
	 */
	private async findCheckboxesInStream(stream: { name: string; path: string }, hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const checkboxes: CheckboxItem[] = [];
		
		try {
			// Get all files in the stream directory
			const streamFolder = this.app.vault.getAbstractFileByPath(stream.path);
			if (!streamFolder || !(streamFolder instanceof TFile)) {
				// If it's not a file, try to get files from the directory
				let files = this.app.vault.getMarkdownFiles().filter(file => 
					file.path.startsWith(stream.path)
				);
				
				// Performance optimization: Filter files by today before reading their content
				if (onlyShowToday) {
					const originalCount = files.length;
					files = files.filter(file => this.isTodayFile(file));
					console.log(`OnTask: Filtered ${originalCount} files to ${files.length} today's files for performance`);
				}
				
				for (const file of files) {
					const fileCheckboxes = await this.findCheckboxesInFile(file, stream, hideCompleted, onlyShowToday);
					checkboxes.push(...fileCheckboxes);
				}
			} else {
				// If it's a single file, check if it's from today before processing
				if (onlyShowToday && !this.isTodayFile(streamFolder)) {
					return checkboxes; // Skip this file entirely if it's not from today
				}
				
				const fileCheckboxes = await this.findCheckboxesInFile(streamFolder, stream, hideCompleted, onlyShowToday);
				checkboxes.push(...fileCheckboxes);
			}
		} catch (error) {
			console.error(`Error searching stream ${stream.name}:`, error);
		}

		return checkboxes;
	}

	/**
	 * Find checkboxes in a specific file
	 */
	private async findCheckboxesInFile(file: TFile, stream: { name: string; path: string }, hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
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
					if (hideCompleted && isCompleted) {
						continue; // Skip completed checkboxes when hideCompleted is true
					}
					
					// Note: onlyShowToday filtering is now done at the stream level for better performance
					
					checkboxes.push({
						file: file,
						lineNumber: i + 1, // 1-based line numbers
						lineContent: line.trim(),
						checkboxText: line.trim(), // Show the entire line, not just the checkbox
						streamName: stream.name,
						streamPath: stream.path
					});
				}
			}
		} catch (error) {
			console.error(`Error reading file ${file.path}:`, error);
		}

		return checkboxes;
	}

	/**
	 * Find checkbox in a single line using string methods instead of regex
	 */
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

	/**
	 * Check if a checkbox line is completed (checked)
	 */
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

	/**
	 * Get checkboxes by stream name
	 */
	public async getCheckboxesByStream(streamName: string, hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const allCheckboxes = await this.findAllCheckboxes(hideCompleted, onlyShowToday);
		return allCheckboxes.filter(checkbox => checkbox.streamName === streamName);
	}

	/**
	 * Get checkboxes by file
	 */
	public async getCheckboxesByFile(filePath: string, hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const allCheckboxes = await this.findAllCheckboxes(hideCompleted, onlyShowToday);
		return allCheckboxes.filter(checkbox => checkbox.file.path === filePath);
	}

	/**
	 * Check if a file is specifically dated for today (not just created/modified today)
	 */
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

	/**
	 * Get various date formats for today
	 */
	private getTodayDateFormats(today: Date): string[] {
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		
		return [
			`${year}-${month}-${day}`,           // 2024-01-15
			`${year}${month}${day}`,             // 20240115
			`${year}-${month}-${day}`,           // 2024-01-15
			`${month}-${day}-${year}`,           // 01-15-2024
			`${month}/${day}/${year}`,           // 01/15/2024
			`${day}-${month}-${year}`,           // 15-01-2024
			`${day}/${month}/${year}`,           // 15/01/2024
			`${year}${month}${day}`,             // 20240115
			`${month}${day}${year}`,             // 01152024
			`${day}${month}${year}`,             // 15012024
		];
	}

	/**
	 * Get regex patterns for today's date
	 */
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
