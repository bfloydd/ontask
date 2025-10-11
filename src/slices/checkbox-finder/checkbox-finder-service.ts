import { App } from 'obsidian';
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
	 * Find all checkboxes using the active strategies
	 */
	public async findAllCheckboxes(hideCompleted: boolean = false, onlyShowToday: boolean = false, limit?: number): Promise<CheckboxItem[]> {
		const context: CheckboxFinderContext = {
			hideCompleted,
			onlyShowToday,
			limit
		};

		// Temporarily disable caching to avoid performance issues
		// TODO: Implement proper caching later

		const allCheckboxes: CheckboxItem[] = [];

		// Use all active strategies
		console.log(`OnTask: Using active strategies: ${this.activeStrategies.join(', ')}`);
		for (const strategyName of this.activeStrategies) {
			const strategy = this.factory.createStrategy(strategyName);
			if (strategy && strategy.isAvailable()) {
				try {
					const strategyCheckboxes = await strategy.findCheckboxes(context);
					allCheckboxes.push(...strategyCheckboxes);
					console.log(`OnTask: Found ${strategyCheckboxes.length} checkboxes using ${strategyName} strategy`);
				} catch (error) {
					console.error(`Error using ${strategyName} strategy:`, error);
				}
			} else {
				console.log(`OnTask: Strategy ${strategyName} is not available`);
			}
		}
		
		console.log(`OnTask: Total checkboxes before deduplication: ${allCheckboxes.length}`);

		// Remove duplicates and sort by file modification time
		const uniqueCheckboxes = this.removeDuplicateCheckboxes(allCheckboxes);
		const sortedCheckboxes = this.sortCheckboxes(uniqueCheckboxes);
		
		// Update cache timestamp
		this.lastRefreshTime = Date.now();
		
		console.log(`OnTask: Final unique checkboxes after deduplication: ${sortedCheckboxes.length}`);
		return sortedCheckboxes;
	}

	/**
	 * Find more checkboxes for Load More functionality
	 * This method loads additional checkboxes without the initial limit
	 */
	public async findMoreCheckboxes(hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		return this.findAllCheckboxes(hideCompleted, onlyShowToday); // No limit for Load More
	}

	/**
	 * Find checkboxes using a specific strategy
	 */
	public async findCheckboxesByStrategy(strategyName: string, hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const context: CheckboxFinderContext = {
			hideCompleted,
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
	public async getCheckboxesBySource(sourceName: string, hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const allCheckboxes = await this.findAllCheckboxes(hideCompleted, onlyShowToday);
		return allCheckboxes.filter(checkbox => checkbox.sourceName === sourceName);
	}

	/**
	 * Get checkboxes by file
	 */
	public async getCheckboxesByFile(filePath: string, hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const allCheckboxes = await this.findAllCheckboxes(hideCompleted, onlyShowToday);
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
				console.log(`OnTask: Duplicate checkbox found: ${checkbox.file.path}:${checkbox.lineNumber} - "${checkbox.lineContent.trim()}"`);
				return false;
			}
			seen.add(key);
			return true;
		});
		
		if (duplicates.length > 0) {
			console.log(`OnTask: Removed ${duplicates.length} duplicate checkboxes`);
		}
		
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
	 * Get cache statistics
	 */
	public getCacheStats(): { size: number; lastRefresh: number } {
		return {
			size: this.fileContentCache.size,
			lastRefresh: this.lastRefreshTime
		};
	}
}
