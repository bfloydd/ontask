// Plugin orchestration slice - Service implementation
import { App, Plugin, WorkspaceLeaf } from 'obsidian';
import { PluginOrchestrator, PluginDependencies } from './PluginOrchestratorInterface';
import { SettingsService } from '../settings';
import { TaskLoadingService } from '../ontask-view/services/task-loading-service';
import { StreamsService } from '../streams';
import { OnTaskViewImpl, ONTASK_VIEW_TYPE } from '../ontask-view';
import { EventSystem } from '../events';
import { DataService } from '../data';
import { StatusConfigService } from '../settings/status-config';
import { LoggingService } from '../logging';
import { SettingsAwareSliceService } from '../../shared/base-slice';

export class PluginOrchestrationServiceImpl extends SettingsAwareSliceService implements PluginOrchestrator {
	private dependencies: PluginDependencies;
	private eventListeners: (() => void)[] = [];
	private eventSystem: EventSystem;

	constructor(dependencies: PluginDependencies, eventSystem: EventSystem) {
		super();
		this.dependencies = dependencies;
		this.eventSystem = eventSystem;
		this.setPlugin(dependencies.plugin);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		
		const { app, plugin, settingsService, taskLoadingService, streamsService, dataService, statusConfigService } = this.dependencies;
		
		// Set up UI elements
		await this.setupUI(app, plugin, settingsService);
		
		// Set up event listeners
		this.setupEventListeners();
		
		// Set up streams ready callback
		this.setupStreamsReadyCallback(app, streamsService);
		
		
		this.initialized = true;
	}

	async shutdown(): Promise<void> {
		// Clean up event listeners
		this.cleanupEventListeners();
		
		// Clean up UI elements
		
		this.cleanup();
	}

	cleanup(): void {
		this.eventListeners = [];
		this.initialized = false;
	}

	async openOnTaskView(): Promise<void> {
		const { app } = this.dependencies;
		
		// Check if the view is already open
		const existingLeaf = app.workspace.getLeavesOfType(ONTASK_VIEW_TYPE)[0];
		
		if (existingLeaf) {
			// If already open, just reveal it
			app.workspace.revealLeaf(existingLeaf);
		} else {
			// Create a new leaf for the view
			const leaf = app.workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: ONTASK_VIEW_TYPE });
				app.workspace.revealLeaf(leaf);
			}
		}
		
		// Emit view opened event
		this.eventSystem.emit('ui:view-opened', { viewType: ONTASK_VIEW_TYPE });
	}

	async refreshOnTaskViews(): Promise<void> {
		const { app } = this.dependencies;
		const leaves = app.workspace.getLeavesOfType(ONTASK_VIEW_TYPE);
		
		for (const leaf of leaves) {
			if (leaf.view instanceof OnTaskViewImpl) {
				// Trigger a refresh of the view
				await (leaf.view as OnTaskViewImpl).refreshCheckboxes();
			}
		}
	}


	setupEventListeners(): void {
		const { app, settingsService } = this.dependencies;
		
		// Listen for settings changes via event system
		const settingsSubscription = this.eventSystem.on('settings:changed', (event) => {
			// Handle specific setting changes
			switch (event.data.key) {
				case 'checkboxSource':
				case 'customFolderPath':
				case 'includeSubfolders':
					this.configureCheckboxSource();
					break;
				case 'showTopTaskInEditor':
					// Editor integration service will handle this via its own event listener
					break;
			}
		});
		this.eventListeners.push(() => settingsSubscription.unsubscribe());

		// Note: File modification events are handled by OnTaskView directly
		// to avoid unnecessary event cascades and improve performance

		// Listen for streams ready
		const streamsSubscription = this.eventSystem.on('streams:ready', () => {
			this.refreshOnTaskViews();
		});
		this.eventListeners.push(() => streamsSubscription.unsubscribe());


		// Emit plugin initialized event
		this.eventSystem.emit('plugin:initialized', {});
	}

	cleanupEventListeners(): void {
		this.eventListeners.forEach(cleanup => cleanup());
		this.eventListeners = [];
		
		// Emit plugin shutdown event
		this.eventSystem.emit('plugin:shutdown', {});
	}

	private async setupUI(app: App, plugin: Plugin, settingsService: SettingsService): Promise<void> {
		// Register the OnTaskView
		plugin.registerView(ONTASK_VIEW_TYPE, (leaf) => new OnTaskViewImpl(
			leaf, 
			this.dependencies.taskLoadingService, 
			settingsService, 
			this.dependencies.statusConfigService,
			this.dependencies.dataService,
			plugin,
			this.dependencies.eventSystem
		));

		// Add ribbon icon
		const ribbonIconEl = plugin.addRibbonIcon('checkmark', 'On Task', () => {
			this.openOnTaskView();
		});
		ribbonIconEl.addClass('on-task-ribbon-class');


		// Add commands
		this.addCommands(plugin);
	}

	private addCommands(plugin: Plugin): void {
		// Command to open OnTaskView
		plugin.addCommand({
			id: 'open-ontask-view',
			name: 'Open On Task view',
			callback: () => {
				this.openOnTaskView();
			}
		});

	}

	private setupStreamsReadyCallback(app: App, streamsService: StreamsService): void {
		// Wait for layout ready to ensure streams plugin is loaded
		app.workspace.onLayoutReady(() => {
			// Check if streams are available and refresh any open OnTaskView
			if (streamsService.isStreamsPluginAvailable()) {
				this.refreshOnTaskViews();
			}
		});
	}

	private configureCheckboxSource(): void {
		// Checkbox source configuration is now handled internally by TaskLoadingService
		// The TaskLoadingService uses CheckboxFinderFactory internally and handles
		// different sources (streams, daily-notes, folder) based on settings
		// No additional configuration needed here
	}




}
