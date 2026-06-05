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
We will strictly avoid casting to `any` when accessing undocumented or internal Obsidian APIs (e.g., `this.app.internalPlugins` or community plugins). Instead, we will define explicit, narrow TypeScript interfaces for the internal structures we need to interact with. To ensure consistency and reusability, these types will be centralized in a shared definitions file (e.g., `ObsidianInternal.ts`) and imported wherever we need to access internal APIs. We will cast the `App` or `Plugin` objects to these explicit interfaces rather than `any`.

### 2. Eliminating Unused Assignments and Definitions
**Feedback:**
- Warning: Variable is assigned a value but never used.
- Warning: Entity is defined but never used.

**Decision:**
We will proactively prune all unused variables, imports, and parameters. This applies specifically to:
1. **DOM Elements:** When creating DOM elements (especially using Obsidian's built-in helper `createEl`), we will only assign the returned element to a variable if we need to interact with it again.
2. **Destructuring:** When destructuring objects or arrays, we will omit unused variables (e.g. `let [, secondItem] = array;`).
3. **Catch Blocks:** If an error parameter in a `catch` block is unused, we will use the parameterless `catch { ... }` syntax.
4. **Imports & Interfaces:** Unused module imports or interface definitions will be aggressively removed.

### 3. Handling Deprecated `display()` API
**Feedback:**
- Warning: `display` is deprecated. Since 1.13.0. Use `getSettingDefinitions` instead.

**Decision:**
To support users on older Obsidian versions while clearing deprecation warnings, we will maintain our `display()` method implementation (as required by the older `PluginSettingTab` API) but extract the internal rendering logic into a private `renderSettings()` method. Any internal calls that previously invoked `this.display()` to force a UI re-render will now invoke `this.renderSettings()`.
