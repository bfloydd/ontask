import { EventSystem } from '../events';
import { StatusConfigService } from '../settings/status-config';

export interface ContextMenuServiceInterface {
	showContextMenu(event: MouseEvent, checkbox: any): void;
	showFiltersMenu(): void;
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

	constructor(
		eventSystem: EventSystem,
		statusConfigService: StatusConfigService,
		settingsService: any,
		dataService: any,
		contentEl: HTMLElement,
		updateCheckboxStatusCallback: (checkbox: any, newStatus: string) => Promise<void>,
		refreshCheckboxesCallback: () => Promise<void>,
		resetTrackingCallback: () => void
	) {
		this.eventSystem = eventSystem;
		this.statusConfigService = statusConfigService;
		this.settingsService = settingsService;
		this.dataService = dataService;
		this.contentEl = contentEl;
		this.updateCheckboxStatusCallback = updateCheckboxStatusCallback;
		this.refreshCheckboxesCallback = refreshCheckboxesCallback;
		this.resetTrackingCallback = resetTrackingCallback;
	}

	showContextMenu(event: MouseEvent, checkbox: any): void {
		console.log('Context Menu Service: Context menu triggered', event, checkbox);
		
		// Remove any existing context menu
		const existingMenu = document.querySelector('.ontask-context-menu');
		if (existingMenu) {
			existingMenu.remove();
		}

		// Create context menu
		const menu = this.createContextMenu(checkbox);
		
		// Add to document first to get dimensions
		document.body.appendChild(menu);

		// Smart positioning to prevent off-screen display
		this.positionContextMenu(menu, event);
		console.log('Context Menu Service: Context menu added to DOM', menu);

		// Close menu when clicking outside, scrolling, or right-clicking anywhere
		this.setupMenuCloseHandlers(menu);
	}

	private createContextMenu(checkbox: any): HTMLElement {
		const menu = document.createElement('div');
		menu.className = 'ontask-context-menu';
		menu.style.position = 'fixed';
		menu.style.zIndex = '1000';
		menu.style.background = 'var(--background-primary)';
		menu.style.border = '1px solid var(--background-modifier-border)';
		menu.style.borderRadius = '6px';
		menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
		menu.style.padding = '2px';
		menu.style.minWidth = '200px';

		// Use centralized status configuration
		const statuses = this.statusConfigService.getStatusConfigs();

		// Add menu items for each status
		for (const status of statuses) {
			const menuItem = this.createMenuItem(status, checkbox);
			menu.appendChild(menuItem);
		}

		return menu;
	}

	private createMenuItem(status: any, checkbox: any): HTMLElement {
		const menuItem = document.createElement('div');
		menuItem.className = 'ontask-context-menu-item';
		menuItem.style.padding = '6px 10px';
		menuItem.style.cursor = 'pointer';
		menuItem.style.fontSize = '14px';
		menuItem.style.color = 'var(--text-normal)';
		menuItem.style.borderRadius = '4px';
		menuItem.style.display = 'flex';
		menuItem.style.alignItems = 'center';
		menuItem.style.gap = '6px';

		// Create status display with colors from configuration
		const statusDisplay = this.createStatusDisplay(status);

		// Create text content
		const textContent = this.createTextContent(status);

		menuItem.appendChild(statusDisplay);
		menuItem.appendChild(textContent);

		// Add hover effect
		this.addHoverEffects(menuItem);

		// Add click handler
		menuItem.addEventListener('click', () => {
			this.updateCheckboxStatusCallback(checkbox, status.symbol);
			menuItem.closest('.ontask-context-menu')?.remove();
		});

		return menuItem;
	}

	private createStatusDisplay(status: any): HTMLElement {
		const statusDisplay = document.createElement('div');
		statusDisplay.className = 'ontask-checkbox-display';
		statusDisplay.setAttribute('data-status', status.symbol);
		statusDisplay.textContent = this.getStatusDisplayText(status.symbol);
		statusDisplay.style.fontSize = '12px';
		statusDisplay.style.minWidth = '24px';
		statusDisplay.style.height = '20px';
		statusDisplay.style.display = 'flex';
		statusDisplay.style.alignItems = 'center';
		statusDisplay.style.justifyContent = 'center';
		statusDisplay.style.color = status.color;
		statusDisplay.style.backgroundColor = status.backgroundColor || 'transparent';
		statusDisplay.style.border = `1px solid ${status.color}`;
		statusDisplay.style.borderRadius = '3px';

		return statusDisplay;
	}

