import { TaskFinderFactoryImpl } from '../task-finder-factory';
import { DailyNotesTaskStrategy } from '../strategies/daily-notes-task-strategy';
import { FolderTaskStrategy } from '../strategies/folder-task-strategy';
import { StreamsTaskStrategy } from '../strategies/streams-task-strategy';
import { StreamsService } from '../../streams';

// Mock dependencies
const mockStreamsService = {
	isStreamsPluginAvailable: jest.fn().mockReturnValue(true),
	getAllFiles: jest.fn(),
	getAllStreams: jest.fn().mockReturnValue([])
} as unknown as StreamsService;

const mockApp = {
	vault: {
		getAbstractFileByPath: jest.fn(),
		read: jest.fn(),
		getMarkdownFiles: jest.fn(),
		getFiles: jest.fn()
	},
	plugins: {
		getPlugin: jest.fn()
	},
	internalPlugins: {
		plugins: {}
	}
} as any;

describe('TaskFinder Integration Tests', () => {
	let taskFinderFactory: TaskFinderFactoryImpl;
	let dailyNotesStrategy: DailyNotesTaskStrategy;
	let folderStrategy: FolderTaskStrategy;
	let streamsStrategy: StreamsTaskStrategy;

	beforeEach(() => {
		jest.clearAllMocks();
		
		// Reset mock app with default Daily Notes config
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
		
		// Set default mock behavior for streams plugin
		mockStreamsService.isStreamsPluginAvailable = jest.fn().mockReturnValue(true);
		
		// Create strategy instances
		dailyNotesStrategy = new DailyNotesTaskStrategy(mockApp);
		folderStrategy = new FolderTaskStrategy(mockApp, {
			folderPath: '/Projects',
			recursive: true,
			includeSubfolders: true
		});
		streamsStrategy = new StreamsTaskStrategy(mockApp, mockStreamsService);

		// Create task finder factory
		taskFinderFactory = new TaskFinderFactoryImpl(mockApp, mockStreamsService);
	});

	describe('Daily Notes Strategy Integration', () => {
		it('should find checkboxes in daily notes when plugin is available', async () => {
			// Arrange
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue({ name: 'daily-notes' });

			const mockFiles = [
				{ path: '/Daily Notes/2024-01-15.md', name: '2024-01-15.md' },
				{ path: '/Daily Notes/2024-01-14.md', name: '2024-01-14.md' }
			];

			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => 
				mockFiles.find(f => f.path === path) || null
			);
			mockApp.vault.read = jest.fn()
				.mockResolvedValueOnce('- [ ] Task 1\n- [x] Task 2')
				.mockResolvedValueOnce('- [ ] Task 3\n- [/] Task 4');

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			// Act
			const result = await dailyNotesStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(4);
			expect(result[0].sourceName).toBe('Daily Notes');
			expect(result[0].lineContent).toBe('- [ ] Task 1');
			expect(result[1].lineContent).toBe('- [x] Task 2');
		});

		it('should filter to today only when onlyShowToday is true', async () => {
			// Arrange
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue({ name: 'daily-notes' });

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
			mockApp.vault.read = jest.fn().mockResolvedValue('- [ ] Today Task');

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

			// Act
			const result = await testStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(1);
			expect(result[0].lineContent).toBe('- [ ] Today Task');

			jest.useRealTimers();
		});

		it('should handle Daily Notes plugin not available', async () => {
			// Arrange
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue(null);
			mockApp.internalPlugins.plugins = {}; // Clear the core plugin config

			// Create a new strategy instance with the updated mock
			const unavailableStrategy = new DailyNotesTaskStrategy(mockApp);

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			// Act
			const result = await unavailableStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(0);
		});
	});

	describe('Folder Strategy Integration', () => {
		it('should find checkboxes in custom folder when configured', async () => {
			// Arrange
			const mockFiles = [
				{ path: '/Projects/task1.md', name: 'task1.md' },
				{ path: '/Projects/task2.md', name: 'task2.md' }
			];

			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Projects') return { name: 'Projects', path: '/Projects' };
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.read = jest.fn()
				.mockResolvedValueOnce('- [ ] Project Task 1')
				.mockResolvedValueOnce('- [x] Project Task 2');

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			// Act
			const result = await folderStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(2);
			expect(result[0].sourceName).toBe('Folder: /Projects');
			expect(result[0].lineContent).toBe('- [ ] Project Task 1');
		});

		it('should handle custom folder not configured', async () => {
			// Arrange
			const emptyFolderStrategy = new FolderTaskStrategy(mockApp, {
				folderPath: '',
				recursive: false,
				includeSubfolders: false
			});

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			// Act
			const result = await emptyFolderStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(0);
		});
	});

	describe('Streams Strategy Integration', () => {
		it('should find checkboxes in streams when plugin is available', async () => {
			// Arrange
			const mockStreams = [
				{ name: 'Work', folder: '/Work' },
				{ name: 'Personal', folder: '/Personal' }
			];
			mockStreamsService.getAllStreams = jest.fn().mockReturnValue(mockStreams);

			const mockFiles = [
				{ path: '/Work/task1.md', name: 'task1.md' },
				{ path: '/Personal/task2.md', name: 'task2.md' }
			];

			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Work' || path === '/Personal') return { name: path.slice(1), path };
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.read = jest.fn((file) => {
				if (file.path === '/Work/task1.md') return Promise.resolve('- [ ] Work Task');
				if (file.path === '/Personal/task2.md') return Promise.resolve('- [x] Personal Task');
				return Promise.resolve('');
			});

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			// Act
			const result = await streamsStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(2);
			expect(result[0].sourceName).toBe('Streams');
			expect(result[0].lineContent).toBe('- [ ] Work Task');
		});

		it('should handle streams plugin not available', async () => {
			// Arrange
			mockStreamsService.isStreamsPluginAvailable = jest.fn().mockReturnValue(false);

			// Create a new strategy instance with the updated mock
			const unavailableStreamsStrategy = new StreamsTaskStrategy(mockApp, mockStreamsService);

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			// Act
			const result = await unavailableStreamsStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(0);
		});

		it('should filter streams by today when onlyShowToday is true', async () => {
			// Arrange
			// Use a fixed date to avoid test flakiness
			const today = '2024-01-15';
			const mockStreams = [
				{ name: 'Work', folder: '/Work' }
			];
			mockStreamsService.getAllStreams = jest.fn().mockReturnValue(mockStreams);

			const mockFiles = [
				{ path: `/Work/2024-01-14.md`, name: `2024-01-14.md`, extension: 'md' } as any,
				{ path: '/Work/2024-01-13.md', name: '2024-01-13.md', extension: 'md' } as any
			];

			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Work') return null; // Return null so it uses fallback logic
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.read = jest.fn((file) => {
				if (file.path.includes('2024-01-14')) return Promise.resolve('- [ ] Today Stream Task');
				return Promise.resolve('');
			});
			
			// Mock Date to return 2024-01-15
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-01-15T00:00:00.000Z'));

			// Create fresh strategy instance after mock setup - must be created AFTER timer setup
			const testStreamsStrategy = new StreamsTaskStrategy(mockApp, mockStreamsService);

			const context = {
				onlyShowToday: true,
				limit: 10,
				filePaths: []
			};

			// Act
			const result = await testStreamsStrategy.findCheckboxes(context);


			// Assert
			expect(result).toHaveLength(1);
			expect(result[0].lineContent).toBe('- [ ] Today Stream Task');

			jest.useRealTimers();
		});

		it('should handle empty streams', async () => {
			// Arrange
			mockStreamsService.getAllStreams = jest.fn().mockReturnValue([]);

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			// Act
			const result = await streamsStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(0);
		});
	});

	describe('Strategy Integration', () => {
		it('should handle multiple strategies working together', async () => {
			// Arrange
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue({ name: 'daily-notes' });
			mockStreamsService.isStreamsPluginAvailable = jest.fn().mockReturnValue(true);
			mockStreamsService.getAllStreams = jest.fn().mockReturnValue([
				{ name: 'Work', folder: '/Work' }
			]);

			const mockFiles = [
				{ path: '/Daily Notes/2024-01-15.md', name: '2024-01-15.md' },
				{ path: '/Work/task1.md', name: 'task1.md' },
				{ path: '/Projects/task2.md', name: 'task2.md' }
			];

			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Work') return { name: 'Work', path: '/Work' };
				if (path === '/Projects') return { name: 'Projects', path: '/Projects' };
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.read = jest.fn()
				.mockResolvedValueOnce('- [ ] Daily Note Task')
				.mockResolvedValueOnce('- [x] Work Task')
				.mockResolvedValueOnce('- [/] Project Task');

			// Act - Test all strategies
			const dailyNotesResult = await dailyNotesStrategy.findCheckboxes({
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			});
			const streamsResult = await streamsStrategy.findCheckboxes({
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			});
			const folderResult = await folderStrategy.findCheckboxes({
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			});

			// Assert
			expect(dailyNotesResult).toHaveLength(1);
			expect(streamsResult).toHaveLength(1);
			expect(folderResult).toHaveLength(1);
			expect(dailyNotesResult[0].sourceName).toBe('Daily Notes');
			expect(streamsResult[0].sourceName).toBe('Streams');
			expect(folderResult[0].sourceName).toBe('Folder: /Projects');
		});

		it('should respect limit across all strategies', async () => {
			// Arrange
			mockApp.plugins.getPlugin = jest.fn().mockReturnValue({ name: 'daily-notes' });

			const mockFiles = [
				{ path: '/Daily Notes/2024-01-15.md', name: '2024-01-15.md' }
			];

			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.getAbstractFileByPath = jest.fn((path) => 
				mockFiles.find(f => f.path === path) || null
			);
			mockApp.vault.read = jest.fn().mockResolvedValue(`
- [ ] Task 1
- [x] Task 2
- [/] Task 3
- [ ] Task 4
- [x] Task 5
			`.trim());

			const context = {
				onlyShowToday: false,
				limit: 3, // Limit to 3 tasks
				filePaths: []
			};

			// Act
			const result = await dailyNotesStrategy.findCheckboxes(context);

			// Assert
			expect(result).toHaveLength(3); // Strategy now properly implements limit
		});
	});
});
