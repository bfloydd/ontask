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
			const file = checkbox.file;
			if (!file) {
				console.error('File not found in checkbox:', checkbox);
				return;
			}
			
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			const lineIndex = checkbox.lineNumber - 1;
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const line = lines[lineIndex];
				const updatedLine = line.replace(
					/^(-\s*\[)([^\]]*)(\])/,
					`$1${isCompleted ? 'x' : ' '}$3`
				);
				lines[lineIndex] = updatedLine;
				
				await this.app.vault.modify(file, lines.join('\n'));
				checkbox.isCompleted = isCompleted;
				
				this.logger.debug('[OnTask FileOps] Emitting checkbox:toggled event for', file.path, 'line', checkbox.lineNumber, 'completed:', isCompleted);
				this.eventSystem.emit('checkbox:toggled', {
					filePath: file.path,
					lineNumber: checkbox.lineNumber,
					isCompleted
				});
				
				this.logger.debug('[OnTask FileOps] Emitting checkboxes:updated event with', this.checkboxes.length, 'checkboxes');
				this.eventSystem.emit('checkboxes:updated', { 
					count: this.checkboxes.length,
					topTask: this.checkboxes.find(cb => cb.isTopTask)
				});
				
				this.scheduleRefreshCallback();
			}
		} catch (error) {
			console.error('Error toggling checkbox:', error);
		}
	}

	async updateCheckboxStatus(checkbox: any, newStatus: string): Promise<void> {
		this.isUpdatingStatus = true;
		
		try {
			const file = checkbox.file;
			if (!file) {
				console.error('File Operations Service: No file found for checkbox');
				return;
			}

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');

			const lineIndex = checkbox.lineNumber - 1;
			if (lineIndex >= 0 && lineIndex < lines.length) {
				const line = lines[lineIndex];
				const updatedLine = line.replace(/^(\s*)- \[[^\]]*\]/, `$1- [${newStatus}]`);
				
				lines[lineIndex] = updatedLine;
				await this.app.vault.modify(file, lines.join('\n'));
				this.scheduleRefreshCallback();
			}
		} catch (error) {
			console.error('File Operations Service: Error updating checkbox status:', error);
		} finally {
			this.isUpdatingStatus = false;
		}
	}
}
