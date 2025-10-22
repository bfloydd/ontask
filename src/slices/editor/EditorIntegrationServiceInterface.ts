export interface EditorIntegrationService {
	initialize(): Promise<void>;
	updateEditorDecorations(): Promise<void>;
	cleanup(): void;
	isEnabled(): boolean;
}
