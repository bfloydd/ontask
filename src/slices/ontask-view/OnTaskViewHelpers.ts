import { App, TFile, MarkdownView } from 'obsidian';
import { StatusConfigService } from '../settings/status-config';
import { SettingsService } from '../settings';
import { TaskLoadingService } from './services/task-loading-service';
import { Logger } from '../logging/Logger';

/**
 * Helper utility class for OnTaskView that provides common utility methods
 * for parsing checkboxes, handling file operations, and status display.
 */
export class OnTaskViewHelpers {
	constructor(
		private app: App,
		private statusConfigService: StatusConfigService,
		private settingsService: SettingsService,
		private taskLoadingService: TaskLoadingService,
		private logger: Logger
	) {}

	/**
	 * Centralized method for displaying status symbols consistently across the plugin
	 * @param statusSymbol The raw status symbol from the checkbox
	 * @returns The display text for the status symbol
	 */
	getStatusDisplayText(statusSymbol: string): string {
		return statusSymbol;
	}

	/**
	 * Opens a file in Obsidian and scrolls to the specified line number
	 */
	async openFile(filePath: string, lineNumber: number): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
		if (file) {
			await this.handleStreamUpdate(filePath);
			
			this.app.workspace.openLinkText(filePath, '');
			
			setTimeout(() => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && markdownView.editor) {
					try {
						const line = lineNumber - 1;
						markdownView.editor.setCursor({ line, ch: 0 });
						markdownView.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } });
					} catch (error) {
						this.logger.error('OnTask: Error scrolling to line:', error);
					}
				}
			}, 100);
		}
	}

	/**
	 * Extracts the file name from a file path, removing the .md extension
	 */
	getFileName(filePath: string): string {
		const parts = filePath.split('/');
		const fileName = parts[parts.length - 1] || filePath;
		return fileName.replace(/\.md$/i, '');
	}

	/**
	 * Handles stream update when opening a file that's part of a stream
	 */
	private async handleStreamUpdate(filePath: string): Promise<void> {
		try {
			const settings = this.settingsService.getSettings();
			if (settings.checkboxSource !== 'streams') {
				return;
			}

			const streamsService = this.taskLoadingService.getStreamsService();
			
			if (!streamsService || !streamsService.isStreamsPluginAvailable()) {
				return;
			}

			const stream = streamsService.isFileInStream(filePath);
			if (stream) {
				const success = await streamsService.updateStreamBarFromFile(filePath);
				
				if (!success) {
					this.logger.warn(`OnTask: Failed to update stream bar from file ${filePath}`);
				}
			}
		} catch (error) {
			this.logger.error('OnTask: Error handling stream detection:', error);
		}
	}

	/**
	 * Parses a checkbox line to extract the status symbol and remaining text
	 * @param line The checkbox line to parse
	 * @returns Object containing statusSymbol and remainingText
	 */
	parseCheckboxLine(line: string): { statusSymbol: string; remainingText: string } {
		const trimmedLine = line.trim();
		
		const bracketIndex = trimmedLine.indexOf(']');
		if (bracketIndex !== -1) {
			const statusSymbol = trimmedLine.substring(0, bracketIndex).replace(/^-\s*\[/, '').trim() || this.getToDoSymbol();
			const remainingText = trimmedLine.substring(bracketIndex + 1).trim();
			return { statusSymbol, remainingText };
		}
		
		return { statusSymbol: this.getToDoSymbol(), remainingText: trimmedLine };
	}

	/**
	 * Gets the To-do status symbol from the status configuration
	 */
	getToDoSymbol(): string {
		const statusConfigs = this.statusConfigService.getStatusConfigs();
		const toDoConfig = statusConfigs.find(config => config.name === 'To-do');
		return toDoConfig?.symbol || ' ';
	}
}

