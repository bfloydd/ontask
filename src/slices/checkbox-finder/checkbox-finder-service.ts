import { App, TFile } from 'obsidian';
import { CheckboxItem, CheckboxFinderContext, CheckboxFinderStrategy } from './interfaces';
import { CheckboxFinderFactoryImpl } from './checkbox-finder-factory';
import { StreamsService } from '../streams';

// Re-export CheckboxItem for backward compatibility
export type { CheckboxItem } from './interfaces';

export class CheckboxFinderService {
	private app: App;
	private factory: CheckboxFinderFactoryImpl;
	private activeStrategies: string[] = ['streams']; // Default to streams strategy
	private fileContentCache: Map<string, { content: string; mtime: number }> = new Map();
	private lastRefreshTime: number = 0;
	private readonly CACHE_TTL = 30000; // 30 seconds cache TTL
	
	// File tracking for performance - track which files we've already scanned
	private scannedFiles: Set<string> = new Set();
	private allAvailableFiles: string[] = []; // Cache of all files we could potentially scan

	constructor(app: App, streamsService: StreamsService) {
		this.app = app;
		this.factory = new CheckboxFinderFactoryImpl(app, streamsService);
	}

	/**
	 * Set the active strategies for finding checkboxes
	 */
	public setActiveStrategies(strategies: string[]): void {
		this.activeStrategies = strategies;
	}

	/**
	 * Get the currently active strategies
	 */
	public getActiveStrategies(): string[] {
		return [...this.activeStrategies];
	}

	/**
	 * Add a strategy to the active strategies
	 */
	public addActiveStrategy(strategyName: string): void {
		if (!this.activeStrategies.includes(strategyName)) {
			this.activeStrategies.push(strategyName);
		}
	}

	/**
	 * Remove a strategy from the active strategies
	 */
	public removeActiveStrategy(strategyName: string): void {
		this.activeStrategies = this.activeStrategies.filter(s => s !== strategyName);
	}

	/**
	 * Get all available strategies
	 */
	public getAvailableStrategies(): string[] {
		return this.factory.getAvailableStrategies();
	}

	/**
	 * Get all ready strategies (available and ready to use)
	 */
	public getReadyStrategies(): string[] {
		return this.factory.getReadyStrategyNames();
	}

	/**
	 * Register a custom strategy
	 */
	public registerStrategy(name: string, strategy: CheckboxFinderStrategy): void {
		this.factory.registerStrategy(name, strategy);
	}

	/**
	 * Find all checkboxes with proper file tracking for performance
	 * Gets all files from strategy, sorts Z-A by filename, scans until 10 tasks found
	 */
	public async findAllCheckboxes(onlyShowToday: boolean = false, limit?: number): Promise<CheckboxItem[]> {
		// Initialize file list if not done yet
		if (this.allAvailableFiles.length === 0) {
			await this.initializeFileList(onlyShowToday);
		}

		console.log(`OnTask: Found ${this.allAvailableFiles.length} total files, ${this.scannedFiles.size} already scanned`);

		// Keep scanning files until we find enough tasks (performance optimization)
		const targetTasks = limit || 10;
		const allCheckboxes: CheckboxItem[] = [];
		let filesScanned: string[] = [];

		// Keep going through files until we find enough tasks
		while (allCheckboxes.length < targetTasks) {
			// Get next batch of unscanned files
			const unscannedFiles = this.getUnscannedFiles(5); // Scan 5 files at a time
			console.log(`OnTask: Will scan ${unscannedFiles.length} files:`, unscannedFiles);

			if (unscannedFiles.length === 0) {
				console.log('OnTask: No more files to scan');
				break; // No more files to scan
			}

			const context: CheckboxFinderContext = {
				onlyShowToday,
				limit: targetTasks - allCheckboxes.length, // Only get what we need
				filePaths: unscannedFiles // Pass specific files to scan
			};

			// Use all active strategies with file tracking
			for (const strategyName of this.activeStrategies) {
				const strategy = this.factory.createStrategy(strategyName);
				if (strategy && strategy.isAvailable()) {
					try {
						const strategyCheckboxes = await strategy.findCheckboxes(context);
						allCheckboxes.push(...strategyCheckboxes);
						
						// Stop scanning when we have enough tasks (performance optimization)
						if (allCheckboxes.length >= targetTasks) {
							console.log(`OnTask: Found ${allCheckboxes.length} tasks, stopping scan for performance`);
							break;
						}
					} catch (error) {
						console.error(`Error using ${strategyName} strategy:`, error);
					}
				}
			}
			
			// Mark files as scanned
			filesScanned.push(...unscannedFiles);
			this.markFilesAsScanned(unscannedFiles);
			
			// If we found enough tasks, stop
			if (allCheckboxes.length >= targetTasks) {
				break;
			}
		}
		
		// Remove duplicates but preserve original order (no sorting)
		const uniqueCheckboxes = this.removeDuplicateCheckboxes(allCheckboxes);
		
		console.log(`OnTask: Found ${uniqueCheckboxes.length} checkboxes from ${filesScanned.length} files`);
		console.log(`OnTask: Scanned files:`, filesScanned);
		console.log(`OnTask: Total scanned files: ${this.scannedFiles.size} of ${this.allAvailableFiles.length}`);
		
		// Update cache timestamp
		this.lastRefreshTime = Date.now();
		return uniqueCheckboxes;
	}

