import { EventSystem } from '../../events';

export interface TopTaskProcessingServiceInterface {
	processTopTasksFromDisplayedTasks(checkboxes: any[]): void;
	isTopTaskByConfig(checkbox: any, config: { symbol: string; name: string; pattern: RegExp }): boolean;
	getTopTaskConfig(): readonly { symbol: string; name: string; pattern: RegExp }[];
}

export class TopTaskProcessingService implements TopTaskProcessingServiceInterface {
	private eventSystem: EventSystem;

	/**
	 * Top task configuration - easily modifiable priority order
	 * Each entry defines: symbol, name, and regex pattern for detection
	 */
	private static readonly TOP_TASK_CONFIG = [
		{
			symbol: '/',
			name: 'slash',
			pattern: /^-\s*\[\/([^\]]*)\]/
		},
		{
			symbol: '!',
			name: 'exclamation', 
			pattern: /^-\s*\[!([^\]]*)\]/
		},
		{
			symbol: '+',
			name: 'plus',
			pattern: /^-\s*\[\+([^\]]*)\]/
		}
	] as const;

	constructor(eventSystem: EventSystem) {
		this.eventSystem = eventSystem;
	}

	processTopTasksFromDisplayedTasks(checkboxes: any[]): void {
		console.log('TopTaskProcessingService: Processing top tasks from displayed tasks');
		
		// First, clear any existing top task markers
		checkboxes.forEach(checkbox => {
			checkbox.isTopTask = false;
			checkbox.isTopTaskContender = false;
		});
		
		// Find tasks for each priority level using declarative config
		const taskCounts: Record<string, number> = {};
		const tasksByType: Record<string, any[]> = {};
		
		TopTaskProcessingService.TOP_TASK_CONFIG.forEach(config => {
			const matchingTasks = checkboxes.filter(checkbox => this.isTopTaskByConfig(checkbox, config));
			taskCounts[config.name] = matchingTasks.length;
			tasksByType[config.name] = matchingTasks;
		});
		
		console.log('TopTaskProcessingService: Found tasks:', taskCounts);
		
		// Find the highest priority task type that has tasks
		let finalTopTask: any = null;
		for (const config of TopTaskProcessingService.TOP_TASK_CONFIG) {
			const tasks = tasksByType[config.name];
			if (tasks.length > 0) {
				// Sort by file modification time (most recent first)
				tasks.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				finalTopTask = tasks[0];
				finalTopTask.isTopTask = true;
				console.log(`TopTaskProcessingService: Selected ${config.name} task as top task:`, finalTopTask.lineContent);
				break;
			}
		}
		
		if (finalTopTask) {
			console.log('TopTaskProcessingService: Top task selected:', {
				lineContent: finalTopTask.lineContent,
				file: finalTopTask.file?.path,
				isTopTask: finalTopTask.isTopTask
			});
			
			// Emit top task found event for other components to use
			this.eventSystem.emit('top-task:found', {
				topTask: finalTopTask
			});
		} else {
			console.log('TopTaskProcessingService: No top task found in displayed tasks');
			
			// Emit top task cleared event
			this.eventSystem.emit('top-task:cleared', {});
		}
	}

	isTopTaskByConfig(checkbox: any, config: { symbol: string; name: string; pattern: RegExp }): boolean {
		const line = checkbox.lineContent;
		return config.pattern.test(line);
	}

	getTopTaskConfig(): readonly { symbol: string; name: string; pattern: RegExp }[] {
		return TopTaskProcessingService.TOP_TASK_CONFIG;
	}
}
