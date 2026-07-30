# AGENT.md — Supabase-Inspired Todo Application

## Project Goal

Build a polished, production-quality todo list application with a modern dashboard layout inspired by the visual language of Supabase.

The application should feel clean, fast, professional, and developer-focused. It should use a dark interface, subtle borders, spacious layouts, soft shadows, clear typography, responsive behavior, and smooth interactions.

Do not copy Supabase exactly. Use it only as visual inspiration for:

- Dark dashboard styling
- Sidebar navigation
- Compact top navigation
- Card-based layouts
- Muted gray surfaces
- Green accent colors
- Soft borders and shadows
- Clean tables and forms
- Professional empty states
- Smooth hover and focus states

The final result should feel like a real SaaS productivity dashboard rather than a basic classroom todo list.

---

## Main Deliverable

Create a fully responsive todo management application where users can:

- Create tasks
- Edit tasks
- Delete tasks
- Mark tasks as complete or incomplete
- Assign priorities
- Add due dates
- Organize tasks by project or category
- Search tasks
- Filter tasks
- Sort tasks
- View task statistics
- Switch between light and dark mode
- Persist tasks locally or through the existing backend, depending on the project setup

The application should be visually impressive enough to include in a portfolio.

---

## Design Direction

### Overall Style

Use a Supabase-inspired SaaS dashboard style:

- Dark charcoal or near-black page background
- Slightly lighter sidebar and content cards
- Thin neutral borders
- Green accent color for primary actions and active states
- Muted text for secondary information
- White or off-white primary text
- Rounded corners, but avoid overly rounded “bubble” styling
- Clean typography with strong hierarchy
- Generous spacing without wasting screen space

Recommended visual characteristics:

```text
Background: near-black / dark charcoal
Sidebar: slightly lighter than the main background
Cards: elevated dark gray surfaces
Borders: subtle gray with low contrast
Primary accent: Supabase-style green
Success: green
Warning: amber
Danger: red
Info: blue
```

Use CSS variables or design tokens for colors, spacing, typography, shadows, border radius, and transitions.

---

## Application Layout

### Desktop Layout

Create a dashboard with the following areas:

1. **Left Sidebar**
   - Application logo and name
   - Main navigation
   - Inbox / All Tasks
   - Today
   - Upcoming
   - Completed
   - Projects or Categories
   - Settings
   - Collapse sidebar button
   - User profile section near the bottom

2. **Top Header**
   - Current page title
   - Breadcrumb or short description
   - Search input
   - Theme toggle
   - Notifications or utility icon
   - Primary “New Task” button

3. **Main Content Area**
   - Summary statistic cards
   - Filters and sorting controls
   - Task list or table
   - Empty state when no tasks exist
   - Pagination or load-more behavior when useful

4. **Optional Right Details Panel**
   - Opens when a task is selected
   - Displays task details
   - Allows editing without leaving the page
   - Slides in smoothly

### Mobile Layout

On mobile devices:

- Convert the sidebar into a slide-out drawer
- Use a compact top navigation bar
- Keep the “New Task” action easy to access
- Stack statistic cards vertically or in a two-column grid
- Render task items as mobile-friendly cards instead of a wide table
- Ensure all buttons have comfortable touch targets
- Avoid horizontal scrolling
- Keep forms readable and easy to complete

The interface must work well at approximately:

- 320px
- 375px
- 768px
- 1024px
- 1440px and above

---

## Required Pages and Views

### 1. Dashboard / All Tasks

Show:

- Total tasks
- Completed tasks
- Pending tasks
- Overdue tasks
- Task completion percentage
- Recent tasks
- Upcoming deadlines

Use attractive summary cards with icons, labels, values, and subtle trend or helper text.

### 2. Today View

Display tasks due today.

Include:

- Current date
- Progress summary
- Completed and pending sections
- Empty state if there are no tasks for today

### 3. Upcoming View

Display upcoming tasks grouped by date.

Suggested grouping:

- Tomorrow
- This week
- Next week
- Later

### 4. Completed View

Show completed tasks with:

- Completion date
- Project or category
- Ability to restore a task
- Ability to permanently delete a task

### 5. Projects / Categories

Allow users to:

- Create a project
- Rename a project
- Select a project color or icon
- View tasks assigned to that project
- Delete a project with confirmation

### 6. Settings

Include:

- Theme preference
- Default task view
- Task density preference
- Notification preferences placeholder
- Clear completed tasks action
- Reset local data action with confirmation

---

## Task Data Model

Each task should support the following fields:

