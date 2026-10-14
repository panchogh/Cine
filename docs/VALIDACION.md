# Validación y criterios de aceptación

## Qué se ha ejecutado hoy

`node tools/audit-baseline.cjs` compila y ejecuta el script del HTML con dobles de DOM/Canvas. Registra sintaxis válida y ocho observaciones sobre errores o discrepancias. Salida: [docs-audit-results.json](../docs-audit-results.json).

No equivale a ocho tests de producto aprobados: son reproducciones de problemas del legado. No se ha ejecutado una suite de navegador ni se ha medido rendimiento. Las pruebas de abajo son el contrato de aceptación **pendiente** para la implementación.

## Fase 1 · 2026-10-13

| Puerta | Resultado comprobado |
|---|---|
| Nueva entrada y cuatro vistas | `index.html` apunta a `src/main.ts`; existen los tabs Cámara, Planta, Maqueta y Elevación. Vite inició e informó `ready`; la solicitud a `127.0.0.1:5173` fue bloqueada por permisos de socket. No hubo comprobación visual en navegador. |
| Contratos compilables | `npm run typecheck` — aprobado con TypeScript 7.0.2. |
| Fixtures y comandos | `tests/fixtures/project.ts`; `npm test` — 1 archivo, 3 tests aprobados. Comandos y lockfile publicados. |
| Instalación reproducible | `npm ci` — aprobado desde registry con `package-lock.json`; 37 paquetes. `npm ci --offline` no estaba soportado porque faltaba un tarball de caché. |
| Build | `npm run build` — aprobado con Vite 8.3.4. |
| Referencia | SHA-256 actual igual al auditado: `cbeb6cdbed013cfb246cf4e4a763ad50fce974fcb8a7d108912465326e88e04b`. |

Puerta de fase 1: **aprobada en tipos, tests y build; parcialmente verificada en arranque** por la restricción del socket local. Las vistas son esquemáticas y no prueban fidelidad visual.

## Integración fase 2.5 · 2026-10-13

| Comprobación | Resultado de integración |
|---|---|
| Entregas B/C/D y Git | Se revisó el checkout compartido: handoffs presentes, sin commits/worktrees individuales. HEAD base de integración `3f05106`; no hay remoto. Cambios se integraron sin revertirlos. |
| B conectado a frame | `deriveFrame` evalúa movimiento a instante, gate efectivo, FOV, foco/DoF, actores y avisos; los cuatro modos consumen su modelo. Tests Vitest aprobados. La proyección/render sigue esquemática. |
| D conectado a entrada | Repositorio IndexedDB con snapshots/assets, restauración, validación portable y CSV implementados; integración conecta cargar, guardar y captura. Validación real de IndexedDB/recarga en navegador pendiente. |
| C conectado a entrada | `mountWorkspace` está montado desde `main.ts`; botones de quitar actor y cargar snapshot despachan callbacks/acciones. Sin QA visual o de interacción real. |
| Eliminar actor enfocado | Aprobado en `tests/integration/phase-two.test.ts`: selección/referencia se reparan y foco pasa a manual con distancia conservada. |
| Restaurar cámara y cargar snapshot | Aprobado con repositorio de memoria: cargar snapshot recupera focal y pose de cámara; conserva assets y selecciona el plano. No equivale a prueba IndexedDB de navegador. |
| Tipos, tests y build | `npm run typecheck` aprobado; `npm test -- --reporter=verbose` 24/24 en 6 archivos; `npm run build` aprobado, Vite 8.3.4 (21 módulos); `git diff --check` aprobado. Vite dev informó `ready`; no se validó petición HTTP ni navegador. |

**Estado:** contratos B/D/C integrados sin incompatibilidades de TypeScript detectadas. La puerta técnica 2.5 está aprobada al pasar tipos, tests y build; la validación del navegador sigue abierta y la fase no declara terminada su aceptación visual/persistencia real. APIs para E/F publicadas en `src/contracts` y [handoff A](handoffs/A.md).

## Integración E/F y G-001–G-004 · 2026-10-13

