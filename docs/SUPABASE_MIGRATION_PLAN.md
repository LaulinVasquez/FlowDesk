# FlowDesk Data Overview and Supabase Migration Plan

## Purpose

This document describes how FlowDesk currently stores data and provides a phased plan for adding Supabase database queries, persistent user accounts, authentication, and secure per-user workspaces.

The plan applies to the Next.js application in the `todo` directory. It does not apply to TAMS.

## Current Application Architecture

FlowDesk is a Next.js App Router application using React, TypeScript, custom CSS, Lucide icons, and browser storage.

The main application currently runs as one large client component:

```text
src/components/TodoApp.tsx
```

Tasks, projects, filters, search state, theme selection, modals, and navigation are managed with React state inside that component.

## Current Data Storage

| Data | Current source | Persistence |
| --- | --- | --- |
| Initial tasks | `src/lib/data.ts` | Static development data |
| Initial projects | `src/lib/data.ts` | Static development data |
| Created and edited tasks | React state and `localStorage` | Same browser only |
| Created and deleted projects | React state and `localStorage` | Same browser only |
| Theme preference | `localStorage` | Same browser only |
| Recent searches | `localStorage` | Same browser only |
| Search filters and current view | React state | Lost after refresh |
| User profile | Hardcoded in `TodoApp.tsx` | Not editable or authenticated |
| AI search intent | Next.js route handler | Request-based; not stored |

### Browser storage keys

FlowDesk currently uses keys that retain the original project name:

```text
tideline.tasks
tideline.projects
tideline.theme
tideline.searches
```

These should eventually be migrated or renamed to `flowdesk.*` keys. After the Supabase migration, only device-specific preferences such as theme or sidebar state should remain in browser storage.

### Current data flow

```text
src/lib/data.ts
      |
      v
TodoApp React state
      |
      +--> Task creation, editing, completion, and deletion
      +--> Project creation and deletion
      +--> Search, filters, sorting, and dashboard statistics
      |
      `--> localStorage
            |-- tasks
            |-- projects
            |-- theme
            `-- recent searches
```

All task statistics and filtered views are calculated in the browser from the complete local task array.

## Existing Supabase Work

The project already includes:

```text
@supabase/supabase-js
src/lib/supabase.ts
```

However, Supabase is not connected to any screen, query, or mutation yet.

The current client file also contains an environment validation bug:

```ts
if (!supabaseUrl || supabaseAnonkey)
```

This throws when the key exists. It should test for a missing key instead:

```ts
if (!supabaseUrl || !supabasePublishableKey)
```

The current file uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Current Supabase examples use a publishable key name:

```text
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Because FlowDesk uses the Next.js App Router and requires login, the recommended architecture is to add `@supabase/ssr` and create separate browser and server clients with cookie-based sessions.

Official references:

- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side)
- [Creating Next.js browser and server clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework)
- [Supabase Row-Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Current Limitations

- There is no login, registration, session, or logout flow.
- All users would see the same hardcoded profile.
- Tasks cannot synchronize between browsers or devices.
- Clearing browser data deletes the workspace.
- Projects and tasks are not associated with an owner.
- There is no database validation or referential integrity.
- Authorization exists only in the interface.
- Project deletion and task deletion have no server audit trail.
- The application cannot safely support multiple users.
- There are no server-generated timestamps.
- The existing Supabase client is unused and currently throws under valid configuration.
- The README and package name use the FlowDesk brand.

## Recommended FlowDesk Database Model

```text
auth.users
    |
    v
profiles
    |
    +--> projects
    |      `--> tasks
    |
    +--> tasks without a project
    +--> user_preferences
    `--> recent_searches (optional)
