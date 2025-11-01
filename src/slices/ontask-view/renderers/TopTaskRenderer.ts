import { StatusConfigService } from '../../settings/status-config';
import { ContextMenuService } from '../services/ContextMenuService';
import { SettingsService } from '../../settings';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';

/**
 * Renders the top task section that displays the highest priority task prominently.
 */
export class TopTaskRenderer {
	constructor(
		private statusConfigService: StatusConfigService,
		private contextMenuService: ContextMenuService,
		private settingsService: SettingsService,
		private onOpenFile: (filePath: string, lineNumber: number) => Promise<void>,
		private getFileName: (filePath: string) => string,
		private parseCheckboxLine: (line: string) => { statusSymbol: string; remainingText: string },
		private getStatusDisplayText: (statusSymbol: string) => string,
		private addMobileTouchHandlers: (element: HTMLElement, task: CheckboxItem) => void
	) {}

	/**
	 * Creates a top task section element (for fragment usage).
	 */
	createTopTaskSectionElement(topTask: CheckboxItem): HTMLElement {
		const topTaskSection = document.createElement('div');
		topTaskSection.className = 'ontask-toptask-hero-section ontask-file-section';
		
		// Apply the configurable top task color
		const settings = this.settingsService.getSettings();
		const colorToUse = settings.useThemeDefaultColor ? 'var(--text-error)' : settings.topTaskColor;
		
		// Calculate and apply shadow color that complements the chosen color
		const shadowColor = this.calculateShadowColor(colorToUse);
		
		// Set the status color CSS variable for the checkbox display
		const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		
		topTaskSection.setAttribute('data-dynamic-color', 'true');
		topTaskSection.style.setProperty('--ontask-dynamic-color', colorToUse);
		topTaskSection.style.setProperty('--ontask-dynamic-shadow-color', shadowColor);
		topTaskSection.style.setProperty('--ontask-dynamic-status-color', statusColor);
		
		this.buildTopTaskContent(topTaskSection, topTask, statusSymbol);
		
		return topTaskSection;
	}

	/**
	 * Creates a top task section directly in the content area.
	 */
	createTopTaskSection(contentArea: HTMLElement, topTask: CheckboxItem): void {
		const topTaskSection = contentArea.createDiv('ontask-toptask-hero-section');
		topTaskSection.addClass('ontask-file-section');
		
		// Apply the configurable top task color
		const settings = this.settingsService.getSettings();
		const colorToUse = settings.useThemeDefaultColor ? 'var(--text-error)' : settings.topTaskColor;
		topTaskSection.style.setProperty('--ontask-toptask-color', colorToUse);
		
		// Calculate and apply shadow color that complements the chosen color
		const shadowColor = this.calculateShadowColor(colorToUse);
		topTaskSection.style.setProperty('--ontask-toptask-shadow-color', shadowColor);
		
		// Set the status color CSS variable for the checkbox display
		const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		topTaskSection.style.setProperty('--ontask-toptask-status-color', statusColor);
		
		this.buildTopTaskContent(topTaskSection, topTask, statusSymbol);
		
		contentArea.insertBefore(topTaskSection, contentArea.firstChild);
	}