| Hallazgo | Cambio y evidencia automática | Verificación de navegador |
|---|---|---|
| G-001 · lectura AF divergente | UI deriva distancia axial y distancia de cinta desde `deriveFrame`/core; test contrasta ambas magnitudes. | Chrome: panel Foco mostró axial 1,30 m y cinta 1,55 m para actor desplazado; DoF/gate en el mismo frame. |
| G-002 · planta sin edición | Entrada enlaza `bindGestures`; campos X/Y/Z y `scene/actorMoved`; tests E validan conversión CSS→metros. | Chrome: tecla de incremento actualizó X a 0,01 m; drag visible en Planta cambió actor a X=0,87 m, Z=−0,57 m. No se probó DPR/táctil/cancelación. |
| G-003 · sin reproducción | `FrameModel.look`, viewport CSS y APIs de render/gesto/scheduler formalizados; pruebas core/reducer/scheduler. | Chrome: Push-in habilitó 3 s/Play, tiempo llegó a 1,23 s y se pausó en 1,83 s. Rack no se implementó. |
| G-004 · sin proyecto nuevo | Acción “Nuevo proyecto” aplica defaults completos, conserva identidad local, vacía assets/planos y reinicia tiempo. | Chrome: la acción volvió a actor/defaults y estado «Proyecto nuevo creado; guardando…». No se ejercitó diálogo de cambios pendientes. |
| Guardado manual/autosave | `createProjectSaveQueue` comparte cola serial, copia assets por solicitud y se recupera de una escritura fallida; tests cubren orden y fallo/continuidad. Ambos caminos de `main.ts` consumen esta cola. | Persistencia IndexedDB real y recarga aún pendientes. |
| Guardado y recuperación | Tests verifican serialización, snapshots del mapa de assets y recuperación tras fallo. | Chrome: manual Guardar terminó en «Guardado»; actor de Planta se autosalvó; recarga recuperó proyecto en IndexedDB y preservó X/Z. |
| Checks | `npm run typecheck`; `npm test -- --reporter=verbose` **41/41 en 8 archivos**; `npm run build` aprobado, Vite 8.3.4 (26 módulos); `git diff --check` aprobado. | Vite `127.0.0.1:5178`, página «CineOptics Studio» cargó en Chrome. Smoke de interacción descrito arriba; no equivale a V12–V20 completos. |

**Dictamen:** correcciones de código G-001–G-004 realizadas; build/tests/tipos y smoke QA local pasan. No cerrar fase 3: faltan captura/restauración real de snapshots, escenarios V12–V20, cobertura visual/responsive, accesibilidad y rendimiento.

## Lógica: B y A

| Caso | Entrada o acción | Resultado exigido |
|---|---|---|
| V01 FOV de sensor completo | Gate 36×24 mm, focal 50 mm, squeeze 1, sin recorte | HFOV ≈39,598°; VFOV ≈26,991°; tolerancia 0,001° para función matemática |
| V02 Gate de salida | Política de recorte centrado inscrito, 36×24 mm, salida 2,39:1, squeeze 1 | Gate de salida 36×(36/2,39) mm, distinto del sensor completo; VFOV calculado desde ese gate |
| V03 Independencia del layout | Mismo estado y aspecto en dos tamaños de canvas | Coordenadas normalizadas dentro del frame iguales, tolerancia matemática 1e-6; equivalencia visual dentro de 1 px de salida tras redimensionado |
| V04 Órbita | Actor objetivo en origen; cámara orbita 0/±45/±90/180° | Objetivo centrado y delante de cámara; distancia de órbita constante |
| V05 Foco | Actor seleccionado, posiciones laterales y distintas alturas/pitch | CoC del punto usado como objetivo de foco igual a cero según convención declarada; distancia de cinta y axial distinguidas |
| V06 DoF | Focal 50 mm, f/2.8, CoC 0,03 mm, foco 3 m | Cercano <3 m<lejano; cotejo numérico con fixture derivado independientemente de la implementación y convención documentada |
| V07 Hiperfocal y límites | En torno al umbral de infinito; focal/distancia extrema | Sin NaN ni DoF negativa; infinito explícito; entradas físicamente no soportadas producen aviso, no clamps ocultos |
| V08 Dolly zoom | Mismo objetivo, sin alcanzar límites, cambio 24→135→24 mm | Altura normalizada del objetivo se conserva; vuelta recupera posición dentro de tolerancia; con límites muestra aviso |
| V09 Presets | Seleccionar actor B, moverlo y cambiar pose | Preset encuadra B; two-shot considera pareja y sus extensiones; etiqueta no queda falsamente activa tras alterar el encuadre |
| V10 Eliminación | Borrar actor enfocado | Referencias válidas; foco manual conserva último valor válido |
| V11 Reset | Cambiar cámara, escena y capturar plano | Reset de cámara conserva escena/planilla; nuevo proyecto restablece defaults completos según flujo de cambios pendientes |

