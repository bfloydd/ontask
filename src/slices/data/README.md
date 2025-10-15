# Data Service - Status Configuration Management

The Data Service handles all data persistence operations for the OnTask plugin, specifically managing status configuration data stored in `data.json`. This service is separate from the Settings Service to maintain clear separation of concerns.

## Quick Start

```typescript
import { DataService, DataServiceImpl } from './data';

// Initialize the service
const dataService = new DataServiceImpl(app, plugin);
await dataService.initialize();

// Get status configurations
const statusConfigs = dataService.getStatusConfigs();
const filteredConfigs = dataService.getFilteredStatusConfigs();

// Update status configuration
await dataService.updateStatusConfig('.', {
  symbol: '.',
  name: 'To-do',
  description: 'Not started',
  color: '#6b7280',
  backgroundColor: 'transparent',
  filtered: true
});
```

## Key Features

- **Status Configuration Management**: Full CRUD operations for task statuses
- **Single Source of Truth**: Uses `statusConfigs[].filtered` as the only filter state
- **Default Initialization**: Sets up default statuses if none exist
- **Data Persistence**: All changes saved to `data.json`
- **Error Handling**: Graceful handling of missing or corrupted data

## Architecture

### Data Flow
```
UI Components → StatusConfigService → DataService → data.json
```

### Service Dependencies
- **Obsidian Plugin**: For data persistence
- **Settings Interface**: For default status configurations

## API Reference

### Status Configuration Methods
- `getStatusConfigs()`: Get all status configurations
- `getStatusConfig(symbol)`: Get specific status by symbol
- `getFilteredStatusConfigs()`: Get only filtered (visible) statuses
- `updateStatusConfig(symbol, config)`: Update a status configuration
- `addStatusConfig(config)`: Add a new status
- `removeStatusConfig(symbol)`: Remove a status
- `reorderStatusConfigs(configs)`: Reorder status list

### Filter Management
- `getStatusFilters()`: Get current filter state
- `updateStatusFiltered(symbol, filtered)`: Update filter for a status

### Data Persistence
- `loadData()`: Load data from `data.json`
- `saveData()`: Save data to `data.json`

## Data Structure

The service manages data in `data.json` with the following structure:

```json
{
  "statusConfigs": [
    {
      "symbol": ".",
      "name": "To-do",
      "description": "Not started",
      "color": "#6b7280",
      "backgroundColor": "transparent",
      "filtered": true
    }
  ]
}
```

The `filtered` property in each status configuration is the single source of truth for filter state. The `getStatusFilters()` method derives the filter state from these properties.

## Integration

### With StatusConfigService
The DataService is used by StatusConfigService to provide a clean API for status management:

```typescript
// StatusConfigService wraps DataService
const statusConfigService = new StatusConfigService(dataService);

// Provides additional utility methods
const color = statusConfigService.getStatusColor('.');
const bgColor = statusConfigService.getStatusBackgroundColor('.');
```

### With UI Components
StatusConfigView and OnTaskView use StatusConfigService, which internally uses DataService:

```typescript
// UI components don't directly use DataService
const statusConfigs = statusConfigService.getStatusConfigs();
await statusConfigService.updateStatusFiltered('.', false);
```

## Error Handling

The service includes comprehensive error handling:

- **Load Errors**: Returns empty data if `data.json` is missing or corrupted
- **Save Errors**: Logs errors but doesn't crash the plugin
- **Validation**: Ensures data integrity before saving
- **Fallbacks**: Uses default values when data is unavailable

## Performance

- **In-Memory Caching**: Data is kept in memory for fast access
- **Batch Operations**: Multiple changes can be batched before saving
- **Lazy Loading**: Data is only loaded when needed
- **Change Detection**: Only saves when data actually changes

## Future Enhancements

- **Event Emission**: Emit events when data changes for reactive updates
- **Data Validation**: Add schema validation for data integrity
- **Backup/Restore**: Add data backup and restore functionality
- **Migration System**: Handle data format migrations automatically
