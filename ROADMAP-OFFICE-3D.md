# 🏢 The Office 3D - Spec Completa

## Concepto
Entorno 3D navegable que simula una oficina virtual donde trabajan los agentes de OpenClaw. Cada agente tiene su escritorio con estado visual en tiempo real, interacciones, y ambiente inmersivo.

## 1. Entorno Base

### 1.1 Sala Principal
- **Layout**: Oficina open-space con 6 escritorios dispuestos en forma de U
- **Dimensiones**: ~20m x 15m x 3m (altura techo)
- **Agentes representados**:
  1. 🦞 Tenacitas (main) - Escritorio central, el más grande
  2. 🎓 Profe (academic) - Escritorio con libros y pizarra mini
  3. 🎬 Studio (youtube) - Escritorio con cámara y luces
  4. 💼 LinkedIn Pro - Escritorio corporativo limpio
  5. 📱 Social - Escritorio con múltiples pantallas (IG, X, TikTok)
  6. 🔧 Infra - Escritorio con servidores mini, cables

### 1.2 Mobiliario & Decoración
- **Escritorios**: Mesa, silla, lámpara, mouse, teclado
- **Compartido**: 
  - Pizarra grande (Planning/Roadmap)
  - Máquina de café (Agent Energy)
  - Estanterías con libros (MEMORY.md)
  - Archivador (Brain/Files)
  - Impresora (Reports/Export)
  - Reloj de pared (muestra hora real)
- **Ambiente**:
  - Ventanas con vista exterior (cielo dinámico)
  - Plantas decorativas
  - Cuadros en paredes (stats, gráficas)
  - Alfombra central

### 1.3 Iluminación
- **Natural**: Luz de ventanas según hora del día
  - 06:00-09:00: Amanecer (naranja suave)
  - 09:00-18:00: Día (blanco brillante)
  - 18:00-21:00: Atardecer (naranja/rosa)
  - 21:00-06:00: Noche (luna, luces interiores)
- **Artificial**: Lámparas de escritorio, techo
- **Efectos**: Sombras dinámicas, reflejos en pantallas

## 2. Agent Desks - Elementos Visuales

### 2.1 Monitor (pantalla principal)
**Estado según actividad del agente:**
- **Idle**: Screensaver con logo del agente
- **Working**: 
  - Código scrolleando (si está programando)
  - Terminal con comandos (si ejecuta shell)
  - Browser con tabs (si hace research)
  - Dashboard (si está monitorizando)
- **Thinking** (reasoning): Efecto "Matrix" con código verde cayendo
- **Error**: Pantalla roja con stack trace
- **Completing task**: Barra de progreso animada

### 2.2 Avatar/Figura
- **Diseño**: Figura 3D simple o placeholder (cubo, esfera) con emoji del agente
- **Animaciones**:
  - Idle: Respiración suave
  - Working: Tecleando (manos/brazos moviéndose)
  - Thinking: Luz pulsante desde la cabeza
  - Error: Agitar cabeza, efecto de frustración

### 2.3 Nameplate Flotante
- Etiqueta sobre el escritorio con:
  - Nombre del agente
  - Modelo actual (Opus, Sonnet, Haiku)
  - Estado (🟢 Working | 🟡 Idle | 🔴 Error)

### 2.4 Indicadores de Métricas
**En el escritorio:**
- **Speedometer**: Tokens/hora (aguja animada)
- **Stack de papeles**: Tasks en cola (altura = cantidad)
- **Calendario pequeño**: Uptime streak (días sin error)
- **Post-its**: Notas rápidas/TODOs

## 3. Interactividad

### 3.1 Navegación
- **Controles**:
  - WASD: Mover cámara (fly mode)
  - Mouse: Mirar alrededor
  - Scroll: Zoom in/out
  - Space: Subir
  - Shift: Bajar
- **Modos de vista**:
  - First-person: Navegar libremente
  - Top-down: Vista aérea de toda la oficina
  - Desk focus: Acercar a un escritorio específico

### 3.2 Click en Escritorio
**Abre panel lateral con:**
- **Activity Feed**: Últimas 10 acciones del agente
- **Current Task**: Descripción de lo que está haciendo
- **Stats**:
  - Tokens hoy
  - Tasks completadas/falladas
  - Uptime
- **Quick Actions**:
  - Send message
  - Kill current task
  - Change model
  - View full history

### 3.3 Click en Monitor
- Fullscreen overlay mostrando lo que el agente está haciendo
- Si es código: Syntax highlighting
- Si es terminal: Output scrolleable
- Botón "Back to office"

### 3.4 Click en Objetos Interactivos
| Objeto | Acción |
|--------|--------|
| Archivador | Abre Memory Browser (files tree) |
| Pizarra | Muestra Roadmap/Planning actual |
| Café | Agent Mood Dashboard |
| Impresora | Generate Report / Export stats |
| Reloj | Time Travel (ver actividad en un momento pasado) |
| Libros | Knowledge Graph Viewer |

## 4. Sub-Agents Visualization

### 4.1 Aparición
Cuando un agente spawns un sub-agent:
- **Efecto**: Portal/puerta se abre en el escritorio del parent
- **Figura**: Avatar pequeño del sub-agent aparece
- **Animación**: Camina desde el portal hacia el escritorio del parent

### 4.2 Durante Ejecución
- **Posición**: Al lado del parent agent
- **Icono flotante**: Muestra task description
- **Conexión visual**: Línea/beam de luz entre parent y sub-agent
- **Color del beam**: 
  - Azul: Running
  - Verde: Success
  - Rojo: Failed

### 4.3 Finalización
- **Success**: Partículas verdes, sub-agent se desvanece
- **Failed**: Humo/chispas rojas, sub-agent desaparece
- **Timeout**: Sub-agent se vuelve gris y se esfuma

