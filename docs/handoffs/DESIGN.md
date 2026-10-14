# Handoff DESIGN — CineOptics

**Fecha:** 2026-10-13  
**Alcance:** integración por hitos D0–D5 de `desing.md`. Esta entrega mantiene el HTML legado sin cambios.

## Estado por hito

| Hito | Estado | Resultado y puerta pendiente |
|---|---|---|
| D0 — Baseline | Hecho | Leídos `AGENTS.md`, `README.md`, `desing.md`, handoffs A/G y contratos/auditoría/validación. El árbol ya contenía cambios de otros roles, incluidos E/F/G; se conservaron. El HTML original sigue presente y sin diff. |
| D1 — Interfaz | Implementado; QA parcial | Shell de editor, herramientas compactas, visor protagonista, navegación de vistas, árbol de actores/inspector contextual a la derecha y biblioteca/planilla inferior. Cámara, foco, pose, escenario, captura, guardado, importación y exportación se conectan al estado del proyecto. Revisado en Chrome a 1280×720; faltó conservar una captura completa de UI del antes/después. |
| D2 — Corte vertical 3D | Hecho | Three.js/WebGL 2 para Cámara/Maqueta, Canvas 2D independiente para las vistas técnicas, set de estudio, maniquí articulado, iluminación/sombras y captura WebGL desde la cámara del plano. Prueba de proyección contra el core dentro de 1 px con squeeze 1/1,33/2 y cámara con yaw/pitch/roll. |
| D3 — Personajes | Parcial | Maniquí procedural articulado con poses de pie, sentado y paso; actores sucesivos reciben variantes de tono de piel, cabello y color de vestuario. Se comprobó seis actores operables. No hay asset humano riggeado ni selector independiente de apariencia; el maniquí es una herramienta de blocking y no un personaje detallado. |
| D4 — Escenarios | Parcial funcional | Estudio, interior y calle tienen geometría 3D, escala, planos de fondo y parallax. Las capturas reales están incluidas abajo. La calle es un set geométrico inicial de fachadas/road marks y todavía se lee como fachada simplificada; el interior puede ocluir al actor con la mesa según el encuadre. No es aprobación artística final. |
| D5 — Acabado | Parcial | Revisados flujos de captura/planilla, exportación/importación portable y layouts de 1280×720, 768×1024 y 390×844. No hubo desbordamiento horizontal en tablet/móvil. Falta auditoría completa de teclado/accesibilidad, perfiles de calidad, medición de FPS/p95/memoria, DoF visual por capas y validación de recuperación/errores de almacenamiento en navegador. |

## Capturas de la aplicación

PNG extraídos de miniaturas producidas por **Capturar** en el renderer WebGL real y exportadas desde CineOptics. Cada uno es un frame de cámara 1280×536, gate 2,39:1; no son mockups ni capturas de la interfaz.

| Escenario | Frame |
|---|---|
| Estudio y maniquí de pie | [D4-studio.png](captures/D4-studio.png) |
| Interior | [D4-interior.png](captures/D4-interior.png) |
| Calle | [D4-street.png](captures/D4-street.png) |

La UI se inspeccionó en el navegador a 1280×720. El árbol E/F/G no contenía un PNG de baseline reutilizable y no se archivó una captura completa del antes/después; esa evidencia visual de UI queda pendiente.

## Implementación

- `src/ui/workspace.ts` y `src/styles/workspace.css`: editor compacto neutro; navegación, árbol de actores, inspector y biblioteca con tarjetas de escenario/pose; acciones cableadas al reducer.
- `src/render/three-viewport.ts`: Three.js 0.186.0 para Cámara/Maqueta, tres presets geométricos, maniquí procedural, selección, órbita, gate y captura PNG.
- `src/main.ts`, `src/render/frame.ts` y contratos/reducer: dos superficies de render, escenario por ID, acciones de pose/locación, selección y ciclo de captura.
- `src/data/defaults.ts`: composición de arranque con el actor entero y de frente en el gate panorámico.
- `tests/render/three-projection.test.ts`, pruebas de frame/reducer, `package.json` y lockfile: proyección, escenario/pose y Three.js fijado.

El maniquí usa partes separadas y pose procedural, no huesos de un esqueleto ni un modelo GLB. Se añadieron rasgos faciales básicos y torso con perfil suavizado para distinguirlo de las primitivas del renderer anterior, pero la calidad visual queda deliberadamente identificada como maniquí. No se descargaron ni compraron assets.

## Validación ejecutada

- `npm run typecheck` — correcto.
- `npm test -- --reporter=dot` — 45/45 pruebas en 9 archivos.
- `npm run build` — correcto; Vite produjo build. Aviso pendiente: bundle JS de ~630 kB supera el umbral sugerido de 500 kB.
- `git diff --check` — correcto; Git solo mostró avisos de conversión LF/CRLF en archivos ya modificados.
- Chrome real: presets estudio/interior/calle y captura a Planilla, de las que se exportaron las tres imágenes listadas. En el navegador integrado: se añadieron seis actores y se revisaron en Maqueta; se probaron estados de pie/sentado/paso y round-trip portable con siete planos.
- Responsive Chrome real: 390×844 y 768×1024; `documentElement.scrollWidth` y `body.scrollWidth` iguales al ancho del viewport. El override temporal se restableció.
- Exportadas e inspeccionadas visualmente las tres miniaturas PNG listadas arriba. Cámara, gate y composición de cada frame salen de la captura del plano, incluso cuando se usa la biblioteca inferior.

No se afirma compatibilidad en otros navegadores/GPU, rendimiento medido, pruebas automatizadas de browser, auditoría de accesibilidad completa ni recuperación IndexedDB ante fallos. Esos casos siguen pendientes.

## Pendientes de aceptación

1. Seleccionar e integrar un humano estilizado riggeado con licencia de redistribución web verificada; hasta entonces, nombrar el recurso como maniquí.
2. Completar formas y capas de la calle, iluminación de contacto y encuadres iniciales por escenario; revisar 24/50/85 mm y parallax en Cámara/Maqueta.
3. Añadir apariencia seleccionable/versionada y revisar poses de perfil/espalda y ajuste de pies en sentado/paso.
4. Guardar capturas completas de UI D0/D1 al mismo tamaño; probar foco, gestos lentos/táctiles, captura desde Planta, recarga y recuperación en Chrome.
5. Completar V12–V26 pertinentes, teclado/lector/contraste y responsive a 1440×900, 1024×768 y zoom 200%.
6. Medir FPS/p95/memoria con seis actores y perfil reproducible; separar el bundle Three.js si el perfil confirma beneficio. Implementar calidad y DoF visual solo con resultados medidos.

**Dictamen:** D1/D2 están implementados; D3/D4 ofrecen una base funcional pero visualmente inicial; D5 y la aceptación global continúan abiertos. Esta entrega no cierra el plan completo.
