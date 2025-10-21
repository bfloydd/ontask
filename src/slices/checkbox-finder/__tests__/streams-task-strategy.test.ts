import { StreamsTaskStrategy } from '../strategies/streams-task-strategy';
import { StreamsService } from '../../streams';

const mockStreamsService = {
	isStreamsPluginAvailable: jest.fn().mockReturnValue(true),
	getAllStreams: jest.fn().mockReturnValue([])
} as unknown as StreamsService;

const mockApp = {
	vault: {
		getMarkdownFiles: jest.fn(),
		getAbstractFileByPath: jest.fn(),
		read: jest.fn()
	}
} as any;

describe('StreamsTaskStrategy', () => {
	let strategy: StreamsTaskStrategy;

	beforeEach(() => {
		jest.clearAllMocks();
		// Set default mock behavior for streams plugin availability
		mockStreamsService.isStreamsPluginAvailable = jest.fn().mockReturnValue(true);
		strategy = new StreamsTaskStrategy(mockApp, mockStreamsService);
	});

	describe('getName', () => {
		it('should return correct strategy name', () => {
			expect(strategy.getName()).toBe('streams');
		});
	});

	describe('isAvailable', () => {
		it('should return true when streams plugin is available', () => {
			mockStreamsService.isStreamsPluginAvailable = jest.fn().mockReturnValue(true);
			expect(strategy.isAvailable()).toBe(true);
		});

		it('should return false when streams plugin is not available', () => {
			mockStreamsService.isStreamsPluginAvailable = jest.fn().mockReturnValue(false);
			expect(strategy.isAvailable()).toBe(false);
		});
	});

	describe('findCheckboxes', () => {
		it('should return empty array when strategy is not available', async () => {
			mockStreamsService.isStreamsPluginAvailable = jest.fn().mockReturnValue(false);

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			const result = await strategy.findCheckboxes(context);
			expect(result).toHaveLength(0);
		});

		it('should find checkboxes in streams when plugin is available', async () => {
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
			mockApp.vault.read = jest.fn()
				.mockResolvedValueOnce('- [ ] Work Task')
				.mockResolvedValueOnce('- [x] Personal Task');

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			const result = await strategy.findCheckboxes(context);

			expect(result).toHaveLength(2);
			expect(result[0].sourceName).toBe('Streams');
			expect(result[0].lineContent).toBe('- [ ] Work Task');
		});

		it('should filter streams by today when onlyShowToday is true', async () => {
			// Use a fixed date to avoid test flakiness
			const today = '2024-01-15';
			const mockStreams = [
				{ name: 'Work', folder: '/Work' }
			];
			mockStreamsService.getAllStreams = jest.fn().mockReturnValue(mockStreams);

			const mockFiles = [
				{ path: `/Work/${today}.md`, name: `${today}.md` },
				{ path: '/Work/2024-01-14.md', name: '2024-01-14.md' }
			];

			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Work') return { name: 'Work', path: '/Work' };
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.read = jest.fn().mockResolvedValue('- [ ] Today Stream Task');

			// Mock Date to return 2024-01-15
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-01-15T00:00:00.000Z'));

			// Create fresh strategy instance after mock setup
			const testStrategy = new StreamsTaskStrategy(mockApp, mockStreamsService);

			const context = {
				onlyShowToday: true,
				limit: 10,
				filePaths: []
			};

			const result = await testStrategy.findCheckboxes(context);

			expect(result).toHaveLength(1);
			expect(result[0].lineContent).toBe('- [ ] Today Stream Task');

			jest.useRealTimers();
		});

		it('should handle empty streams', async () => {
			mockStreamsService.getAllStreams = jest.fn().mockReturnValue([]);

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			const result = await strategy.findCheckboxes(context);

			expect(result).toHaveLength(0);
		});

		it('should respect limit parameter', async () => {
			const mockStreams = [
				{ name: 'Work', folder: '/Work' }
			];
			mockStreamsService.getAllStreams = jest.fn().mockReturnValue(mockStreams);

			const mockFiles = [
				{ path: '/Work/task1.md', name: 'task1.md' }
			];

			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Work') return { name: 'Work', path: '/Work' };
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

	describe('findCheckboxesInStream', () => {
		it('should find checkboxes in a specific stream', async () => {
			const mockStream = { name: 'Work', folder: '/Work' };
			const mockFiles = [
				{ path: '/Work/task1.md', name: 'task1.md' },
				{ path: '/Work/task2.md', name: 'task2.md' }
			];

			mockApp.vault.getAbstractFileByPath = jest.fn((path) => {
				if (path === '/Work') return { name: 'Work', path: '/Work' };
				return mockFiles.find(f => f.path === path) || null;
			});
			mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue(mockFiles);
			mockApp.vault.read = jest.fn()
				.mockResolvedValueOnce('- [ ] Work Task 1')
				.mockResolvedValueOnce('- [x] Work Task 2');

			const context = {
				onlyShowToday: false,
				limit: 10,
				filePaths: []
			};

			const result = await strategy.findCheckboxesInStream(mockStream, context);

			expect(result).toHaveLength(2);
			expect(result[0].sourceName).toBe('Streams');
			expect(result[0].lineContent).toBe('- [ ] Work Task 1');
		});
	});

	describe('isTodayFile', () => {
		it.skip('should identify today files correctly', () => {
			const today = new Date().toISOString().split('T')[0];
			const todayFile = { name: `${today}.md`, path: `/Work/${today}.md` } as any;
			const yesterdayFile = { name: '2024-01-14.md', path: '/Work/2024-01-14.md' } as any;

			expect(strategy.isTodayFile(todayFile)).toBe(true);
			expect(strategy.isTodayFile(yesterdayFile)).toBe(false);
		});
	});
});
