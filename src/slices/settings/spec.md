# Settings Service Specification

## Purpose
Manages plugin configuration settings. Separate from status configuration (handled by Data Service).

## Settings vs Data Separation

### Settings Service
- Plugin behavior and display options
- UI preferences and visibility settings
- Data source configuration (streams, daily-notes, folder)
- Performance settings (load limits)

### Data Service (Separate)
- Status configuration (symbols, colors, descriptions)
- Status filtering (via `statusConfigs[].filtered` property)
- Status management (add, remove, reorder)

## Settings Schema
```typescript
interface OnTaskSettings {
  dateFilter: 'all' | 'today';
  topTaskColor: string;
  showTopTaskInEditor: boolean;
  checkboxSource: 'streams' | 'daily-notes' | 'folder';
  customFolderPath: string;
  includeSubfolders: boolean;
  loadMoreLimit: number;
  hideCompletedTasks: boolean;
}
```

## Settings Categories
- **Display**: `dateFilter`, `topTaskColor`, `hideCompletedTasks`
- **UI Integration**: `showTopTaskInEditor`
- **Data Source**: `checkboxSource`, `customFolderPath`, `includeSubfolders`
- **Performance**: `loadMoreLimit`

## Persistence
- Stored in Obsidian's plugin data system
- Changes emit events for reactive updates
- Graceful fallback to defaults for missing settings