Los fixtures ópticos deben venir de derivación independiente o referencia técnica con los mismos supuestos, nunca del output de la función bajo prueba. Documentar tolerancias de cálculo separadas de las visuales. No usar etiquetas comerciales de lentes como sustituto de validación.

## Navegador e interacción: E, F y G

| Caso | Pasos | Resultado exigido |
|---|---|---|
| V12 Sincronización total | Cambiar todos los controles, guardar plano A, cambiar a B, cargar A | Selectores, sliders, números, botones, tags, vistas y métricas representan el estado restaurado |
| V13 Picking | Clic en actores superpuestos, roll ±35°, DPR 1/2, fuera del frame | Selecciona entidad visible correcta; bandas no seleccionan actores ocultos; tolerancia acorde a figura |
| V14 Drag lento/táctil | Arrastrar con pequeños deltas acumulados, salir del canvas, cancelar puntero | No se convierte en clic accidental; no queda arrastre activo; ratón/lápiz/táctil coherentes |
| V15 Planta editable | Mover actor en planta con drag y después por número | Coordenadas, visor y otras vistas coinciden; deshacer restaura un drag completo |
| V16 Animación | Play/pausa/push-in/orbit/handheld y capturar a tiempo conocido | Las vistas y métricas corresponden a la cámara evaluada del mismo instante; restaurar reproduce la captura |
| V17 Captura | Capturar estando en planta con panel abierto, luego con panel cerrado | Imagen de cámara, mismo encuadre y aspecto; sin HUD por defecto; miniatura y snapshot del mismo frame |
| V18 Efectos declarados | Cambiar ND, grano y obturación | ND cambia atenuación aproximada, grano cambia textura reproducible; obturación muestra tiempo correcto y se identifica como metadato |
| V19 Apertura/sensor | Cambiar f-number, focal, gate y squeeze | Comportamiento geométrico consistente; silueta no mezcla escala anamórfica y esférica; avisos de aproximación pertinentes |
| V20 Texto literal | Nombre con `<b>Texto</b>`, comillas, tildes y saltos de línea en notas | Texto literal sin generar elementos; editor conserva selección/cursor al actualizar |

### Decisión de alcance: Rack Focus

Rack focus se aplaza; no bloquea el cierre de esta matriz de los flujos implementados. La UI y el contrato actuales modelan foco manual o a actor en un instante, pero no una curva de foco con marcas de tiempo, interpolación, límites, reproducción ni semántica de captura/importación. Añadirlo ahora ampliaría el esquema persistido y el modelo de animación. El alcance de reproducción de esta entrega es estática, push-in, órbita y handheld aproximado. Registrar rack focus como P2 para una fase posterior con contrato, edición y aceptación propios; no presentar el desplazamiento manual de foco como rack.

Para V18: a 24 fps y 180°, tiempo = 180/(360×24) = 1/48 s. Tres pasos ND equivalen a transmisión relativa 1/8 en el modelo; la imagen final puede requerir gestión de color, por lo que no se exige dividir bytes sRGB directamente por ocho.

## Datos y exportación: D y G

- **V21 Round-trip:** exportar e importar proyecto con seis actores, notas, tres planos y ajustes distintos; comparar contenido semántico, IDs y orden. Excluir caches y estado temporal de UI de la comparación.
- **V22 Recuperación:** modificar y esperar confirmación de guardado; recargar; recuperar proyecto y miniaturas. Cerrar antes de confirmación no debe anunciar un guardado inexistente.
- **V23 Errores:** simular falta de cuota, almacenamiento bloqueado, JSON truncado, versión futura, referencias inexistentes y rangos no válidos. Conservar sesión previa y permitir exportarla.
- **V24 CSV:** comas, comillas, nuevas líneas, acentos y texto que empieza con `=`, `+`, `-` o `@`; abrir con lector CSV independiente y una aplicación de planillas. Campos técnicos con unidades inequívocas. Fórmulas no se ejecutan como contenido importado.
- **V25 Integridad:** capturar no modifica planos anteriores; duplicar da ID nuevo; borrar libera assets no usados; snapshot no incluye la planilla completa.
- **V26 Recursos:** exportaciones consecutivas revocan object URLs cuando corresponde; miniaturas limitadas por tamaño/resolución y errores comunicados.

