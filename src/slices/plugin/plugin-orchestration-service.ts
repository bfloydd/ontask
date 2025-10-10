// Plugin orchestration slice - Service implementation
import { App, Plugin, WorkspaceLeaf } from 'obsidian';
import { PluginOrchestrator, PluginDependencies } from './plugin-orchestration-interface';
import { SettingsService } from '../settings';
import { CheckboxFinderService } from '../checkbox-finder';
import { StreamsService } from '../streams';
import { OnTaskView, ONTASK_VIEW_TYPE } from '../ontask-view';
import { EventSystem } from '../events';

export class PluginOrchestrationServiceImpl implements PluginOrchestrator {
	private dependencies: PluginDependencies;
	private topTaskStatusBarItem: HTMLElement | null = null;
	private isTopTaskVisible: boolean = true;
	private eventListeners: (() => void)[] = [];
	private eventSystem: EventSystem;

	constructor(dependencies: PluginDependencies, eventSystem: EventSystem) {
		this.dependencies = dependencies;
		this.eventSystem = eventSystem;
	}

	async initialize(): Promise<void> {
		const { app, plugin, settingsService, checkboxFinderService, streamsService } = this.dependencies;
		
		// Set up UI elements
		await this.setupUI(app, plugin, settingsService);
		
		// Set up event listeners
		this.setupEventListeners();
		
		// Set up streams ready callback
		this.setupStreamsReadyCallback(app, streamsService);
		
		// Initialize top task status bar
		await this.updateTopTaskStatusBar();
	}

	async shutdown(): Promise<void> {
		// Clean up event listeners
		this.cleanupEventListeners();
		
		// Clean up UI elements
		if (this.topTaskStatusBarItem) {
			this.topTaskStatusBarItem.remove();
		}
	}

	getSettingsService(): SettingsService {
		return this.dependencies.settingsService;
	}

	getCheckboxFinderService(): CheckboxFinderService {
		return this.dependencies.checkboxFinderService;
	}

	getStreamsService(): StreamsService {
		return this.dependencies.streamsService;
	}

