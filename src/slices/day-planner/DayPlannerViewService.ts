import { DayPlanResult } from './DayPlannerService';

export class DayPlannerViewService {
	private containerEl: HTMLElement;
	private generateCallback: () => void;

	constructor(containerEl: HTMLElement, onGenerate: () => void) {
		this.containerEl = containerEl;
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

	renderPlan(plan: DayPlanResult, scheduleFromNow: boolean): void {
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
			notesEl.style.fontStyle = 'italic';
			notesEl.style.color = 'var(--text-muted)';
			notesEl.style.padding = '10px';
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
				const ul = tasksEl.createEl('ul');
				ul.style.margin = '0';
				ul.style.paddingLeft = '20px';
				for (const task of slot.tasks) {
					ul.createEl('li', { text: task });
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
		errorEl.style.color = 'var(--text-error)';
		errorEl.style.padding = '10px';
	}

	private isTimeInPast(timeStr: string): boolean {
		const matches = [...timeStr.matchAll(/(\d+):(\d+)\s*(AM|PM)/gi)];
		if (matches.length === 0) return false;
		
		// Use the last time found in the string (end time if it's a range, or the only time)
		const targetMatch = matches[matches.length - 1];
		let [_, hoursStr, minsStr, ampm] = targetMatch;
		
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
