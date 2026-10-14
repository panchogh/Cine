# Handoff E — render e interacción

## Estado de entrega

La integración 2.5 de fase 2 está **aprobada técnicamente** en el handoff A actualizado: B/D están conectados al frame y C a la entrada; typecheck, 24 tests y build aprobaron allí. Implementé los módulos de render e interacción de E sobre esos contratos. **La puerta visual de E sigue abierta**: no pude abrir la app en un navegador conectado y `main.ts` todavía no enlaza `GestureApi` ni el scheduler. No afirmo validación visual real ni cierre de fase 3.

Base visible al comenzar: `3f05106`. No se creó commit ni worktree; el trabajo está en el checkout compartido. No edité `src/ui/`, `src/core/`, contratos ni configuración.

## Archivos E

- `src/render/canvas-renderer.ts`: cámara y gate evaluados comunes; proyección de prismas de actor; frustum derivado del FOV/gate en Planta, Maqueta y Elevación; captura limpia; ND/grano aproximados.
- `src/render/actor-geometry.ts`: volumen de actor por pose/yaw, proyección por vista, recorte de siluetas al gate y geometría compartida por dibujo/picking.
- `src/render/frame.ts`: conserva el frame integrado de B y adjunta un payload local de `look` para el renderer.
- `src/render/scheduler.ts`: invalidación coalescida y loop únicamente durante animación, pausado ante pestaña oculta.
- `src/interaction/gestures.ts`: `GestureApi`, hit test de pantalla y mapas, selección, drag de Planta por Pointer Events y transformación inversa CSS px→metros.
- `tests/render/render-interaction.test.ts`: aceptación automatizada de E.

## Comportamiento

- Las cuatro vistas consumen la misma `FrameModel`: posición/orientación evaluadas, gate, squeeze, métricas y tiempo. Planta proyecta rayos del gate sobre la escena; Maqueta muestra el frustum en una proyección isométrica; Elevación identifica sus ejes y enseña una sección/proyección vertical.
- El actor es un prisma esquemático definido en metros con pose y yaw. Cámara, mapas y picking derivan sus polígonos del mismo volumen. La proyección de cámara aplica roll, gate y squeeze; actores fuera del gate se recortan antes de poder seleccionarse. Solapamientos eligen el actor superior en el orden de dibujo.
- El picking y drag usan `getBoundingClientRect()` y CSS px, no el backing store DPR. Planta usa Pointer Events, captura del puntero, umbral acumulado de 3 CSS px, una sola acción `scene/actorMoved` al soltar, cancelación sin commit y límites de escena `LIMITS.sceneCoordinateM`. No muestra preview del actor durante el drag.
- `captureFrame` fuerza `activeView: 'camera'`, usa la resolución solicitada, omite HUD, borde y guías por defecto, y conserva ND/grano. `includeGuides: true` permite una captura técnica. La ruta actual de `main.ts` obtiene un único frame cámara, renderiza su Blob y pasa la cámara/tiempo evaluados a `captureShot`; el test confirma que snapshot y miniatura reciben la misma pose, tiempo y Blob.
- ND aplica un velo negro de intensidad relativa `1 − 2^(−stops)` como aproximación visual, no como cálculo de color/exposición lineal. El grano usa una textura repetible determinista por tiempo y nivel; su patrón se cachea por contexto. La obturación aparece identificada como metadato “sin blur”; no se implementó motion blur.
- El scheduler combina 100 invalidaciones estáticas en una sola solicitud de frame; durante animación mantiene como máximo una solicitud pendiente y se pausa al ocultar la pestaña. El orden de profundidad calcula una base de cámara por dibujo, y no recalcula trigonometría en cada comparación de orden.

## Pruebas y mediciones

`npm test` — **36/36 tests aprobados** en 7 archivos; `tests/render/` — **10/10**. Casos E añadidos:

