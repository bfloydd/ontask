// Editor integration slice - Service implementation
import { App, MarkdownView, WorkspaceLeaf, Editor, TFile } from 'obsidian';
import { EditorIntegrationService } from './editor-integration-interface';
import { SettingsService } from '../settings/settings-interface';
import { CheckboxFinderService } from '../checkbox-finder';
import { EventSystem } from '../events/event-system-interface';

export class EditorIntegrationServiceImpl implements EditorIntegrationService {
	private app: App;
	private settingsService: SettingsService;
	private checkboxFinderService: CheckboxFinderService;
	private eventSystem: EventSystem;
	private topTaskOverlays: Map<string, HTMLElement> = new Map();
	private isInitialized: boolean = false;
	private currentTopTask: any = null;
	private pendingDecorationUpdate: boolean = false;
	private updateRequestId: number | null = null;
	private topTaskMemory: any = null; // In-memory storage for current top task

	constructor(
		app: App,
		settingsService: SettingsService,
		checkboxFinderService: CheckboxFinderService,
		eventSystem: EventSystem
	) {
		this.app = app;
		this.settingsService = settingsService;
		this.checkboxFinderService = checkboxFinderService;
		this.eventSystem = eventSystem;
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) return;

		// Listen for settings changes
		this.eventSystem.on('settings:changed', (event) => {
			console.log('OnTask Editor: Settings changed event:', event.data.key);
			if (event.data.key === 'showTopTaskInEditor') {
				console.log('OnTask Editor: showTopTaskInEditor setting changed, scheduling update');
				this.scheduleDecorationUpdate();
			}
		});

		// Listen for top task found event from OnTask View
		this.eventSystem.on('top-task:found', (event) => {
			console.log('OnTask Editor: Top task found event received:', event.data.topTask);
			this.topTaskMemory = event.data.topTask;
			if (this.isEnabled()) {
				console.log('OnTask Editor: Editor enabled, scheduling update with top task from memory');
				this.scheduleDecorationUpdate();
			} else {
				console.log('OnTask Editor: Editor disabled, skipping update');
			}
		});

		// Listen for top task cleared event from OnTask View
		this.eventSystem.on('top-task:cleared', () => {
			console.log('OnTask Editor: Top task cleared event received');
			this.topTaskMemory = null;
			if (this.isEnabled()) {
				console.log('OnTask Editor: Editor enabled, scheduling cleanup');
				this.scheduleDecorationUpdate();
			} else {
				console.log('OnTask Editor: Editor disabled, skipping update');
			}
		});

		// Listen for checkbox updates to update decorations (fallback)
		this.eventSystem.on('checkboxes:updated', () => {
			console.log('OnTask Editor: Checkboxes updated event received');
			if (this.isEnabled()) {
				console.log('OnTask Editor: Editor enabled, scheduling update');
				this.scheduleDecorationUpdate();
			} else {
				console.log('OnTask Editor: Editor disabled, skipping update');
			}
		});

		// Note: File modification events are no longer needed since we use event-driven approach
		// The OnTask View will emit top-task:found or top-task:cleared events when needed

		// Note: Disabled active-leaf-change listener to prevent excessive updates
		// Editor decorations will be updated via file:modified events when checkboxes change

		// Note: Disabled file-open listener - editor decorations should only update
		// when checkbox content actually changes, not just because a file was opened

		// Note: Plugin initialization listener removed - we now rely on top-task events from OnTask View

