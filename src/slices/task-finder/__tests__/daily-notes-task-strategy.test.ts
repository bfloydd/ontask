import { DailyNotesTaskStrategy } from '../strategies/DailyNotesTaskStrategy';

const mockApp = {
	vault: {
		getMarkdownFiles: jest.fn(),
		getAbstractFileByPath: jest.fn(),
		read: jest.fn(),
		cachedRead: jest.fn()
	},
	plugins: {
		getPlugin: jest.fn()
	},
	internalPlugins: {
		plugins: {
			'daily-notes': {
				enabled: true,
				instance: {
					options: {
						folder: '/Daily Notes'
					}
				}
			}
		}
	}
} as any;

describe('DailyNotesTaskStrategy', () => {
	let strategy: DailyNotesTaskStrategy;

	beforeEach(() => {
		jest.clearAllMocks();
		strategy = new DailyNotesTaskStrategy(mockApp);
	});

	describe('getName', () => {
		it('should return correct strategy name', () => {
			expect(strategy.getName()).toBe('daily-notes');
		});
	});

	describe('isAvailable', () => {
		it('should return true when Daily Notes plugin is available', () => {
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue({ name: 'daily-notes' });
			expect(strategy.isAvailable()).toBe(true);
		});

		it('should return true when Daily Notes core feature is enabled', () => {
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue(null);
			mockApp.internalPlugins.plugins = {
				'daily-notes': { enabled: true }
			};
			expect(strategy.isAvailable()).toBe(true);
		});

		it('should return false when neither plugin nor core feature is available', () => {
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue(null);
			mockApp.internalPlugins.plugins = {};
			// Create a new strategy instance with the updated mock
			const emptyStrategy = new DailyNotesTaskStrategy(mockApp);
			expect(emptyStrategy.isAvailable()).toBe(false);
		});
	});

	describe('findCheckboxes', () => {
		it('should return empty array when strategy is not available', async () => {
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue(null);
			mockApp.internalPlugins.plugins = {};

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			const result = await strategy.findCheckboxes(context);
			expect(result).toHaveLength(0);
		});

		it('should find checkboxes in daily notes files', async () => {
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue({ name: 'daily-notes' });
			// Ensure Daily Notes core plugin is configured
			mockApp.internalPlugins.plugins = {
				'daily-notes': {
					enabled: true,
					instance: {
						options: {
							folder: '/Daily Notes'
						}
					}
				}
			};

			const mockFiles = [
				{ path: '/Daily Notes/2024-01-15.md', name: '2024-01-15.md' },
				{ path: '/Daily Notes/2024-01-14.md', name: '2024-01-14.md' }
			];

			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => 
				mockFiles.find(f => f.path === path) || null
			);
			mockApp.vault.cachedRead = jest.fn()
				.mockResolvedValueOnce('- [ ] Task 1\n- [x] Task 2')
				.mockResolvedValueOnce('- [ ] Task 3\n- [/] Task 4');

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			const result = await strategy.findCheckboxes(context);

			expect(result).toHaveLength(4);
			expect(result[0].sourceName).toBe('Daily Notes');
			expect(result[0].lineContent).toBe('- [ ] Task 1');
			expect(result[1].lineContent).toBe('- [x] Task 2');
		});

		it('should filter to today only when onlyShowToday is true', async () => {
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue({ name: 'daily-notes' });
			// Ensure Daily Notes core plugin is configured
			mockApp.internalPlugins.plugins = {
				'daily-notes': {
					enabled: true,
					instance: {
						options: {
							folder: '/Daily Notes'
						}
					}
				}
			};

			// Use a fixed date to avoid test flakiness
			const today = '2024-01-15';
			const mockFiles = [
				{ path: `/Daily Notes/${today}.md`, name: `${today}.md` },
				{ path: '/Daily Notes/2024-01-14.md', name: '2024-01-14.md' }
			];

			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => 
				mockFiles.find(f => f.path === path) || null
			);
			mockApp.vault.cachedRead = jest.fn().mockResolvedValue('- [ ] Today Task');

			// Mock Date to return 2024-01-15
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-01-15T00:00:00.000Z'));

			// Create fresh strategy instance after mock setup
			const testStrategy = new DailyNotesTaskStrategy(mockApp);

			const context = {
				onlyShowToday: true,
				limit: 10,
				filePaths: []
			};

			const result = await testStrategy.findCheckboxes(context);
			expect(result).toHaveLength(1);
			expect(result[0].lineContent).toBe('- [ ] Today Task');

			jest.useRealTimers();
		});

		it('should respect limit parameter', async () => {
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue({ name: 'daily-notes' });
			// Ensure Daily Notes core plugin is configured
			mockApp.internalPlugins.plugins = {
				'daily-notes': {
					enabled: true,
					instance: {
						options: {
							folder: '/Daily Notes'
						}
					}
				}
			};

			const mockFiles = [
				{ path: '/Daily Notes/2024-01-15.md', name: '2024-01-15.md' }
			];

			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => 
				mockFiles.find(f => f.path === path) || null
			);
			mockApp.vault.cachedRead = jest.fn().mockResolvedValue(`
- [ ] Task 1
- [x] Task 2
- [/] Task 3
- [ ] Task 4
- [x] Task 5
			`.trim());

			const context = {
				onlyShowToday: false,
				limit: 3,
				filePaths: []
			};

			const result = await strategy.findCheckboxes(context);

			expect(result).toHaveLength(3);
		});
	});

	describe('isTodayFile', () => {
		it.skip('should identify today files correctly', () => {
			// Test with a file that contains today's date in the name
			const today = new Date().toISOString().split('T')[0];
			const todayFile = { name: `${today}.md`, path: `/Daily Notes/${today}.md` } as any;
			const yesterdayFile = { name: '2024-01-14.md', path: '/Daily Notes/2024-01-14.md' } as any;

			// Test that the method can identify date patterns in filenames
			expect(strategy.isTodayFile(todayFile)).toBe(true);
			expect(strategy.isTodayFile(yesterdayFile)).toBe(false);
		});
	});
});
