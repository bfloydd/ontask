import { TFile } from 'obsidian';

export interface CheckboxItem {
	file: TFile;
	lineNumber: number;
	lineContent: string;
	checkboxText: string;
	sourceName: string;
	sourcePath: string;
	isTopTask?: boolean;
	isTopTaskContender?: boolean;
}

export interface CheckboxFinderContext {
	hideCompleted: boolean;
	onlyShowToday: boolean;
	limit?: number; // Optional limit for lazy loading
}

export interface CheckboxFinderStrategy {
	/**
	 * Find all checkboxes using this strategy
	 */
	findCheckboxes(context: CheckboxFinderContext): Promise<CheckboxItem[]>;
	
	/**
	 * Get the name of this strategy
	 */
	getName(): string;
	
	/**
	 * Check if this strategy is available/ready
	 */
	isAvailable(): boolean;
	
	/**
	 * Get configuration options for this strategy
	 */
	getConfiguration?(): Record<string, any>;
}

export interface CheckboxFinderFactory {
	/**
	 * Create a strategy instance
	 */
	createStrategy(strategyName: string): CheckboxFinderStrategy | null;
	
	/**
	 * Get all available strategy names
	 */
	getAvailableStrategies(): string[];
	
	/**
	 * Register a new strategy
	 */
	registerStrategy(name: string, strategy: CheckboxFinderStrategy): void;
}
