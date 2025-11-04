// Quick Filters view component for settings
import { App, Setting, Modal } from 'obsidian';
import { DataService, QuickFilter } from '../../data/DataServiceInterface';
import { StatusConfigService } from '../StatusConfig';
import { setupDragAndDrop } from '../../../shared/DragAndDropUtils';
import { IconService } from '../../../shared/IconService';
import { Logger } from '../../logging/Logger';

export class QuickFiltersView {
	private app: App;
	private dataService: DataService;
	private statusConfigService: StatusConfigService;
	private containerEl: HTMLElement;
	private logger: Logger | null;

	constructor(app: App, dataService: DataService, statusConfigService: StatusConfigService, containerEl: HTMLElement, logger?: Logger | null) {
		this.app = app;
		this.dataService = dataService;
		this.statusConfigService = statusConfigService;
		this.containerEl = containerEl;
		this.logger = logger || null;
	}

	render(): void {
		this.containerEl.empty();
		this.containerEl.addClass('ontask-quick-filters-view');

		// Header
		this.containerEl.createEl('p', { 
			text: 'Create collections of status filters that can be quickly applied in the OnTask view.',
			cls: 'setting-item-description'
		});

		// Render existing quick filters
		this.renderQuickFilters();
	}

	private renderQuickFilters(): void {
		const quickFilters = this.dataService.getQuickFilters();

		// Create a container for draggable items
		const filtersContainer = this.containerEl.createDiv();
		filtersContainer.addClass('quick-filters-draggable-container');
		
		if (quickFilters.length === 0) {
			const emptyState = filtersContainer.createDiv();
			emptyState.addClass('setting-item');
			emptyState.createEl('p', { 
				text: 'No quick filters created yet. Click "Add Filter" to create your first one.',
				cls: 'setting-item-description'
			});
		} else {
			quickFilters.forEach((filter, index) => {
				this.renderQuickFilterItem(filter, filtersContainer, index);
			});
		}

		// Add new quick filter button at the bottom
		this.renderAddButton(filtersContainer);
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
		const gripIcon = IconService.getConfigIconElement('grip-vertical', { width: 16, height: 16 });
		if (gripIcon) {
			dragHandle.appendChild(gripIcon);
		}

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
				// Always apply dynamic styling attributes since CSS variables are set for all statuses
				statusBadge.setAttribute('data-dynamic-color', 'true');
				// Use CSS variables for dynamic colors instead of direct style assignments
				statusBadge.style.setProperty('--ontask-status-color', statusConfig.color);
				statusBadge.style.setProperty('--ontask-status-background-color', statusConfig.backgroundColor || 'transparent');
				
				// Only set custom-status attribute for truly custom status configurations
				if (!StatusConfigService.isBuiltInStatus(symbol)) {
					statusBadge.setAttribute('data-custom-status', 'true');
				}
			}
		});

		// Control container for edit, delete buttons (toggle removed) - placed after status badges
		const controlsContainer = settingItem.createDiv();
		controlsContainer.addClass('quick-filter-controls');

		// Edit button
		const editButton = controlsContainer.createEl('button', { cls: 'quick-filter-edit-btn' });
		IconService.setConfigIcon(editButton, 'edit');
		editButton.addEventListener('click', () => this.showEditQuickFilterModal(filter), { passive: true });

		// Delete button
		const deleteButton = controlsContainer.createEl('button', { cls: 'quick-filter-delete-btn' });
		IconService.setConfigIcon(deleteButton, 'delete');
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

	private renderAddButton(containerEl: HTMLElement): void {
		const addBtn = containerEl.createEl('button', { 
			cls: 'quick-filter-add-btn',
			text: '+ Add quick filter'
		});
		
		addBtn.addEventListener('click', () => this.showAddQuickFilterModal(), { passive: true });
	}

	private showAddQuickFilterModal(): void {
		this.showQuickFilterModal();
	}

	private showEditQuickFilterModal(filter: QuickFilter): void {
		this.showQuickFilterModal(filter);
	}

	private showQuickFilterModal(existingFilter?: QuickFilter): void {
		const modal = new Modal(this.app);
		modal.titleEl.textContent = existingFilter ? 'Edit quick filter' : 'Add quick filter';

		const content = modal.contentEl;
		content.empty();
		// Add a unique class to scope styles within this modal only
		content.addClass('ontask-quick-filter-modal');

		// Local variables to track form state
		let filterName = existingFilter?.name || '';
		let filterEnabled = existingFilter?.enabled ?? true;
		const selectedStatuses = new Set(existingFilter?.statusSymbols || []);

		// Name input
		const nameSetting = new Setting(content)
			.setName('Filter name')
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

		statusConfigs.forEach(statusConfig => {
			const statusSetting = new Setting(content)
				.setName(`${statusConfig.name} (${statusConfig.description})`)
				.setDesc('');

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

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => modal.close(), { passive: true });

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
				// Log error using logger with console fallback
				if (this.logger) {
					this.logger.error('[OnTask QuickFiltersView] Error saving quick filter:', error);
				} else {
					console.error('[OnTask QuickFiltersView] Error saving quick filter:', error);
				}
				// Show error message
				const errorEl = content.querySelector('.ontask-error-message');
				if (errorEl) errorEl.remove();
				
				const errorMessage = content.createDiv();
				errorMessage.addClass('ontask-error-message');
				errorMessage.textContent = 'Failed to save quick filter. Please try again.';
				errorMessage.setAttribute('data-dynamic-error', 'true');
			}
		}, { passive: true });

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



