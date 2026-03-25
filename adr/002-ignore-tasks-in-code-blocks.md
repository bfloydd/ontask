# 2. Ignored Tasks in Code Blocks

Date: 2026-03-25

## Status

Accepted

## Context

The OnTask plugin scans Markdown files line-by-line using regular expressions to extract tasks (checkboxes). 
However, this regex-based approach previously captured checkboxes that were located inside Markdown code fences (`` ``` `` or `~~~`). 
Code fences are typically used to show code snippets, documentation, or templates, and the tasks inside them are usually not actionable items meant for the user's live productivity tracking. 
Surfacing these purely illustrative checkboxes in the OnTask view clutters the UI and causes confusion.

## Decision

We will skip extracting tasks that reside within Markdown code blocks. 
To implement this efficiently without adding a heavy full-document Markdown AST parser, we track an `inCodeBlock` boolean state during the line-by-line scan inside `TaskLoadingService` (the central task fetching engine). 

When our iteration encounters a line whose trimmed string starts with ` ``` ` or ` ~~~ `, we toggle the `inCodeBlock` state and skip the line. If `inCodeBlock` is true, subsequent lines are automatically skipped for task-pattern matching until the closing fence is found. 
Because the reading loop maintains this state continuously from the beginning of each file down to the target loaded batch, it is perfectly robust even when lazy-loading or paginating tasks from a file.

## Consequences

- **Pros:** 
  - Illustrative tasks inside ` ```markdown ` or ` ```txt ` snippets are no longer displayed in the OnTask view.
  - Performance remains excellent because string-prefix matching (`startsWith`) and tracking a boolean flag has basically zero overhead.
- **Cons:** 
  - Unmatched code fences (e.g. a forgotten closing ` ``` `) in a user's vault could accidentally hide all tasks below the opening fence until the end of the file. However, this perfectly mirrors standard Markdown compilation logic, aligning with expected behavior.
