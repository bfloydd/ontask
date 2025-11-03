import { App, Plugin } from 'obsidian';
import { StreamsService, Stream } from './StreamsServiceInterface';
import { Logger } from '../logging/Logger';

interface StreamsPlugin extends Plugin {
	getStreams(): Stream[];
	updateStreamBarFromFile?: (filePath: string) => Promise<boolean>;
	isFileInStream?: (filePath: string) => Stream | undefined;
}

export class StreamsServiceImpl implements StreamsService {
	private app: App;
	private streamsPlugin: StreamsPlugin | null = null;
	private logger?: Logger;

	constructor(app: App, logger?: Logger) {
		this.app = app;
		this.logger = logger;
		this.initializeStreamsPlugin();
	}

	private initializeStreamsPlugin() {
		this.app.workspace.onLayoutReady(() => {
			// Type assertion necessary: Obsidian's plugin API for accessing community plugins
			// The plugins.getPlugin() method exists but the return type is not fully typed
			// We cast to StreamsPlugin interface which defines the expected methods
			const streamsPlugin = (this.app as any).plugins?.getPlugin('streams') as StreamsPlugin;
			this.streamsPlugin = streamsPlugin;
		});
	}

	public getAllStreams(): Stream[] {
		if (!this.streamsPlugin) {
			return [];
		}

		try {
			const streams = this.streamsPlugin.getStreams();
			return streams;
		} catch (error) {
			if (this.logger) {
				this.logger.error('[OnTask StreamsService] Error getting streams from plugin:', error);
			}
			return [];
		}
	}

	public getStreamByName(name: string): Stream | undefined {
		const streams = this.getAllStreams();
		return streams.find(stream => stream.name.toLowerCase() === name.toLowerCase());
	}

	public getStreamByFolder(folder: string): Stream | undefined {
		const streams = this.getAllStreams();
		return streams.find(stream => stream.folder === folder);
	}

	public getStreamByPath(path: string): Stream | undefined {
		return this.getStreamByFolder(path);
	}

	public hasStream(name: string): boolean {
		return this.getStreamByName(name) !== undefined;
	}

	public getStreamNames(): string[] {
		return this.getAllStreams().map(stream => stream.name);
	}

	public getStreamFolders(): string[] {
		return this.getAllStreams().map(stream => stream.folder);
	}

	public getStreamPaths(): string[] {
		return this.getStreamFolders();
	}

	public getRibbonStreams(): Stream[] {
		return this.getAllStreams().filter(stream => stream.showTodayInRibbon);
	}

	public getCommandStreams(): Stream[] {
		return this.getAllStreams().filter(stream => stream.addCommand);
	}

	public getStreamsByFolderPrefix(prefix: string): Stream[] {
		return this.getAllStreams().filter(stream => stream.folder.startsWith(prefix));
	}

	public isStreamsPluginAvailable(): boolean {
		return this.streamsPlugin !== null;
	}

	public getStreamById(id: string): Stream | undefined {
		const streams = this.getAllStreams();
		return streams.find(stream => stream.id === id);
	}

	public isFileInStream(filePath: string): Stream | undefined {
		if (!this.streamsPlugin) {
			return undefined;
		}

		if (this.streamsPlugin.isFileInStream) {
			try {
				return this.streamsPlugin.isFileInStream(filePath);
			} catch (error) {
				if (this.logger) {
					this.logger.error('[OnTask StreamsService] Error using plugin isFileInStream method:', error);
				}
			}
		}

		const streams = this.getAllStreams();
		for (const stream of streams) {
			if (filePath.startsWith(stream.folder)) {
				return stream;
			}
		}

		return undefined;
	}

	public async updateStreamBarFromFile(filePath: string): Promise<boolean> {
		if (!this.streamsPlugin) {
			return false;
		}

		if (this.streamsPlugin.updateStreamBarFromFile) {
			try {
				const result = await this.streamsPlugin.updateStreamBarFromFile(filePath);
				return result;
			} catch (error) {
				if (this.logger) {
					this.logger.error('[OnTask StreamsService] Error updating stream bar from file:', error);
				}
				return false;
			}
		}

		return false;
	}
}
