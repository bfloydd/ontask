// Quick Filters view component for settings
import { App, Setting, Modal } from 'obsidian';
import { DataService, QuickFilter } from '../../data/DataServiceInterface';
import { StatusConfigService } from '../status-config';
import { setupDragAndDrop } from '../../../shared/drag-and-drop-utils';

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
		this.containerEl.addClass('ontask-quick-filters-view');

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

		// Create a container for draggable items
		const filtersContainer = this.containerEl.createDiv();
		filtersContainer.addClass('quick-filters-draggable-container');

		quickFilters.forEach((filter, index) => {
			this.renderQuickFilterItem(filter, filtersContainer, index);
		});
	}

	private renderQuickFilterItem(filter: QuickFilter, container: HTMLElement, index: number): void {
		const settingItem = container.createDiv();
		settingItem.addClass('quick-filter-item');
		if (!filter.enabled) {
			settingItem.addClass('quick-filter-disabled');
		}
		settingItem.setAttribute('data-filter-id', filter.id);
		settingItem.setAttribute('draggable', 'true');

		// Drag handle icon
		const dragHandle = settingItem.createDiv();
		dragHandle.addClass('quick-filter-drag-handle');
		dragHandle.setAttribute('data-icon', 'grip-vertical');
		dragHandle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>';

		// Filter name
		const nameEl = settingItem.createDiv();
		nameEl.addClass('quick-filter-name');
		nameEl.textContent = filter.name;

		// Status symbols display (moved before controls)
		const statusDisplay = settingItem.createDiv();
		statusDisplay.addClass('quick-filter-statuses');
		// Status display styles are now handled by CSS

		filter.statusSymbols.forEach(symbol => {
			const statusConfig = this.statusConfigService.getStatusConfig(symbol);
			if (statusConfig) {
				const statusBadge = statusDisplay.createSpan();
				statusBadge.addClass('quick-filter-status-badge');
				statusBadge.textContent = statusConfig.name;
				// Apply colors from status config for all statuses
				statusBadge.style.setProperty('--ontask-status-color', statusConfig.color);
				statusBadge.style.setProperty('--ontask-status-background-color', statusConfig.backgroundColor || 'transparent');
				
				// Only apply dynamic styling attributes if this is a truly custom status configuration
				// (not one of the built-in default statuses that have predefined colors)
				const isBuiltInStatus = ['x', '!', '?', '*', 'r', 'b', '<', '>', '-', '/', '+', '.', '#'].includes(symbol);
				if (!isBuiltInStatus) {
					statusBadge.setAttribute('data-dynamic-color', 'true');
					statusBadge.setAttribute('data-custom-status', 'true');
				}
			}
		});

		// Control container for edit, delete buttons (toggle removed) - placed after status badges
		const controlsContainer = settingItem.createDiv();
		controlsContainer.addClass('quick-filter-controls');

		// Edit button
		const editButton = controlsContainer.createEl('button', { cls: 'quick-filter-edit-btn' });
		editButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
		editButton.addEventListener('click', () => this.showEditQuickFilterModal(filter), { passive: true });

		// Delete button
		const deleteButton = controlsContainer.createEl('button', { cls: 'quick-filter-delete-btn mod-warning' });
		deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
		deleteButton.addEventListener('click', () => this.showDeleteConfirmation(filter), { passive: true });

		// Set up drag and drop event handlers
		setupDragAndDrop<QuickFilter>({
			itemElement: settingItem,
			itemIndex: index,
			draggingClass: 'quick-filter-dragging',
			dragOverClass: 'quick-filter-drag-over',
			dropIndicatorClass: 'quick-filter-drop-indicator',
			containerSelector: '.quick-filters-draggable-container',
			itemSelector: '.quick-filter-item',
			getItems: () => this.dataService.getQuickFilters(),
			saveItems: async (items) => {
				await this.dataService.reorderQuickFilters(items);
			},
			onReorder: () => {
				this.render();
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

		// Local variables to track form state
		let filterName = existingFilter?.name || '';
		let filterEnabled = existingFilter?.enabled ?? true;
		const selectedStatuses = new Set(existingFilter?.statusSymbols || []);

		// Name input
		const nameSetting = new Setting(content)
			.setName('Filter Name')
			.setDesc('The name that will appear on the button')
			.addText(text => text
				.setPlaceholder('Enter filter name')
				.setValue(filterName)
				.onChange(value => {
					filterName = value;
				}));

		// Enable/disable toggle
		const enabledSetting = new Setting(content)
			.setName('Enabled')
			.setDesc('When disabled, this filter will not appear in the filter menu')
			.addToggle(toggle => toggle
				.setValue(filterEnabled)
				.onChange(value => {
					filterEnabled = value;
				}));

		// Status selection
		const statusConfigs = this.statusConfigService.getStatusConfigs();

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
		buttonContainer.addClass('ontask-button-container');

		const saveButton = buttonContainer.createEl('button', { text: 'Save' });
		saveButton.addClass('mod-cta');
		saveButton.addEventListener('click', async () => {
			const trimmedName = filterName.trim();
			if (!trimmedName) {
				// Show error message
				const errorEl = content.querySelector('.ontask-error-message');
				if (errorEl) errorEl.remove();
				
				const errorMessage = content.createDiv();
				errorMessage.addClass('ontask-error-message');
				errorMessage.textContent = 'Please enter a filter name.';
				errorMessage.setAttribute('data-dynamic-error', 'true');
				return;
			}

			if (selectedStatuses.size === 0) {
				// Show error message
				const errorEl = content.querySelector('.ontask-error-message');
				if (errorEl) errorEl.remove();
				
				const errorMessage = content.createDiv();
				errorMessage.addClass('ontask-error-message');
				errorMessage.textContent = 'Please select at least one status.';
				errorMessage.setAttribute('data-dynamic-error', 'true');
				return;
			}

			try {
				const quickFilter: QuickFilter = {
					id: existingFilter?.id || this.generateId(),
					name: trimmedName,
					statusSymbols: Array.from(selectedStatuses),
					enabled: filterEnabled
				};

				if (existingFilter) {
					await this.dataService.updateQuickFilter(existingFilter.id, quickFilter);
				} else {
					await this.dataService.addQuickFilter(quickFilter);
				}

				modal.close();
				this.render(); // Re-render the view
			} catch (error) {
				console.error('OnTask: Error saving quick filter:', error);
				// Show error message
				const errorEl = content.querySelector('.ontask-error-message');
				if (errorEl) errorEl.remove();
				
				const errorMessage = content.createDiv();
				errorMessage.addClass('ontask-error-message');
				errorMessage.textContent = 'Failed to save quick filter. Please try again.';
				errorMessage.setAttribute('data-dynamic-error', 'true');
			}
		}, { passive: true });

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => modal.close(), { passive: true });

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
		buttonContainer.addClass('ontask-button-container');

		const deleteButton = buttonContainer.createEl('button', { text: 'Delete' });
		deleteButton.addClass('mod-warning');
		deleteButton.addEventListener('click', async () => {
			await this.dataService.removeQuickFilter(filter.id);
			modal.close();
			this.render(); // Re-render the view
		}, { passive: true });

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => modal.close(), { passive: true });

		modal.open();
	}

	private generateId(): string {
		return 'quick-filter-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
	}
}
