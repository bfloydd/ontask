// Editor integration service
import { App, MarkdownView, Plugin } from 'obsidian';
import { EditorIntegrationService } from './EditorIntegrationServiceInterface';
import { SettingsService } from '../settings/SettingsServiceInterface';
import { TaskLoadingService } from '../ontask-view/services/task-loading-service';
import { EventSystem } from '../events/EventSystemInterface';
import { PluginAwareSliceService } from '../../shared/base-slice';
import { Logger } from '../logging/Logger';

export class EditorIntegrationServiceImpl extends PluginAwareSliceService implements EditorIntegrationService {
	private app: App;
	private settingsService: SettingsService;
	private taskLoadingService: TaskLoadingService;
	private eventSystem: EventSystem;
	private logger: Logger;
	private topTaskOverlays: Map<string, HTMLElement> = new Map();
	private currentTopTask: any = null;
	private pendingDecorationUpdate: boolean = false;
	private updateRequestId: number | null = null;
	private topTaskMemory: any = null; // In-memory storage for current top task

	constructor(
		app: App,
		settingsService: SettingsService,
		taskLoadingService: TaskLoadingService,
		eventSystem: EventSystem,
		plugin: Plugin,
		logger: Logger
	) {
		super();
		this.app = app;
		this.settingsService = settingsService;
		this.taskLoadingService = taskLoadingService;
		this.eventSystem = eventSystem;
		this.logger = logger;
		this.setPlugin(plugin);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Listen for settings changes
		this.eventSystem.on('settings:changed', (event) => {
			this.logger.debug('[OnTask Editor] Settings changed event received:', event.data);
			if (event.data.key === 'showTopTaskInEditor') {
				this.logger.debug('[OnTask Editor] showTopTaskInEditor setting changed, scheduling decoration update');
				this.scheduleDecorationUpdate();
			}
		});

		// Listen for top task found event from OnTask View
		this.eventSystem.on('top-task:found', (event) => {
			this.logger.debug('[OnTask Editor] Top task found event received:', event.data);
			this.topTaskMemory = event.data.topTask;
			if (this.isEnabled()) {
				this.logger.debug('[OnTask Editor] Editor integration enabled, scheduling decoration update');
				this.scheduleDecorationUpdate();
			} else {
				this.logger.debug('[OnTask Editor] Editor integration disabled, ignoring top task found event');
			}
		});

		// Listen for top task cleared event from OnTask View
		this.eventSystem.on('top-task:cleared', () => {
			this.logger.debug('[OnTask Editor] Top task cleared event received');
			this.topTaskMemory = null;
			if (this.isEnabled()) {
				this.logger.debug('[OnTask Editor] Editor integration enabled, scheduling decoration update');
				this.scheduleDecorationUpdate();
			} else {
				this.logger.debug('[OnTask Editor] Editor integration disabled, ignoring top task cleared event');
			}
		});

		// Listen for checkbox updates to update decorations (fallback)
		this.eventSystem.on('checkboxes:updated', () => {
			this.logger.debug('[OnTask Editor] Checkboxes updated event received');
			if (this.isEnabled()) {
				this.logger.debug('[OnTask Editor] Editor integration enabled, scheduling decoration update');
				this.scheduleDecorationUpdate();
			} else {
				this.logger.debug('[OnTask Editor] Editor integration disabled, ignoring checkboxes updated event');
			}
		});

		// Editor events disabled - no longer listening for file modifications or active leaf changes

		this.initialized = true;
		
		// Initial check for top task if editor is enabled
		if (this.isEnabled()) {
			setTimeout(() => {
				this.findTopTaskIndependently();
			}, 1000);
		}
	}

