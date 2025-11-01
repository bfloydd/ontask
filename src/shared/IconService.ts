/**
 * Icon Service - Centralized SVG icon management
 * Provides reusable SVG icon definitions for consistent iconography across the plugin
 */

export interface IconOptions {
	width?: number;
	height?: number;
	className?: string;
}

export class IconService {
	/**
	 * Get SVG HTML string for an icon
	 */
	static getIcon(iconName: IconName, options: IconOptions = {}): string {
		const { width = 14, height = 14, className = '' } = options;
		const icon = ICONS[iconName];
		
		if (!icon) {
			console.warn(`Icon "${iconName}" not found`);
			return '';
		}

		// Extract viewBox if present in icon definition
		const viewBoxMatch = icon.match(/viewBox="([^"]+)"/);
		const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

		// Build class string
		const classes = ['lucide', `lucide-${iconName}`, className].filter(Boolean).join(' ');

		// Replace attributes in the icon SVG
		let svgHtml = icon
			.replace(/width="[^"]*"/, `width="${width}"`)
			.replace(/height="[^"]*"/, `height="${height}"`)
			.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);

		// Ensure class attribute is set correctly
		if (svgHtml.includes('class=')) {
			svgHtml = svgHtml.replace(/class="[^"]*"/, `class="${classes}"`);
		} else {
			// Insert class attribute after <svg
			svgHtml = svgHtml.replace('<svg', `<svg class="${classes}"`);
		}

		return svgHtml;
	}

	/**
	 * Get SVG HTML string for a config button icon
	 */
	static getConfigIcon(iconName: ConfigIconName, options: IconOptions = {}): string {
		const { width = 14, height = 14, className = '' } = options;
		const icon = CONFIG_ICONS[iconName];
		
		if (!icon) {
			console.warn(`Config icon "${iconName}" not found`);
			return '';
		}

		const viewBoxMatch = icon.match(/viewBox="([^"]+)"/);
		const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

		const classes = className ? className : '';
		let svgHtml = icon
			.replace(/width="[^"]*"/, `width="${width}"`)
			.replace(/height="[^"]*"/, `height="${height}"`)
			.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);

		if (svgHtml.includes('class=')) {
			svgHtml = svgHtml.replace(/class="[^"]*"/, `class="${classes}"`);
		} else if (classes) {
			svgHtml = svgHtml.replace('<svg', `<svg class="${classes}"`);
		}

		return svgHtml;
	}
}

export type IconName = 
	| 'calendar'
	| 'search'
	| 'filter'
	| 'refresh-cw'
	| 'settings';

export type ConfigIconName =
	| 'edit'
	| 'delete'
	| 'grip-vertical';

// Lucide icons used in the UI
const ICONS: Record<IconName, string> = {
	'calendar': '<svg class="lucide lucide-calendar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
	'search': '<svg class="lucide lucide-search" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
	'filter': '<svg class="lucide lucide-filter" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg>',
	'refresh-cw': '<svg class="lucide lucide-refresh-cw" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>',
	'settings': '<svg class="lucide lucide-settings" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>'
};

// Config/edit/action icons (non-Lucide)
const CONFIG_ICONS: Record<ConfigIconName, string> = {
	'edit': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
	'delete': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
	'grip-vertical': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>'
};


