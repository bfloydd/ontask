import { EventSystem } from '../../events';
import { StatusConfigService } from '../../settings/status-config';
import { Logger } from '../../logging/Logger';

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
		const existingMenu = document.querySelector('.ontask-context-menu');
		if (existingMenu) {
			existingMenu.remove();
		}

		const menu = this.createContextMenu(checkbox);
		document.body.appendChild(menu);
		this.positionContextMenu(menu, event);
		this.setupMenuCloseHandlers(menu);
	}

	private createContextMenu(checkbox: any): HTMLElement {
		const menu = document.createElement('div');
		menu.className = 'ontask-context-menu';

		const statuses = this.statusConfigService.getStatusConfigs();

		for (const status of statuses) {
			const menuItem = this.createMenuItem(status, checkbox);
			menu.appendChild(menuItem);
		}

		return menu;
	}

	private createMenuItem(status: any, checkbox: any): HTMLElement {
		const menuItem = document.createElement('div');
		menuItem.className = 'ontask-context-menu-item';

		const statusDisplay = this.createStatusDisplay(status);
		const textContent = this.createTextContent(status);

		menuItem.appendChild(statusDisplay);
		menuItem.appendChild(textContent);

		this.addHoverEffects(menuItem);

		menuItem.addEventListener('click', () => {
			this.updateCheckboxStatusCallback(checkbox, status.symbol);
			menuItem.closest('.ontask-context-menu')?.remove();
		}, { passive: true });

		return menuItem;
	}

	private createStatusDisplay(status: any): HTMLElement {
		const statusDisplay = document.createElement('div');
		statusDisplay.className = 'ontask-checkbox-display';
		statusDisplay.setAttribute('data-status', status.symbol);
		statusDisplay.textContent = this.getStatusDisplayText(status.symbol);
		statusDisplay.style.color = status.color;
		statusDisplay.style.backgroundColor = status.backgroundColor || 'transparent';
		statusDisplay.style.border = `1px solid ${status.color}`;

		return statusDisplay;
	}

	private createTextContent(status: any): HTMLElement {
		const textContent = document.createElement('div');
		textContent.className = 'ontask-status-display-text-content';
		
		const nameEl = document.createElement('div');
		nameEl.textContent = status.name;
		nameEl.className = 'ontask-status-display-name';
		
		const descEl = document.createElement('div');
		descEl.textContent = status.description;
		descEl.className = 'ontask-status-display-description';
		
		textContent.appendChild(nameEl);
		textContent.appendChild(descEl);

		return textContent;
	}

	private addHoverEffects(menuItem: HTMLElement): void {
	}

	private setupMenuCloseHandlers(menu: HTMLElement): void {
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu, true);
				document.removeEventListener('scroll', closeMenu, true);
				document.removeEventListener('contextmenu', closeMenu, true);
			}
		};

		requestAnimationFrame(() => {
		document.addEventListener('click', closeMenu, { passive: true });
		document.addEventListener('scroll', closeMenu, { passive: true, capture: true });
		document.addEventListener('contextmenu', closeMenu, { passive: true });
		});
	}

	private positionContextMenu(menu: HTMLElement, event: MouseEvent): void {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuRect = menu.getBoundingClientRect();
		const menuWidth = menuRect.width;
		const menuHeight = menuRect.height;
		
		let left = event.clientX;
		let top = event.clientY;
		
		const isMobile = window.innerWidth <= 768;
		const margin = isMobile ? 5 : 10;
		
		if (left + menuWidth > viewportWidth - margin) {
			left = viewportWidth - menuWidth - margin;
		}
		
		if (left < margin) {
			left = margin;
		}
		
		if (top + menuHeight > viewportHeight - margin) {
			top = viewportHeight - menuHeight - margin;
		}
		
		if (top < margin) {
			top = margin;
		}
		menu.style.left = `${left}px`;
		menu.style.top = `${top}px`;
		
		if (isMobile) {
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
		const existingMenu = document.querySelector('.ontask-filters-menu');
		if (existingMenu) {
			existingMenu.remove();
			return;
		}

		const menu = this.createFiltersMenu();
		document.body.appendChild(menu);
		this.positionFilterMenu(menu);
		this.setupMenuCloseHandlers(menu);
	}

	private createFiltersMenu(): HTMLElement {
		const menu = document.createElement('div');
		menu.className = 'ontask-filters-menu';
		const settings = this.settingsService.getSettings();
		const statusConfigs = this.statusConfigService.getStatusConfigs();

		const header = menu.createDiv();
		header.createEl('h3', { text: 'Status Filters' });

		const checkboxesContainer = this.createStatusCheckboxes(menu, statusConfigs);
		menu.appendChild(checkboxesContainer);

		this.renderQuickFiltersSection(menu, checkboxesContainer);
		this.createFilterButtons(menu, checkboxesContainer);

		return menu;
	}

	private createStatusCheckboxes(menu: HTMLElement, statusConfigs: any[]): HTMLElement {
		const checkboxesContainer = menu.createDiv();
		checkboxesContainer.className = 'ontask-filters-checkboxes-container';

		const checkboxElements: { [key: string]: HTMLInputElement } = {};

		for (const status of statusConfigs) {
			const checkboxItem = this.createStatusCheckboxItem(status, checkboxElements);
			checkboxesContainer.appendChild(checkboxItem);
		}

		(checkboxesContainer as any).checkboxElements = checkboxElements;

		return checkboxesContainer;
	}

	private createStatusCheckboxItem(status: any, checkboxElements: { [key: string]: HTMLInputElement }): HTMLElement {
		const checkboxItem = document.createElement('div');
		checkboxItem.className = 'ontask-filters-checkbox-item';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = `filter-${status.symbol}`;
		checkbox.checked = status.filtered !== false;
		checkboxElements[status.symbol] = checkbox;

		const statusDisplay = this.createStatusDisplay(status);
		const label = this.createStatusLabel(status, checkbox);

		checkboxItem.appendChild(checkbox);
		checkboxItem.appendChild(statusDisplay);
		checkboxItem.appendChild(label);

		checkboxItem.addEventListener('click', (e) => {
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
			}
		}, { passive: true });

		return checkboxItem;
	}

	private createStatusLabel(status: any, checkbox: HTMLInputElement): HTMLElement {
		const label = document.createElement('label');
		label.htmlFor = `filter-${status.symbol}`;
		label.className = 'ontask-filters-checkbox-label';

		const nameEl = document.createElement('div');
		nameEl.textContent = status.name;
		nameEl.className = 'ontask-filters-checkbox-name';

		const descEl = document.createElement('div');
		descEl.textContent = status.description;
		descEl.className = 'ontask-filters-checkbox-description';

		label.appendChild(nameEl);
		label.appendChild(descEl);

		return label;
	}

	private createFilterButtons(menu: HTMLElement, checkboxesContainer: HTMLElement): void {
		const buttonsContainer = menu.createDiv();
		buttonsContainer.className = 'ontask-filters-buttons-container';

		const saveButton = buttonsContainer.createEl('button', { text: 'Save' });
		saveButton.addClass('mod-cta');
		saveButton.addEventListener('click', async () => {
			await this.saveFilterSettings(checkboxesContainer, menu);
		}, { passive: true });
	}

	private async saveFilterSettings(checkboxesContainer: HTMLElement, menu: HTMLElement): Promise<void> {
		const checkboxElements = (checkboxesContainer as any).checkboxElements;
		
		const newFilters: Record<string, boolean> = {};
		for (const [symbol, checkbox] of Object.entries(checkboxElements)) {
			newFilters[symbol] = (checkbox as HTMLInputElement).checked;
		}

		for (const [symbol, filtered] of Object.entries(newFilters)) {
			await this.statusConfigService.updateStatusFiltered(symbol, filtered);
		}
		
		menu.remove();
		this.resetTrackingCallback();
		await this.refreshCheckboxesCallback();
	}

	private renderQuickFiltersSection(menu: HTMLElement, checkboxesContainer: HTMLElement): void {
		const quickFilters = this.dataService.getQuickFilters().filter((filter: any) => filter.enabled);
		
		if (quickFilters.length === 0) {
			return;
		}

		const separator = menu.createDiv();
		separator.className = 'ontask-filters-separator';

		const quickFiltersHeader = menu.createDiv();
		quickFiltersHeader.createEl('h3', { text: 'Quick Filters' });

		const quickFiltersContainer = menu.createDiv();
		quickFiltersContainer.className = 'ontask-filters-quick-filters-container';

		quickFilters.forEach((filter: any) => {
			const button = this.createQuickFilterButton(filter, checkboxesContainer);
			quickFiltersContainer.appendChild(button);
		});
	}

	private createQuickFilterButton(filter: any, checkboxesContainer: HTMLElement): HTMLElement {
		const button = document.createElement('button');
		button.textContent = filter.name;
		button.className = 'ontask-quick-filter-button';

		button.addEventListener('click', () => {
			this.applyQuickFilter(filter, checkboxesContainer);
		}, { passive: true });

		return button;
	}

	private applyQuickFilter(filter: any, checkboxesContainer: HTMLElement): void {
		const checkboxElements = (checkboxesContainer as any).checkboxElements;
		
		filter.statusSymbols.forEach((symbol: string) => {
			const checkbox = checkboxElements[symbol];
			if (checkbox) {
				checkbox.checked = true;
			}
		});

		Object.keys(checkboxElements).forEach(symbol => {
			if (!filter.statusSymbols.includes(symbol)) {
				checkboxElements[symbol].checked = false;
			}
		});
	}

	private positionFilterMenu(menu: HTMLElement): void {
		const filtersButton = this.contentEl.querySelector('.ontask-header-button') as HTMLElement;
		if (!filtersButton) {
			this.centerPositionMenu(menu);
			return;
		}

		const buttonRect = filtersButton.getBoundingClientRect();
		const menuRect = menu.getBoundingClientRect();
		
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuWidth = menuRect.width;
		const menuHeight = menuRect.height;
		let left = buttonRect.left;
		let top = buttonRect.bottom + 8;
		
		if (left + menuWidth > viewportWidth - 10) {
			left = viewportWidth - menuWidth - 10;
		}
		
		if (left < 10) {
			left = 10;
		}
		
		if (top + menuHeight > viewportHeight - 10) {
			top = buttonRect.top - menuHeight - 8;
		}
		
		if (top < 10) {
			top = 10;
		}
		
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