## 5. Ambient Intelligence

### 5.1 Sonido (opcional, toggleable)
- **Ambiente**:
  - Teclas escribiendo (cuando agente trabaja)
  - Click de mouse ocasional
  - Ventiladores de servidores (escritorio Infra)
  - Café cayendo (cuando se consulta Agent Mood)
- **Notificaciones**:
  - "Ding" cuando completa task
  - "Bzzt" cuando hay error
  - Campana cuando llega mensaje
- **Música de fondo**: 
  - Lofi hip hop (opcional)
  - Volumen bajo, no intrusivo

### 5.2 Efectos Visuales
- **Success**: 
  - Confetti desde el techo
  - Monitor emite luz verde
  - Sonrisa del avatar
- **Error**:
  - Humo saliendo del monitor
  - Chispas rojas
  - Avatar se agarra la cabeza
- **Heartbeat**:
  - Beam de luz desde el techo hacia el escritorio
  - Pulso de energía
- **Spawn sub-agent**:
  - Portal con efecto de vórtice
  - Partículas azules

### 5.3 Día/Noche Dinámico
- **Auto**: Sincronizado con hora real (timezone del VPS)
- **Manual**: Slider para cambiar hora manualmente
- **Transiciones**: Smooth (5 segundos de fade)

## 6. Multi-Floor Building (Fase 2)

### Planta 1: Main Office
- 6 escritorios de agentes principales
- Sala de reuniones (para board meetings)

### Planta 2: Server Room
- Racks de servidores (representan: DBs, VPS, integrations)
- Estado visual: luces parpadeantes, cables
- Click en servidor → detalles (uptime, CPU, memoria)
- Consola central para deployment

### Planta 3: Archive
- Estanterías infinitas con cajas
- Cada caja = día de logs/memories
- Búsqueda visual (caja se ilumina)
- Click en caja → leer contenido

### Azotea: Control Tower
- Vista 360° de toda la ciudad (metáfora del ecosistema)
- Dashboard gigante tipo Times Square
- Gráficas en pantallas enormes
- Helipuerto (para "desplegar" features)

### Ascensor
- Botones funcionales para cada piso
- Animación de subida/bajada
- Música de ascensor (opcional, toggleable)

## 7. Customization

### 7.1 Temas de Oficina
- **Modern**: Minimalista, blanco/gris, limpio
- **Retro**: Años 80, CRT monitors, neón
- **Cyberpunk**: Oscuro, luces neón, hologramas
- **Nature**: Madera, plantas, luz natural intensa
- **Matrix**: Todo wireframe, código verde flotante

### 7.2 Personalización de Escritorio
- Cambiar color de silla, mesa
- Añadir objetos decorativos (fotos, figuras)
- Custom wallpaper en monitor
- Nameplate con fuente custom

### 7.3 Modos Especiales
- **Focus Mode**: Solo muestra un escritorio, oscurece el resto
- **God Mode**: Vista aérea con todos los stats visibles
- **Cinematic**: Cámara en movimiento automático (tour)
- **Wireframe**: Modo debug/dev, solo bordes

## 8. Tech Stack

| Componente | Tecnología |
|------------|------------|
| 3D Engine | Three.js + React Three Fiber (@react-three/fiber) |
| Physics | @react-three/rapier (opcional, para objetos físicos) |
| Controls | @react-three/drei (OrbitControls, PointerLockControls) |
| Lights | Three.js PointLight, DirectionalLight, AmbientLight |
| Models | GLTF/GLB (para mobiliario) o Geometries básicas |
| Textures | Canvas textures + Image textures |
| Audio | Howler.js o Web Audio API |
| Particles | @react-three/drei ParticleSystem |
| Post-processing | @react-three/postprocessing (bloom, depth of field) |
| State | Zustand (para sincronizar estado 3D con datos reales) |
| API Calls | SWR o React Query (polling de agent status) |

## 9. Data Sources

**¿De dónde saca la info en tiempo real?**
- **Agent status**: Endpoint nuevo `/api/agents/status` que lee sesiones activas de OpenClaw
- **Activity feed**: `/api/activities` (ya en roadmap Fase 1)
- **Sub-agents**: `/api/subagents` (OpenClaw CLI)
- **Metrics**: `/api/stats` (tokens, tasks, uptime)
- **Polling**: Cada 2-5 segundos para actualizar estados

## 10. Performance Considerations

- **LOD (Level of Detail)**: Reducir polígonos cuando cámara está lejos
- **Culling**: No renderizar objetos fuera de vista
- **Lazy loading**: Cargar plantas solo cuando se visitan
- **Optimizar textures**: Usar compresión, tamaños razonables
- **Limit particles**: Máximo 1000 partículas simultáneas
- **Mobile**: Versión simplificada o modo 2D fallback

## 11. Prioridad de Implementación

### MVP (2 semanas)
1. Sala básica con 6 escritorios estáticos
2. Navegación WASD + mouse
3. Monitors mostrando estado simple (Working/Idle/Error)
4. Click en escritorio → panel con stats
5. Iluminación básica

### V2 (1 semana)
6. Avatares animados
7. Sub-agents visualization
8. Ambient sound
9. Efectos visuales (partículas, beams)

### V3 (1 semana)
10. Multi-floor building
11. Customization (temas)
12. Advanced interactions (objetos clickeables)

### V4 (futuro)
13. Physics
14. Multiplayer (varios usuarios viendo al mismo tiempo)
15. VR mode

---

**Creado:** 2026-02-20 por Tenacitas 🦞
**Inspiración:** Carlos quiere ver a sus agentes trabajar en un espacio virtual inmersivo
