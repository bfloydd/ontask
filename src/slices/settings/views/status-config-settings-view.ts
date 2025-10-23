import { App } from 'obsidian';
import { StatusConfigView } from './status-config-view';
import { StatusConfigService } from '../status-config';

export class StatusConfigSettingsView {
	private app: App;
	private statusConfigService: StatusConfigService;
	private containerEl: HTMLElement;

	constructor(app: App, statusConfigService: StatusConfigService, containerEl: HTMLElement) {
		this.app = app;
		this.statusConfigService = statusConfigService;
		this.containerEl = containerEl;
	}

	render(): void {
		this.containerEl.empty();

		// Create a container for the status configuration
		const statusConfigContainer = this.containerEl.createEl('div', { cls: 'status-config-container' });
		
		// Initialize and render the status configuration view
		const statusConfigView = new StatusConfigView(statusConfigContainer, this.statusConfigService, this.app);
		statusConfigView.render();
	}
}

