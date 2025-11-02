/**
 * @jest-environment jsdom
 */

// Integration tests for DOM rendering service data attributes
// Verifies that checkbox elements have proper data attributes for in-place updates

import { DOMRenderingService } from '../DOMRenderingService';
import { TFile } from 'obsidian';
import { StatusConfigService } from '../../../settings/StatusConfig';
import { SettingsService } from '../../../settings';
import { ContextMenuService } from '../ContextMenuService';

describe('DOMRenderingService - Data Attributes Integration', () => {
	let domRenderingService: DOMRenderingService;
	let mockStatusConfigService: jest.Mocked<StatusConfigService>;
	let mockSettingsService: jest.Mocked<SettingsService>;
	let mockContextMenuService: any;
	let mockApp: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Polyfill Obsidian's HTMLElement extensions for jsdom
		if (!HTMLElement.prototype.addClass) {
			HTMLElement.prototype.addClass = function(className: string) {
				this.classList.add(className);
			} as any;
		}

		mockStatusConfigService = {
			getStatusConfigs: jest.fn().mockReturnValue([]),
			getStatusConfig: jest.fn(),
			getStatusColor: jest.fn().mockReturnValue('#6b7280'),
			getStatusBackgroundColor: jest.fn().mockReturnValue('transparent'),
			getStatusFilters: jest.fn().mockReturnValue({})
		} as any;

		mockSettingsService = {
			getSettings: jest.fn().mockReturnValue({
				loadMoreLimit: 10,
				onlyShowToday: false
			})
		} as any;

		mockContextMenuService = {
			showContextMenu: jest.fn()
		};

		mockApp = {};

		domRenderingService = new DOMRenderingService(
			mockStatusConfigService,
			mockContextMenuService,
			mockSettingsService,
			mockApp,
			jest.fn(), // onOpenFile
			jest.fn(), // getFileName
			(line: string) => {
				const match = line.match(/^-\s*\[([^\]]*)\]\s*(.*)$/);
				return {
					statusSymbol: match ? match[1] : ' ',
					remainingText: match ? match[2] : line
				};
			}, // parseCheckboxLine
			(statusSymbol: string) => statusSymbol, // getStatusDisplayText
			jest.fn() // addMobileTouchHandlers
		);
	});

	describe('createCheckboxElement data attributes', () => {
		it('should add data-file-path attribute to checkbox element', () => {
			// Arrange
			const file = new (TFile as any)('folder/file.md', 'file.md', Date.now());
			const checkbox = {
				file,
				lineNumber: 10,
				lineContent: '- [ ] Test task',
				checkboxText: '- [ ] Test task',
				sourceName: 'test',
				sourcePath: 'folder/file.md'
			};

			// Act
			const element = domRenderingService.createCheckboxElement(checkbox);

			// Assert
			expect(element.getAttribute('data-file-path')).toBe('folder/file.md');
		});

		it('should add data-line-number attribute to checkbox element', () => {
			// Arrange
			const file = new (TFile as any)('test.md', 'test.md', Date.now());
			const checkbox = {
				file,
				lineNumber: 42,
				lineContent: '- [x] Completed task',
				checkboxText: '- [x] Completed task',
				sourceName: 'test',
				sourcePath: 'test.md'
			};

			// Act
			const element = domRenderingService.createCheckboxElement(checkbox);

			// Assert
			expect(element.getAttribute('data-line-number')).toBe('42');
		});

		it('should handle missing file path gracefully', () => {
			// Arrange
			const checkbox = {
				file: null as any,
				lineNumber: 5,
				lineContent: '- [ ] Task without file',
				checkboxText: '- [ ] Task without file',
				sourceName: 'test',
				sourcePath: ''
			};

			// Act
			const element = domRenderingService.createCheckboxElement(checkbox);

			// Assert
			expect(element.hasAttribute('data-file-path')).toBe(false);
			expect(element.getAttribute('data-line-number')).toBe('5');
		});

		it('should handle missing line number gracefully', () => {
			// Arrange
			const file = new (TFile as any)('test.md', 'test.md', Date.now());
			const checkbox = {
				file,
				lineNumber: undefined as any,
				lineContent: '- [ ] Task without line number',
				checkboxText: '- [ ] Task without line number',
				sourceName: 'test',
				sourcePath: 'test.md'
			};

			// Act
			const element = domRenderingService.createCheckboxElement(checkbox);

			// Assert
			expect(element.getAttribute('data-file-path')).toBe('test.md');
			expect(element.getAttribute('data-line-number')).toBe('');
		});

		it('should create elements with data attributes that can be found by selector', () => {
			// Arrange
			const file1 = new (TFile as any)('file1.md', 'file1.md', Date.now());
			const file2 = new (TFile as any)('file2.md', 'file2.md', Date.now());
			
			const checkbox1 = { file: file1, lineNumber: 5, lineContent: '- [ ] Task 1', checkboxText: '- [ ] Task 1', sourceName: 'test', sourcePath: 'file1.md' };
			const checkbox2 = { file: file2, lineNumber: 10, lineContent: '- [ ] Task 2', checkboxText: '- [ ] Task 2', sourceName: 'test', sourcePath: 'file2.md' };
			const checkbox3 = { file: file1, lineNumber: 15, lineContent: '- [ ] Task 3', checkboxText: '- [ ] Task 3', sourceName: 'test', sourcePath: 'file1.md' };

			// Act
			const element1 = domRenderingService.createCheckboxElement(checkbox1);
			const element2 = domRenderingService.createCheckboxElement(checkbox2);
			const element3 = domRenderingService.createCheckboxElement(checkbox3);

			// Add to container for querySelector testing
			const container = document.createElement('div');
			container.appendChild(element1);
			container.appendChild(element2);
			container.appendChild(element3);

			// Assert - Verify we can find specific elements
			const found1 = container.querySelector('[data-file-path="file1.md"][data-line-number="5"]');
			const found2 = container.querySelector('[data-file-path="file2.md"][data-line-number="10"]');
			const found3 = container.querySelector('[data-file-path="file1.md"][data-line-number="15"]');

			expect(found1).toBe(element1);
			expect(found2).toBe(element2);
			expect(found3).toBe(element3);
		});
	});
});

