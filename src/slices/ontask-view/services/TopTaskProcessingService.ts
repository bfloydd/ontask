import { EventSystem } from '../../events';
import { Logger } from '../../logging/Logger';
import { StatusConfigService } from '../../settings/StatusConfig';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';

export interface TopTaskProcessingServiceInterface {
	processTopTasksFromDisplayedTasks(checkboxes: CheckboxItem[]): void;
	isTopTaskByConfig(checkbox: CheckboxItem, config: { symbol: string; name: string; pattern: RegExp }): boolean;
	getTopTaskConfig(): readonly { symbol: string; name: string; pattern: RegExp }[];
}

export class TopTaskProcessingService implements TopTaskProcessingServiceInterface {
	private eventSystem: EventSystem;
	private logger: Logger;
	private statusConfigService: StatusConfigService;

	constructor(eventSystem: EventSystem, logger: Logger, statusConfigService: StatusConfigService) {
		this.eventSystem = eventSystem;
		this.logger = logger;
		this.statusConfigService = statusConfigService;
	}

	processTopTasksFromDisplayedTasks(checkboxes: CheckboxItem[]): void {
		checkboxes.forEach(checkbox => {
			checkbox.isTopTask = false;
			checkbox.isTopTaskContender = false;
		});
		
		// Get all status configs with topTaskRanking defined
		const allStatusConfigs = this.statusConfigService.getStatusConfigs();
		const rankedStatusConfigs = allStatusConfigs
			.filter(config => config.topTaskRanking !== undefined)
			.sort((a, b) => (a.topTaskRanking || 0) - (b.topTaskRanking || 0));
		
		if (rankedStatusConfigs.length === 0) {
			this.logger.debug('[OnTask TopTask] No status configs with topTaskRanking found');
			this.eventSystem.emit('top-task:cleared', {});
			return;
		}
		
		// Build dynamic configs with regex patterns
		const dynamicConfigs = rankedStatusConfigs.map(config => ({
			symbol: config.symbol,
			name: config.name,
			pattern: new RegExp(`^\\s*-\\s*\\[${this.escapeRegex(config.symbol)}\\]\\s.*`),
			ranking: config.topTaskRanking
		}));
		
		const taskCounts: Record<string, number> = {};
		const tasksByType: Record<string, CheckboxItem[]> = {};
		
		dynamicConfigs.forEach(config => {
			const matchingTasks = checkboxes.filter(checkbox => this.isTopTaskByConfig(checkbox, config));
			taskCounts[config.name] = matchingTasks.length;
			tasksByType[config.name] = matchingTasks;
			
			// Mark tasks with ranking for UI display
			matchingTasks.forEach(task => {
				task.topTaskRanking = config.ranking;
			});
		});
		
		let finalTopTask: CheckboxItem | null = null;
		for (const config of dynamicConfigs) {
			const tasks = tasksByType[config.name];
			if (tasks.length > 0) {
				tasks.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				finalTopTask = tasks[0];
				finalTopTask.isTopTask = true;
				break;
			}
		}
		
		if (finalTopTask) {
			this.logger.debug('[OnTask TopTask] Emitting top-task:found event for', finalTopTask.file.name, 'line', finalTopTask.lineNumber);
			this.eventSystem.emit('top-task:found', {
				topTask: finalTopTask
			});
		} else {
			this.logger.debug('[OnTask TopTask] Emitting top-task:cleared event - no top task found');
			this.eventSystem.emit('top-task:cleared', {});
		}
	}

	isTopTaskByConfig(checkbox: CheckboxItem, config: { symbol: string; name: string; pattern: RegExp }): boolean {
		const line = checkbox.lineContent;
		return config.pattern.test(line);
	}

	getTopTaskConfig(): readonly { symbol: string; name: string; pattern: RegExp }[] {
		// Get all status configs with topTaskRanking defined
		const allStatusConfigs = this.statusConfigService.getStatusConfigs();
		const rankedStatusConfigs = allStatusConfigs
			.filter(config => config.topTaskRanking !== undefined)
			.sort((a, b) => (a.topTaskRanking || 0) - (b.topTaskRanking || 0));
		
		return rankedStatusConfigs.map(config => ({
			symbol: config.symbol,
			name: config.name,
			pattern: new RegExp(`^\\s*-\\s*\\[${this.escapeRegex(config.symbol)}\\]\\s.*`)
		}));
	}

	/**
	 * Escape special regex characters in a string
	 */
	private escapeRegex(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}

