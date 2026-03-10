import { App, MarkdownView, Plugin } from 'obsidian';
import { EditorIntegrationService } from './EditorIntegrationServiceInterface';
import { SettingsService, SettingsChangeEvent } from '../settings/SettingsServiceInterface';
import { StatusConfigService } from '../settings/StatusConfig';
import { TaskLoadingService } from '../ontask-view/services/TaskLoadingService';
import { EventSystem, EventData } from '../events/EventSystemInterface';
import { PluginAwareSliceService } from '../../shared/BaseSlice';
import { Logger } from '../logging/Logger';
import { CheckboxItem } from '../task-finder/TaskFinderInterfaces';

export class EditorIntegrationServiceImpl extends PluginAwareSliceService implements EditorIntegrationService {
	private app: App;
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private taskLoadingService: TaskLoadingService;
	private eventSystem: EventSystem;
	private logger: Logger;
	private statusBarItem: HTMLElement | null = null;
	private currentTopTask: CheckboxItem | null = null;
	private pendingDecorationUpdate: boolean = false;
	private updateRequestId: number | null = null;
	private topTaskMemory: CheckboxItem | null = null; // In-memory storage for current top task

	constructor(
		app: App,
		settingsService: SettingsService,
		statusConfigService: StatusConfigService,
		taskLoadingService: TaskLoadingService,
		eventSystem: EventSystem,
		plugin: Plugin,
		logger: Logger
	) {
		super();
		this.app = app;
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
		this.taskLoadingService = taskLoadingService;
		this.eventSystem = eventSystem;
		this.logger = logger;
		this.setPlugin(plugin);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		this.eventSystem.on<EventData<SettingsChangeEvent>>('settings:changed', (event: EventData<SettingsChangeEvent>) => {
			this.logger.debug('[OnTask Editor] Settings changed event received:', event.data);
			if (event.data?.key === 'showTopTaskInEditor') {
				this.logger.debug('[OnTask Editor] showTopTaskInEditor setting changed, scheduling decoration update');
				this.scheduleDecorationUpdate();
			} else if (event.data?.key === 'topTaskColor' || event.data?.key === 'useThemeDefaultColor') {
				this.logger.debug('[OnTask Editor] top task color setting changed, updating status bar color');
				this.updateStatusBarColors();
			}
		});

		this.eventSystem.on<EventData<{ topTask: CheckboxItem | null }>>('top-task:found', (event: EventData<{ topTask: CheckboxItem | null }>) => {
			this.logger.debug('[OnTask Editor] Top task found event received:', event.data);
			this.topTaskMemory = event.data?.topTask ?? null;
			if (this.isEnabled()) {
				this.logger.debug('[OnTask Editor] Editor integration enabled, scheduling decoration update');
				this.scheduleDecorationUpdate();
			} else {
				this.logger.debug('[OnTask Editor] Editor integration disabled, ignoring top task found event');
			}
		});

		this.eventSystem.on('top-task:cleared', () => {
			this.logger.debug('[OnTask Editor] Top task cleared event received');
			this.topTaskMemory = null;
			if (this.isEnabled()) {
				this.logger.debug('[OnTask Editor] Editor integration enabled, scheduling decoration update');
				this.scheduleDecorationUpdate();
			} else {
				this.logger.debug('[OnTask Editor] Editor integration disabled, ignoring top task cleared event');
			}
		});

		this.eventSystem.on('checkboxes:updated', () => {
			this.logger.debug('[OnTask Editor] Checkboxes updated event received');
			if (this.isEnabled()) {
				this.logger.debug('[OnTask Editor] Editor integration enabled, scheduling decoration update');
				this.scheduleDecorationUpdate();
			} else {
				this.logger.debug('[OnTask Editor] Editor integration disabled, ignoring checkboxes updated event');
			}
		});

		this.initialized = true;
		if (this.isEnabled()) {
			setTimeout(() => {
				this.findTopTaskIndependently();
			}, 1000);
		}
	}

	/**
	 * Schedule a decoration update using requestAnimationFrame for better performance
	 * This prevents multiple rapid updates and batches them into a single update
	 */
	private scheduleDecorationUpdate(): void {
		if (this.pendingDecorationUpdate) {
			return; // Already scheduled
		}

		this.pendingDecorationUpdate = true;

		if (this.updateRequestId !== null) {
			cancelAnimationFrame(this.updateRequestId);
		}

		this.updateRequestId = requestAnimationFrame(() => {
			this.pendingDecorationUpdate = false;
			this.updateRequestId = null;
			this.updateEditorDecorations();
		});
	}

