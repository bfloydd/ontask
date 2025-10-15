# Data Service Specification

## Purpose
Manages status configuration data in `data.json`. Separate from Settings Service.

## Data Structure
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

## Key Responsibilities
- **Status Configuration**: Full CRUD operations for task statuses
- **Single Source of Truth**: `statusConfigs[].filtered` is the only filter state
- **Default Initialization**: Sets up default statuses if none exist
- **Data Persistence**: All changes saved to `data.json`

## Initialization
1. Load data from `data.json`
2. If no `statusConfigs`, initialize with `DEFAULT_STATUS_CONFIGS`
3. Save if defaults applied

## Data Flow
- **Read**: OnTaskView → StatusConfigService → DataService → data.json
- **Update**: StatusConfigView → StatusConfigService → DataService → data.json
