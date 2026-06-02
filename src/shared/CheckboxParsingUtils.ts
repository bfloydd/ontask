import { ListItemCache } from 'obsidian';

/**
 * Utility functions for parsing checkbox syntax from markdown lines
 */
export class CheckboxParsingUtils {
	/**
	 * Finds a checkbox pattern in a line and returns the checkbox syntax
	 * @param line - The line to check
	 * @returns The checkbox syntax (e.g., "- [x]") or null if no checkbox found
	 */
	static findCheckboxInLine(line: string): string | null {
		const trimmedLine = line.trim();
		
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]])\]\s*(.*)$/);
		if (!checkboxMatch) return null;
		
		const checkboxContent = checkboxMatch[1];
		
		return `- [${checkboxContent}]`;
	}

	/**
	 * Checks if a checkbox line represents a completed task
	 * @param line - The line to check
	 * @returns true if the checkbox is marked as completed
	 */
	static isCheckboxCompleted(line: string): boolean {
		const trimmedLine = line.trim();
		
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]])\]\s*(.*)$/);
		if (!checkboxMatch) return false;
		
		const checkboxContent = checkboxMatch[1].trim().toLowerCase();
		
		return checkboxContent === 'x' || checkboxContent === 'checked';
	}

	/**
	 * Calculates the semantic indentation level of a task.
	 * Indentation only increases if an ancestor list item is also a task.
	 * @param lineIndex - The 0-indexed line number of the task
	 * @param listItems - The listItems cache from Obsidian
	 * @returns The semantic indentation level (0 for root tasks or tasks under non-tasks)
	 */
	static calculateTaskIndentation(lineIndex: number, listItems: ListItemCache[] | undefined): number {
		if (!listItems || listItems.length === 0) return 0;
		
		const listItemsByLine = new Map<number, ListItemCache>();
		for (const item of listItems) {
			listItemsByLine.set(item.position.start.line, item);
		}
		
		let indentationLevel = 0;
		let currentItem = listItemsByLine.get(lineIndex);
		const visitedLines = new Set<number>();

		while (currentItem && currentItem.parent >= 0) {
			const currentLine = currentItem.position.start.line;
			if (visitedLines.has(currentLine)) {
				break; // Prevent infinite loops from circular references
			}
			visitedLines.add(currentLine);

			if (currentItem.parent === currentLine) {
				break; // Prevent infinite loops if parent points to self
			}

			currentItem = listItemsByLine.get(currentItem.parent);
			if (currentItem && currentItem.task !== undefined) {
				indentationLevel++;
			}
		}
		
		return indentationLevel;
	}
}