	async openOnTaskView(): Promise<void> {
		const { app } = this.dependencies;
		
		// Check if the view is already open
		const existingLeaf = app.workspace.getLeavesOfType(ONTASK_VIEW_TYPE)[0];
		
		if (existingLeaf) {
			// If already open, just reveal it
			app.workspace.revealLeaf(existingLeaf);
		} else {
			// Create a new leaf for the view
			const leaf = app.workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: ONTASK_VIEW_TYPE });
				app.workspace.revealLeaf(leaf);
			}
		}
		
		// Emit view opened event
		this.eventSystem.emit('ui:view-opened', { viewType: ONTASK_VIEW_TYPE });
	}

	async refreshOnTaskViews(): Promise<void> {
		const { app } = this.dependencies;
		const leaves = app.workspace.getLeavesOfType(ONTASK_VIEW_TYPE);
		
		for (const leaf of leaves) {
			if (leaf.view instanceof OnTaskView) {
				// Trigger a refresh of the view
				await (leaf.view as OnTaskView).refreshCheckboxes();
			}
		}
	}

	async updateTopTaskStatusBar(): Promise<void> {
		const { app, settingsService, checkboxFinderService } = this.dependencies;
		
		try {
			const settings = settingsService.getSettings();
			
			// Check if status bar is enabled
			if (!settings.showTopTaskInStatusBar) {
				if (this.topTaskStatusBarItem) {
					this.topTaskStatusBarItem.style.display = 'none';
				}
				this.eventSystem.emit('ui:status-bar-updated', { visible: false });
				return;
			}

			const checkboxes = await checkboxFinderService.findAllCheckboxes(settings.hideCompletedTasks, settings.onlyShowToday);
			const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
			
			// Emit checkboxes found event
			this.eventSystem.emit('checkboxes:found', { 
				count: checkboxes.length, 
				source: settings.checkboxSource 
			});
			
			if (topTask) {
				console.log('OnTask: Top task found, updating status bar', topTask);
				if (this.isTopTaskVisible) {
					const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
					const displayText = remainingText || 'Top Task';
					if (this.topTaskStatusBarItem) {
						this.topTaskStatusBarItem.setText(`🔥 ${displayText}`);
						console.log('OnTask: Status bar text set to:', `🔥 ${displayText}`);
					}
					this.eventSystem.emit('ui:status-bar-updated', { 
						visible: true, 
						text: `🔥 ${displayText}` 
					});
				} else {
					if (this.topTaskStatusBarItem) {
						this.topTaskStatusBarItem.setText('👁️');
						console.log('OnTask: Status bar text set to: 👁️');
					}
					this.eventSystem.emit('ui:status-bar-updated', { 
						visible: true, 
						text: '👁️' 
					});
				}
				
				// Apply color styling
				this.applyTopTaskColor(settings);
				if (this.topTaskStatusBarItem) {
					this.topTaskStatusBarItem.style.display = 'block';
					console.log('OnTask: Status bar displayed');
				}
			} else {
				console.log('OnTask: No top task found, showing placeholder');
				if (this.topTaskStatusBarItem) {
					this.topTaskStatusBarItem.setText('🔥 No top task');
					this.topTaskStatusBarItem.style.display = 'block';
				}
				this.eventSystem.emit('ui:status-bar-updated', { visible: true, text: '🔥 No top task' });
			}
		} catch (error) {
			console.error('Error updating top task status bar:', error);
			if (this.topTaskStatusBarItem) {
				this.topTaskStatusBarItem.style.display = 'none';
			}
			this.eventSystem.emit('plugin:error', { 
				error, 
				context: 'updateTopTaskStatusBar' 
			});
		}
	}

	setupEventListeners(): void {
		const { app, settingsService } = this.dependencies;
		
		// Listen for settings changes via event system
		const settingsSubscription = this.eventSystem.on('settings:changed', (event) => {
			// Handle specific setting changes
			switch (event.data.key) {
				case 'checkboxSource':
				case 'customFolderPath':
				case 'includeSubfolders':
					this.configureCheckboxSource();
					break;
				case 'showTopTaskInStatusBar':
					this.updateTopTaskStatusBar();
					break;
				case 'showTopTaskInEditor':
					// Editor integration service will handle this via its own event listener
					break;
			}
		});
		this.eventListeners.push(() => settingsSubscription.unsubscribe());

		// Listen for file modifications
		const fileModifyListener = (file: any) => {
			this.eventSystem.emit('file:modified', { path: file.path });
			this.updateTopTaskStatusBar();
		};
		app.vault.on('modify', fileModifyListener);
		this.eventListeners.push(() => app.vault.off('modify', fileModifyListener));

		// Listen for streams ready
		const streamsSubscription = this.eventSystem.on('streams:ready', () => {
			this.refreshOnTaskViews();
		});
		this.eventListeners.push(() => streamsSubscription.unsubscribe());

		// Emit plugin initialized event
		this.eventSystem.emit('plugin:initialized', {});
	}

	cleanupEventListeners(): void {
		this.eventListeners.forEach(cleanup => cleanup());
		this.eventListeners = [];
		
		// Emit plugin shutdown event
		this.eventSystem.emit('plugin:shutdown', {});
	}

	private async setupUI(app: App, plugin: Plugin, settingsService: SettingsService): Promise<void> {
		// Register the OnTaskView
		plugin.registerView(ONTASK_VIEW_TYPE, (leaf) => new OnTaskView(
			leaf, 
			this.dependencies.checkboxFinderService, 
			settingsService, 
			plugin,
			this.dependencies.eventSystem
		));

		// Add ribbon icon
		const ribbonIconEl = plugin.addRibbonIcon('checkmark', 'On Task', () => {
			this.openOnTaskView();
		});
		ribbonIconEl.addClass('on-task-ribbon-class');

		// Add top task status bar item
		this.topTaskStatusBarItem = plugin.addStatusBarItem();
		console.log('OnTask: Status bar item created', this.topTaskStatusBarItem);
		this.topTaskStatusBarItem.addClass('ontask-top-task-status');
		this.topTaskStatusBarItem.style.cursor = 'pointer';
		this.topTaskStatusBarItem.style.opacity = '0.7';
		this.topTaskStatusBarItem.style.pointerEvents = 'auto';
		this.topTaskStatusBarItem.style.zIndex = '1000';
		
		// Add event listeners
		this.topTaskStatusBarItem.addEventListener('click', () => {
			console.log('OnTask: Status bar clicked');
			this.toggleTopTaskVisibility();
		});
		
		this.topTaskStatusBarItem.addEventListener('contextmenu', (e) => {
			console.log('OnTask: contextmenu event triggered', e);
			e.preventDefault();
			e.stopPropagation();
			this.showColorMenu(e, settingsService);
		});
		
		// Also add mousedown event as backup for right-click
		this.topTaskStatusBarItem.addEventListener('mousedown', (e) => {
			if (e.button === 2) { // Right mouse button
				console.log('OnTask: Right mouse button pressed');
				e.preventDefault();
				e.stopPropagation();
				this.showColorMenu(e, settingsService);
			}
		});
		
		// Add mouseover event for testing
		this.topTaskStatusBarItem.addEventListener('mouseover', () => {
			console.log('OnTask: Status bar mouseover');
		});

		// Add commands
		this.addCommands(plugin);
	}

	private addCommands(plugin: Plugin): void {
		// Command to open OnTaskView
		plugin.addCommand({
			id: 'open-ontask-view',
			name: 'Open On Task view',
			callback: () => {
				this.openOnTaskView();
			}
		});

	}

	private setupStreamsReadyCallback(app: App, streamsService: StreamsService): void {
		// Wait for layout ready to ensure streams plugin is loaded
		app.workspace.onLayoutReady(() => {
			// Check if streams are available and refresh any open OnTaskView
			if (streamsService.isStreamsPluginAvailable()) {
				this.refreshOnTaskViews();
			}
		});
	}

	private configureCheckboxSource(): void {
		const { settingsService, checkboxFinderService } = this.dependencies;
		const settings = settingsService.getSettings();
		const strategies: string[] = [];
		
		switch (settings.checkboxSource) {
			case 'streams':
				strategies.push('streams');
				break;
			case 'daily-notes':
				strategies.push('daily-notes');
				break;
			case 'folder':
				// Create and register folder strategy if not already registered
				const folderStrategy = checkboxFinderService.createFolderStrategy(
					settings.customFolderPath,
					settings.includeSubfolders
				);
				checkboxFinderService.registerStrategy('custom-folder', folderStrategy);
				strategies.push('custom-folder');
				break;
		}
		
		checkboxFinderService.setActiveStrategies(strategies);
	}

	private toggleTopTaskVisibility(): void {
		this.isTopTaskVisible = !this.isTopTaskVisible;
		this.updateTopTaskStatusBar();
	}

	private showColorMenu(event: MouseEvent, settingsService: SettingsService): void {
		console.log('OnTask: showColorMenu called', event);
		event.preventDefault();
		
		// Remove any existing color menu
		const existingMenu = document.querySelector('.ontask-color-menu');
		if (existingMenu) {
			existingMenu.remove();
		}

		// Create a simple test menu first
		const testMenu = document.createElement('div');
		testMenu.textContent = 'TEST MENU - Right click working!';
		testMenu.style.position = 'fixed';
		testMenu.style.left = `${event.clientX}px`;
		testMenu.style.top = `${event.clientY}px`;
		testMenu.style.zIndex = '9999';
		testMenu.style.background = 'red';
		testMenu.style.color = 'white';
		testMenu.style.padding = '10px';
		testMenu.style.border = '2px solid black';
		document.body.appendChild(testMenu);
		
		// Remove test menu after 2 seconds
		setTimeout(() => {
			if (testMenu.parentNode) {
				testMenu.parentNode.removeChild(testMenu);
			}
		}, 2000);

		// Create color menu
		const menu = document.createElement('div');
		menu.className = 'ontask-color-menu';
		menu.style.position = 'fixed';
		menu.style.left = `${event.clientX - 200}px`;
		menu.style.top = `${event.clientY - 300}px`;
		menu.style.zIndex = '1000';
		menu.style.background = 'var(--background-primary)';
		menu.style.border = '1px solid var(--background-modifier-border)';
		menu.style.borderRadius = '6px';
		menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
		menu.style.padding = '8px';
		menu.style.minWidth = '200px';
		menu.style.maxHeight = '300px';
		menu.style.overflowY = 'auto';

		// Color options
		const colors = [
			{ name: 'Neutral', value: 'neutral', bg: 'transparent', text: 'var(--text-normal)' },
			{ name: 'Red', value: 'red', bg: '#ff6b6b', text: 'white' },
			{ name: 'Orange', value: 'orange', bg: '#ffa726', text: 'white' },
			{ name: 'Yellow', value: 'yellow', bg: '#ffeb3b', text: 'black' },
			{ name: 'Green', value: 'green', bg: '#66bb6a', text: 'white' },
			{ name: 'Blue', value: 'blue', bg: '#42a5f5', text: 'white' },
			{ name: 'Purple', value: 'purple', bg: '#ab47bc', text: 'white' },
			{ name: 'Pink', value: 'pink', bg: '#ec407a', text: 'white' },
			{ name: 'Teal', value: 'teal', bg: '#26a69a', text: 'white' },
			{ name: 'Indigo', value: 'indigo', bg: '#5c6bc0', text: 'white' }
		];

		// Add menu items
		for (const color of colors) {
			const menuItem = document.createElement('div');
			menuItem.className = 'ontask-color-menu-item';
			menuItem.style.padding = '8px 12px';
			menuItem.style.cursor = 'pointer';
			menuItem.style.display = 'flex';
			menuItem.style.alignItems = 'center';
			menuItem.style.gap = '8px';
			menuItem.style.fontSize = '14px';
			menuItem.style.color = 'var(--text-normal)';
			menuItem.style.borderRadius = '4px';

			// Add color preview
			const colorPreview = document.createElement('div');
			colorPreview.style.width = '16px';
			colorPreview.style.height = '16px';
			colorPreview.style.borderRadius = '50%';
			colorPreview.style.border = '2px solid var(--background-modifier-border)';
			colorPreview.style.backgroundColor = color.bg;
			colorPreview.style.flexShrink = '0';

			// Add color name
			const colorName = document.createElement('span');
			colorName.textContent = color.name;

			// Add checkmark if this is the current color
			const settings = settingsService.getSettings();
			if (settings.topTaskColor === color.value) {
				const checkmark = document.createElement('span');
				checkmark.textContent = '✓';
				checkmark.style.color = 'var(--text-accent)';
				checkmark.style.fontWeight = 'bold';
				checkmark.style.marginLeft = 'auto';
				menuItem.appendChild(checkmark);
			}

			menuItem.appendChild(colorPreview);
			menuItem.appendChild(colorName);

			// Add hover effect
			menuItem.addEventListener('mouseenter', () => {
				menuItem.style.background = 'var(--background-modifier-hover)';
			});
			menuItem.addEventListener('mouseleave', () => {
				menuItem.style.background = 'transparent';
			});

			// Add click handler
			menuItem.addEventListener('click', async () => {
				await settingsService.updateSetting('topTaskColor', color.value);
				this.updateTopTaskStatusBar();
				menu.remove();
			});

			menu.appendChild(menuItem);
		}

		// Add to document
		document.body.appendChild(menu);
		console.log('OnTask: Color menu added to DOM', menu);

		// Close menu when clicking outside
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu);
			}
		};

		// Use requestAnimationFrame to avoid immediate closure
		requestAnimationFrame(() => {
			document.addEventListener('click', closeMenu);
			console.log('OnTask: Color menu should now be visible');
		});
	}

	private applyTopTaskColor(settings: any): void {
		if (!this.topTaskStatusBarItem) return;

		const colorMap: { [key: string]: { bg: string; text: string } } = {
			neutral: { bg: 'transparent', text: 'var(--text-normal)' },
			red: { bg: '#ff6b6b', text: 'white' },
			orange: { bg: '#ffa726', text: 'white' },
			yellow: { bg: '#ffeb3b', text: 'black' },
			green: { bg: '#66bb6a', text: 'white' },
			blue: { bg: '#42a5f5', text: 'white' },
			purple: { bg: '#ab47bc', text: 'white' },
			pink: { bg: '#ec407a', text: 'white' },
			teal: { bg: '#26a69a', text: 'white' },
			indigo: { bg: '#5c6bc0', text: 'white' }
		};

		const color = colorMap[settings.topTaskColor] || colorMap.neutral;
		this.topTaskStatusBarItem.style.backgroundColor = color.bg;
		this.topTaskStatusBarItem.style.color = color.text;
		this.topTaskStatusBarItem.style.padding = '2px 8px';
		this.topTaskStatusBarItem.style.borderRadius = '4px';
		this.topTaskStatusBarItem.style.border = color.bg === 'transparent' ? '1px solid var(--background-modifier-border)' : 'none';
	}

	private parseCheckboxLine(line: string): { remainingText: string } {
		const trimmedLine = line.trim();
		
		// Look for checkbox pattern: - [ ] or - [x] or any other status
		const checkboxMatch = trimmedLine.match(/^-\s*\[([^\]]*)\]\s*(.*)$/);
		
		if (checkboxMatch) {
			const remainingText = checkboxMatch[2].trim();
			return { remainingText };
		}
		
		// Fallback if no match
		return { remainingText: '' };
	}
}
