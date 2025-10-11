// Status configuration UI component
import { App, Setting, Modal } from 'obsidian';
import { StatusConfig } from './settings-interface';

export class StatusConfigView {
	private containerEl: HTMLElement;
	private settingsService: any;
	private app: App;
	private statusConfigs: StatusConfig[] = [];

	constructor(containerEl: HTMLElement, settingsService: any, app: App) {
		this.containerEl = containerEl;
		this.settingsService = settingsService;
		this.app = app;
	}

	render(): void {
		this.containerEl.empty();
		this.statusConfigs = [...this.settingsService.getSettings().statusConfigs];

		// Header
		const headerEl = this.containerEl.createEl('div', { cls: 'status-config-header' });
		headerEl.createEl('h3', { text: 'Status Configuration' });
		headerEl.createEl('p', { 
			text: 'Customize the appearance and order of task statuses. Drag to reorder, click to edit.',
			cls: 'setting-item-description'
		});

		// Status list container
		const statusListEl = this.containerEl.createEl('div', { cls: 'status-config-list' });
		
		// Render each status
		this.statusConfigs.forEach((config, index) => {
			this.renderStatusItem(statusListEl, config, index);
		});

		// Add new status button
		this.renderAddButton(statusListEl);
	}

	private renderStatusItem(containerEl: HTMLElement, config: StatusConfig, index: number): void {
		const itemEl = containerEl.createEl('div', { 
			cls: 'status-config-item',
			attr: { 'data-index': index.toString() }
		});

		// Drag handle
		const dragHandle = itemEl.createEl('div', { 
			cls: 'status-config-drag-handle',
			text: '⋮⋮'
		});
		dragHandle.setAttribute('draggable', 'true');

		// Status preview
		const previewEl = itemEl.createEl('div', { cls: 'status-config-preview' });
		const statusEl = previewEl.createEl('span', { 
			cls: 'status-config-symbol',
			text: config.symbol
		});
		statusEl.style.color = config.color;
		statusEl.style.backgroundColor = config.backgroundColor || 'transparent';
		statusEl.style.padding = '2px 6px';
		statusEl.style.borderRadius = '4px';
		statusEl.style.fontWeight = 'bold';

		// Status info
		const infoEl = itemEl.createEl('div', { cls: 'status-config-info' });
		infoEl.createEl('div', { 
			cls: 'status-config-name',
			text: config.name
		});
		infoEl.createEl('div', { 
			cls: 'status-config-description',
			text: config.description
		});

		// Edit button
		const editBtn = itemEl.createEl('button', { 
			cls: 'status-config-edit-btn',
			text: 'Edit'
		});

		// Delete button
		const deleteBtn = itemEl.createEl('button', { 
			cls: 'status-config-delete-btn',
			text: 'Delete'
		});

		// Event listeners
		editBtn.addEventListener('click', () => this.editStatus(config, index));
		deleteBtn.addEventListener('click', () => this.deleteStatus(index));
		
		// Drag and drop
		this.setupDragAndDrop(itemEl, index);
	}

	private renderAddButton(containerEl: HTMLElement): void {
		const addBtn = containerEl.createEl('button', { 
			cls: 'status-config-add-btn',
			text: '+ Add New Status'
		});
		
		addBtn.addEventListener('click', () => this.addNewStatus());
	}

