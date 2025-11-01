import { App, TFile } from 'obsidian';
import { Logger } from '../../logging/Logger';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';

export interface CheckboxContentTrackingServiceInterface {
	initializeTracking(checkboxes: CheckboxItem[]): void;
	checkForChanges(file: TFile, checkboxes: CheckboxItem[]): Promise<boolean>;
	updateContent(checkbox: CheckboxItem, content: string): void;
}

/**
 * Service responsible for tracking checkbox content changes to detect file modifications
 * without requiring full view refreshes.
 */
export class CheckboxContentTrackingService implements CheckboxContentTrackingServiceInterface {
	private lastCheckboxContent: Map<string, string> = new Map();

	constructor(
		private app: App,
		private logger: Logger
	) {}

	/**
	 * Initializes content tracking for all checkboxes
	 */
	initializeTracking(checkboxes: CheckboxItem[]): void {
		this.lastCheckboxContent.clear();
		
		for (const checkbox of checkboxes) {
			const checkboxKey = `${checkbox.file.path}:${checkbox.lineNumber}`;
			this.lastCheckboxContent.set(checkboxKey, checkbox.lineContent?.trim() || '');
		}
	}

	/**
	 * Checks if any checkboxes in a file have changed by comparing current content with tracked content
	 * @returns true if changes were detected, false otherwise
	 */
	async checkForChanges(file: TFile, checkboxes: CheckboxItem[]): Promise<boolean> {
		try {
			const fileCheckboxes = checkboxes.filter(checkbox => checkbox.file?.path === file.path);
			if (fileCheckboxes.length === 0) {
				return false;
			}
			
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			let hasCheckboxChanges = false;
			
			for (const checkbox of fileCheckboxes) {
				const lineIndex = checkbox.lineNumber - 1;
				if (lineIndex >= 0 && lineIndex < lines.length) {
					const currentLine = lines[lineIndex].trim();
					const checkboxKey = `${file.path}:${checkbox.lineNumber}`;
					const lastContent = this.lastCheckboxContent.get(checkboxKey);
					
					if (currentLine.match(/^\s*-\s*\[[^\]]*\]/)) {
						if (lastContent !== currentLine) {
							hasCheckboxChanges = true;
						}
						this.lastCheckboxContent.set(checkboxKey, currentLine);
					}
				}
			}
			
			return hasCheckboxChanges;
		} catch (error) {
			this.logger.error('[OnTask ContentTracking] Error checking for checkbox changes:', error);
			return false;
		}
	}

	/**
	 * Updates the tracked content for a specific checkbox
	 */
	updateContent(checkbox: CheckboxItem, content: string): void {
		const filePath = checkbox.file?.path || '';
		const lineNumber = checkbox.lineNumber?.toString() || '';
		const checkboxKey = `${filePath}:${lineNumber}`;
		this.lastCheckboxContent.set(checkboxKey, content.trim());
	}
}

