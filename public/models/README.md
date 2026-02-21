# Avatar Models

Esta carpeta contiene los modelos 3D (GLB) de Ready Player Me para cada agente.

## Nombres de archivo esperados

Cada archivo debe nombrarse según el `id` del agente (ver `agentsConfig.ts`):

- `main.glb` - 🦞 Tenacitas (COO)
- `academic.glb` - 🎓 Profe (Docencia)
- `studio.glb` - 🎬 Studio (YouTube)
- `linkedin.glb` - 💼 LinkedIn Pro
- `social.glb` - 📱 Social (IG, X, TikTok)
- `infra.glb` - 🔧 Infra (DevOps)

## Cómo obtener los modelos

1. Ve a https://readyplayer.me/avatar
2. Crea un avatar para cada agente
3. Descarga como GLB
4. Renombra según la lista de arriba
5. Coloca en esta carpeta

## Características recomendadas por agente

### 🦞 Tenacitas (main.glb)
- Look: Profesional tech, COO ejecutivo
- Ropa: Camisa casual-formal, sin corbata
- Vibe: Líder, decisivo, organizado

### 🎓 Profe (academic.glb)
- Look: Profesor universitario
- Ropa: Camisa + chaleco o blazer
- Accesorios: Gafas (opcional)
- Vibe: Intelectual, pedagógico

### 🎬 Studio (studio.glb)
- Look: Creador de contenido, YouTuber
- Ropa: Casual moderno, hoodie o camiseta
- Accesorios: Auriculares alrededor del cuello
- Vibe: Creativo, dinámico

### 💼 LinkedIn Pro (linkedin.glb)
- Look: Ejecutivo corporativo
- Ropa: Traje completo o camisa formal
- Vibe: Profesional, pulido, networking

### 📱 Social (social.glb)
- Look: Trendy, social media manager
- Ropa: Moderna, streetwear chic
- Vibe: Joven, conectado, cool

### 🔧 Infra (infra.glb)
- Look: DevOps engineer, SysAdmin
- Ropa: Camiseta tech, hoodie
- Accesorios: Auriculares gaming
- Vibe: Técnico, hackerista

## Fallback

Si un archivo GLB no existe, el sistema usará una esfera de color como placeholder.

## Formato

- **Formato:** GLB (binary GLTF)
- **Tamaño recomendado:** < 5MB por modelo
- **Optimización:** Ready Player Me exporta modelos optimizados para web

## Animaciones (futuro)

Los modelos de Ready Player Me incluyen rigging automático. En fases futuras se añadirán animaciones:
- Idle (respiración)
- Typing (teclear)
- Thinking (pensativo)
- Error (frustración)
