import { requestUrl } from 'obsidian';
import { Logger } from '../logging/Logger';
import { CheckboxItem } from '../task-finder/TaskFinderInterfaces';

export interface DayPlanResult {
	schedule: { time: string; tasks: string[] }[];
	notes: string;
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
		tasks: CheckboxItem[]
	): Promise<DayPlanResult | null> {
		if (!apiKey) {
			this.logger.error('No Gemini API key provided.');
			return null;
		}

		// Format tasks
		const taskListStr = tasks.map(t => t.lineContent.trim()).join('\n');
		
		const fullPrompt = `If this is my schedule:\n\n${taskListStr}\n\nMy daily schedule and availability:\n${schedulePrompt}\n\nInstructions:\n${systemPrompt}`;

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

			const data = response.json;
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