	private createTextContent(status: any): HTMLElement {
		const textContent = document.createElement('div');
		textContent.style.display = 'flex';
		textContent.style.flexDirection = 'column';
		textContent.style.gap = '1px';
		
		const nameEl = document.createElement('div');
		nameEl.textContent = status.name;
		nameEl.style.fontWeight = '500';
		
		const descEl = document.createElement('div');
		descEl.textContent = status.description;
		descEl.style.fontSize = '12px';
		descEl.style.color = 'var(--text-muted)';
		
		textContent.appendChild(nameEl);
		textContent.appendChild(descEl);

		return textContent;
	}

	private addHoverEffects(menuItem: HTMLElement): void {
		menuItem.addEventListener('mouseenter', () => {
			menuItem.style.background = 'var(--background-modifier-hover)';
		});
		menuItem.addEventListener('mouseleave', () => {
			menuItem.style.background = 'transparent';
		});
	}

	private setupMenuCloseHandlers(menu: HTMLElement): void {
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu);
				document.removeEventListener('scroll', closeMenu);
				document.removeEventListener('contextmenu', closeMenu);
			}
		};

		// Use requestAnimationFrame to avoid immediate closure
		requestAnimationFrame(() => {
			document.addEventListener('click', closeMenu);
			document.addEventListener('scroll', closeMenu, true); // Use capture phase for scroll events
			document.addEventListener('contextmenu', closeMenu);
		});
	}

	private positionContextMenu(menu: HTMLElement, event: MouseEvent): void {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuRect = menu.getBoundingClientRect();
		const menuWidth = menuRect.width;
		const menuHeight = menuRect.height;
		
		// Get initial position from event
		let left = event.clientX;
		let top = event.clientY;
		
		// Mobile-specific adjustments
		const isMobile = window.innerWidth <= 768;
		const margin = isMobile ? 5 : 10; // Smaller margin on mobile
		
		// Check if menu would go off the right edge
		if (left + menuWidth > viewportWidth - margin) {
			left = viewportWidth - menuWidth - margin;
		}
		
		// Check if menu would go off the left edge
		if (left < margin) {
			left = margin;
		}
		
		// Check if menu would go off the bottom edge
		if (top + menuHeight > viewportHeight - margin) {
			top = viewportHeight - menuHeight - margin;
		}
		
		// Check if menu would go off the top edge
		if (top < margin) {
			top = margin;
		}
		
		// Apply the calculated position
		menu.style.left = `${left}px`;
		menu.style.top = `${top}px`;
		
		// On mobile, ensure the menu is fully visible by adjusting if needed
		if (isMobile) {
			// Double-check positioning after setting styles
			requestAnimationFrame(() => {
				const finalRect = menu.getBoundingClientRect();
				if (finalRect.right > viewportWidth) {
					menu.style.left = `${viewportWidth - finalRect.width - margin}px`;
				}
				if (finalRect.bottom > viewportHeight) {
					menu.style.top = `${viewportHeight - finalRect.height - margin}px`;
				}
			});
		}
	}

	showFiltersMenu(): void {
		// Check if menu is already open and toggle it
		const existingMenu = document.querySelector('.ontask-filters-menu');
		if (existingMenu) {
			existingMenu.remove();
			return; // Menu was open, now it's closed - we're done
		}

		// Create filter menu
		const menu = this.createFiltersMenu();
		
		// Add to document
		document.body.appendChild(menu);

		// Position the menu
		this.positionFilterMenu(menu);

		// Close menu when clicking outside
		this.setupMenuCloseHandlers(menu);
	}

	private createFiltersMenu(): HTMLElement {
		const menu = document.createElement('div');
		menu.className = 'ontask-filters-menu';
		menu.style.position = 'fixed';
		menu.style.zIndex = '1000';
		menu.style.background = 'var(--background-primary)';
		menu.style.border = '1px solid var(--background-modifier-border)';
		menu.style.borderRadius = '6px';
		menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
		menu.style.padding = '12px';
		menu.style.maxWidth = '400px';

		// Get current settings and status configs
		const settings = this.settingsService.getSettings();
		const statusConfigs = this.statusConfigService.getStatusConfigs();

		// Create header
		const header = menu.createDiv();
		header.createEl('h3', { text: 'Status Filters' });

		// Create checkboxes for each status
		const checkboxesContainer = this.createStatusCheckboxes(menu, statusConfigs);
		menu.appendChild(checkboxesContainer);

		// Create Quick Filters section
		this.renderQuickFiltersSection(menu, checkboxesContainer);

		// Create buttons container
		this.createFilterButtons(menu, checkboxesContainer);

		return menu;
	}

	private createStatusCheckboxes(menu: HTMLElement, statusConfigs: any[]): HTMLElement {
		const checkboxesContainer = menu.createDiv();
		checkboxesContainer.style.display = 'flex';
		checkboxesContainer.style.flexDirection = 'column';
		checkboxesContainer.style.gap = '8px';

		// Track checkbox elements for save functionality
		const checkboxElements: { [key: string]: HTMLInputElement } = {};

		for (const status of statusConfigs) {
			const checkboxItem = this.createStatusCheckboxItem(status, checkboxElements);
			checkboxesContainer.appendChild(checkboxItem);
		}

		// Store checkbox elements for later use
		(checkboxesContainer as any).checkboxElements = checkboxElements;

		return checkboxesContainer;
	}

	private createStatusCheckboxItem(status: any, checkboxElements: { [key: string]: HTMLInputElement }): HTMLElement {
		const checkboxItem = document.createElement('div');
		checkboxItem.style.display = 'flex';
		checkboxItem.style.alignItems = 'center';
		checkboxItem.style.gap = '8px';

		// Create checkbox
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = `filter-${status.symbol}`;
		checkbox.checked = status.filtered !== false;
		checkboxElements[status.symbol] = checkbox;

		// Create status display
		const statusDisplay = this.createStatusDisplay(status);

		// Create label
		const label = this.createStatusLabel(status, checkbox);

		checkboxItem.appendChild(checkbox);
		checkboxItem.appendChild(statusDisplay);
		checkboxItem.appendChild(label);

		// Add click handler to the entire item
		checkboxItem.addEventListener('click', (e) => {
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
			}
		});

		return checkboxItem;
	}

	private createStatusLabel(status: any, checkbox: HTMLInputElement): HTMLElement {
		const label = document.createElement('label');
		label.htmlFor = `filter-${status.symbol}`;
		label.style.display = 'flex';
		label.style.flexDirection = 'column';
		label.style.gap = '2px';
		label.style.cursor = 'pointer';
		label.style.flex = '1';

		const nameEl = document.createElement('div');
		nameEl.textContent = status.name;
		nameEl.style.fontWeight = '500';

		const descEl = document.createElement('div');
		descEl.textContent = status.description;
		descEl.style.fontSize = '12px';
		descEl.style.color = 'var(--text-muted)';

		label.appendChild(nameEl);
		label.appendChild(descEl);

		return label;
	}

	private createFilterButtons(menu: HTMLElement, checkboxesContainer: HTMLElement): void {
		const buttonsContainer = menu.createDiv();
		buttonsContainer.style.display = 'flex';
		buttonsContainer.style.justifyContent = 'center';
		buttonsContainer.style.gap = '8px';
		buttonsContainer.style.marginTop = '12px';
		buttonsContainer.style.borderTop = '1px solid var(--background-modifier-border)';
		buttonsContainer.style.paddingTop = '8px';

		// Create Save button
		const saveButton = buttonsContainer.createEl('button', { text: 'Save' });
		saveButton.addClass('mod-cta');
		saveButton.addEventListener('click', async () => {
			await this.saveFilterSettings(checkboxesContainer, menu);
		});
	}

	private async saveFilterSettings(checkboxesContainer: HTMLElement, menu: HTMLElement): Promise<void> {
		const checkboxElements = (checkboxesContainer as any).checkboxElements;
		
		// Collect filter states
		const newFilters: Record<string, boolean> = {};
		for (const [symbol, checkbox] of Object.entries(checkboxElements)) {
			newFilters[symbol] = (checkbox as HTMLInputElement).checked;
		}

		// Update status configs - update each status config's filtered property
		for (const [symbol, filtered] of Object.entries(newFilters)) {
			await this.statusConfigService.updateStatusFiltered(symbol, filtered);
		}
		
		// Close menu
		menu.remove();
		
		// Reset tracking when filters change
		this.resetTrackingCallback();
		
		// Refresh the view to apply filters
		await this.refreshCheckboxesCallback();
	}

	private renderQuickFiltersSection(menu: HTMLElement, checkboxesContainer: HTMLElement): void {
		const quickFilters = this.dataService.getQuickFilters().filter((filter: any) => filter.enabled);
		
		if (quickFilters.length === 0) {
			return;
		}

		// Create separator
		const separator = menu.createDiv();
		separator.style.borderTop = '1px solid var(--background-modifier-border)';
		separator.style.margin = '12px 0';

		// Create Quick Filters header
		const quickFiltersHeader = menu.createDiv();
		quickFiltersHeader.createEl('h3', { text: 'Quick Filters' });

		// Create Quick Filters buttons container
		const quickFiltersContainer = menu.createDiv();
		quickFiltersContainer.style.display = 'flex';
		quickFiltersContainer.style.flexWrap = 'wrap';
		quickFiltersContainer.style.gap = '6px';

		quickFilters.forEach((filter: any) => {
			const button = this.createQuickFilterButton(filter, checkboxesContainer);
			quickFiltersContainer.appendChild(button);
		});
	}

	private createQuickFilterButton(filter: any, checkboxesContainer: HTMLElement): HTMLElement {
		const button = document.createElement('button');
		button.textContent = filter.name;
		button.className = 'ontask-quick-filter-button';
		button.style.padding = '4px 8px';
		button.style.fontSize = '12px';
		button.style.border = '1px solid var(--background-modifier-border)';
		button.style.borderRadius = '4px';
		button.style.background = 'var(--background-secondary)';
		button.style.color = 'var(--text-normal)';
		button.style.cursor = 'pointer';
		button.style.transition = 'all 0.2s ease';

		// Hover effects
		button.addEventListener('mouseenter', () => {
			button.style.background = 'var(--interactive-accent)';
			button.style.color = 'var(--text-on-accent)';
		});

		button.addEventListener('mouseleave', () => {
			button.style.background = 'var(--background-secondary)';
			button.style.color = 'var(--text-normal)';
		});

		// Click handler
		button.addEventListener('click', () => {
			this.applyQuickFilter(filter, checkboxesContainer);
		});

		return button;
	}

	private applyQuickFilter(filter: any, checkboxesContainer: HTMLElement): void {
		const checkboxElements = (checkboxesContainer as any).checkboxElements;
		
		// Apply the quick filter by checking/unchecking the appropriate checkboxes
		filter.statusSymbols.forEach((symbol: string) => {
			const checkbox = checkboxElements[symbol];
			if (checkbox) {
				checkbox.checked = true;
			}
		});

		// Uncheck all other checkboxes
		Object.keys(checkboxElements).forEach(symbol => {
			if (!filter.statusSymbols.includes(symbol)) {
				checkboxElements[symbol].checked = false;
			}
		});
	}

	private positionFilterMenu(menu: HTMLElement): void {
		// Find the filters button to position the menu below it
		const filtersButton = this.contentEl.querySelector('.ontask-header-button') as HTMLElement;
		if (!filtersButton) {
			// Fallback to center positioning if button not found
			this.centerPositionMenu(menu);
			return;
		}

		// Get button position and dimensions
		const buttonRect = filtersButton.getBoundingClientRect();
		const menuRect = menu.getBoundingClientRect();
		
		// Calculate position below the button
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuWidth = menuRect.width;
		const menuHeight = menuRect.height;
		
		// Position below the button with some spacing
		let left = buttonRect.left;
		let top = buttonRect.bottom + 8; // 8px spacing below button
		
		// Ensure menu doesn't go off the right edge
		if (left + menuWidth > viewportWidth - 10) {
			left = viewportWidth - menuWidth - 10;
		}
		
		// Ensure menu doesn't go off the left edge
		if (left < 10) {
			left = 10;
		}
		
		// If menu would go off the bottom edge, position it above the button instead
		if (top + menuHeight > viewportHeight - 10) {
			top = buttonRect.top - menuHeight - 8; // 8px spacing above button
		}
		
		// Ensure menu doesn't go off the top edge
		if (top < 10) {
			top = 10;
		}
		
		// Apply the calculated position
		menu.style.left = `${left}px`;
		menu.style.top = `${top}px`;
	}

	private centerPositionMenu(menu: HTMLElement): void {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuRect = menu.getBoundingClientRect();
		const menuWidth = menuRect.width;
		const menuHeight = menuRect.height;

		const left = (viewportWidth - menuWidth) / 2;
		const top = (viewportHeight - menuHeight) / 2;

		menu.style.left = `${Math.max(10, left)}px`;
		menu.style.top = `${Math.max(10, top)}px`;
	}

	private getStatusDisplayText(statusSymbol: string): string {
		return statusSymbol;
	}
}
