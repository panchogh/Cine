# Handoff A — integración E/F y respuesta a G-001–G-004

## Estado y procedencia

Integré las entregas E y F presentes en la carpeta compartida y atendí los cuatro hallazgos G. El checkout compartido no tiene commits/worktrees por E/F/G. HEAD base visible: `3f05106` (`docs: record phase-one handoff commit`); los cambios siguen sin commit y no hay remoto configurado. Conservé los módulos compartidos y el HTML original.

E/F y G reportan módulos entregados en `docs/handoffs/E.md`, `F.md` y `G.md`. Vite local en `127.0.0.1:5178` cargó en Chrome tras permitir el servidor de desarrollo fuera del sandbox de sockets. Ejecuté smoke QA real con UI; no es la matriz completa V12–V20. La aceptación de fase 3 continúa abierta.

La referencia `cine_shot_visualizer_3d_pro.html` conserva su SHA-256 conocido: `cbeb6cdbed013cfb246cf4e4a763ad50fce974fcb8a7d108912465326e88e04b`.

## Integración realizada

- `src/render/frame.ts` incluye `look` en el `FrameModel` compartido; foco UI y DoF leen el mismo `deriveFrame(...).metrics.focus` del core. La UI distingue distancia axial y de cinta (G-001).
- `src/interaction/gestures.ts` está enlazado al canvas estable de `mountWorkspace`; hit-test/drag reciben dimensiones reales CSS px. Planta confirma un movimiento por drag y conserva cancelación/umbral E.
- `src/render/scheduler.ts` entrega timestamp, coalesce invalidaciones estáticas, anima solo en playback y respeta visibilidad. `main.ts` conecta el scheduler al store, resize, gestos y ticks; vistas/captura vuelven a derivar del mismo tiempo.
- `src/ui/workspace.ts` agrega edición numérica de posición X/Y/Z, selector de movimiento básico, duración, scrubber, Play/Pausar, Nuevo proyecto, foco axial y callback de guardado (G-002–G-004).
- `src/project/save-queue.ts` serializa escritura y clona el mapa de assets de cada solicitud. Guardado manual y debounce/autosave de `main.ts` usan esa misma cola; los fallos no impiden escrituras posteriores.
- `src/contracts/types.ts` formaliza `FrameModel.look`, `CssViewport`, `GestureApi` y el payload CSS opcional; `AppAction` añade `camera/motionChanged` y `runtime/playbackChanged`.

## Contratos definitivos

Las firmas se publican en `src/contracts/types.ts`, `src/contracts/actions.ts` y los exports de módulos. No redefinirlas por separado.

```ts
deriveFrame(project: ProjectDocument, timeSeconds: number, activeView: ViewId): FrameModel
// FrameModel: cámara/gate/actores evaluados, métricas, warnings y look (ND, grain,
// obturación y FPS). Un tiempo absoluto de proyecto en segundos.

RenderApi.renderView(context: CanvasRenderingContext2D, frame: FrameModel, options: RenderViewOptions): void
RenderApi.captureFrame(frame: FrameModel, options: CaptureOptions): Promise<Blob>
// CaptureOptions: { widthPx: number; heightPx: number; includeGuides?: boolean }.
// La captura fuerza vista cámara y excluye guías/HUD por defecto.

GestureApi.hitTest(point: CssPoint, frame: FrameModel, viewportCssPx?: CssViewport): EntityId | null
GestureApi.bindGestures(
  canvas: HTMLCanvasElement,
  readFrame: () => FrameModel,
  dispatch: (action: AppAction) => void,
): Unsubscribe
// CssPoint { xCssPx, yCssPx }; CssViewport { widthPx, heightPx }. Nunca DPR.

createRenderScheduler(render: (timestampMs: number) => void, options?: RenderSchedulerOptions): RenderScheduler
RenderScheduler.invalidate(): void
RenderScheduler.setAnimating(active: boolean): void
RenderScheduler.dispose(): void

ProjectRepository.saveWithAssets(project: ProjectDocument, assets?: ReadonlyMap<EntityId, Blob>): Promise<{ savedAt: string }>
ProjectRepository.loadWithAssets(id: EntityId): Promise<{ project: ProjectDocument; assets: Map<EntityId, Blob>; recovered: boolean } | null>
createProjectSaveQueue(repository)(project: ProjectDocument, assets: ReadonlyMap<EntityId, Blob>): Promise<{ savedAt: string }>

captureShot(project: ProjectDocument, input: CaptureInput): CaptureResult
restoreShot(project: ProjectDocument, shotId: EntityId): ProjectDocument
mountWorkspace(root: HTMLElement, store: Store, options?: WorkspaceOptions): Unsubscribe
```

