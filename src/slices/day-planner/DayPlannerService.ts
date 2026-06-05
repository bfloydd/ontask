import { requestUrl } from 'obsidian';
import { Logger } from '../logging/Logger';
import { CheckboxItem } from '../task-finder/TaskFinderInterfaces';

export interface DayPlanResult {
	schedule: { time: string; tasks: string[] }[];
	notes: string;
}

interface GeminiGenerateContentResponse {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				text?: string;
			}>;
		};
	}>;
}

export class DayPlannerService {
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	async generateDayPlan(
		apiKey: string,
		model: string,
		systemPrompt: string,
		schedulePrompt: string,
		scheduleFromNow: boolean,
		startTime: string,
		endTime: string,
		tasks: CheckboxItem[]
	): Promise<DayPlanResult | null> {
		if (!apiKey) {
			this.logger.error('No Gemini API key provided.');
			return null;
		}

		// Format tasks
		const taskListStr = tasks.map(t => t.lineContent.trim()).join('\n');
		
		let timeContext = `\n\nCRITICAL CONSTRAINT:\nYou MUST start the day's schedule at EXACTLY ${startTime || '06:00 AM'} and end the schedule at EXACTLY ${endTime || '10:00 PM'}. No tasks can be scheduled outside of these bounds.`;
		
		if (scheduleFromNow) {
			const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
			timeContext += `\nAlso, the current time is ${currentTime}. You MUST NOT schedule any tasks in time slots that have already passed today (before ${currentTime}). Leave the tasks array completely empty for all past time slots. Only schedule tasks for the remaining time in the day.`;
		}
		
		const fullPrompt = `If this is my schedule:\n\n${taskListStr}\n\nMy daily schedule and availability:\n${schedulePrompt}${timeContext}\n\nInstructions:\n${systemPrompt}`;

		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`;

		try {
			const response = await requestUrl({
				url: url,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					contents: [{
						role: 'user',
						parts: [{ text: fullPrompt }]
					}],
					generationConfig: {
						responseMimeType: "application/json",
						responseSchema: {
							type: "object",
							properties: {
								schedule: {
									type: "array",
									items: {
										type: "object",
										properties: {
											time: { type: "string" },
											tasks: { 
												type: "array", 
												items: { type: "string" } 
											}
										},
										required: ["time", "tasks"]
									}
								},
								notes: { type: "string" }
							},
							required: ["schedule", "notes"]
						}
					}
				})
			});

			if (response.status !== 200) {
				this.logger.error('Gemini API Error:', response.json);
				return null;
			}

			const data = response.json as GeminiGenerateContentResponse;
			const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
			
			if (textResult) {
				const parsed = JSON.parse(textResult) as DayPlanResult;
				return parsed;
			}
			return null;
		} catch (error) {
			this.logger.error('Error generating day plan:', error);
			return null;
		}
	}
}
