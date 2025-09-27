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
	public async findAllCheckboxes(hideCompleted: boolean = false, onlyShowToday: boolean = false): Promise<CheckboxItem[]> {
		const context: CheckboxFinderContext = {
			hideCompleted,
			onlyShowToday
		};

		const allCheckboxes: CheckboxItem[] = [];

		// Use all active strategies
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

		// Remove duplicates and sort by file modification time
		const uniqueCheckboxes = this.removeDuplicateCheckboxes(allCheckboxes);
		return this.sortCheckboxes(uniqueCheckboxes);
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
	 * Remove duplicate checkboxes (same file and line number)
	 */
	private removeDuplicateCheckboxes(checkboxes: CheckboxItem[]): CheckboxItem[] {
		const seen = new Set<string>();
		return checkboxes.filter(checkbox => {
			const key = `${checkbox.file.path}-${checkbox.lineNumber}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
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
}
