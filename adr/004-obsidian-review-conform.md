# Architecture Decision Record: Obsidian Review Conformance

## Status
Active

## Context
The plugin is undergoing the official Obsidian community plugin review process. The reviewers provided specific criticisms regarding code quality, safety, and adherence to best practices. To ensure the plugin is accepted and maintainable long-term, these criticisms must be systematically addressed.

This ADR serves as a living document to track the review feedback and the corresponding architectural or code changes made to resolve them.

## Decisions

### 1. Strictly Disallowing Explicit Any and Unsafe Types
**Feedback:** 
- Warning: Unexpected any. Specify a different type (`@typescript-eslint/no-explicit-any`).
- Warning: Unsafe member access on an `any` value.
- Warning: Returns unsafe values from typed code (`@typescript-eslint/no-unsafe-return`).
- Warning: Passes unsafe values into typed parameters (`@typescript-eslint/no-unsafe-argument`).
- Warning: Unsafe assignment of an `any` value (`@typescript-eslint/no-unsafe-assignment`).
- Warning: Unsafe call of an `any` typed value (`@typescript-eslint/no-unsafe-call`).

**Decision:** 
We will strictly avoid using `any` type declarations in our source code and prevent unsafe operations (assignments, calls, returns, parameters, or member access) involving implicit or explicit `any` values. When dealing with dynamically typed objects, undocumented APIs, or external data, we will use `unknown` as a safer alternative or explicitly cast the values to defined, narrow TypeScript interfaces before interacting with them. We will also directly import strictly-typed objects instead of relying on untyped global variables.

### 2. Eliminating Unused Assignments and Definitions
**Feedback:**
- Warning: Variable is assigned a value but never used.
- Warning: Entity is defined but never used.

**Decision:**
We will proactively prune all unused variables, imports, and parameters. When creating DOM elements using built-in helpers, we will only assign the returned element to a variable if we need to interact with it again. For destructuring assignments, we will either omit unused array elements or restructure our logic to avoid extracting unused object properties. For error handling, we will use parameterless catch blocks if the error object is not utilized. We will also aggressively remove unused module imports and interface definitions.

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
We will always explicitly prefix global timers and animation frames with the window object reference.

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

### 9. Safe Promise Handling in Synchronous Contexts
**Feedback:**
- Warning: Promises must be awaited, end with a call to `.catch`, end with a call to `.then` with a rejection handler or be explicitly marked as ignored with the `void` operator.
- Warning: Promise-returning method provided where a void return was expected by extended/implemented type 'Plugin' (`@typescript-eslint/no-misused-promises`).
- Warning: Promise returned in function argument where a void return was expected.

**Decision:**
We will never leave promises floating and will ensure that asynchronous operations are not implicitly returned to synchronous callers. When calling an asynchronous function where we deliberately do not want to await its resolution, we will explicitly mark it with the `void` operator. When a signature expects a `void` return type, we will not pass an `async` function; instead, we will either wrap the asynchronous logic within an immediately invoked async function expression or use the `void` operator.

### 10. Strict Empty Object Typing
**Feedback:**
- Warning: The `{}` ("empty object") type allows any non-nullish value, including literals like `0` and `""`.

**Decision:**
We will never use `{}` to represent an empty object in TypeScript, as it is fundamentally unsafe and acts more like an `any non-nullish` wildcard. When defining an object type that intentionally contains no properties (such as an empty event payload), we will strictly use `Record<string, never>` to enforce that the object is truly empty at compile time.

### 11. Popout Window Document Context
**Feedback:**
- Warning: Use `activeDocument` instead of `document` for popout window compatibility.

**Decision:**
In Obsidian's architecture, views can be torn off into separate popout windows. Using the global `document` variable will strictly reference the main application window's DOM. This means elements created via `document.createElement()` or appended to `document.body` may render in the wrong window or fail completely. We will exclusively use `activeDocument` for all DOM manipulations to ensure 100% popout window compatibility.

### 12. Strict CSS Best Practices
**Feedback:**
- Error: Sets styles directly instead of using CSS classes or `setCssProps` (`obsidianmd/no-static-styles-assignment`).
- Warning: Avoid !important — override styles by increasing selector specificity or using CSS variables instead.

**Decision:**
We will strictly adhere to CSS best practices for maintainability and theme compatibility. We will never assign styles directly via the DOM style property; all static styling must be extracted to CSS classes. Additionally, we will avoid using the `!important` flag in our CSS. When style overrides are necessary, we will achieve them by increasing CSS selector specificity or utilizing CSS variables rather than forcing overrides.

### 13. Maintaining Minimum App Version Compatibility
**Feedback:**
- Error: Uses Obsidian APIs newer than the declared `minAppVersion` (`obsidianmd/no-unsupported-api`).

**Decision:**
Our plugin naturally utilizes modern Obsidian APIs (such as advanced Menu configurations, settings inputs, and workspace layout utilities). Rather than writing legacy polyfills or restricting functionality to support outdated clients, we will maintain a realistic `minAppVersion` in `manifest.json` (currently `1.4.0`) that aligns with our actual API usage. We will always keep `versions.json` synchronized when bumping this version floor.

### 14. Avoiding Undescribed Linter Directives
**Feedback:**
- Error: Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.

**Decision:**
We will avoid using undescribed linter directive comments to silence warnings. Whenever possible, we will refactor the code to natively comply with the linter rules (for instance, by appropriately naming unused variables or refining type casts). If a directive comment is absolutely necessary to bypass a verified false positive, it must be accompanied by a clear description explaining the rationale.

### 15. Removing Unnecessary Type Assertions
**Feedback:**
- Warning: This assertion is unnecessary since it does not change the type of the expression.

**Decision:**
We will trust TypeScript's type inference and type narrowing capabilities, avoiding explicit casts (using the `as` keyword) when the compiler already knows the correct type. Redundant type assertions will be removed to ensure a clean and idiomatic codebase.

### 16. Avoiding Redundant Union Types
**Feedback:**
- Warning: 'unknown' overrides all other types in this union type (`@typescript-eslint/no-redundant-type-constituents`).

**Decision:**
We will avoid creating union types where one constituent completely subsumes the others (such as `unknown | null` or `any | string`), as this makes the explicit types redundant and misleading. Instead, we will either use the specific, narrow type (e.g., `Plugin | null` instead of `unknown | null`) or use the single broad type if strictly necessary.
