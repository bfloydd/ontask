export interface Stream {
	id: string;
	name: string;
	folder?: string;
	dateFormat?: string;
	icon: string;
	showTodayInRibbon: boolean;
	addCommand: boolean;
}

export interface StreamsService {
	getAllStreams(): Stream[];
	getStreamByName(name: string): Stream | undefined;
	getStreamByFolder(folder: string): Stream | undefined;
	getStreamById(id: string): Stream | undefined;

	hasStream(name: string): boolean;
	getStreamNames(): string[];
	getStreamFolders(): string[];
	getStreamBaseFolder(stream: Stream): string;
	getRibbonStreams(): Stream[];
	getCommandStreams(): Stream[];
	getStreamsByFolderPrefix(prefix: string): Stream[];

	isFileInStream(filePath: string): Stream | undefined;
	updateStreamBarFromFile(filePath: string): Promise<boolean>;

	isStreamsPluginAvailable(): boolean;
}