	async updateEditorDecorations(): Promise<void> {
		if (!this.isEnabled()) {
			this.cleanup();
			return;
		}

		try {
			const topTask = this.topTaskMemory;

			const needsUpdate = !this.currentTopTask ||
				this.currentTopTask.lineContent !== topTask?.lineContent ||
				this.currentTopTask.file.path !== topTask?.file.path;

			if (!needsUpdate) {
				return;
			}

			this.currentTopTask = topTask;

			if (!topTask) {
				this.cleanup();
				return;
			}

			if (!this.statusBarItem) {
				const plugin = this.getPlugin();
				if (!plugin) return;
				this.statusBarItem = plugin.addStatusBarItem();
				this.statusBarItem.addClass('ontask-status-bar-item');
				this.statusBarItem.addEventListener('click', () => {
					this.app.workspace.openLinkText(topTask.file.path, '', true);
				});
			}

			if (!this.statusBarItem) return;

			this.statusBarItem.empty();
			this.statusBarItem.show();

			// Apply the configurable top task color
			this.updateStatusBarColors();

			const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
			const displayText = remainingText || 'Top task';

			const iconSpan = document.createElement('span');
			iconSpan.className = 'ontask-status-bar-icon';
			iconSpan.textContent = '🔥 ';

			const textSpan = document.createElement('span');
			textSpan.className = 'ontask-status-bar-text';
			textSpan.textContent = displayText;

			// Add ranking badge if task has topTaskRanking
			if (topTask.topTaskRanking !== undefined) {
				const rankingEl = document.createElement('span');
				rankingEl.textContent = ` Rank ${topTask.topTaskRanking}`;
				rankingEl.addClass('ontask-task-ranking');
				rankingEl.setAttribute('data-rank', topTask.topTaskRanking.toString());
				textSpan.appendChild(rankingEl);
			}

			this.statusBarItem.appendChild(iconSpan);
			this.statusBarItem.appendChild(textSpan);
			this.statusBarItem.setAttribute('title', `Top Task (From: ${topTask.file.name})`);

		} catch (error) {
			this.logger.error('[OnTask Editor] Error updating editor decorations:', error);
		}
	}

	private parseCheckboxLine(line: string): { remainingText: string } {
		const trimmedLine = line.trim();

		const bracketIndex = trimmedLine.indexOf(']');
		if (bracketIndex !== -1) {
			const remainingText = trimmedLine.substring(bracketIndex + 1).trim();
			return { remainingText };
		}

		return { remainingText: trimmedLine };
	}

	cleanup(): void {
		if (this.updateRequestId !== null) {
			cancelAnimationFrame(this.updateRequestId);
			this.updateRequestId = null;
		}
		this.pendingDecorationUpdate = false;

		if (this.statusBarItem) {
			this.statusBarItem.empty();
			this.statusBarItem.hide();
		}

		const editorContainers = document.querySelectorAll('.markdown-source-view, .markdown-preview-view');
		editorContainers.forEach(container => {
			const overlays = container.querySelectorAll('.ontask-toptask-hero-overlay');
			overlays.forEach((overlay: HTMLElement) => {
				overlay.remove();
			});
		});

		this.initialized = false;
	}

	isEnabled(): boolean {
		const settings = this.settingsService.getSettings();
		return settings.showTopTaskInEditor;
	}

	/**
	 * Find top task independently without relying on OnTask View
	 */
	private async findTopTaskIndependently(): Promise<void> {
		try {
			const settings = this.settingsService.getSettings();

			const onlyShowToday = settings.dateFilter === 'today';
			await this.taskLoadingService.initializeFileTracking(settings.dateFilter);
			const result = await this.taskLoadingService.loadTasksWithFiltering(settings);

			this.processTopTasks(result.tasks);

			const topTask = result.tasks.find(checkbox => checkbox.isTopTask);

			if (topTask) {
				this.topTaskMemory = topTask;
				this.scheduleDecorationUpdate();
			} else {
				this.topTaskMemory = null;
				this.scheduleDecorationUpdate();
			}
		} catch (error) {
			this.logger.error('[OnTask Editor] Error finding top task independently:', error);
		}
	}

	private processTopTasks(checkboxes: CheckboxItem[]): void {
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
			return;
		}

		// Build dynamic configs with regex patterns
		const dynamicConfigs = rankedStatusConfigs.map(config => ({
			symbol: config.symbol,
			name: config.name,
			pattern: new RegExp(`^\\s*-\\s*\\[${this.escapeRegex(config.symbol)}\\]\\s.*`),
			ranking: config.topTaskRanking
		}));

		const tasksByType: Record<string, CheckboxItem[]> = {};

		dynamicConfigs.forEach(config => {
			const matchingTasks = checkboxes.filter(checkbox => this.isTopTaskByConfig(checkbox, config));
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
	}

	/**
	 * Check if a checkbox matches the top task configuration
	 */
	private isTopTaskByConfig(checkbox: CheckboxItem, config: { symbol: string; name: string; pattern: RegExp }): boolean {
		return config.pattern.test(checkbox.lineContent);
	}

	/**
	 * Update the color of the status bar item when the setting changes
	 */
	private updateStatusBarColors(): void {
		if (!this.statusBarItem) return;
		const settings = this.settingsService.getSettings();
		const colorToUse = settings.useThemeDefaultColor ? 'var(--text-normal)' : settings.topTaskColor;
		this.statusBarItem.style.setProperty('color', colorToUse);
	}

	/**
	 * Escape special regex characters in a string
	 */
	private escapeRegex(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

}
