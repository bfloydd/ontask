# OnTask Plugin - Vertical Slice Architecture

## 🏗️ Architecture Overview

This plugin follows **Vertical Slice Architecture** principles, organizing code by business capabilities rather than technical layers.

## 📁 Slice Structure

```
src/
├── slices/
│   ├── settings/           # Settings management slice
│   │   ├── settings-interface.ts
│   │   ├── settings-service.ts
│   │   ├── settings-view.ts
│   │   └── index.ts
│   ├── plugin/             # Plugin orchestration slice
│   │   ├── plugin-orchestration-interface.ts
│   │   ├── plugin-orchestration-service.ts
│   │   └── index.ts
│   ├── events/             # Event system slice
│   │   ├── event-system-interface.ts
│   │   ├── event-system-service.ts
│   │   └── index.ts
│   ├── di/                 # Dependency injection slice
│   │   ├── di-container-interface.ts
│   │   ├── di-container-service.ts
│   │   ├── service-configuration.ts
│   │   └── index.ts
│   └── ontask-view/        # UI view slice
│       ├── ontask-view-interface.ts
│       ├── ontask-view.ts
│       └── index.ts
│   ├── checkbox-finder/    # Checkbox finding slice
│   │   ├── interfaces.ts
│   │   ├── checkbox-finder-service.ts
│   │   ├── checkbox-finder-factory.ts
│   │   ├── strategies/
│   │   │   ├── streams-strategy.ts
│   │   │   ├── daily-notes-strategy.ts
│   │   │   └── folder-strategy.ts
│   │   └── index.ts
│   └── streams/            # Streams slice
│       ├── streams-interface.ts
│       ├── streams-service.ts
│       └── index.ts
```

## 🎯 Slice Responsibilities

### **Settings Slice**
- **Purpose**: Manage all plugin settings
- **Responsibilities**: Settings storage, validation, change events
- **Dependencies**: Event system
- **Exports**: SettingsService, OnTaskSettingsTab

### **Plugin Orchestration Slice**
- **Purpose**: Coordinate plugin lifecycle and UI
- **Responsibilities**: UI setup, event handling, service coordination
- **Dependencies**: All other slices via events
- **Exports**: PluginOrchestrator

### **Event System Slice**
- **Purpose**: Enable loose coupling between slices
- **Responsibilities**: Event publishing, subscription, async handling
- **Dependencies**: None (pure utility)
- **Exports**: EventSystem

### **Dependency Injection Slice**
- **Purpose**: Manage service dependencies and lifecycle
- **Responsibilities**: Service registration, resolution, configuration
- **Dependencies**: None (pure utility)
- **Exports**: DIContainer, ServiceConfiguration

### **Checkbox Finder Slice**
- **Purpose**: Find checkboxes from various sources
- **Responsibilities**: Strategy pattern implementation, checkbox parsing
- **Dependencies**: Streams service, event system
- **Exports**: CheckboxFinderService, strategies

### **OnTask View Slice**
- **Purpose**: Provide the main UI view for task management
- **Responsibilities**: View rendering, user interactions, checkbox toggling
- **Dependencies**: CheckboxFinderService, SettingsService, EventSystem
- **Exports**: OnTaskView, OnTaskViewInterface

### **Checkbox Finder Slice**
- **Purpose**: Find checkboxes from various sources using strategy pattern
- **Responsibilities**: Strategy pattern implementation, checkbox parsing, multiple finding strategies
- **Dependencies**: StreamsService, EventSystem
- **Exports**: CheckboxFinderService, CheckboxFinderFactory, strategies

### **Streams Slice**
- **Purpose**: Manage stream data from the Streams plugin
- **Responsibilities**: Stream retrieval, filtering, plugin integration
- **Dependencies**: None (pure utility)
- **Exports**: StreamsService, Stream interface

## 🔄 Communication Patterns

### **Event-Driven Communication**
```typescript
// Slices communicate via events, not direct calls
eventSystem.emit('settings:changed', { key, value, oldValue });
eventSystem.on('settings:changed', (event) => { /* handle */ });
```

### **Dependency Injection**
```typescript
// Services are resolved from DI container
const settingsService = container.resolve<SettingsService>(SERVICE_IDS.SETTINGS_SERVICE);
```

### **Strategy Pattern**
```typescript
// Pluggable checkbox finding strategies
checkboxFinder.setActiveStrategies(['streams', 'daily-notes']);
```

## ✅ Benefits Achieved

### **1. Vertical Slices**
- Each slice handles one business capability
- Self-contained with clear boundaries
- Easy to understand and modify

### **2. Loose Coupling**
- Slices communicate via events
- No direct dependencies between slices
- Easy to test in isolation

### **3. High Cohesion**
- Related functionality grouped together
- Clear single responsibility per slice
- Easy to locate and modify features

### **4. Testability**
- Each slice can be tested independently
- Easy to mock dependencies
- Clear interfaces for testing

### **5. Maintainability**
- Changes to one slice don't affect others
- Clear separation of concerns
- Easy to add new features

### **6. Extensibility**
- Easy to add new checkbox strategies
- Simple to add new event types
- Straightforward to add new services

## 🚀 Usage Examples

### **Adding a New Checkbox Strategy**
```typescript
class DatabaseCheckboxStrategy implements CheckboxFinderStrategy {
  // Implementation
}

// Register with factory
factory.registerStrategy('database', new DatabaseCheckboxStrategy());
```

### **Adding a New Event**
```typescript
// In event-system-interface.ts
export interface OnTaskEvents {
  'new-feature:action': { data: any };
}

// Emit event
eventSystem.emit('new-feature:action', { data: 'value' });
```

### **Adding a New Service**
```typescript
// In service-configuration.ts
container.registerSingleton(SERVICE_IDS.NEW_SERVICE, (container) => {
  return new NewService(container.resolve(SERVICE_IDS.DEPENDENCY));
});
```

## 📊 Architecture Metrics

- **Slices**: 8 (Settings, Plugin, Events, DI, Checkbox-Finder, OnTask-View, Streams, Editor)
- **Services**: 8 (EventSystem, SettingsService, StreamsService, CheckboxFinderService, PluginOrchestrator, DIContainer, EditorIntegration, OnTaskView)
- **Strategies**: 3 (Streams, Daily Notes, Folder)
- **Event Types**: 12+ (Settings, UI, Plugin, File, Checkbox events)
- **main.ts Lines**: 135 (down from 463+)

## 🎯 SOLID Principles

- **S**ingle Responsibility: Each slice has one reason to change
- **O**pen/Closed: Easy to extend with new strategies/events
- **L**iskov Substitution: Strategies are interchangeable
- **I**nterface Segregation: Clean, focused interfaces
- **D**ependency Inversion: Depends on abstractions, not concretions

This architecture makes the plugin highly maintainable, testable, and extensible while following modern software design principles.
