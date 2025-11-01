import { App } from 'obsidian';
import { TaskFinderStrategy, TaskFinderFactory } from './TaskFinderInterfaces';
import { StreamsTaskStrategy } from './strategies/StreamsTaskStrategy';
import { DailyNotesTaskStrategy } from './strategies/DailyNotesTaskStrategy';
import { FolderTaskStrategy, FolderStrategyConfig } from './strategies/FolderTaskStrategy';
import { StreamsService } from '../streams';
import { Logger } from '../logging/Logger';

export class TaskFinderFactoryImpl implements TaskFinderFactory {
	private app: App;
	private strategies: Map<string, TaskFinderStrategy> = new Map();
	private streamsService: StreamsService;
	private logger?: Logger;

	constructor(app: App, streamsService: StreamsService, logger?: Logger) {
		this.app = app;
		this.streamsService = streamsService;
		this.logger = logger;
		this.initializeDefaultStrategies();
	}

	private initializeDefaultStrategies(): void {
		const streamsStrategy = new StreamsTaskStrategy(this.app, this.streamsService, this.logger);
		this.registerStrategy('streams', streamsStrategy);

		const dailyNotesStrategy = new DailyNotesTaskStrategy(this.app, this.logger);
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

	createFolderStrategy(config: FolderStrategyConfig): TaskFinderStrategy {
		return new FolderTaskStrategy(this.app, config, this.logger);
	}

	getReadyStrategies(): TaskFinderStrategy[] {
		return Array.from(this.strategies.values()).filter(strategy => strategy.isAvailable());
	}

	getReadyStrategyNames(): string[] {
		return this.getReadyStrategies().map(strategy => strategy.getName());
	}

	getStreamsService(): StreamsService {
		return this.streamsService;
	}
}