# Handoff G — revisión de correcciones E/F

Fecha: 2026-10-13. Revisión posterior a la integración de E/F y las correcciones asignadas tras G-001–G-004.

## Dictamen

**G-001–G-004: corregidos en los archivos actuales y comprobados en pruebas automáticas y/o smoke de Chrome. Fase 3: abierta. Fase 4 y cierre de producto: no aprobados.** El subconjunto afectado pasó; siguen sin evidencia obligatoria varias vistas, tamaños, entradas, recuperación de fallos, round-trip completo y rendimiento.

No se encontró un nuevo fallo reproducible en los flujos limitados que se volvieron a ejecutar. Esto no convierte V01–V26 ni la matriz visual en aprobados.

## Base, propiedad y alcance

- Checkout compartido: `master`, HEAD `3f05106`; trabajo de integración permanece sin commit en el árbol compartido.
- Archivos de propiedad G actualizados: `docs/handoffs/G.md` y `tests/e2e/README.md`.
- No se editó implementación, configuración, dependencias ni lockfile; no se lanzaron agentes.
- Revisados: `AGENTS.md`, `README.md`, `PLAN_MEJORA.md`, el encargo G de `docs/PROMPTS_CHATS.md`, `docs/AUDITORIA.md`, `docs/ARQUITECTURA.md`, `docs/VALIDACION.md` y handoffs disponibles, en especial A y el registro anterior G.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Tests dirigidos | `npm test -- --reporter=verbose tests/core/optics-camera.test.ts tests/ui/workspace.test.ts tests/render/frame.test.ts tests/render/render-interaction.test.ts tests/state/reducer.test.ts tests/integration/phase-two.test.ts tests/project/save-queue.test.ts tests/project/project.test.ts` — **41 aprobados en 8 archivos**. |
| Tipos | `npm run typecheck` — aprobado. |
| Build | `npm run build` — aprobado; Vite 8.3.4 transformó 26 módulos. |
| Chrome real, app local | `http://127.0.0.1:5179/` cargó como “CineOptics Studio”. Se inspeccionó e interactuó con la UI en Chrome; esta revisión no obtuvo versión exacta, viewport controlado ni DPR. |
| G-001 | Con actor desplazado, panel Foco mostró foco axial 2,77 m y cinta 2,98 m. Confirma que las dos lecturas siguen el frame y se distinguen. El caso usa una única escena. |
| G-002 | X cambió con teclado a 1,25 m; drag en Planta movió el actor y actualizó X/Z en UI. La conversión real se verificó, sin DPR 2, tacto, cancelación ni drag lento. |
| G-003 | Push-in habilitó duración de 3 s y Reproducir; el contador avanzó y Pausar dejó el control en estado detenido. No se verificó evaluación equivalente en cada vista ni captura en un tiempo conocido. |
| G-004 | Nuevo proyecto volvió a defaults de cámara y actor y anunció “Proyecto nuevo creado; guardando…”. No se probó el diálogo de cambios no guardados. |
| Captura/restauración | Capturar produjo Plano 1 y miniatura en Planilla. Tras mover X a 0,60 m, Cargar plano lo devolvió a 0,00 m; la app mostró Guardado. Después de recargar, Plano 1 seguía presente en IndexedDB. Es una muestra de snapshot, no toda V16/V17. |
| Persistencia/cola | La recarga recuperó el proyecto y snapshot. Los tests dirigidos cubren cola serial, snapshot del mapa de assets y continuidad tras fallo; no se provocó cuota, storage bloqueado ni carrera en navegador. |
| Exportación UI | Exportar proyecto y Exportar planilla CSV mostraron “Proyecto exportado” y “CSV exportado”. El harness no capturó un evento de descarga ni permitió inspeccionar/volver a importar el archivo; round-trip real sigue pendiente. |
| Teclado limitado | Enter abrió el menú Proyecto; Escape lo cerró y devolvió el foco al resumen. No es auditoría Tab/Shift+Tab de todos los paneles ni de cursor en texto. |

### Entorno y rendimiento

Chrome en Windows sobre AMD Ryzen 5 3550H con Radeon Vega Mobile Graphics, 8 CPU lógicas y memoria reportada de 10,67 GB (identificación heredada del entorno de QA). La revisión usó la ventana de escritorio por defecto: no se fijaron ni registraron resolución exacta, DPR o versión de Chrome. Por ello no se presenta como ejecución en ninguna resolución del brief.

**Rendimiento no medido:** no hay FPS, p95 de frame, latencia de input, memoria, perfil de cinco minutos ni comparación con el legado. Las metas propuestas en `docs/VALIDACION.md` no se tratan como resultados.

## Hallazgos de la revisión previa

Estos son hallazgos corregidos, no fallos actuales abiertos:

- **G-001 · P1 · corregido.** La UI ahora deriva la distancia axial de `deriveFrame` y distingue distancia de cinta. Confirmación: prueba UI y lectura real 2,77 m axial / 2,98 m cinta para actor desplazado.
- **G-002 · P2 · corregido.** La entrada enlaza `bindGestures` y permite X/Y/Z numéricos. Confirmación: teclado y drag en Chrome. Cancelación, táctil y tamaños alternos quedan fuera del smoke.
- **G-003 · P2 · parcialmente corregido.** Push-in ofrece Play/pausa y contador funcionales. Rack focus no está implementado (confirmado en handoff A); órbita/handheld y sincronía de captura/restauración a instante común no se aceptan aquí.
- **G-004 · P2 · corregido.** Nuevo proyecto resetea defaults en UI y tiene prueba de unidad. El caso de cambios pendientes y su confirmación no se ejecutó.

