import { DayPlanResult } from './DayPlannerService';
import { DOMRenderingServiceInterface } from '../ontask-view/services/DOMRenderingService';
import { CheckboxItem } from '../task-finder/TaskFinderInterfaces';

export class DayPlannerViewService {
	private containerEl: HTMLElement;
	private generateCallback: () => void;
	private domRenderingService: DOMRenderingServiceInterface;

	constructor(containerEl: HTMLElement, domRenderingService: DOMRenderingServiceInterface, onGenerate: () => void) {
		this.containerEl = containerEl;
		this.domRenderingService = domRenderingService;
		this.generateCallback = onGenerate;
	}

	renderInitialState(isGenerating: boolean): void {
		this.containerEl.empty();
		
		const plannerContainer = this.containerEl.createDiv('ontask-day-planner-container');
		
		const generateBtn = plannerContainer.createEl('button', { text: isGenerating ? 'Generating...' : 'Generate Day Plan' });
		generateBtn.addClass('ontask-day-planner-generate-btn');
		
		if (isGenerating) {
			generateBtn.disabled = true;
		} else {
			generateBtn.addEventListener('click', () => {
				this.generateCallback();
			});
		}
	}

	renderPlan(plan: DayPlanResult, scheduleFromNow: boolean, checkboxes: CheckboxItem[]): void {
		this.containerEl.empty();
		
		const plannerContainer = this.containerEl.createDiv('ontask-day-planner-container');
		
		// Regenerate button at the top
		const generateBtn = plannerContainer.createEl('button', { text: 'Regenerate' });
		generateBtn.addClass('ontask-day-planner-generate-btn');
		generateBtn.addEventListener('click', () => {
			this.generateCallback();
		});

		// Notes from LLM
		if (plan.notes) {
			const notesEl = plannerContainer.createDiv('ontask-day-planner-notes');
			notesEl.setText(plan.notes);
		}

		// The Grid
		const gridEl = plannerContainer.createDiv('ontask-day-planner-grid');
		
		for (const slot of plan.schedule) {
			const rowEl = gridEl.createDiv('ontask-day-planner-row');
			
			if (scheduleFromNow && this.isTimeInPast(slot.time)) {
				rowEl.addClass('is-past');
			}
			
			const timeEl = rowEl.createDiv('ontask-day-planner-time');
			timeEl.setText(slot.time);
			
			const tasksEl = rowEl.createDiv('ontask-day-planner-tasks');
			if (slot.tasks && slot.tasks.length > 0) {
				const tasksContainer = tasksEl.createDiv('ontask-day-planner-tasks-list');
				
				for (const taskStr of slot.tasks) {
					// Clean up the LLM string (it sometimes returns "- task" instead of "- [ ] task")
					const cleanLLM = taskStr.replace(/^[-*]\s*(\[.*?\])?\s*/, '').trim().toLowerCase();
					
					// Try to find a matching CheckboxItem
					const taskItem = checkboxes.find(c => {
						const cleanOrig = c.lineContent.replace(/^[-*]\s*\[.*?\]\s*/, '').trim().toLowerCase();
						return cleanOrig === cleanLLM || cleanOrig.includes(cleanLLM) || cleanLLM.includes(cleanOrig);
					});
					
					if (taskItem) {
						// Render as a fully functional checkbox
						const checkboxEl = this.domRenderingService.createCheckboxElement(taskItem);
						// Strip out unnecessary margins for the dense day planner view
						checkboxEl.addClass('ontask-day-planner-task-item');
						tasksContainer.appendChild(checkboxEl);
					} else {
						// Fallback if not found (e.g. task was deleted since plan was generated or LLM altered the text)
						const cleanTaskText = taskStr.replace(/^[-*]\s*(\[.*?\])?\s*/, '').replace(/^\d+\.\s*/, '').replace(/^\.\s*/, '').trim();
						const mockTaskItem: CheckboxItem = {
							file: null as unknown as import('obsidian').TFile,
							lineNumber: -1,
							lineContent: `- [ ] ${cleanTaskText}`,
							checkboxText: cleanTaskText,
							sourceName: 'Day Planner',
							sourcePath: '',
							isCompleted: false
						};
						
						const fallbackEl = this.domRenderingService.createCheckboxElement(mockTaskItem);
						fallbackEl.addClass('ontask-day-planner-task-item', 'is-disconnected');
						tasksContainer.appendChild(fallbackEl);
					}
				}
			}
		}
	}

	renderError(message: string): void {
		this.containerEl.empty();
		const plannerContainer = this.containerEl.createDiv('ontask-day-planner-container');
		
		const generateBtn = plannerContainer.createEl('button', { text: 'Try Again' });
		generateBtn.addClass('ontask-day-planner-generate-btn');
		generateBtn.addEventListener('click', () => {
			this.generateCallback();
		});

		const errorEl = plannerContainer.createDiv('ontask-day-planner-error');
		errorEl.setText(message);
	}

	private isTimeInPast(timeStr: string): boolean {
		const matches = [...timeStr.matchAll(/(\d+):(\d+)\s*(AM|PM)/gi)];
		if (matches.length === 0) return false;
		
		// Use the last time found in the string (end time if it's a range, or the only time)
		const targetMatch = matches[matches.length - 1];
		let [, hoursStr, minsStr, ampm] = targetMatch;
		
		let hours = parseInt(hoursStr, 10);
		const mins = parseInt(minsStr, 10);
		
		if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
		if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
		
		const now = new Date();
		const currentHours = now.getHours();
		const currentMins = now.getMinutes();
		
		if (hours < currentHours) return true;
		if (hours === currentHours && mins <= currentMins) return true;
		
		return false;
	}
}
