import { FolderTaskStrategy, FolderStrategyConfig } from '../strategies/folder-task-strategy';

const mockApp = {
	vault: {
		getMarkdownFiles: jest.fn(),
		getAbstractFileByPath: jest.fn(),
		read: jest.fn()
	}
} as any;

describe('FolderTaskStrategy', () => {
	let strategy: FolderTaskStrategy;
	let config: FolderStrategyConfig;

	beforeEach(() => {
		jest.clearAllMocks();
		config = {
			folderPath: '/Projects',
			recursive: true,
			includeSubfolders: true
		};
		strategy = new FolderTaskStrategy(mockApp, config);
	});

	describe('getName', () => {
		it('should return correct strategy name', () => {
			expect(strategy.getName()).toBe('folder');
		});
	});

	describe('isAvailable', () => {
		it('should return true when folder path is configured', () => {
			expect(strategy.isAvailable()).toBe(true);
		});

		it('should return false when folder does not exist', () => {
			// Mock folder not found
			mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
			
			const emptyConfig = { ...config, folderPath: '/NonExistentFolder' };
			const emptyStrategy = new FolderTaskStrategy(mockApp, emptyConfig);
			expect(emptyStrategy.isAvailable()).toBe(false);
		});
	});

	describe('findCheckboxes', () => {
		it('should return empty array when strategy is not available', async () => {
			const emptyConfig = { ...config, folderPath: '' };
			const emptyStrategy = new FolderTaskStrategy(mockApp, emptyConfig);

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			const result = await emptyStrategy.findCheckboxes(context);
			expect(result).toHaveLength(0);
		});

		it('should find checkboxes in folder files', async () => {
			const mockFiles = [
				{ path: '/Projects/task1.md', name: 'task1.md' },
				{ path: '/Projects/task2.md', name: 'task2.md' }
			];

			// Mock the folder to exist
			const mockFolder = { name: 'Projects', path: '/Projects' };
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Projects') return mockFolder;
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.read = jest.fn()
				.mockResolvedValueOnce('- [ ] Project Task 1')
				.mockResolvedValueOnce('- [x] Project Task 2');

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			const result = await strategy.findCheckboxes(context);

			expect(result).toHaveLength(2);
			expect(result[0].sourceName).toBe('Folder: /Projects');
			expect(result[0].lineContent).toBe('- [ ] Project Task 1');
		});

		it('should filter to today only when onlyShowToday is true', async () => {
			// Use a fixed date to avoid test flakiness
			const today = '2024-01-15';
			const mockFiles = [
				{ path: `/Projects/${today}.md`, name: `${today}.md` },
				{ path: '/Projects/2024-01-14.md', name: '2024-01-14.md' }
			];

			// Mock the folder to exist
			const mockFolder = { name: 'Projects', path: '/Projects' };
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Projects') return mockFolder;
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.read = jest.fn().mockResolvedValue('- [ ] Today Project Task');

			// Mock Date to return 2024-01-15
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-01-15T00:00:00.000Z'));

			// Create fresh strategy instance after mock setup
			const testStrategy = new FolderTaskStrategy(mockApp, config);

			const context = {
				onlyShowToday: true,
				limit: 10,
				filePaths: []
			};

			const result = await testStrategy.findCheckboxes(context);

			expect(result).toHaveLength(1);
			expect(result[0].lineContent).toBe('- [ ] Today Project Task');

			jest.useRealTimers();
		});

		it('should respect limit parameter', async () => {
			const mockFiles = [
				{ path: '/Projects/task1.md', name: 'task1.md' }
			];

			// Mock the folder to exist
			const mockFolder = { name: 'Projects', path: '/Projects' };
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Projects') return mockFolder;
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.read = jest.fn().mockResolvedValue(`
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

	describe('getFilesInFolder', () => {
		it('should return files in the configured folder', async () => {
			const mockFiles = [
				{ path: '/Projects/file1.md', name: 'file1.md' },
				{ path: '/Projects/file2.md', name: 'file2.md' }
			];

			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);

			const mockFolder = { name: 'Projects', path: '/Projects' };
			const result = strategy.getFilesInFolder(mockFolder);

			expect(result).toHaveLength(2);
			expect(result[0].path).toBe('/Projects/file1.md');
		});
	});

	describe('isTodayFile', () => {
		it.skip('should identify today files correctly', () => {
			const today = new Date().toISOString().split('T')[0];
			const todayFile = { name: `${today}.md`, path: `/Projects/${today}.md` } as any;
			const yesterdayFile = { name: '2024-01-14.md', path: '/Projects/2024-01-14.md' } as any;

			expect(strategy.isTodayFile(todayFile)).toBe(true);
			expect(strategy.isTodayFile(yesterdayFile)).toBe(false);
		});
	});
});
