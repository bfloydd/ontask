# Dependency Injection Service Specification

## Purpose
Centralized service dependency management and lifecycle control.

## Architecture
- **DIContainer**: Service registration and resolution
- **Service Configuration**: Centralized service setup
- **Factory Pattern**: Lazy service creation with dependency injection

## Service Types
- **Singleton**: Created once, shared across plugin lifecycle
- **Transient**: Created fresh for each resolution

## Dependency Graph
```
App, Plugin (Core)
    ↓
EventSystem
    ↓
DataService → StatusConfigService
    ↓
SettingsService
    ↓
StreamsService
    ↓
TaskLoadingService (Primary Task Loading)
    ├── Creates TaskFinderFactory internally
    └── Manages all task finding strategies
    ↓
EditorIntegrationService, PluginOrchestrator
```

## Benefits
- **Loose Coupling**: Services depend on interfaces, not implementations
- **Centralized Configuration**: All dependencies defined in one place
- **Lifecycle Management**: Automatic creation and cleanup
- **Testability**: Easy to mock services for testing
