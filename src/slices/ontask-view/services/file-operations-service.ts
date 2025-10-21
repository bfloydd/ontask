import { EventSystem } from '../../events';
import { App } from 'obsidian';
import { Logger } from '../../logging/Logger';

export interface FileOperationsServiceInterface {
	toggleCheckbox(checkbox: any, isCompleted: boolean): Promise<void>;
	updateCheckboxStatus(checkbox: any, newStatus: string): Promise<void>;
}

export class FileOperationsService implements FileOperationsServiceInterface {
	private app: App;
	private eventSystem: EventSystem;
	private checkboxes: any[];
	private isUpdatingStatus: boolean;
	private scheduleRefreshCallback: () => void;
	private logger: Logger;

	constructor(
		app: App,
		eventSystem: EventSystem,
		checkboxes: any[],
		isUpdatingStatus: boolean,
		scheduleRefreshCallback: () => void,
		logger: Logger
	) {
		this.app = app;
		this.eventSystem = eventSystem;
		this.checkboxes = checkboxes;
		this.isUpdatingStatus = isUpdatingStatus;
		this.scheduleRefreshCallback = scheduleRefreshCallback;
		this.logger = logger;
	}

	async toggleCheckbox(checkbox: any, isCompleted: boolean): Promise<void> {
		try {
			// Get the file
			const file = checkbox.file;
			if (!file) {
				console.error('File not found in checkbox:', checkbox);
				return;
			}
			
			// Read file content
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			// Update the specific line
			const lineIndex = checkbox.lineNumber - 1;
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const line = lines[lineIndex];
				const updatedLine = line.replace(
					/^(-\s*\[)([^\]]*)(\])/,
					`$1${isCompleted ? 'x' : ' '}$3`
				);
				lines[lineIndex] = updatedLine;
				
				// Write back to file
				await this.app.vault.modify(file, lines.join('\n'));
				
				// Update local state
				checkbox.isCompleted = isCompleted;
				
				// Emit checkbox toggled event
				this.logger.debug('[OnTask FileOps] Emitting checkbox:toggled event for', file.path, 'line', checkbox.lineNumber, 'completed:', isCompleted);
				this.eventSystem.emit('checkbox:toggled', {
					filePath: file.path,
					lineNumber: checkbox.lineNumber,
					isCompleted
				});
				
				// Trigger immediate checkbox update
				this.logger.debug('[OnTask FileOps] Emitting checkboxes:updated event with', this.checkboxes.length, 'checkboxes');
				this.eventSystem.emit('checkboxes:updated', { 
					count: this.checkboxes.length,
					topTask: this.checkboxes.find(cb => cb.isTopTask)
				});
				
				// Refresh the view after a short delay
				this.scheduleRefreshCallback();
			}
		} catch (error) {
			console.error('Error toggling checkbox:', error);
		}
	}

	async updateCheckboxStatus(checkbox: any, newStatus: string): Promise<void> {
		
		// Set flag to prevent file modification listener from triggering refresh
		this.isUpdatingStatus = true;
		
		try {
			// Get the file
			const file = checkbox.file;
			if (!file) {
				console.error('File Operations Service: No file found for checkbox');
				return;
			}

			// Read the file content
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');

			// Update the specific line (lineNumber is 1-based, so subtract 1 for array index)
			const lineIndex = checkbox.lineNumber - 1;
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const line = lines[lineIndex];
				// Update the checkbox status using a flexible regex pattern
				const updatedLine = line.replace(/^(\s*)- \[[^\]]*\]/, `$1- [${newStatus}]`);
				
				// Log for debugging if the line wasn't updated
				if (updatedLine === line) {
				}
				
				lines[lineIndex] = updatedLine;

				// Write back to file
				await this.app.vault.modify(file, lines.join('\n'));
				
				// Refresh the entire view to ensure UI consistency
				// This is simpler and more reliable than trying to update individual elements
				this.scheduleRefreshCallback();
			}
		} catch (error) {
			console.error('File Operations Service: Error updating checkbox status:', error);
		} finally {
			// Clear the flag to allow future file modification listeners
			this.isUpdatingStatus = false;
		}
	}
}
