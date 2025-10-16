// Settings slice - UI view implementation
import { App, PluginSettingTab } from 'obsidian';
import { SettingsService } from './settings-interface';
import { StatusConfigService } from './status-config';
import { DataService } from '../data/data-service-interface';
import { GeneralSettingsView } from './general-settings-view';
import { StatusConfigSettingsView } from './status-config-settings-view';
import { QuickFiltersView } from './quick-filters-view';

export class OnTaskSettingsTab extends PluginSettingTab {
	private settingsService: SettingsService;
	private statusConfigService: StatusConfigService;
	private dataService: DataService;
	private currentTab: 'general' | 'status' | 'quick-filters' = 'general';

	constructor(app: App, plugin: any, settingsService: SettingsService, statusConfigService: StatusConfigService, dataService: DataService) {
		super(app, plugin);
		this.settingsService = settingsService;
		this.statusConfigService = statusConfigService;
		this.dataService = dataService;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Render tab navigation
		this.renderTabNavigation(containerEl);

		// Render content based on current tab
		this.renderTabContent(containerEl);
	}

	private renderTabNavigation(containerEl: HTMLElement): void {
		const tabContainer = containerEl.createDiv();
		tabContainer.addClass('ontask-settings-tabs');
		tabContainer.style.display = 'flex';
		tabContainer.style.borderBottom = '1px solid var(--background-modifier-border)';
		tabContainer.style.marginBottom = '16px';

		const tabs = [
			{ id: 'general', name: 'General' },
			{ id: 'status', name: 'Status Configuration' },
			{ id: 'quick-filters', name: 'Quick Filters' }
		];

		tabs.forEach(tab => {
			const tabEl = tabContainer.createEl('button', { text: tab.name });
			tabEl.addClass('ontask-tab-button');
			tabEl.style.padding = '8px 16px';
			tabEl.style.border = 'none';
			tabEl.style.background = 'transparent';
			tabEl.style.cursor = 'pointer';
			tabEl.style.borderBottom = this.currentTab === tab.id ? '2px solid var(--interactive-accent)' : '2px solid transparent';
			tabEl.style.color = this.currentTab === tab.id ? 'var(--interactive-accent)' : 'var(--text-muted)';

			tabEl.addEventListener('click', () => {
				this.currentTab = tab.id as 'general' | 'status' | 'quick-filters';
				this.display(); // Re-render with new tab
			});
		});
	}

	private renderTabContent(containerEl: HTMLElement): void {
		const contentContainer = containerEl.createDiv();
		contentContainer.addClass('ontask-settings-content');

		switch (this.currentTab) {
			case 'general':
				this.renderGeneralSettings(contentContainer);
				break;
			case 'status':
				this.renderStatusConfiguration(contentContainer);
				break;
			case 'quick-filters':
				this.renderQuickFiltersSettings(contentContainer);
				break;
		}
	}

	private renderGeneralSettings(containerEl: HTMLElement): void {
		const generalSettingsView = new GeneralSettingsView(this.app, this.settingsService, containerEl);
		generalSettingsView.render();
	}

	private renderStatusConfiguration(containerEl: HTMLElement): void {
		const statusConfigSettingsView = new StatusConfigSettingsView(this.app, this.statusConfigService, containerEl);
		statusConfigSettingsView.render();
	}

	private renderQuickFiltersSettings(containerEl: HTMLElement): void {
		const quickFiltersView = new QuickFiltersView(this.app, this.dataService, this.statusConfigService, containerEl);
		quickFiltersView.render();
	}

}
