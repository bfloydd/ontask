# 1. Task Indentation via Metadata Cache

Date: 2026-03-25

## Status

Accepted

## Context

The OnTask plugin extracts and lists tasks from various Obsidian markdown files (e.g. Daily Notes, Streams, specific folders). 
Tasks in markdown can be indented hierarchically (e.g. sub-tasks, sub-sub-tasks).
We want the OnTask view to visually reflect this indentation so that users can understand the relationships between tasks without losing context.
However, visual indentation should only be applied if the task's parent list item is also a task. If a task is nested under a regular text bullet point, it should not be indented, to avoid visually breaking from its structural root in the task list view.
Extracting exactly the hierarchy of tasks using regex line-by-line is error-prone since it requires maintaining proper context of the document's list structures.

## Decision

We will use Obsidian's `metadataCache.getFileCache()` API to accurately determine task indentation.
Specifically, we will utilize the `listItems` array (an array of `ListItemCache` objects) which provides a pre-parsed hierarchy of list items in a file.
For each matching task, we traverse its ancestor chain using the `parent` attribute (which points to the start line of the parent list item). We increment the semantic indentation level for every ancestor that is also a task (`task !== undefined`).

The extracted `indentationLevel` is then attached to each `TaskItem` and passed to the `CheckboxRenderer`, which applies an inline CSS `margin-left` based on the level.

## Consequences

- **Pros:** 
  - Sub-task relationships are correctly and reliably evaluated relying on Obsidian's own robust parser.
  - Performance is minimal since `getFileCache()` results are retrieved instantly from the in-memory cache and we trace a small hierarchy for each matched file line using a Map lookup.
  - Future tasks loaded from unmodified files will always have the correct formatting without running custom regex-based parser states over the whole file.
- **Cons:** 
  - There might be a slight delay in indentation calculation if Obsidian's metadata cache hasn't processed the file immediately after a user's keystroke, though in practice this is negligible.
