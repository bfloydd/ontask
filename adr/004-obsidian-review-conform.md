# Architecture Decision Record: Obsidian Review Conformance

## Status
Active

## Context
The plugin is undergoing the official Obsidian community plugin review process. The reviewers provided specific criticisms regarding code quality, safety, and adherence to best practices. To ensure the plugin is accepted and maintainable long-term, these criticisms must be systematically addressed.

This ADR serves as a living document to track the review feedback and the corresponding architectural or code changes made to resolve them.

## Decisions

### 1. Typing Internal Plugin APIs
**Feedback:** 
- Warning: Unsafe member access on an `any` value.

**Decision:** 
We will strictly avoid casting to `any` when accessing undocumented Obsidian APIs (e.g., `this.app.internalPlugins`, `this.app.plugins`, or deep properties like `.options` and `.settingsTab`) or external HTTP API responses (e.g., `response.json`). Instead, we will define explicit, narrow TypeScript interfaces for the structures we need to interact with. To ensure consistency and reusability, these types will be centralized in a shared definitions file (e.g., `ObsidianInternal.ts`) and imported wherever we need to access them. We will cast the objects to these explicit interfaces rather than `any`.

### 2. Eliminating Unused Assignments and Definitions
**Feedback:**
- Warning: Variable is assigned a value but never used.
- Warning: Entity is defined but never used.

**Decision:**
We will proactively prune all unused variables, imports, and parameters. This applies specifically to:
1. **DOM Elements:** When creating DOM elements (especially using Obsidian's built-in helpers like `createEl` or `createDiv`), we will only assign the returned element to a variable if we need to interact with it again.
2. **Destructuring:** When destructuring objects or arrays, we will omit unused variables (e.g. `let [, secondItem] = array;`).
3. **Catch Blocks:** If an error parameter in a `catch` block is unused, we will use the parameterless `catch { ... }` syntax.
4. **Imports & Interfaces:** Unused module imports or interface definitions will be aggressively removed.

### 3. Handling Deprecated `display()` API
**Feedback:**
- Warning: `display` is deprecated. Since 1.13.0. Use `getSettingDefinitions` instead.

**Decision:**
To support users on older Obsidian versions while clearing deprecation warnings, we will maintain our `display()` method implementation (as required by the older `PluginSettingTab` API) but extract the internal rendering logic into a private `renderSettings()` method. Any internal calls that previously invoked `this.display()` to force a UI re-render will now invoke `this.renderSettings()`.

### 4. Enforcing Immutable Variable Declarations
**Feedback:**
- Error: Variable is never reassigned. Use `const` instead.

**Decision:**
We will default to declaring all variables using `const`. The `let` keyword will only be used when a variable is explicitly reassigned later within its scope.

### 5. Command ID Redundancy
**Feedback:**
- Warning: The command ID should not include the plugin ID. Obsidian will make sure that there are no conflicts with other plugins.

**Decision:**
We will omit the plugin ID prefix when defining command IDs (e.g., using `open-view` instead of `open-ontask-view`). Obsidian automatically namespaces all commands with the plugin's ID under the hood to prevent conflicts, so including it in the definition creates redundant identifiers (e.g., `ontask:open-ontask-view`).

### 6. Popout Window Compatibility for Timers and Animation Frames
**Feedback:**
- Warning: Use `window.requestAnimationFrame()` instead of `requestAnimationFrame()` for popout window compatibility.
- Warning: Use `window.clearTimeout()` instead of `clearTimeout()` for popout window compatibility.

**Decision:**
We will always explicitly prefix global timers (`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`) and animation frames (`requestAnimationFrame`, `cancelAnimationFrame`) with `window.` (e.g. `window.setTimeout`). In Obsidian, popout windows run in their own independent window context. Implicitly calling the global functions can cause timers or animations to fail, stall, or target the wrong context if the user has detached the view into a separate popout window.
### 7. Deprecated JavaScript Features
**Feedback:**
- Warning: `substr` is deprecated. A legacy feature for browser compatibility.

**Decision:**
We will avoid using deprecated or legacy JavaScript APIs. For string manipulation, we will strictly use modern standards like `String.prototype.substring()` or `String.prototype.slice()` instead of `String.prototype.substr()`. This ensures long-term compatibility and avoids unnecessary warnings in modern JavaScript environments like Obsidian's Electron wrapper.
