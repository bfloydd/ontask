export type ServiceIdentifier<T = unknown> = string | symbol | (new (...args: unknown[]) => T);
export type ServiceFactory<T = unknown> = (container: DIContainer) => T;
export type ServiceInstance<T = unknown> = T;

export interface ServiceRegistration<T = unknown> {
	identifier: ServiceIdentifier<T>;
	factory: ServiceFactory<T>;
	singleton: boolean;
	instance?: ServiceInstance<T>;
}

export interface DIContainer {
	register<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>, singleton?: boolean): void;
	
	registerSingleton<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void;
	
	resolve<T>(identifier: ServiceIdentifier<T>): T;
	
	clear(): void;
}

export const SERVICE_IDS = {
	// Core services
	EVENT_SYSTEM: Symbol('EventSystem'),
	SETTINGS_SERVICE: Symbol('SettingsService'),
	STREAMS_SERVICE: Symbol('StreamsService'),
	TASK_LOADING_SERVICE: Symbol('TaskLoadingService'),
	PLUGIN_ORCHESTRATOR: Symbol('PluginOrchestrator'),
	EDITOR_INTEGRATION_SERVICE: Symbol('EditorIntegrationService'),
	DATA_SERVICE: Symbol('DataService'),
	STATUS_CONFIG_SERVICE: Symbol('StatusConfigService'),
	LOGGING_SERVICE: Symbol('LoggingService'),
	
	// App dependencies
	APP: Symbol('App'),
	PLUGIN: Symbol('Plugin'),
} as const;

export type ServiceIds = typeof SERVICE_IDS;
