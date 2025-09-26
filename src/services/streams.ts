// Streams Service - Handles stream data management

export interface Stream {
	name: string;
	path: string;
}

export class StreamsService {
	/**
	 * Get all streams - stubbed implementation with canned data
	 */
	public getAllStreams(): Stream[] {
		// Stub implementation with canned data
		const cannedStreams: Stream[] = [
			{ name: "Personal", path: "Assets/Streams/Per" },
			{ name: "Work", path: "Assets/Streams/Work" }
		];
		
		console.log('StreamsService: Returning canned streams data:', cannedStreams);
		return cannedStreams;
	}

	/**
	 * Get streams by name
	 */
	public getStreamByName(name: string): Stream | undefined {
		const streams = this.getAllStreams();
		return streams.find(stream => stream.name.toLowerCase() === name.toLowerCase());
	}

	/**
	 * Get streams by path
	 */
	public getStreamByPath(path: string): Stream | undefined {
		const streams = this.getAllStreams();
		return streams.find(stream => stream.path === path);
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
	 * Get all stream paths
	 */
	public getStreamPaths(): string[] {
		return this.getAllStreams().map(stream => stream.path);
	}
}
