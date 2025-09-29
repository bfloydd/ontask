// Editor integration slice - Interface definitions

export interface EditorIntegrationService {
	// Initialize editor integration service
	initialize(): Promise<void>;
	
	// Update editor decorations based on settings
	updateEditorDecorations(): Promise<void>;
	
	// Clean up editor decorations
	cleanup(): void;
	
	// Check if editor integration is enabled
	isEnabled(): boolean;
}
