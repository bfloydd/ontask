/**
 * @jest-environment jsdom
 */

// Integration tests for in-place checkbox status updates
// These tests verify that updateCheckboxRowInPlace works correctly without full refresh

// Mock Logger before imports
jest.mock('../../logging/Logger', () => ({
	Logger: {
		getInstance: jest.fn(() => ({
			debug: jest.fn(),
			warn: jest.fn(),
			info: jest.fn(),
			error: jest.fn()
		}))
	}
}));

import { OnTaskViewImpl } from '../OnTaskView';
import { TFile, WorkspaceLeaf } from 'obsidian';
import { SettingsService } from '../../settings';
import { StatusConfigService } from '../../settings/status-config';
import { DataService } from '../../data/DataServiceInterface';
import { EventSystem } from '../../events';
import { Logger } from '../../logging/Logger';
import { TaskLoadingService } from '../services/task-loading-service';
import { TopTaskProcessingService } from '../services/top-task-processing-service';

describe('updateCheckboxRowInPlace - Integration Tests', () => {
	let view: OnTaskViewImpl;
	let mockContentArea: HTMLElement;
	let mockSettingsService: jest.Mocked<SettingsService>;
	let mockStatusConfigService: jest.Mocked<StatusConfigService>;
	let mockDataService: jest.Mocked<DataService>;
	let mockEventSystem: jest.Mocked<EventSystem>;
	let mockLogger: jest.Mocked<Logger>;
	let mockTaskLoadingService: jest.Mocked<TaskLoadingService>;
	let mockLeaf: WorkspaceLeaf;
	let mockPlugin: any;
	let mockApp: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Polyfill Obsidian's HTMLElement extensions for jsdom
		if (!HTMLElement.prototype.addClass) {
			HTMLElement.prototype.addClass = function(className: string) {
				this.classList.add(className);
			} as any;
		}
		if (!HTMLElement.prototype.removeClass) {
			HTMLElement.prototype.removeClass = function(className: string) {
				this.classList.remove(className);
			} as any;
		}
		if (!HTMLElement.prototype.createDiv) {
			HTMLElement.prototype.createDiv = function(className?: string): HTMLElement {
				const div = document.createElement('div');
				if (className) {
					div.className = className;
				}
				this.appendChild(div);
				return div;
			} as any;
		}
		if (!HTMLElement.prototype.createEl) {
			HTMLElement.prototype.createEl = function(tag: string, options?: { text?: string; cls?: string }): HTMLElement {
				const el = document.createElement(tag);
				if (options?.text) {
					el.textContent = options.text;
				}
				if (options?.cls) {
					el.className = options.cls;
				}
				this.appendChild(el);
				return el;
			} as any;
		}

		// Setup DOM environment
		document.body.innerHTML = '';
		mockContentArea = document.createElement('div');
		mockContentArea.className = 'ontask-content';
		document.body.appendChild(mockContentArea);
		
		// Setup mock App
		mockApp = {
			vault: {
				getAbstractFileByPath: jest.fn(),
				read: jest.fn()
			},
			workspace: {
				getActiveViewOfType: jest.fn()
			},
			setting: {
				open: jest.fn(),
				openTabById: jest.fn()
			}
		} as any;

		// Mock SettingsService
		mockSettingsService = {
			getSettings: jest.fn().mockReturnValue({
				loadMoreLimit: 10,
				onlyShowToday: false,
				topTaskColor: '#ff0000',
				useThemeDefaultColor: false
			})
		} as any;

		// Mock StatusConfigService with realistic status configs
		const mockStatusConfigs = [
			{ symbol: ' ', name: 'To-do', color: '#6b7280', backgroundColor: 'transparent' },
			{ symbol: 'x', name: 'Completed', color: '#10b981', backgroundColor: 'transparent' },
			{ symbol: '!', name: 'Important', color: '#ef4444', backgroundColor: 'transparent', topTaskRanking: 2 },
			{ symbol: '/', name: 'In Progress', color: '#3b82f6', backgroundColor: 'transparent', topTaskRanking: 1 },
			{ symbol: '+', name: 'In Progress Alt', color: '#8b5cf6', backgroundColor: 'transparent', topTaskRanking: 3 },
			{ symbol: 'CUSTOM', name: 'Custom Status', color: '#f59e0b', backgroundColor: '#fef3c7' }
		];

		mockStatusConfigService = {
			getStatusConfigs: jest.fn().mockReturnValue(mockStatusConfigs),
			getStatusConfig: jest.fn((symbol: string) => 
				mockStatusConfigs.find(c => c.symbol === symbol)
			),
			getStatusColor: jest.fn((symbol: string) => {
				const config = mockStatusConfigs.find(c => c.symbol === symbol);
				return config?.color || '#6b7280';
			}),
			getStatusBackgroundColor: jest.fn((symbol: string) => {
				const config = mockStatusConfigs.find(c => c.symbol === symbol);
				return config?.backgroundColor || 'transparent';
			}),
			getStatusFilters: jest.fn().mockReturnValue({ ' ': true, 'x': true, '!': true, '/': true, '+': true, 'CUSTOM': true })
		} as any;

		// Mock DataService
		mockDataService = {
			getStatusConfigs: jest.fn().mockReturnValue(mockStatusConfigs),
			getStatusConfig: jest.fn((symbol: string) => 
				mockStatusConfigs.find(c => c.symbol === symbol)
			),
			getQuickFilters: jest.fn().mockReturnValue([])
		} as any;

		// Mock EventSystem
		mockEventSystem = {
			emit: jest.fn(),
			on: jest.fn(() => ({ unsubscribe: jest.fn() }))
		} as any;

		// Mock Logger
		mockLogger = {
			debug: jest.fn(),
			warn: jest.fn(),
			info: jest.fn(),
			error: jest.fn()
		} as any;

		// Mock TaskLoadingService
		mockTaskLoadingService = {
			resetTracking: jest.fn(),
			initializeFileTracking: jest.fn().mockResolvedValue(undefined),
			loadTasksWithFiltering: jest.fn().mockResolvedValue({ tasks: [], hasMoreTasks: false }),
			getStreamsService: jest.fn().mockReturnValue(null)
		} as any;

		// Mock WorkspaceLeaf
		mockLeaf = {
			view: null
		} as any;

		// Mock Plugin
		mockPlugin = {
			manifest: { id: 'ontask' }
		};

		// Create view instance with mocked dependencies
		view = new OnTaskViewImpl(
			mockLeaf,
			mockTaskLoadingService,
			mockSettingsService,
			mockStatusConfigService,
			mockDataService,
			mockPlugin,
			mockEventSystem,
			mockLogger
		);

		// Manually set contentEl and app to our mocks
		(view as any).contentEl = document.createElement('div');
		(view as any).contentEl.appendChild(mockContentArea);
		(view as any).app = mockApp;
		
		// Initialize lastCheckboxContent map
		(view as any).lastCheckboxContent = new Map();
	});

	function createCheckboxElement(checkbox: any): HTMLElement {
		const checkboxEl = document.createElement('div');
		checkboxEl.className = 'ontask-checkbox-item';
		if (checkbox.isTopTask) {
			checkboxEl.addClass('ontask-toptask-hero');
		}
		checkboxEl.setAttribute('data-file-path', checkbox.file.path);
		checkboxEl.setAttribute('data-line-number', checkbox.lineNumber.toString());

		const checkboxContainer = document.createElement('div');
		checkboxContainer.className = 'ontask-checkbox-label';

		const statusDisplay = document.createElement('div');
		statusDisplay.className = 'ontask-checkbox-display';
		const { statusSymbol } = parseCheckboxLine(checkbox.lineContent);
		statusDisplay.setAttribute('data-status', statusSymbol);
		statusDisplay.textContent = statusSymbol;

		const statusColor = mockStatusConfigService.getStatusColor(statusSymbol);
		const statusBackgroundColor = mockStatusConfigService.getStatusBackgroundColor(statusSymbol);
		statusDisplay.style.setProperty('--ontask-status-color', statusColor);
		statusDisplay.style.setProperty('--ontask-status-background-color', statusBackgroundColor);

		const textEl = document.createElement('span');
		textEl.className = 'ontask-checkbox-text';
		const { remainingText } = parseCheckboxLine(checkbox.lineContent);
		textEl.textContent = remainingText;

		if (checkbox.topTaskRanking !== undefined) {
			const rankingEl = document.createElement('span');
			rankingEl.className = 'ontask-task-ranking';
			rankingEl.textContent = `Rank ${checkbox.topTaskRanking}`;
			rankingEl.setAttribute('data-rank', checkbox.topTaskRanking.toString());
			textEl.appendChild(rankingEl);
		}

		checkboxContainer.appendChild(statusDisplay);
		checkboxContainer.appendChild(textEl);
		checkboxEl.appendChild(checkboxContainer);
		return checkboxEl;
	}

	function parseCheckboxLine(line: string): { statusSymbol: string; remainingText: string } {
		const trimmedLine = line.trim();
		const bracketIndex = trimmedLine.indexOf(']');
		if (bracketIndex !== -1) {
			const statusSymbol = trimmedLine.substring(0, bracketIndex).replace(/^-\s*\[/, '').trim() || ' ';
			const remainingText = trimmedLine.substring(bracketIndex + 1).trim();
			return { statusSymbol, remainingText };
		}
		return { statusSymbol: ' ', remainingText: trimmedLine };
	}

	function createMockCheckbox(filePath: string, lineNumber: number, lineContent: string, isTopTask: boolean = false, topTaskRanking?: number): any {
		// Create TFile with proper constructor signature
		const file = new (TFile as any)(filePath, filePath, Date.now());
		// Ensure file has stat properties for top task processing
		if (!file.stat) {
			file.stat = { mtime: Date.now() } as any;
		}
		return {
			file,
			lineNumber,
			lineContent,
			isTopTask,
			topTaskRanking
		};
	}

	describe('Scenario 1: Verify updated row matches what full refresh would show', () => {
		it('should update status display text and data-status attribute correctly', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [!] Important task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [x] Completed task');

			// Assert
			const updatedStatusDisplay = mockContentArea.querySelector('.ontask-checkbox-display');
			expect(updatedStatusDisplay?.getAttribute('data-status')).toBe('x');
			expect(updatedStatusDisplay?.textContent).toBe('x');
			
			const updatedText = mockContentArea.querySelector('.ontask-checkbox-text');
			// Note: x status doesn't have topTaskRanking, so no ranking badge should be added
			expect(updatedText?.textContent).toBe('Completed task');
		});

		it('should update CSS custom properties for colors correctly', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [ ] Regular task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [CUSTOM] Custom status task');

			// Assert
			const updatedStatusDisplay = mockContentArea.querySelector('.ontask-checkbox-display') as HTMLElement;
			expect(updatedStatusDisplay?.style.getPropertyValue('--ontask-status-color')).toBe('#f59e0b');
			expect(updatedStatusDisplay?.style.getPropertyValue('--ontask-status-background-color')).toBe('#fef3c7');
		});

		it('should update checkbox lineContent property', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [ ] Old task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [x] Completed task');

			// Assert
			expect(checkbox.lineContent).toBe('- [x] Completed task');
		});
	});

	describe('Scenario 2: Test with top task status changes', () => {
		it('should update top task section when a task becomes the top task', () => {
			// Arrange
			const regularTask = createMockCheckbox('test.md', 5, '- [ ] Regular task');
			const existingTopTask = createMockCheckbox('other.md', 10, '- [/] Current top task', true, 1);
			(view as any).checkboxes = [regularTask, existingTopTask];
			
			// Set existing top task as current
			existingTopTask.isTopTask = true;
			existingTopTask.topTaskRanking = 1;
			
			const regularTaskEl = createCheckboxElement(regularTask);
			const topTaskEl = createCheckboxElement(existingTopTask);
			mockContentArea.appendChild(topTaskEl);
			mockContentArea.appendChild(regularTaskEl);

			// Create top task section
			const topTaskSection = document.createElement('div');
			topTaskSection.className = 'ontask-toptask-hero-section';
			const topTaskStatusDisplay = document.createElement('div');
			topTaskStatusDisplay.className = 'ontask-checkbox-display';
			topTaskStatusDisplay.setAttribute('data-status', '/');
			topTaskSection.appendChild(topTaskStatusDisplay);
			mockContentArea.insertBefore(topTaskSection, mockContentArea.firstChild);

			// Mock updateTopTaskSection to verify it's called
			const updateTopTaskSectionSpy = jest.spyOn((view as any).domRenderingService, 'updateTopTaskSection');

			// Act - Change regular task to top task status (/) which has higher priority (ranking 1)
			regularTask.lineContent = '- [/] New top task';
			view['updateCheckboxRowInPlace'](regularTask, '- [/] New top task');

			// Assert - Top task section should be updated
			expect(updateTopTaskSectionSpy).toHaveBeenCalled();
		});

		it('should remove top task class and ranking badge when task loses top task status', () => {
			// Arrange
			const topTask = createMockCheckbox('test.md', 5, '- [/] Top task', true, 1);
			topTask.isTopTask = true;
			topTask.topTaskRanking = 1;
			(view as any).checkboxes = [topTask];
			
			const topTaskEl = createCheckboxElement(topTask);
			mockContentArea.appendChild(topTaskEl);

			// Verify initial state has ranking badge
			const initialRanking = topTaskEl.querySelector('.ontask-task-ranking');
			expect(initialRanking).toBeTruthy();
			expect(topTaskEl.classList.contains('ontask-toptask-hero')).toBe(true);

			// Act - Change to non-ranked status
			view['updateCheckboxRowInPlace'](topTask, '- [x] Completed task');

			// Assert
			const updatedRanking = topTaskEl.querySelector('.ontask-task-ranking');
			expect(updatedRanking).toBeNull();
			expect(topTaskEl.classList.contains('ontask-toptask-hero')).toBe(false);
			expect(topTask.topTaskRanking).toBeUndefined();
		});

		it('should add top task class and ranking badge when task gains top task status', () => {
			// Arrange
			const regularTask = createMockCheckbox('test.md', 5, '- [ ] Regular task');
			(view as any).checkboxes = [regularTask];
			
			const regularTaskEl = createCheckboxElement(regularTask);
			mockContentArea.appendChild(regularTaskEl);

			// Verify initial state has no ranking badge
			const initialRanking = regularTaskEl.querySelector('.ontask-task-ranking');
			expect(initialRanking).toBeNull();
			expect(regularTaskEl.classList.contains('ontask-toptask-hero')).toBe(false);

			// Act - Change to top task status (/)
			regularTask.lineContent = '- [/] New top task';
			view['updateCheckboxRowInPlace'](regularTask, '- [/] New top task');

			// Assert
			const updatedRanking = regularTaskEl.querySelector('.ontask-task-ranking');
			expect(updatedRanking).toBeTruthy();
			expect(updatedRanking?.textContent).toBe('Rank 1');
			expect(regularTaskEl.classList.contains('ontask-toptask-hero')).toBe(true);
		});
	});

	describe('Scenario 3: Test with different status symbols (built-in and custom)', () => {
		it('should handle built-in status symbols correctly', () => {
			// Test non-top-task built-in statuses (these should never have dynamic color attributes)
			const nonTopTaskBuiltInStatuses = ['x', '?', '*'];
			
			for (const status of nonTopTaskBuiltInStatuses) {
				// Arrange - create fresh checkbox and element for each status
				const checkbox = createMockCheckbox('test.md', 5, '- [ ] To-do task');
				(view as any).checkboxes = [checkbox];
				mockContentArea.innerHTML = ''; // Clear previous state
				const checkboxEl = createCheckboxElement(checkbox);
				mockContentArea.appendChild(checkboxEl);

				// Act
				view['updateCheckboxRowInPlace'](checkbox, `- [${status}] ${status} task`);

				// Assert
				const statusDisplay = mockContentArea.querySelector('.ontask-checkbox-display') as HTMLElement;
				expect(statusDisplay?.getAttribute('data-status')).toBe(status);
				
				// Built-in statuses without topTaskRanking should not have data-dynamic-color attribute
				expect(statusDisplay?.hasAttribute('data-dynamic-color')).toBe(false);
				expect(statusDisplay?.hasAttribute('data-custom-status')).toBe(false);
			}
			
			// Note: Top-task built-in statuses (/, !, +) are tested in Scenario 2
			// where we verify top task behavior including attribute handling
		});

		it('should handle custom status symbols correctly', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [ ] Regular task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [CUSTOM] Custom status task');

			// Assert
			const statusDisplay = mockContentArea.querySelector('.ontask-checkbox-display') as HTMLElement;
			expect(statusDisplay?.getAttribute('data-status')).toBe('CUSTOM');
			
			// Custom statuses should have data-dynamic-color attribute
			expect(statusDisplay?.hasAttribute('data-dynamic-color')).toBe(true);
			expect(statusDisplay?.hasAttribute('data-custom-status')).toBe(true);
		});

		it('should remove custom status attributes when switching from custom to built-in', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [CUSTOM] Custom task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);
			
			// Initially set custom attributes
			const initialStatusDisplay = checkboxEl.querySelector('.ontask-checkbox-display') as HTMLElement;
			initialStatusDisplay.setAttribute('data-dynamic-color', 'true');
			initialStatusDisplay.setAttribute('data-custom-status', 'true');

			// Act - Switch to built-in status
			view['updateCheckboxRowInPlace'](checkbox, '- [x] Completed task');

			// Assert
			const updatedStatusDisplay = mockContentArea.querySelector('.ontask-checkbox-display') as HTMLElement;
			expect(updatedStatusDisplay?.hasAttribute('data-dynamic-color')).toBe(false);
			expect(updatedStatusDisplay?.hasAttribute('data-custom-status')).toBe(false);
		});
	});

	describe('Scenario 4: Verify colors and styling update correctly', () => {
		it('should update CSS custom properties for colors when status changes', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [ ] Gray task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [x] Green completed task');

			// Assert
			const statusDisplay = mockContentArea.querySelector('.ontask-checkbox-display') as HTMLElement;
			expect(statusDisplay?.style.getPropertyValue('--ontask-status-color')).toBe('#10b981');
			expect(statusDisplay?.style.getPropertyValue('--ontask-status-background-color')).toBe('transparent');
		});

		it('should update colors for custom status with custom background color', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [ ] Regular task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [CUSTOM] Custom colored task');

			// Assert
			const statusDisplay = mockContentArea.querySelector('.ontask-checkbox-display') as HTMLElement;
			expect(statusDisplay?.style.getPropertyValue('--ontask-status-color')).toBe('#f59e0b');
			expect(statusDisplay?.style.getPropertyValue('--ontask-status-background-color')).toBe('#fef3c7');
		});

		it('should maintain styling consistency with createCheckboxElement output', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [!] Important task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [/] In Progress task');

			// Assert - Verify all the same attributes that createCheckboxElement would set
			const statusDisplay = mockContentArea.querySelector('.ontask-checkbox-display') as HTMLElement;
			expect(statusDisplay?.getAttribute('data-status')).toBe('/');
			expect(statusDisplay?.textContent).toBe('/');
			expect(statusDisplay?.style.getPropertyValue('--ontask-status-color')).toBeTruthy();
			expect(statusDisplay?.style.getPropertyValue('--ontask-status-background-color')).toBeTruthy();
		});
	});

	describe('Edge cases and error handling', () => {
		it('should fall back to refresh if checkbox element is not found', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [ ] Task');
			(view as any).checkboxes = [checkbox];
			// Don't add element to DOM

			const scheduleRefreshSpy = jest.spyOn(view as any, 'scheduleRefresh');

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [x] Completed');

			// Assert
			expect(scheduleRefreshSpy).toHaveBeenCalled();
		});

		it('should handle task text updates correctly', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [ ] Original task text');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [ ] Updated task text');

			// Assert
			const textEl = mockContentArea.querySelector('.ontask-checkbox-text');
			expect(textEl?.textContent).toBe('Updated task text');
		});

		it('should update content tracking map', () => {
			// Arrange
			const checkbox = createMockCheckbox('test.md', 5, '- [ ] Task');
			(view as any).checkboxes = [checkbox];
			const checkboxEl = createCheckboxElement(checkbox);
			mockContentArea.appendChild(checkboxEl);

			// Act
			view['updateCheckboxRowInPlace'](checkbox, '- [x] Completed task');

			// Assert
			const lastContent = (view as any).lastCheckboxContent.get('test.md:5');
			expect(lastContent).toBe('- [x] Completed task');
		});
	});
});