	/**
	 * Schedule a decoration update using requestAnimationFrame for better performance
	 * This prevents multiple rapid updates and batches them into a single update
	 */
	private scheduleDecorationUpdate(): void {
		if (this.pendingDecorationUpdate) {
			return; // Already scheduled
		}

		this.pendingDecorationUpdate = true;
		
		// Cancel any existing request
		if (this.updateRequestId !== null) {
			cancelAnimationFrame(this.updateRequestId);
		}

		this.updateRequestId = requestAnimationFrame(() => {
			this.pendingDecorationUpdate = false;
			this.updateRequestId = null;
			this.updateEditorDecorations();
		});
	}

	async updateEditorDecorations(): Promise<void> {
		if (!this.isEnabled()) {
			this.cleanup();
			return;
		}

		try {
			// Use in-memory top task instead of re-scanning files
			const topTask = this.topTaskMemory;
			
			// Check if we need to update
			const needsUpdate = !this.currentTopTask || 
				this.currentTopTask.lineContent !== topTask?.lineContent || 
				this.currentTopTask.file.path !== topTask?.file.path;
			
			if (!needsUpdate) {
				return;
			}
			
			this.currentTopTask = topTask;
			
			if (!topTask) {
				// Clean up existing overlays only when there's no top task
				this.cleanup();
				return;
			}

			// Clean up existing overlays before adding new ones
			this.cleanup();

			// Get all markdown views and add overlay to each one
			const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
			
			if (markdownLeaves.length === 0) {
				// Schedule a retry after a short delay
				setTimeout(() => {
					this.scheduleDecorationUpdate();
				}, 1000);
				return;
			}
			
			for (const leaf of markdownLeaves) {
				if (leaf.view instanceof MarkdownView) {
					// Add a small delay to ensure the view is fully rendered
					await new Promise(resolve => setTimeout(resolve, 100));
					await this.addTopTaskOverlay(leaf.view, topTask);
				}
			}
		} catch (error) {
			console.error('Error updating editor decorations:', error);
		}
	}

	private async addTopTaskOverlay(view: MarkdownView, topTask: any): Promise<void> {
		const editor = view.editor;
		if (!editor) {
			return;
		}

		// Try multiple container selectors in order of preference
		const containerSelectors = [
			'.markdown-source-view',
			'.markdown-preview-view', 
			'.cm-editor',
			'.markdown-preview-section',
			'.workspace-leaf-content',
			'.view-content'
		];

		let editorContainer: HTMLElement | null = null;

		for (const selector of containerSelectors) {
			editorContainer = view.containerEl.querySelector(selector);
			if (editorContainer) {
				break;
			}
		}

		if (!editorContainer) {
			return;
		}

		// Check if overlay already exists in this editor
		const existingOverlay = editorContainer.querySelector('.ontask-toptask-hero-overlay');
		if (existingOverlay) {
			return; // Don't create duplicate
		}

		// Create top task bar element
		const topTaskBar = editorContainer.createEl('div', {
			cls: 'ontask-toptask-hero-overlay',
			attr: {
				'data-top-task': 'true'
			}
		});

		// Create the top task content
		const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
		const displayText = remainingText || 'Top Task';
		
		topTaskBar.innerHTML = `
			<div class="ontask-toptask-hero-content">
				<span class="ontask-toptask-hero-icon">🔥</span>
				<span class="ontask-toptask-hero-text">${displayText}</span>
				<span class="ontask-toptask-hero-source">From: ${topTask.file.name}</span>
			</div>
		`;

		// Insert at the bottom of the editor container
		editorContainer.appendChild(topTaskBar);
		
		// Store overlay for cleanup using view path as key
		const overlayKey = view.file?.path || 'unknown';
		this.topTaskOverlays.set(overlayKey, topTaskBar);

		// Add click handler to focus the editor
		topTaskBar.addEventListener('click', () => {
			editor.focus();
		});
	}

