# Registro E2E de aceptación — G

Fecha de revisión: 2026-10-13. Integración E/F en checkout compartido `3f05106`. Este registro distingue los tests Vitest de las interacciones observadas en Chrome. `package.json` no configura un runner E2E; la ejecución de UI fue un smoke manual asistido por navegador.

## Resultado por escenario V01–V26

| Escenario | Evidencia disponible | Estado de aceptación |
|---|---|---|
| V01 | Tests de core prueban FOV matemático. | Parcial: tolerancia de cálculo cubierta; layout visual no. |
| V02 | Tests de core prueban gate recortado. | Parcial: UI y render visual real no revisados. |
| V03 | Tests de render/proyección, sin dos tamaños E2E. | Pendiente: independencia visual del layout. |
| V04 | Tests de core prueban órbita. Chrome: Órbita reprodujo hasta 3 s y mostró al actor en perfil. | Parcial: smoke visual básico aprobado; faltan objetivos/ángulos variados y sincronía con las demás vistas/captura. |
| V05 | Tests de óptica/UI; Chrome mostró 2,77 m axial y 2,98 m de cinta con actor desplazado. | Parcial: caso real confirma lectura; faltan alturas, pitch, posiciones y foco pose-aware variados. |
| V06 | Tests de DoF y fixture en `tests/core/optics-camera.test.ts`. | Parcial: comparar el rango completo con derivación independiente documentada. |
| V07 | Tests para límites/entradas extremos. | Parcial: cálculo; warnings/errores visibles de todos los extremos no comprobados. |
| V08 | Tests de dolly zoom y límites. | Parcial: falta vuelta visual en Chrome y aviso al alcanzar límites. |
| V09 | Tests de presets. | Parcial: selector, pose y two-shot no inspeccionados en navegador. |
| V10 | Reducer/integración prueban eliminación y referencias. | Parcial: eliminación real de actor enfocando; rack focus no existe, así que ese extremo no está cubierto. |
| V11 | Tests de reset/nuevo proyecto; Chrome Nuevo proyecto recuperó defaults. | Parcial: no se probó mantener escena/planilla al reset ni diálogo ante cambios pendientes. |
| V12 | Modelo UI derivado de frame; valor axial/cinta revisado en Chrome. Captura y carga del Plano 1 restauraron X=0,60 m a 0,00 m. | Parcial: faltó cambiar todos los controles y comparar cada representación después de cargar. |
| V13 | Tests sintéticos de picking con roll y viewport CSS. | Pendiente E2E: actores superpuestos, borde del frame y DPR 1/2. |
| V14 | `bindGestures` enlazado; drag en Planta funcionó en Chrome. | Parcial: no se verificaron deltas lentos, salida de canvas, cancelación, lápiz o tacto. |
| V15 | Tests de interacción; teclado cambió X; drag real actualizó X/Z y campos. | Parcial: no se comprobó concordancia en todas las vistas ni deshacer. |
| V16 | Tests de frame/reducer/scheduler; Push-in, Órbita y Handheld reprodujeron en Chrome. Órbita llegó a 3 s/cambio de ángulo; Handheld alcanzó 0,70 s. | Parcial: faltan otras vistas al mismo instante, captura a tiempo elegido y replay. Rack focus se aplaza por decisión de alcance documentada en `docs/VALIDACION.md`. |
| V17 | `captureFrame` probado con Canvas/Blob simulados; Chrome capturó desde Planta con panel abierto y cerrado, ambas miniaturas 1280×536 cargaron, y cargar Plano 1 restauró X=7 a X=6 m. | Parcial: dos estados de panel y restore real aprobados; equivalencia visual píxel a píxel/ausencia HUD y captura a tiempo móvil siguen pendientes. |
| V18 | Tests simulados de ND, grano y obturación. | Pendiente visual: efecto real, reproducibilidad y dato de obturación no inspeccionados. |
| V19 | Tests de gate/focal/apertura/squeeze. | Parcial: falta inspección visual con la UI y silueta de actor. |
| V20 | Chrome: `<b>Texto</b> á`, nota `<i>literal</i>`, salto, `=SUM(1,2)`, Tab/Shift+Tab y cero nodos b/i inyectados; foco se conserva tras el cambio de nombre. | Parcial: caso literal y foco básico aprobado; cursor/selección avanzada y límites de longitud pendientes. |
| V21 | Round-trip portable en tests; Chrome exportó JSON real, se parseó y se reabrió con dos planos, IDs, miniaturas y nota multilínea exacta. Chrome también creó seis actores y tres planos. | Parcial: smoke de dos planos aprobado; el archivo 6/3 no se inspeccionó/reimportó en navegador. |
| V22 | Tests de cola serial, copia de assets y recuperación de fallo; Chrome recargó y conservó proyecto/actor/Plano 1. Tras limpiar la prueba de escala, recarga explícita devolvió defaults y status Guardado. | Parcial: no se simuló cuota, cierre antes de confirmar ni carrera manual/autosave en navegador; miniatura presente, su Blob no cotejado. |
| V23 | Validadores y errores simulados en tests. | Pendiente E2E: cuota, storage bloqueado, JSON corrupto/versión futura y conservación/exportación de sesión previa. |
| V24 | Serializer/parser y neutralización CSV en tests; Chrome anunció “CSV exportado”. | Parcial: el harness no capturó el archivo; no se abrió con lector/app independiente. |
| V25 | Tests de captura, snapshots, IDs CRUD y referencias. | Parcial: un plano se capturó/cargó en Chrome; duplicar/borrar, independencia de otro plano y liberar assets no se verificaron aquí. |
| V26 | Tests del límite de Blob, URL lease y liberación. | Parcial: UI anunció las exportaciones; no se capturó descarga, URL ni miniaturas repetidas en navegador. |

