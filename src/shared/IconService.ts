import { Logger } from '../slices/logging/Logger';
import { getIcon, getIconIds, setIcon } from 'obsidian';

/**
 * Icon Service - Wrapper around Obsidian's native icon system
 * Provides a centralized way to access icons while leveraging Obsidian's built-in iconography.
 * Uses Lucide icons via Obsidian's getIcon() API for theme compatibility and consistency.
 */

export interface IconOptions {
	width?: number;
	height?: number;
	className?: string;
}

/**
 * Maps custom icon names to Obsidian/Lucide icon IDs
 * All icons use Lucide icon library which is built into Obsidian
 */
const ICON_MAP: Record<IconName, string> = {
	'calendar': 'calendar',
	'search': 'search',
	'filter': 'filter',
	'refresh-cw': 'refresh-cw',
	'settings': 'settings',
};

const CONFIG_ICON_MAP: Record<ConfigIconName, string> = {
	'edit': 'pencil',
	'delete': 'trash-2',
	'grip-vertical': 'grip-vertical',
};

export class IconService {
	private static logger: Logger | null = null;
	private static availableIconIds: Set<string> | null = null;

	/**
	 * Set logger instance for icon service warnings
	 */
	static setLogger(logger: Logger | null): void {
		IconService.logger = logger;
	}

	/**
	 * Initialize available icon IDs cache (called once for performance)
	 */
	private static initializeIconCache(): void {
		if (IconService.availableIconIds === null) {
			try {
				const iconIds = getIconIds();
				IconService.availableIconIds = new Set(iconIds);
			} catch (error) {
				if (IconService.logger) {
					IconService.logger.warn('[OnTask IconService] Failed to get icon IDs from Obsidian');
				}
				IconService.availableIconIds = new Set();
			}
		}
	}

	/**
	 * Get an SVG element using Obsidian's native icon system
	 * @param iconName - The custom icon name
	 * @param options - Icon styling options
	 * @returns SVG element or null if icon not found
	 */
	static getIconElement(iconName: IconName, options: IconOptions = {}): SVGSVGElement | null {
		IconService.initializeIconCache();
		const obsidianIconId = ICON_MAP[iconName];

		if (!obsidianIconId) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Icon "${iconName}" not mapped`);
			}
			return null;
		}

		// Check if icon is available
		if (IconService.availableIconIds && !IconService.availableIconIds.has(obsidianIconId)) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Obsidian icon "${obsidianIconId}" not found`);
			}
			return null;
		}

		try {
			const iconElement = getIcon(obsidianIconId);
			if (!iconElement) {
				return null;
			}

			// Clone to avoid modifying the original
			const clonedIcon = iconElement.cloneNode(true) as SVGSVGElement;

			// Apply styling options
			const { width = 14, height = 14, className = '' } = options;
			if (width) {
				clonedIcon.style.width = `${width}px`;
			}
			if (height) {
				clonedIcon.style.height = `${height}px`;
			}
			if (className) {
				clonedIcon.classList.add(...className.split(' ').filter(Boolean));
			}

			return clonedIcon;
		} catch (error) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Failed to get icon "${obsidianIconId}": ${error}`);
			}
			return null;
		}
	}

	/**
	 * Get a config icon SVG element using Obsidian's native icon system
	 * @param iconName - The custom config icon name
	 * @param options - Icon styling options
	 * @returns SVG element or null if icon not found
	 */
	static getConfigIconElement(iconName: ConfigIconName, options: IconOptions = {}): SVGSVGElement | null {
		IconService.initializeIconCache();
		const obsidianIconId = CONFIG_ICON_MAP[iconName];

		if (!obsidianIconId) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Config icon "${iconName}" not mapped`);
			}
			return null;
		}

		if (IconService.availableIconIds && !IconService.availableIconIds.has(obsidianIconId)) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Obsidian icon "${obsidianIconId}" not found`);
			}
			return null;
		}

		try {
			const iconElement = getIcon(obsidianIconId);
			if (!iconElement) {
				return null;
			}

			const clonedIcon = iconElement.cloneNode(true) as SVGSVGElement;

			const { width = 14, height = 14, className = '' } = options;
			if (width) {
				clonedIcon.style.width = `${width}px`;
			}
			if (height) {
				clonedIcon.style.height = `${height}px`;
			}
			if (className) {
				clonedIcon.classList.add(...className.split(' ').filter(Boolean));
			}

			return clonedIcon;
		} catch (error) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Failed to get config icon "${obsidianIconId}": ${error}`);
			}
			return null;
		}
	}

	/**
	 * Set an icon directly on an HTML element using Obsidian's setIcon API
	 * This is the recommended approach for setting icons on buttons/containers
	 * @param parent - The parent element to set the icon on
	 * @param iconName - The custom icon name
	 */
	static setIcon(parent: HTMLElement, iconName: IconName): void {
		const obsidianIconId = ICON_MAP[iconName];
		if (!obsidianIconId) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Icon "${iconName}" not mapped for setIcon`);
			}
			return;
		}

		try {
			setIcon(parent, obsidianIconId);
		} catch (error) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Failed to set icon "${obsidianIconId}": ${error}`);
			}
		}
	}

	/**
	 * Set a config icon directly on an HTML element using Obsidian's setIcon API
	 * @param parent - The parent element to set the icon on
	 * @param iconName - The custom config icon name
	 */
	static setConfigIcon(parent: HTMLElement, iconName: ConfigIconName): void {
		const obsidianIconId = CONFIG_ICON_MAP[iconName];
		if (!obsidianIconId) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Config icon "${iconName}" not mapped for setIcon`);
			}
			return;
		}

		try {
			setIcon(parent, obsidianIconId);
		} catch (error) {
			if (IconService.logger) {
				IconService.logger.warn(`[OnTask IconService] Failed to set config icon "${obsidianIconId}": ${error}`);
			}
		}
	}

	/**
	 * Get SVG HTML string for an icon (backward compatibility)
	 * @deprecated Use getIconElement() or setIcon() instead for better theme compatibility
	 */
	static getIcon(iconName: IconName, options: IconOptions = {}): string {
		const iconElement = IconService.getIconElement(iconName, options);
		if (!iconElement) {
			return '';
		}
		return iconElement.outerHTML;
	}

	/**
	 * Get SVG HTML string for a config icon (backward compatibility)
	 * @deprecated Use getConfigIconElement() or setConfigIcon() instead for better theme compatibility
	 */
	static getConfigIcon(iconName: ConfigIconName, options: IconOptions = {}): string {
		const iconElement = IconService.getConfigIconElement(iconName, options);
		if (!iconElement) {
			return '';
		}
		return iconElement.outerHTML;
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