	/**
	 * Find more checkboxes for Load More functionality
	 * Continues from where we left off using file tracking
	 */
	public async findMoreCheckboxes(onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		// Continue from where we left off using file tracking
		return this.findAllCheckboxes(onlyShowToday, 10);
	}

	/**
	 * Find checkboxes using a specific strategy
	 */
	public async findCheckboxesByStrategy(strategyName: string, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const context: CheckboxFinderContext = {
			onlyShowToday
		};

		const strategy = this.factory.createStrategy(strategyName);
		if (!strategy || !strategy.isAvailable()) {
			console.log(`OnTask: Strategy ${strategyName} is not available`);
			return [];
		}

		try {
			return await strategy.findCheckboxes(context);
		} catch (error) {
			console.error(`Error using ${strategyName} strategy:`, error);
			return [];
		}
	}

	/**
	 * Get checkboxes by source name
	 */
	public async getCheckboxesBySource(sourceName: string, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const allCheckboxes = await this.findAllCheckboxes(onlyShowToday);
		return allCheckboxes.filter(checkbox => checkbox.sourceName === sourceName);
	}

	/**
	 * Get checkboxes by file
	 */
	public async getCheckboxesByFile(filePath: string, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const allCheckboxes = await this.findAllCheckboxes(onlyShowToday);
		return allCheckboxes.filter(checkbox => checkbox.file.path === filePath);
	}

	/**
	 * Create a folder strategy with specific configuration
	 */
	public createFolderStrategy(folderPath: string, recursive: boolean = true): CheckboxFinderStrategy {
		const config = {
			folderPath,
			recursive,
			includeSubfolders: recursive
		};
		return this.factory.createFolderStrategy(config);
	}

	/**
	 * Remove duplicate checkboxes (same file, line number, and content)
	 */
	private removeDuplicateCheckboxes(checkboxes: CheckboxItem[]): CheckboxItem[] {
		const seen = new Set<string>();
		const duplicates: CheckboxItem[] = [];
		
		const uniqueCheckboxes = checkboxes.filter(checkbox => {
			// Create a more specific key that includes content to avoid false positives
			const key = `${checkbox.file.path}-${checkbox.lineNumber}-${checkbox.lineContent.trim()}`;
			if (seen.has(key)) {
				duplicates.push(checkbox);
				return false;
			}
			seen.add(key);
			return true;
		});
		
		
		return uniqueCheckboxes;
	}

	/**
	 * Sort checkboxes by file modification time (most recent first)
	 */
	private sortCheckboxes(checkboxes: CheckboxItem[]): CheckboxItem[] {
		return checkboxes.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
	}

	/**
	 * Get the streams service (for backward compatibility)
	 */
	public get streamsService(): StreamsService {
		return (this.factory as any).streamsService;
	}

	/**
	 * Get the streams service directly
	 */
	public getStreamsService(): StreamsService {
		return (this.factory as any).streamsService;
	}

