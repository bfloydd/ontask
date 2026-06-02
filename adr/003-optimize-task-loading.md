# 3. Optimize Task Loading and Top Task Selection

Date: 2026-06-02

## Status

Accepted

## Context

The OnTask plugin allows users to view tasks filtered by "Today", "Week", and "All", as well as specific Folder Paths.
Historically, during the initial load of the task view, the plugin would perform a full-vault scan across every single tracked file in order to find the absolute highest-priority "Top Task" (for the Hero Section). 
While this ensured the Top Task was always accurate across the entire vault, it caused severe performance issues, freezing or hanging the application on startup, especially when the user selected the "All" view or had a large number of tracked files.

Additionally, the "Today" and "Week" date filters were hardcoded with `supportsLoadMore: false`. This meant that if a user had more tasks than the `loadMoreLimit` configured in settings, the remaining tasks were entirely invisible and inaccessible.

## Decision

We have decided to change the fundamental architecture of how tasks are loaded:
1. **Remove Full-Vault Scans:** We removed `findTopTaskAcrossTrackedFiles` from the `TaskLoadingService`. The plugin now strictly respects the `loadMoreLimit` and stops searching files as soon as the target number of tasks is loaded.
2. **Contextual Top Task:** The `TopTaskProcessingService` now selects the "Top Task" exclusively from the pool of *currently loaded tasks*. 
3. **Universal Load More:** We updated `supportsLoadMore` to `true` for all date filters ("Today", "Week", "All"). 

## Consequences

- **Pros:** 
  - Initial load times are now near-instantaneous regardless of the size of the vault or the number of tracked files.
  - The UI remains responsive when the view is opened.
  - Users can now paginate through all of their tasks in the "Today" and "Week" views using the "Load More" button.
- **Cons:** 
  - The Top Task displayed in the hero section is only the highest-priority task *among the loaded batch*. If the user's actual highest-priority task in the vault appears later in the file system, it will not be displayed in the hero section until the user clicks "Load More" enough times to bring that task into the loaded batch. This trade-off is deemed acceptable for the massive performance gains.
