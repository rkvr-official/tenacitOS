# TenacitOS — Mission Control parity plan (vs `openclaw-mission-control`)

This document maps the **feature gaps** between:

- **Reference:** https://github.com/abhi1693/openclaw-mission-control (full Mission Control platform)
- **Ours:** https://github.com/rkvr-official/tenacitOS (Next.js Mission Control that uses OpenClaw as the backend)

TenacitOS already provides a lot of “Mission Control” surface area (activity, cron, sessions, memory/files, agents, office). The reference repo adds a more explicit **work orchestration domain** (orgs/board groups/boards/tasks/tags), plus governance and gateway operations.

The key is: **TenacitOS intentionally has no extra DB/backend**. OpenClaw + filesystem is the backend.
So we should implement “boards/tasks/tags/messages” in a way that:

- works without Postgres,
- remains deployable as a single Next.js app,
- persists safely via JSON files under `/data` (ignored by git),
- can later be swapped to a real DB if needed.

---

## 1) What the reference repo has that TenacitOS lacks

### Work orchestration domain
- Organizations → board groups → boards → tasks
- Tags as first-class entities
- Task lifecycle and audit/event trail attached to work items

### Better “agent texting” workflows
- Conversations and messages directly attached to work (task-centric chat)
- Realtime updates / activity stream per work item

### Governance / approvals
- Approval requests for sensitive actions
- Clear auditability and action boundaries

### Gateway-aware operations
- Gateways as managed resources
- Remote execution environments and visibility

---

## 2) What TenacitOS already has (and we should leverage)

- OpenClaw agent discovery, sessions, messages
- Activity log + streaming (`/api/activities/stream`)
- Cron manager + run history
- Memory + file browser/editor
- Auth (cookie-based, rate limited)

This means we do **not** need to copy the reference architecture. We just need to add the missing *domain objects* and glue them into the UI.

---

## 3) Proposed implementation phases (ship small, ship often)

### Phase A — Boards + Tasks (local persistence)
**Goal:** add a Kanban-style “Boards” feature with durable storage (no DB).

- Storage: `data/boards.json` (gitignored)
- API:
  - `GET/POST /api/boards`
  - `GET/PATCH/DELETE /api/boards/:boardId`
  - `GET/POST /api/boards/:boardId/tasks`
  - `GET/PATCH/DELETE /api/boards/:boardId/tasks/:taskId`
- UI: `/boards` route
  - board selector + create board
  - create task form
  - columns: backlog / in progress / done

### Phase B — Task-centric agent chat (“better agent texting”)
**Goal:** each task can be bound to an OpenClaw agent + session.

- Task fields: `agentId`, `sessionId`
- UI: task → “Chat” drawer
  - uses existing `/api/openclaw/chat` and `/api/openclaw/messages`
  - persists returned `sessionId` back onto the task so the thread continues

### Phase C — Activity integration
**Goal:** task/board actions should show up in TenacitOS Activity Log.

- Emit `logActivity("task", ...)` on board/task create/update/delete

### Phase D — Tags and search
**Goal:** tags for task grouping, quick filtering.

- Store tags as simple string arrays on tasks initially
- Add filtering and search UI

### Phase E — Governance (approvals)
**Goal:** add `data/approvals.json` + UI inbox.

- Approvals required before:
  - running a workflow
  - running a risky tool call
  - executing certain cron edits

### Phase F — Gateway operations (optional)
TenacitOS currently operates “on the host”. If we want gateway visibility:

- read gateway status from OpenClaw gateway state
- expose /gateways page

---

## 4) Current implementation status (this branch)

- Implemented Phase A+B+C initial slice:
  - Boards + tasks persisted in `data/boards.json` (gitignored)
  - Boards UI at `/boards`
  - Task chat drawer bound to OpenClaw agent messages
  - Activity logging for board/task mutations

Next: tighten UX (drag/drop ordering, task details modal, filters) and add tags UI.
