import { App } from 'obsidian';
import { CheckboxFinderStrategy, CheckboxFinderFactory } from './interfaces';
import { StreamsCheckboxStrategy } from './strategies/streams-strategy';
import { DailyNotesCheckboxStrategy } from './strategies/daily-notes-strategy';
import { FolderCheckboxStrategy, FolderStrategyConfig } from './strategies/folder-strategy';
import { StreamsService } from '../streams';

export class CheckboxFinderFactoryImpl implements CheckboxFinderFactory {
	private app: App;
	private strategies: Map<string, CheckboxFinderStrategy> = new Map();
	private streamsService: StreamsService;

	constructor(app: App, streamsService: StreamsService) {
		this.app = app;
		this.streamsService = streamsService;
		this.initializeDefaultStrategies();
	}

	private initializeDefaultStrategies(): void {
		// Register the streams strategy
		const streamsStrategy = new StreamsCheckboxStrategy(this.app, this.streamsService);
		this.registerStrategy('streams', streamsStrategy);

		// Register the daily notes strategy
		const dailyNotesStrategy = new DailyNotesCheckboxStrategy(this.app);
		this.registerStrategy('daily-notes', dailyNotesStrategy);
	}

	createStrategy(strategyName: string): CheckboxFinderStrategy | null {
		return this.strategies.get(strategyName) || null;
	}

	getAvailableStrategies(): string[] {
		return Array.from(this.strategies.keys());
	}

	registerStrategy(name: string, strategy: CheckboxFinderStrategy): void {
		this.strategies.set(name, strategy);
	}

	/**
	 * Create a folder strategy with specific configuration
	 */
	createFolderStrategy(config: FolderStrategyConfig): CheckboxFinderStrategy {
		return new FolderCheckboxStrategy(this.app, config);
	}

	/**
	 * Get all available strategies that are ready to use
	 */
	getReadyStrategies(): CheckboxFinderStrategy[] {
		return Array.from(this.strategies.values()).filter(strategy => strategy.isAvailable());
	}

	/**
	 * Get strategy names that are ready to use
	 */
	getReadyStrategyNames(): string[] {
		return this.getReadyStrategies().map(strategy => strategy.getName());
	}
}