```

## Proposed Tables

### `profiles`

One profile for every authenticated user.

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key referencing `auth.users.id` |
| `full_name` | `text` | Display name |
| `avatar_url` | `text` | Optional profile image |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

The authenticated email can come from Supabase Auth instead of being duplicated unless the application needs to query it directly.

### `projects`

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | References `auth.users.id` |
| `name` | `text` | Project name |
| `color` | `text` | Project accent color |
| `icon` | `text` | Optional icon identifier |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

Recommended constraints:

- Project names cannot be blank.
- Project colors should be validated by the application or database.
- An owner should not have duplicate project names unless that behavior is intentional.

### `tasks`

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | References `auth.users.id` |
| `project_id` | `uuid` | Optional project reference |
| `title` | `text` | Required task title |
| `description` | `text` | Optional details |
| `completed` | `boolean` | Completion state |
| `priority` | `text` or enum | Low, medium, or high |
| `due_date` | `date` | Optional due date |
| `tags` | `text[]` | Task tags |
| `created_at` | `timestamptz` | Server creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |
| `completed_at` | `timestamptz` | Completion timestamp |

Recommended constraints and indexes:

- Require a nonblank title.
- Restrict priority to `low`, `medium`, or `high`.
- Index `owner_id`.
- Index `project_id`.
- Index `due_date` for Today, Upcoming, and Overdue queries.
- Add an index on `owner_id, completed` for status filtering.
- Use `on delete set null` for `project_id` so deleting a project does not delete its tasks.

For the current feature set, a PostgreSQL `text[]` column is sufficient for tags. A separate tags table can be introduced later if users need shared tag management or complex tag analytics.

### `user_preferences`

| Column | Type | Purpose |
| --- | --- | --- |
| `user_id` | `uuid` | Primary key referencing `auth.users.id` |
| `theme` | `text` | Dark, light, or system |
| `default_view` | `text` | All, Today, Upcoming, or another valid view |
| `task_density` | `text` | Comfortable or compact |
| `notifications_enabled` | `boolean` | Notification preference |
| `sidebar_collapsed` | `boolean` | Optional synchronized layout preference |
| `updated_at` | `timestamptz` | Last update timestamp |

Theme and sidebar state could remain local-only. Store them in Supabase only if preferences should follow the user across devices.

### `recent_searches` (optional)

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Search owner |
| `query` | `text` | Search phrase |
| `created_at` | `timestamptz` | Search time |

This table is optional. Keeping recent searches in local storage provides better privacy and requires fewer writes. The recommended initial migration leaves recent searches local.

## Authentication Design

### Recommended initial flow

1. Create `/login` and `/signup` pages.
2. Support email and password or email magic links.
3. Store sessions in cookies using `@supabase/ssr`.
4. Add an auth callback route if the selected flow requires it.
5. Protect the dashboard with a Next.js proxy or server-side session check.
6. Redirect unauthenticated users to `/login`.
7. Replace the hardcoded Laurin Vasquez profile with the authenticated profile.
8. Add logout and account settings.

### Recommended Supabase utilities

```text
src/lib/supabase/
|-- client.ts     # Browser components
|-- server.ts     # Server Components, actions, and route handlers
`-- proxy.ts      # Session refresh helper, if required by the selected setup
```

The existing single `src/lib/supabase.ts` file should be replaced by these environment-specific clients.

## Row-Level Security

RLS must be enabled on every user-data table exposed through the Supabase Data API.

### Core policy behavior

```text
profiles.owner = authenticated user
projects.owner_id = authenticated user
tasks.owner_id = authenticated user
preferences.user_id = authenticated user
recent_searches.user_id = authenticated user
```

Conceptual task policy:

```sql
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id)
```

Policies are required separately for select, insert, update, and delete operations. Update operations also require a compatible select policy.

The browser may contain the Supabase publishable key because RLS protects user records. A service-role key bypasses RLS and must never be exposed in client code.

## FlowDesk Queries

### Initial workspace query

After login, retrieve:

- Authenticated profile
- User projects
- User tasks
- User preferences, if synchronized

Projects and tasks can be fetched separately or with a relational query. Separate focused queries may be easier to cache and update initially.

### Dashboard queries

- Count all user tasks.
- Count completed tasks.
- Count pending tasks.
- Count overdue tasks where `due_date` is before today and `completed` is false.
- Retrieve recently created or updated tasks.
- Retrieve upcoming deadlines.

For a small personal task list, loading the user’s tasks and deriving summary values in React is acceptable. For large workspaces, move counts and pagination into SQL queries or database functions.

### Task mutations

- Insert task
- Update task details
- Set completed and `completed_at`
- Restore a task
- Delete a task
- Clear completed tasks for the authenticated owner

### Project mutations

- Insert project
- Rename project
- Update color or icon
- Delete project
- Set affected tasks to no project

### Search

The existing hybrid search can remain:

1. Parse natural-language intent locally or through `/api/search-intent`.
2. Convert intent into validated structured filters.
3. Translate filters into Supabase query modifiers.
4. Query only rows owned by the authenticated user.
5. Never allow search interpretation to mutate task data.

The AI route should receive only the query and project names/IDs needed for intent parsing. It does not need the user’s complete task database.

## Recommended Frontend Structure

The current `TodoApp.tsx` handles nearly every concern. The database migration is a good point to divide it into focused modules.

```text
src/
|-- app/
|   |-- login/page.tsx
|   |-- signup/page.tsx
|   |-- auth/callback/route.ts
|   `-- page.tsx
|-- components/
|   |-- layout/
|   |-- tasks/
|   |-- projects/
|   |-- settings/
|   `-- auth/
|-- hooks/
|   |-- useTasks.ts
|   |-- useProjects.ts
|   `-- usePreferences.ts
|-- services/
|   |-- taskService.ts
|   |-- projectService.ts
|   `-- profileService.ts
`-- lib/
    `-- supabase/
        |-- client.ts
        `-- server.ts
