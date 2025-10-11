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
	private lastUpdateTime: number = 0;
	private updateDebounceMs: number = 500; // Debounce updates by 500ms

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

		// Listen for checkbox updates to update decorations
		this.eventSystem.on('checkboxes:updated', () => {
			console.log('OnTask Editor: Checkboxes updated event received');
			if (this.isEnabled()) {
				console.log('OnTask Editor: Editor enabled, scheduling update');
				this.scheduleDecorationUpdate();
			} else {
				console.log('OnTask Editor: Editor disabled, skipping update');
			}
		});

		// Listen for file changes to update decorations
		this.eventSystem.on('file:modified', (event) => {
			console.log('OnTask Editor: File modified event:', event.data.path);
			// Skip processing for Streams files to avoid unnecessary updates
			if (event.data.path.includes('/Streams/') || event.data.path.includes('\\Streams\\')) {
				console.log('OnTask Editor: Skipping Streams file modification');
				return;
			}
			if (this.isEnabled() && event.data.path.endsWith('.md')) {
				console.log('OnTask Editor: Editor enabled, scheduling update');
				this.scheduleDecorationUpdate();
			} else {
				console.log('OnTask Editor: Editor disabled or non-markdown file, skipping update');
			}
		});

		// Note: Disabled active-leaf-change listener to prevent excessive updates
		// Editor decorations will be updated via file:modified events when checkboxes change

		// Note: Disabled file-open listener - editor decorations should only update
		// when checkbox content actually changes, not just because a file was opened

		// Listen for plugin initialization to trigger initial update
		this.eventSystem.on('plugin:initialized', () => {
			console.log('OnTask Editor: Plugin initialized event received');
			if (this.isEnabled()) {
				console.log('OnTask Editor: Editor enabled, scheduling update after plugin init');
				setTimeout(() => {
					this.scheduleDecorationUpdate();
				}, 200);
			}
		});

		this.isInitialized = true;

		// Wait for workspace to be ready before doing initial update
		if (this.isEnabled()) {
			console.log('OnTask Editor: Editor integration enabled, waiting for workspace ready');
			
			// Check if workspace is already ready
			if (this.app.workspace.layoutReady) {
				console.log('OnTask Editor: Workspace already ready, scheduling immediate update');
				setTimeout(() => {
					this.scheduleDecorationUpdate();
				}, 100);
			} else {
				console.log('OnTask Editor: Workspace not ready, waiting for layout ready event');
				this.app.workspace.onLayoutReady(() => {
					console.log('OnTask Editor: Workspace layout ready, scheduling initial update');
					// Add a small delay to ensure everything is fully loaded
					setTimeout(() => {
						this.scheduleDecorationUpdate();
					}, 100);
				});
			}
		}
	}

	/**
	 * Schedule a decoration update using requestAnimationFrame for better performance
	 * This prevents multiple rapid updates and batches them into a single update
	 */
	private scheduleDecorationUpdate(): void {
		const now = Date.now();
		
		// Debounce rapid-fire updates
		if (now - this.lastUpdateTime < this.updateDebounceMs) {
			console.log('OnTask Editor: Update debounced, skipping');
			return;
		}
		
		console.log('OnTask Editor: scheduleDecorationUpdate called, pending:', this.pendingDecorationUpdate);
		
		if (this.pendingDecorationUpdate) {
			console.log('OnTask Editor: Update already pending, skipping');
			return; // Already scheduled
		}

		this.pendingDecorationUpdate = true;
		this.lastUpdateTime = now;
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
		console.log('OnTask Editor: updateEditorDecorations called');
		
		if (!this.isEnabled()) {
			console.log('OnTask Editor: Editor integration disabled, cleaning up');
			this.cleanup();
			return;
		}

		console.log('OnTask Editor: Editor integration enabled, proceeding with update');
		console.log('OnTask Editor: Current workspace state - layoutReady:', this.app.workspace.layoutReady);
		console.log('OnTask Editor: Active leaf:', !!this.app.workspace.activeLeaf);
		console.log('OnTask Editor: Active leaf view type:', this.app.workspace.activeLeaf?.view?.getViewType());

		try {
			const settings = this.settingsService.getSettings();
			console.log('OnTask Editor: Settings:', { 
				hideCompleted: settings.hideCompletedTasks, 
				onlyShowToday: settings.onlyShowToday 
			});
			
			const checkboxes = await this.checkboxFinderService.findAllCheckboxes(
				settings.hideCompletedTasks,
				settings.onlyShowToday
			);
			
			console.log('OnTask Editor: Found', checkboxes.length, 'total checkboxes');
			const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
			console.log('OnTask Editor: Found top task:', topTask?.lineContent, 'in file:', topTask?.file?.path);
			
			// Check if we need to update
			const needsUpdate = !this.currentTopTask || 
				this.currentTopTask.lineContent !== topTask?.lineContent || 
				this.currentTopTask.file.path !== topTask?.file.path;
			
			console.log('OnTask Editor: Needs update:', needsUpdate, 'Current top task:', this.currentTopTask?.lineContent);
			
			if (!needsUpdate) {
				console.log('OnTask Editor: No update needed, current top task unchanged');
				return;
			}
			
			this.currentTopTask = topTask;
			
			if (!topTask) {
				console.log('OnTask Editor: No top task found, cleaning up overlays');
				// Clean up existing overlays only when there's no top task
				this.cleanup();
				return;
			}

			console.log('OnTask Editor: Cleaning up existing overlays before adding new ones');
			// Clean up existing overlays before adding new ones
			this.cleanup();

			// Get the active markdown view only
			const activeLeaf = this.app.workspace.activeLeaf;
			console.log('OnTask Editor: Active leaf:', activeLeaf?.view?.getViewType(), 'File:', (activeLeaf?.view as any)?.file?.path);
			
			if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
				console.log('OnTask Editor: Adding overlay to active markdown view');
				await this.addTopTaskOverlay(activeLeaf.view, topTask);
			} else {
				console.log('OnTask Editor: No active markdown view found, activeLeaf:', !!activeLeaf, 'isMarkdownView:', activeLeaf?.view instanceof MarkdownView);
				
				// If no active leaf, try to find any markdown view
				const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
				console.log('OnTask Editor: Found', markdownLeaves.length, 'markdown leaves');
				
				if (markdownLeaves.length > 0) {
					const firstMarkdownLeaf = markdownLeaves[0];
					console.log('OnTask Editor: Using first markdown leaf:', firstMarkdownLeaf.view?.getViewType(), 'File:', (firstMarkdownLeaf.view as any)?.file?.path);
					await this.addTopTaskOverlay(firstMarkdownLeaf.view as MarkdownView, topTask);
				} else {
					console.log('OnTask Editor: No markdown leaves found, will retry when a markdown view opens');
				}
			}
		} catch (error) {
			console.error('Error updating editor decorations:', error);
		}
	}

	private async addTopTaskOverlay(view: MarkdownView, topTask: any): Promise<void> {
		console.log('OnTask Editor: addTopTaskOverlay called for file:', view.file?.path);
		console.log('OnTask Editor: Top task data:', topTask);
		
		const editor = view.editor;
		if (!editor) {
			console.log('OnTask Editor: No editor found, returning');
			return;
		}

		// Find the workspace root container
		const workspaceRoot = document.querySelector('.workspace-split.mod-vertical.mod-root');
		if (!workspaceRoot) {
			console.log('OnTask Editor: No workspace root found, returning');
			return;
		}

		console.log('OnTask Editor: Workspace root found:', workspaceRoot);
		console.log('OnTask Editor: Workspace root classes:', workspaceRoot.className);
		console.log('OnTask Editor: Workspace root children count:', workspaceRoot.children.length);

		// Check if overlay already exists in the workspace root
		const existingOverlay = workspaceRoot.querySelector('.ontask-top-task-overlay');
		if (existingOverlay) {
			console.log('OnTask Editor: Overlay already exists in workspace root, skipping');
			return; // Don't create duplicate
		}

		console.log('OnTask Editor: Creating new overlay for top task:', topTask.lineContent);

		// Create top task bar element
		const topTaskBar = workspaceRoot.createEl('div', {
			cls: 'ontask-top-task-overlay',
			attr: {
				'data-top-task': 'true'
			}
		});

		console.log('OnTask Editor: Created topTaskBar element:', topTaskBar);
		console.log('OnTask Editor: topTaskBar classes:', topTaskBar.className);
		console.log('OnTask Editor: topTaskBar parent:', topTaskBar.parentElement);

		// Create the top task content
		const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
		const displayText = remainingText || 'Top Task';
		
		console.log('OnTask Editor: Parsed checkbox line - remainingText:', remainingText, 'displayText:', displayText);
		
		topTaskBar.innerHTML = `
			<div class="ontask-top-task-content">
				<span class="ontask-top-task-icon">🔥</span>
				<span class="ontask-top-task-text">${displayText}</span>
				<span class="ontask-top-task-source">From: ${topTask.file.name}</span>
			</div>
		`;

		console.log('OnTask Editor: Set innerHTML, topTaskBar children count:', topTaskBar.children.length);

		// Insert at the bottom of the workspace root (will be positioned at bottom due to flexbox)
		console.log('OnTask Editor: Inserting overlay at bottom of workspace root');
		workspaceRoot.appendChild(topTaskBar);

		console.log('OnTask Editor: After insertion - topTaskBar parent:', topTaskBar.parentElement);
		console.log('OnTask Editor: After insertion - topTaskBar is in DOM:', document.contains(topTaskBar));
		console.log('OnTask Editor: After insertion - workspaceRoot children count:', workspaceRoot.children.length);

		// Store overlay for cleanup using a fixed key since it's now global
		const overlayKey = 'workspace-root-overlay';
		this.topTaskOverlays.set(overlayKey, topTaskBar);
		console.log('OnTask Editor: Stored overlay with key:', overlayKey);

		// Add click handler to focus the editor
		topTaskBar.addEventListener('click', () => {
			console.log('OnTask Editor: Top task bar clicked, focusing editor');
			editor.focus();
		});

		console.log('OnTask Editor: Overlay creation completed successfully');
	}

	private parseCheckboxLine(line: string): { remainingText: string } {
		// Remove checkbox symbols and extract remaining text
		const checkboxPattern = /^\s*[-*+]\s*\[[ x]\]\s*/;
		const remainingText = line.replace(checkboxPattern, '').trim();
		return { remainingText };
	}

	cleanup(): void {
		console.log('OnTask Editor: cleanup called, removing', this.topTaskOverlays.size, 'stored overlays');
		
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

		// Also remove any orphaned overlays from workspace root
		const workspaceRoot = document.querySelector('.workspace-split.mod-vertical.mod-root');
		if (workspaceRoot) {
			const overlays = workspaceRoot.querySelectorAll('.ontask-top-task-overlay');
			overlays.forEach((overlay: HTMLElement) => {
				console.log('OnTask Editor: Removing orphaned overlay from workspace root');
				overlay.remove();
			});
		}

		console.log('OnTask Editor: Cleanup completed');
	}

	isEnabled(): boolean {
		const settings = this.settingsService.getSettings();
		return settings.showTopTaskInEditor;
	}

	// Test method to manually trigger overlay creation
	async testOverlayCreation(): Promise<void> {
		console.log('OnTask Editor: TEST - Manual overlay creation triggered');
		
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
