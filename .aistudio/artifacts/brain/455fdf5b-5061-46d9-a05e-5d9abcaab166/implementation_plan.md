# Nocturne & Obsidian: Executive Task & Agile Deadline Orchestrator

A high-performance, multi-screen executive command center and agile workflow suite featuring real-time Google Calendar integration, automated deadline escalation engines, proactive notification alerts, and an instant theme switcher between the warm-toned Nocturne Atelier and high-contrast Obsidian Cyber-Tactical palettes.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Phase 1 Interactive Clarification:**
> - **Theme Mode**: Dynamic Theme Switcher allowing seamless real-time switching between **Nocturne Atelier** (warm obsidian depths `#171024`, burnt amber `#ffb77d`, moss olive `#bbccae`) and **Obsidian Cyber-Tactical** (midnight violet `#16111d`, electric neon orange `#ff6200`, acidic lime `#daee00`/`#e2f705`).
> - **Primary Navigation Flow**:
>   1. **Executive Dashboard**: High-level KPI metrics, project health gauges, priority milestones, and active automation monitors.
>   2. **Agile Kanban Board**: Multi-lane board (Backlog, In Progress, Code Review, Done) with drag-and-drop mechanics, priority tagging, and subtask tracking.
>   3. **Deadline Automations & Reminders Hub**: Configurable automation rules engine (24h/1h deadline alerts, auto-escalation to Urgent, morning digest scheduling).
>   4. **Google Calendar Schedule & Event Dispatcher**: Real-time two-way visualization of Google Calendar events, deadline slots, and 1-click sync from tasks to user calendar.
> - **Automation Triggers & Preferences**:
>   - Real-time sync to Google Calendar with custom reminder popup times.
>   - Automated escalation of overdue or impending tasks (<4 hours) to critical/urgent status.
>   - In-app notification center with audio chimes and browser-level deadline warnings at 24 hours and 1 hour before due dates.
>   - Daily morning digest banner and modal summarizing key deliverables due within the next 24 hours.

---

## 1. Overview & Core Concept

- **What It Does**: Unifies executive-level project oversight with day-to-day agile kanban execution. Tasks created in Kanban or Dashboard can instantly synchronize as scheduled events directly onto the user's authentic Google Calendar with customizable reminder alerts. A background automation runner checks task deadlines in real-time, surfaces notifications, updates task urgency states automatically, and prepares morning delivery summaries.
- **Target Audience / Persona**: Engineering leads, product architects, technical project managers, and executives who need both high-density execution boards and executive-tier time management tied into their everyday Google Workspace ecosystem.
- **Key Value**: Bridges the gap between static task boards and real-world executive calendars by offering bidirectional visibility, automated deadline escalation, and proactive reminder triggers in a bespoke dark UI tailored for prolonged cognitive focus.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Executive Overview & KPI Triaging**:
   - The user lands on the Executive Dashboard displaying active sprint velocity, deadline completion rate, impending risk items, and scheduled calendar blocks for today.
   - Quick actions allow instant creation of high-priority milestones and immediate 1-click Google Calendar sync.
2. **Agile Kanban Board Management**:
   - Switching to the Kanban view reveals 4 structured lanes: *Backlog*, *In Progress*, *In Review*, and *Completed*.
   - Users can drag cards across lanes, filter by priority (Urgent, High, Medium, Low) or assignee, toggle calendar sync status, and edit deadlines inline with instant timestamp recalculation.
3. **Automations & Preferences Configuration**:
   - In the Automations Hub, users can toggle and tune rule parameters:
     - 24-Hour & 1-Hour proactive notification triggers.
     - Auto-escalation threshold (e.g. automatically elevate tasks with <4 hours left to "Urgent" with high-visibility neon badging).
     - Morning Digest scheduled delivery (preview current morning brief on demand).
     - Google Calendar default reminder lead time (10 min, 30 min, 1 hour).
4. **Google Calendar Sync & Dispatching**:
   - Authenticated via official Google Workspace OAuth (`calendar.events` scope).
   - Dedicated Calendar view overlays tasks on real Google Calendar events, highlights conflicts, and lets users dispatch unsynced tasks to calendar events in one click.
5. **Theme Switching (Nocturne Atelier vs. Obsidian Cyber-Tactical)**:
   - A global palette switch in the top bar transforms colors, borders, and typographic accents instantly without reloading or losing state.

### Visual Identity & Theme Tokens
- **Theme 1: Nocturne Atelier (Default Option A Refined)**:
  - Surface Floor: `#171024` (deep warm obsidian)
  - Surface High/Elevated: `#231c31` & `#2e263c`
  - Accent Primary: `#ffb77d` & `#d97707` (warm burnt amber)
  - Secondary / Structural: `#bbccae` & `#3f4d36` (tactical moss-olive)
  - Typography: Plus Jakarta Sans (Display/Headlines) + Inter (Body) + JetBrains Mono (Metrics & Timestamps)
