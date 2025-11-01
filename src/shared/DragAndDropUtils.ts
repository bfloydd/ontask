// Shared drag-and-drop utility for reorderable lists

/**
 * Obsidian extends HTMLElement with addClass and removeClass methods.
 * This type represents elements that may have these Obsidian-specific methods.
 */
type ObsidianHTMLElement = HTMLElement & {
	addClass?(className: string): void;
	removeClass?(className: string): void;
};

/**
 * Container element that can store drag-and-drop state as dynamic properties.
 * Uses index signature to allow storing arbitrary keys for drag state.
 * The index signature uses 'unknown' to allow any value type while preserving
 * HTMLElement's existing properties.
 */
interface DragDropContainer extends HTMLElement {
	[key: string]: unknown;
}

export interface DragAndDropConfig<T> {
	// The item element that will be draggable
	itemElement: HTMLElement;
	
	// The index of this item in the array
	itemIndex: number;
	
	// CSS class for dragging state
	draggingClass?: string;
	
	// CSS class for drag-over state
	dragOverClass?: string;
	
	// CSS class for drop indicator line/element
	dropIndicatorClass?: string;
	
	// Container selector to find all items
	containerSelector?: string;
	
	// Item selector within container
	itemSelector?: string;
	
	// Callback to get current array
	getItems: () => T[];
	
	// Callback to save reordered array
	saveItems: (items: T[]) => Promise<void>;
	
	// Callback to re-render after reorder
	onReorder?: () => void;
}

/**
 * Sets up drag-and-drop functionality for a reorderable list item.
 * This utility handles the visual feedback and reordering logic,
 * delegating persistence and rendering to the caller.
 */
