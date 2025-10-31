import { EventSystem } from '../../events';
import { StatusConfigService } from '../../settings/status-config';
import { Menu, Modal, App, Setting } from 'obsidian';

export interface ContextMenuServiceInterface {
	showContextMenu(event: MouseEvent, checkbox: any): void;
	showFiltersMenu(): void;
}

class FilterModal extends Modal {
	private statusConfigService: StatusConfigService;
	private settingsService: any;
	private dataService: any;
	private refreshCheckboxesCallback: () => Promise<void>;
	private resetTrackingCallback: () => void;
	private statusConfigs: any[];
	private plugin: any;

	constructor(
		app: App,
		statusConfigService: StatusConfigService,
		settingsService: any,
		dataService: any,
		refreshCheckboxesCallback: () => Promise<void>,
		resetTrackingCallback: () => void,
		plugin: any
	) {
		super(app);
		this.statusConfigService = statusConfigService;
		this.settingsService = settingsService;
		this.dataService = dataService;
		this.refreshCheckboxesCallback = refreshCheckboxesCallback;
		this.resetTrackingCallback = resetTrackingCallback;
		this.plugin = plugin;
		this.statusConfigs = this.statusConfigService.getStatusConfigs();
	}

	onOpen() {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		titleEl.textContent = 'Filter Statuses';
		
		// Add the ontask-filters-modal class to the modal element
		this.modalEl.addClass('ontask-filters-modal');

		// Status checkboxes using native Setting components
		const checkboxElements: { [key: string]: HTMLInputElement } = {};
		const toggleElements: { [key: string]: any } = {};

		for (const status of this.statusConfigs) {
			const setting = new Setting(contentEl)
				.setName(`${status.name} (${status.description})`);

			// Access the name container to add our status icon
			const nameContainer = setting.nameEl;
			
			// Create status display icon
			const statusDisplay = document.createElement('span');
			statusDisplay.className = 'ontask-status-icon-inline';
			statusDisplay.textContent = status.symbol;
			statusDisplay.style.setProperty('--ontask-status-color', status.color);
			statusDisplay.style.setProperty('--ontask-status-background-color', status.backgroundColor || 'transparent');
			
			// Always apply dynamic styling attributes since CSS variables are set for all statuses
			statusDisplay.setAttribute('data-dynamic-color', 'true');
			// Only set custom-status attribute for truly custom status configurations
			if (!StatusConfigService.isBuiltInStatus(status.symbol)) {
				statusDisplay.setAttribute('data-custom-status', 'true');
			}
			
			// Insert icon at the beginning of the name container
			nameContainer.insertBefore(statusDisplay, nameContainer.firstChild);

			// Add toggle control
			setting.addToggle(toggle => {
				toggle.setValue(status.filtered !== false);
				const checkbox = toggle.toggleEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
				if (checkbox) {
					checkboxElements[status.symbol] = checkbox;
					toggleElements[status.symbol] = toggle;
				}
				toggle.onChange(() => {
					// Toggle callback for visual feedback
				});
			});
		}

		// Quick filters section
		const quickFilters = this.dataService.getQuickFilters().filter((filter: any) => filter.enabled);
		if (quickFilters.length > 0) {
			const quickFiltersContainer = contentEl.createDiv('ontask-filters-quick-filters-container');
			
			// Store quick filter buttons for live updates
			const quickFilterButtons: { [key: string]: any } = {};
			
			for (const filter of quickFilters) {
				new Setting(quickFiltersContainer)
					.addButton(button => {
						button.setButtonText(filter.name);
						quickFilterButtons[filter.name] = button;
						
						button.onClick(() => {
							// Update status toggles
							filter.statusSymbols.forEach((symbol: string) => {
								const toggle = toggleElements[symbol];
								if (toggle) {
									toggle.setValue(true);
								}
							});

							Object.keys(toggleElements).forEach(symbol => {
								if (!filter.statusSymbols.includes(symbol)) {
									toggleElements[symbol].setValue(false);
								}
							});
							
							// Update quick filter button highlighting
							this.updateQuickFilterHighlighting(quickFilterButtons, toggleElements);
						});
					});
			}
			
			// Add config button to the same row as quick filter buttons
			new Setting(quickFiltersContainer)
				.addButton(button => {
					button.setButtonText('⚙️')
						.setClass('ontask-config-button')
						.onClick(() => {
							this.close();
							// Open settings and navigate to Quick Filters tab
							(this.app as any).setting.open();
							(this.app as any).setting.openTabById(this.plugin.manifest.id);
							
							// Navigate to Quick Filters tab after a short delay to ensure settings are loaded
							setTimeout(() => {
								const settingsTab = this.plugin.settingsTab;
								if (settingsTab && settingsTab.navigateToTab) {
									settingsTab.navigateToTab('quick-filters');
								}
							}, 100);
						});
				});
			
			// Add change listeners to all status toggles for live updates
			Object.values(toggleElements).forEach((toggle: any) => {
				toggle.onChange(() => {
					this.updateQuickFilterHighlighting(quickFilterButtons, toggleElements);
				});
			});
			
			// Initial highlighting update
			this.updateQuickFilterHighlighting(quickFilterButtons, toggleElements);
		}

		// Buttons
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(button => button
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					await this.saveFilterSettings(toggleElements);
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}


	private updateQuickFilterHighlighting(quickFilterButtons: { [key: string]: any }, toggleElements: { [key: string]: any }): void {
		// Get current active status symbols from toggles
		const activeStatusSymbols = Object.keys(toggleElements).filter(symbol => toggleElements[symbol].getValue());
		
		// Get all quick filters
		const quickFilters = this.dataService.getQuickFilters().filter((filter: any) => filter.enabled);
		
		// Update highlighting for each quick filter button
		quickFilters.forEach((filter: any) => {
			const button = quickFilterButtons[filter.name];
			if (button) {
				const filterMatchesCurrent = this.doesQuickFilterMatchCurrentSelection(filter.statusSymbols, activeStatusSymbols);
				
				if (filterMatchesCurrent) {
					button.buttonEl.addClass('ontask-quick-filter-selected');
				} else {
					button.buttonEl.removeClass('ontask-quick-filter-selected');
				}
			}
		});
	}

	private doesQuickFilterMatchCurrentSelection(filterStatusSymbols: string[], activeStatusSymbols: string[]): boolean {
		// A quick filter matches if all its status symbols are active and no other statuses are active
		// This means the current selection exactly matches the quick filter's configuration
		if (filterStatusSymbols.length !== activeStatusSymbols.length) {
			return false;
		}
		
		return filterStatusSymbols.every(symbol => activeStatusSymbols.includes(symbol));
	}

	private async saveFilterSettings(toggleElements: { [key: string]: any }): Promise<void> {
		for (const [symbol, toggle] of Object.entries(toggleElements)) {
			await this.statusConfigService.updateStatusFiltered(symbol, toggle.getValue());
		}
		
		this.resetTrackingCallback();
		await this.refreshCheckboxesCallback();
		this.close();
	}
}

export class ContextMenuService implements ContextMenuServiceInterface {
	private eventSystem: EventSystem;
	private statusConfigService: StatusConfigService;
	private settingsService: any;
	private dataService: any;
	private contentEl: HTMLElement;
	private updateCheckboxStatusCallback: (checkbox: any, newStatus: string) => Promise<void>;
	private refreshCheckboxesCallback: () => Promise<void>;
	private resetTrackingCallback: () => void;
	private filterModal: FilterModal | null = null;
	private app: App;
	private plugin: any;

