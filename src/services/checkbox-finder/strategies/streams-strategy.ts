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
		const allStreams = this.streamsService.getAllStreams();
		// Filter out streams with empty folder paths to prevent processing all files
		const streams = allStreams.filter(stream => stream.folder && stream.folder.trim() !== '');
		const allCheckboxes: CheckboxItem[] = [];

		if (context.onlyShowToday) {
			const today = new Date();
			const todayString = today.toISOString().split('T')[0];
			console.log(`OnTask: Searching for files dated ${todayString} (Only Show Today enabled)`);
		}

		for (const stream of streams) {
			const streamCheckboxes = await this.findCheckboxesInStream(stream, context);
			allCheckboxes.push(...streamCheckboxes);
		}

		if (context.onlyShowToday) {
			console.log(`OnTask: Found ${allCheckboxes.length} checkboxes from today's files`);
		}

		// Process and prioritize top tasks
		return this.processTopTasks(allCheckboxes);
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
					const originalCount = files.length;
					files = files.filter(file => this.isTodayFile(file));
					console.log(`OnTask: Filtered ${originalCount} files to ${files.length} today's files for performance`);
				}
				
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
					// Check if this is a completed checkbox and if we should hide it
					const isCompleted = this.isCheckboxCompleted(line);
					if (context.hideCompleted && isCompleted) {
						continue; // Skip completed checkboxes when hideCompleted is true
					}
					
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

		console.log(`OnTask: Found ${topTasks.length} top tasks, using most recent: ${finalTopTask ? finalTopTask.file.name : 'none'}`);
		
		return result;
	}

	private isTopTask(checkbox: CheckboxItem): boolean {
		const line = checkbox.lineContent;
		
		// Look for the pattern: - [!] or - [!x] or - [! ] etc.
		const checkboxMatch = line.match(/^-\s*\[!([^\]]*)\]/);
		
		return checkboxMatch !== null;
	}
}
