// Dependency Injection slice - Service configuration
import { DIContainer, SERVICE_IDS } from './di-container-interface';
import { EventSystem, EventSystemServiceImpl } from '../events';
import { SettingsService, SettingsServiceImpl } from '../settings';
import { StreamsService, StreamsServiceImpl } from '../streams';
import { TaskLoadingService } from '../ontask-view/services/task-loading-service';
import { PluginOrchestrator, PluginOrchestrationServiceImpl, PluginDependencies } from '../plugin';
import { EditorIntegrationService, EditorIntegrationServiceImpl } from '../editor';
import { DataService, DataServiceImpl } from '../data';
import { StatusConfigService } from '../settings/status-config';
import { LoggingService, LoggingServiceImpl } from '../logging';
import { App, Plugin } from 'obsidian';

export class ServiceConfiguration {
	static configureServices(container: DIContainer, app: App, plugin: Plugin): void {
		// Register core dependencies
		container.registerSingleton(SERVICE_IDS.APP, () => app);
		container.registerSingleton(SERVICE_IDS.PLUGIN, () => plugin);

		// Register event system
		container.registerSingleton(SERVICE_IDS.EVENT_SYSTEM, (container) => {
			return new EventSystemServiceImpl();
		});

		// Register data service
		container.registerSingleton(SERVICE_IDS.DATA_SERVICE, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			const plugin = container.resolve<Plugin>(SERVICE_IDS.PLUGIN);
			return new DataServiceImpl(app, plugin);
		});

		// Register status config service
		container.registerSingleton(SERVICE_IDS.STATUS_CONFIG_SERVICE, (container) => {
			const dataService = container.resolve<DataService>(SERVICE_IDS.DATA_SERVICE);
			const plugin = container.resolve<Plugin>(SERVICE_IDS.PLUGIN);
			return new StatusConfigService(dataService, plugin);
		});

		// Register settings service
		container.registerSingleton(SERVICE_IDS.SETTINGS_SERVICE, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			const plugin = container.resolve<Plugin>(SERVICE_IDS.PLUGIN);
			const eventSystem = container.resolve<EventSystem>(SERVICE_IDS.EVENT_SYSTEM);
			return new SettingsServiceImpl(app, plugin, eventSystem);
		});

		// Register streams service
		container.registerSingleton(SERVICE_IDS.STREAMS_SERVICE, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			return new StreamsServiceImpl(app);
		});

		// Register task loading service (now creates CheckboxFinderFactory internally)
		container.registerSingleton(SERVICE_IDS.TASK_LOADING_SERVICE, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			const streamsService = container.resolve<StreamsService>(SERVICE_IDS.STREAMS_SERVICE);
			const settingsService = container.resolve<SettingsService>(SERVICE_IDS.SETTINGS_SERVICE);
			const statusConfigService = container.resolve<StatusConfigService>(SERVICE_IDS.STATUS_CONFIG_SERVICE);
			return new TaskLoadingService(streamsService, settingsService, statusConfigService, app);
		});

		// Register editor integration service
		container.registerSingleton(SERVICE_IDS.EDITOR_INTEGRATION_SERVICE, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			const plugin = container.resolve<Plugin>(SERVICE_IDS.PLUGIN);
			const settingsService = container.resolve<SettingsService>(SERVICE_IDS.SETTINGS_SERVICE);
			const taskLoadingService = container.resolve<TaskLoadingService>(SERVICE_IDS.TASK_LOADING_SERVICE);
			const eventSystem = container.resolve<EventSystem>(SERVICE_IDS.EVENT_SYSTEM);
			return new EditorIntegrationServiceImpl(app, settingsService, taskLoadingService, eventSystem, plugin);
		});

		// Register logging service
		container.registerSingleton(SERVICE_IDS.LOGGING_SERVICE, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			const plugin = container.resolve<Plugin>(SERVICE_IDS.PLUGIN);
			return new LoggingServiceImpl({ app, plugin });
		});

		// Register plugin orchestrator
		container.registerSingleton(SERVICE_IDS.PLUGIN_ORCHESTRATOR, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			const plugin = container.resolve<Plugin>(SERVICE_IDS.PLUGIN);
			const settingsService = container.resolve<SettingsService>(SERVICE_IDS.SETTINGS_SERVICE);
			const streamsService = container.resolve<StreamsService>(SERVICE_IDS.STREAMS_SERVICE);
			const taskLoadingService = container.resolve<TaskLoadingService>(SERVICE_IDS.TASK_LOADING_SERVICE);
			const eventSystem = container.resolve<EventSystem>(SERVICE_IDS.EVENT_SYSTEM);
			const dataService = container.resolve<DataService>(SERVICE_IDS.DATA_SERVICE);
			const statusConfigService = container.resolve<StatusConfigService>(SERVICE_IDS.STATUS_CONFIG_SERVICE);
			const loggingService = container.resolve<LoggingService>(SERVICE_IDS.LOGGING_SERVICE);

			const dependencies: PluginDependencies = {
				app,
				plugin,
				settingsService,
				taskLoadingService,
				streamsService,
				eventSystem,
				dataService,
				statusConfigService,
				loggingService
			};

			return new PluginOrchestrationServiceImpl(dependencies, eventSystem);
		});
	}
}
