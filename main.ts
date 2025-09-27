import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { OnTaskSettings, DEFAULT_SETTINGS, SettingsService, OnTaskSettingsTab } from './src/slices/settings';
import { PluginOrchestrator } from './src/slices/plugin';
import { EventSystem } from './src/slices/events';
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

		// Initialize services
		await this.settingsService.initialize();
		this.settings = this.settingsService.getSettings();
		await this.orchestrator.initialize();

		// Add settings tab
		this.addSettingTab(new OnTaskSettingsTab(this.app, this, this.settingsService));

		// Add legacy commands for backward compatibility
		this.addLegacyCommands();
	}

	async onunload() {
		if (this.orchestrator) {
			await this.orchestrator.shutdown();
		}
		
		// Clear DI container
		if (this.container) {
			this.container.clear();
		}
	}

	/**
	 * Add legacy commands for backward compatibility
	 */
	private addLegacyCommands() {
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-task-modal-simple',
			name: 'Open task modal (simple)',
			callback: () => {
				new TaskModal(this.app).open();
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'task-editor-command',
			name: 'Task editor command',
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('On Task Command');
			}
		});

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-task-modal-complex',
			name: 'Open task modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new TaskModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});
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

class TaskModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('On Task Modal!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