	/**
	 * Updates an existing top task section with new task data.
	 */
	updateTopTaskSection(contentArea: HTMLElement, checkboxes: CheckboxItem[]): void {
		const existingTopTaskSection = contentArea.querySelector('.ontask-toptask-hero-section');
		
		const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
		
		if (topTask) {
			if (existingTopTaskSection) {
				// Set the status color CSS variable for the checkbox display
				const { statusSymbol } = this.parseCheckboxLine(topTask.lineContent);
				const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
				(existingTopTaskSection as HTMLElement).style.setProperty('--ontask-toptask-status-color', statusColor);
				
				const topTaskStatusDisplay = existingTopTaskSection.querySelector('.ontask-checkbox-display') as HTMLElement;
				if (topTaskStatusDisplay) {
					topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
					topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
					
					// Apply status colors from status config
					const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
					
					// For top task items, we need to apply dynamic styling even for built-in statuses
					// Always apply dynamic styling attributes since CSS variables are set for all statuses
					const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);
					
					if (statusConfig) {
						// Always set data-dynamic-color since CSS variables are set for all statuses
						topTaskStatusDisplay.setAttribute('data-dynamic-color', 'true');
						// Only set custom-status attribute for truly custom status configurations
						if (!StatusConfigService.isBuiltInStatus(statusSymbol)) {
							topTaskStatusDisplay.setAttribute('data-custom-status', 'true');
						}
						topTaskStatusDisplay.style.setProperty('--ontask-status-color', statusColor);
						topTaskStatusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);
					}
				}
				
				const topTaskText = existingTopTaskSection.querySelector('.ontask-toptask-hero-text');
				if (topTaskText) {
					const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
					topTaskText.textContent = remainingText || 'Top Task';
				}
				
			} else {
				this.createTopTaskSection(contentArea, topTask);
			}
		} else {
			if (existingTopTaskSection) {
				existingTopTaskSection.remove();
			}
		}
	}

	/**
	 * Builds the content structure for a top task section.
	 */
	private buildTopTaskContent(topTaskSection: HTMLElement, topTask: CheckboxItem, statusSymbol: string): void {
		const topTaskHeader = topTaskSection.createDiv('ontask-toptask-hero-header');
		topTaskHeader.createEl('h3', { text: '🔥 Top Task' });
		
		const topTaskDisplay = topTaskSection.createDiv('ontask-toptask-hero-display');
		topTaskDisplay.addClass('ontask-toptask-hero-item');
		
		const topTaskContent = topTaskDisplay.createDiv('ontask-toptask-hero-content');
		
		const topTaskStatusDisplay = topTaskDisplay.createDiv('ontask-checkbox-display');
		const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
		topTaskStatusDisplay.setAttribute('data-status', statusSymbol);
		topTaskStatusDisplay.textContent = this.getStatusDisplayText(statusSymbol);
		
		const statusColor = this.statusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = this.statusConfigService.getStatusBackgroundColor(statusSymbol);
		
		// For top task items, always apply dynamic styling to ensure proper status colors
		// Top task items have special CSS rules that require CSS custom properties
		const statusConfig = this.statusConfigService.getStatusConfig(statusSymbol);
		if (statusConfig) {
			topTaskStatusDisplay.setAttribute('data-dynamic-color', 'true');
			topTaskStatusDisplay.setAttribute('data-custom-status', 'true');
			topTaskStatusDisplay.style.setProperty('--ontask-status-color', statusColor);
			topTaskStatusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);
		}
		
		topTaskStatusDisplay.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		}, { passive: true });
		
		const topTaskText = topTaskDisplay.createDiv('ontask-toptask-hero-text');
		topTaskText.textContent = remainingText || 'Top Task';
		topTaskText.addEventListener('click', () => {
			this.onOpenFile(topTask.file?.path || '', topTask.lineNumber);
		}, { passive: true });
		
		const topTaskSource = topTaskDisplay.createDiv('ontask-toptask-hero-source');
		topTaskSource.textContent = `From: ${this.getFileName(topTask.file?.path || '')}`;
		
		topTaskContent.appendChild(topTaskStatusDisplay);
		topTaskContent.appendChild(topTaskText);
		topTaskContent.appendChild(topTaskSource);
		
		topTaskDisplay.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.contextMenuService.showContextMenu(e, topTask);
		}, { passive: false });
		this.addMobileTouchHandlers(topTaskDisplay, topTask);
	}

	/**
	 * Calculate a shadow color that complements the chosen top task color.
	 */
	private calculateShadowColor(color: string): string {
		// For CSS variables, use a default shadow color
		if (color.startsWith('var(')) {
			return 'rgba(255, 0, 0, 0.25)'; // More prominent red shadow for theme colors
		}
		
		// For hex colors, convert to RGB and create a shadow color
		try {
			// Remove # if present
			const hex = color.replace('#', '');
			
			// Convert hex to RGB
			const r = parseInt(hex.substr(0, 2), 16);
			const g = parseInt(hex.substr(2, 2), 16);
			const b = parseInt(hex.substr(4, 2), 16);
			
			// Create shadow colors with higher opacity for more prominence
			const shadowColor1 = `rgba(${r}, ${g}, ${b}, 0.25)`;
			const shadowColor2 = `rgba(${r}, ${g}, ${b}, 0.15)`;
			
			return shadowColor1;
		} catch (error) {
			// Fallback to default red shadow if color parsing fails
			return 'rgba(255, 0, 0, 0.25)';
		}
	}
}

