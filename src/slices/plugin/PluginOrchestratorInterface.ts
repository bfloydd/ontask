// Plugin orchestration slice - Interface definitions

import { App, Plugin } from 'obsidian';
import { SettingsService } from '../settings';
import { TaskLoadingService } from '../ontask-view/services/task-loading-service';
import { StreamsService } from '../streams';
import { EventSystem } from '../events';
import { DataService } from '../data';
import { StatusConfigService } from '../settings/status-config';
import { LoggingService } from '../logging';

export interface PluginOrchestrator {
	// Lifecycle management
	initialize(): Promise<void>;
	shutdown(): Promise<void>;
	
	// UI management
	openOnTaskView(): Promise<void>;
	refreshOnTaskViews(): Promise<void>;
	
	// Event handling
	setupEventListeners(): void;
	cleanupEventListeners(): void;
}

export interface PluginDependencies {
	app: App;
	plugin: Plugin;
	settingsService: SettingsService;
	taskLoadingService: TaskLoadingService;
	streamsService: StreamsService;
	eventSystem: EventSystem;
	dataService: DataService;
	statusConfigService: StatusConfigService;
	loggingService: LoggingService;
}