	private parseCheckboxLine(line: string): { remainingText: string } {
		const trimmedLine = line.trim();
		
		// Simple approach: find the first occurrence of ']' and take everything after it
		const bracketIndex = trimmedLine.indexOf(']');
		if (bracketIndex !== -1) {
			const remainingText = trimmedLine.substring(bracketIndex + 1).trim();
			return { remainingText };
		}
		
		// Fallback: return the original line if no bracket found
		return { remainingText: trimmedLine };
	}

	cleanup(): void {
		
		// Cancel any pending animation frame
		if (this.updateRequestId !== null) {
			cancelAnimationFrame(this.updateRequestId);
			this.updateRequestId = null;
		}
		this.pendingDecorationUpdate = false;

		// Remove all stored overlays
		this.topTaskOverlays.forEach((overlay, key) => {
			if (overlay && overlay.parentNode) {
				overlay.remove();
			}
		});
		this.topTaskOverlays.clear();

		// Also remove any orphaned overlays from all editor containers
		const editorContainers = document.querySelectorAll('.markdown-source-view, .markdown-preview-view');
		editorContainers.forEach(container => {
			const overlays = container.querySelectorAll('.ontask-toptask-hero-overlay');
			overlays.forEach((overlay: HTMLElement) => {
				overlay.remove();
			});
		});
		
		this.initialized = false;
	}

	isEnabled(): boolean {
		const settings = this.settingsService.getSettings();
		return settings.showTopTaskInEditor;
	}

	/**
	 * Find top task independently without relying on OnTask View
	 */
	private async findTopTaskIndependently(): Promise<void> {
		try {
			const settings = this.settingsService.getSettings();
			
			// Initialize file tracking for efficient task loading
			await this.taskLoadingService.initializeFileTracking(settings.onlyShowToday);
			const checkboxes = await this.taskLoadingService.loadTasksWithFiltering(settings);
			
			// Process top tasks using the same logic as OnTask View
			// We need to manually process the top tasks since we're not going through OnTask View
			this.processTopTasks(checkboxes);
			
			// Find the top task after processing
			const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
			
			if (topTask) {
				this.topTaskMemory = topTask;
				this.scheduleDecorationUpdate();
			} else {
				this.topTaskMemory = null;
				this.scheduleDecorationUpdate();
			}
		} catch (error) {
			console.error('OnTask Editor: Error finding top task independently:', error);
		}
	}

	/**
	 * Process top tasks using the same logic as TopTaskProcessingService
	 */
	private processTopTasks(checkboxes: any[]): void {
		// First, clear any existing top task markers
		checkboxes.forEach(checkbox => {
			checkbox.isTopTask = false;
			checkbox.isTopTaskContender = false;
		});
		
		// Top task configuration - same as TopTaskProcessingService
		const TOP_TASK_CONFIG = [
			{ symbol: '/', name: 'In Progress', pattern: /^\s*-\s*\[\/\]\s.*/ },
			{ symbol: '!', name: 'Important', pattern: /^\s*-\s*\[!\]\s.*/ },
			{ symbol: '+', name: 'Next', pattern: /^\s*-\s*\[\+\]\s.*/ }
		];
		
		// Find tasks for each priority level
		const tasksByType: Record<string, any[]> = {};
		
		TOP_TASK_CONFIG.forEach(config => {
			const matchingTasks = checkboxes.filter(checkbox => this.isTopTaskByConfig(checkbox, config));
			tasksByType[config.name] = matchingTasks;
		});
		
		// Find the highest priority task type that has tasks
		let finalTopTask: any = null;
		for (const config of TOP_TASK_CONFIG) {
			const tasks = tasksByType[config.name];
			if (tasks.length > 0) {
				// Sort by file modification time (most recent first)
				tasks.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				finalTopTask = tasks[0];
				finalTopTask.isTopTask = true;
				break;
			}
		}
	}

	/**
	 * Check if a checkbox matches the top task configuration
	 */
	private isTopTaskByConfig(checkbox: any, config: { symbol: string; name: string; pattern: RegExp }): boolean {
		return config.pattern.test(checkbox.lineContent);
	}

}
