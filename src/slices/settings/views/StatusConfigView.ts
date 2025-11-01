import { App, Setting, Modal } from 'obsidian';
import { StatusConfig } from '../SettingsServiceInterface';
import { StatusConfigService } from '../StatusConfig';
import { setupDragAndDrop } from '../../../shared/DragAndDropUtils';

const NON_EDITABLE_SYMBOLS = ['/', '!', '+', '.', 'x'];

export class StatusConfigView {
	private containerEl: HTMLElement;
	private statusConfigService: StatusConfigService;
	private app: App;
	private statusConfigs: StatusConfig[] = [];

	constructor(containerEl: HTMLElement, statusConfigService: StatusConfigService, app: App) {
		this.containerEl = containerEl;
		this.statusConfigService = statusConfigService;
		this.app = app;
	}

	render(): void {
		this.containerEl.empty();
		this.statusConfigs = [...this.statusConfigService.getStatusConfigs()];

		// Header
		const headerEl = this.containerEl.createEl('div', { cls: 'status-config-header' });
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

		// Check if this is a non-editable symbol
		const isNonEditableSymbol = NON_EDITABLE_SYMBOLS.includes(config.symbol);

		// Drag handle (visual indicator only - the entire item is draggable)
		const dragHandle = itemEl.createEl('div', { 
			cls: 'status-config-drag-handle',
			text: '⋮⋮'
		});

		// Status preview
		const previewEl = itemEl.createEl('div', { cls: 'status-config-preview' });
		const statusEl = previewEl.createEl('span', { 
			cls: 'status-config-symbol',
			text: config.symbol
		});
		// Apply colors directly via inline styles for all statuses
		statusEl.style.color = config.color;
		statusEl.style.backgroundColor = config.backgroundColor || 'transparent';
		
		// Always apply dynamic styling attributes since CSS variables are set for all statuses
		statusEl.setAttribute('data-dynamic-color', 'true');
		
		// Only set custom-status attribute for truly custom status configurations
		if (!StatusConfigService.isBuiltInStatus(config.symbol)) {
			statusEl.setAttribute('data-custom-status', 'true');
		}
		
		// Add lock icon for non-editable symbols
		if (isNonEditableSymbol) {
			const lockIcon = previewEl.createEl('span', {
				cls: 'status-config-symbol-lock',
				text: '🔒',
				attr: { title: 'This symbol is read-only (used for task detection)' }
			});
			// Lock icon styles are now handled by CSS
		}

		// Status info
		const infoEl = itemEl.createEl('div', { cls: 'status-config-info' });
		const nameEl = infoEl.createEl('div', { 
			cls: 'status-config-name',
			text: config.name
		});
		
		// Add description on the same line
		const descriptionEl = infoEl.createEl('span', { 
			cls: 'status-config-description',
			text: ` - ${config.description}`
		});
		
		// Add visual indicator for ranking after description
		if (config.topTaskRanking !== undefined) {
			const indicatorEl = infoEl.createEl('span', {
				cls: 'status-config-ranking-indicator',
				text: ` - Top task rank #${config.topTaskRanking}`,
				attr: { title: 'This status participates in top task selection with this priority ranking' }
			});
			indicatorEl.addClass('status-config-indicator');
		}

		// Edit button
		const editBtn = itemEl.createEl('button', { 
			cls: 'status-config-edit-btn',
			text: 'Edit'
		});

		// Delete button (only show for editable symbols)
		let deleteBtn: HTMLButtonElement | null = null;
		
		if (!isNonEditableSymbol) {
			deleteBtn = itemEl.createEl('button', { 
				cls: 'status-config-delete-btn',
				text: 'Delete'
			});
		}

		// Event listeners
		editBtn.addEventListener('click', () => this.editStatus(config, index), { passive: true });
		if (deleteBtn) {
			deleteBtn.addEventListener('click', () => this.deleteStatus(index), { passive: true });
		}
		
		// Drag and drop
		setupDragAndDrop<StatusConfig>({
			itemElement: itemEl,
			itemIndex: index,
			draggingClass: 'dragging',
			dragOverClass: 'status-config-drag-over',
			dropIndicatorClass: 'status-config-drop-indicator',
			containerSelector: '.status-config-list',
			itemSelector: '.status-config-item',
			getItems: () => this.statusConfigs,
			saveItems: async (items) => {
				await this.statusConfigService.reorderStatusConfigs(items);
				this.statusConfigs = [...this.statusConfigService.getStatusConfigs()];
			},
			onReorder: () => {
				this.render();
			}
		});
	}

