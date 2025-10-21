import { TaskFinderFactoryImpl } from '../TaskFinderFactoryImpl';
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

describe('TaskFinderFactory', () => {
	let factory: TaskFinderFactoryImpl;

	beforeEach(() => {
		jest.clearAllMocks();
		factory = new TaskFinderFactoryImpl(mockApp, mockStreamsService);
	});

	describe('getStreamsService', () => {
		it('should return streams service', () => {
			expect(factory.getStreamsService()).toBe(mockStreamsService);
		});
	});

	describe('createStrategy', () => {
		it('should create streams strategy', () => {
			const strategy = factory.createStrategy('streams');
			expect(strategy).toBeDefined();
			expect(strategy?.getName()).toBe('streams');
		});

		it('should create daily notes strategy', () => {
			const strategy = factory.createStrategy('daily-notes');
			expect(strategy).toBeDefined();
			expect(strategy?.getName()).toBe('daily-notes');
		});

		it('should return null for unknown strategy', () => {
			const strategy = factory.createStrategy('unknown');
			expect(strategy).toBeNull();
		});
	});

	describe('getAvailableStrategies', () => {
		it('should return available strategy names', () => {
			const strategies = factory.getAvailableStrategies();
			expect(strategies).toContain('streams');
			expect(strategies).toContain('daily-notes');
		});
	});

	describe('createFolderStrategy', () => {
		it('should create folder strategy with config', () => {
			const config = {
				folderPath: '/Projects',
				recursive: true,
				includeSubfolders: true
			};
			const strategy = factory.createFolderStrategy(config);
			expect(strategy).toBeDefined();
			expect(strategy.getName()).toBe('folder');
		});
	});

	describe('getReadyStrategies', () => {
		it('should return only available strategies', () => {
			const readyStrategies = factory.getReadyStrategies();
			expect(Array.isArray(readyStrategies)).toBe(true);
		});
	});

	describe('getReadyStrategyNames', () => {
		it('should return names of ready strategies', () => {
			const names = factory.getReadyStrategyNames();
			expect(Array.isArray(names)).toBe(true);
		});
	});
});
