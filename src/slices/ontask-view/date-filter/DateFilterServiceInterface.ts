import { App } from 'obsidian';
import type { OnTaskSettings } from '../../settings/SettingsServiceInterface';
import type { IconName } from '../../../shared/IconService';

/**
 * Date filter ID type.
 * Kept in sync with settings so persistence remains type-safe.
 */
export type DateFilterId = OnTaskSettings['dateFilter'];

/**
 * A single date filter definition.
 *
 * This is intentionally strategy-like: the UI renders these definitions, and
 * the task loader asks the selected definition how to filter file paths.
 */
export interface DateFilterDefinition {
	/**
	 * Stable identifier persisted in settings.
	 */
	id: DateFilterId;

	/**
	 * Button label shown in the segmented control.
	 */
	label: string;

	/**
	 * Icon name from the plugin's IconService mapping.
	 */
	icon: IconName;

	/**
	 * Determines whether the UI should allow "Load more" for this filter.
	 * Example: "Today" is usually a small set and historically did not use lazy loading.
	 */
	supportsLoadMore: boolean;

	/**
	 * Sort order for rendering in the segmented control.
	 * Lower numbers come first.
	 */
	order: number;

	/**
	 * Apply the filter to a list of file paths.
	 *
	 * IMPORTANT: Must not read file contents. Filtering should rely on file metadata/name/path only.
	 */
	filterFilePaths(filePaths: string[], app: App): string[];
}

export interface DateFilterService {
	/**
	 * Return all available date filters, sorted by display order.
	 */
	getAll(): DateFilterDefinition[];

	/**
	 * Get a single date filter definition by ID.
	 */
	getById(id: DateFilterId): DateFilterDefinition;

	/**
	 * Filter a set of file paths based on the given filter.
	 */
	filterFilePaths(id: DateFilterId, filePaths: string[], app: App): string[];

	/**
	 * Whether the selected filter supports lazy loading / "Load more".
	 */
	supportsLoadMore(id: DateFilterId): boolean;
}

