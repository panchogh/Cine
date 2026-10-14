# Auditoría del prototipo

Fecha: 2026-10-13. Archivo: `cine_shot_visualizer_3d_pro.html`, 109.103 bytes, aproximadamente 2.985 líneas. Las líneas citadas corresponden al original; buscar también por nombre de función si cambia el archivo.

SHA-256: `cbeb6cdbed013cfb246cf4e4a763ad50fce974fcb8a7d108912465326e88e04b`.

## Cobertura y límites

Se revisaron estilos, marcado, datos, cálculos, renderizadores, eventos, captura y exportación. No había dependencias, tests, README ni configuración de proyecto entre los archivos de la carpeta. No se observó `.git` en ella; no se ha determinado si un directorio padre pertenece a un repositorio.

Se ejecutó el JavaScript original con Node VM y dobles mínimos de DOM/Canvas para reproducir comportamientos de estado y comparar comandos de dibujo. El script completo compila. Las nueve observaciones están en [el resultado JSON](../docs-audit-results.json) y pueden repetirse con [el diagnóstico](../tools/audit-baseline.cjs).

**No se completó la validación visual ni interactiva en navegador.** El navegador integrado devolvió timeout al intentar abrir localhost; el segundo intento con servidor Node tampoco fue accesible. No hay capturas visuales, FPS medidos, perfil de memoria ni comprobación real de teclado/táctil. Los hallazgos de layout son inferencias del CSS y deberán verificarse durante la implementación. No se declara compatibilidad validada con ningún navegador.

Leyenda: **L** = inspección del código; **E** = comportamiento reproducido en Node con dobles, sin navegador. P1 = corregir antes de considerar confiable la versión; P2 = completar para una experiencia pulida; P3 = mejora posterior.

## Lo que merece conservarse

- Aplicación autocontenida, sin descargas externas y fácil de abrir.
- Vocabulario cinematográfico, presets, múltiples actores y vistas complementarias.
- Separación conceptual ya visible entre cálculos y funciones de cada vista, aunque todas dependan del estado global.
- Paleta oscura y panel contextual: buena dirección para un visor protagonista.
- Miniaturas y snapshots iniciales que pueden evolucionar a una planilla recuperable.
- Bokeh y locaciones procedurales útiles como recursos didácticos, si se explican sus límites.

## Hallazgos prioritarios

| ID | Prio. / evidencia | Hallazgo, ubicación e impacto | Reproducción o criterio de corrección |
|---|---|---|---|
| A01 | P1 · L/E | Órbita y rotación no comparten una orientación coherente. `renderCameraView`, líneas 1833–1851, sitúa la cámara con `sin(yaw)` y transforma usando `-yaw`. | Con solo el actor en el origen, yaw 0 genera un actor dibujado y yaw 90 ninguno. Definir órbita alrededor del objetivo y probar 0/±45/±90/180°. |
| A02 | P1 · L | El FOV numérico usa sensor W/H, pero la proyección horizontal depende de la altura del canvas y `sensorH`. Líneas 1544–1549, 1815–1817 y 2246–2262. El aspecto se aplica como máscara posterior. | Mantener estado y aspecto, cambiar tamaño o cerrar panel: el contenido normalizado dentro del cuadro final debe permanecer estable. Gate efectivo y FOV deben corresponder al mismo cuadro. |
| A03 | P1 · L/E | Autofoco usa distancia euclídea en XZ; desenfoque usa `cz` proyectado. `getActorActualDistance`, 1520–1527, y 2095–2097. Tampoco considera la altura/pitch del punto enfocado. | Con cámara a 1,85 m y desplazamiento X de 1 m, AF devuelve 2,103 m mientras el render usa profundidad 1,85 m. Una definición de plano de foco y punto objetivo debe gobernar ambos. |
| A04 | P1 · L | Planta ignora yaw/pan; frustum de maqueta apunta a esquinas fijas en Z=0/Y=1,5; elevación usa otra simplificación. Líneas 2307–2388, 2437–2452 y 2458–2494. | Las cuatro vistas deben consumir la misma pose, ejes y gate. Mostrar explícitamente que elevación es una sección/proyección, con su eje identificado. |
| A05 | P1 · L | Movimientos `push_in`, `orbit` y `handheld` solo alteran variables locales del visor; métricas, mapas y snapshot quedan en otro instante/pose. Líneas 1819–1839 y 2940–2956. | Pausar movimiento y capturar: visor, pose guardada, foco y mapa deben corresponder al mismo tiempo evaluado. |
| A06 | P1 · L/E | `syncUI` no sincroniza todos los valores/clases/tags. Líneas 1684–1767; restauración por `Object.assign` en 2901–2903. | Caso ejecutado: estado `s16`, lectura Super 16mm y selector aún `ff`. Revisar sensor, aspecto, guías, localización, palas, look, viñeta, rig, roll/pan, CoC y etiquetas de foco/ángulo. |
| A07 | P1 · L/E | Foco referenciado por índice; eliminar actor no repara `focusTarget`. Líneas 1447, 2698–2702. | Enfocar actor 2 y borrarlo deja `actor_1` sin destino. Usar IDs; si se borra el enfocado, pasar a manual conservando distancia válida y comunicarlo. |
| A08 | P1 · L | Planilla solo en `state.shotList`. No hay persistencia ni importación. Líneas 1502 y 2909–2937. | Capturar y recargar pierde la lista. Guardado local con recuperación y exportación/importación de proyecto. CSV no es backup del proyecto. |
| A09 | P1 · L/E | `act.name` se interpola en `innerHTML`. Líneas 1643–1648 y 2705–2707. | El nombre `<b>Nombre de prueba</b>` queda como marcado en la plantilla. Usar `textContent`. La auditoría no ejecutó payloads ni demostró explotación remota; el riesgo aumenta si se importan proyectos. |
| A10 | P2 · L/E | Reset solo restaura algunos parámetros. Líneas 2869–2880. | El caso ejecutado conserva bosque, sensor S16 y grano 55. Definir «Restablecer cámara» y «Nuevo proyecto» por separado, con comportamiento documentado. |

