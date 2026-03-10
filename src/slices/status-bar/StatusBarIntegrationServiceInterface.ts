export interface StatusBarIntegrationService {
	initialize(): Promise<void>;
	updateStatusBar(): Promise<void>;
	cleanup(): void;
	isEnabled(): boolean;
}