export function setupDragAndDrop<T>(config: DragAndDropConfig<T>): void {
	const {
		itemElement,
		itemIndex,
		draggingClass = 'dragging',
		dragOverClass,
		dropIndicatorClass,
		containerSelector,
		itemSelector,
		getItems,
		saveItems,
		onReorder
	} = config;

	let dragOverElement: HTMLElement | null = null;

	// Get shared dragged element from container
	const getSharedDraggedElement = (): HTMLElement | null => {
		const container = containerSelector 
			? itemElement.closest(containerSelector) as DragDropContainer | null
			: itemElement.parentElement as DragDropContainer | null;
		
		if (!container) return null;
		
		const draggedKey = '__draggedElement';
		return container[draggedKey] as HTMLElement | null;
	};

	const setSharedDraggedElement = (element: HTMLElement | null): void => {
		const container = containerSelector 
			? itemElement.closest(containerSelector) as DragDropContainer | null
			: itemElement.parentElement as DragDropContainer | null;
		
		if (!container) return;
		
		const draggedKey = '__draggedElement';
		container[draggedKey] = element;
	};

	// Get or create shared drop indicator storage
	const getSharedDropIndicator = (): HTMLElement | null => {
		if (!dropIndicatorClass) return null;
		
		// Find the container (use containerSelector if provided, otherwise parent)
		const container = containerSelector 
			? itemElement.closest(containerSelector) as DragDropContainer | null
			: itemElement.parentElement as DragDropContainer | null;
		
		if (!container) return null;
		
		// Use a data attribute to store reference to shared drop indicator
		const indicatorKey = `__dropIndicator_${dropIndicatorClass}`;
		let dropIndicator = container[indicatorKey] as HTMLElement | null;
		
		if (!dropIndicator) {
			dropIndicator = document.createElement('div');
			const obsidianElement = dropIndicator as ObsidianHTMLElement;
			if (typeof obsidianElement.addClass === 'function') {
				obsidianElement.addClass(dropIndicatorClass);
			} else {
				dropIndicator.classList.add(dropIndicatorClass);
			}
			container[indicatorKey] = dropIndicator;
		}
		
		return dropIndicator;
	};

	const removeSharedDropIndicator = (): void => {
		if (!dropIndicatorClass) return;
		
		const container = containerSelector 
			? itemElement.closest(containerSelector) as DragDropContainer | null
			: itemElement.parentElement as DragDropContainer | null;
		
		if (!container) return;
		
		const indicatorKey = `__dropIndicator_${dropIndicatorClass}`;
		const dropIndicator = container[indicatorKey] as HTMLElement | null;
		
		if (dropIndicator && dropIndicator.parentNode) {
			dropIndicator.remove();
			container[indicatorKey] = null;
		}
	};

	// Make element draggable
	itemElement.setAttribute('draggable', 'true');

	itemElement.addEventListener('dragstart', (e: DragEvent) => {
		setSharedDraggedElement(itemElement);
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', itemIndex.toString());
		}
		
		// Add dragging class - use addClass if available (Obsidian), otherwise classList
		const obsidianItem = itemElement as ObsidianHTMLElement;
		if (typeof obsidianItem.addClass === 'function') {
			obsidianItem.addClass(draggingClass);
		} else {
			itemElement.classList.add(draggingClass);
		}
	}, { passive: true });

	itemElement.addEventListener('dragend', () => {
		// Remove dragging class
		const obsidianItem = itemElement as ObsidianHTMLElement;
		if (typeof obsidianItem.removeClass === 'function') {
			obsidianItem.removeClass(draggingClass);
		} else {
			itemElement.classList.remove(draggingClass);
		}
		
		// Clean up drag-over state
		if (dragOverElement && dragOverClass) {
			const obsidianDragOver = dragOverElement as ObsidianHTMLElement;
			if (typeof obsidianDragOver.removeClass === 'function') {
				obsidianDragOver.removeClass(dragOverClass);
			} else {
				dragOverElement.classList.remove(dragOverClass);
			}
			dragOverElement = null;
		}
		
		// Remove drop indicator (shared cleanup)
		removeSharedDropIndicator();
		
		setSharedDraggedElement(null);
	}, { passive: true });

	itemElement.addEventListener('dragover', (e: DragEvent) => {
		if (e.preventDefault) {
			e.preventDefault();
		}
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		
		// Only process if we're dragging a different element
		const draggedElement = getSharedDraggedElement();
		if (!draggedElement || itemElement === draggedElement) return;
		
		// Handle drag-over visual feedback
		if (dragOverClass) {
			if (dragOverElement && dragOverElement !== itemElement) {
				const obsidianDragOver = dragOverElement as ObsidianHTMLElement;
				if (typeof obsidianDragOver.removeClass === 'function') {
					obsidianDragOver.removeClass(dragOverClass);
				} else {
					dragOverElement.classList.remove(dragOverClass);
				}
			}
			
			const obsidianItem = itemElement as ObsidianHTMLElement;
			if (typeof obsidianItem.addClass === 'function') {
				obsidianItem.addClass(dragOverClass);
			} else {
				itemElement.classList.add(dragOverClass);
			}
			dragOverElement = itemElement;
		}
		
		// Handle drop indicator
		if (dropIndicatorClass && itemElement.parentNode) {
			const dropIndicator = getSharedDropIndicator();
			if (dropIndicator) {
				// Insert indicator before the item element
				// Make sure it's not already in the right position
				if (dropIndicator.parentNode !== itemElement.parentNode || dropIndicator.nextSibling !== itemElement) {
					if (itemElement.parentNode) {
						itemElement.parentNode.insertBefore(dropIndicator, itemElement);
					}
				}
			}
		}
	}, { passive: false });

	itemElement.addEventListener('dragleave', (e: DragEvent) => {
		// Only process if we're actually leaving the element (not just moving to a child)
		const relatedTarget = e.relatedTarget as Node;
		if (relatedTarget && itemElement.contains(relatedTarget)) {
			return;
		}
		
		const draggedElement = getSharedDraggedElement();
		if (dragOverClass && itemElement !== draggedElement) {
			const obsidianItem = itemElement as ObsidianHTMLElement;
			if (typeof obsidianItem.removeClass === 'function') {
				obsidianItem.removeClass(dragOverClass);
			} else {
				itemElement.classList.remove(dragOverClass);
			}
			if (dragOverElement === itemElement) {
				dragOverElement = null;
			}
		}
		
		// Remove drop indicator when leaving the element
		// Only remove if we're actually leaving the container area
		if (dropIndicatorClass) {
			const container = containerSelector 
				? itemElement.closest(containerSelector) 
				: itemElement.parentNode;
			
			if (!relatedTarget || (container && !container.contains(relatedTarget))) {
				removeSharedDropIndicator();
			}
		}
	}, { passive: true });

	itemElement.addEventListener('drop', async (e: DragEvent) => {
		if (e.preventDefault) {
			e.preventDefault();
		}
		if (e.stopPropagation) {
			e.stopPropagation();
		}

		// Remove drop indicator (shared cleanup)
		removeSharedDropIndicator();

		const draggedIndexStr = e.dataTransfer?.getData('text/plain');
		if (!draggedIndexStr) return;

		const draggedIndex = parseInt(draggedIndexStr, 10);
		
		if (draggedIndex !== itemIndex) {
			// Determine the target index
			let targetIndex = itemIndex;
			
			// If we have container/item selectors, use DOM-based index calculation for more accuracy
			// This ensures we get the correct target position even if DOM order differs slightly
			if (containerSelector && itemSelector) {
				const container = itemElement.closest(containerSelector);
				if (container) {
					const allItems = Array.from(container.querySelectorAll(itemSelector));
					targetIndex = allItems.indexOf(itemElement);
				}
			}

			// Get current items and reorder
			const items = getItems();
			// Make a copy to avoid mutating the original if getItems returns a reference
			const itemsCopy = [...items];
			const [movedItem] = itemsCopy.splice(draggedIndex, 1);
			itemsCopy.splice(targetIndex, 0, movedItem);

			// Save the new order
			await saveItems(itemsCopy);
			
			// Trigger re-render if callback provided
			if (onReorder) {
				onReorder();
			}
		}

		return false;
	}, { passive: false });
}



