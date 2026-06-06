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

### 8. Type Safety with Abstract Files
**Feedback:**
- Warning: Avoid casting to `TFile`. Use an `instanceof TFile` check to safely narrow the type.

**Decision:**
When retrieving abstract files from the vault (e.g., using `this.app.vault.getAbstractFileByPath()`), we will strictly use the `instanceof TFile` type guard to verify the result is actually a `TFile` instead of blindly casting it using `as TFile`. This ensures runtime safety in case the path points to a directory (`TFolder`) or the file does not exist.

### 9. Explicitly Handling Floating Promises
**Feedback:**
- Warning: Promises must be awaited, end with a call to `.catch`, end with a call to `.then` with a rejection handler or be explicitly marked as ignored with the `void` operator.

**Decision:**
We will never leave promises floating. When calling an asynchronous function where we deliberately do not want to `await` its resolution (e.g., inside synchronous event listeners, UI callbacks, or fire-and-forget background tasks), we will explicitly mark it with the `void` operator (e.g., `void this.refreshCheckboxes();`). This signals intentionality to both the compiler and other developers, and prevents silent failures.

### 10. Safe Return Types
**Feedback:**
- Warning: Returns unsafe values from typed code (`@typescript-eslint/no-unsafe-return`).

**Decision:**
When a method defines a strict return type, we will never return values that evaluate to `any`. For external calls that inherently return `any` (such as Obsidian's `Plugin.loadData()`), we will explicitly assert the response to the expected type (e.g., `(loaded || {}) as DataServiceData`) to satisfy the compiler and guarantee type safety moving forward.

### 11. Strict Empty Object Typing
**Feedback:**
- Warning: The `{}` ("empty object") type allows any non-nullish value, including literals like `0` and `""`.

**Decision:**
We will never use `{}` to represent an empty object in TypeScript, as it is fundamentally unsafe and acts more like an `any non-nullish` wildcard. When defining an object type that intentionally contains no properties (such as an empty event payload), we will strictly use `Record<string, never>` to enforce that the object is truly empty at compile time.

### 12. Popout Window Document Context
**Feedback:**
- Warning: Use `activeDocument` instead of `document` for popout window compatibility.

**Decision:**
In Obsidian's architecture, views can be torn off into separate popout windows. Using the global `document` variable will strictly reference the main application window's DOM. This means elements created via `document.createElement()` or appended to `document.body` may render in the wrong window or fail completely. We will exclusively use `activeDocument` for all DOM manipulations to ensure 100% popout window compatibility.

### 13. Type Safe Moment Imports
**Feedback:**
- Warning: Unsafe member access `.format` on an `any` value.

**Decision:**
We will avoid accessing global dependencies through untyped avenues like `(window as any).moment`. Instead, we will directly import the provided and strongly-typed objects from the Obsidian API (e.g., `import { moment } from 'obsidian'`). This ensures full type safety across our date/time utilities and prevents unsafe member access warnings.

### 14. Safe Typed Parameter Passing
**Feedback:**
- Warning: Passes unsafe values into typed parameters (`@typescript-eslint/no-unsafe-argument`).

**Decision:**
We will never pass variables typed as `any` into strictly typed function parameters. For generic utility functions (such as `Logger`), we will prefer `unknown` over `any` to force explicit checks. When dealing with dynamically typed objects from external APIs (like Obsidian's `loadData()`), we will explicitly cast the response (e.g., `as Partial<OnTaskSettings>`) before spreading it or passing it as an argument.

### 15. Disallowing Explicit Any
**Feedback:**
- Warning: Unexpected any. Specify a different type (`@typescript-eslint/no-explicit-any`).

**Decision:**
We will strictly avoid using `any` type declarations in our source code. When dealing with dynamically typed objects or unknown data, we will use `unknown` as a safer alternative, which forces the developer to perform type narrowing or explicit casting before interacting with the object. If a mock or fallback object is required for testing or edge cases, we will cast through `unknown` first (e.g., `null as unknown as TFile`).

### 16. Avoiding Misused Promises in Synchronous Contexts
**Feedback:**
- Warning: Promise-returning method provided where a void return was expected by extended/implemented type 'Plugin' (`@typescript-eslint/no-misused-promises`).
- Warning: Promise returned in function argument where a void return was expected.

**Decision:**
We will strictly ensure that asynchronous operations are not implicitly returned to synchronous callers (such as event listener callbacks or the `Plugin.onunload()` lifecycle method). When a signature expects a `void` return type, we will not pass an `async` function. Instead, we will either wrap the asynchronous logic within an immediately invoked async function expression (IIFE) or explicitly mark the fire-and-forget promise with the `void` operator. This prevents unhandled promise rejections and satisfies strict compiler checks.

### 17. Avoiding Static Styles Assignments
**Feedback:**
- Error: Sets styles directly instead of using CSS classes or `setCssProps` (`obsidianmd/no-static-styles-assignment`).

**Decision:**
We will never assign styles directly via the `.style` property on DOM elements (e.g., `element.style.color = 'red'`). All static styling must be extracted to CSS classes within `styles.css` and applied via `element.addClass(...)`. This ensures our user interface responds appropriately to Obsidian's native themes, allows custom CSS snippets to override the default look, and strictly complies with Obsidian developer policies.

### 18. Maintaining Minimum App Version Compatibility
**Feedback:**
- Error: Uses Obsidian APIs newer than the declared `minAppVersion` (`obsidianmd/no-unsupported-api`).

**Decision:**
Our plugin naturally utilizes modern Obsidian APIs (such as advanced Menu configurations, settings inputs, and workspace layout utilities). Rather than writing legacy polyfills or restricting functionality to support outdated clients, we will maintain a realistic `minAppVersion` in `manifest.json` (currently `1.4.0`) that aligns with our actual API usage. We will always keep `versions.json` synchronized when bumping this version floor.

### 19. Avoiding Undescribed Linter Directives
**Feedback:**
- Error: Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.

**Decision:**
We will avoid using undescribed linter directive comments to silence warnings. Whenever possible, we will refactor the code to natively comply with the linter rules (for instance, by appropriately naming unused variables or refining type casts). If a directive comment is absolutely necessary to bypass a verified false positive, it must be accompanied by a clear description explaining the rationale.

### 20. Removing Unnecessary Type Assertions
**Feedback:**
- Warning: This assertion is unnecessary since it does not change the type of the expression.

**Decision:**
We will trust TypeScript's type inference and type narrowing capabilities, avoiding explicit casts (using the `as` keyword) when the compiler already knows the correct type. Redundant type assertions will be removed to ensure a clean and idiomatic codebase.
