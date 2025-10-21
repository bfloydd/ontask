import { App } from 'obsidian';
import { TaskFinderStrategy, TaskFinderFactory } from './TaskFinderInterfaces';
import { StreamsTaskStrategy } from './strategies/StreamsTaskStrategy';
import { DailyNotesTaskStrategy } from './strategies/DailyNotesTaskStrategy';
import { FolderTaskStrategy, FolderStrategyConfig } from './strategies/FolderTaskStrategy';
import { StreamsService } from '../streams';

export class TaskFinderFactoryImpl implements TaskFinderFactory {
	private app: App;
	private strategies: Map<string, TaskFinderStrategy> = new Map();
	private streamsService: StreamsService;

	constructor(app: App, streamsService: StreamsService) {
		this.app = app;
		this.streamsService = streamsService;
		this.initializeDefaultStrategies();
	}

	private initializeDefaultStrategies(): void {
		// Register the streams strategy
		const streamsStrategy = new StreamsTaskStrategy(this.app, this.streamsService);
		this.registerStrategy('streams', streamsStrategy);

		// Register the daily notes strategy
		const dailyNotesStrategy = new DailyNotesTaskStrategy(this.app);
		this.registerStrategy('daily-notes', dailyNotesStrategy);
	}

	createStrategy(strategyName: string): TaskFinderStrategy | null {
		return this.strategies.get(strategyName) || null;
	}

	getAvailableStrategies(): string[] {
		return Array.from(this.strategies.keys());
	}

	registerStrategy(name: string, strategy: TaskFinderStrategy): void {
		this.strategies.set(name, strategy);
	}

	/**
	 * Create a folder strategy with specific configuration
	 */
	createFolderStrategy(config: FolderStrategyConfig): TaskFinderStrategy {
		return new FolderTaskStrategy(this.app, config);
	}

	/**
	 * Get all available strategies that are ready to use
	 */
	getReadyStrategies(): TaskFinderStrategy[] {
		return Array.from(this.strategies.values()).filter(strategy => strategy.isAvailable());
	}

	/**
	 * Get strategy names that are ready to use
	 */
	getReadyStrategyNames(): string[] {
		return this.getReadyStrategies().map(strategy => strategy.getName());
	}

	/**
	 * Get the streams service for direct access
	 */
	getStreamsService(): StreamsService {
		return this.streamsService;
	}
}