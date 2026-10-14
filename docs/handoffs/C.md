# Handoff C — interfaz y diseño

## Rol / fase

C / fase 2. **Implementación de UI terminada como módulo independiente; pendiente integración en `src/main.ts` y validación visual real.** No se modificaron archivos compartidos ni se inició F.

## Archivos propios

- `src/ui/workspace.ts`: composición semántica, navegación de paneles/vistas, campos numéricos y sliders, actor, toggle de guías, captura por callback y proyección del estado.
- `src/styles/workspace.css`: tema oscuro sobrio, jerarquía visual, estados de foco/selección, breakpoints y reducción de movimiento.
- `tests/ui/workspace.test.ts`: proyección de estado restaurado a los valores presentables de controles.
- `tests/ui/preview.html`, `tests/ui/preview.ts`: harness local para integrar la UI con el store, fixture y renderer de fase 1 durante revisión visual.
- `docs/handoffs/C.md`: esta entrega.

## Comportamiento y auditoría

- El visor recibe el render mediante callback; el módulo no duplica ni muta el renderer. `capture` también se inyecta como callback opcional.
- Vistas: Cámara, Planta, Maqueta y Elevación. Paneles cortos: Escena, Encuadre, Cámara, Foco y Planilla. Paneles sin servicio aún indican su estado pendiente.
- Los controles se vuelven a derivar en cada notificación del store; al restaurar un `ProjectDocument` con una acción de integración se actualizan focal, foco manual/actor, guías, vista, panel, selección y gate. Focal y foco tienen slider más número con restricciones de `LIMITS`; entrada no válida recupera el último valor del store y marca el campo. Las lecturas quedan en el inspector para evitar duplicarlas sobre el visor.
- **A06 (UI):** valores, selects/botones, tags y lecturas se sincronizan desde una única proyección de estado (`deriveWorkspaceModel`). El restaurado de snapshots requiere que integración despache un estado de proyecto restaurado.
- **A17:** rango y campo numérico comparten límites de `LIMITS`; un valor no válido no altera el store y se señala con `aria-invalid`.
- **A21:** composición responsive para escritorio, tablet y móvil; inspector con scroll propio, visor protagonista y colapso de panel. Incluye `100vh` de fallback y `100dvh`. La geometría es propuesta por CSS; no se afirma aprobación visual ni de zoom.
- **A22:** labels asociados, botones nativos, `aria-pressed` para paneles/guías/actores, tabs con `aria-selected`, flechas para cambiar vista, foco visible, Escape cierra panel y descripción textual del canvas. Nombre de actor se escribe con `textContent`.

## Contratos usados y propuestas a A

- Consume `Store`, `AppState`, `AppAction`, `LIMITS`, `createActorAction`, fixture común, `deriveFrame` y `RenderApi` solo desde el harness.
- A debe integrar `mountWorkspace(root, store, { render, capture })` en `src/main.ts`, retirar la composición DOM duplicada y mapear el canvas al `deriveFrame`/`RenderApi` existente. No se tocó `main.ts` por la regla de propiedad.
- Para cargar un plano, A necesita conectar `restoreShot(project, shotId)` con una acción de reemplazo/edición del estado. El reducer de fase 1 no publica una acción para restaurar el documento; la UI reflejará esos valores cuando la acción acordada notifique al store.
- `saveStatus` indica “Cambios en sesión”; el guardado real, feedback de guardado y error requieren integración del repositorio de D.
- Los controles de sensor, apertura, rig, localización, look y planilla no se inventaron: contratos de fase 1 no publican acciones para ellos. Conectarlos después de acordar acciones compartidas.

## Pruebas y evidencia

- `npx vitest run tests/ui/workspace.test.ts`: **aprobado**, 1 archivo, 2 pruebas.
- `npm test`: **aprobado**, 4 archivos, 20 pruebas (incluye cambios concurrentes de B/D presentes en el árbol al ejecutarse).
- `npm run typecheck`: **aprobado** tras estabilizarse los cambios concurrentes.
- `git diff --check -- src/ui src/styles/workspace.css tests/ui`: **aprobado**.
- `npm run build`: **aprobado** al repetirlo tras estabilizarse los cambios concurrentes; Vite 8.3.4 emitió `dist/`.
- Vite informó `ready` en `127.0.0.1:5173`. El navegador integrado intentó abrir el harness `/tests/ui/preview.html` y recibió `net::ERR_CONNECTION_TIMED_OUT`. No se validó layout real, recorrido de teclado en navegador, zoom, DPR ni contraste medido.

## Pendientes y límites

- La nueva UI aún no es la entrada activa hasta integración por A; `src/main.ts` de fase 1 sigue compuesto con el markup inicial.
- Sin DOM de navegador disponible, las pruebas verifican la proyección de controles desde un estado restaurado, no interacción real de input, foco ni renderizado visual.
- No implementa óptica, persistencia, CRUD visual de planilla ni acciones no publicadas. La puerta C queda pendiente de integración y validación en navegador de acuerdo con `docs/VALIDACION.md`.

## Siguiente rol

A puede integrar C en la fase 2.5 después de revisar B/C/D. No iniciar F hasta terminar la integración 2.5.
