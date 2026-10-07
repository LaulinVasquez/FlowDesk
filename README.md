# FlowDesk

FlowDesk is a polished, responsive task-management dashboard built with Next.js and TypeScript. Its interface takes visual inspiration from modern developer tools, combining muted surfaces, subtle borders, and a focused green accent.

## Demo

### Desktop landing page

![FlowDesk landing page on desktop](docs/images/flowdesk-landing-desktop.png)

### Compact landing page

![FlowDesk landing page in a compact viewport](docs/images/flowdesk-landing-compact.png)

## Features

- Create, edit, complete, restore, and delete tasks
- Add descriptions, priorities, due dates, projects, and tags
- Search task titles, descriptions, projects, and tags
- Interpret natural-language searches such as `show urgent tasks due next week`
- Convert interpreted search intent into removable filter chips
- Recent searches and `/` or `Ctrl/Cmd + K` keyboard shortcuts
- Filter tasks by status, priority, and project
- Sort by creation date, due date, priority, or title
- Dedicated Today, Upcoming, and Completed views
- Project creation and management
- Dashboard statistics and completion progress
- Dark and light themes
- Responsive desktop, tablet, and mobile layouts
- Collapsible desktop sidebar and mobile navigation drawer
- Confirmation dialogs, empty states, and toast notifications
- Authenticated, cross-device task and project persistence through Supabase
- In-app reminders and optional standards-based browser push notifications
- Exact-email user connections, task assignment, and reviewed/approved workflows
- Responsive Work Board with collaboration filters, secure drag-and-drop, review notes, and activity history
- Keyboard focus states and reduced-motion support

## Tech Stack