	/**
	 * Get cached file content if available and fresh
	 */
	private async getCachedFileContent(file: any): Promise<string | null> {
		const filePath = file.path;
		const cached = this.fileContentCache.get(filePath);
		
		if (cached && cached.mtime === file.stat.mtime) {
			return cached.content;
		}
		
		return null;
	}

	/**
	 * Cache file content for future use
	 */
	private cacheFileContent(file: any, content: string): void {
		this.fileContentCache.set(file.path, {
			content,
			mtime: file.stat.mtime
		});
	}

	/**
	 * Get cached checkboxes (simplified version for cache hits)
	 */
	private getCachedCheckboxes(context: CheckboxFinderContext): CheckboxItem[] {
		// For now, disable caching to avoid complexity and potential issues
		// The cache implementation needs more work to be truly effective
		return [];
	}

	/**
	 * Clear the file content cache
	 */
	public clearCache(): void {
		this.fileContentCache.clear();
		this.lastRefreshTime = 0;
	}

	/**
	 * Initialize the list of all available files (performance optimization)
	 */
	private async initializeFileList(onlyShowToday: boolean = false): Promise<void> {
		// Get files based on active strategies
		const allFiles = await this.getFilesForActiveStrategies(onlyShowToday);
		
		this.allAvailableFiles = allFiles;
		
		// Sort by filename only (Z-A order)
		this.allAvailableFiles.sort((a, b) => {
			const filenameA = a.split('/').pop() || a;
			const filenameB = b.split('/').pop() || b;
			return filenameB.localeCompare(filenameA);
		});
	}

	/**
	 * Get files based on active strategies
	 */
	private async getFilesForActiveStrategies(onlyShowToday: boolean = false): Promise<string[]> {
		const allFiles: string[] = [];
		
		// Get files from each active strategy
		for (const strategyName of this.activeStrategies) {
			const strategy = this.factory.createStrategy(strategyName);
			if (strategy && strategy.isAvailable()) {
				const strategyFiles = await this.getFilesForStrategy(strategy, onlyShowToday);
				allFiles.push(...strategyFiles);
			}
		}
		
		// Remove duplicates
		return [...new Set(allFiles)];
	}

	/**
	 * Get files for a specific strategy
	 */
	private async getFilesForStrategy(strategy: any, onlyShowToday: boolean = false): Promise<string[]> {
		if (strategy.getName() === 'streams') {
			// For streams strategy, get files from all streams
			const allStreams = this.streamsService.getAllStreams();
			const streams = allStreams.filter(stream => stream.folder && stream.folder.trim() !== '');
			const files: string[] = [];
			
			for (const stream of streams) {
				const streamFolder = this.app.vault.getAbstractFileByPath(stream.folder);
				if (streamFolder) {
					if (streamFolder instanceof TFile) {
						// Single file
						files.push(stream.folder);
					} else {
						// Directory - get all markdown files
						const streamFiles = this.app.vault.getMarkdownFiles().filter(file => 
							file.path.startsWith(stream.folder)
						);
						files.push(...streamFiles.map(file => file.path));
					}
				}
			}
			
			// Filter by today if needed
			if (onlyShowToday) {
				return files.filter(filePath => {
					const file = this.app.vault.getAbstractFileByPath(filePath);
					return file && this.isTodayFile(file);
				});
			}
			
			return files;
		} else {
			// For other strategies, use vault files
			const allFiles = this.app.vault.getMarkdownFiles();
			
			// Filter by today if needed
			if (onlyShowToday) {
				return allFiles
					.filter(file => this.isTodayFile(file))
					.map(file => file.path);
			}
			
			return allFiles.map(file => file.path);
		}
	}

	/**
	 * Get unscanned files (max count for performance)
	 */
	private getUnscannedFiles(maxCount: number): string[] {
		return this.allAvailableFiles
			.filter(filePath => !this.scannedFiles.has(filePath))
			.slice(0, maxCount);
	}

	/**
	 * Mark files as scanned
	 */
	private markFilesAsScanned(filePaths: string[]): void {
		filePaths.forEach(path => this.scannedFiles.add(path));
	}

