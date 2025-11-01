import { StatusConfigService } from '../../settings/status-config';
import { TopTaskProcessingService } from './TopTaskProcessingService';
import { DOMRenderingService } from './DOMRenderingService';
import { CheckboxContentTrackingService } from './CheckboxContentTrackingService';
import { OnTaskViewHelpers } from '../OnTaskViewHelpers';

export interface CheckboxUpdateServiceCallbacks {
	onRefreshNeeded: () => void;
}

export interface CheckboxUpdateServiceInterface {
	updateCheckboxRowInPlace(
		contentArea: HTMLElement,
		checkbox: any,
		newLineContent: string,
		checkboxes: any[]
	): void;
	findCheckboxElement(contentArea: HTMLElement, filePath: string, lineNumber: number): HTMLElement | null;
}

/**
 * Service responsible for updating checkbox DOM elements in-place without requiring
 * a full view refresh. Handles status updates, top task changes, and ranking badges.
 */
export class CheckboxUpdateService implements CheckboxUpdateServiceInterface {
	constructor(
		private statusConfigService: StatusConfigService,
		private topTaskProcessingService: TopTaskProcessingService,
		private domRenderingService: DOMRenderingService,
		private contentTrackingService: CheckboxContentTrackingService,
		private helpers: OnTaskViewHelpers,
		private logger: any,
		private callbacks: CheckboxUpdateServiceCallbacks
	) {}

	/**
	 * Updates a checkbox row in-place in the DOM without full refresh
	 */
	updateCheckboxRowInPlace(contentArea: HTMLElement, checkbox: any, newLineContent: string, checkboxes: any[]): void {
		try {
			// Store the previous top task to detect changes
			const previousTopTask = checkboxes.find((cb: any) => cb.isTopTask);

			// Update the checkbox object's lineContent
			checkbox.lineContent = newLineContent;

			// Find the DOM element using data attributes
			const filePath = checkbox.file?.path || '';
			const lineNumber = checkbox.lineNumber;
			if (!lineNumber) {
				this.logger.debug('[OnTask CheckboxUpdate] No line number found for checkbox, falling back to refresh');
				this.callbacks.onRefreshNeeded();
				return;
			}
			const checkboxElement = this.findCheckboxElement(contentArea, filePath, lineNumber);

			if (!checkboxElement) {
				this.logger.debug('[OnTask CheckboxUpdate] Checkbox element not found for in-place update, falling back to refresh');
				this.callbacks.onRefreshNeeded();
				return;
			}

			// Re-process top tasks to determine if top task has changed
			this.topTaskProcessingService.processTopTasksFromDisplayedTasks(checkboxes);
			const newTopTask = checkboxes.find((cb: any) => cb.isTopTask);
			const topTaskChanged = previousTopTask !== newTopTask;

			// Parse the new line content
			const { statusSymbol, remainingText } = this.helpers.parseCheckboxLine(newLineContent);
			
			// Ensure topTaskRanking is cleared if the checkbox no longer matches any ranked status
			const rankedConfigs = this.topTaskProcessingService.getTopTaskConfig();
			const matchesRankedStatus = rankedConfigs.some(config => 
				this.topTaskProcessingService.isTopTaskByConfig(checkbox, config)
			);
			if (!matchesRankedStatus) {
				checkbox.topTaskRanking = undefined;
			}

			// Update status display
			this.updateStatusDisplay(checkboxElement, statusSymbol);

			// Update top task styling
			this.updateTopTaskStyling(checkboxElement, checkbox.isTopTask);

			// Update task text and ranking badge
			this.updateTaskText(checkboxElement, remainingText, checkbox);

			// Update top task section if top task changed or if this is the current top task
			if (topTaskChanged || checkbox.isTopTask) {
				this.domRenderingService.updateTopTaskSection(contentArea, checkboxes);
			}

			// If top task changed, update both the previous and new top task elements
			if (topTaskChanged) {
				this.updatePreviousTopTask(contentArea, previousTopTask, checkbox);
				this.updateNewTopTask(contentArea, newTopTask, checkbox);
			}

			// Update content tracking
			this.contentTrackingService.updateContent(checkbox, newLineContent);

			this.logger.debug('[OnTask CheckboxUpdate] Successfully updated checkbox row in-place for', filePath, 'line', lineNumber.toString());
		} catch (error) {
			this.logger.error('[OnTask CheckboxUpdate] Error updating checkbox row in-place:', error);
			this.callbacks.onRefreshNeeded();
		}
	}

	/**
	 * Finds a checkbox DOM element by file path and line number
	 */
	findCheckboxElement(contentArea: HTMLElement, filePath: string, lineNumber: number): HTMLElement | null {
		const allCheckboxItems = contentArea.querySelectorAll('.ontask-checkbox-item');
		const lineNumberStr = lineNumber.toString();
		for (const item of Array.from(allCheckboxItems)) {
			const itemPath = item.getAttribute('data-file-path');
			const itemLineNumber = item.getAttribute('data-line-number');
			if (itemPath === filePath && itemLineNumber === lineNumberStr) {
				return item as HTMLElement;
			}
		}
		return null;
	}

