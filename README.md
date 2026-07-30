# Tideline

Tideline is a polished, responsive task-management dashboard built with Next.js and TypeScript. Its interface takes visual inspiration from modern developer tools, combining muted surfaces, subtle borders, and a focused green accent.

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
- Local persistence through browser `localStorage`
- Keyboard focus states and reduced-motion support

## Tech Stack

- [Next.js](https://nextjs.org/) App Router
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Lucide React](https://lucide.dev/) icons
- Custom responsive CSS
- npm

## Getting Started

### Prerequisites

- Node.js 18.18 or newer
- npm

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

Tasks, projects, and the selected theme are stored locally in the browser. Data remains available after refreshing or reopening the application on the same browser and device.

No account or external database is required. Clearing the browser's site data will remove saved workspace data.

## Optional AI Search

Natural-language search works locally without configuration. To enhance intent parsing with OpenAI, add a server-side environment variable:

```bash
OPENAI_API_KEY=your_api_key
```

An optional model override is also supported:

```bash
OPENAI_SEARCH_MODEL=gpt-5.6-sol
```

API keys are read only by the server route and are never included in client-side code. If the service is unavailable, times out, or returns malformed data, Tideline automatically uses its local intent parser.

## Responsive Design

Tideline supports:

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
