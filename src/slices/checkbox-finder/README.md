# Checkbox Finder Service - Pluggable Architecture

This service implements the **Strategy Pattern** to make checkbox finding pluggable and extensible, following the Open-Closed Principle (OCP).

## Architecture Overview

### Core Components

1. **Interfaces** (`interfaces.ts`)
   - `CheckboxItem`: Represents a found checkbox
   - `CheckboxFinderContext`: Context for finding checkboxes
   - `CheckboxFinderStrategy`: Strategy interface for different checkbox sources
   - `CheckboxFinderFactory`: Factory for creating strategies

2. **Strategies** (`strategies/`)
   - `StreamsCheckboxStrategy`: Finds checkboxes in Streams plugin folders
   - `DailyNotesCheckboxStrategy`: Finds checkboxes in Daily Notes
   - `FolderCheckboxStrategy`: Finds checkboxes in specified folders

3. **Factory** (`checkbox-finder-factory.ts`)
   - Creates and manages strategy instances
   - Registers new strategies

4. **Main Service** (`checkbox-finder-service.ts`)
   - Orchestrates multiple strategies
   - Provides unified API

## Usage Examples

### Basic Usage (Default - Streams Only)

```typescript
const checkboxFinder = new CheckboxFinderService(app, streamsService);
const checkboxes = await checkboxFinder.findAllCheckboxes();
```

### Using Multiple Strategies

```typescript
// Enable both streams and daily notes
checkboxFinder.setActiveStrategies(['streams', 'daily-notes']);

// Or add strategies individually
checkboxFinder.addActiveStrategy('daily-notes');
checkboxFinder.addActiveStrategy('folder');
```

### Using Folder Strategy

```typescript
// Create a folder strategy
const folderStrategy = checkboxFinder.createFolderStrategy('/My Tasks', true); // recursive
checkboxFinder.registerStrategy('my-tasks', folderStrategy);
checkboxFinder.addActiveStrategy('my-tasks');
```

### Custom Strategy

```typescript
class CustomCheckboxStrategy implements CheckboxFinderStrategy {
  getName(): string { return 'custom'; }
  isAvailable(): boolean { return true; }
  
  async findCheckboxes(context: CheckboxFinderContext): Promise<CheckboxItem[]> {
    // Your custom logic here
    return [];
  }
}

// Register and use
const customStrategy = new CustomCheckboxStrategy();
checkboxFinder.registerStrategy('custom', customStrategy);
checkboxFinder.addActiveStrategy('custom');
```

## Benefits of This Architecture

1. **Open-Closed Principle**: Easy to add new checkbox sources without modifying existing code
2. **Single Responsibility**: Each strategy handles one type of checkbox source
3. **Dependency Inversion**: Depends on abstractions, not concrete implementations
4. **Strategy Pattern**: Runtime strategy selection
5. **Factory Pattern**: Centralized strategy creation and management

## Adding New Strategies

1. Implement `CheckboxFinderStrategy` interface
2. Register with the factory: `factory.registerStrategy(name, strategy)`
3. Add to active strategies: `service.addActiveStrategy(name)`

## Configuration

Strategies can provide configuration through the `getConfiguration()` method:

```typescript
const config = strategy.getConfiguration();
// Returns: { folderPath: '/path', recursive: true, ... }
```
