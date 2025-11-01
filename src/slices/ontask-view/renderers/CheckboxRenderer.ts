import { StatusConfigService } from '../../settings/status-config';
import { ContextMenuService } from '../services/ContextMenuService';

/**
 * Renders individual checkbox elements for the task list.
 */
export class CheckboxRenderer {
	constructor(
		private statusConfigService: StatusConfigService,
		private contextMenuService: ContextMenuService,
		private onOpenFile: (filePath: string, lineNumber: number) => Promise<void>,
		private parseCheckboxLine: (line: string) => { statusSymbol: string; remainingText: string },
		private getStatusDisplayText: (statusSymbol: string) => string,
		private addMobileTouchHandlers: (element: HTMLElement, task: any) => void
	) {}

	/**
	 * Creates a checkbox DOM element with all styling, event handlers, and data attributes.
	 */
	createCheckboxElement(checkbox: any): HTMLElement {
		const checkboxEl = document.createElement('div');
		checkboxEl.addClass('ontask-checkbox-item');
		
		// Add data attributes for identification during in-place updates
		if (checkbox.file?.path) {
			checkboxEl.setAttribute('data-file-path', checkbox.file.path);
		}
		checkboxEl.setAttribute('data-line-number', checkbox.lineNumber?.toString() || '');
		
		if (checkbox.isTopTask) {
			checkboxEl.addClass('ontask-toptask-hero');
		}
		
		const checkboxContainer = document.createElement('div');
		checkboxContainer.addClass('ontask-checkbox-label');
		
		const statusDisplay = document.createElement('div');
		statusDisplay.addClass('ontask-checkbox-display');
		
		const { statusSymbol, remainingText } = this.parseCheckboxLine(checkbox.lineContent);
		statusDisplay.setAttribute('data-status', statusSymbol);
		statusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		
		// Apply colors from status config for all statuses
		const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);
		if (statusConfig) {
			statusDisplay.style.setProperty('--ontask-status-color', statusColor);
			statusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);
			
			// Always apply dynamic styling attributes since CSS variables are set for all statuses
			statusDisplay.setAttribute('data-dynamic-color', 'true');
			// Only set custom-status attribute for truly custom status configurations
			if (!StatusConfigService.isBuiltInStatus(statusSymbol)) {
				statusDisplay.setAttribute('data-custom-status', 'true');
			}
		}
		
		const textEl = document.createElement('span');
		textEl.textContent = remainingText || 'Task';
		textEl.addClass('ontask-checkbox-text');
		
		// Add ranking badge if task has topTaskRanking
		if (checkbox.topTaskRanking !== undefined) {
			const rankingEl = document.createElement('span');
			rankingEl.textContent = `Rank ${checkbox.topTaskRanking}`;
			rankingEl.addClass('ontask-task-ranking');
			rankingEl.setAttribute('data-rank', checkbox.topTaskRanking.toString());
			textEl.appendChild(rankingEl);
		}
		
		statusDisplay.addEventListener('click', () => {
			this.onOpenFile(checkbox.file?.path || '', checkbox.lineNumber);
		}, { passive: true });
		
		textEl.addEventListener('click', () => {
			this.onOpenFile(checkbox.file?.path || '', checkbox.lineNumber);
		}, { passive: true });
		
		checkboxEl.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.contextMenuService.showContextMenu(e, checkbox);
		}, { passive: false });

		this.addMobileTouchHandlers(checkboxEl, checkbox);
		
		checkboxContainer.appendChild(statusDisplay);
		checkboxContainer.appendChild(textEl);
		checkboxEl.appendChild(checkboxContainer);
		
		return checkboxEl;
	}
}

