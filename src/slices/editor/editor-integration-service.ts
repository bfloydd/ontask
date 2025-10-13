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
		if (!this.isEnabled()) {
			this.cleanup();
			return;
		}

		try {
			const settings = this.settingsService.getSettings();
			
			const checkboxes = await this.checkboxFinderService.findAllCheckboxes(
				settings.onlyShowToday
			);
			
			const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
			
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
					await this.addTopTaskOverlay(firstMarkdownLeaf.view as MarkdownView, topTask);
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

		// Find the workspace root container
		const workspaceRoot = document.querySelector('.workspace-split.mod-vertical.mod-root');
		if (!workspaceRoot) {
			return;
		}

		console.log('OnTask Editor: Workspace root found:', workspaceRoot);
		console.log('OnTask Editor: Workspace root classes:', workspaceRoot.className);
		console.log('OnTask Editor: Workspace root children count:', workspaceRoot.children.length);

		// Check if overlay already exists in the workspace root
		const existingOverlay = workspaceRoot.querySelector('.ontask-toptask-hero-overlay');
		if (existingOverlay) {
			return; // Don't create duplicate
		}

		// Create top task bar element
		const topTaskBar = workspaceRoot.createEl('div', {
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

		// Insert at the bottom of the workspace root (will be positioned at bottom due to flexbox)
		console.log('OnTask Editor: Inserting overlay at bottom of workspace root');
		workspaceRoot.appendChild(topTaskBar);

		console.log('OnTask Editor: After insertion - topTaskBar parent:', topTaskBar.parentElement);
		// Store overlay for cleanup using a fixed key since it's now global
		const overlayKey = 'workspace-root-overlay';
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

		// Also remove any orphaned overlays from workspace root
		const workspaceRoot = document.querySelector('.workspace-split.mod-vertical.mod-root');
		if (workspaceRoot) {
			const overlays = workspaceRoot.querySelectorAll('.ontask-toptask-hero-overlay');
			overlays.forEach((overlay: HTMLElement) => {
				overlay.remove();
			});
		}
	}

	isEnabled(): boolean {
		const settings = this.settingsService.getSettings();
		return settings.showTopTaskInEditor;
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
