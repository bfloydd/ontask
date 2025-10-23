import { App, Plugin } from 'obsidian';
import { PluginOrchestrator, PluginDependencies } from './PluginOrchestratorInterface';
import { SettingsService } from '../settings';
import { StreamsService } from '../streams';
import { OnTaskViewImpl, ONTASK_VIEW_TYPE } from '../ontask-view';
import { EventSystem } from '../events';
import { Logger } from '../logging/Logger';
import { SettingsAwareSliceService } from '../../shared/base-slice';

export class PluginOrchestrationServiceImpl extends SettingsAwareSliceService implements PluginOrchestrator {
	private dependencies: PluginDependencies;
	private eventListeners: (() => void)[] = [];
	private eventSystem: EventSystem;
	private logger: Logger;

	constructor(dependencies: PluginDependencies, eventSystem: EventSystem) {
		super();
		this.dependencies = dependencies;
		this.eventSystem = eventSystem;
		this.logger = dependencies.loggingService.getLogger();
		this.setPlugin(dependencies.plugin);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		
		const { app, plugin, settingsService, taskLoadingService, streamsService, dataService, statusConfigService } = this.dependencies;
		
		await this.setupUI(app, plugin, settingsService);
		this.setupEventListeners();
		this.setupStreamsReadyCallback(app, streamsService);
		
		this.initialized = true;
	}

	async shutdown(): Promise<void> {
		this.cleanupEventListeners();
		this.cleanup();
	}

	cleanup(): void {
		this.eventListeners = [];
		this.initialized = false;
	}

	async openOnTaskView(): Promise<void> {
		const { app } = this.dependencies;
		
		const existingLeaf = app.workspace.getLeavesOfType(ONTASK_VIEW_TYPE)[0];
		
		if (existingLeaf) {
			app.workspace.revealLeaf(existingLeaf);
		} else {
			const leaf = app.workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: ONTASK_VIEW_TYPE });
				app.workspace.revealLeaf(leaf);
			}
		}
		
		this.logger.debug('[OnTask Orchestrator] Emitting ui:view-opened event for', ONTASK_VIEW_TYPE);
		this.eventSystem.emit('ui:view-opened', { viewType: ONTASK_VIEW_TYPE });
	}

	async refreshOnTaskViews(): Promise<void> {
		const { app } = this.dependencies;
		const leaves = app.workspace.getLeavesOfType(ONTASK_VIEW_TYPE);
		
		for (const leaf of leaves) {
			if (leaf.view instanceof OnTaskViewImpl) {
				await (leaf.view as OnTaskViewImpl).refreshCheckboxes();
			}
		}
	}


	setupEventListeners(): void {
		const { app, settingsService } = this.dependencies;
		
		const settingsSubscription = this.eventSystem.on('settings:changed', (event) => {
			this.logger.debug('[OnTask Orchestrator] Settings changed event received:', event.data);
			switch (event.data.key) {
				case 'checkboxSource':
				case 'customFolderPath':
				case 'includeSubfolders':
					this.logger.debug('[OnTask Orchestrator] Checkbox source settings changed, reconfiguring');
					this.configureCheckboxSource();
					break;
				case 'showTopTaskInEditor':
					this.logger.debug('[OnTask Orchestrator] showTopTaskInEditor setting changed, delegating to editor integration');
					break;
				case 'debugLoggingEnabled':
					this.logger.debug('[OnTask Orchestrator] debugLoggingEnabled setting changed, delegating to logging service');
					break;
			}
		});
		this.eventListeners.push(() => settingsSubscription.unsubscribe());

		const streamsSubscription = this.eventSystem.on('streams:ready', () => {
			this.logger.debug('[OnTask Orchestrator] Streams ready event received, refreshing OnTask views');
			this.refreshOnTaskViews();
		});
		this.eventListeners.push(() => streamsSubscription.unsubscribe());

		this.logger.debug('[OnTask Orchestrator] Emitting plugin:initialized event');
		this.eventSystem.emit('plugin:initialized', {});
	}

	cleanupEventListeners(): void {
		this.eventListeners.forEach(cleanup => cleanup());
		this.eventListeners = [];
		this.logger.debug('[OnTask Orchestrator] Emitting plugin:shutdown event');
		this.eventSystem.emit('plugin:shutdown', {});
	}

	private async setupUI(app: App, plugin: Plugin, settingsService: SettingsService): Promise<void> {
		plugin.registerView(ONTASK_VIEW_TYPE, (leaf) => new OnTaskViewImpl(
			leaf, 
			this.dependencies.taskLoadingService, 
			settingsService, 
			this.dependencies.statusConfigService,
			this.dependencies.dataService,
			plugin,
			this.dependencies.eventSystem,
			this.dependencies.loggingService.getLogger()
		));

		const ribbonIconEl = plugin.addRibbonIcon('checkmark', 'On Task', () => {
			this.openOnTaskView();
		});
		ribbonIconEl.addClass('on-task-ribbon-class');

		this.addCommands(plugin);
	}

	private addCommands(plugin: Plugin): void {
		plugin.addCommand({
			id: 'open-ontask-view',
			name: 'Open On Task view',
			callback: () => {
				this.openOnTaskView();
			}
		});
	}

	private setupStreamsReadyCallback(app: App, streamsService: StreamsService): void {
		app.workspace.onLayoutReady(() => {
			if (streamsService.isStreamsPluginAvailable()) {
				this.refreshOnTaskViews();
			}
		});
	}

	private configureCheckboxSource(): void {
		// Handled internally by TaskLoadingService
	}




}
