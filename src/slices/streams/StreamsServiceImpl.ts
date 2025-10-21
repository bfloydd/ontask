// Streams slice - Service implementation
import { App, Plugin } from 'obsidian';
import { StreamsService, Stream } from './StreamsServiceInterface';

// Type for the streams plugin
interface StreamsPlugin extends Plugin {
	getStreams(): Stream[];
	// Additional methods that might be available in the streams plugin
	updateStreamBarFromFile?: (filePath: string) => Promise<boolean>;
	isFileInStream?: (filePath: string) => Stream | undefined;
}

export class StreamsServiceImpl implements StreamsService {
	private app: App;
	private streamsPlugin: StreamsPlugin | null = null;

	constructor(app: App) {
		this.app = app;
		this.initializeStreamsPlugin();
	}

	/**
	 * Initialize the streams plugin reference
	 */
	private initializeStreamsPlugin() {
		// Wait for all plugins to load
		this.app.workspace.onLayoutReady(() => {
			// Access the streams plugin through the app's plugin manager
			const streamsPlugin = (this.app as any).plugins?.getPlugin('streams') as StreamsPlugin;
			this.streamsPlugin = streamsPlugin;
			
		});
	}

	/**
	 * Get all streams from the streams plugin
	 */
	public getAllStreams(): Stream[] {
		// Check if the streams plugin is available
		if (!this.streamsPlugin) {
			return [];
		}

		try {
			const streams = this.streamsPlugin.getStreams();
			return streams;
		} catch (error) {
			console.error('StreamsService: Error getting streams from plugin:', error);
			return [];
		}
	}

	/**
	 * Get streams by name
	 */
	public getStreamByName(name: string): Stream | undefined {
		const streams = this.getAllStreams();
		return streams.find(stream => stream.name.toLowerCase() === name.toLowerCase());
	}

	/**
	 * Get streams by folder path
	 */
	public getStreamByFolder(folder: string): Stream | undefined {
		const streams = this.getAllStreams();
		return streams.find(stream => stream.folder === folder);
	}

	/**
	 * Get streams by path (legacy method for backward compatibility)
	 * @deprecated Use getStreamByFolder instead
	 */
	public getStreamByPath(path: string): Stream | undefined {
		return this.getStreamByFolder(path);
	}

	/**
	 * Check if a stream exists
	 */
	public hasStream(name: string): boolean {
		return this.getStreamByName(name) !== undefined;
	}

	/**
	 * Get all stream names
	 */
	public getStreamNames(): string[] {
		return this.getAllStreams().map(stream => stream.name);
	}

	/**
	 * Get all stream folders
	 */
	public getStreamFolders(): string[] {
		return this.getAllStreams().map(stream => stream.folder);
	}

	/**
	 * Get all stream paths (legacy method for backward compatibility)
	 * @deprecated Use getStreamFolders instead
	 */
	public getStreamPaths(): string[] {
		return this.getStreamFolders();
	}

	/**
	 * Get streams that should be shown in the ribbon
	 */
	public getRibbonStreams(): Stream[] {
		return this.getAllStreams().filter(stream => stream.showTodayInRibbon);
	}

	/**
	 * Get streams that have commands enabled
	 */
	public getCommandStreams(): Stream[] {
		return this.getAllStreams().filter(stream => stream.addCommand);
	}

	/**
	 * Get streams by folder prefix (useful for filtering by parent folder)
	 */
	public getStreamsByFolderPrefix(prefix: string): Stream[] {
		return this.getAllStreams().filter(stream => stream.folder.startsWith(prefix));
	}

	/**
	 * Check if the streams plugin is available
	 */
	public isStreamsPluginAvailable(): boolean {
		return this.streamsPlugin !== null;
	}

	/**
	 * Get stream by ID
	 */
	public getStreamById(id: string): Stream | undefined {
		const streams = this.getAllStreams();
		return streams.find(stream => stream.id === id);
	}

	/**
	 * Check if a file belongs to any stream
	 */
	public isFileInStream(filePath: string): Stream | undefined {
		if (!this.streamsPlugin) {
			return undefined;
		}

		// First, try to use the plugin's built-in method if available
		if (this.streamsPlugin.isFileInStream) {
			try {
				return this.streamsPlugin.isFileInStream(filePath);
			} catch (error) {
				console.error('StreamsService: Error using plugin isFileInStream method:', error);
			}
		}

		// Fallback: Check if the file path matches any stream folder
		const streams = this.getAllStreams();
		for (const stream of streams) {
			if (filePath.startsWith(stream.folder)) {
				return stream;
			}
		}

		return undefined;
	}


	/**
	 * Update the stream bar from a file
	 * This method uses the new streams plugin API
	 */
	public async updateStreamBarFromFile(filePath: string): Promise<boolean> {
		if (!this.streamsPlugin) {
			return false;
		}

		// Use the new streams plugin API method
		if (this.streamsPlugin.updateStreamBarFromFile) {
				try {
					const result = await this.streamsPlugin.updateStreamBarFromFile(filePath);
					return result;
				} catch (error) {
					console.error('StreamsService: Error updating stream bar from file:', error);
					return false;
				}
		}

		return false;
	}
}
