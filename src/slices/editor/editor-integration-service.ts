// Editor integration slice - Service implementation
import { App, MarkdownView, WorkspaceLeaf, Editor, TFile } from 'obsidian';
import { EditorIntegrationService } from './editor-integration-interface';
import { SettingsService } from '../settings/settings-interface';
import { CheckboxFinderService } from '../../services/checkbox-finder/checkbox-finder-service';
import { EventSystem } from '../events/event-system-interface';

export class EditorIntegrationServiceImpl implements EditorIntegrationService {
	private app: App;
	private settingsService: SettingsService;
	private checkboxFinderService: CheckboxFinderService;
	private eventSystem: EventSystem;
	private topTaskOverlays: Map<string, HTMLElement> = new Map();
	private isInitialized: boolean = false;
	private currentTopTask: any = null;

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
			if (event.data.key === 'showTopTaskInEditor') {
				setTimeout(() => {
					this.updateEditorDecorations();
				}, 100);
			}
		});

		// Listen for checkbox updates to update decorations
		this.eventSystem.on('checkboxes:updated', () => {
			if (this.isEnabled()) {
				setTimeout(() => {
					this.updateEditorDecorations();
				}, 100);
			}
		});

		// Listen for file changes to update decorations
		this.eventSystem.on('file:modified', () => {
			if (this.isEnabled()) {
				setTimeout(() => {
					this.updateEditorDecorations();
				}, 50);
			}
		});

		// Listen for workspace changes to update decorations
		this.app.workspace.on('active-leaf-change', () => {
			setTimeout(() => {
				if (this.isEnabled()) {
					this.updateEditorDecorations();
				}
			}, 100);
		});

		this.isInitialized = true;

		// Initial update to show top task if setting is enabled
		if (this.isEnabled()) {
			setTimeout(() => {
				this.updateEditorDecorations();
			}, 200);
		}
	}

	async updateEditorDecorations(): Promise<void> {
		if (!this.isEnabled()) {
			this.cleanup();
			return;
		}

		try {
			const settings = this.settingsService.getSettings();
			const checkboxes = await this.checkboxFinderService.findAllCheckboxes(
				settings.hideCompletedTasks,
				settings.onlyShowToday
			);
			
			const topTask = checkboxes.find(checkbox => checkbox.isTopTask);
			console.log('OnTask Editor: Found top task:', topTask?.lineContent);
			
			// Check if we need to update
			const needsUpdate = !this.currentTopTask || 
				this.currentTopTask.lineContent !== topTask?.lineContent || 
				this.currentTopTask.file.path !== topTask?.file.path;
			
			if (!needsUpdate) {
				console.log('OnTask Editor: No update needed');
				return;
			}
			
			this.currentTopTask = topTask;
			
			// Clean up existing overlays
			this.cleanup();
			
			if (!topTask) {
				console.log('OnTask Editor: No top task found');
				return;
			}

			// Get all markdown views
			const markdownViews = this.app.workspace.getLeavesOfType('markdown');
			console.log('OnTask Editor: Found', markdownViews.length, 'markdown views');
			
			for (const leaf of markdownViews) {
				if (leaf.view instanceof MarkdownView) {
					await this.addTopTaskOverlay(leaf.view, topTask);
				}
			}
		} catch (error) {
			console.error('Error updating editor decorations:', error);
		}
	}

	private async addTopTaskOverlay(view: MarkdownView, topTask: any): Promise<void> {
		const editor = view.editor;
		if (!editor) return;

		// Get the view container
		const viewContainer = view.containerEl;
		if (!viewContainer) return;

		// Check if overlay already exists
		const existingOverlay = viewContainer.querySelector('.ontask-top-task-overlay');
		if (existingOverlay) {
			return; // Don't create duplicate
		}

		// Wait a bit to ensure DOM is stable
		await new Promise(resolve => setTimeout(resolve, 50));

		// Create top task bar element
		const topTaskBar = viewContainer.createEl('div', {
			cls: 'ontask-top-task-overlay',
			attr: {
				'data-top-task': 'true'
			}
		});

		// Create the top task content
		const { remainingText } = this.parseCheckboxLine(topTask.lineContent);
		const displayText = remainingText || 'Top Task';
		
		topTaskBar.innerHTML = `
			<div class="ontask-top-task-content">
				<span class="ontask-top-task-icon">🔥</span>
				<span class="ontask-top-task-text">${displayText}</span>
				<span class="ontask-top-task-source">From: ${topTask.file.name}</span>
			</div>
		`;

		// Find the streams bar and insert after it, or at the beginning if not found
		const streamsBar = viewContainer.querySelector('.streams-bar-component');
		if (streamsBar && streamsBar.nextSibling) {
			viewContainer.insertBefore(topTaskBar, streamsBar.nextSibling);
		} else {
			// Fallback: insert at the beginning
			viewContainer.insertBefore(topTaskBar, viewContainer.firstChild);
		}

		// Store overlay for cleanup
		const leafId = (view.leaf as any).id || view.file?.path;
		if (leafId) {
			this.topTaskOverlays.set(leafId, topTaskBar);
		}

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
		// Remove all overlays
		this.topTaskOverlays.forEach((overlay) => {
			if (overlay && overlay.parentNode) {
				overlay.remove();
			}
		});
		this.topTaskOverlays.clear();
	}

	isEnabled(): boolean {
		const settings = this.settingsService.getSettings();
		return settings.showTopTaskInEditor;
	}
}