## Funcionalidad y exactitud del mensaje

| ID | Prio. / evidencia | Hallazgo y ubicación | Acción propuesta |
|---|---|---|---|
| A11 | P2 · L/E | ND, obturación y grano tienen eventos y etiquetas, sin lectura en el renderer. Líneas 2793–2804. La secuencia de comandos de dibujo es idéntica al cambiarlos. | ND aproximado y grano reproducible en render; obturación explícitamente como metadato hasta implementar motion blur. No prometer exposición física sin modelo de luz/exposición. |
| A12 | P2 · L | Radar dice «HAZ CLIC PARA MOVER» (1377), pero `pipCanvas` no registra interacción. | Implementar selección/arrastre en planta con transformación inversa, o retirar el mensaje hasta que exista. |
| A13 | P1 · L | Apertura rotulada T-stop se usa como N geométrico en DoF/CoC. Líneas 929–950 y 1532–1578. No hay transmisión calibrada. | Usar f-number para geometría; T separado solo si hay transmisión conocida. Retirar «Cálculo Exacto» (1034) y documentar el modelo. |
| A14 | P2 · L/E | Squeeze cambia posición proyectada y bokeh, pero ancho de torso/cabeza deriva solo de escala vertical. Líneas 1817 y 2098–2110. | Caso ejecutado: ancho 222,114 px idéntico en squeeze 1 y 2. Proyectar geometría completa o aplicar transformación consistente del desqueeze. |
| A15 | P2 · L | Presets usan siempre `actors[0]` y alturas fijas pese a anunciar actor activo. Líneas 1416–1426 y 1612–1628. `shotType` permanece aunque después se altere el encuadre. | Ajustar al actor seleccionado/pose; two-shot debe considerar los dos sujetos. Diferenciar preset elegido de clasificación real del plano; marcar «personalizado» tras cambios relevantes. |
| A16 | P2 · L | Captura usa todo `mainCanvas` y su vista activa; incluye guías y máscaras dibujadas, no overlays DOM. Copia todo `state`, incluso planilla/miniaturas, antes de borrarla de la copia. Líneas 2909–2923. | Capturar siempre el frame de cámara a tamaño estable, con opción limpia/técnica; snapshot de campos explícitos y assets separados. No duplicar planilla en cada copia. |
| A17 | P2 · L | Límites dispares entre slider/number/setter: focal 12–250 vs 10–300; distancia y foco también. Líneas 859–860, 909–910, 1020–1021, 2562 y 2603. | Restricciones declaradas una sola vez; campo vacío o inválido mantiene último valor válido y da feedback. Mostrar saturación del bloqueo de encuadre. |
| A18 | P2 · L | Selección usa rectángulos sin rotación aunque el canvas aplica roll. Umbral de arrastre se mide por evento, no desde el inicio; yaw redondea cada delta. Líneas 1869–1873, 2220–2227 y 2808–2852. | Pointer Events, captura del puntero, umbral acumulado en píxeles CSS, transformación inversa para picking y límites del frame. Probar movimientos lentos, DPI alto y actores superpuestos. |
| A19 | P2 · L | Promesas visuales exceden implementación: desierto/café/etc. comparten edificios genéricos (2013–2032); «espiral» es una retícula (2285–2292); «cenital» es pitch -36° (2765); Kelvin tiñe el haze (2233–2235). | Renombrar con precisión y priorizar locaciones distinguibles. «Cenital» requiere cámara vertical; separar temperatura de iluminación de balance de blancos. Los looks de marcas son estilos aproximados, no perfiles medidos. |
| A20 | P2 · L | Ventana de hiperfocal: condición `S1 < H_mm` no coincide exactamente con cero del denominador `H_mm-(S1-f)`. Líneas 1555–1562. | Elegir y documentar una convención óptica consistente; probar ambos lados del umbral, cercanía a focal y límites de valores. No corregir una fórmula aislada sin fijar supuestos. |

