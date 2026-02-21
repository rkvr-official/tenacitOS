# 🦞 Mission Control - Design Brief

**Proyecto:** Dashboard de control para Tenacitas (agente AI de OpenClaw)  
**Usuario:** Carlos Azaustre (@carlosazaustre)  
**Fecha:** 2026-02-07  
**Stack:** Next.js 14, Tailwind CSS, TypeScript  
**URL:** http://localhost:3000

---

## 1. Visión General

Mission Control es el panel de administración para **Tenacitas**, un agente AI personal. Permite a Carlos monitorizar, configurar y gestionar todas las actividades de su asistente digital desde una interfaz web unificada.

### 1.1 Objetivos
- Visualizar toda la actividad del agente en tiempo real
- Gestionar tareas programadas (cron jobs)
- Editar archivos de memoria y configuración
- Explorar el workspace de trabajo
- Monitorizar skills instalados
- Ver estadísticas y analytics de uso

### 1.2 Usuarios
- **Usuario único:** Carlos Azaustre (propietario)
- **Acceso:** Protegido por contraseña
- **Dispositivos:** Desktop principalmente, responsive para tablet

### 1.3 Branding
- **Nombre:** Mission Control
- **Mascota:** 🦞 (Tenacitas = tenazas)
- **Color primario:** Emerald (#10b981)
- **Tema:** Dark mode exclusivo
- **Tipografía:** Inter (system font)

---

## 2. Arquitectura de Navegación

```
┌─────────────────────────────────────────────────┐
│  🦞 Mission Control          [Sidebar 256px]    │
├─────────────────────────────────────────────────┤
│  📊 Dashboard        ← Overview principal       │
│  📋 Activity         ← Log de actividades       │
│  🧠 Memory           ← Editor de memoria        │
│  📁 Files            ← Explorador de archivos   │
│  ⏰ Cron Jobs        ← Tareas programadas       │
│  🔍 Search           ← Búsqueda global          │
│  📈 Analytics        ← Gráficas y stats         │
│  🧩 Skills           ← Skills instalados        │
│  ⚙️ Settings         ← Configuración            │
│  ─────────────────                              │
│  🚪 Cerrar sesión                               │
└─────────────────────────────────────────────────┘
```

---

## 3. Pantallas Detalladas

### 3.1 Login (`/login`)

**Propósito:** Autenticación del usuario

**Elementos:**
- Logo centrado (Terminal icon + "🦞 Mission Control")
- Subtítulo: "Introduce la contraseña para acceder"
- Campo de contraseña con icono de candado
- Botón "Entrar" (emerald)
- Mensaje de error inline si contraseña incorrecta
- Footer: "Tenacitas Agent Dashboard"

**Estados:**
- Default: Campo vacío
- Loading: Botón deshabilitado, texto "Verificando..."
- Error: Banner rojo con mensaje

**Diseño:**
- Centrado vertical y horizontal
- Card con fondo gray-900
- Máximo 400px de ancho

---

### 3.2 Dashboard (`/`)

**Propósito:** Vista general del estado del agente

**Secciones:**

#### Header
- Título: "🦞 Mission Control"
- Subtítulo: "Overview of Tenacitas agent activity"

#### Stats Cards (Grid 4 columnas)
| Card | Icono | Color | Dato |
|------|-------|-------|------|
| Total Activities | Activity | Blue | Número total |
| Successful | CheckCircle | Emerald | Éxitos |
| Errors | XCircle | Red | Errores |
| Scheduled Tasks | Calendar | Purple | Cron jobs |

#### Recent Activity (2/3 del ancho)
- Título: "Recent Activity"
- Link: "View all →"
- Lista de últimas 8 actividades
- Cada item: icono tipo + descripción + status badge + hora

#### Upcoming Tasks (1/3 del ancho)
- Título: "Upcoming Tasks"
- Link: "Calendar →"
- Lista de próximos cron jobs
- Cada item: nombre + schedule + tiempo relativo ("in 2 hours")

---

### 3.3 Activity Log (`/activity`)

**Propósito:** Historial completo de acciones del agente

**Filtros (barra superior):**
- Date range picker (presets: Today, Last 7 days, Last 30 days, All time, Custom)
- Type filter chips (multiselect, colores por tipo):
  - file (blue)
  - search (yellow)
  - message (green)
  - command (purple)
  - security (red)
  - build (orange)
  - task (cyan)
  - cron (pink)
  - memory (indigo)
- Status dropdown: All / Success / Error / Pending
- Sort toggle: Newest / Oldest

**Lista de actividades:**
- Card por actividad con:
  - Icono del tipo (izquierda)
  - Tipo + status badge
  - Descripción
  - Duración (si disponible): "1.2s"
  - Tokens usados (si disponible): "1.5k tokens"
  - Metadata expandible (JSON)
  - Fecha y hora (derecha)

**Paginación:**
- "Load more" button
- Contador: "Showing X of Y activities"

---

### 3.4 Memory Browser (`/memory`)

**Propósito:** Editar archivos de memoria del agente

**Layout:** Split view horizontal

#### Panel izquierdo (256px) - File Tree
- Archivos principales:
  - 🧠 MEMORY.md
  - 👻 SOUL.md
  - 👤 USER.md
  - 📖 AGENTS.md
  - 🔧 TOOLS.md
- Carpeta `memory/` expandible
  - Archivos .md ordenados por fecha (nuevos primero)
- Archivo seleccionado: highlight emerald

#### Panel derecho - Editor/Preview
**Toolbar:**
- Path del archivo actual
- Toggle: Edit / Preview
- Indicador "Unsaved changes" (amber dot)
- Botón Save (Ctrl+S)

**Modo Edit:**
- Textarea monospace
- Tab inserta espacios
- Sin syntax highlighting

**Modo Preview:**
- Markdown renderizado
- Headers, bold, italic, code blocks
- Links clicables
- Listas y checkboxes

---

### 3.5 File Browser (`/files`)

**Propósito:** Explorar workspace completo

**Header:**
- Breadcrumbs: Home > folder > subfolder
- View toggle: Grid / List

**Vista Grid:**
- Cards con:
  - Icono grande (folder amarillo / file por extensión)
  - Nombre truncado
  - Tamaño (solo archivos)

**Vista List:**
- Tabla con columnas:
  - Icono + Nombre
  - Type
  - Size
  - Modified

**Interacciones:**
- Click en folder → navega
- Click en archivo → abre modal preview

**Modal Preview:**
- Header: nombre + tipo
- Content: renderizado según tipo
- Actions: Copy, Download, Close

**Colores por extensión:**
- .ts/.tsx: Blue
- .js/.jsx: Yellow
- .json: Green
- .md: Gray
- .py: Blue
- .css: Pink
- Folders: Yellow

---

### 3.6 Cron Jobs (`/cron`)

**Propósito:** Gestionar tareas programadas

**Header:**
- Título + botón "Add Task" (emerald)

**Stats Cards (3 columnas):**
- Total Jobs
- Active (enabled)
- Paused (disabled)

**Grid de Jobs:**
Cada CronJobCard incluye:
- Nombre (bold)
- Descripción (truncada)
- Badge: Active (green) / Paused (gray)
- Schedule human-readable: "Every day at 8:00 AM"
- Cron expression: `0 8 * * *`
- Timezone badge
- "Next run: Feb 8, 08:00 (in 19 hours)"
- Expandible: próximas 3 ejecuciones
- Actions: Toggle enable, Edit, Delete

**Modal Create/Edit:**
- Campo: Name
- Campo: Description (textarea)
- Campo: Schedule (con presets dropdown)
  - Every hour, Every day at 9am, Every Monday, etc.
  - Custom → input manual
- Campo: Timezone (dropdown)
- Preview: próximas 5 ejecuciones
- Buttons: Cancel, Save

**Confirmación Delete:**
- Overlay oscuro
- "Are you sure?" con nombre del job
- Buttons: Cancel, Delete (red)

---

### 3.7 Search (`/search`)

**Propósito:** Búsqueda global en todo el sistema

**Layout:**
- Search input grande con icono
- Clear button (X)

**Resultados:**
Agrupados por tipo con iconos:
- 📄 Memory (blue badge)
- ⚡ Activity (emerald badge)
- 📅 Task (purple badge)

Cada resultado:
- Título (nombre archivo o tipo actividad)
- Snippet con query resaltado
- Path o timestamp
- Click → navega a origen

**Estados:**
- Empty: "Search activities, tasks, and documents..."
- Searching: "Searching..."
- No results: icono + "No results found for 'query'"
- Results: lista agrupada

---

### 3.8 Analytics (`/analytics`)

**Propósito:** Visualizar estadísticas de uso

**Layout:** Grid 2x2 de gráficas

#### Activity Over Time (Line Chart)
- X: últimos 7 días
- Y: número de actividades
- Línea emerald con gradient fill
- Tooltip con fecha y count

#### Activity by Type (Pie Chart)
- Sectores por tipo de actividad
- Colores consistentes con Activity Log
- Leyenda inferior
- Labels con porcentaje

#### Hourly Activity (Heatmap)
- 24 columnas (horas)
- 7 filas (días de semana)
- Intensidad = cantidad
- Tooltip: "Monday 9:00 - 15 activities"

#### Success Rate (Gauge)
- Semicírculo con porcentaje
- Verde >90%, Amarillo 70-90%, Rojo <70%
- Número grande central

**Summary Stats (cards pequeñas):**
- Total this week
- Most active day
- Peak hour
- Avg per day

---

### 3.9 Skills (`/skills`)

**Propósito:** Ver skills instalados y configurados

**Header:**
- Título + Search input
- Stats: "X skills (Y workspace, Z system)"

**Grid de Skills:**
Cada SkillCard:
- Emoji o Puzzle icon
- Nombre
- Badge: Workspace (blue) / System (gray)
- Descripción (2 líneas max)
- Location path (truncado)
- File count
- Button: "View Details"

**Modal Detail:**
- Header: emoji + nombre + badge
- Tabs: SKILL.md | Files
- Tab SKILL.md: markdown renderizado completo
- Tab Files: lista de archivos en el skill
- Link: "Open in Memory Browser"
- Close button

**Filtro:**
- Search filtra por nombre y descripción
- Instantáneo mientras escribes

---

### 3.10 Settings (`/settings`)

**Propósito:** Configuración del sistema

**Secciones:**

#### System Info
Card con datos:
- Agent: "Tenacitas 🦞"
- Uptime: "2d 4h 32m"
- Node.js: "v22.22.0"
- Model: "claude-opus-4-5"
- Workspace: "/root/.openclaw/workspace"
- Memory: "245 MB / 2 GB"

#### Integration Status
Lista de integraciones:
| Integration | Status | Last Activity |
|-------------|--------|---------------|
| Telegram | 🟢 Connected | 2 min ago |
| Twitter (bird) | 🟢 Configured | 5 hours ago |
| Google (gog) | 🟢 Configured | 3 hours ago |

#### Quick Actions
Grid de botones:
- "Restart Gateway" (outline)
- "Clear Activity Log" (outline)
- "View Gateway Logs" (outline)
- "Change Password" (emerald)

**Modal Change Password:**
- Current password (con visibility toggle)
- New password (con visibility toggle)
- Confirm password (con visibility toggle)
- Validación: min 8 chars, must match
- Buttons: Cancel, Change Password

---

## 4. Componentes Compartidos

### 4.1 Sidebar
- Ancho fijo: 256px
- Sticky (no scroll)
- Logo top
- Nav items con iconos
- Active state: bg-emerald-600
- Hover state: bg-gray-800
- Footer: "OpenClaw Agent"
- Logout button (red on hover)

### 4.2 Stats Card
- Borde coloreado según tipo
- Background con tinte del color
- Icono + título (gray-400)
- Número grande (white, bold)
- Opcional: trend indicator

### 4.3 Badge
- Tamaños: sm, md
- Variantes: success (green), error (red), warning (yellow), info (blue), neutral (gray)
- Pill shape

### 4.4 Modal
- Overlay: black 50%
- Card: gray-900, rounded-xl
- Header: título + close button
- Body: contenido
- Footer: actions

### 4.5 Empty State
- Icono grande (opacity 50%)
- Mensaje descriptivo
- Opcional: action button

---

## 5. Design Tokens

### Colores
```
Background:
- Page: gray-950 (#030712)
- Card: gray-900 (#111827)
- Elevated: gray-800 (#1f2937)
- Hover: gray-700 (#374151)

Text:
- Primary: white
- Secondary: gray-400
- Muted: gray-500

Accent:
- Primary: emerald-500 (#10b981)
- Primary hover: emerald-400
- Primary muted: emerald-500/10

Status:
- Success: emerald-400
- Error: red-400
- Warning: yellow-400
- Info: blue-400

Activity Types:
- file: blue-400
- search: yellow-400
- message: green-400
- command: purple-400
- security: red-400
- build: orange-400
- task: cyan-400
- cron: pink-400
- memory: indigo-400
```

### Spacing
- Page padding: 32px (p-8)
- Card padding: 24px (p-6)
- Gap between cards: 24px (gap-6)
- Gap in grids: 16px (gap-4)

### Border Radius
- Cards: 12px (rounded-xl)
- Buttons: 8px (rounded-lg)
- Badges: full (rounded-full)
- Inputs: 8px (rounded-lg)

### Shadows
- Cards: none (using borders)
- Modals: shadow-2xl
- Dropdowns: shadow-lg

---

## 6. Responsive Breakpoints

```
sm: 640px   - Mobile
md: 768px   - Tablet
lg: 1024px  - Desktop
xl: 1280px  - Large desktop
```

**Adaptaciones:**
- < md: Sidebar colapsable (hamburger menu)
- < lg: Grids de 4 → 2 columnas
- < md: Grids de 2 → 1 columna

---

## 7. Estados de UI

### Loading
- Skeleton placeholders (gray-800 animated pulse)
- Spinner para acciones (emerald)

### Empty
- Icono ilustrativo
- Texto explicativo
- CTA opcional

### Error
- Banner inline rojo
- Icono AlertCircle
- Mensaje descriptivo
- Retry button si aplica

### Success
- Toast notification (top-right)
- Auto-dismiss 3s
- Icono CheckCircle verde

---

## 8. Interacciones

### Hover
- Cards: bg-gray-800/50
- Buttons: lighten color
- Links: underline o color change

### Focus
- Ring emerald-500
- Outline visible para accesibilidad

### Active
- Scale 0.98 en buttons
- Background más oscuro

### Transitions
- Default: 150ms ease
- Modals: 200ms
- Collapsibles: 300ms

---

## 9. Iconografía

**Librería:** Lucide React

**Iconos principales:**
- Dashboard: LayoutDashboard
- Activity: Activity
- Memory: Brain
- Files: FolderOpen
- Cron: Clock
- Search: Search
- Analytics: BarChart3
- Skills: Puzzle
- Settings: Settings
- Logout: LogOut

**Iconos de estado:**
- Success: CheckCircle
- Error: XCircle
- Warning: AlertTriangle
- Info: Info
- Pending: Clock

---

## 10. Archivos del Proyecto

```
mission-control/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Dashboard
│   │   ├── layout.tsx         # Layout con Sidebar
│   │   ├── login/page.tsx     # Login
│   │   ├── activity/page.tsx  # Activity Log
│   │   ├── memory/page.tsx    # Memory Browser
│   │   ├── files/page.tsx     # File Browser
│   │   ├── cron/page.tsx      # Cron Jobs
│   │   ├── search/page.tsx    # Search
│   │   ├── analytics/page.tsx # Analytics
│   │   ├── skills/page.tsx    # Skills
│   │   ├── settings/page.tsx  # Settings
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── StatsCard.tsx
│   │   ├── ActivityFeed.tsx
│   │   ├── UpcomingTasks.tsx
│   │   ├── FileTree.tsx
│   │   ├── MarkdownEditor.tsx
│   │   ├── MarkdownPreview.tsx
│   │   ├── FileBrowser.tsx
│   │   ├── FilePreview.tsx
│   │   ├── Breadcrumbs.tsx
│   │   ├── CronJobCard.tsx
│   │   ├── CronJobModal.tsx
│   │   ├── GlobalSearch.tsx
│   │   ├── WeeklyCalendar.tsx
│   │   ├── SkillCard.tsx
│   │   ├── SkillDetailModal.tsx
│   │   ├── SystemInfo.tsx
│   │   ├── IntegrationStatus.tsx
│   │   ├── QuickActions.tsx
│   │   ├── ChangePasswordModal.tsx
│   │   └── charts/
│   │       ├── ActivityLineChart.tsx
│   │       ├── ActivityPieChart.tsx
│   │       ├── HourlyHeatmap.tsx
│   │       └── SuccessRateGauge.tsx
│   └── lib/
│       ├── activity-logger.ts
│       ├── cron-parser.ts
│       └── skill-parser.ts
├── data/
│   ├── activities.json
│   ├── cron-jobs.json
│   ├── tasks.json
│   └── configured-skills.json
└── public/
    └── favicon.ico
```

---

## 11. Próximas Mejoras (Roadmap)

1. **Real-time updates** - WebSocket para activity stream
2. **Terminal** - Enviar comandos al agente desde el dashboard
3. **Notifications log** - Ver mensajes enviados
4. **Cost tracking** - Tokens y costes por día/mes
5. **Mobile app** - PWA o app nativa

---

*Documento generado por Tenacitas 🦞*
*Última actualización: 2026-02-07 13:12 UTC*
