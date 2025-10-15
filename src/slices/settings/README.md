# Settings Service - Plugin Configuration Management

The Settings Service manages plugin configuration settings that control behavior and display options. It is separate from status configuration, which is handled by the Data Service.

## Quick Start

```typescript
import { SettingsService, SettingsServiceImpl } from './settings';

// Initialize the service
const settingsService = new SettingsServiceImpl(app, plugin, eventSystem);
await settingsService.initialize();

// Get current settings
const settings = settingsService.getSettings();

// Update a setting
await settingsService.updateSetting('loadMoreLimit', 20);

// Listen for changes
const unsubscribe = settingsService.onSettingsChange((event) => {
  console.log(`Setting ${event.key} changed from ${event.oldValue} to ${event.value}`);
});
```

## Settings Categories

### Display Settings
- `onlyShowToday`: Show only today's tasks
- `topTaskColor`: Visual theme for top task
- `hideCompletedTasks`: Hide completed tasks from view

### UI Integration
- `showTopTaskInStatusBar`: Show top task in Obsidian status bar
- `showTopTaskInEditor`: Show top task overlay in editor

### Data Source
- `checkboxSource`: Where to find tasks (streams, daily-notes, folder)
- `customFolderPath`: Custom folder for task search
- `includeSubfolders`: Whether to search subfolders

### Performance
- `loadMoreLimit`: Number of tasks to load per batch

## API Reference

### Core Methods
```typescript
// Lifecycle
await settingsService.initialize();
const settings = settingsService.getSettings();

// Single setting update
await settingsService.updateSetting('loadMoreLimit', 20);

// Multiple settings update
await settingsService.updateSettings({
  onlyShowToday: true,
  hideCompletedTasks: true
});

// Reset to defaults
await settingsService.resetToDefaults();

// Event handling
const unsubscribe = settingsService.onSettingsChange(callback);

// Utility
const isAvailable = settingsService.isDailyNotesAvailable();
```

### Settings Interface
```typescript
interface OnTaskSettings {
  onlyShowToday: boolean;
  topTaskColor: string;
  showTopTaskInStatusBar: boolean;
  showTopTaskInEditor: boolean;
  checkboxSource: 'streams' | 'daily-notes' | 'folder';
  customFolderPath: string;
  includeSubfolders: boolean;
  loadMoreLimit: number;
  hideCompletedTasks: boolean;
}
```

## Event System Integration

### Settings Change Events
Settings changes emit events that other components can listen to:

```typescript
// Listen for specific setting changes
settingsService.onSettingsChange((event) => {
  if (event.key === 'showTopTaskInEditor') {
    // React to editor setting change
    updateEditorIntegration(event.value);
  }
});

// Event structure
interface SettingsChangeEvent {
  key: keyof OnTaskSettings;
  value: any;
  oldValue: any;
}
```

### Event System Events
Settings changes also emit events through the Event System:

```typescript
// Listen via Event System
eventSystem.on('settings:changed', (event) => {
  console.log(`Setting ${event.data.key} changed`);
});
```

## Default Settings

```typescript
const DEFAULT_SETTINGS: OnTaskSettings = {
  onlyShowToday: false,
  topTaskColor: 'neutral',
  showTopTaskInStatusBar: true,
  showTopTaskInEditor: true,
  checkboxSource: 'streams',
  customFolderPath: '',
  includeSubfolders: true,
  loadMoreLimit: 10,
  hideCompletedTasks: false
};
```

## Settings vs Data Separation

### Settings Service Handles
- Plugin behavior and display options
- UI preferences and visibility settings
- Data source configuration
- Performance settings

### Data Service Handles (Separate)
- Status configuration (symbols, colors, descriptions)
- Status filtering (via `statusConfigs[].filtered` property)
- Status management (add, remove, reorder)
- Data persistence in `data.json`

## Persistence

### Storage
- Settings are stored in Obsidian's plugin data system
- Accessed via `plugin.loadData()` and `plugin.saveData()`
- Automatically managed by Obsidian

### Data Integrity
- Preserves user preferences during updates
- Graceful fallback to defaults for missing settings

## Error Handling

- **Load Errors**: Gracefully handle missing or corrupted settings
- **Save Errors**: Log errors but don't crash the plugin
- **Validation**: Ensure setting values are within valid ranges
- **Fallbacks**: Use default values when settings are unavailable

## Usage Examples

### Basic Settings Management
```typescript
// Get all settings
const settings = settingsService.getSettings();
console.log(`Load limit: ${settings.loadMoreLimit}`);

// Update single setting
await settingsService.updateSetting('loadMoreLimit', 20);

// Update multiple settings
await settingsService.updateSettings({
  onlyShowToday: true,
  hideCompletedTasks: true,
  loadMoreLimit: 15
});
```

### Event-Driven Updates
```typescript
// Listen for changes and react
const unsubscribe = settingsService.onSettingsChange((event) => {
  switch (event.key) {
    case 'showTopTaskInEditor':
      if (event.value) {
        enableEditorIntegration();
      } else {
        disableEditorIntegration();
      }
      break;
    case 'loadMoreLimit':
      updateLoadLimit(event.value);
      break;
  }
});

// Clean up listener
unsubscribe();
```

### Settings Validation
```typescript
// Validate setting values
const validateLoadLimit = (value: number) => {
  if (value < 1 || value > 100) {
    throw new Error('Load limit must be between 1 and 100');
  }
};

// Use validation
await settingsService.updateSetting('loadMoreLimit', 50);
```

## Integration with Other Services

### StatusConfigService
- Settings and status configuration are separate concerns
- StatusConfigService handles status data via DataService
- SettingsService handles plugin behavior and UI preferences

### EventSystem
- Settings changes emit events for reactive updates
- Other services can listen for specific setting changes
- Enables loose coupling between components

### UI Components
- SettingsView provides UI for editing settings
- StatusConfigView provides UI for status configuration
- Clear separation of concerns in UI

## Future Enhancements

- **Settings Validation**: Add schema validation for settings
- **Settings Categories**: Group related settings in UI
- **Import/Export**: Allow settings backup and restore
- **Advanced Options**: Add more granular control options
- **Settings Search**: Search and filter settings
- **Settings Profiles**: Save and load different setting profiles