```ts
interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  dueDate?: string;
  projectId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

Each project may use:

```ts
interface Project {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: string;
}
```

Keep types centralized and reusable.

---

## Core Features

### Task Creation

Create a polished modal, drawer, or side panel for adding tasks.

Required fields:

- Task title
- Description
- Priority
- Due date
- Project or category
- Tags

Behavior:

- Validate required fields
- Prevent blank task titles
- Display clear inline validation messages
- Submit with keyboard support
- Close with Escape
- Return focus to the original trigger after closing
- Show a success toast after task creation

### Task Editing

Allow users to edit tasks from:

- An edit button
- A task details panel
- Double click or keyboard-friendly alternative, if implemented

### Task Completion

Users should be able to mark tasks complete using an accessible checkbox.

When completed:

- Animate the state change subtly
- Apply a muted style and optional strikethrough
- Update completion statistics
- Show a small toast notification

### Task Deletion

Before deleting a task, display a confirmation dialog.

The dialog should:

- Blur or dim the background
- Clearly identify the task being deleted
- Explain that the action cannot be undone
- Provide Cancel and Delete buttons
- Place keyboard focus inside the dialog
- Close with Escape
- Use a red destructive action style

### AI-Powered Search

Replace the basic keyword-only search with a hybrid search experience that supports both normal text matching and natural-language queries.

Users should be able to type queries such as:

- `show tasks due next week`
- `find unfinished frontend work`
- `what have I ignored?`
- `show urgent bugs`
- `tasks for SmartBudget that are overdue`
- `completed school tasks from this month`

The search system should understand and extract useful intent from a query, including:

- Completion status
- Priority
- Project or category
- Tags
- Relative and exact dates
- Overdue status
- Recently created or recently updated tasks
- Words or concepts found in titles and descriptions

#### Search Behavior

Use a hybrid approach:

1. Perform fast local keyword and structured filtering immediately.
2. When AI search is available, interpret the natural-language query into structured search parameters.
3. Apply those structured parameters to the existing task data.
4. Never allow the AI model to directly mutate, delete, or complete tasks from the search field.
5. Fall back gracefully to regular search when the AI service is unavailable or not configured.

Represent parsed AI search intent with a predictable schema similar to:

```ts
interface TaskSearchIntent {
  text?: string;
  status?: "all" | "pending" | "completed";
  priorities?: Array<"low" | "medium" | "high">;
  projectIds?: string[];
  tags?: string[];
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  sortBy?: "relevance" | "newest" | "oldest" | "dueDate" | "priority";
}
```

Validate all AI-generated output before using it. Ignore unsupported fields and handle malformed responses without crashing.

#### AI Search Interface

The search UI should feel like a premium command experience:

- Place the main search field prominently in the header
- Add a subtle sparkle or AI indicator without making the interface feel gimmicky
- Show example prompts in the empty state
- Display a small loading state while interpreting a natural-language query
- Convert interpreted intent into editable filter chips
- Let users remove or modify individual AI-generated filters
- Include recent searches
- Support keyboard navigation through results
- Use `/` or `Ctrl/Cmd + K` to focus or open search
- Press Escape to close expanded search results
- Highlight matching words and explain why a task matched when useful

Example interpreted state:

```text
Query: "urgent SmartBudget tasks due this week"

Applied filters:
[Project: SmartBudget] [Priority: High] [Due: This week] [Pending]
```

#### AI Integration Safety

- Keep API keys on the server only
- Do not expose secrets in client-side code
- Use an existing backend route or create a dedicated server endpoint
- Add rate limiting and useful error handling when a backend exists
- Send only the minimum task metadata required for search interpretation
- Prefer asking the AI to parse intent rather than sending the entire task database
- Do not invent tasks or return records that do not exist locally
- Clearly indicate when results are based on interpreted filters

Search should remain fast, understandable, and fully usable without AI configuration.

### Filters

Include filters for:

- Completion status
- Priority
- Project
- Due date
- Overdue tasks

Display active filter chips and provide a “Clear filters” action.

### Sorting

Support sorting by:

- Newest
- Oldest
- Due date
- Priority
- Alphabetical order

### Persistence

Use the existing project architecture.

Preferred fallback order:

1. Existing backend API and database
2. Local storage
3. In-memory state only if persistence is not yet available

Do not break the existing application architecture.

---

## Component Requirements

Create reusable components where appropriate.

Suggested component structure:

```text
src/
  components/
    layout/
      AppShell
      Sidebar
      Header
      MobileNavigation
    tasks/
      TaskList
      TaskCard
      TaskRow
      TaskCheckbox
      TaskForm
      TaskDetailsPanel
      TaskFilters
      TaskSearch
      TaskEmptyState
      DeleteTaskDialog
    dashboard/
      StatCard
      ProgressCard
      UpcomingTasks
    projects/
      ProjectList
      ProjectItem
      ProjectForm
    ui/
      Button
      Input
      Select
      Modal
      Drawer
      Badge
      Tooltip
      Toast
      Skeleton
      DropdownMenu