	constructor(
		app: App,
		eventSystem: EventSystem,
		statusConfigService: StatusConfigService,
		settingsService: any,
		dataService: any,
		contentEl: HTMLElement,
		updateCheckboxStatusCallback: (checkbox: any, newStatus: string) => Promise<void>,
		refreshCheckboxesCallback: () => Promise<void>,
		resetTrackingCallback: () => void,
		plugin: any
	) {
		this.app = app;
		this.eventSystem = eventSystem;
		this.statusConfigService = statusConfigService;
		this.settingsService = settingsService;
		this.dataService = dataService;
		this.contentEl = contentEl;
		this.updateCheckboxStatusCallback = updateCheckboxStatusCallback;
		this.refreshCheckboxesCallback = refreshCheckboxesCallback;
		this.resetTrackingCallback = resetTrackingCallback;
		this.plugin = plugin;
	}

	showContextMenu(event: MouseEvent, checkbox: any): void {
		const menu = new Menu();
		const statuses = this.statusConfigService.getStatusConfigs();

		for (const status of statuses) {
			menu.addItem((item) => {
				// Set title with status symbol and name
				item.setTitle(status.name)
					.setChecked(false)
					.onClick(async () => {
						await this.updateCheckboxStatusCallback(checkbox, status.symbol);
					});

				// Access the menu item's DOM to precisely control appearance
				const menuEl = (item as any).dom as HTMLElement;
				if (menuEl) {
					// Create a styled status display element
					const statusDisplay = document.createElement('span');
					statusDisplay.className = 'ontask-context-menu-status-display';
					statusDisplay.textContent = status.symbol;
					statusDisplay.style.setProperty('--ontask-status-color', status.color);
					statusDisplay.style.setProperty('--ontask-status-background-color', status.backgroundColor || 'transparent');
					
					// Always apply dynamic styling attributes since CSS variables are set for all statuses
					statusDisplay.setAttribute('data-dynamic-color', 'true');
					// Only set custom-status attribute for truly custom status configurations
					if (!StatusConfigService.isBuiltInStatus(status.symbol)) {
						statusDisplay.setAttribute('data-custom-status', 'true');
					}
					
					// Find the title element in the menu item
					const titleEl = menuEl.querySelector('.menu-item-title');
					if (titleEl) {
						titleEl.insertBefore(statusDisplay, titleEl.firstChild);
					}
				}
			});
		}

		menu.showAtMouseEvent(event);
	}

	showFiltersMenu(): void {
		// If modal is already open, close it
		if (this.filterModal) {
			this.filterModal.close();
			this.filterModal = null;
			return;
		}

		// Create and open a new modal
		const modal = new FilterModal(
			this.app,
			this.statusConfigService,
			this.settingsService,
			this.dataService,
			this.refreshCheckboxesCallback,
			this.resetTrackingCallback,
			this.plugin
		);
		
		// Store the modal and clear reference when it closes
		this.filterModal = modal;
		const originalOnClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			originalOnClose();
			this.filterModal = null;
		};
		
		modal.open();
	}
}

