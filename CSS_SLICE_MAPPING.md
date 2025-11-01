# CSS Slice Mapping Documentation

This document maps CSS classes to their corresponding vertical slices without moving any code. Use this as a reference for understanding organization.

## Slice Organization Overview

Based on the codebase structure, CSS should ideally be organized by these slices:
- `ontask-view` - Main view components
- `settings` - Settings UI and tabs
- `status-config` - Status configuration modals and UI
- `filters` - Filter modals, quick filters, and filter UI
- `task-display` - Task items, checkboxes, file sections
- `shared` - Common utilities, buttons, mobile responsive

## Current CSS Organization vs Slice Mapping

### 🎯 **ontask-view Slice** (Main View)
**Lines 55-196, 256-518, 881-962, 1704-1765**
- `.ontask-header` - Main view header
- `.ontask-file-section` - File section containers
- `.ontask-file-header` - File section headers
- `.ontask-toptask-hero-section` - Top task hero display
- `.ontask-toptask-hero-overlay` - Top task overlay
- `.ontask-scroll-to-top-button` - Scroll to top functionality
- `.ontask-load-more-section` - Load more button area
- `.ontask-loading`, `.ontask-empty`, `.ontask-error` - View states

### ⚙️ **settings Slice** (Settings Interface)
**Lines 1556-1597**
- `.ontask-settings-tabs` - Settings tabs navigation
- `.ontask-tab-button` - Individual tab buttons
- `.ontask-settings-content` - Settings content area
- `.ontask-button-container` - Settings button containers

### 🔧 **status-config Slice** (Status Configuration)
**Lines 198-254, 964-1232**
- `.status-config-*` - All status config classes
- `.ontask-status-display` - Status display elements
- `.ontask-status-display-name`
- `.ontask-status-display-description`
- `.status-config-modal-*` - Status config modal classes
- `.status-config-item`, `.status-config-list`
- `.status-config-symbol`, `.status-config-name`

### 🔍 **filters Slice** (Filters & Quick Filters)
**Lines 600-878, 1234-1523, 1767-1863**
- `.ontask-filters-modal` - Filter modal
- `.ontask-filters-*` - All filter-related classes
- `.ontask-quick-filter-*` - Quick filter classes
- `.quick-filter-*` - Quick filter item classes
- `.ontask-filter-section` - Filter input section
- `.ontask-filter-input`, `.ontask-filter-clear-button`
- `.ontask-color-menu` - Color selection menu
- `.ontask-context-menu-*` - Context menu classes

### 📋 **task-display Slice** (Task Items & Display)
**Lines 256-339, 1656-1702**
- `.ontask-checkbox-*` - Checkbox-related classes
- `.ontask-checkbox-item`, `.ontask-checkbox-label`
- `.ontask-checkbox-display`, `.ontask-checkbox-text`
- `.ontask-task-ranking` - Task ranking badges

### 🎨 **shared Slice** (Common Utilities)
**Lines 1-53, 89-133**
- `.ontask-warning-*` - Warning messages
- `.ontask-header-button` - Common button styles
- `.ontask-load-more-button`
- `.ontask-error-message` - Error display

### 📱 **mobile-responsiveness Slice** (Mobile Styles)
**Lines 520-598, 1600-1654** (also scattered throughout)
- All `.is-mobile` and `.is-phone` selectors
- Mobile-specific overrides

## Complexity Issues Identified

### High Specificity Selectors
- Lines 698-710: Multiple chained selectors with `!important`
- Lines 847-850: Nested attribute selectors with dynamic colors
- Lines 1224-1227: Dynamic color attribute selectors

饼图: Complexity Distribution
- Simple selectors (0-1 levels): ~60%
- Medium complexity (2-3 levels): ~30%
- High complexity (4+ levels): ~10%

## Duplication Patterns

### Button Styles
Multiple button classes share common patterns:
- `.ontask-header-button`, `.ontask-load-more-button`
- `.status-config-edit-btn`, `.status-config-add-btn`
- `.quick-filter-add-btn`, `.ontask-quick-filter-button`
- **Recommendation**: Extract common button base class

### Mobile Overrides
Mobile styles scattered in multiple sections:
- Lines 520-598: Initial mobile section
- Lines 800-831: Context menu mobile styles
- Lines 1600-1654: Additional mobile styles
- **Recommendation**: Consolidate into single section per component

### Dynamic Color Patterns
Repeated pattern for dynamic colors:
- Lines 243-247: Status display colors
- Lines 847-850: Context menu colors
- Lines 869-872: Status icon colors
- Lines 1224-1227: Status config colors
- **Recommendation**: Create reusable mixin or base class

## Quality Metrics

### Selector Specificity
- Average specificity: Low-Medium (mostly class-based)
- Max specificity: High (4+ levels in some filter modal overrides)
- `!important` usage: ~15 instances (mostly for Obsidian overrides)

### Property Distribution
- Most used: `padding`, `margin`, `color`, `background`
- CSS Variables: Excellent usage throughout (Obsidian theme compatibility)
- Transitions: Consistent 0.2s ease patterns

### Maintainability
- Comment sections: Well-organized with clear headers
- Class naming: Consistent BEM-like pattern (`.ontask-*`)
- Organization: Functional grouping (good), but not slice-based (ideal)

## Recommendations Priority

### 🔵 Low Risk (Safe to Do Now)
1. **Add slice comments**: Add `/* SLICE: ontask-view */` comments to group sections
2. **Document complex selectors**: Add inline comments explaining why high specificity is needed
3. **Extract constants**: Document repeated values (border-radius: 4px, transition: 0.2s ease)

### 🟡 Medium Risk (Requires Testing)
1. **Consolidate mobile styles**: Move all mobile overrides to end of each component section
2. **Extract button base**: Create `.ontask-button-base` class for common button patterns
3. **Group dynamic colors**: Create a section for all `[data-dynamic-color]` selectors

### 🔴 High Risk (Avoid - Major Refactor)
1. **Reorganize by slice**: Would require moving 1863 lines - high risk of breaking styles
2. **Split into files**: Requires build system changes to import/combine CSS files
3. **Refactor selector specificity**: Many high-specificity rules override Obsidian defaults - risky

## Current Organization Strengths

✅ **Good Points**:
- Clear section headers with consistent formatting
- Consistent class naming convention (`.ontask-*`)
- Excellent use of CSS variables for theming
- Good mobile-first approach with `.is-mobile` and `.is-phone`
- Logical grouping by component/feature

## Target Organization (Ideal - Not Recommended Now)

```
styles.css
├── shared/ (utilities, buttons, warnings)
├── ontask-view/ (main view, file sections, top task)
├── task-display/ (checkboxes, items, ranking)
├── settings/ (settings UI, tabs)
├── status-config/ (status config modals)
├── filters/ (filters, quick filters, context menus)
└── mobile/ (all mobile overrides consolidated)
```

**Note**: This reorganization is **HIGH RISK** and should only be attempted when:
- Extensive testing time is available
- Build system supports CSS imports
- Version control can track all changes
- Rollback plan is in place

## Conclusion

The CSS is **well-organized functionally** but not by **vertical slice architecture**. However, reorganizing is **high-risk** for a working plugin. Focus on:

1. **Documentation**: Add slice mapping comments (low risk)
2. **Small improvements**: Extract common patterns (medium risk, testable)
3. **Avoid major refactoring**: Current organization is functional and maintainable