La ejecución dirigida de esta revisión fue **41/41 tests en 8 archivos**: core optics/camera, UI workspace, frame, render interaction, reducer, phase-two integration, save queue y project. También pasaron `npm run typecheck` y `npm run build` (Vite 8.3.4, 26 módulos). Estos resultados no elevan por sí solos estados E2E a aceptados.

## Chrome, evidencia y límites de entorno

La entrada `http://127.0.0.1:5179/` abrió “CineOptics Studio” en Chrome. Se revisó una escena default y una escena con actor desplazado. Interacciones observadas: entrada X por teclado, drag en Planta, foco axial/cinta, Push-in Play/Pausa, Nuevo proyecto, captura, edición y carga de snapshot, recarga desde IndexedDB, y avisos UI de exportación proyecto/CSV.

El navegador era la familia Chrome sobre Windows. No se obtuvo su versión exacta ni se fijaron/rescataron viewport y DPR; no atribuir este smoke a ninguna resolución concreta del brief. Equipo reportado: AMD Ryzen 5 3550H con Radeon Vega Mobile Graphics, 8 CPU lógicas, memoria 10,67 GB. No se guardaron capturas de evidencia en este repositorio.

No ejecutado: 1920×1080, 1440×900, 1280×720, 1024×768, 768×1024 y 390×844; zoom 200%; DPR 2; las capturas visuales comparativas de Cámara/Planta/Foco/Planilla con 1/2/6 actores; recorrido completo Tab/Shift+Tab, Escape y retorno de foco; contraste manual; E2E completa de V12–V20; exportación/importación de archivos; errores reales de IndexedDB; perfil de memoria y rendimiento.

Las dos exportaciones mostraron éxito en el estado de la UI. `waitForEvent("download")` del harness agotó tiempo en las pruebas de exportación; por tanto el archivo descargado, su contenido y el round-trip no se verificaron. Esto queda como limitación de evidencia, no como fallo demostrado de la aplicación.

## Rendimiento

**Sin medición.** No se registraron resolución, DPR ni versión de Chrome exactos, ni escena de seis actores/50 planos para este fin. No hay FPS, p95 de frame, latencia de input, memoria, perfil de cinco minutos ni comparación con el HTML legado. Las metas de `docs/VALIDACION.md` siguen siendo propuestas, no resultados.

