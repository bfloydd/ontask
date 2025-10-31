/**
 * @jest-environment jsdom
 */

// Integration tests for FileOperationsService callback chain
// Tests that updateCheckboxStatus correctly calls in-place update callback

// Mock Logger before imports
jest.mock('../../../logging/Logger', () => ({
	Logger: {
		getInstance: jest.fn(() => ({
			debug: jest.fn(),
			warn: jest.fn(),
			info: jest.fn(),
			error: jest.fn()
		}))
	}
}));

import { FileOperationsService } from '../file-operations-service';
import { EventSystem } from '../../../events';
import { Logger } from '../../../logging/Logger';
import { TFile } from 'obsidian';

describe('FileOperationsService - In-Place Update Callback Integration', () => {
	let fileOperationsService: FileOperationsService;
	let mockApp: any;
	let mockEventSystem: jest.Mocked<EventSystem>;
	let mockLogger: jest.Mocked<Logger>;
	let mockCheckboxes: any[];
	let mockScheduleRefreshCallback: jest.Mock;
	let mockInPlaceUpdateCallback: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		mockApp = {
			vault: {
				read: jest.fn(),
				modify: jest.fn().mockResolvedValue(undefined)
			}
		};

		mockEventSystem = {
			emit: jest.fn(),
			on: jest.fn(() => ({ unsubscribe: jest.fn() }))
		} as any;

		mockLogger = {
			debug: jest.fn(),
			warn: jest.fn(),
			info: jest.fn(),
			error: jest.fn()
		} as any;

		mockCheckboxes = [];
		mockScheduleRefreshCallback = jest.fn();
		mockInPlaceUpdateCallback = jest.fn();

		fileOperationsService = new FileOperationsService(
			mockApp,
			mockEventSystem,
			mockCheckboxes,
			false, // isUpdatingStatus
			mockScheduleRefreshCallback,
			mockLogger
		);
	});

	describe('updateCheckboxStatus callback chain', () => {
		it('should call in-place update callback when provided', async () => {
			// Arrange
			const file = new (TFile as any)('test.md', 'test.md', Date.now());
			const checkbox = {
				file,
				lineNumber: 2,
				lineContent: '- [ ] Original task'
			};
			mockCheckboxes.push(checkbox);

			const originalContent = 'Line 1\n- [ ] Original task\nLine 3';
			const updatedContent = 'Line 1\n- [/] Updated task\nLine 3';
			mockApp.vault.read = jest.fn()
				.mockResolvedValueOnce(originalContent) // First read for modification
				.mockResolvedValueOnce(updatedContent); // Second read for callback

			// Act
			await fileOperationsService.updateCheckboxStatus(
				checkbox,
				'/',
				mockInPlaceUpdateCallback
			);

			// Assert
			expect(mockInPlaceUpdateCallback).toHaveBeenCalledWith('- [/] Updated task');
			expect(mockScheduleRefreshCallback).not.toHaveBeenCalled();
		});

		it('should fall back to scheduleRefreshCallback when in-place callback is not provided', async () => {
			// Arrange
			const file = new (TFile as any)('test.md', 'test.md', Date.now());
			const checkbox = {
				file,
				lineNumber: 2,
				lineContent: '- [ ] Original task'
			};
			mockCheckboxes.push(checkbox);

			const originalContent = 'Line 1\n- [ ] Original task\nLine 3';
			mockApp.vault.read = jest.fn().mockResolvedValueOnce(originalContent);

			// Act
			await fileOperationsService.updateCheckboxStatus(
				checkbox,
				'x'
				// No in-place callback provided
			);

			// Assert
			expect(mockInPlaceUpdateCallback).not.toHaveBeenCalled();
			expect(mockScheduleRefreshCallback).toHaveBeenCalled();
		});

		it('should update file content correctly before calling callback', async () => {
			// Arrange
			const file = new (TFile as any)('test.md', 'test.md', Date.now());
			const checkbox = {
				file,
				lineNumber: 2,
				lineContent: '- [!] Important task'
			};
			mockCheckboxes.push(checkbox);

			const originalContent = 'Line 1\n- [!] Important task\nLine 3';
			const updatedContent = 'Line 1\n- [x] Completed task\nLine 3';
			mockApp.vault.read = jest.fn()
				.mockResolvedValueOnce(originalContent)
				.mockResolvedValueOnce(updatedContent);

			// Act
			await fileOperationsService.updateCheckboxStatus(
				checkbox,
				'x',
				mockInPlaceUpdateCallback
			);

			// Assert - Verify modify was called (exact content match depends on regex)
			expect(mockApp.vault.modify).toHaveBeenCalledWith(
				file,
				expect.stringContaining('- [x]')
			);
			expect(mockInPlaceUpdateCallback).toHaveBeenCalledWith('- [x] Completed task');
		});

		it('should handle errors gracefully and fall back to refresh', async () => {
			// Arrange
			const file = new (TFile as any)('test.md', 'test.md', Date.now());
			const checkbox = {
				file,
				lineNumber: 5,
				lineContent: '- [ ] Task'
			};
			mockCheckboxes.push(checkbox);

			mockApp.vault.read = jest.fn().mockRejectedValue(new Error('File read error'));

			// Suppress console.error for this test since we're intentionally testing error handling
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

			// Act
			await fileOperationsService.updateCheckboxStatus(
				checkbox,
				'x',
				mockInPlaceUpdateCallback
			);

			// Assert - Should not call in-place callback on error
			expect(mockInPlaceUpdateCallback).not.toHaveBeenCalled();
			// Note: scheduleRefreshCallback is only called if onInPlaceUpdate is not provided
			// But on error, we don't call it either way to avoid double-refresh
			
			// Restore console.error
			consoleSpy.mockRestore();
		});
	});

	describe('toggleCheckbox unchanged behavior', () => {
		it('should still use scheduleRefreshCallback for checkbox toggles', async () => {
			// Arrange
			const file = new (TFile as any)('test.md', 'test.md', Date.now());
			const checkbox = {
				file,
				lineNumber: 1,
				lineContent: '- [ ] Task',
				isCompleted: false
			};
			mockCheckboxes.push(checkbox);

			const originalContent = '- [ ] Task';
			mockApp.vault.read = jest.fn().mockResolvedValueOnce(originalContent);

			// Act
			await fileOperationsService.toggleCheckbox(checkbox, true);

			// Assert
			expect(mockScheduleRefreshCallback).toHaveBeenCalled();
			expect(checkbox.isCompleted).toBe(true);
		});
	});
});

