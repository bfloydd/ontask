import { App, TFile } from 'obsidian';
import { DateFileUtils } from '../../../shared/DateFileUtils';
import type { DateFilterDefinition, DateFilterId, DateFilterService } from './DateFilterServiceInterface';

/**
 * Default implementation backed by a small registry.
 *
 * This keeps UI and filtering logic out of view/control classes, and makes the
 * behavior pluggable (register new filters without changing consumers).
 */
export class DateFilterServiceImpl implements DateFilterService {
	private readonly registry = new Map<DateFilterId, DateFilterDefinition>();

	constructor() {
		this.registerBuiltIns();
	}

	getAll(): DateFilterDefinition[] {
		return Array.from(this.registry.values()).sort((a, b) => a.order - b.order);
	}

	getById(id: DateFilterId): DateFilterDefinition {
		const filter = this.registry.get(id);
		if (!filter) {
			throw new Error(`[OnTask DateFilter] Unknown date filter: ${id}`);
		}
		return filter;
	}

	filterFilePaths(id: DateFilterId, filePaths: string[], app: App): string[] {
		return this.getById(id).filterFilePaths(filePaths, app);
	}

	supportsLoadMore(id: DateFilterId): boolean {
		return this.getById(id).supportsLoadMore;
	}

	/**
	 * Register (or override) a date filter definition.
	 * Kept private for now; if we later allow extensions, we can promote this to public.
	 */
	private register(definition: DateFilterDefinition): void {
		this.registry.set(definition.id, definition);
	}

	private registerBuiltIns(): void {
		this.register({
			id: 'today',
			label: 'Today',
			icon: 'calendar',
			supportsLoadMore: false,
			order: 10,
			filterFilePaths: (filePaths, app) => {
				return filePaths.filter((filePath) => {
					const file = app.vault.getAbstractFileByPath(filePath);
					return file instanceof TFile && DateFileUtils.isTodayFile(file);
				});
			}
		});

		this.register({
			id: 'week',
			label: 'Week',
			icon: 'calendar',
			supportsLoadMore: true,
			order: 20,
			filterFilePaths: (filePaths, app) => {
				return filePaths.filter((filePath) => {
					const file = app.vault.getAbstractFileByPath(filePath);
					return file instanceof TFile && DateFileUtils.isCurrentWeekFile(file);
				});
			}
		});

		this.register({
			id: 'all',
			label: 'All',
			icon: 'calendar',
			supportsLoadMore: true,
			order: 30,
			filterFilePaths: (filePaths) => filePaths
		});
	}
}

