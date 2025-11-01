/**
 * Renders the filter section UI for searching/filtering tasks.
 */
export class FilterSectionRenderer {
	/**
	 * Creates the filter section element with input field and clear button.
	 */
	createFilterSectionElement(currentFilter: string, onFilterChange: (filter: string) => void, onClearFilter: () => void): HTMLElement {
		const filterSection = document.createElement('div');
		filterSection.className = 'ontask-filter-section ontask-file-section ontask-filter-collapsed';
		
		const filterContainer = filterSection.createDiv('ontask-filter-container');
		
		const filterInput = filterContainer.createEl('input', {
			type: 'text',
			placeholder: 'Filter tasks...',
			value: currentFilter
		});
		filterInput.addClass('ontask-filter-input');
		
		// Add clear button
		const clearButton = filterContainer.createEl('button', { text: 'Clear' });
		clearButton.addClass('ontask-filter-clear-button');
		clearButton.addEventListener('click', onClearFilter, { passive: true });
		
		// Add filter event listener
		filterInput.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			onFilterChange(target.value);
		}, { passive: true });
		
		return filterSection;
	}
}