`WorkspaceOptions` incluye `render`, `capture`, `restoreShot`, `saveProject(state)` y `persistenceStatus`. Acciones nuevas relevantes: `camera/motionChanged`, `runtime/tick`, `runtime/playbackChanged`. Cambiar movimiento reinicia tiempo/reproducción; el player detiene al llegar a `durationS`. El selector ofrece cámara estática, push-in, órbita y handheld con parámetros aproximados. No incluye rack focus.

`ProjectDocument` conserva escena en metros; gate/focal/CoC en milímetros; UI en grados; `ProjectShot` sigue union legacy/independiente. La captura usa cámara evaluada y tiempo de un frame único. E mantiene renderer Canvas 2D esquemático; no se sustituyó motor ni se añadió backend.

## Verificación ejecutada

Comandos de proyecto:

```powershell
npm run dev
npm run typecheck
npm test
npm run build
```

Ejecución de integración, tras los cambios finales: `npm run typecheck` aprobado; `npm test -- --reporter=verbose` **41 tests aprobados en 8 archivos**; `npm run build` aprobado, Vite 8.3.4 transformó **26 módulos**; `git diff --check` aprobado. `npm run dev -- --host 127.0.0.1 --port 5178 --strictPort` cargó la página en Chrome. El servidor se inició con permiso elevado por la restricción local de socket y se detuvo al acabar QA.

Evidencia de G-001–G-004 en código/tests:

- G-001: `tests/ui/workspace.test.ts` compara la lectura UI con `deriveFrame.metrics.focus.axialDistanceM` y separa distancia de cinta.
- G-002: tests de E en `tests/render/render-interaction.test.ts` aprueban conversión CSS; en Chrome un incremento por teclado cambió X a 0,01 m y un drag en Planta cambió X/Z a 0,87/−0,57 m.
- G-003: `tests/state/reducer.test.ts`, `tests/render/frame.test.ts` y `tests/render/render-interaction.test.ts` cubren tiempo, evaluación y scheduler/RAF simulado. En Chrome, Push-in habilitó 3 s/Play, el tiempo avanzó a 1,23 s y Pausar lo dejó en 1,83 s.
- G-004: test de `createNewProjectDocument` valida defaults e identidad local. En Chrome, Nuevo proyecto restauró defaults y mostró «Proyecto nuevo creado; guardando…». No se forzó el diálogo de cambios pendientes.
- Guardado: `tests/project/save-queue.test.ts` cubre serialización, snapshot del mapa de assets y recuperación tras fallo. En Chrome el guardado manual llegó a «Guardado», la escritura automática también, y una recarga recuperó en IndexedDB el actor que se había movido.

Chrome también mostró en el panel Foco el valor axial 1,30 m y la cinta al sujeto 1,55 m desde el frame común. Esto verifica la lectura para esa escena, no todos los casos de orientación/pose.

El smoke de Chrome es evidencia de carga e interacción local, no de toda la matriz. No se ejecutaron V12–V20 completos, captura/restore de snapshot en navegador, diálogo de cambios sin guardar, responsive en varios tamaños, DPR 2, táctil/cancelación, auditoría de accesibilidad ni medición de rendimiento. No hay benchmark FPS/p95.

## Límites que impiden declarar cierre

- No completé la revisión visual/interactiva íntegra; solo hice smoke QA en Chrome con un flujo y escena.
- IndexedDB guardado y recarga quedaron comprobados en Chrome, pero faltan cuota/recuperación de fallo, assets de captura y restauración de snapshots reales, y concurrencia/race de guardado manual/autosave en navegador.
- No hay prueba E2E con navegador configurada en `package.json`.
- No se midió FPS, p95, latencia ni memoria. El scheduler solo se verificó con RAF simulado.
- Fase 3 queda abierta para comprobar V12–V20; fase 4 sigue sin aprobación G. Render esquemático y sin oclusión 3D arbitraria; no hay rack focus, undo/redo ni timeline/curvas completas.
- Mantener la app y sus servicios entendidos como previsualización: ND/grano, actor y movimientos son aproximaciones, no calibración de lente ni simulación física.

## Adenda de cierre focalizado · 2026-10-13

Esta revisión posterior a G tocó `src/ui/workspace.ts`, `src/main.ts` y `src/styles/workspace.css`, además de actualizar la matriz y handoffs. Se mantuvo el checkout compartido sobre baseline `3f05106`; no se creó commit ni remoto. El hash de `cine_shot_visualizer_3d_pro.html` permanece `cbeb6cdbed013cfb246cf4e4a763ad50fce974fcb8a7d108912465326e88e04b`.

