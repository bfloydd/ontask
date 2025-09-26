import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { OnTaskSettings } from './src/types';
import { StreamsService } from './src/services/streams';
import { CheckboxFinderService } from './src/services/checkbox-finder';
import { OnTaskView, ONTASK_VIEW_TYPE } from './src/views/ontask-view';

// On Task Plugin - Task management for Obsidian

const DEFAULT_SETTINGS: OnTaskSettings = {
	mySetting: 'default',
	hideCompletedTasks: false,
	onlyShowToday: false,
	topTaskColor: 'neutral',
	showTopTaskInStatusBar: true
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
		this.streamsService = new StreamsService(this.app);
		this.checkboxFinder = new CheckboxFinderService(this.app, this.streamsService);

		// Register the OnTaskView
		this.registerView(ONTASK_VIEW_TYPE, (leaf) => new OnTaskView(leaf, this.checkboxFinder, this.settings, this));

		// Streams plugin integration is now handled by StreamsService

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('checkmark', 'On Task', (_evt: MouseEvent) => {
			// Open the OnTaskView
			this.openOnTaskView();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('on-task-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// Removed "On Task Ready" status bar item

		// Add top task status bar item
		this.topTaskStatusBarItem = this.addStatusBarItem();
		this.topTaskStatusBarItem.addClass('ontask-top-task-status');
		this.topTaskStatusBarItem.style.cursor = 'pointer';
		this.topTaskStatusBarItem.style.opacity = '0.7';
		this.topTaskStatusBarItem.addEventListener('click', () => this.toggleTopTaskVisibility());
		this.topTaskStatusBarItem.addEventListener('contextmenu', (e) => this.showColorMenu(e));
		
		// Initialize top task display based on setting
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

		// Removed timers - status bar updates only on file changes now
		
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
			// Check if status bar is enabled
			if (!this.settings.showTopTaskInStatusBar) {
				this.topTaskStatusBarItem.style.display = 'none';
				return;
			}

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
				
				// Apply color styling
				this.applyTopTaskColor();
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
	 * Apply the selected color to the top task status bar
	 */
	private applyTopTaskColor() {
		const colorMap: { [key: string]: { bg: string; text: string } } = {
			neutral: { bg: 'transparent', text: 'var(--text-normal)' },
			red: { bg: '#ff6b6b', text: 'white' },
			orange: { bg: '#ffa726', text: 'white' },
			yellow: { bg: '#ffeb3b', text: 'black' },
			green: { bg: '#66bb6a', text: 'white' },
			blue: { bg: '#42a5f5', text: 'white' },
			purple: { bg: '#ab47bc', text: 'white' },
			pink: { bg: '#ec407a', text: 'white' },
			teal: { bg: '#26a69a', text: 'white' },
			indigo: { bg: '#5c6bc0', text: 'white' }
		};

		const color = colorMap[this.settings.topTaskColor] || colorMap.neutral;
		this.topTaskStatusBarItem.style.backgroundColor = color.bg;
		this.topTaskStatusBarItem.style.color = color.text;
		this.topTaskStatusBarItem.style.padding = '2px 8px';
		this.topTaskStatusBarItem.style.borderRadius = '4px';
		this.topTaskStatusBarItem.style.border = color.bg === 'transparent' ? '1px solid var(--background-modifier-border)' : 'none';
	}

	/**
	 * Toggle top task visibility in status bar
	 */
	private toggleTopTaskVisibility() {
		this.isTopTaskVisible = !this.isTopTaskVisible;
		this.updateTopTaskStatusBar();
	}

	/**
	 * Show color selection menu for top task
	 */
	private showColorMenu(event: MouseEvent) {
		event.preventDefault();
		
		// Remove any existing color menu
		const existingMenu = document.querySelector('.ontask-color-menu');
		if (existingMenu) {
			existingMenu.remove();
		}

		// Create color menu
		const menu = document.createElement('div');
		menu.className = 'ontask-color-menu';
		menu.style.position = 'fixed';
		menu.style.left = `${event.clientX - 200}px`; // Position to the left
		menu.style.top = `${event.clientY - 300}px`; // Position above
		menu.style.zIndex = '1000';
		menu.style.background = 'var(--background-primary)';
		menu.style.border = '1px solid var(--background-modifier-border)';
		menu.style.borderRadius = '6px';
		menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
		menu.style.padding = '8px';
		menu.style.minWidth = '200px';
		menu.style.maxHeight = '300px';
		menu.style.overflowY = 'auto';

		// Color options
		const colors = [
			{ name: 'Neutral', value: 'neutral', bg: 'transparent', text: 'var(--text-normal)' },
			{ name: 'Red', value: 'red', bg: '#ff6b6b', text: 'white' },
			{ name: 'Orange', value: 'orange', bg: '#ffa726', text: 'white' },
			{ name: 'Yellow', value: 'yellow', bg: '#ffeb3b', text: 'black' },
			{ name: 'Green', value: 'green', bg: '#66bb6a', text: 'white' },
			{ name: 'Blue', value: 'blue', bg: '#42a5f5', text: 'white' },
			{ name: 'Purple', value: 'purple', bg: '#ab47bc', text: 'white' },
			{ name: 'Pink', value: 'pink', bg: '#ec407a', text: 'white' },
			{ name: 'Teal', value: 'teal', bg: '#26a69a', text: 'white' },
			{ name: 'Indigo', value: 'indigo', bg: '#5c6bc0', text: 'white' }
		];

		// Add menu items
		for (const color of colors) {
			const menuItem = document.createElement('div');
			menuItem.className = 'ontask-color-menu-item';
			menuItem.style.padding = '8px 12px';
			menuItem.style.cursor = 'pointer';
			menuItem.style.display = 'flex';
			menuItem.style.alignItems = 'center';
			menuItem.style.gap = '8px';
			menuItem.style.fontSize = '14px';
			menuItem.style.color = 'var(--text-normal)';
			menuItem.style.borderRadius = '4px';

			// Add color preview
			const colorPreview = document.createElement('div');
			colorPreview.style.width = '16px';
			colorPreview.style.height = '16px';
			colorPreview.style.borderRadius = '50%';
			colorPreview.style.border = '2px solid var(--background-modifier-border)';
			colorPreview.style.backgroundColor = color.bg;
			colorPreview.style.flexShrink = '0';

			// Add color name
			const colorName = document.createElement('span');
			colorName.textContent = color.name;

			// Add checkmark if this is the current color
			if (this.settings.topTaskColor === color.value) {
				const checkmark = document.createElement('span');
				checkmark.textContent = '✓';
				checkmark.style.color = 'var(--text-accent)';
				checkmark.style.fontWeight = 'bold';
				checkmark.style.marginLeft = 'auto';
				menuItem.appendChild(checkmark);
			}

			menuItem.appendChild(colorPreview);
			menuItem.appendChild(colorName);

			// Add hover effect
			menuItem.addEventListener('mouseenter', () => {
				menuItem.style.background = 'var(--background-modifier-hover)';
			});
			menuItem.addEventListener('mouseleave', () => {
				menuItem.style.background = 'transparent';
			});

			// Add click handler
			menuItem.addEventListener('click', async () => {
				this.settings.topTaskColor = color.value;
				await this.saveSettings();
				this.updateTopTaskStatusBar();
				menu.remove();
			});

			menu.appendChild(menuItem);
		}

		// Add to document
		document.body.appendChild(menu);

		// Close menu when clicking outside
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu);
			}
		};

		// Use setTimeout to avoid immediate closure
		setTimeout(() => {
			document.addEventListener('click', closeMenu);
		}, 0);
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

		new Setting(containerEl)
			.setName('Show top task in status bar')
			.setDesc('When enabled, the current top task will be displayed in the status bar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showTopTaskInStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.showTopTaskInStatusBar = value;
					await this.plugin.saveSettings();
					// Update status bar immediately when setting changes
					await this.plugin.updateTopTaskStatusBar();
				}));
	}
}