## Visual y accesibilidad: C/F/G

Capturas de Cámara, Planta, Foco y Planilla, con 1/2/6 actores; elegir datos cortos y largos. Resoluciones: 1920×1080, 1440×900, 1280×720, 1024×768, 768×1024 y 390×844; verificar zoom 200% y DPR 2 en un caso representativo.

Criterios: todas las acciones principales accesibles; nada esencial oculto por overflow o radar; texto legible; controles sin solapamiento; frame estable; paneles con scroll útil. Selección, foco y advertencias distinguibles sin depender solo del color.

Recorrer con Tab/Shift+Tab, activar con teclado, cerrar con Escape y comprobar retorno de foco. Inputs etiquetados, tarjetas accesibles, canvas descrito, panel oculto no enfocable y reducción de movimiento respetada. Medir contraste y completar una comprobación manual: un escáner automático no prueba toda la accesibilidad.

## Rendimiento: metas propuestas, no resultados

Registrar navegador/versión, equipo, resolución, DPR y escena. Perfil mínimo: seis actores, desenfoque alto, radar abierto, animación y 50 planos con miniaturas. Comparar con el legado en el mismo equipo si puede abrirse.

- Escena estática: no mantener render/DOM continuo sin invalidación.
- Animación: objetivo 60 fps en equipo de referencia; si no se logra, modo de calidad reducida con meta de 30 fps. Registrar p95 de duración de frame, no solo promedio.
- Respuesta a input: meta menor a 100 ms perceptibles para acciones frecuentes en el equipo declarado.
- Cinco minutos de interacción y creación/borrado de planos: comprobar ausencia de crecimiento sostenido atribuible a listeners, URLs o miniaturas abandonadas.
- El scheduler se detiene en pestaña oculta y retoma correctamente. Reducir resolución/efectos no altera óptica ni datos guardados.

Si las metas no se alcanzan, perfilar el cuello de botella antes de introducir workers o reemplazar el renderer.

## Puertas de aceptación

**Fase 1:** nueva entrada arranca, cuatro vistas presentes, contratos compilables, fixtures y comandos documentados; fallos originales identificados y preservación del HTML comprobada.

**Fase 2:** B aprueba lógica relevante, D round-trip y errores, C controles/teclado/layout. A integra y ejecuta checks. No basta que tres ramas compilen por separado.

**Fase 3:** V12–V20 y flujo guardar/cargar/capturar real en navegador. Capturas revisadas y comparadas con el diseño.

**Fase 4:** ningún P1 abierto, lista explícita de P2 aplazados, build/tipos/tests pertinentes correctos, mediciones y limitaciones documentadas. Informe G con evidencia real y fecha, sin convertir «pendiente» en «aprobado».

## Revisión focalizada de matriz · 2026-10-13

Esta revisión repitió escenarios afectados por G, texto/render y carga diferida de Three.js; no sustituye la matriz completa ni las pruebas de DPR, tacto, almacenamiento fallido o geometrías múltiples.

