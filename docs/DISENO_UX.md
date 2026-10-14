# Dirección de diseño y experiencia

Propuesta para C/F. Se basa en estructura y CSS del prototipo; falta contraste visual en navegador.

## Resultado buscado

Una estación de planificación sobria: el plano ocupa la mayor parte del espacio, los controles son legibles y los datos técnicos se encuentran sin recorrer ocho paneles para una acción frecuente. Conservar el tema oscuro; reducir bordes anidados, miniaturas tipográficas y adornos que compiten con la imagen.

El recorrido principal es preparar escena → colocar cámara → definir encuadre y foco → capturar → revisar planilla. Un usuario debe distinguir qué está seleccionado, qué actor tiene el foco, si un cambio está guardado y qué magnitud es calculada o aproximada.

## Composición

- **Cabecera:** nombre de proyecto, guardado, deshacer/rehacer y capturar. Guardar/abrir/exportar en un menú reconocible. La comparación 24/135 pasa a la sección de cámara.
- **Barra de vistas:** Cámara, Planta, Maqueta, Elevación. Nombres breves y ayuda contextual al interactuar, no una frase larga siempre visible.
- **Panel contextual:** Escena, Cámara, Foco y Planilla. Dentro de Cámara, desplegables de sensor/óptica/rig; conservar la información técnica avanzada sin mostrarla toda simultáneamente.
- **Visor:** frame de salida estable con bandas fuera del área exportable, guías discretas y herramientas opcionales. Radar colapsable, sin tapar controles ni bloquear actores por defecto en pantallas estrechas.
- **Estado técnico:** focal, apertura f, distancia de foco y DoF en una sola franja. Detalles de FOV/CoC/gate en inspector, evitando duplicados permanentes.

El ancho de panel puede ser ajustable en escritorio. Cerrar el panel amplía el frame en pantalla, pero no cambia su composición física.

## Sistema visual

| Elemento | Propuesta |
|---|---|
| Superficies | Tres niveles de gris neutro: fondo, panel, control |
| Acento | Ámbar para selección/acción principal; cian para ayudas geométricas; verde para foco; rojo para error |
| Tipografía | Sistema sans para UI; monoespaciada solo en lecturas técnicas. Texto habitual 13–14 px; evitar 8–10 px en controles principales |
| Espaciado | Escala 4/8/12/16/24 px, agrupación por función y menos cajas dentro de cajas |
| Iconos | SVG coherentes con etiqueta/tooltip; sustituir mezcla de emojis en la navegación |
| Controles | Slider + número cuando aporte precisión; unidades visibles; preset activo consistente con el valor |
| Estados | Hover, foco de teclado, activo, deshabilitado, error, guardando y vacío claramente diferenciados |

Estos tamaños son un punto de partida de diseño, no una medición de la interfaz actual.

## Adaptación

- Escritorio amplio, desde aproximadamente 1280 px: inspector lateral y visor visible simultáneamente.
- Ventana media/tablet: inspector superpuesto o plegable, radar colapsado y franja técnica adaptable; ninguna acción principal queda fuera de pantalla.
- Móvil estrecho: visor y panel por turnos, controles apilados y objetivo de edición básica. No prometer una estación CAD completa en 390 px.
- Verificar 1920×1080, 1440×900, 1280×720, 1024×768, 768×1024 y 390×844; zoom 200% y DPI 1/2. Usar `dvh` con fallback si procede, flex children con dimensiones mínimas adecuadas y scroll solo donde corresponda.

## Interacciones concretas

**Seleccionar y enfocar:** seleccionar no debe cambiar foco implícitamente salvo herramienta explícita de «enfocar». Clic en actor selecciona; botón o gesto documentado enfoca. En planta, drag mueve X/Z; números permiten precisión. Actor enfocado y seleccionado tienen indicadores distintos.

**Órbita y paneo:** herramienta/mode visible. Órbita mantiene objetivo; paneo cambia orientación desde una posición fija. Mostrar cómo volver a encuadrar el actor. Rueda debe tener función clara por vista: focal en cámara si se conserva el comportamiento actual, zoom de mapa en vistas técnicas.

**Presets:** actúan sobre el actor seleccionado y su pose. Mantener encuadre usa un objetivo fijado; al llegar a límites, explicar que no puede mantenerse exactamente. «2 actores» utiliza los elegidos o indica cuál pareja está usando.

**Foco:** AF a actor identificado, manual y rack A/B con extremos seleccionables. Pausa/play y posición temporal; no animación que no pueda detenerse. Eliminar un extremo del rack lo cancela de manera segura.

**Reset:** «Restablecer cámara» no borra actores ni planos. «Nuevo proyecto» crea defaults completos y ofrece guardar cambios pendientes. Deshacer para borrar un actor/plano; no interrumpir con confirmaciones para cada ajuste.

**Planilla:** vacía con instrucción breve, tarjetas con número/nombre, focal, apertura, foco y miniatura; editar nombre/notas, duplicar, borrar y ordenar. Distinguir cargar un plano de seleccionarlo en la lista. Guardar/abrir y exportar tienen feedback visible.

## Claridad técnica

- «f/2.8» para geometría; T solo cuando se implemente un modelo documentado de transmisión.
- «Estimación DoF — CoC 0,029 mm» en lugar de «Cálculo Exacto».
- Mostrar gate activo y proporción de salida; sensor y recorte no son intercambiables.
- «Retícula áurea» si se dibujan líneas, no «espiral».
- «Picado alto» para el preset actual de -36°; reservar «cenital» a una vista vertical real.
- «Estilo cálido / vintage / anamórfico» con nota de aproximación; no sugerir calibración de Cooke, ARRI o Panavision.
- «Obturación: metadatos» mientras no afecte al render; fórmula con FPS editable y resultado de tiempo de exposición.
- Explicar la compresión con un ejemplo de distancia y encuadre: evitar atribuir cambios de perspectiva únicamente a la focal.

## Accesibilidad

Asociar labels a inputs; botones para elementos clicables; `aria-pressed` en toggles y semántica de tabs con estado actual. Foco visible, orden de Tab lógico, Escape cierra panel y devuelve foco al disparador. Panel colapsado fuera de navegación de teclado. Un nombre accesible para cada control y canvas con descripción/resumen textual complementario.

Todos los gestos tienen alternativa por controles. No usar solo color para señalar foco o error. Respetar reducción de movimiento y no hacer anuncios de lector de pantalla por cada frame. Atajos no se activan al escribir nombres/notas. Verificar contraste con mediciones, no solo por impresión visual.