	private renderAddButton(containerEl: HTMLElement): void {
		const addBtn = containerEl.createEl('button', { 
			cls: 'status-config-add-btn',
			text: '+ Add New Status'
		});
		
		addBtn.addEventListener('click', () => this.addNewStatus(), { passive: true });
	}

	private async editStatus(config: StatusConfig, index: number): Promise<void> {
		this.showStatusModal(config, index);
	}

	private async addNewStatus(): Promise<void> {
		this.showStatusModal();
	}

	private showStatusModal(existingConfig?: StatusConfig, index?: number): void {
		const modal = new Modal(this.app);
		modal.titleEl.textContent = existingConfig ? 'Edit Status' : 'Add Status';
		
		const contentEl = modal.contentEl;
		contentEl.empty();

		// Create a working copy of the config for editing
		const workingConfig: StatusConfig = existingConfig ? { ...existingConfig } : {
			symbol: '+',
			name: 'New Status',
			description: 'A new status',
			color: '#6b7280',
			backgroundColor: 'transparent'
		};

		// Symbol input
		const isNonEditableSymbol = existingConfig && NON_EDITABLE_SYMBOLS.includes(workingConfig.symbol);
		let symbolDescription: string;
		
		if (isNonEditableSymbol) {
			if (workingConfig.symbol === '.') {
				symbolDescription = 'Single character symbol for this status (read-only - this is the default task symbol)';
			} else if (workingConfig.symbol === 'x') {
				symbolDescription = 'Single character symbol for this status (read-only - this is the done/completed symbol)';
			} else {
				symbolDescription = 'Single character symbol for this status (read-only - this is a top task symbol)';
			}
		} else {
			symbolDescription = 'Single character symbol for this status';
		}
		
		const symbolSetting = new Setting(contentEl)
			.setName('Symbol')
			.setDesc(symbolDescription);
		
		if (isNonEditableSymbol) {
			// Make symbol read-only for non-editable symbols
			symbolSetting.addText(text => {
				text.setValue(workingConfig.symbol)
					.setDisabled(true)
					.setPlaceholder('e.g., x, !, ?');
				// Add visual styling for disabled state
				text.inputEl.addClass('status-config-modal-symbol-disabled');
			});
		} else {
			symbolSetting.addText(text => text
				.setValue(workingConfig.symbol)
				.setPlaceholder('e.g., x, !, ?')
				.onChange(value => workingConfig.symbol = value));
		}

		// Name input
		new Setting(contentEl)
			.setName('Name')
			.setDesc('Display name for this status')
			.addText(text => text
				.setValue(workingConfig.name)
				.setPlaceholder('e.g., Done, Important')
				.onChange(value => workingConfig.name = value));

		// Description input
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Description of what this status means')
			.addText(text => text
				.setValue(workingConfig.description)
				.setPlaceholder('e.g., Task is completed')
				.onChange(value => workingConfig.description = value));

		// Top Task Ranking input
		new Setting(contentEl)
			.setName('Top Task Ranking')
			.setDesc('Priority for top task selection (lower = higher priority). Leave blank to exclude from top task selection.')
			.addText(text => {
				text.setValue(workingConfig.topTaskRanking?.toString() || '')
					.setPlaceholder('e.g., 1, 2, 3')
					.inputEl.type = 'number';
				text.inputEl.min = '1';
				text.inputEl.step = '1';
				text.onChange(value => {
					if (value.trim() === '') {
						workingConfig.topTaskRanking = undefined;
					} else {
						const ranking = parseInt(value, 10);
						workingConfig.topTaskRanking = isNaN(ranking) ? undefined : ranking;
					}
				});
			});

		// Color input
		new Setting(contentEl)
			.setName('Text Color')
			.setDesc('Color of the text/symbol')
			.addText(text => text
				.setValue(workingConfig.color)
				.setPlaceholder('#ffffff')
				.onChange(value => workingConfig.color = value));

		// Background color input
		new Setting(contentEl)
			.setName('Background Color')
			.setDesc('Background color (optional)')
			.addText(text => text
				.setValue(workingConfig.backgroundColor || '')
				.setPlaceholder('#10b981 or transparent')
				.onChange(value => workingConfig.backgroundColor = value || 'transparent'));

		// Preview
		const previewEl = contentEl.createEl('div', { cls: 'status-config-modal-preview' });
		previewEl.createEl('h4', { text: 'Preview:' });
		const previewStatus = previewEl.createEl('span', { 
			cls: 'status-config-modal-symbol',
			text: workingConfig.symbol
		});
		// Always apply dynamic styling and colors directly via inline styles
		previewStatus.setAttribute('data-dynamic-color', 'true');
		previewStatus.style.color = workingConfig.color;
		previewStatus.style.backgroundColor = workingConfig.backgroundColor || 'transparent';
		
		// Only set custom-status attribute for truly custom status configurations
		if (!StatusConfigService.isBuiltInStatus(workingConfig.symbol)) {
			previewStatus.setAttribute('data-custom-status', 'true');
		}

		// Update preview on change
		const updatePreview = () => {
			previewStatus.textContent = workingConfig.symbol;
			// Always apply dynamic styling and colors directly via inline styles
			previewStatus.setAttribute('data-dynamic-color', 'true');
			previewStatus.style.color = workingConfig.color;
			previewStatus.style.backgroundColor = workingConfig.backgroundColor || 'transparent';
			
			// Only set custom-status attribute for truly custom status configurations
			if (!StatusConfigService.isBuiltInStatus(workingConfig.symbol)) {
				previewStatus.setAttribute('data-custom-status', 'true');
			} else {
				previewStatus.removeAttribute('data-custom-status');
			}
		};

		// Add change listeners to update preview
		contentEl.querySelectorAll('input[type="text"]').forEach((input: HTMLInputElement) => {
			input.addEventListener('input', updatePreview, { passive: true });
		});

		// Buttons
		const buttonContainer = contentEl.createEl('div', { cls: 'status-config-modal-buttons' });
		
		const cancelBtn = buttonContainer.createEl('button', { 
			text: 'Cancel'
		});
		
		const saveBtn = buttonContainer.createEl('button', { 
			cls: 'mod-cta',
			text: 'Save'
		});

		cancelBtn.addEventListener('click', () => {
			modal.close();
		}, { passive: true });

		saveBtn.addEventListener('click', async () => {
			if (existingConfig && index !== undefined) {
				// Editing existing status
				await this.saveStatus(workingConfig, index);
			} else {
				// Adding new status
				await this.statusConfigService.addStatusConfig(workingConfig);
				this.statusConfigs = [...this.statusConfigService.getStatusConfigs()];
				this.render();
			}
			modal.close();
		}, { passive: true });

		modal.open();
	}

	private async deleteStatus(index: number): Promise<void> {
		if (this.statusConfigs.length <= 1) {
			// Don't allow deleting the last status
			return;
		}

		const configToDelete = this.statusConfigs[index];
		
		// Don't allow deleting non-editable symbols
		if (NON_EDITABLE_SYMBOLS.includes(configToDelete.symbol)) {
			return;
		}

		await this.statusConfigService.removeStatusConfig(configToDelete.symbol);
		this.statusConfigs = [...this.statusConfigService.getStatusConfigs()];
		this.render();
	}

	private async saveStatus(config: StatusConfig, index: number): Promise<void> {
		const originalSymbol = this.statusConfigs[index].symbol;
		await this.statusConfigService.updateStatusConfig(originalSymbol, config);
		this.statusConfigs = [...this.statusConfigService.getStatusConfigs()];
		this.render();
	}

	private async saveAllStatuses(): Promise<void> {
		await this.statusConfigService.reorderStatusConfigs([...this.statusConfigs]);
	}
}



