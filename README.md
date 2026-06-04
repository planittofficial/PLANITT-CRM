# Planitt CRM

Planitt CRM is a full-stack internal CRM for team operations, projects, task execution, attendance, real-time chat, analytics, and Google Workspace workflows. The app is built as a monorepo with a Next.js frontend, Express API, Prisma/PostgreSQL data layer, JWT authentication, and Socket.IO real-time updates.

![Next.js](https://img.shields.io/badge/Frontend-Next.js_15-111827?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-3268ff?style=for-the-badge)
![Express](https://img.shields.io/badge/API-Express-16a34a?style=for-the-badge)
![Prisma](https://img.shields.io/badge/ORM-Prisma-7c3cff?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-2563eb?style=for-the-badge)
![Realtime](https://img.shields.io/badge/Realtime-Socket.IO-f59e0b?style=for-the-badge)

## Quick Navigation

- [Product Snapshot](#product-snapshot)
- [Feature Checklist](#feature-checklist)
- [Role Permissions](#role-permissions)
- [Screens & Workflows](#screens--workflows)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Models](#database-models)
- [Development Commands](#development-commands)
- [Troubleshooting](#troubleshooting)
- [Roadmap Ideas](#roadmap-ideas)

## Product Snapshot

Planitt CRM is designed for a company that needs one place to manage daily work:

| Area | What it does |
| --- | --- |
| Dashboard | Role-aware overview, KPIs, leadership analytics, employee performance, attendance insights, task progress, and Google Workspace actions. |
| Projects | Department-linked project boards with owners, progress, task counts, and kanban-style task management. |
| Tasks | Create, assign, edit, delete, track progress, toggle checklists, and report/respond to blockers. |
| Employees | Table directory: create users, assign roles and managers, update emails, bulk CSV (admins), delete members; managers scoped to their team. |
| Departments | Create departments, assign heads, and structure the organization. |
| Attendance | Check in/out, track active attendance, and calculate work hours for analytics. |
| Chat | Department and project rooms with stored messages and real-time refresh support. |
| Settings | Profile/settings workspace, theme preferences, and role-aware controls. |
| Integrations | Google OAuth, Google Meet sessions, Google Sheets project exports, and Google Drive project folders. |

## Feature Checklist

### Core CRM

- [x] JWT login and authenticated API requests
- [x] Google login for registered CRM users
- [x] Role-based access control
- [x] Superadmin, Admin, Manager, Employee, and Intern roles
- [x] User profile lookup and profile updates
- [x] Leadership-controlled email updates
- [x] Employee creation and assignment management
- [x] Department creation and department head assignment
- [x] Manager-to-direct-report hierarchy

### Dashboard & Analytics

- [x] Role-aware dashboard summaries
- [x] Organization metrics for leadership
- [x] Employee-specific task and attendance analytics
- [x] Department-wise analytics table
- [x] Completion rate and progress charts
- [x] Attendance heatmaps and intensity charts
- [x] Recent leadership updates
- [x] Team roster visibility
- [x] Google Workspace connection status
- [x] Workspace quick signals: tasks, open tasks, projects, departments

### Projects

- [x] Create projects by department
- [x] Assign project owner
- [x] Project progress calculated from task progress
- [x] Project task counters
- [x] Project-specific task board
- [x] Move tasks between Todo, In Progress, and Done
- [x] Create project tasks with assignees and checklists
- [x] Edit and delete project tasks

### Tasks

- [x] Create standalone tasks
- [x] Assign tasks to multiple users
- [x] Add checklist items
- [x] Auto-sync task progress from checklist completion
- [x] Manual progress updates for tasks without checklists
- [x] Status updates: Todo, In Progress, Done
- [x] Task editing by leadership roles
- [x] Task deletion by leadership roles
- [x] Employee/intern blocker reporting
- [x] Manager/admin responses to reported blockers
- [x] Real-time task refresh events

### Leave Management

- [x] Create leave requests with type, start/end dates, reason, and attachment support
- [x] Department head fallback routing when no direct manager exists
- [x] Role-based permission checks for requester, manager, admin, and superadmin access
- [x] Leave request detail view with approval/rejection/more-info workflow
- [x] Add comments and threaded discussion to leave requests
- [x] Leave list page with search and status filters
- [x] Real-time leave notifications for assigned users and requesters
- [x] REST APIs for leave types, requests, status updates, comments, and attachments

### Attendance

- [x] Daily check-in
- [x] Daily check-out
- [x] Prevent duplicate active check-ins
- [x] Work-hour calculation
- [x] Attendance analytics for dashboards
- [x] Real-time attendance refresh events

### Chat

- [x] Department chat rooms
- [x] Project chat rooms
- [x] Access checks for room visibility
- [x] Message history
- [x] Message creation
- [x] Real-time chat refresh events

### Google Workspace

- [x] Google Workspace OAuth connection for leadership roles
- [x] Store granted scopes and connection state
- [x] Refresh Google access tokens
- [x] Create Google Meet sessions from project context
- [x] Export project reports to Google Sheets
- [x] Create Google Drive project folders
- [x] Upload project summary file to Drive
- [x] Disconnect Google Workspace
- [x] Google login OAuth flow

### UI/UX

- [x] CRM Pro-inspired layout
- [x] Compact blue/dark sidebar
- [x] Shared top search/action bar
- [x] Light dashboard and employee workspace
- [x] Dark task/project board workspace
- [x] Blue-violet accent system
- [x] Responsive shell for desktop and mobile
- [x] Per-user light/dark theme preference
- [x] Modern cards, progress bars, status pills, avatars, and focused work surfaces

## Role Permissions

| Capability | Superadmin | Admin | Manager | Employee | Intern |
| --- | --- | --- | --- | --- | --- |
| View dashboard | Yes | Yes | Yes | Yes | Yes |
| Create users | Yes | Yes | Yes (employees & interns, own team) | No | No |
| Delete users | Yes | Yes | Yes (employees & interns, own team) | No | No |
| View employees | Yes | Yes | Yes | No | No |
| Update employee assignments | Yes | Yes | Yes (own team) | No | No |
| Bulk upload employees (CSV) | Yes | Yes | No | No | No |
| Create departments | Yes | Yes | No | No | No |
| View departments | Yes | Yes | Yes | No | No |
| Create projects | Yes | Yes | Yes | No | No |
| Create tasks | Yes | Yes | Yes | No | No |
| Edit/delete tasks | Yes | Yes | Yes | Limited | Limited |
| Report task issues | Yes | Yes | Yes | Yes | Yes |
| Respond to issues | Yes | Yes | Yes | No | No |
| Check in/out attendance | Yes | Yes | Yes | Yes | Yes |
| Use Google Workspace integration | Yes | Yes | No | No | No |

## Screens & Workflows

### 1. Login

- Email/password login
- Google login
- Registered-user checks for Google accounts
- Redirect to dashboard after token is stored

### 2. Dashboard

- Leadership users see organization health, departments, projects, teams, activity, and Google Workspace controls.
- Employees/interns see their own work, completion metrics, attendance state, and assigned task progress.

### 3. Projects

1. Create a department-linked project.
2. Assign an owner.
3. Add project tasks.
4. Move work across Todo, In Progress, and Done.
5. Track calculated project progress.
6. Generate Meet, Sheets, or Drive assets from the dashboard workspace.

### 4. Tasks

1. Create a task.
2. Assign one or more users.
3. Add checklist items.
4. Team members complete checklist items or update progress.
5. Blockers are reported from the task card.
6. Managers/admins respond to unblock work.

### 5. Employees & Departments

- Superadmins and admins manage the full directory (create, update, delete, bulk CSV).
- Managers create, update, and delete **employees and interns on their team** (direct reports); bulk CSV remains admin-only.
- Leadership assigns department, role, designation, and manager where permitted by role.
- Departments organize projects, employees, analytics, and chat rooms.

### 6. Attendance

- Users check in at the start of the work session.
- Users check out at the end.
- Attendance records feed dashboard analytics and user performance reports.

### 7. Chat

- Users can join department/project conversations they are allowed to access.
- Messages are stored in PostgreSQL and refreshed via CRM events.

## Tech Stack

| Layer | Tooling |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Auth | JWT, bcrypt, Google OAuth |
| Realtime | Socket.IO |
| Integrations | Google Calendar/Meet, Google Sheets, Google Drive |
| Monorepo | npm workspaces |

## Project Structure

```text
Planitt-CRM/
  client/
    app/                    Next.js App Router pages
      dashboard/
      projects/
      tasks/
      employees/
      departments/
      chat/
      settings/
      login/
    components/
      layout/               CRM shell/sidebar/header
      modules/              Feature modules like tasks and attendance
      providers/            Theme and socket providers
      shared/               Shared state panels
    lib/                    API/auth/dashboard helpers
    styles/                 Global Tailwind/theme CSS
    types/                  Shared frontend types

  server/
    prisma/
      schema.prisma         Database models
      migrations/           Prisma migration history
    src/
      controllers/          Business logic
      routes/               Express route modules
      middleware/           Auth and role guards
      config/               Database client
      socket.js             Socket.IO event helpers
    index.js                API/server entrypoint

  docs/
    architecture.md
```

## Getting Started

### Prerequisites

- Node.js 20+ recommended
- npm
- PostgreSQL database
- Google Cloud OAuth credentials if using Google login or Workspace integrations

### Install Dependencies

```bash
npm install
```

Because this repo uses npm workspaces, installing from the root installs dependencies for `client` and `server`.

### Configure Environment

Create environment files:

```bash
server/.env
client/.env.local
```

Use the templates in [Environment Variables](#environment-variables).

### Prepare Database

From the `server` workspace:

```bash
npx prisma generate
npx prisma migrate dev
```

For production-like environments:

```bash
npx prisma migrate deploy
```

### Run the App

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client
```

Open:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:5000/api
Health:   http://localhost:5000/api/health
```

## Environment Variables

### Server: `server/.env`

```env
PORT=5000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
CLIENT_URL="http://localhost:3000"

# Google OAuth / Workspace
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:5000/api/integrations/google/callback"
GOOGLE_LOGIN_REDIRECT_URI="http://localhost:5000/api/auth/google/callback"
```

### Client: `client/.env.local`

```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
```

## API Reference

All API routes are mounted under `/api`.

### Auth

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/signup` | Create an account. |
| POST | `/auth/login` | Login with email/password. |
| GET | `/auth/me` | Get current authenticated user. |
| GET | `/auth/google/auth-url` | Start Google login. |
| GET | `/auth/google/callback` | Handle Google login callback. |

### Dashboard

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/dashboard/summary` | Get role-aware dashboard metrics and analytics. |

### Users

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/users/me` | Get the current user profile. |
| PUT | `/users/me/profile` | Update own profile fields. |
| GET | `/users` | List users for leadership roles. |
| POST | `/users` | Create user (superadmin, admin, or manager with team scope). |
| POST | `/users/bulk-upload` | Bulk-create from CSV (superadmin, admin only). |
| GET | `/users/:id/analytics` | Get analytics for one user. |
| PUT | `/users/:id/profile` | Leadership email/profile update. |
| PUT | `/users/:id/assignment` | Update role, manager, department, and designation. |
| DELETE | `/users/:id` | Remove user (scoped for managers; clears department head / project owner links first). |

### Departments

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/departments` | List departments. |
| POST | `/departments` | Create department. |

### Projects

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/projects` | List visible projects. |
| POST | `/projects` | Create project. |

### Tasks

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/tasks` | List tasks. Supports project filtering from the frontend. |
| POST | `/tasks` | Create task. |
| PUT | `/tasks/:id` | Update task status, progress, title, assignments, or checklist. |
| DELETE | `/tasks/:id` | Delete task. |
| PUT | `/tasks/checklist/:itemId` | Toggle checklist item completion. | 
| POST | `/tasks/:id/issues` | Report a blocker/issue. |
| PUT | `/tasks/issues/:issueId/respond` | Manager/admin response to issue. |

### Attendance

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/attendance/checkin` | Start attendance session. |
| POST | `/attendance/checkout` | End attendance session. |

### Chat

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/chat/rooms` | List accessible department/project rooms. |
| GET | `/chat/messages` | Get messages for a room. | 
| POST | `/chat/messages` | Send message. |

### Google Workspace

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/integrations/google/status` | Check Workspace connection and CRM signals. |
| GET | `/integrations/google/auth-url` | Start Google Workspace OAuth. |
| GET | `/integrations/google/callback` | Handle Workspace OAuth callback. |
| POST | `/integrations/google/meet/session` | Create a Google Meet session for a project. |
| POST | `/integrations/google/sheets/project-report` | Export project report to Google Sheets. |
| POST | `/integrations/google/drive/project-folder` | Create Google Drive folder and summary file. |
| DELETE | `/integrations/google/disconnect` | Disconnect Workspace integration. |

### Health

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | API health check. |

## Database Models

| Model | Purpose |
| --- | --- |
| `User` | Accounts, roles, managers, departments, Google connection, tasks, attendance, chat. |
| `Department` | Organization units, department heads, members, projects, chat rooms. |
| `Project` | Department-owned projects with owner, tasks, and project chat. |
| `Task` | Work item with status, progress, assignees, checklist, and issues. |
| `TaskChecklistItem` | Checklist item with completion state. |
| `TaskIssue` | Blocker report and manager/admin response. |
| `TaskAssignment` | Many-to-many task assignment mapping. |
| `Attendance` | Check-in/check-out work session records. |
| `GoogleWorkspaceConnection` | OAuth token and service connection state. |
| `ChatMessage` | Department/project chat messages. |

Enums:

- `UserRole`: `SUPERADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE`, `INTERN`
- `TaskStatus`: `TODO`, `IN_PROGRESS`, `DONE`
- `ChatChannelType`: `DEPARTMENT`, `PROJECT`

## Realtime Events

The backend emits CRM-wide Socket.IO events after important changes. The frontend listens and refreshes relevant screens.

| Event | Typical trigger |
| --- | --- |
| `task:updated` | Task create/update/delete, checklist toggle, issue response. |
| `issue:updated` | Blocker reported or responded to. |
| `org:updated` | User, department, or assignment changes. |
| `project:updated` | Project or project task changes. |
| `attendance:updated` | Check-in/check-out. |
| `chat:updated` | New chat message. |

## Development Commands

Run from the repository root:

| Command | What it does |
| --- | --- |
| `npm install` | Install workspace dependencies. |
| `npm run dev` | Start the Next.js client workspace. |
| `npm run dev:client` | Start only the frontend. |
| `npm run dev:server` | Start only the backend with watch mode. |
| `npm run build` | Build the frontend. |
| `npm run start` | Start the backend server. |

Useful Prisma commands from `server/`:

```bash
npx prisma generate
npx prisma migrate dev 
npx prisma migrate deploy
npx prisma studio
```

## Troubleshooting

### `Unauthorized` or `Invalid token`

- Log in again from `/login`.
- Check that `JWT_SECRET` is stable between server restarts.
- Make sure requests include `Authorization: Bearer <token>`.

### Database connection fails

- Verify `DATABASE_URL` and `DIRECT_URL`.
- Confirm the database is reachable.
- Run `npx prisma generate`.
- Run migrations with `npx prisma migrate dev` or `npx prisma migrate deploy`.

### Google login does not work

- Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- Confirm `GOOGLE_LOGIN_REDIRECT_URI` matches the Google Cloud OAuth redirect URI.
- Confirm the Google account already exists as a CRM user.

### Google Workspace actions fail

- Connect Workspace from the dashboard first.
- Confirm the requested scopes are enabled:
  - Google Calendar events
  - Google Sheets
  - Google Drive file access
- Check that the OAuth app has the callback URL:

```text
http://localhost:5000/api/integrations/google/callback
```

### Socket updates are not visible

- Make sure the backend is running on `http://localhost:5000`.
- Make sure the frontend uses `NEXT_PUBLIC_API_URL=http://localhost:5000/api`.
- Socket.IO currently allows `http://localhost:3000` in server CORS.

### Windows PowerShell blocks npm

If PowerShell blocks `npm`, use:

```powershell
npm.cmd run dev:client
npm.cmd run dev:server
npm.cmd run build
```

## Roadmap Ideas

- [ ] Lead and deal pipeline module
- [ ] Contact and company records
- [ ] Calendar page for CRM events
- [ ] Reports export center
- [ ] Notification inbox
- [ ] File attachments for tasks and projects
- [ ] Role/permission editor UI
- [ ] Audit log for leadership actions
- [ ] Search results page for the top search bar
- [ ] Production deployment guide

## Maintainer Notes

- Keep backend routes under `server/src/routes`.
- Keep business logic in controllers under `server/src/controllers`.
- Keep reusable frontend modules under `client/components/modules`.
- Keep app routes under `client/app`.
- Run `npm run build` before shipping frontend changes.

