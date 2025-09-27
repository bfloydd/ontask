// Streams Service - Handles stream data management
import { App, Plugin } from 'obsidian';

// Import the Stream type from the streams plugin
// Note: This assumes the streams plugin exports its types
// If the import path is different, adjust accordingly
export interface Stream {
	id: string; // Unique identifier (UUID)
	name: string; // Display name (e.g., "Daily Notes")
	folder: string; // Folder path (e.g., "Assets/Streams/Per")
	icon: string; // Icon name (e.g., "calendar")
	showTodayInRibbon: boolean; // Whether to show in ribbon
	addCommand: boolean; // Whether to add to command palette
}

// Type for the streams plugin
interface StreamsPlugin extends Plugin {
	getStreams(): Stream[];
}

export class StreamsService {
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
			
			if (this.streamsPlugin) {
				console.log('StreamsService: Streams plugin found and initialized');
			} else {
				console.log('StreamsService: Streams plugin not found or not loaded');
			}
		});
	}

	/**
	 * Get all streams from the streams plugin
	 */
	public getAllStreams(): Stream[] {
		// Check if the streams plugin is available
		if (!this.streamsPlugin) {
			console.log('StreamsService: Streams plugin not ready yet, returning empty array');
			return [];
		}

		try {
			const streams = this.streamsPlugin.getStreams();
			console.log('StreamsService: Retrieved streams from plugin:', streams);
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

}
