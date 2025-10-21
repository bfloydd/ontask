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
		const streamsStrategy = new StreamsTaskStrategy(this.app, this.streamsService);
		this.registerStrategy('streams', streamsStrategy);

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

	createFolderStrategy(config: FolderStrategyConfig): TaskFinderStrategy {
		return new FolderTaskStrategy(this.app, config);
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