```

The service layer should map PostgreSQL snake-case columns to the current TypeScript model or update the frontend types consistently.

## Environment Configuration

Create `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
OPENAI_API_KEY=optional-server-only-key
OPENAI_SEARCH_MODEL=optional-model-override
```

Real values belong in `.env.local`, which is already ignored by Git.

Do not create any public environment variable containing a Supabase service-role key or OpenAI API key.

## Migration Plan

### Phase 1: Correct the Supabase foundation

1. Confirm or create the Supabase project.
2. Install `@supabase/ssr` alongside the existing client package.
3. Replace the current broken client with browser and server client utilities.
4. Standardize on `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Add `.env.example`.
6. Add a `supabase/migrations` directory.
7. Generate database TypeScript types after the schema exists.

### Phase 2: Create schema and policies

1. Create `profiles`, `projects`, `tasks`, and `user_preferences`.
2. Add foreign keys, checks, defaults, and indexes.
3. Add timestamp update triggers.
4. Enable RLS on every table.
5. Add per-user select, insert, update, and delete policies.
6. Test policies with at least two different accounts.

### Phase 3: Add authentication

1. Create login and signup screens matching the FlowDesk design.
2. Add cookie-based sessions.
3. Add session refresh handling.
4. Protect the dashboard route.
5. Add logout.
6. Load the authenticated user’s profile.
7. Replace the hardcoded sidebar name and email.

### Phase 4: Migrate project data

1. Load projects from Supabase after authentication.
2. Connect project creation.
3. Add project renaming.
4. Connect project color changes.
5. Connect deletion and preserve tasks by setting `project_id` to null.
6. Add loading, error, and optimistic states.

### Phase 5: Migrate task data

1. Load tasks owned by the authenticated user.
2. Connect task creation.
3. Connect task editing.
4. Connect completion and restoration.
5. Connect confirmed deletion.
6. Connect clear-completed behavior.
7. Preserve toasts and immediate optimistic feedback.
8. Roll mutations back if Supabase rejects an operation.

### Phase 6: Translate filters and search

1. Preserve immediate local search for already loaded records.
2. Translate status, priority, project, overdue, and date intent into Supabase queries.
3. Add server pagination when task volume requires it.
4. Keep AI-generated intent validated before querying.
5. Keep recent searches local initially.

### Phase 7: Preferences and multi-device behavior

1. Decide which settings should synchronize.
2. Store synchronized preferences in `user_preferences`.
3. Retain device-only preferences in local storage.
4. Remove the legacy `tideline.*` local-storage fallback after the migration window.
5. Keep user-facing labels aligned with the FlowDesk brand.

### Phase 8: Remove prototype storage

1. Keep `src/lib/data.ts` only as development seed data.
2. Add a one-time local-storage import option if existing local tasks must be retained.
3. Stop writing tasks and projects to local storage.
4. Remove fallback sample data from production behavior.
5. Confirm refresh, logout, and cross-device synchronization.

### Phase 9: Testing and release

1. Test login, signup, logout, and session expiry.
2. Test that two users cannot access each other’s tasks or projects.
3. Test task and project CRUD.
4. Test optimistic-update rollback.
5. Test local and AI search against database records.
6. Test mobile and desktop loading/error states.
7. Run lint, TypeScript validation, and production build.
8. Perform the migration in a staging Supabase project before production.

## Recommended First Milestone

The first useful Supabase-backed delivery should include:

1. Correct browser and server Supabase clients
2. Database migrations for profiles, projects, and tasks
3. RLS policies
4. Login, signup, session restoration, and logout
5. Authenticated profile in the sidebar
6. Persistent project reads and writes
7. Persistent task CRUD
8. Loading and error states
9. Two-user isolation tests

Preferences, database-backed recent searches, realtime updates, collaboration, and advanced pagination can follow later.

## Decisions Needed Before Implementation

### Login method

Choose an initial method:

- Email and password
- Email magic link
- Google OAuth
- Another approved OAuth provider

### Account model

Confirm whether FlowDesk is:

- A private personal task manager where every user sees only their own workspace
- A collaborative product with shared projects and project memberships

This plan assumes private per-user workspaces. Collaboration would require additional `project_members` and invitation tables plus more complex RLS policies.

### Existing local data

Choose whether to:

- Discard current sample/local data after account creation
- Offer a one-time import into the new user’s Supabase workspace

### Account creation

Choose whether anyone may sign up or whether accounts require invitations or an approved email domain.

## Security Rules

- Enable RLS before connecting production UI queries.
- Never expose the Supabase service-role key.
- Never expose the OpenAI API key.
- Derive `owner_id` from the authenticated session rather than trusting arbitrary client input.
- Validate task titles, priorities, dates, and project ownership.
- Ensure a task cannot reference another user’s project.
- Test policies directly, not only through the UI.
- Keep AI search read-only and separate from mutations.