	/**
	 * Check if a file is from today (based on filename patterns)
	 */
	private isTodayFile(file: any): boolean {
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

	/**
	 * Generate today's date in various formats
	 */
	private getTodayDateFormats(today: Date): string[] {
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		const monthName = today.toLocaleDateString('en-US', { month: 'long' });
		const monthNameShort = today.toLocaleDateString('en-US', { month: 'short' });
		const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
		const dayNameShort = today.toLocaleDateString('en-US', { weekday: 'short' });
		
		return [
			`${year}-${month}-${day}`,           // 2024-01-15
			`${month}-${day}-${year}`,            // 01-15-2024
			`${day}-${month}-${year}`,            // 15-01-2024
			`${year}${month}${day}`,               // 20240115
			`${month}${day}${year}`,              // 01152024
			`${day}${month}${year}`,              // 15012024
			`${monthName} ${day}, ${year}`,       // January 15, 2024
			`${monthNameShort} ${day}, ${year}`,  // Jan 15, 2024
			`${day} ${monthName} ${year}`,        // 15 January 2024
			`${day} ${monthNameShort} ${year}`,   // 15 Jan 2024
			`${dayName}, ${monthName} ${day}`,   // Monday, January 15
			`${dayNameShort}, ${monthName} ${day}`, // Mon, January 15
			`${dayName}`,                         // Monday
			`${dayNameShort}`,                    // Mon
		];
	}

	/**
	 * Generate regex patterns for date matching
	 */
	private getDatePatterns(today: Date): RegExp[] {
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		
		return [
			// YYYY-MM-DD pattern
			new RegExp(`${year}-${month}-${day}`),
			// MM-DD-YYYY pattern
			new RegExp(`${month}-${day}-${year}`),
			// DD-MM-YYYY pattern
			new RegExp(`${day}-${month}-${year}`),
			// YYYYMMDD pattern
			new RegExp(`${year}${month}${day}`),
			// MMDDYYYY pattern
			new RegExp(`${month}${day}${year}`),
			// DDMMYYYY pattern
			new RegExp(`${day}${month}${year}`),
		];
	}

	/**
	 * Reset file tracking (for refresh)
	 */
	public resetFileTracking(): void {
		this.scannedFiles.clear();
		this.allAvailableFiles = [];
	}

	/**
	 * Fallback method without file tracking (for debugging)
	 */
	public async findAllCheckboxesFallback(onlyShowToday: boolean = false, limit?: number): Promise<CheckboxItem[]> {
		console.log('OnTask: Using fallback method without file tracking');
		
		const context: CheckboxFinderContext = {
			onlyShowToday
			// Don't pass limit - we want to get ALL files from ALL streams, then sort them
		};

		const allCheckboxes: CheckboxItem[] = [];

		// Use all active strategies without file tracking
		for (const strategyName of this.activeStrategies) {
			const strategy = this.factory.createStrategy(strategyName);
			if (strategy && strategy.isAvailable()) {
				try {
					const strategyCheckboxes = await strategy.findCheckboxes(context);
					allCheckboxes.push(...strategyCheckboxes);
				} catch (error) {
					console.error(`Error using ${strategyName} strategy:`, error);
				}
			}
		}
		
		// Remove duplicates and sort by filename Z-A
		const uniqueCheckboxes = this.removeDuplicateCheckboxes(allCheckboxes);
		const sortedCheckboxes = this.sortCheckboxesByFilename(uniqueCheckboxes);
		
		console.log(`OnTask: Fallback found ${sortedCheckboxes.length} checkboxes`);
		
		// Update cache timestamp
		this.lastRefreshTime = Date.now();
		return sortedCheckboxes;
	}

	/**
	 * Sort checkboxes by filename Z-A (not by modification time)
	 */
	private sortCheckboxesByFilename(checkboxes: CheckboxItem[]): CheckboxItem[] {
		return checkboxes.sort((a, b) => {
			const filenameA = a.file?.path.split('/').pop() || a.file?.path || '';
			const filenameB = b.file?.path.split('/').pop() || b.file?.path || '';
			return filenameB.localeCompare(filenameA);
		});
	}

	/**
	 * Get cache statistics
	 */
	public getCacheStats(): { size: number; lastRefresh: number } {
		return {
			size: this.fileContentCache.size,
			lastRefresh: this.lastRefreshTime
		};
	}
}
