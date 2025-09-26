import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { OnTaskSettings } from './src/types';
import { StreamsService } from './src/services/streams';
import { CheckboxFinderService } from './src/services/checkbox-finder';
import { OnTaskView, ONTASK_VIEW_TYPE } from './src/views/ontask-view';

// On Task Plugin - Task management for Obsidian

const DEFAULT_SETTINGS: OnTaskSettings = {
	mySetting: 'default',
	hideCompletedTasks: false,
	onlyShowToday: false
}

export default class OnTask extends Plugin {
	settings: OnTaskSettings;
	streamsService: StreamsService;
	checkboxFinder: CheckboxFinderService;
	private topTaskStatusBarItem: HTMLElement;
	private isTopTaskVisible: boolean = true;

	async onload() {
		await this.loadSettings();

		// Initialize services
		this.streamsService = new StreamsService();
		this.checkboxFinder = new CheckboxFinderService(this.app, this.streamsService);

		// Register the OnTaskView
		this.registerView(ONTASK_VIEW_TYPE, (leaf) => new OnTaskView(leaf, this.checkboxFinder, this.settings, this));

		// Access Streams plugin data
		this.initializeStreamsIntegration();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('checkmark', 'On Task', (_evt: MouseEvent) => {
			// Open the OnTaskView
			this.openOnTaskView();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('on-task-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('On Task Ready');

		// Add top task status bar item
		this.topTaskStatusBarItem = this.addStatusBarItem();
		this.topTaskStatusBarItem.addClass('ontask-top-task-status');
		this.topTaskStatusBarItem.style.cursor = 'pointer';
		this.topTaskStatusBarItem.style.opacity = '0.7';
		this.topTaskStatusBarItem.addEventListener('click', () => this.toggleTopTaskVisibility());
		
		// Initialize top task display
		this.updateTopTaskStatusBar();

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

		// Command to demonstrate Streams plugin integration
		this.addCommand({
			id: 'get-streams-data',
			name: 'Get current streams data',
			callback: () => {
				this.getStreamsData();
			}
		});

		// Command to test the stub data directly
		this.addCommand({
			id: 'test-stub-streams',
			name: 'Test stub streams data',
			callback: () => {
				const streams = this.streamsService.getAllStreams();
				new Notice(`Stub data: Found ${streams.length} streams`);
				console.log('Stub streams:', streams);
			}
		});

		// Command to test streams service functionality
		this.addCommand({
			id: 'test-streams-service',
			name: 'Test streams service functionality',
			callback: () => {
				const streams = this.streamsService.getAllStreams();
				const personalStream = this.streamsService.getStreamByName('Personal');
				const workStream = this.streamsService.getStreamByPath('Assets/Streams/Work');
				const hasPersonal = this.streamsService.hasStream('Personal');
				const streamNames = this.streamsService.getStreamNames();
				
				console.log('All streams:', streams);
				console.log('Personal stream:', personalStream);
				console.log('Work stream:', workStream);
				console.log('Has Personal stream:', hasPersonal);
				console.log('Stream names:', streamNames);
				
				new Notice(`Streams service test complete. Check console for details.`);
			}
		});

		// Command to open OnTaskView
		this.addCommand({
			id: 'open-ontask-view',
			name: 'Open On Task view',
			callback: () => {
				this.openOnTaskView();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new OnTaskSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
		
		// Update top task status bar periodically
		this.registerInterval(window.setInterval(() => {
			this.updateTopTaskStatusBar();
		}, 30 * 1000)); // Update every 30 seconds
		
		// Update status bar when files change
		this.registerEvent(this.app.vault.on('modify', () => {
			this.updateTopTaskStatusBar();
		}));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Initialize integration with the Streams plugin
	 */
	private initializeStreamsIntegration() {
		// Wait for all plugins to load
		this.app.workspace.onLayoutReady(() => {
			// Access plugins through the app's internal structure
			const streamsPlugin = (this.app as any).plugins?.plugins?.['streams'];
			
			if (streamsPlugin) {
				console.log('Streams plugin found:', streamsPlugin);
				
				// Method 1: Try to access public methods
				if (typeof streamsPlugin.getCurrentStreams === 'function') {
					const currentStreams = streamsPlugin.getCurrentStreams();
					console.log('Current streams:', currentStreams);
				}
				
				// Method 2: Try to access public properties
				if (streamsPlugin.currentStreams) {
					console.log('Streams data:', streamsPlugin.currentStreams);
				}
				
				// Method 3: Listen for custom events if the plugin publishes them
				// Note: This requires the Streams plugin to emit custom events
				// You may need to check the Streams plugin documentation for event names
				this.registerEvent(
					this.app.workspace.on('file-open', (file) => {
						// Check if this is a streams-related file or trigger
						if (file?.path?.includes('streams')) {
							console.log('Streams-related file opened:', file.path);
							// Re-check streams data
							if (typeof streamsPlugin.getCurrentStreams === 'function') {
								const currentStreams = streamsPlugin.getCurrentStreams();
								console.log('Updated streams:', currentStreams);
							}
						}
					})
				);
			} else {
				console.log('Streams plugin not found or not loaded');
			}
		});
	}


	/**
	 * Get current streams data from the Streams plugin
	 */
	private getStreamsData() {
		const streamsPlugin = (this.app as any).plugins?.plugins?.['streams'];
		
		if (!streamsPlugin) {
			new Notice('Streams plugin not found or not loaded');
			// Fall back to our stub data
			const streamsData = this.streamsService.getAllStreams();
			new Notice(`Using stub data: Found ${streamsData.length} streams`);
			return streamsData;
		}

		try {
			// Try different methods to access streams data
			let streamsData = null;
			
			// Method 1: Try public method
			if (typeof streamsPlugin.getCurrentStreams === 'function') {
				streamsData = streamsPlugin.getCurrentStreams();
			}
			// Method 2: Try public property
			else if (streamsPlugin.currentStreams) {
				streamsData = streamsPlugin.currentStreams;
			}
			// Method 3: Try other common property names
			else if (streamsPlugin.streams) {
				streamsData = streamsPlugin.streams;
			}
			// Method 4: Try data property
			else if (streamsPlugin.data) {
				streamsData = streamsPlugin.data;
			}

			if (streamsData) {
				console.log('Streams data retrieved from plugin:', streamsData);
				new Notice(`Found ${Array.isArray(streamsData) ? streamsData.length : 'some'} streams from plugin`);
				
				// You can now use streamsData in your task management logic
				// For example, create tasks based on streams, or filter tasks by stream data
				return streamsData;
			} else {
				new Notice('No streams data found in the Streams plugin, using stub data');
				console.log('Available properties on Streams plugin:', Object.keys(streamsPlugin));
				// Fall back to our stub data
				const fallbackData = this.streamsService.getAllStreams();
				return fallbackData;
			}
		} catch (error) {
			console.error('Error accessing Streams plugin data:', error);
			new Notice('Error accessing Streams plugin data, using stub data');
			// Fall back to our stub data
			const fallbackData = this.streamsService.getAllStreams();
			return fallbackData;
		}
	}

	/**
	 * Open the OnTaskView pane
	 */
	private async openOnTaskView() {
		// Check if the view is already open
		const existingLeaf = this.app.workspace.getLeavesOfType(ONTASK_VIEW_TYPE)[0];
		
		if (existingLeaf) {
			// If already open, just reveal it
			this.app.workspace.revealLeaf(existingLeaf);
		} else {
			// Create a new leaf for the view
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: ONTASK_VIEW_TYPE });
				this.app.workspace.revealLeaf(leaf);
			}
		}
	}

	/**
	 * Update the top task display in the status bar
	 */
	public async updateTopTaskStatusBar() {
		try {
			const checkboxes = await this.checkboxFinder.findAllCheckboxes(this.settings.hideCompletedTasks, this.settings.onlyShowToday);
			const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
			
			if (topTask) {
				if (this.isTopTaskVisible) {
					const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
					const displayText = remainingText || 'Top Task';
					this.topTaskStatusBarItem.setText(`🔥 ${displayText}`);
				} else {
					this.topTaskStatusBarItem.setText('👁️');
				}
				this.topTaskStatusBarItem.style.display = 'block';
			} else {
				this.topTaskStatusBarItem.style.display = 'none';
			}
		} catch (error) {
			console.error('Error updating top task status bar:', error);
			this.topTaskStatusBarItem.style.display = 'none';
		}
	}

	/**
	 * Toggle top task visibility in status bar
	 */
	private toggleTopTaskVisibility() {
		this.isTopTaskVisible = !this.isTopTaskVisible;
		this.updateTopTaskStatusBar();
	}

	/**
	 * Parse a checkbox line to extract text (helper method)
	 */
	private parseCheckboxLine(line: string): { remainingText: string } {
		const trimmedLine = line.trim();
		
		// Look for checkbox pattern: - [ ] or - [x] or any other status
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]]*)\]\s*(.*)$/);
		
		if (checkboxMatch) {
			const remainingText = checkboxMatch[2].trim();
			return { remainingText };
		}
		
		// Fallback if no match
		return { remainingText: '' };
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

class OnTaskSettingTab extends PluginSettingTab {
	plugin: OnTask;

	constructor(app: App, plugin: OnTask) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Hide completed tasks')
			.setDesc('When enabled, completed checkboxes will not be displayed in the task view for better performance')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideCompletedTasks)
				.onChange(async (value) => {
					this.plugin.settings.hideCompletedTasks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Only show today')
			.setDesc('When enabled, only tasks from today\'s files will be displayed in the task view')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.onlyShowToday)
				.onChange(async (value) => {
					this.plugin.settings.onlyShowToday = value;
					await this.plugin.saveSettings();
				}));
	}
}
