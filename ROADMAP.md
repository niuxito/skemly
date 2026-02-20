# Vibedrawing — Roadmap

## 🚀 Prioridad alta (próximos sprints)

### 1. Compartir diagramas
URL con el DSL codificado en base64 en el hash (`#`) de la URL. Sin backend — funciona puramente en cliente.
- Botón "Share" en el header genera una URL copiable
- Al abrir la URL se restaura el DSL automáticamente
- Compatible con la gestión de sesiones actual

### 2. Edición inline
Click en un nodo del diagrama para editar su label directamente en el canvas.
- Input flotante sobre el nodo seleccionado
- Actualiza el DSL en tiempo real
- ESC cancela, Enter confirma

### 3. Mindmap — issues pendientes
- Nodos con icono + texto multilínea: el posicionamiento vertical del icono no se ajusta correctamente cuando hay varias líneas de texto
- Revisar espaciado entre niveles con labels muy largos

### 4. Grupos anidados
Actualmente el layout puede solaparse cuando hay grupos dentro de grupos.
- Mejorar el cálculo de bounds en `computeGroupBounds()`
- Añadir padding adicional por nivel de anidamiento

### 5. Más layouts
Nuevos modos de layout activables con la directiva `layout:`:
- `SD` — Sequence Diagram (actores + mensajes verticales)
- `SW` — Swimlanes (filas horizontales por grupo)

### 6. Modo presentación
Fullscreen del diagrama con controles mínimos.
- Botón "Present" que oculta el panel izquierdo
- Navegación con teclado (flechas para pan, +/- para zoom)
- ESC para salir

---

## 🕐 Backlog (para más adelante)

### Del spec original — no implementado aún
- **`[Node]@icon=name`** — override explícito de icono (ahora solo funciona inferencia por keyword)
- **`spacing: <number>`** — la directiva se parsea pero no se conecta a ELK
- **Markdown extraction** — si el usuario pega un `.md` con bloques ` ```vibe `, extraer solo ese bloque
- **Auto-heal de delimitadores** — cerrar `[Node` sin `]` al final de línea en el parser

### Mejoras de UX
- **Undo/Redo** en el editor DSL (`Ctrl+Z / Ctrl+Y`)
- **Diagnósticos más descriptivos** — mensajes de error más claros con sugerencia de corrección
- **Atajos de teclado** — documentados y accesibles (`?` abre panel de ayuda)

### Infraestructura
- **Deploy** — publicar en Vercel/Netlify con la API de Claude en una serverless function (para que otros puedan usar la herramienta sin configurar su propia API key)
