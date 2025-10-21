// General Settings view component for settings
import { App, Setting } from 'obsidian';
import { SettingsService } from '../SettingsServiceInterface';

export class GeneralSettingsView {
	private app: App;
	private settingsService: SettingsService;
	private containerEl: HTMLElement;

	constructor(app: App, settingsService: SettingsService, containerEl: HTMLElement) {
		this.app = app;
		this.settingsService = settingsService;
		this.containerEl = containerEl;
	}

	render(): void {
		this.containerEl.empty();

		// Basic settings
		this.renderBasicSettings();
		
		// Checkbox source settings
		this.renderCheckboxSourceSettings();
	}

	private renderBasicSettings(): void {
		const settings = this.settingsService.getSettings();

		new Setting(this.containerEl)
			.setName('Only show today')
			.setDesc('When enabled, only tasks from today\'s files will be displayed in the task view')
			.addToggle(toggle => toggle
				.setValue(settings.onlyShowToday)
				.onChange(async (value) => {
					await this.settingsService.updateSetting('onlyShowToday', value);
				}));

		new Setting(this.containerEl)
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

		new Setting(this.containerEl)
			.setName('Load more limit')
			.setDesc('Number of tasks to load per batch for better performance. This limit applies to both initial load and all subsequent Load More operations.')
			.addText(text => text
				.setValue(settings.loadMoreLimit.toString())
				.setPlaceholder('10')
				.onChange(async (value) => {
					const numValue = parseInt(value) || 10;
					await this.settingsService.updateSetting('loadMoreLimit', numValue);
				}));

		new Setting(this.containerEl)
			.setName('Debug logging')
			.setDesc('Enable debug logging for troubleshooting. When enabled, detailed logs will be written to the console.')
			.addToggle(toggle => toggle
				.setValue(settings.debugLoggingEnabled)
				.onChange(async (value) => {
					await this.settingsService.updateSetting('debugLoggingEnabled', value);
					// Trigger logging service update
					this.app.workspace.trigger('ontask:settings-changed', { 
						key: 'debugLoggingEnabled', 
						value 
					});
				}));
	}

	private renderCheckboxSourceSettings(): void {
		const settings = this.settingsService.getSettings();

		// Checkbox source selection
		const sourceSetting = new Setting(this.containerEl)
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
					this.render();
				}));

		// Add warning for Daily Notes if plugin is not available
		if (settings.checkboxSource === 'daily-notes') {
			if (!this.settingsService.isDailyNotesAvailable()) {
				const warningEl = this.containerEl.createEl('div', { 
					cls: 'setting-item-description',
					text: '⚠️ Daily Notes plugin is not enabled. Please enable it in Settings → Community plugins.'
				});
				warningEl.addClass('ontask-warning-text');
			}
		}

		// Folder path setting (only show when folder is selected)
		if (settings.checkboxSource === 'folder') {
			new Setting(this.containerEl)
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

			new Setting(this.containerEl)
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
}

