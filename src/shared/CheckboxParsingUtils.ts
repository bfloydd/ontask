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
}