### Cambios y evidencia

- **Rack focus aplazado (P2).** No pertenece al gate implementado: falta curva/tiempo/interpolación, edición y semántica portable/snapshot. `docs/VALIDACION.md` define la decisión y ajusta V10/V16 para que eliminar actor, push-in, órbita y handheld se prueben sin insinuar rack implementado.
- **Texto y foco.** Reproduje pérdida de foco al cambiar el nombre de un plano: el render de la biblioteca sustituía el DOM de la tarjeta. `workspace.ts` ahora refresca solo texto/atributos de la tarjeta mientras edita; Chrome confirmó literalidad de `<b>`, `<i>`, tildes, newline y fórmula, cero nodos `b/i` de usuario, y Tab/Shift+Tab entre Nombre y Notas conservan foco.
- **Accesibilidad semántica.** La auditoría mostró H2 antes de H1. Se añadió H1 CineOptics, panel H2 y grupos H3. Chrome confirma el orden H1→H2→H2→H3 y nombres en controles visibles revisados. Escape cerró el menú y devolvió foco. Los únicos controles focusables ocultos son el file input oculto y el canvas 2D oculto por `hidden`; el canvas de respaldo tiene etiqueta y descripción.
- **Escape en panel.** Reproduje que en escritorio Escape ocultaba el inspector, pero CSS también ocultaba el único toggle: el panel quedaba sin recuperación visible y el foco no tenía destino. `workspace.css` deja visible el botón Panel con `aria-expanded=false`; Chrome confirmó que Escape lo enfoca y el botón reabre el inspector.
- **Órbita/Handheld.** Chrome actualizó el reloj con ambos modos; Órbita llegó a 3/3 s y renderizó al actor de perfil. Handheld avanzó de 0 a 0,70 s con la vista 3D visible. Sin errores de consola en estos recorridos.
- **Vistas, captura y restore.** Con seis actores revisé Cámara, Planta, Maqueta y Elevación. Desde Planta capturé con panel abierto y cerrado; ambas miniaturas cargaron a 1280×536. Cambié X del actor 6 de 6 a 7 m, cargué Plano 1 y volvió a 6 m con «Plano cargado». El chequeo no comparó píxeles entre paneles ni midió consistencia de otros movimientos.
- **Datos reales.** La UI descargó JSON portable, PowerShell lo parseó y comprobó formato v1, dos planos, IDs, miniaturas y nota multilínea exacta. El mismo archivo se abrió en la app local y reaparecieron los IDs/cards/miniaturas/nota; la UI indicó «Proyecto abierto» y después «Guardado». También creé seis actores y tres planos en Chrome, pero el archivo 6/3 no llegó a inspeccionarse/reimportarse; ese round-trip sigue cubierto por Vitest y pendiente de navegador.
- **Bundle.** El warning inicial de Vite >500 kB motivó carga asíncrona de `three-viewport`. El bundle de entrada bajó de 630,94 kB (164,52 gzip) a 76,80 kB (24,64 gzip). La importación dinámica solicita el chunk renderer durante la inicialización, así que no afirmo menos bytes totales de primera carga. La vista 3D se verificó tras HMR. El chunk Three aún pesa 555,62 kB (140,50 gzip); el warning sigue y no equivale a una medición de FPS.

### Validación repetida

`npm run typecheck` aprobado; `npm test -- --reporter=verbose` **45/45 en 9 archivos**; `npm run build` aprobado con 30 módulos; `git diff --check` aprobado. El build mantiene una advertencia por el chunk Three >500 kB.

La sonda de Chrome real reportó viewport 1280×720 CSS px, DPR 1,25 y sin overflow global; la versión exacta no está disponible. Para escala, 47 acciones de duplicar llevaron tres planos a 50 en 14.766 ms del bucle asistido por navegador; 50/50 miniaturas estaban decodificadas y no apareció overflow global. Ese tiempo incluye la automatización/puente y no se usa como latencia pura. Nuevo proyecto limpió el dataset y volvió a defaults, autosave terminó en «Guardado»; tras recarga explícita, IndexedDB recuperó un actor, cero planos, cámara estática y tiempo cero. Contrastes estáticos del tema comprobados entre pares texto/fondo relevantes: mínimo 6,20:1. No se ejecutaron los otros tamaños, zoom 200%, DPR 2, lector de pantalla, errores de cuota, perfil FPS/p95 o memoria de cinco minutos. La puerta amplia de aceptación sigue abierta; este registro no declara terminado el producto.
