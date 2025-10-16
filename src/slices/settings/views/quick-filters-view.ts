// Quick Filters view component for settings
import { App, Setting, Modal } from 'obsidian';
import { DataService, QuickFilter } from '../../data/data-service-interface';
import { StatusConfigService } from '../status-config';

export class QuickFiltersView {
	private app: App;
	private dataService: DataService;
	private statusConfigService: StatusConfigService;
	private containerEl: HTMLElement;

	constructor(app: App, dataService: DataService, statusConfigService: StatusConfigService, containerEl: HTMLElement) {
		this.app = app;
		this.dataService = dataService;
		this.statusConfigService = statusConfigService;
		this.containerEl = containerEl;
	}

	render(): void {
		this.containerEl.empty();

		// Header
		const header = this.containerEl.createDiv();
		header.addClass('setting-item');
		header.createEl('h3', { text: 'Quick Filters' });
		header.createEl('p', { 
			text: 'Create collections of status filters that can be quickly applied in the OnTask view.',
			cls: 'setting-item-description'
		});

		// Add new quick filter button
		const addButton = this.containerEl.createDiv();
		addButton.addClass('setting-item');
		new Setting(addButton)
			.setName('Add Quick Filter')
			.setDesc('Create a new quick filter collection')
			.addButton(button => button
				.setButtonText('Add Filter')
				.setCta()
				.onClick(() => this.showAddQuickFilterModal()));

		// Render existing quick filters
		this.renderQuickFilters();
	}

	private renderQuickFilters(): void {
		const quickFilters = this.dataService.getQuickFilters();
		
		if (quickFilters.length === 0) {
			const emptyState = this.containerEl.createDiv();
			emptyState.addClass('setting-item');
			emptyState.createEl('p', { 
				text: 'No quick filters created yet. Click "Add Filter" to create your first one.',
				cls: 'setting-item-description'
			});
			return;
		}

		quickFilters.forEach(filter => {
			this.renderQuickFilterItem(filter);
		});
	}

	private renderQuickFilterItem(filter: QuickFilter): void {
		const settingItem = this.containerEl.createDiv();
		settingItem.addClass('setting-item');
		settingItem.addClass('quick-filter-item');

		const setting = new Setting(settingItem)
			.setName(filter.name);

		// Enable/disable toggle
		setting.addToggle(toggle => toggle
			.setValue(filter.enabled)
			.onChange(async (value) => {
				await this.dataService.updateQuickFilter(filter.id, { ...filter, enabled: value });
				this.render(); // Re-render to update the UI
			}));

		// Edit button
		setting.addButton(button => button
			.setButtonText('Edit')
			.setIcon('edit')
			.onClick(() => this.showEditQuickFilterModal(filter)));

		// Delete button
		setting.addButton(button => button
			.setButtonText('Delete')
			.setIcon('trash')
			.setWarning()
			.onClick(() => this.showDeleteConfirmation(filter)));

		// Status symbols display
		const statusDisplay = settingItem.createDiv();
		statusDisplay.addClass('quick-filter-statuses');
		statusDisplay.style.marginTop = '8px';
		statusDisplay.style.display = 'flex';
		statusDisplay.style.flexWrap = 'wrap';
		statusDisplay.style.gap = '4px';

		filter.statusSymbols.forEach(symbol => {
			const statusConfig = this.statusConfigService.getStatusConfig(symbol);
			if (statusConfig) {
				const statusBadge = statusDisplay.createSpan();
				statusBadge.addClass('quick-filter-status-badge');
				statusBadge.textContent = statusConfig.name;
				statusBadge.style.backgroundColor = statusConfig.backgroundColor || 'transparent';
				statusBadge.style.color = statusConfig.color;
				statusBadge.style.padding = '2px 6px';
				statusBadge.style.borderRadius = '3px';
				statusBadge.style.fontSize = '12px';
				statusBadge.style.border = '1px solid var(--background-modifier-border)';
			}
		});
	}


	private showAddQuickFilterModal(): void {
		this.showQuickFilterModal();
	}

	private showEditQuickFilterModal(filter: QuickFilter): void {
		this.showQuickFilterModal(filter);
	}

	private showQuickFilterModal(existingFilter?: QuickFilter): void {
		const modal = new Modal(this.app);
		modal.titleEl.textContent = existingFilter ? 'Edit Quick Filter' : 'Add Quick Filter';

		const content = modal.contentEl;
		content.empty();

		// Name input
		const nameSetting = new Setting(content)
			.setName('Filter Name')
			.setDesc('The name that will appear on the button')
			.addText(text => text
				.setPlaceholder('Enter filter name')
				.setValue(existingFilter?.name || '')
				.onChange(value => {
					(modal as any).filterName = value;
				}));

		// Status selection
		const statusConfigs = this.statusConfigService.getStatusConfigs();
		const selectedStatuses = new Set(existingFilter?.statusSymbols || []);

		content.createEl('h4', { text: 'Select Statuses' });
		content.createEl('p', { 
			text: 'Choose which statuses should be checked when this filter is applied.',
			cls: 'setting-item-description'
		});

		statusConfigs.forEach(statusConfig => {
			const statusSetting = new Setting(content)
				.setName(statusConfig.name)
				.setDesc(statusConfig.description);

			statusSetting.addToggle(toggle => toggle
				.setValue(selectedStatuses.has(statusConfig.symbol))
				.onChange(value => {
					if (value) {
						selectedStatuses.add(statusConfig.symbol);
					} else {
						selectedStatuses.delete(statusConfig.symbol);
					}
				}));
		});

		// Buttons
		const buttonContainer = content.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '8px';
		buttonContainer.style.marginTop = '16px';

		const saveButton = buttonContainer.createEl('button', { text: 'Save' });
		saveButton.addClass('mod-cta');
		saveButton.addEventListener('click', async () => {
			const filterName = (modal as any).filterName?.trim();
			if (!filterName) {
				// Show error
				return;
			}

			if (selectedStatuses.size === 0) {
				// Show error
				return;
			}

			const quickFilter: QuickFilter = {
				id: existingFilter?.id || this.generateId(),
				name: filterName,
				statusSymbols: Array.from(selectedStatuses),
				enabled: existingFilter?.enabled ?? true
			};

			if (existingFilter) {
				await this.dataService.updateQuickFilter(existingFilter.id, quickFilter);
			} else {
				await this.dataService.addQuickFilter(quickFilter);
			}

			modal.close();
			this.render(); // Re-render the view
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => modal.close());

		modal.open();
	}

	private showDeleteConfirmation(filter: QuickFilter): void {
		const modal = new Modal(this.app);
		modal.titleEl.textContent = 'Delete Quick Filter';

		const content = modal.contentEl;
		content.empty();

		content.createEl('p', { 
			text: `Are you sure you want to delete the quick filter "${filter.name}"? This action cannot be undone.`
		});

		const buttonContainer = content.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '8px';
		buttonContainer.style.marginTop = '16px';

		const deleteButton = buttonContainer.createEl('button', { text: 'Delete' });
		deleteButton.addClass('mod-warning');
		deleteButton.addEventListener('click', async () => {
			await this.dataService.removeQuickFilter(filter.id);
			modal.close();
			this.render(); // Re-render the view
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => modal.close());

		modal.open();
	}

	private generateId(): string {
		return 'quick-filter-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
	}
}
