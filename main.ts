import { App, Plugin } from 'obsidian';
import { OnTaskSettings, SettingsService, OnTaskSettingsTab } from './src/slices/settings';
import { PluginOrchestrator } from './src/slices/plugin';
import { EventSystem } from './src/slices/events';
import { EditorIntegrationServiceImpl } from './src/slices/editor/EditorIntegrationServiceImpl';
import { DIContainer, DIContainerImpl, ServiceConfiguration, SERVICE_IDS } from './src/slices/di';
import { StreamsService } from './src/slices/streams';
import { OnTaskViewImpl, ONTASK_VIEW_TYPE } from './src/slices/ontask-view';
import { DataService } from './src/slices/data';
import { StatusConfigService } from './src/slices/settings/status-config';
import { LoggingService } from './src/slices/logging';

export default class OnTask extends Plugin {
	settings: OnTaskSettings;
	private container: DIContainer;
	private settingsService: SettingsService;
	private streamsService: StreamsService;
	private orchestrator: PluginOrchestrator;
	private eventSystem: EventSystem;
	private editorIntegrationService: EditorIntegrationServiceImpl;
	private dataService: DataService;
	private statusConfigService: StatusConfigService;
	private loggingService: LoggingService;

	async onload() {
		// Initialize dependency injection container
		this.container = new DIContainerImpl();
		ServiceConfiguration.configureServices(this.container, this.app, this);

		// Resolve services from container
		this.eventSystem = this.container.resolve<EventSystem>(SERVICE_IDS.EVENT_SYSTEM);
		this.settingsService = this.container.resolve<SettingsService>(SERVICE_IDS.SETTINGS_SERVICE);
		this.streamsService = this.container.resolve<StreamsService>(SERVICE_IDS.STREAMS_SERVICE);
		this.orchestrator = this.container.resolve<PluginOrchestrator>(SERVICE_IDS.PLUGIN_ORCHESTRATOR);
		this.editorIntegrationService = this.container.resolve<EditorIntegrationServiceImpl>(SERVICE_IDS.EDITOR_INTEGRATION_SERVICE);
		this.dataService = this.container.resolve<DataService>(SERVICE_IDS.DATA_SERVICE);
		this.statusConfigService = this.container.resolve<StatusConfigService>(SERVICE_IDS.STATUS_CONFIG_SERVICE);
		this.loggingService = this.container.resolve<LoggingService>(SERVICE_IDS.LOGGING_SERVICE);

		// Initialize services
		await this.dataService.initialize();
		await this.settingsService.initialize();
		this.settings = this.settingsService.getSettings();
		await this.loggingService.initialize();
		await this.orchestrator.initialize();
		await this.editorIntegrationService.initialize();
		
		// Add settings tab
		this.addSettingTab(new OnTaskSettingsTab(this.app, this, this.settingsService, this.statusConfigService, this.dataService));
	}

	async onunload() {
		if (this.orchestrator) {
			await this.orchestrator.shutdown();
		}
		
		if (this.editorIntegrationService) {
			this.editorIntegrationService.cleanup();
		}
		
		if (this.container) {
			this.container.clear();
		}
	}
}