| Área | Evidencia nueva | Estado actualizado |
|---|---|---|
| V04 Órbita | En Chrome 1280×720, seleccionar Órbita habilitó Play y 3 s; el tiempo avanzó y el render 3D llegó a 3/3 s con el actor en perfil. Tests core cubren radios y ángulos. | Parcial: smoke visual básico aprobado; faltan ángulos, cambios de objetivo y consistencia en todas las vistas/captura. |
| V16 Handheld | En Chrome, Handheld aproximado habilitó Play, el contador avanzó de 0 a 0,70 s y la vista 3D se mantuvo activa. | Parcial: smoke de reproducción aprobado; falta medir amplitud/semilla, captura/replay y equivalencia multi-vista. Rack focus se aplaza por decisión explícita anterior. |
| V20 Texto | En Chrome, nombre `<b>Texto</b> á` y nota con `<i>literal</i>`, salto de línea y `=SUM(1,2)` permanecieron literales; al confirmar el nombre el foco avanzó de Nombre a Notas y Shift+Tab volvió a Nombre. Cero nodos `b/i` generados dentro de las tarjetas. | Smoke de texto/teclado aprobado para este caso. Cursor/selección avanzada y límites de longitud siguen pendientes. |
| V21 Datos | El JSON descargado desde la UI se parseó y luego se abrió de nuevo desde el selector local. Se conservaron dos planos, IDs, miniaturas y la nota exacta multilínea. Chrome también creó seis actores y tres planos. | Smoke round-trip real aprobado para dos planos; seis actores/tres planos se crearon en UI pero su archivo no se volvió a inspeccionar/importar. El fixture de seis/tres sigue cubierto por Vitest. |
| V22 Persistencia | Nuevo proyecto limpió la prueba de escala, terminó en Guardado y después de recarga explícita Chrome recuperó «Nuevo proyecto», un actor, cero planos, cámara estática y tiempo cero. | Smoke IndexedDB tras reset aprobado; cuota/fallo y recuperación del proyecto previo siguen pendientes. |
| Accesibilidad | DOM revisado: H1 CineOptics antes de H2, sin controles visibles sin nombre, canvas 2D descrito, panel oculto no enfocable; Escape cerró el menú y devolvió foco; Tab/Shift+Tab recorrieron Nombre↔Notas. Un fallo reproducido de Escape ocultaba panel sin toggle visible en escritorio: corregido; ahora el toggle aparece, recibe foco y reabre el panel. Contrastes estáticos revisados: mínimo 6,20:1 entre pares comprobados. | Revisión manual focalizada aprobada para controles/paleta comprobados; zoom 200%, teclado completo y lector de pantalla siguen pendientes. |
| Responsive | Navegador real reportó viewport 1280×720 CSS px y DPR 1,25. Documento mide 1280×720 sin overflow global. | Parcial: solo un tamaño/DPR. Otros cinco tamaños del brief, zoom 200% y DPR 2 no se ejecutaron. |
| Vistas/captura | Con seis actores se revisaron Cámara, Planta, Maqueta y Elevación en Chrome. Captura desde Planta con panel abierto/cerrado generó miniaturas 1280×536; ambas cargaron. Tras cambiar actor 6 X=6→7, cargar Plano 1 restauró X=6 y mostró «Plano cargado». | Smoke aprobado en esas dos capturas y restauración de posición; comparación visual píxel a píxel, aspecto alterno y captura con movimiento en curso siguen pendientes. |
| Rendimiento | Test de scheduler (coalescing/visibilidad). Chrome duplicó 47 planos hasta 50: 14.766 ms de operación automatizada incluida la latencia del puente; 50/50 miniaturas cargadas y sin overflow global en 1280×720. Build antes de separar Three: bundle de entrada 630,94 kB/164,52 kB gzip; ahora entry 76,80 kB/24,64 kB y chunk renderer 555,62 kB/140,50 kB, solicitado durante inicialización. | Parcial: el tiempo de duplicación no es latencia pura de render ni FPS. Entry más pequeño, pero no se demuestra menos bytes totales de primera carga; build aún advierte que el chunk Three supera 500 kB. Sin FPS/p95, memoria, perfil de cinco minutos ni comparación con legado; no se aprueban metas de runtime. |
| Errores de ejecución | Consola sin errores al repetir Órbita, Handheld, importación y edición. Autosave terminó en «Guardado». | No se reprodujo otro fallo en los casos ejecutados; esto no aprueba escenarios no probados. |

Checks finales tras estos cambios: `npm run typecheck` aprobado; `npm test -- --reporter=verbose` **45/45 en 9 archivos**; `npm run build` aprobado (30 módulos); `git diff --check` aprobado. Build conserva la advertencia del chunk `three-viewport` de 555,62 kB minificados. El bundle de entrada baja a 76,80 kB, pero el import dinámico solicita el renderer durante la inicialización; no se afirma menor transferencia total ni que el coste de Three desaparezca. El ensayo de 50 planos y las capturas multi-actor terminaron limpiando el proyecto con Nuevo proyecto; la app quedó en defaults y Guardado.