## Reanudación y dictamen

G-001, G-002 y G-004 quedaron corregidos y comprobados en los flujos limitados. G-003 está corregido para reproducción básica de Push-in; rack focus y cobertura de modos/sincronía permanecen pendientes. Fase 3 sigue abierta y fase 4 no aprobada. Consultar [handoff G](../../docs/handoffs/G.md) para el dictamen por puerta.

Para completar aceptación: repetir escenarios afectados por cambios de A, instrumentar descargas de V21/V24/V26 y recorrer lo pendiente de `docs/VALIDACION.md` con navegador/viewport/DPR documentados. Añadir evidencia visual y mediciones antes de marcar escenarios aprobados.

## Actualización de evidencia A · 2026-10-13

Se repitieron Órbita y Handheld en Chrome real (1280×720 CSS px): Órbita finalizó en 3 s con cambio de ángulo; Handheld avanzó a 0,70 s. La exportación de proyecto sí produjo un JSON descargado: se parseó, se abrió de nuevo en la app y repuso dos planos, miniaturas y una nota multilínea literal. Esta ronda pasa un smoke de dos planos; el round-trip de seis actores/tres planos sigue siendo solo Vitest.

V20 fue repetido tras corregir un fallo de foco: actualizar el nombre de un plano desmontaba la tarjeta y llevaba el foco al body. Ahora la tarjeta actualiza texto/aria-labels in-place mientras edita; `<b>Texto</b> á`, `<i>literal</i>`, newline y `=SUM(1,2)` permanecen literales; Tab pasa de Nombre a Notas y Shift+Tab regresa, sin generar nodos b/i. Se detectó y corrigió otro fallo: Escape ocultaba el inspector en escritorio aunque el toggle quedaba en `display:none`; el toggle ahora se ve con panel cerrado, recibe foco y permite reabrirlo.

Chequeo accesible focalizado: H1 CineOptics precede H2; no quedaron controles visibles sin nombre; Escape cierra el menú y devuelve foco; canvas 2D alternativo etiquetado y panel/canvas ocultos no entran al orden Tab; documento no desborda en viewport 1280×720 CSS px, DPR 1,25. Contraste estático en pares de paleta comprobados: mínimo 6,20:1. Otros viewports, zoom 200%, DPR 2 y lector de pantalla pendientes.

Rendimiento: 47 duplicaciones llevaron la planilla de tres a 50 planos en 14.766 ms de automatización asistida; las 50 miniaturas cargaron y no hubo overflow global a 1280×720. Ese tiempo incluye el puente de navegador y no mide latencia pura de render. El import dinámico reduce el bundle de entrada de 630,94 kB a 76,80 kB (gzip 24,64 kB); el chunk Three de 555,62 kB (gzip 140,50 kB) se solicita durante inicialización y aún excede el aviso de 500 kB. Esto no demuestra menos bytes totales de primera carga. Test scheduler pasa su coalescing/visibility contract; el navegador dibuja y reproduce, pero no se midieron FPS/p95, input latency, memoria ni perfil de cinco minutos.

Con seis actores se inspeccionaron Cámara, Planta, Maqueta y Elevación; las cuatro vistas cargaron. También se crearon seis actores/tres planos en la app, pero el archivo grande no se inspeccionó/reimportó. Nuevo proyecto limpió todo el dataset de QA y terminó en Guardado.

La suite final es 45/45 en 9 archivos; `npm run typecheck`, `npm run build` y `git diff --check` pasaron tras las correcciones, con aviso del chunk `three-viewport` de 555,62 kB (140,50 kB gzip). Rack focus se aplaza como P2 por falta de modelo temporal y formato portable/snapshot propio. Fase 3/4 global permanece abierta hasta completar matriz visual, responsive, errores reales de IndexedDB, round-trip grande en browser y mediciones de FPS/p95/runtime.