No asigno prioridades nuevas por estas limitaciones: son puertas de aceptación sin evidencia suficiente, no defectos reproducidos. Ver el detalle V01–V26 en [tests/e2e/README.md](../../tests/e2e/README.md).

## Cobertura y límites que mantienen puertas abiertas

- Los 41 tests automáticos comprueban cálculos, reducer, UI derivada, render/scheduler, integración y repositorio/cola dentro de los ocho archivos enumerados. No equivalen a aceptación de navegador para los escenarios que usan doubles.
- No se recorrieron 1920×1080, 1440×900, 1280×720, 1024×768, 768×1024, 390×844, zoom 200% ni DPR 2. Tampoco los estados de 1/2/6 actores, revisión visual de Cámara/Planta/Foco/Planilla, contraste, overflow o accesibilidad completa.
- No se verificaron todos los controles sincronizados tras cargar, foco/cursor con texto adversarial, orbit/handheld, rack, captura en Planta con panel abierto/cerrado, exportación round-trip/importación, lector de CSV, cuota/errores reales, carreras de guardado ni URLs/miniaturas bajo exportaciones consecutivas.
- No existe runner E2E de navegador configurado en `package.json`.

## Dictamen por puerta de aceptación

| Puerta | Dictamen G |
|---|---|
| Fase 2.5 técnica | Aprobada por integración según A; este pase volvió a aprobar tests dirigidos, tipos y build. El smoke de recarga comprueba un proyecto y snapshot, no errores de storage/assets. |
| Fase 3 E/F | **Abierta.** Correcciones G-001, G-002 y G-004 verificadas; G-003 solo en Push-in básico. La aceptación obligatoria V12–V20 y flujo de captura/reproducción completo no tiene cobertura suficiente. |
| Fase 4 / producto | **No aprobada.** Falta matriz visual/responsive, teclado/accesibilidad completa, rendimiento medido y pruebas completas de exportación/recuperación. No declarar cierre de producto. |

## Siguiente verificación

Tras correcciones adicionales de A, repetir únicamente los casos afectados y sus riesgos: la suite dirigida; navegación/captura/snapshots si cambia E/F; y exportación/recuperación si cambia D o la cola. Mantener abiertas las puertas hasta aportar evidencia para la matriz restante de `docs/VALIDACION.md`.

## Adenda posterior de integración A · 2026-10-13

A volvió a probar los casos afectados y corrigió dos problemas reproducibles de UI: la edición de nombre reemplazaba su tarjeta y perdía el foco, y la estructura de headings ponía H2 antes de H1. Se preserva el foco con actualización in-place de la tarjeta y ahora el orden es H1 CineOptics → H2 de sección → H3 de grupo. A también hizo `three-viewport` un import asíncrono: shell inicial 76,80 kB/24,64 kB gzip, renderer 555,62 kB/140,51 kB gzip; persiste el warning >500 kB.

Smoke de Chrome 1280×720: Órbita llegó a 3 s y cambió el ángulo; Handheld reprodujo a 0,70 s; exportación JSON real se reabrió con selector local y conservó dos planos/miniaturas/nota multilínea; edición literal no creó nodos HTML y mantuvo Tab/Shift+Tab; Escape devolvió foco al botón de menú. Cero errores de consola en estos recorridos. Revisados los nombres, canvas de respaldo, headings y overflow global. Contrastes estáticos revisados con mínimo 6,20:1 en los pares comprobados.

Rack focus se aplaza explícitamente como P2: requiere curvas/tiempos/interpolación y formato portable/snapshot; no es gate de los modos ya ofrecidos. Tests/types/build finales: 45/45 tests en 9 archivos, typecheck y build pasan. La fase de aceptación sigue abierta por falta de viewport/responsive completo, DPR 2, lector de pantalla, round-trip de 6/3 en navegador, fallos reales de storage, captura/replay multi-vista y mediciones runtime. No se declara cierre de producto.

### Reprueba de acceso y captura · 2026-10-13

La ventana de Chrome reportó 1280×720 CSS px y DPR 1,25; la versión exacta del navegador no estuvo disponible.

- Un segundo fallo de teclado se reprodujo en la ventana 1280×720: Escape ocultaba el inspector aunque el botón «Panel» seguía con `display:none` en escritorio, por lo que quedaba inaccesible para reabrir. A lo corrigió con `.co-panel-toggle[aria-expanded=false]`; Chrome confirmó que el botón aparece, recibe foco y reabre el panel.
- Con seis actores se inspeccionaron Cámara, Planta, Maqueta y Elevación. Capturar desde Planta con el inspector abierto/cerrado generó dos miniaturas 1280×536 cargadas. Cambiar X del actor 6 a 7 m y cargar Plano 1 lo devolvió a 6 m. La vista camera/Planta multi-actores no se compara por píxeles ni cubre DPR alterno.
- Una lista de 50 planos cargó las 50 miniaturas sin overflow horizontal del documento; 47 duplicaciones tomaron 14.766 ms en el ciclo CUA/Playwright (incluye overhead de automatización, no es frame time). Nuevo proyecto limpió datos y persistió defaults.
- Tras estos cambios, 45/45 tests, typecheck, build y `git diff --check` pasaron. El chunk Three 555,62 kB minificados conserva advertencia. Sin mediciones FPS/p95/memoria; límites previos y puerta global abierta se mantienen.
