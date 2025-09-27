// Dependency Injection slice - Service configuration
import { DIContainer, SERVICE_IDS } from './di-container-interface';
import { EventSystem, EventSystemServiceImpl } from '../events';
import { SettingsService, SettingsServiceImpl } from '../settings';
import { StreamsService } from '../../services/streams';
import { CheckboxFinderService } from '../../services/checkbox-finder/checkbox-finder-service';
import { PluginOrchestrator, PluginOrchestrationServiceImpl, PluginDependencies } from '../plugin';
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
			return new StreamsService(app);
		});

		// Register checkbox finder service
		container.registerSingleton(SERVICE_IDS.CHECKBOX_FINDER_SERVICE, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			const streamsService = container.resolve<StreamsService>(SERVICE_IDS.STREAMS_SERVICE);
			return new CheckboxFinderService(app, streamsService);
		});

		// Register plugin orchestrator
		container.registerSingleton(SERVICE_IDS.PLUGIN_ORCHESTRATOR, (container) => {
			const app = container.resolve<App>(SERVICE_IDS.APP);
			const plugin = container.resolve<Plugin>(SERVICE_IDS.PLUGIN);
			const settingsService = container.resolve<SettingsService>(SERVICE_IDS.SETTINGS_SERVICE);
			const streamsService = container.resolve<StreamsService>(SERVICE_IDS.STREAMS_SERVICE);
			const checkboxFinderService = container.resolve<CheckboxFinderService>(SERVICE_IDS.CHECKBOX_FINDER_SERVICE);
			const eventSystem = container.resolve<EventSystem>(SERVICE_IDS.EVENT_SYSTEM);

			const dependencies: PluginDependencies = {
				app,
				plugin,
				settingsService,
				checkboxFinderService,
				streamsService
			};

			return new PluginOrchestrationServiceImpl(dependencies, eventSystem);
		});
	}
}
