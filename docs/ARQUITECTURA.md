# Arquitectura propuesta y contratos

Estado: **integración E/F y correcciones G-001–G-004 implementadas**. Tipos, tests y build pasan. Chrome verificó un recorrido smoke de gesto, posición, reproducción, nuevo proyecto, guardado manual, autosave y recuperación IndexedDB; la matriz visual completa, DPR/accesibilidad/rendimiento y captura de snapshots siguen pendientes. Ver [validación](VALIDACION.md) y [handoff A](handoffs/A.md).

## Stack y estrategia

TypeScript + módulos ES + Vite, UI con DOM/CSS y renderer Canvas 2D inicialmente. Mantener el proyecto estático, sin backend. No hace falta adoptar React para separar esta base; los tipos y funciones puras aportan más valor inmediato al trabajo paralelo.

Vite 8.3.4, TypeScript 7.0.2 y Vitest 5.0.4 están fijados en `package-lock.json`. [Guía oficial de Vite](https://vite.dev/guide/). Pruebas de navegador para comportamiento visual e interacción siguen pendientes. No instalar varios runners equivalentes.

Separar primero sin destruir el original. Un módulo `legacy/` puede servir de adaptador temporal, pero los nuevos componentes no deben depender de variables globales del HTML. La fase 1 debe dejar interfaces operativas, aunque detrás todavía haya aproximaciones conocidas.

## Árbol objetivo y propiedad

```text
index.html                         A: entrada nueva
cine_shot_visualizer_3d_pro.html     Referencia preservada
src/
  main.ts                          A: composición e integración
  contracts/                       A: tipos y APIs compartidos
  state/                           A: defaults, acciones, store e invariantes
  data/                            A: sensores, presets, restricciones
  core/                            B: matemáticas, óptica, gate, cámara, presets
  render/                          A adaptador Canvas; E: fidelidad, scheduler
  interaction/                     E integrado: picking y gestos Pointer Events
  ui/                              C/F integrados; flujos conectados a A
  styles/                          C, después F: tokens, layout y componentes
  project/                         D integrado: snapshots, portable, validación, almacenamiento
  shotlist/                        D integrado: operaciones sobre catálogo y CSV
  legacy/                          A: puente temporal acotado
tests/
  fixtures/                        A: escenarios comunes versionados
  core/                            B
  project/                         D
  render/                          E
  ui/                              C, después F
  e2e/                             G
docs/handoffs/                      Cada rol escribe solo <ROL>.md
```

Solo A modifica `package.json`, lockfile, configuración, `index.html`, `main.ts`, contratos, estado central y documentación global. Si otro módulo necesita una acción, A la integra; el trabajador especifica firma y comportamiento en su entrega. Durante fase 2 A no reorganiza carpetas bajo los trabajadores.

## Estado: tres ámbitos distintos

**ProjectDocument**, serializable y versionado:

- `schemaVersion`, ID, nombre y fechas.
- Escena: actores por ID estable, posición en metros, altura, orientación, pose y color; locación y fondo.
- Cámara: pose base, modo de navegación (orientación/orbita), objetivo, focal en mm, sensor/gate, aspecto de salida, squeeze, `fNumber`, foco y movimiento.
- Look: ajustes visuales aproximados. Obturación con FPS y ángulo como metadatos explícitos; no inferir motion blur implementado.
- Planos: IDs ordenados; cada plano referencia un snapshot independiente y una miniatura por ID, con nombre/notas.

**UIState**, separado: panel, vista activa, actor/plano seleccionado, herramientas de arrastre, guías, radar abierto y preferencias de presentación. La selección puede recuperarse como conveniencia, pero no cambia el contenido físico de un snapshot.

**RuntimeState**, no serializable: tiempo de reproducción, punteros, tamaños de canvas, caches, invalidaciones, object URLs, instancias de render y suscripciones.

El render no modifica ninguno de los documentos. Una acción produce un nuevo estado validado y notifica a suscriptores. Deshacer/rehacer usa acciones de usuario agrupadas: un drag es una operación; los frames de animación no son historial.

## Convenciones que A debe congelar antes del paralelo

1. Mundo: X derecha, Y arriba, Z hacia el fondo en la escena inicial; metros. Cámara inicial mirando +Z. Suelo Y=0.
2. Focal, gate y CoC en mm. Ángulos de controles en grados; funciones trigonométricas convierten explícitamente.
3. Cámara guarda posición/orientación u órbita con objetivo de forma inequívoca. No reutilizar un yaw simultáneamente para paneo y órbita sin modo explícito.
4. Un punto de foco por actor, dependiente de pose/altura. Diferenciar distancia espacial de cinta y profundidad axial del plano de foco. El desenfoque usa la convención óptica documentada.
5. `sensorGateMm` representa área activa del modo de grabación. `outputAspect` deriva el recorte de salida con una política fija, por ejemplo recorte centrado máximo inscrito después de desqueeze. Cambiar tamaño del panel no cambia el gate.
6. UI presenta f-number para DoF. `tStop` opcional solo si hay información de transmisión; no convertir T a f suponiendo igualdad sin avisar.
7. Valores infinitos no se serializan como números JSON: representar foco al infinito como variante explícita; resultados derivados pueden usar `Infinity` internamente y formatear `∞`.
8. Defaults y límites son únicos. Selección por ID; referencias ausentes se reparan de forma determinista, con un mensaje comprensible.

## Interfaces mínimas

Firmas vigentes, compilables y compartidas. Los tipos exactos están en `src/contracts`; los módulos E/F pueden usar estas APIs sin redefinirlas.

```ts
evaluateCamera(project, timeSeconds, parameters?): CameraEvaluation
deriveEffectiveGate({ sensorGateMm, outputAspect, squeeze }): FrameGate
fieldOfView(gate, focalLengthMm, squeeze?): FieldOfView
depthOfField(input): DepthOfField
resolveFocus(project, evaluatedCamera): FocusResult
projectPoint(worldPointM, evaluatedCamera, gate, viewport, squeeze?): ProjectedPoint | null
deriveFrame(project, timeSeconds, activeView): FrameModel

// FrameModel: cámara evaluada, gate, métricas, actores, tiempo y avisos.
// No contiene DOM ni escribe en el proyecto.
renderView(context, frame, viewOptions): void
GestureApi.hitTest({ xCssPx, yCssPx }, frame, viewportCssPx?): EntityId | null
GestureApi.bindGestures(canvas, readFrame, dispatch): Unsubscribe
captureFrame(frame, exportOptions): Promise<Blob>

store.getState(): AppState
store.dispatch(action): void
store.subscribe(listener): Unsubscribe

createShotSnapshot(project, evaluatedCamera, captureTime): ShotSnapshot
restoreShotSnapshot(project, snapshot): ProjectDocument
validateProject(unknownInput): ValidationResult
serializeProject(project, assets): ExportDocument
deserializeProject(input): ImportResult
projectRepository.saveWithAssets(project, assets?): Promise<{ savedAt: string }>
projectRepository.loadWithAssets(id): Promise<{ project, assets, recovered } | null>
captureShot(project, { camera, capturedAtS, thumbnail? }): CaptureResult
restoreShot(project, shotId): ProjectDocument
serializePortableProject(project, assets?): Promise<Blob>
deserializePortableProject(input): Promise<{ project, assets }>
exportShotCsv(project): Blob
```

`deriveFrame(project, timeSeconds, activeView)` produce la cámara evaluada, gate efectivo, FOV, DoF, foco, actores, look y avisos. Las cuatro vistas reciben el mismo modelo de ese instante. `canvasRenderer.captureFrame(frame, options)` fuerza la vista de cámara y no incorpora guías por defecto. `GestureApi.hitTest(point, frame, viewportCssPx?)` y `bindGestures(canvas, readFrame, dispatch)` están conectadas en la entrada; medidas de viewport y puntos usan CSS px, independiente del DPR. El renderer vigente es esquemático, no una proyección 3D completa ni migración fiel del legado.

### Firmas TypeScript integradas en fase 3

- `createDefaultProject(now?: string): ProjectDocument`
- `createInitialState(project?: ProjectDocument): AppState`
- `entityId(seed?: string): EntityId`
- `reduceAppState(state: AppState, action: AppAction): AppState`
- `createStore(initialState: AppState): Store`; `Store.getState(): AppState`, `dispatch(action: AppAction): void`, `subscribe(listener: (state: AppState) => void): Unsubscribe`
- `evaluateCamera(project: ProjectDocument, timeSeconds: number, parameters?: MotionParameters): CameraEvaluation`; el resultado contiene `{ camera: EvaluatedCamera; warning?: string }`
- `deriveFrameGate(project: ProjectDocument): FrameGate`
- `deriveFrame(project: ProjectDocument, timeSeconds: number, activeView: ViewId): FrameModel`
- `RenderApi.renderView(context: CanvasRenderingContext2D, frame: FrameModel, options: RenderViewOptions): void`
- `RenderApi.captureFrame(frame: FrameModel, options: CaptureOptions): Promise<Blob>`
- `GestureApi.hitTest(point: CssPoint, frame: FrameModel, viewportCssPx?: CssViewport): EntityId | null`
- `GestureApi.bindGestures(canvas: HTMLCanvasElement, readFrame: () => FrameModel, dispatch: (action: AppAction) => void): Unsubscribe`
- `RenderScheduler.invalidate(): void`; `setAnimating(active: boolean): void`; `dispose(): void`; el callback de frame recibe `timestampMs`
- `ProjectRepository.saveWithAssets(project: ProjectDocument, assets?: ReadonlyMap<EntityId, Blob>): Promise<{ savedAt: string}>`; `loadWithAssets(id): Promise<{project,assets,recovered}|null>`
- `createProjectSaveQueue(repository)(project, assets): Promise<{ savedAt: string }>` serializa autosave y guardado manual
- Acciones runtime: `runtime/tick`, `runtime/playbackChanged`; acción de cámara: `camera/motionChanged`

`canvasRenderer` implementa render y Blob de captura esquemáticos. `projectRepository` usa IndexedDB con copia recuperable y assets atómicos. La entrada conecta gestos, scheduler por invalidación, reproducción, captura, snapshots y una cola común de guardado manual/autosave. Chrome confirmó que la entrada local carga, que el drag en Planta cambia X/Z, que el playback avanza, que Nuevo proyecto vuelve a defaults y que el guardado local sobrevive a recarga. Captura de snapshot/restauración IndexedDB y QA visual extensa siguen pendientes.

Los módulos B/C/D están integrados y E/F están conectados a estos contratos. El trabajo posterior debe conservar estas firmas y ampliar pruebas de aceptación sin redefinirlas. Los fixtures no sustituyen validación visual en navegador.

## Render y captura

- Scheduler solicita frame por cambio de estado, resize o animación activa. Escena estática sin invalidaciones no repinta indefinidamente.
- `ResizeObserver` actualiza tamaños; convertir DPI solo en el borde del renderer. Suspender trabajo cuando la pestaña esté oculta.
- Calcular una vez cámara y óptica por instante; reutilizar en visor, planta, maqueta, elevación y HUD.
- Canvas de captura independiente con proporción/resolución de salida declaradas. La captura no depende de que el usuario esté mirando una planta.
- Captura limpia sin guías por defecto; opción técnica explícita. Guardar snapshot y miniatura del mismo frame.
- Assets de miniatura como Blob; no clonar imágenes ni planilla completa en cada snapshot.
- Separar apariencia geométrica de efectos artísticos. El renderer 2D no simula sombras/oclusión de una escena 3D arbitraria.

## Persistencia e integridad

Repositorio local con IndexedDB para proyecto y miniaturas, operación atómica o manifiesto que solo confirme guardado cuando estén todas las partes. Mantener último guardado válido y estado «Guardando / Guardado / Error». No depender solo de `beforeunload`.

Autoguardado tras cambios con agrupación temporal y guardado explícito. Exportar proyecto versionado portable, con assets o una política explícita de miniaturas regenerables. Importar valida tamaño, versión, rangos, IDs, enums y referencias antes de reemplazar la sesión; un archivo inválido conserva el proyecto abierto. Rechazar versiones futuras no soportadas con mensaje claro. Manejar falta de cuota y almacenamiento no disponible.

El CSV incluye columnas técnicas con unidades y texto escapado. Al agregar notas/nombres libres, neutralizar prefijos interpretables como fórmulas por planillas. No modificar el texto original guardado para corregir la representación de exportación.

## Entrega entre chats

Cada `docs/handoffs/<ROL>.md` contiene: estado de puerta de aceptación, archivos propios, contratos usados, cambios propuestos a archivos compartidos, comandos realmente ejecutados, casos aprobados/fallidos y limitaciones. Incluir commit base y commits entregados si hay Git. No decir «todo listo» si existe un fallo que afecta al siguiente rol.