		this.isInitialized = true;
		console.log('OnTask Editor: Editor integration initialized, waiting for top-task events from OnTask View');
	}

	/**
	 * Schedule a decoration update using requestAnimationFrame for better performance
	 * This prevents multiple rapid updates and batches them into a single update
	 */
	private scheduleDecorationUpdate(): void {
		console.log('OnTask Editor: scheduleDecorationUpdate called, pending:', this.pendingDecorationUpdate);
		
		if (this.pendingDecorationUpdate) {
			console.log('OnTask Editor: Update already pending, skipping');
			return; // Already scheduled
		}

		this.pendingDecorationUpdate = true;
		console.log('OnTask Editor: Scheduling decoration update');
		
		// Cancel any existing request
		if (this.updateRequestId !== null) {
			cancelAnimationFrame(this.updateRequestId);
		}

		this.updateRequestId = requestAnimationFrame(() => {
			console.log('OnTask Editor: Executing scheduled decoration update');
			this.pendingDecorationUpdate = false;
			this.updateRequestId = null;
			this.updateEditorDecorations();
		});
	}

	async updateEditorDecorations(): Promise<void> {
		console.log('OnTask Editor: updateEditorDecorations called, isEnabled:', this.isEnabled());
		if (!this.isEnabled()) {
			console.log('OnTask Editor: Editor integration disabled, cleaning up');
			this.cleanup();
			return;
		}

		try {
			// Use in-memory top task instead of re-scanning files
			const topTask = this.topTaskMemory;
			console.log('OnTask Editor: Using top task from memory:', !!topTask, topTask ? topTask.lineContent : 'none');
			
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

			console.log('OnTask Editor: Cleaning up existing overlays before adding new ones');
			// Clean up existing overlays before adding new ones
			this.cleanup();

			// Get all markdown views and add overlay to each one
			const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
			console.log('OnTask Editor: Found', markdownLeaves.length, 'markdown leaves');
			
			for (const leaf of markdownLeaves) {
				if (leaf.view instanceof MarkdownView) {
					console.log('OnTask Editor: Adding overlay to markdown view:', (leaf.view as any)?.file?.path);
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

		// Find the editor container within the markdown view
		const editorContainer = view.containerEl.querySelector('.markdown-source-view, .markdown-preview-view');
		if (!editorContainer) {
			console.log('OnTask Editor: No editor container found in markdown view, trying alternative selectors');
			// Try alternative selectors
			const altContainer = view.containerEl.querySelector('.cm-editor, .markdown-preview-section');
			if (altContainer) {
				console.log('OnTask Editor: Found alternative container:', altContainer.className);
				// Use the alternative container
				const topTaskBar = altContainer.createEl('div', {
					cls: 'ontask-toptask-hero-overlay',
					attr: {
						'data-top-task': 'true'
					}
				});
				
				const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
				const displayText = remainingText || 'Top Task';
				
				topTaskBar.innerHTML = `
					<div class="ontask-toptask-hero-content">
						<span class="ontask-toptask-hero-icon">🔥</span>
						<span class="ontask-toptask-hero-text">${displayText}</span>
						<span class="ontask-toptask-hero-source">From: ${topTask.file.name}</span>
					</div>
				`;
				
				altContainer.appendChild(topTaskBar);
				
				const overlayKey = view.file?.path || 'unknown';
				this.topTaskOverlays.set(overlayKey, topTaskBar);
				
				topTaskBar.addEventListener('click', () => {
					editor.focus();
				});
				return;
			} else {
				console.log('OnTask Editor: No suitable container found');
				return;
			}
		}

		console.log('OnTask Editor: Editor container found:', editorContainer);

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

		console.log('OnTask Editor: Set innerHTML, topTaskBar children count:', topTaskBar.children.length);

		// Insert at the bottom of the editor container
		console.log('OnTask Editor: Inserting overlay at bottom of editor container');
		editorContainer.appendChild(topTaskBar);

		console.log('OnTask Editor: After insertion - topTaskBar parent:', topTaskBar.parentElement);
		// Store overlay for cleanup using view path as key
		const overlayKey = view.file?.path || 'unknown';
		this.topTaskOverlays.set(overlayKey, topTaskBar);

		// Add click handler to focus the editor
		topTaskBar.addEventListener('click', () => {
			editor.focus();
		});
	}

	private parseCheckboxLine(line: string): { remainingText: string } {
		// Remove checkbox symbols and extract remaining text
		const checkboxPattern = /^\s*[-*+]\s*\[[ x]\]\s*/;
		const remainingText = line.replace(checkboxPattern, '').trim();
		return { remainingText };
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
				console.log('OnTask Editor: Removing stored overlay for key:', key);
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
	}

	isEnabled(): boolean {
		const settings = this.settingsService.getSettings();
		const enabled = settings.showTopTaskInEditor;
		console.log('OnTask Editor: isEnabled check - showTopTaskInEditor:', enabled);
		return enabled;
	}

	// Test method to manually trigger overlay creation
	async testOverlayCreation(): Promise<void> {
		
		// Create a test top task
		const testTopTask = {
			lineContent: '- [ ] Test task for debugging',
			file: { name: 'test.md', path: 'test.md' },
			isTopTask: true,
			isCompleted: false
		};

		// Get the active leaf
		const activeLeaf = this.app.workspace.activeLeaf;
		if (!activeLeaf || !(activeLeaf.view instanceof MarkdownView)) {
			console.log('OnTask Editor: TEST - No active markdown view found');
			return;
		}

		console.log('OnTask Editor: TEST - Found active markdown view, creating overlay');
		await this.addTopTaskOverlay(activeLeaf.view as MarkdownView, testTopTask);
	}
}
