import { TFile } from 'obsidian';

export interface TaskItem {
	file: TFile;
	lineNumber: number;
	lineContent: string;
	checkboxText: string;
	sourceName: string;
	sourcePath: string;
	isTopTask?: boolean;
	isTopTaskContender?: boolean;
}

// Backward compatibility
export type CheckboxItem = TaskItem;

export interface TaskFinderContext {
	onlyShowToday: boolean;
	limit?: number; // Optional limit for lazy loading
	filePaths?: string[]; // Specific files to scan (for performance)
}

// Backward compatibility
export type CheckboxFinderContext = TaskFinderContext;

export interface TaskFinderStrategy {
	/**
	 * Find all tasks using this strategy
	 */
	findCheckboxes(context: TaskFinderContext): Promise<TaskItem[]>;
	
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

// Backward compatibility
export type CheckboxFinderStrategy = TaskFinderStrategy;

export interface TaskFinderFactory {
	/**
	 * Create a strategy instance
	 */
	createStrategy(strategyName: string): TaskFinderStrategy | null;
	
	/**
	 * Get all available strategy names
	 */
	getAvailableStrategies(): string[];
	
	/**
	 * Register a new strategy
	 */
	registerStrategy(name: string, strategy: TaskFinderStrategy): void;
}

// Backward compatibility
export type CheckboxFinderFactory = TaskFinderFactory;