	/**
	 * Updates the status display element with new status symbol and styling
	 */
	private updateStatusDisplay(checkboxElement: HTMLElement, statusSymbol: string): void {
		const statusDisplay = checkboxElement.querySelector('.ontask-checkbox-display') as HTMLElement;
		if (!statusDisplay) return;

		statusDisplay.setAttribute('data-status', statusSymbol);
		statusDisplay.textContent = this.helpers.getStatusDisplayText(statusSymbol);

		// Update colors from status config
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);

		if (statusConfig) {
			statusDisplay.style.setProperty('--ontask-status-color', statusColor);
			statusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);
			statusDisplay.setAttribute('data-dynamic-color', 'true');
		}

		// Handle data-custom-status attribute based on built-in status
		if (!StatusConfigService.isBuiltInStatus(statusSymbol)) {
			statusDisplay.setAttribute('data-custom-status', 'true');
		} else {
			statusDisplay.removeAttribute('data-custom-status');
		}
	}

	/**
	 * Updates the top task styling class on the checkbox element
	 */
	private updateTopTaskStyling(checkboxElement: HTMLElement, isTopTask: boolean): void {
		if (isTopTask) {
			checkboxElement.addClass('ontask-toptask-hero');
		} else {
			checkboxElement.removeClass('ontask-toptask-hero');
		}
	}

	/**
	 * Updates the task text element and ranking badge
	 */
	private updateTaskText(checkboxElement: HTMLElement, remainingText: string, checkbox: any): void {
		const textEl = checkboxElement.querySelector('.ontask-checkbox-text') as HTMLElement;
		if (!textEl) return;

		textEl.textContent = remainingText || 'Task';
		
		// Remove existing ranking badge if any
		const existingRanking = textEl.querySelector('.ontask-task-ranking');
		if (existingRanking) {
			existingRanking.remove();
		}
		
		// Add ranking badge if task has topTaskRanking
		if (checkbox.topTaskRanking !== undefined) {
			const rankingElement = document.createElement('span');
			rankingElement.textContent = `Rank ${checkbox.topTaskRanking}`;
			rankingElement.addClass('ontask-task-ranking');
			rankingElement.setAttribute('data-rank', checkbox.topTaskRanking.toString());
			textEl.appendChild(rankingElement);
		}
	}

	/**
	 * Updates the previous top task element when top task changes
	 */
	private updatePreviousTopTask(contentArea: HTMLElement, previousTopTask: any, currentCheckbox: any): void {
		if (!previousTopTask || previousTopTask === currentCheckbox) return;

		const previousTopTaskFilePath = previousTopTask.file?.path || '';
		const previousTopTaskLineNumber = previousTopTask.lineNumber;
		if (!previousTopTaskLineNumber) return;
		const previousTopTaskElement = this.findCheckboxElement(contentArea, previousTopTaskFilePath, previousTopTaskLineNumber);
		
		if (previousTopTaskElement) {
			previousTopTaskElement.removeClass('ontask-toptask-hero');
			const prevTextEl = previousTopTaskElement.querySelector('.ontask-checkbox-text') as HTMLElement;
			if (prevTextEl) {
				const prevRanking = prevTextEl.querySelector('.ontask-task-ranking');
				if (prevRanking) {
					prevRanking.remove();
				}
			}
		}
	}

	/**
	 * Updates the new top task element when top task changes
	 */
	private updateNewTopTask(contentArea: HTMLElement, newTopTask: any, currentCheckbox: any): void {
		if (!newTopTask || newTopTask === currentCheckbox) return;

		const newTopTaskFilePath = newTopTask.file?.path || '';
		const newTopTaskLineNumber = newTopTask.lineNumber;
		if (!newTopTaskLineNumber) return;
		const newTopTaskElement = this.findCheckboxElement(contentArea, newTopTaskFilePath, newTopTaskLineNumber);
		
		if (newTopTaskElement && newTopTask.topTaskRanking !== undefined) {
			newTopTaskElement.addClass('ontask-toptask-hero');
			const newTextEl = newTopTaskElement.querySelector('.ontask-checkbox-text') as HTMLElement;
			if (newTextEl) {
				const existingRanking = newTextEl.querySelector('.ontask-task-ranking');
				if (existingRanking) {
					existingRanking.remove();
				}
				const rankingElement = document.createElement('span');
				rankingElement.textContent = `Rank ${newTopTask.topTaskRanking}`;
				rankingElement.addClass('ontask-task-ranking');
				rankingElement.setAttribute('data-rank', newTopTask.topTaskRanking.toString());
				newTextEl.appendChild(rankingElement);
			}
		}
	}
}

