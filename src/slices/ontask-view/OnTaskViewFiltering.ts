/**
 * Filtering utility class for OnTaskView that handles search filtering
 * and status filtering of checkboxes.
 */
export class OnTaskViewFiltering {
	constructor(
		private contentEl: HTMLElement,
		private parseCheckboxLine: (line: string) => { statusSymbol: string; remainingText: string }
	) {}

	/**
	 * Handles filter change event
	 */
	onFilterChange(filter: string, onFilterApplied: (filter: string) => void): void {
		onFilterApplied(filter);
		this.applyFilter(filter);
	}

	/**
	 * Clears the current filter and resets the UI
	 */
	clearFilter(onFilterCleared: (filter: string) => void): void {
		onFilterCleared('');
		
		// Clear the input field
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (contentArea) {
			const filterInput = contentArea.querySelector('.ontask-filter-input') as HTMLInputElement;
			if (filterInput) {
				filterInput.value = '';
			}
		}
		
		this.applyFilter('');
	}

	/**
	 * Toggles the visibility of the search filter input
	 */
	toggleSearchFilter(isSearchFilterVisible: boolean, onFilterCleared: () => void): boolean {
		const newVisibility = !isSearchFilterVisible;
		
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (contentArea) {
			const filterSection = contentArea.querySelector('.ontask-filter-section') as HTMLElement;
			if (filterSection) {
				if (newVisibility) {
					filterSection.classList.add('ontask-filter-expanded');
					filterSection.classList.remove('ontask-filter-collapsed');
					// Focus the input field
					const filterInput = filterSection.querySelector('.ontask-filter-input') as HTMLInputElement;
					if (filterInput) {
						setTimeout(() => filterInput.focus(), 100);
					}
				} else {
					filterSection.classList.add('ontask-filter-collapsed');
					filterSection.classList.remove('ontask-filter-expanded');
					// Clear filter when hiding
					onFilterCleared();
				}
			}
		}
		
		return newVisibility;
	}

	/**
	 * Applies the current filter to all tasks, hiding/showing them based on the filter text
	 */
	applyFilter(currentFilter: string): void {
		const contentArea = this.contentEl.querySelector('.ontask-content') as HTMLElement;
		if (!contentArea) return;

		// Get all file sections (excluding top task and filter sections)
		const fileSections = contentArea.querySelectorAll('.ontask-file-section:not(.ontask-toptask-hero-section):not(.ontask-filter-section)');
		
		if (currentFilter.trim() === '') {
			// Show all tasks and file sections
			fileSections.forEach(section => {
				(section as HTMLElement).style.display = '';
				const taskElements = section.querySelectorAll('.ontask-checkbox-item');
				taskElements.forEach(task => {
					(task as HTMLElement).style.display = '';
				});
			});
		} else {
			// Filter tasks and hide empty file sections
			const filterText = currentFilter.toLowerCase();
			
			fileSections.forEach(section => {
				const sectionElement = section as HTMLElement;
				const taskElements = sectionElement.querySelectorAll('.ontask-checkbox-item');
				let hasVisibleTasks = false;
				
				// Check each task in this section
				taskElements.forEach(task => {
					const taskElement = task as HTMLElement;
					const taskText = taskElement.textContent?.toLowerCase() || '';
					const shouldShow = taskText.includes(filterText);
					
					if (shouldShow) {
						hasVisibleTasks = true;
					}
					
					taskElement.style.display = shouldShow ? '' : 'none';
				});
				
				// Hide the entire file section if it has no visible tasks
				sectionElement.style.display = hasVisibleTasks ? '' : 'none';
			});
		}
	}

	/**
	 * Filters checkboxes based on status filters
	 */
	applyStatusFilters(checkboxes: any[], statusFilters: Record<string, boolean>): any[] {
		// Note: Keeping any[] here as this is used with TaskLoadingResult which may have different structure
		if (!statusFilters) {
			return checkboxes;
		}

		return checkboxes.filter(checkbox => {
			const { statusSymbol } = this.parseCheckboxLine(checkbox.lineContent);
			return statusFilters[statusSymbol] !== false;
		});
	}
}