```

Keep components focused and avoid putting the entire application in one file.

---

## UI Details

### Sidebar

- Highlight the active route or view
- Use a vertical green accent line or subtle green background
- Add hover states
- Add tooltips when collapsed
- Use simple icons
- Animate collapsing smoothly
- Preserve content usability when collapsed

### Task List

Desktop may use a table-like layout with columns such as:

- Completion checkbox
- Task title
- Project
- Priority
- Due date
- Status
- Actions

Mobile should use cards with the same information arranged vertically.

### Priority Badges

Suggested styling:

- Low: muted blue or gray
- Medium: amber
- High: red

Do not rely on color alone. Include readable labels and optionally icons.

### Due Dates

- Overdue dates should be clearly highlighted
- Due today should use a noticeable but not alarming style
- Future dates should be muted
- Completed tasks should not appear overdue

### Empty States

Create attractive empty states for:

- No tasks
- No completed tasks
- No search results
- No tasks due today
- No projects

Each empty state should include:

- Small icon or illustration
- Clear heading
- Short explanation
- Relevant action button

### Toast Notifications

Use toast notifications for:

- Task created
- Task updated
- Task completed
- Task restored
- Task deleted
- Project created or deleted
- Error messages

Toasts should be accessible and should not block interaction.

### Loading States

Add:

- Skeleton loaders
- Disabled submit buttons during saving
- Loading spinner only when necessary
- Smooth transitions between loading and loaded states

Avoid blank screens during loading.

---

## Responsive Requirements

The layout must be fully responsive.

### Desktop

- Fixed or sticky sidebar
- Wide task list
- Multi-column dashboard cards
- Optional task details panel

### Tablet

- Narrower sidebar or collapsible navigation
- Two-column statistics
- Reduced table columns when necessary

### Mobile

- Drawer navigation
- Single-column layout
- Task cards instead of table rows
- Sticky or floating “Add Task” action when useful
- Filters inside a drawer or bottom sheet
- Full-width forms and dialogs

Use CSS Grid and Flexbox appropriately.

Do not solve responsiveness by simply shrinking desktop elements.

---

## Accessibility Requirements

The application must include:

- Semantic HTML
- Visible keyboard focus states
- Keyboard navigation
- Proper labels for inputs
- Accessible dialog behavior
- ARIA attributes only when necessary
- Screen-reader-friendly task status updates
- Sufficient color contrast
- Reduced-motion support
- Minimum touch target sizes for mobile

Users must be able to complete all major actions without a mouse.

---

## Premium Motion and Interaction System

Motion is a core product feature, not an afterthought. Create a coordinated animation language inspired by premium developer tools such as Supabase and Linear, while keeping the experience fast and professional.

### Motion Principles

- Motion must communicate hierarchy, state change, and spatial relationships
- Prefer opacity, transform, and subtle scale animations for performance
- Avoid animations that delay common actions
- Keep interaction feedback immediate
- Use consistent durations and easing tokens throughout the application
- Do not animate every element simply because it is possible

Create reusable motion tokens similar to:

```css
:root {
  --motion-fast: 120ms;
  --motion-normal: 200ms;
  --motion-slow: 320ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

Reuse the project's existing animation library when available. If the project already uses Framer Motion, Motion, or another suitable library, use it consistently rather than adding a second animation system.

### Required Motion Experiences

#### Application Shell

- Smooth sidebar collapse and expansion
- Animate labels separately from the sidebar width to avoid text squashing
- Slide the mobile navigation drawer over a dimmed or blurred backdrop
- Transition page headings and primary content when changing views
- Preserve layout stability during transitions

#### Cards and Controls

- Add a small elevation or border-glow response on hover
- Use a subtle press state on clickable controls
- Animate active navigation indicators between items
- Animate dropdowns, tooltips, and menus from their trigger location
- Avoid large scaling effects that make the UI feel playful or unstable

#### Task Lifecycle

- Animate newly created tasks into the correct list position
- Animate completion with checkbox feedback, text transition, and list movement
- Animate restored tasks back into active lists
- Animate deletion before removing the item from the DOM
- Use layout animations when sorting or filtering changes task positions
- Avoid losing keyboard focus when list items move

#### Search and Filters

- Expand the AI search surface smoothly from the header
- Animate search suggestions and results with short staggered entrances
- Morph interpreted AI intent into filter chips
- Animate filter-chip addition and removal
- Crossfade between loading, result, empty, and error states
- Keep typing responsive while animations are running

#### Modals, Drawers, and Details Panels

- Use backdrop fades and subtle blur
- Animate panels from the edge they are visually attached to
- Use scale plus opacity for centered dialogs
- Restore focus after exit animations finish
- Prevent background scrolling while overlays are open

#### Feedback States

- Animate skeleton loaders into loaded content without abrupt jumps
- Slide or fade toast notifications into a consistent screen region
- Use a restrained progress animation for async actions
- Provide immediate success, warning, and error feedback

### Performance Requirements

- Prefer GPU-friendly `transform` and `opacity` animations
- Avoid continuously animating large blurred elements
- Do not cause layout thrashing or unnecessary rerenders
- Keep animations smooth on mobile and lower-powered devices
- Lazy-load heavy optional motion features when appropriate
- Test animation behavior with long task lists

### Reduced Motion

Respect the user's operating-system preference:

```css
@media (prefers-reduced-motion: reduce) {
  /* Remove nonessential movement and retain instant state feedback. */
}
```

When reduced motion is enabled:

- Remove staggered entrances
- Replace slides and scales with instant changes or short fades
- Keep essential focus, loading, and success feedback understandable
- Never make functionality depend on animation

Do not use excessive bouncing, parallax, spinning, or distracting background movement.

---

## Dark and Light Modes

The default appearance should use a polished dark mode inspired by Supabase.

Also support light mode using the same design system.

Requirements:

- Use CSS variables or theme tokens
- Save theme preference
- Respect the system theme on first visit
- Avoid flashes of the wrong theme during page load
- Ensure all components remain readable in both modes

---

## Technical Expectations

- Follow the existing framework and architecture
- Use TypeScript when the project supports it
- Keep state predictable and centralized where appropriate
- Avoid unnecessary dependencies
- Reuse existing libraries already installed in the project
- Keep code modular and readable
- Add error handling
- Avoid duplicated UI logic
- Avoid large monolithic components
- Use consistent naming conventions
- Keep styles maintainable

Do not replace the current stack unless absolutely necessary.

---

## Suggested Implementation Order

### Phase 1 — Foundation

- Review the current codebase
- Identify the existing stack and routing structure
- Create theme tokens
- Build the application shell
- Build responsive sidebar and header
- Create reusable UI primitives

### Phase 2 — Task Management

- Add task data model
- Create task list
- Add create, edit, complete, and delete functionality
- Add confirmation dialog
- Add task persistence

### Phase 3 — Organization

- Add projects or categories
- Add priorities
- Add due dates
- Add tags
- Add Today, Upcoming, and Completed views

### Phase 4 — AI Search and Filters

- Add immediate local keyword search
- Add a server-side AI intent-parsing endpoint
- Validate AI responses with a structured schema
- Convert natural-language queries into editable filters
- Add recent searches and suggested prompts
- Add filters and sorting
- Add active filter chips
- Add loading, error, fallback, and empty search states
- Add keyboard shortcuts and result navigation

### Phase 5 — Motion and Polish

- Add shared motion tokens
- Add coordinated layout and page transitions
- Add task lifecycle and list-reordering animations
- Add AI search and filter-chip animations
- Add loading states
- Add skeletons
- Add toasts
- Add responsive mobile cards
- Add dark and light themes
- Improve accessibility

### Phase 6 — Validation

- Test all task actions
- Test mobile and desktop layouts
- Test keyboard navigation
- Test theme switching
- Test persistence
- Run lint and build
- Fix console errors and warnings

---

## Acceptance Criteria

The work is complete when:

- Users can create, edit, complete, restore, and delete tasks
- Tasks can include priorities, due dates, and projects
- Keyword search, AI natural-language search, filters, and sorting work correctly
- AI search converts interpreted intent into visible, editable filter chips
- Search continues working with a local fallback when AI is unavailable
- Tasks persist after refresh
- The design clearly feels inspired by a premium Supabase-style dashboard
- The desktop and mobile experiences are both polished
- The sidebar is responsive and collapsible
- Forms and dialogs are accessible
- Delete actions require confirmation
- Empty states, loading states, and toasts are implemented
- Dark mode and light mode both work
- No horizontal scrolling occurs on mobile
- Motion feels coordinated, responsive, and professional across the application
- Reduced-motion preferences are fully respected
- The application has no console errors
- Lint and production build pass successfully

---

## Final Agent Instructions

Before changing code:

1. Inspect the current project structure.
2. Identify the framework, styling method, and existing components.
3. Reuse existing patterns and dependencies.
4. Avoid deleting working features unless replacement is required.
5. Implement the todo application in small, testable steps.

During implementation:

- Keep the UI consistent
- Keep components reusable
- Test responsiveness frequently
- Preserve accessibility
- Avoid placeholder-quality styling
- Use realistic sample data only when needed for development

After implementation:

1. Run the linter.
2. Run the production build.
3. Test the application at mobile, tablet, and desktop widths.
4. Verify all CRUD operations.
5. Verify task persistence.
6. Verify keyboard navigation and dialog behavior.
7. Report the files changed.
8. Summarize the completed features.
9. Mention any remaining limitations clearly.

The final application should look polished, intentional, responsive, and portfolio-ready.
