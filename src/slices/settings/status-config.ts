// Status configuration with hex colors
export interface StatusConfig {
	symbol: string;
	name: string;
	description: string;
	color: string; // Hex color
	backgroundColor?: string; // Optional background color
}

export const STATUS_CONFIGS: StatusConfig[] = [
	{ symbol: ' ', name: 'To-do', description: 'Not started', color: '#6b7280', backgroundColor: 'transparent' },
	{ symbol: 'x', name: 'Done', description: 'Completed', color: '#ffffff', backgroundColor: '#10b981' },
	{ symbol: '/', name: 'In Progress', description: 'Incomplete', color: '#ffffff', backgroundColor: '#dc2626' },
	{ symbol: '!', name: 'Important', description: 'Top task', color: '#ffffff', backgroundColor: '#ef4444' },
	{ symbol: '?', name: 'Question', description: 'Needs clarification', color: '#ffffff', backgroundColor: '#f59e0b' },
	{ symbol: '*', name: 'Star', description: 'Marked', color: '#ffffff', backgroundColor: '#8b5cf6' },
	{ symbol: 'r', name: 'Review', description: 'In review', color: '#ffffff', backgroundColor: '#6b7280' },
	{ symbol: 'b', name: 'Blocked', description: 'Can\'t start', color: '#ffffff', backgroundColor: '#dc2626' },
	{ symbol: '<', name: 'Scheduled', description: 'On the calendar', color: '#ffffff', backgroundColor: '#059669' },
	{ symbol: '>', name: 'Forward', description: 'Another day', color: '#ffffff', backgroundColor: '#7c3aed' },
	{ symbol: '-', name: 'Cancelled', description: 'Not doing', color: '#ffffff', backgroundColor: '#9ca3af' }
];

export function getStatusConfig(symbol: string): StatusConfig | undefined {
	return STATUS_CONFIGS.find(config => config.symbol === symbol);
}

export function getStatusColor(symbol: string): string {
	const config = getStatusConfig(symbol);
	return config?.color || '#6b7280'; // Default gray color
}

export function getStatusBackgroundColor(symbol: string): string {
	const config = getStatusConfig(symbol);
	return config?.backgroundColor || 'transparent';
}
