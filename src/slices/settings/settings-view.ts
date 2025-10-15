// Settings slice - UI view implementation
import { App, PluginSettingTab, Setting } from 'obsidian';
import { SettingsService } from './settings-interface';
import { SettingsServiceImpl } from './settings-service';
import { StatusConfigView } from './status-config-view';
import { StatusConfigService } from './status-config';

export class OnTaskSettingsTab extends PluginSettingTab {
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;

	constructor(app: App, plugin: any, settingsService: SettingsService, statusConfigService: StatusConfigService) {
		super(app, plugin);
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Basic settings
		this.renderBasicSettings(containerEl);
		
		// Add separator
		containerEl.createEl('hr');

		// Checkbox source settings
		this.renderCheckboxSourceSettings(containerEl);

		// Add separator
		containerEl.createEl('hr');

		// Status configuration settings
		this.renderStatusConfiguration(containerEl);
	}

	private renderBasicSettings(containerEl: HTMLElement): void {
		const settings = this.settingsService.getSettings();


		new Setting(containerEl)
			.setName('Only show today')
			.setDesc('When enabled, only tasks from today\'s files will be displayed in the task view')
			.addToggle(toggle => toggle
				.setValue(settings.onlyShowToday)
				.onChange(async (value) => {
					await this.settingsService.updateSetting('onlyShowToday', value);
				}));

		new Setting(containerEl)
			.setName('Show top task in status bar')
			.setDesc('When enabled, the current top task will be displayed in the status bar')
			.addToggle(toggle => toggle
				.setValue(settings.showTopTaskInStatusBar)
				.onChange(async (value) => {
					await this.settingsService.updateSetting('showTopTaskInStatusBar', value);
					// Trigger status bar update
					this.app.workspace.trigger('ontask:settings-changed', { 
						key: 'showTopTaskInStatusBar', 
						value 
					});
				}));

		new Setting(containerEl)
			.setName('Show top task in editor')
			.setDesc('When enabled, the current top task will be displayed at the top of every editor page below the heading')
			.addToggle(toggle => toggle
				.setValue(settings.showTopTaskInEditor)
				.onChange(async (value) => {
					await this.settingsService.updateSetting('showTopTaskInEditor', value);
					// Trigger editor update
					this.app.workspace.trigger('ontask:settings-changed', { 
						key: 'showTopTaskInEditor', 
						value 
					});
				}));

		new Setting(containerEl)
			.setName('Load more limit')
			.setDesc('Number of tasks to load per batch for better performance. This limit applies to both initial load and all subsequent Load More operations.')
			.addText(text => text
				.setValue(settings.loadMoreLimit.toString())
				.setPlaceholder('10')
				.onChange(async (value) => {
					const numValue = parseInt(value) || 10;
					await this.settingsService.updateSetting('loadMoreLimit', numValue);
				}));
	}

	private renderCheckboxSourceSettings(containerEl: HTMLElement): void {
		const settings = this.settingsService.getSettings();

		// Checkbox source selection
		const sourceSetting = new Setting(containerEl)
			.setName('Checkbox source')
			.setDesc('Choose where to find checkboxes from')
			.addDropdown(dropdown => dropdown
				.addOption('streams', 'Streams Plugin')
				.addOption('daily-notes', 'Daily Notes')
				.addOption('folder', 'Custom Folder')
				.setValue(settings.checkboxSource)
				.onChange(async (value: 'streams' | 'daily-notes' | 'folder') => {
					await this.settingsService.updateSetting('checkboxSource', value);
					// Trigger checkbox source change
					this.app.workspace.trigger('ontask:settings-changed', { 
						key: 'checkboxSource', 
						value 
					});
					// Refresh settings to show/hide folder options
					this.display();
				}));

		// Add warning for Daily Notes if plugin is not available
		if (settings.checkboxSource === 'daily-notes') {
			if (!this.settingsService.isDailyNotesAvailable()) {
				const warningEl = containerEl.createEl('div', { 
					cls: 'setting-item-description',
					text: '⚠️ Daily Notes plugin is not enabled. Please enable it in Settings → Community plugins.'
				});
				warningEl.style.color = 'var(--text-error)';
				warningEl.style.fontWeight = 'bold';
				warningEl.style.marginTop = '8px';
			}
		}

		// Folder path setting (only show when folder is selected)
		if (settings.checkboxSource === 'folder') {
			new Setting(containerEl)
				.setName('Folder path')
				.setDesc('Path to the folder containing your task files')
				.addText(text => text
					.setPlaceholder('e.g., /My Tasks or My Tasks')
					.setValue(settings.customFolderPath)
					.onChange(async (value) => {
						await this.settingsService.updateSetting('customFolderPath', value);
						// Trigger checkbox source change
						this.app.workspace.trigger('ontask:settings-changed', { 
							key: 'customFolderPath', 
							value 
						});
					}));

			new Setting(containerEl)
				.setName('Include subfolders')
				.setDesc('When enabled, also search in subfolders')
				.addToggle(toggle => toggle
					.setValue(settings.includeSubfolders)
					.onChange(async (value) => {
						await this.settingsService.updateSetting('includeSubfolders', value);
						// Trigger checkbox source change
						this.app.workspace.trigger('ontask:settings-changed', { 
							key: 'includeSubfolders', 
							value 
						});
					}));
		}
	}

	private renderStatusConfiguration(containerEl: HTMLElement): void {
		// Create a container for the status configuration
		const statusConfigContainer = containerEl.createEl('div', { cls: 'status-config-container' });
		
		// Initialize and render the status configuration view
		const statusConfigView = new StatusConfigView(statusConfigContainer, this.statusConfigService, this.app);
		statusConfigView.render();
	}
}
