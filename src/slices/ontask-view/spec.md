
```js
trackedFiles = [
  "/FolderB/2025-12-31.md",
  "/FolderA/2025-12-29.md",
  "/FolderB/2025-12-28.md",
  "/FolderA/2025-12-26.md",
  "/FolderB/2025-12-25.md",
  "/FolderA/2025-12-23.md",
  "/FolderB/2025-12-22.md",
  "/FolderA/2025-12-20.md",
  							Initial load looks through
							many files to find 10 tasks. 
							Then puts the index at 7
  "/FolderB/2025-12-19.md",
  "/FolderA/2025-12-19.md",
  "/FolderB/2025-12-17.md",
  "/FolderA/2025-12-16.md",
							- Load More is clicked.
							- Continues looking at 7. 
							- Ends at 11, which is the new index.
							- Final file searched has 5 tasks total,
							  but we stopped looking at 3/5 tasks 
							  because that got the total to 10.
							- New found tasks are appended 
							  and displayed.
  "/FolderB/2025-12-14.md",
  "/FolderB/2025-12-13.md",
  "/FolderA/2025-12-13.md",
  "/FolderA/2025-12-11.md",
  "/FolderB/2025-12-10.md",
  "/FolderA/2025-12-10.md",
  "/FolderB/2025-12-08.md",
  "/FolderA/2025-12-07.md",
  "/FolderB/2025-12-05.md",
  "/FolderA/2025-12-04.md",
							- Load more is clicked.
							- Continues at 11.
							- Continues at 4/5 task count within 11.
							- Then looks through even more 
							  files to get to 10 tasks, 
							  ending at 21, the new index.
							- The file had 1 task and it got us to 10
							  tasks.
							- New found tasks are appended 
							  and displayed.
  "/FolderA/2025-12-02.md",
  "/FolderB/2025-12-01.md",
  "/FolderA/2025-12-01.md"
]
```

## On Initial Load:
- Gets files into an indexed array. Use strategy for this.
- Sorts on filename, Z-A, ignoring path in sort. See image example.
- Loop through files, looking for tasks, ignoring totally filtered out items. 
- When the configured load more limit (default 10) tasks are reached, stop totally and remember the total tasks within the file and where we stopped (like 3/5 tasks within the file), and the index within out file list. We now know exactly where to start looking on Load More.
- Continue until searching through files until the load more limit tasks are found.

## On each Load More:
- Begin where we left off, file index in trackedFiles array and the task number within the file.
- Filters are applied and unchecked items are not counted in totals and skipped totally.
- Looks through as many files as necessary to reach the configured load more limit tasks, again and always ignoring filtered out statuses.
- **CRITICAL**: Stop immediately when the target number of tasks is reached. Do not process any additional files or tasks beyond the limit.
- Append the unfiltered tasks to the OnTaskView page.

## Finding tasks:
- Example of how to find checkbox `- [ALLOWED_BY_FILTER_LIST]` 
- How the regex might work: `-\s\[[ALLOWED_BY_FILTER_LIST]\]\s.*`
- The ALLOWED_BY_FILTER_LIST, comma separated list, is found by StatusConfigService.getFilteredStatusConfigs() from data.json where filtered equals true.
- Also include a space in the ALLOWED_BY_FILTER_LIST as a synonym to . (to-do task)
- Status configuration is managed by the Data Service, not Settings Service

## Top task:
- Top task is identified by an algorithm - Prefer `/`, but fallback to `!`, then fallback to `+`.
- `/`, but fallback to `!`, then fallback to `+` are special tasks and immutable in settings.
- When a top task is found, it emits an event that is caught by other handlers in the plugin; handlers listed here:
  - Handler 1: Hero section in OnTaskView. The Hero section (ontask-toptask-hero-section) shows the top task but it also remains in the task list.
  - Handler 2: ontask-toptask-hero-content. 
  - Handler 3: Status bar top-task visual. The status bar picks that up and shows the updated top-task.

## Quick Filters
- Add a new tab within Settings called Quick Filters. 
- Quick filters are collections of Statuses that can be saved into data.json.
- Statuses are read from data.json dynamically.
- Any added Quick Filter include a button (user can name the button), that shows up in Filters Popup in OnTaskView.
- Clicking on those Quick Filters in the Popup will auto-check those checkboxes that are part of the Quick Filter; nothing else.
- Clicking Save works as normal. 
- Each Quick Save within settings also includes a "enabled" flag that, if enabled, hides the button and visa-versa.
- There is a default Quick Filter called "Review", which checks "Completed"
- There is a default Quick Filter called "Lagging", which checks "To-do, Forward, Review, Blocked, Question"