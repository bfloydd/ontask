import { CheckboxRenderer } from './CheckboxRenderer';
import { CheckboxItem } from '../../task-finder/TaskFinderInterfaces';
import { Logger } from '../../logging/Logger';

/**
 * Renders file sections that group checkboxes by their source file.
 */
export class FileSectionRenderer {
	constructor(
		private checkboxRenderer: CheckboxRenderer,
		private getFileName: (filePath: string) => string,
		private logger?: Logger
	) {}

	/**
	 * Creates a file section element with header and checkboxes.
	 */
	createFileSectionElement(filePath: string, fileCheckboxes: CheckboxItem[], maxTasksToShow: number, tasksShown: number): HTMLElement {
		const fileSection = document.createElement('div');
		fileSection.className = 'ontask-file-section';
		fileSection.setAttribute('data-file-path', filePath);
		
		const fileHeader = fileSection.createDiv('ontask-file-header');
		fileHeader.createEl('h3', { text: this.getFileName(filePath) });
		
		const remainingSlots = maxTasksToShow - tasksShown;
		const tasksToShowFromFile = Math.min(fileCheckboxes.length, remainingSlots);
		
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (let i = 0; i < tasksToShowFromFile; i++) {
			const checkbox = fileCheckboxes[i];
			const checkboxEl = this.checkboxRenderer.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		return fileSection;
	}

	/**
	 * Creates a new file section in the content area.
	 */
	createNewFileSection(contentArea: HTMLElement, fileTasks: CheckboxItem[], filePath: string): void {
		const fileSection = contentArea.createDiv('ontask-file-section');
		fileSection.setAttribute('data-file-path', filePath);
		
		const fileHeader = fileSection.createDiv('ontask-file-header');
		fileHeader.createEl('h3', { text: this.getFileName(filePath) });
		
		const checkboxesList = fileSection.createDiv('ontask-checkboxes-list');
		
		for (const checkbox of fileTasks) {
			const checkboxEl = this.checkboxRenderer.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
	}

	/**
	 * Appends tasks to an existing file section.
	 */
	appendTasksToExistingFile(fileSection: HTMLElement, fileTasks: CheckboxItem[], filePath: string): void {
		const checkboxesList = fileSection.querySelector('.ontask-checkboxes-list') as HTMLElement;
		if (!checkboxesList) {
			if (this.logger) {
				this.logger.error('[OnTask FileSectionRenderer] Checkboxes list not found in existing file section');
			}
			return;
		}
		for (const checkbox of fileTasks) {
			const checkboxEl = this.checkboxRenderer.createCheckboxElement(checkbox);
			checkboxesList.appendChild(checkboxEl);
		}
		
		const fileCount = fileSection.querySelector('.ontask-file-count') as HTMLElement;
		if (fileCount) {
			const currentCount = checkboxesList.children.length;
			fileCount.textContent = `${currentCount} task${currentCount === 1 ? '' : 's'}`;
		}
	}
}

