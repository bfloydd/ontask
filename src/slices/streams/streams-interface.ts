// Streams slice - Interface definitions
import { App } from 'obsidian';

export interface Stream {
	id: string; // Unique identifier (UUID)
	name: string; // Display name (e.g., "Daily Notes")
	folder: string; // Folder path (e.g., "Assets/Streams/Per")
	icon: string; // Icon name (e.g., "calendar")
	showTodayInRibbon: boolean; // Whether to show in ribbon
	addCommand: boolean; // Whether to add to command palette
}

export interface StreamsService {
	// Core stream operations
	getAllStreams(): Stream[];
	getStreamByName(name: string): Stream | undefined;
	getStreamByFolder(folder: string): Stream | undefined;
	getStreamById(id: string): Stream | undefined;
	
	// Stream filtering
	hasStream(name: string): boolean;
	getStreamNames(): string[];
	getStreamFolders(): string[];
	getRibbonStreams(): Stream[];
	getCommandStreams(): Stream[];
	getStreamsByFolderPrefix(prefix: string): Stream[];
	
	// Plugin status
	isStreamsPluginAvailable(): boolean;
}
