import { App, Plugin } from 'obsidian';
import { OnTaskSettings, DEFAULT_SETTINGS, SettingsService, OnTaskSettingsTab } from './src/slices/settings';
import { PluginOrchestrator } from './src/slices/plugin';
import { EventSystem } from './src/slices/events';
import { EditorIntegrationService } from './src/slices/editor';
import { DIContainer, DIContainerImpl, ServiceConfiguration, SERVICE_IDS } from './src/slices/di';
import { StreamsService } from './src/services/streams';
import { CheckboxFinderService } from './src/services/checkbox-finder/checkbox-finder-service';
import { OnTaskView, ONTASK_VIEW_TYPE } from './src/views/ontask-view';

// On Task Plugin - Task management for Obsidian

export default class OnTask extends Plugin {
	settings: OnTaskSettings;
	private container: DIContainer;
	private settingsService: SettingsService;
	private streamsService: StreamsService;
	private checkboxFinder: CheckboxFinderService;
	private orchestrator: PluginOrchestrator;
	private eventSystem: EventSystem;
	private editorIntegrationService: EditorIntegrationService;

	async onload() {
		// Initialize dependency injection container
		this.container = new DIContainerImpl();
		ServiceConfiguration.configureServices(this.container, this.app, this);

		// Resolve services from container
		this.eventSystem = this.container.resolve<EventSystem>(SERVICE_IDS.EVENT_SYSTEM);
		this.settingsService = this.container.resolve<SettingsService>(SERVICE_IDS.SETTINGS_SERVICE);
		this.streamsService = this.container.resolve<StreamsService>(SERVICE_IDS.STREAMS_SERVICE);
		this.checkboxFinder = this.container.resolve<CheckboxFinderService>(SERVICE_IDS.CHECKBOX_FINDER_SERVICE);
		this.orchestrator = this.container.resolve<PluginOrchestrator>(SERVICE_IDS.PLUGIN_ORCHESTRATOR);
		this.editorIntegrationService = this.container.resolve<EditorIntegrationService>(SERVICE_IDS.EDITOR_INTEGRATION_SERVICE);

		// Initialize services
		await this.settingsService.initialize();
		this.settings = this.settingsService.getSettings();
		await this.orchestrator.initialize();
		await this.editorIntegrationService.initialize();

		// Add settings tab
		this.addSettingTab(new OnTaskSettingsTab(this.app, this, this.settingsService));

		// Add test command for debugging
		this.addCommand({
			id: 'test-editor-overlay',
			name: 'Test Editor Overlay (Debug)',
			callback: () => {
				console.log('OnTask: Test command triggered');
				if (this.editorIntegrationService) {
					(this.editorIntegrationService as any).testOverlayCreation();
				}
			}
		});

	}

	async onunload() {
		if (this.orchestrator) {
			await this.orchestrator.shutdown();
		}
		
		if (this.editorIntegrationService) {
			this.editorIntegrationService.cleanup();
		}
		
		// Clear DI container
		if (this.container) {
			this.container.clear();
		}
	}


	// Public methods for backward compatibility
	public async updateTopTaskStatusBar() {
		if (this.orchestrator) {
			await this.orchestrator.updateTopTaskStatusBar();
		}
	}

	public configureCheckboxSource() {
		// This is now handled by the orchestrator's event listeners
		// But we keep this method for backward compatibility
	}
}