- [Next.js](https://nextjs.org/) App Router
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Lucide React](https://lucide.dev/) icons
- [Supabase](https://supabase.com/) authentication and PostgreSQL persistence
- Custom responsive CSS
- npm

## Getting Started

### Prerequisites

- Node.js 18.18 or newer
- npm
- A Supabase project with the repository migrations applied

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

### Supabase OAuth on Vercel

In **Supabase Dashboard → Authentication → URL Configuration**, set:

- **Site URL:** your production Vercel URL, for example `https://flowdesk.example.com`
- **Redirect URLs:** `https://flowdesk.example.com/auth/callback`
- For Vercel preview deployments, optionally add `https://*-<team-or-account-slug>.vercel.app/**`
- Keep `http://localhost:3000/auth/callback` as an additional redirect only for local development

The application builds the OAuth callback from the domain currently open in the browser. The callback also honors Vercel's forwarded host and protocol headers, so production login returns to the same deployed domain.

### Browser push notifications

Apply all Supabase migrations, then configure these variables locally and in Vercel:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

Generate the VAPID key pair with `npx web-push generate-vapid-keys`. Only the public key may be exposed to the browser. The service-role key, private VAPID key, and cron secret must remain server-only.

The GitHub Actions workflow `.github/workflows/notification-processor.yml` calls `/api/notifications/process` every five minutes with `CRON_SECRET` in the authorization header. This keeps the deployment compatible with Vercel Hobby, whose cron jobs can run only once per day. Add repository Actions secrets named `FLOWDESK_URL` (your production origin, such as `https://flowdesk.example.com`) and `CRON_SECRET` (the same value configured in Vercel). The processor uses `due_at` timestamps, sends each eligible reminder to every registered device, and records each task/reminder/subscription delivery to prevent duplicates.

If the scheduled job fails with curl exit code 22, expand **Invoke protected notification processor** in the Actions log and read the response body. A `Missing VAPID configuration` response means the deployment is missing one or more of `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. Set them in Vercel for the environment serving `FLOWDESK_URL`, then redeploy (the public key is also embedded in the browser build). These VAPID values belong in the deployment, not just GitHub Actions secrets. Preserve an existing key pair; replacing it requires devices to subscribe again. Never put the private key in a `NEXT_PUBLIC_` variable or commit it.

The processor only initializes Web Push when an eligible reminder has a registered device. Idle runs succeed without VAPID configuration; runs that need to send still fail with the missing variable names before recording a delivery. After configuring and redeploying, manually run **Process task notifications** and verify a due reminder on a subscribed device.

Push requires HTTPS outside localhost. Browser and operating-system support varies; iOS Web Push generally requires an installed Home Screen web app and a supported iOS version. Browser permission must be granted through the Settings action.

In Settings, **Send test** now sends a real server push to the current browser in production too. It requires authentication, loads the saved subscription through user-scoped RLS, and reports missing deployment configuration or rejected push delivery. A successful test confirms the delivery path; it does not verify the scheduler. Settings restores the browser subscription in Supabase for the signed-in account before showing it as enabled.

GitHub failure alerts are notifications about the scheduled Actions job, not task reminders sent to GitHub by FlowDesk. Fix the failing job using its response body; the workflow now explains missing Actions secrets and bounds network requests. The processor reports push failures instead of silently returning success, releases failed delivery claims for retry, and removes expired subscriptions. Disabling the scheduled workflow stops this scheduler from sending reminders. A task needs both a due date and a due time for scheduled push; date-only tasks still have in-app due indicators.

### Linting

```bash
npm run lint
```

## Project Structure

```text
src/
├── app/
│   ├── globals.css       # Theme tokens, layout, components, and responsive styles
│   ├── layout.tsx        # Root layout and metadata
│   └── page.tsx          # Application entry point
├── components/
│   └── TodoApp.tsx       # Dashboard views and task-management interactions
└── lib/
    ├── data.ts           # Initial sample projects and tasks
    └── types.ts          # Shared task, project, priority, and view types
```

## Data Persistence

Authenticated projects and tasks are stored in Supabase and protected by row-level security. Workspace data persists across refreshes and devices for the signed-in account.

Device-specific preferences such as the selected theme and recent searches remain in browser `localStorage`.

## Collaboration workflow

Apply `20260902000500_add_user_connections_and_task_workflow.sql`, `20260903000100_secure_profile_email_sync.sql`, `20260903000200_collaborative_board_workflow.sql`, and `20260904000100_add_task_comments.sql` before deploying the collaboration UI. Users connect from the People tab by entering another FlowDesk user’s exact email address. The recipient must accept the request before tasks can be assigned.

Assigned tasks follow this workflow:

```text
Assigned → Working → Reviewed → Approved
```

The assignee starts work and submits it for review. The task owner can approve reviewed work or return it to Working with a review note. Approval marks the task complete inside the database workflow function. Reassignment and unassignment are owner-only, reset the workflow to Assigned, and accept only current connections; removing a connection does not invalidate work already assigned.

The Work Board is another view of the same task rows used by the normal task lists. It provides All collaborative work, Assigned by me, and Assigned to me views; person/project filters; due-state indicators; a hide-approved control; desktop Kanban columns; and mobile stage tabs. Drag-and-drop calls the same constrained RPCs as the visible workflow buttons and rolls back when the database rejects a transition.

`task_activity` stores trusted assignment and stage events. Its actor is derived from `auth.uid()` by database triggers, and RLS limits history to the task’s current owner or assignee. Supabase Realtime refreshes task and connection data while both participants have FlowDesk open. Scheduled due reminders continue to use the existing notification processor; collaboration-event push notifications are intentionally deferred in the lighter implementation.

Task owners and current assignees can also exchange lightweight comments from the Work Board detail drawer. Comments use a secure database function that derives the author from `auth.uid()`; direct client inserts are disabled, and participant-only RLS protects the discussion. New comments refresh live for participants who have the board open.

## Optional AI Search

Natural-language search works locally without configuration. To enhance intent parsing with OpenAI, add a server-side environment variable:

```bash
OPENAI_API_KEY=your_api_key
```

An optional model override is also supported:

```bash
OPENAI_SEARCH_MODEL=gpt-5.6-sol
```

API keys are read only by the server route and are never included in client-side code. If the service is unavailable, times out, or returns malformed data, FlowDesk automatically uses its local intent parser.

## Responsive Design

FlowDesk supports:

- Mobile layouts from approximately 320px
- Tablet layouts
- Standard desktop layouts
- Wide displays at 1440px and above

Task rows automatically become mobile-friendly cards, while the desktop sidebar changes into a slide-out navigation drawer.

## Accessibility

The application includes semantic controls, visible focus indicators, accessible labels, keyboard-friendly dialogs, comfortable mobile touch targets, and reduced-motion support.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create an optimized production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint checks |

## License

This project is intended for personal and portfolio use.