	private async editStatus(config: StatusConfig, index: number): Promise<void> {
		// Create modal for editing
		const modal = new Modal(this.app);
		modal.titleEl.setText('Edit Status');
		
		const contentEl = modal.contentEl;
		contentEl.empty();

		// Symbol input
		new Setting(contentEl)
			.setName('Symbol')
			.setDesc('Single character symbol for this status')
			.addText(text => text
				.setValue(config.symbol)
				.setPlaceholder('e.g., x, !, ?')
				.onChange(value => config.symbol = value));

		// Name input
		new Setting(contentEl)
			.setName('Name')
			.setDesc('Display name for this status')
			.addText(text => text
				.setValue(config.name)
				.setPlaceholder('e.g., Done, Important')
				.onChange(value => config.name = value));

		// Description input
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Description of what this status means')
			.addText(text => text
				.setValue(config.description)
				.setPlaceholder('e.g., Task is completed')
				.onChange(value => config.description = value));

		// Color input
		new Setting(contentEl)
			.setName('Text Color')
			.setDesc('Color of the text/symbol')
			.addText(text => text
				.setValue(config.color)
				.setPlaceholder('#ffffff')
				.onChange(value => config.color = value));

		// Background color input
		new Setting(contentEl)
			.setName('Background Color')
			.setDesc('Background color (optional)')
			.addText(text => text
				.setValue(config.backgroundColor || '')
				.setPlaceholder('#10b981 or transparent')
				.onChange(value => config.backgroundColor = value || 'transparent'));

		// Preview
		const previewEl = contentEl.createEl('div', { cls: 'status-config-modal-preview' });
		previewEl.createEl('h4', { text: 'Preview:' });
		const previewStatus = previewEl.createEl('span', { 
			cls: 'status-config-modal-symbol',
			text: config.symbol
		});
		previewStatus.style.color = config.color;
		previewStatus.style.backgroundColor = config.backgroundColor || 'transparent';
		previewStatus.style.padding = '4px 8px';
		previewStatus.style.borderRadius = '4px';
		previewStatus.style.fontWeight = 'bold';
		previewStatus.style.marginRight = '8px';

		// Update preview on change
		const updatePreview = () => {
			previewStatus.textContent = config.symbol;
			previewStatus.style.color = config.color;
			previewStatus.style.backgroundColor = config.backgroundColor || 'transparent';
		};

		// Add change listeners to update preview
		contentEl.querySelectorAll('input[type="text"]').forEach((input: HTMLInputElement) => {
			input.addEventListener('input', updatePreview);
		});

		// Buttons
		const buttonContainer = contentEl.createEl('div', { cls: 'status-config-modal-buttons' });
		
		const saveBtn = buttonContainer.createEl('button', { 
			cls: 'mod-cta',
			text: 'Save'
		});
		
		const cancelBtn = buttonContainer.createEl('button', { 
			text: 'Cancel'
		});

		saveBtn.addEventListener('click', async () => {
			await this.saveStatus(config, index);
			modal.close();
		});

		cancelBtn.addEventListener('click', () => {
			modal.close();
		});

		modal.open();
	}

	private async addNewStatus(): Promise<void> {
		const newStatus: StatusConfig = {
			symbol: '+',
			name: 'New Status',
			description: 'A new status',
			color: '#6b7280',
			backgroundColor: 'transparent'
		};

		await this.settingsService.addStatusConfig(newStatus);
		this.statusConfigs = [...this.settingsService.getStatusConfigs()];
		this.render();
	}

	private async deleteStatus(index: number): Promise<void> {
		if (this.statusConfigs.length <= 1) {
			// Don't allow deleting the last status
			return;
		}

		const configToDelete = this.statusConfigs[index];
		await this.settingsService.removeStatusConfig(configToDelete.symbol);
		this.statusConfigs = [...this.settingsService.getStatusConfigs()];
		this.render();
	}

	private async saveStatus(config: StatusConfig, index: number): Promise<void> {
		const originalSymbol = this.statusConfigs[index].symbol;
		await this.settingsService.updateStatusConfig(originalSymbol, config);
		this.statusConfigs = [...this.settingsService.getStatusConfigs()];
		this.render();
	}

	private async saveAllStatuses(): Promise<void> {
		await this.settingsService.reorderStatusConfigs([...this.statusConfigs]);
	}

	private setupDragAndDrop(itemEl: HTMLElement, index: number): void {
		itemEl.addEventListener('dragstart', (e) => {
			e.dataTransfer?.setData('text/plain', index.toString());
			itemEl.classList.add('dragging');
		});

		itemEl.addEventListener('dragend', () => {
			itemEl.classList.remove('dragging');
		});

		itemEl.addEventListener('dragover', (e) => {
			e.preventDefault();
		});

		itemEl.addEventListener('drop', async (e) => {
			e.preventDefault();
			const draggedIndex = parseInt(e.dataTransfer?.getData('text/plain') || '0');
			
			if (draggedIndex !== index) {
				// Reorder the array
				const draggedItem = this.statusConfigs[draggedIndex];
				this.statusConfigs.splice(draggedIndex, 1);
				this.statusConfigs.splice(index, 0, draggedItem);
				
				await this.settingsService.reorderStatusConfigs([...this.statusConfigs]);
				this.statusConfigs = [...this.settingsService.getStatusConfigs()];
				this.render();
			}
		});
	}
}