## Interfaz, accesibilidad y rendimiento

| ID | Prio. / evidencia | Hallazgo | Acción propuesta |
|---|---|---|---|
| A21 | P2 · L | Sin media queries; header con mucha información, panel fijo de 320 px, radar de 245 px, altura `100vh` y overflow oculto. CSS 35–57, 192–209, 463–535 y 556–599. | Breakpoints y panel superpuesto en tablet; acciones alcanzables con zoom 200%; medir colisiones reales. No se afirma una captura visual defectuosa: queda por verificar. |
| A22 | P2 · L | Inputs sin labels asociados; tarjetas/radar como `div` clicable; toggles sin `aria-pressed`; canvas sin descripción; `user-select:none` global; slider sin indicador de foco específico. | Semántica nativa, foco visible, alternativas numéricas a los gestos y estado textual de escena. No afirmar que ningún botón admite teclado: los botones nativos sí lo permiten. |
| A23 | P2 · L | `animate` redibuja y mide ambos canvas continuamente; `syncUI` en dolly/rack reconstruye lista y listeners por frame. Líneas 1634–1665 y 2940–2975. | Un cálculo derivado por frame, invalidación, cache, render estático bajo demanda y no reconstruir DOM en animaciones. Medir antes/después; no hay FPS actuales medidos. |
| A24 | P2 · L | Planilla sin editar/borrar/ordenar/notas, sin estado vacío. Export CSV no libera object URL (2928–2937). | CRUD de planos, selección accesible, export robusto y liberación de recursos. Los valores CSV actuales son mayormente internos; escape de comillas y protección de fórmulas serán necesarios al añadir texto libre. |

## Diagnóstico global

La base es un prototipo didáctico con varias aproximaciones visuales. Para usarla como herramienta técnica de planificación, el mayor valor está en la coherencia entre cámara, proyección, mediciones y guardado. La estética se puede mejorar sin fotorealismo: composición estable, siluetas legibles, jerarquía clara y controles que cumplan lo que anuncian.

Antes de afirmar precisión profesional, validar dimensiones de sensores por modelo y modo de grabación contra documentación de fabricantes; no equiparar nombres comerciales con un gate genérico. El CoC debe ser un supuesto visible y ajustable, no una propiedad universal del sensor.

## Addendum de fase 1 · 2026-10-13

El estado anterior describe la auditoría del prototipo y no se reescribieron sus expectativas. Antes de modificar el proyecto se comprobó que no había `.git` en esta carpeta ni en sus padres; se creó el repositorio local con commit base `ca5cceb0199932946a782af40f016d79cc839724`, sin remoto. El HTML de referencia conserva el SHA-256 registrado arriba. La nueva aplicación y las limitaciones de sus adaptadores constan en [handoff A](handoffs/A.md).

Referencia para la relación entre focal, sensor y ángulo de visión: [Edmund Optics — Understanding Focal Length and Field of View](https://www.edmundoptics.com/knowledge-center/application-notes/imaging/understanding-focal-length-and-field-of-view). La auditoría detecta una discrepancia interna del código; no certifica el modelo físico completo.
