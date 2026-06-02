import { App, Setting } from 'obsidian';
import { SettingsService } from '../SettingsServiceInterface';

export class DayPlannerSettingsView {
	private app: App;
	private settingsService: SettingsService;
	private containerEl: HTMLElement;

	constructor(app: App, settingsService: SettingsService, containerEl: HTMLElement) {
		this.app = app;
		this.settingsService = settingsService;
		this.containerEl = containerEl;
	}

	render(): void {
		const settings = this.settingsService.getSettings();

		new Setting(this.containerEl)
			.setName('Gemini API Key')
			.setDesc('Enter your Google Gemini API key to generate day plans.')
			.addText(text => text
				.setPlaceholder('Enter API key...')
				.setValue(settings.geminiApiKey)
				.onChange(async (value) => {
					await this.settingsService.updateSetting('geminiApiKey', value);
				})
			);

		new Setting(this.containerEl)
			.setName('Gemini Model')
			.setDesc('The Gemini model to use for generation (e.g., gemini-2.5-flash).')
			.addText(text => text
				.setPlaceholder('gemini-2.5-flash')
				.setValue(settings.geminiModel)
				.onChange(async (value) => {
					await this.settingsService.updateSetting('geminiModel', value);
				})
			);

		new Setting(this.containerEl)
			.setName('Day Planner Prompt')
			.setDesc('Custom instructions to guide the LLM when assembling your day plan.')
			.addTextArea(text => {
				text.setPlaceholder('Enter prompt...')
					.setValue(settings.dayPlannerPrompt)
					.onChange(async (value) => {
						await this.settingsService.updateSetting('dayPlannerPrompt', value);
					});
				text.inputEl.rows = 8;
				text.inputEl.cols = 50;
			});

		new Setting(this.containerEl)
			.setName('My day schedule')
			.setDesc('Include times available that must be considered during our Day Plan evaluation (e.g., real world schedule).')
			.addTextArea(text => {
				text.setPlaceholder('Enter your available times or daily schedule...')
					.setValue(settings.dayPlannerSchedule)
					.onChange(async (value) => {
						await this.settingsService.updateSetting('dayPlannerSchedule', value);
					});
				text.inputEl.rows = 6;
				text.inputEl.cols = 50;
			});
	}
}