- **Theme 2: Obsidian Cyber-Tactical**:
  - Surface Floor: `#100c17` & `#16111d` (midnight obsidian)
  - Surface Container: `#1f1633` & `#2d2834`
  - Primary Accent: `#ff6200` (electric kinetic orange) with photon glow
  - Secondary Accent: `#daee00` / `#e2f705` (acidic lime telemetry)
  - Typography: Inter (Interface & Headings) + JetBrains Mono (Metadata, Telemetry, Uppercase Labels)
- **Top Bar Contract**:
  - Left: Clean single-element brand title wordmark (`whitespace-nowrap shrink-0`).
  - Center: 4 single-line navigation tabs (`Dashboard`, `Kanban Board`, `Automations`, `Calendar Schedule`).
  - Right: Theme switch toggle + Google Auth Account pill + Primary Action ("+ New Task").

---

## 3. Key Product Decisions & Trade-Offs

- **Real-Time Client-Side Google Calendar Integration**:
  - *Approach*: Leverage Firebase Authentication with Google Auth Provider requesting `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.readonly`, caching access tokens in memory for client-side Google Calendar v3 API requests (`https://www.googleapis.com/calendar/v3/calendars/primary/events`).
  - *Why*: Satisfies all workspace integration guidelines, avoids server-side redirect URI mismatch pitfalls on dynamic Cloud Run URLs, and provides immediate real-time feedback.
- **In-Memory & LocalStorage Resilience with Demo Baseline**:
  - *Approach*: Pre-seed rich, authentic agile tasks across software architectures and deadlines so the app is immediately alive and functional even before the user connects their Google account. Once connected, user tasks link directly to live Google Calendar event IDs.
- **Automation Heartbeat Engine**:
  - *Approach*: A React background interval check (30-second cadence) that evaluates active tasks against configured rules (overdue detection, <24h and <1h thresholds, and morning digest compilation), emitting structured notifications to the in-app alert center.
- **Destructive Operation Confirmations**:
  - *Approach*: Explicit confirmation dialog before deleting tasks or removing calendar events, adhering to mandatory Workspace API guidelines.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Top Navigation Bar                              │
│  [ Brand Title ]  ──  [ Dashboard | Kanban | Automations | Calendar ]  │
│  ──  [ Theme Switcher | Google Auth Profile | + New Task ]             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Active View
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    Executive     │       │   Agile Kanban   │       │   Automations    │
│    Dashboard     │       │      Board       │       │   & Preferences  │
│ ──────────────── │       │ ──────────────── │       │ ──────────────── │
│ • Velocity KPIs  │       │ • Drag & Drop    │       │ • 24h/1h Alerts  │
│ • Health Gauges  │       │ • Priority Badges│       │ • Escalation Rule│
│ • Due Milestones │       │ • Calendar Sync  │       │ • Morning Digest │
│ • Quick Dispatch │       │ • Quick Filters  │       │ • Lead Times     │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Task & Automation Store                           │
│  • Task State (ID, Title, Lane, Deadline, Priority, SyncedEventId)     │
│  • Automation Rules & Frequency Settings                               │
│  • In-App Notifications Queue & Dismissed State                        │
│  • Active Theme State ('nocturne' | 'obsidian')                        │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
     ┌─────────────────────────────┐   ┌─────────────────────────────┐
     │   Automations Runner Hook   │   │ Google Calendar Service     │
     │   • 30s Deadline Watcher    │   │ • Firebase Auth Popup       │
     │   • Rule Trigger Dispatcher │   │ • Events GET / POST / DEL   │
     │   • In-App Banner & Sound   │   │ • In-Memory Token Cache     │
     └─────────────────────────────┘   └─────────────────────────────┘
```

### Component Hierarchy & State Mapping
- `src/App.tsx`: Root shell managing theme context (`nocturne` / `obsidian`), navigation view state, and task modal dialog.
- `src/components/TopNav.tsx`: Top bar contract component with theme toggle, navigation tabs, user auth status, and quick task CTA.
- `src/components/ExecutiveDashboard.tsx`: KPI metrics strip (sprint velocity, deadline health, calendar sync ratio), upcoming deliverable timelines, and quick dispatch tray.
- `src/components/KanbanBoard.tsx`: Multi-lane interactive board with drag/drop state, task card details, priority escalation visual indicators, and inline calendar sync buttons.
- `src/components/AutomationsHub.tsx`: Automation toggles, threshold sliders, rule test triggers, and interactive morning digest preview.
- `src/components/CalendarScheduleView.tsx`: Two-way calendar visualization comparing scheduled tasks and authentic Google Calendar events.
- `src/components/NotificationCenter.tsx`: Slide-over notification panel showing triggered alerts (24h warning, 1h emergency, escalated priority, morning brief).
- `src/components/TaskModal.tsx`: Creation and edit dialog with title, lane, deadline date/time picker, priority selector, estimated hours, and automatic Google Calendar dispatch option.
- `src/services/googleCalendar.ts`: Workspace API client handling OAuth sign-in, event insertion, event removal, and listing.
- `src/services/automationEngine.ts`: Rule evaluator detecting upcoming deadlines and auto-escalating priorities.
