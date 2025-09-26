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
	public async findAllCheckboxes(): Promise<CheckboxItem[]> {
		const streams = this.streamsService.getAllStreams();
		const allCheckboxes: CheckboxItem[] = [];

		for (const stream of streams) {
			const streamCheckboxes = await this.findCheckboxesInStream(stream);
			allCheckboxes.push(...streamCheckboxes);
		}

		return allCheckboxes;
	}

	/**
	 * Find checkboxes in a specific stream
	 */
	private async findCheckboxesInStream(stream: { name: string; path: string }): Promise<CheckboxItem[]> {
		const checkboxes: CheckboxItem[] = [];
		
		try {
			// Get all files in the stream directory
			const streamFolder = this.app.vault.getAbstractFileByPath(stream.path);
			if (!streamFolder || !(streamFolder instanceof TFile)) {
				// If it's not a file, try to get files from the directory
				const files = this.app.vault.getMarkdownFiles().filter(file => 
					file.path.startsWith(stream.path)
				);
				
				for (const file of files) {
					const fileCheckboxes = await this.findCheckboxesInFile(file, stream);
					checkboxes.push(...fileCheckboxes);
				}
			} else {
				// If it's a single file
				const fileCheckboxes = await this.findCheckboxesInFile(streamFolder, stream);
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
	private async findCheckboxesInFile(file: TFile, stream: { name: string; path: string }): Promise<CheckboxItem[]> {
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
	 * Get checkboxes by stream name
	 */
	public async getCheckboxesByStream(streamName: string): Promise<CheckboxItem[]> {
		const allCheckboxes = await this.findAllCheckboxes();
		return allCheckboxes.filter(checkbox => checkbox.streamName === streamName);
	}

	/**
	 * Get checkboxes by file
	 */
	public async getCheckboxesByFile(filePath: string): Promise<CheckboxItem[]> {
		const allCheckboxes = await this.findAllCheckboxes();
		return allCheckboxes.filter(checkbox => checkbox.file.path === filePath);
	}
}