- V13: roll de cámara, bandas fuera del frame, solapamiento y coordenadas de picking expresadas en CSS px (el DPR no entra al cálculo).
- V14/V15: drag táctil simulado, deltas pequeños acumulados, selección, una acción al soltar, cancelación y conversión X/Z.
- V16/V17: cuatro vistas fuerzan captura de cámara; snapshot y miniatura del test conservan el mismo instante; la captura predeterminada omite HUD/borde/guías.
- V18: ND de 3 pasos usa alfa relativo 0,875; grano `soft-light` es reproducible con el mismo tiempo; texto de visor declara la obturación como metadato sin blur.
- V19: focal, gate, squeeze y f-number cambian proyección/FOV/DoF conforme a sus entradas; f-number no escala la geometría de actores.
- Scheduler: 100 invalidaciones → 1 render pendiente; una animación mantiene un callback pendiente, se detiene al ocultarse y deja de continuar al pausarse.

`npm run typecheck` y `npm run build` aprobados; Vite 8.3.4 transformó 23 módulos. `git diff --check` aprobó; mostró solo advertencias CRLF de archivos compartidos ya modificados fuera de E.

La medición de A23 aquí es de solicitudes/renderes del scheduler con RAF simulado, no de milisegundos de Canvas ni FPS. No se obtuvo p95 ni comparación con el legado.

## Comprobación visual

`npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` arrancó e informó Vite `ready`. Intenté abrir `127.0.0.1:5173` y `localhost:5173` en el navegador integrado y `127.0.0.1:5173` en Chrome; los tres intentos terminaron en `ERR_CONNECTION_TIMED_OUT`. No hay capturas auténticas de navegador para adjuntar. Los tests usan Canvas/EventTarget simulados y **no sustituyen** revisión visual, interacción real, DPR 1/2, teclado ni tacto.

## Contratos y conexión pendientes para A/F

1. `FrameModel` compartido no declara `look`. E lo adjunta en runtime desde `deriveFrame`, y el renderer lo lee como extensión local. A debe formalizar `look: Pick<ProjectDocument['look'], 'ndStops' | 'grainPercent' | 'shutterAngleDeg' | 'frameRate'>` en el contrato.
2. `GestureApi.hitTest(point, frame)` no incluye el tamaño CSS del viewport. La implementación añade un tercer argumento opcional para uso directo y `bindGestures` sí usa el rectángulo real. A debe fijar `hitTest(point, frame, viewportCssPx: { widthPx: number; heightPx: number })` o pasar el viewport en otro dato estable del frame.
3. La composición actual de `main.ts` no llama `bindGestures`. A debe enlazarlo al canvas y al store (y disponer listeners al desmontar); esta integración no se hizo porque `main.ts` es propiedad del integrador. F debe mantener el mismo canvas estable durante render para conservar captura de puntero.
4. `main.ts` redibuja por cambios de estado y resize, sin loop estático. El scheduler E está probado pero todavía no se consume desde composición. A/F deben enviar invalidaciones del store/resize y `setAnimating(runtime.isPlaying)` para alimentar ticks con el mismo instante.

## Límites

- El renderer sigue siendo Canvas 2D esquemático: prismas de actor, sin oclusión de escena arbitraria, sombras, modelos anatómicos o lente calibrada. Elevación es una sección YZ; Maqueta es proyección isométrica, no 3D real.
- El arrastre confirma al soltar pero no anima una previsualización y no existe undo en los contratos actuales. Un cambio numérico puede seguir llegando desde UI/F por la acción `scene/actorMoved`.
- ND mezcla un velo en espacio sRGB y el grano usa `soft-light`; ambos son efectos aproximados. No se representa bokeh/DoF ni motion blur.
- La dimensión del actor es una aproximación visual explícita (ancho/profundidad proporcionales a altura); conserva la orientación y el squeeze en proyección, no pretende medir anatomía.
- Faltan integración real de gestos/scheduler en `main.ts`, validación de navegador y mediciones de rendimiento en dispositivo. El cierre de E requiere esas acciones más la revisión visual de V13–V19.
