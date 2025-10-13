import { App, TFile } from 'obsidian';
import { CheckboxFinderStrategy, CheckboxItem, CheckboxFinderContext } from '../interfaces';
import { StreamsService } from '../../streams';

export class StreamsCheckboxStrategy implements CheckboxFinderStrategy {
	private app: App;
	private streamsService: StreamsService;

	constructor(app: App, streamsService: StreamsService) {
		this.app = app;
		this.streamsService = streamsService;
	}

	getName(): string {
		return 'streams';
	}

	isAvailable(): boolean {
		return this.streamsService.isStreamsPluginAvailable();
	}

	async findCheckboxes(context: CheckboxFinderContext): Promise<CheckboxItem[]> {
		const allCheckboxes: CheckboxItem[] = [];
		
		// If specific files are provided, scan only those files for performance
		if (context.filePaths && context.filePaths.length > 0) {
			for (const filePath of context.filePaths) {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file && file instanceof TFile) {
					const fileCheckboxes = await this.findCheckboxesInFile(file, { name: 'stream', folder: '' }, context);
					allCheckboxes.push(...fileCheckboxes);
				}
			}
		} else {
			// Fallback to original behavior if no specific files provided
			const allStreams = this.streamsService.getAllStreams();
			const streams = allStreams.filter(stream => stream.folder && stream.folder.trim() !== '');
			const limit = context.limit;

			for (const stream of streams) {
				const streamCheckboxes = await this.findCheckboxesInStream(stream, context);
				allCheckboxes.push(...streamCheckboxes);
				
				// Early termination if limit is reached
				if (limit && allCheckboxes.length >= limit) {
					break;
				}
			}
		}

		// Return checkboxes without top task processing (handled at view level)
		console.log(`Streams Strategy: Found ${allCheckboxes.length} checkboxes`);
		return allCheckboxes;
	}

	private async findCheckboxesInStream(stream: { name: string; folder: string }, context: CheckboxFinderContext): Promise<CheckboxItem[]> {
		const checkboxes: CheckboxItem[] = [];
		
		try {
			// Get all files in the stream directory
			const streamFolder = this.app.vault.getAbstractFileByPath(stream.folder);
			
			if (!streamFolder || !(streamFolder instanceof TFile)) {
				// If it's not a file, try to get files from the directory
				let files = this.app.vault.getMarkdownFiles().filter(file => 
					file.path.startsWith(stream.folder)
				);
				
				// Performance optimization: Filter files by today before reading their content
				if (context.onlyShowToday) {
					files = files.filter(file => this.isTodayFile(file));
				}
				
			// Process files sequentially for now to avoid complexity
			for (const file of files) {
				const fileCheckboxes = await this.findCheckboxesInFile(file, stream, context);
				checkboxes.push(...fileCheckboxes);
			}
			} else {
				// If it's a single file, check if it's from today before processing
				if (context.onlyShowToday && !this.isTodayFile(streamFolder)) {
					return checkboxes; // Skip this file entirely if it's not from today
				}
				
				const fileCheckboxes = await this.findCheckboxesInFile(streamFolder, stream, context);
				checkboxes.push(...fileCheckboxes);
			}
		} catch (error) {
			console.error(`Error searching stream ${stream.name}:`, error);
		}

		return checkboxes;
	}

	private async findCheckboxesInFile(file: TFile, stream: { name: string; folder: string }, context: CheckboxFinderContext): Promise<CheckboxItem[]> {
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
						lineNumber: i + 1, // 1-based line numbers
						lineContent: line.trim(),
						checkboxText: line.trim(),
						sourceName: 'Streams',
						sourcePath: stream.folder
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

}
