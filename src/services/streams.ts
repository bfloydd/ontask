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
			console.log('StreamsService: Streams plugin not available, returning empty array');
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

	/**
	 * Validate the streams plugin integration
	 * Returns detailed validation results
	 */
	public validateIntegration(): {
		isPluginAvailable: boolean;
		pluginObject: any;
		streamsCount: number;
		streams: Stream[];
		errors: string[];
		warnings: string[];
	} {
		const result = {
			isPluginAvailable: false,
			pluginObject: null,
			streamsCount: 0,
			streams: [] as Stream[],
			errors: [] as string[],
			warnings: [] as string[]
		};

		// Check if plugin is available
		result.isPluginAvailable = this.isStreamsPluginAvailable();
		
		// Get the plugin object for inspection
		try {
			result.pluginObject = (this.app as any).plugins?.getPlugin('streams');
		} catch (error) {
			result.errors.push(`Error accessing streams plugin: ${error}`);
		}

		// Check if plugin object exists
		if (!result.pluginObject) {
			result.errors.push('Streams plugin object is null or undefined');
			return result;
		}

		// Check if getStreams method exists
		if (typeof (result.pluginObject as any)?.getStreams !== 'function') {
			result.errors.push('Streams plugin does not have getStreams() method');
			return result;
		}

		// Try to get streams
		try {
			result.streams = this.getAllStreams();
			result.streamsCount = result.streams.length;
		} catch (error) {
			result.errors.push(`Error calling getStreams(): ${error}`);
			return result;
		}

		// Validate stream structure
		result.streams.forEach((stream, index) => {
			if (!stream.id) {
				result.warnings.push(`Stream ${index} missing id property`);
			}
			if (!stream.name) {
				result.warnings.push(`Stream ${index} missing name property`);
			}
			if (!stream.folder) {
				result.warnings.push(`Stream ${index} missing folder property`);
			}
			if (typeof stream.showTodayInRibbon !== 'boolean') {
				result.warnings.push(`Stream ${index} showTodayInRibbon is not boolean`);
			}
			if (typeof stream.addCommand !== 'boolean') {
				result.warnings.push(`Stream ${index} addCommand is not boolean`);
			}
		});

		// Check for common issues
		if (result.streamsCount === 0) {
			result.warnings.push('No streams found - this might be normal if no streams are configured');
		}

		return result;
	}

	/**
	 * Get detailed debug information about the streams plugin
	 */
	public getDebugInfo(): {
		appPlugins: any;
		streamsPlugin: any;
		streamsPluginMethods: string[];
		streamsPluginProperties: string[];
		validation: any;
	} {
		const appPlugins = (this.app as any).plugins;
		const streamsPlugin = appPlugins?.getPlugin('streams');
		
		return {
			appPlugins: appPlugins ? Object.keys(appPlugins) : 'Not available',
			streamsPlugin: streamsPlugin ? 'Available' : 'Not available',
			streamsPluginMethods: streamsPlugin ? Object.getOwnPropertyNames(Object.getPrototypeOf(streamsPlugin)) : [],
			streamsPluginProperties: streamsPlugin ? Object.keys(streamsPlugin) : [],
			validation: this.validateIntegration()
		};
	}
}
