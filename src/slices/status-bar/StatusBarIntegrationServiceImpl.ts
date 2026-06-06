import { App, Plugin } from 'obsidian';
import { StatusBarIntegrationService } from './StatusBarIntegrationServiceInterface';
import { SettingsService, SettingsChangeEvent } from '../settings/SettingsServiceInterface';
import { StatusConfigService } from '../settings/StatusConfig';
import { TaskLoadingService } from '../ontask-view/services/TaskLoadingService';
import { EventSystem, EventData } from '../events/EventSystemInterface';
import { PluginAwareSliceService } from '../../shared/BaseSlice';
import { Logger } from '../logging/Logger';
import { CheckboxItem } from '../task-finder/TaskFinderInterfaces';

export class StatusBarIntegrationServiceImpl extends PluginAwareSliceService implements StatusBarIntegrationService {
	private app: App;
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private taskLoadingService: TaskLoadingService;
	private eventSystem: EventSystem;
	private logger: Logger;
	private statusBarItem: HTMLElement | null = null;
	private currentTopTask: CheckboxItem | null = null;
	private pendingDecorationUpdate = false;
	private updateRequestId: number | null = null;
	private topTaskMemory: CheckboxItem | null = null;

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
			this.logger.debug('[OnTask StatusBar] Settings changed event received:', event.data);
			if (event.data?.key === 'showTopTaskInStatusBar') {
				this.logger.debug('[OnTask StatusBar] showTopTaskInStatusBar setting changed, scheduling status bar update');
				this.scheduleStatusBarUpdate();
			} else if (event.data?.key === 'topTaskColor' || event.data?.key === 'useThemeDefaultColor') {
				this.logger.debug('[OnTask StatusBar] top task color setting changed, updating status bar color');
				this.updateStatusBarColors();
			}
		});

		this.eventSystem.on<EventData<{ topTask: CheckboxItem | null }>>('top-task:found', (event: EventData<{ topTask: CheckboxItem | null }>) => {
			this.logger.debug('[OnTask StatusBar] Top task found event received:', event.data);
			this.topTaskMemory = event.data?.topTask ?? null;
			if (this.isEnabled()) {
				this.logger.debug('[OnTask StatusBar] Status bar integration enabled, scheduling update');
				this.scheduleStatusBarUpdate();
			} else {
				this.logger.debug('[OnTask StatusBar] Status bar integration disabled, ignoring top task found event');
			}
		});

		this.eventSystem.on('top-task:cleared', () => {
			this.logger.debug('[OnTask StatusBar] Top task cleared event received');
			this.topTaskMemory = null;
			if (this.isEnabled()) {
				this.logger.debug('[OnTask StatusBar] Status bar integration enabled, scheduling update');
				this.scheduleStatusBarUpdate();
			} else {
				this.logger.debug('[OnTask StatusBar] Status bar integration disabled, ignoring top task cleared event');
			}
		});

		this.eventSystem.on('checkboxes:updated', () => {
			this.logger.debug('[OnTask StatusBar] Checkboxes updated event received');
			if (this.isEnabled()) {
				this.logger.debug('[OnTask StatusBar] Status bar integration enabled, scheduling update');
				this.scheduleStatusBarUpdate();
			} else {
				this.logger.debug('[OnTask StatusBar] Status bar integration disabled, ignoring checkboxes updated event');
			}
		});

		this.initialized = true;
		if (this.isEnabled()) {
			window.setTimeout(() => {
				void this.findTopTaskIndependently();
			}, 1000);
		}
	}

	private scheduleStatusBarUpdate(): void {
		if (this.pendingDecorationUpdate) {
			return;
		}

		this.pendingDecorationUpdate = true;

		if (this.updateRequestId !== null) {
			window.cancelAnimationFrame(this.updateRequestId);
		}

		this.updateRequestId = window.requestAnimationFrame(() => {
			this.pendingDecorationUpdate = false;
			this.updateRequestId = null;
			void this.updateStatusBar();
		});
	}

	async updateStatusBar(): Promise<void> {
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
					void this.app.workspace.openLinkText(topTask.file.path, '', true);
				});
			}

			if (!this.statusBarItem) return;

			this.statusBarItem.empty();
			this.statusBarItem.show();

			this.updateStatusBarColors();

			const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
			const displayText = remainingText || 'Top task';

			const iconSpan = activeDocument.createElement('span');
			iconSpan.className = 'ontask-status-bar-icon';
			iconSpan.textContent = '🔥 ';

			const textSpan = activeDocument.createElement('span');
			textSpan.className = 'ontask-status-bar-text';
			textSpan.textContent = displayText;

			if (topTask.topTaskRanking !== undefined) {
				const rankingEl = activeDocument.createElement('span');
				rankingEl.textContent = ` Rank ${topTask.topTaskRanking}`;
				rankingEl.addClass('ontask-task-ranking');
				rankingEl.setAttribute('data-rank', topTask.topTaskRanking.toString());
				textSpan.appendChild(rankingEl);
			}

			this.statusBarItem.appendChild(iconSpan);
			this.statusBarItem.appendChild(textSpan);
			this.statusBarItem.setAttribute('title', `Top Task (From: ${topTask.file.name})`);

		} catch (error) {
			this.logger.error('[OnTask StatusBar] Error updating status bar:', error);
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
			window.cancelAnimationFrame(this.updateRequestId);
			this.updateRequestId = null;
		}
		this.pendingDecorationUpdate = false;

		if (this.statusBarItem) {
			this.statusBarItem.empty();
			this.statusBarItem.hide();
		}

		this.initialized = false;
	}

	isEnabled(): boolean {
		const settings = this.settingsService.getSettings();
		return settings.showTopTaskInStatusBar;
	}

	private async findTopTaskIndependently(): Promise<void> {
		try {
			const settings = this.settingsService.getSettings();

			await this.taskLoadingService.initializeFileTracking(settings.dateFilter);
			const result = await this.taskLoadingService.loadTasksWithFiltering(settings);

			this.processTopTasks(result.tasks);

			const topTask = result.tasks.find(checkbox => checkbox.isTopTask);

			if (topTask) {
				this.topTaskMemory = topTask;
				this.scheduleStatusBarUpdate();
			} else {
				this.topTaskMemory = null;
				this.scheduleStatusBarUpdate();
			}
		} catch (error) {
			this.logger.error('[OnTask StatusBar] Error finding top task independently:', error);
		}
	}

	private processTopTasks(checkboxes: CheckboxItem[]): void {
		checkboxes.forEach(checkbox => {
			checkbox.isTopTask = false;
			checkbox.isTopTaskContender = false;
		});

		const allStatusConfigs = this.statusConfigService.getStatusConfigs();
		const rankedStatusConfigs = allStatusConfigs
			.filter(config => config.topTaskRanking !== undefined)
			.sort((a, b) => (a.topTaskRanking || 0) - (b.topTaskRanking || 0));

		if (rankedStatusConfigs.length === 0) {
			return;
		}

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

	private isTopTaskByConfig(checkbox: CheckboxItem, config: { symbol: string; name: string; pattern: RegExp }): boolean {
		return config.pattern.test(checkbox.lineContent);
	}

	private updateStatusBarColors(): void {
		if (!this.statusBarItem) return;
		const settings = this.settingsService.getSettings();
		const colorToUse = settings.useThemeDefaultColor ? 'var(--text-normal)' : settings.topTaskColor;
		this.statusBarItem.style.setProperty('color', colorToUse);
	}

	private escapeRegex(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}
