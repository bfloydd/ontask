// Plugin orchestration slice - Interface definitions

import { App, Plugin } from 'obsidian';
import { SettingsService } from '../settings';
import { CheckboxFinderService } from '../checkbox-finder';
import { StreamsService } from '../streams';
import { EventSystem } from '../events';

export interface PluginOrchestrator {
	// Lifecycle management
	initialize(): Promise<void>;
	shutdown(): Promise<void>;
	
	// Service management
	getSettingsService(): SettingsService;
	getCheckboxFinderService(): CheckboxFinderService;
	getStreamsService(): StreamsService;
	
	// UI management
	openOnTaskView(): Promise<void>;
	refreshOnTaskViews(): Promise<void>;
	updateTopTaskStatusBar(): Promise<void>;
	
	// Event handling
	setupEventListeners(): void;
	cleanupEventListeners(): void;
}

export interface PluginDependencies {
	app: App;
	plugin: Plugin;
	settingsService: SettingsService;
	checkboxFinderService: CheckboxFinderService;
	streamsService: StreamsService;
	eventSystem: EventSystem;
}

export interface PluginLifecycleEvents {
	'onload': () => void;
	'onunload': () => void;
	'settings-changed': (event: any) => void;
	'streams-ready': () => void;
	'file-modified': () => void;
}
