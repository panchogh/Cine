# CineOptics — plan de diseño de interfaz, personajes y escenarios

Fecha: 13 de octubre de 2026. Estado: **especificación; no implementado**.

Documento solicitado como `desing.md`. Contiene la dirección visual, el alcance, las fases y el encargo para un único agente de implementación con GPT-6 Luna en Alto. Esta entrega solo añade documentación: no instala paquetes, modifica la aplicación ni inicia agentes.

## 1. Decisión de diseño

Convertir CineOptics en un editor de previsualización cinematográfica con la organización espacial de Cinema 4D y la disciplina visual de las herramientas de Adobe: superficies grises, barras compactas, visor dominante, árbol de escena y propiedades contextuales.

La imagen del plano aporta el color y el carácter; la interfaz sirve como marco neutro. El producto debe permitir entender escala, distancia, perspectiva, blocking y foco, además de generar imágenes útiles para una planilla de rodaje.

Hay dos trabajos diferentes, ambos incluidos en este plan:

1. **Interfaz de editor:** distribución, tipografía, controles, jerarquía, biblioteca y estados.
2. **Calidad del contenido del visor:** geometría de personajes, escenarios, materiales, iluminación y profundidad.

La segunda parte requiere trabajo de renderer y assets. Una mejora exclusivamente de CSS no puede convertir los prismas actuales en personajes convincentes.

## 2. Lectura de las referencias del usuario

Las tres imágenes adjuntas son referencias visuales, no especificaciones de funciones obligatorias. Este documento describe los rasgos necesarios para continuar aunque las imágenes del portapapeles dejen de estar disponibles.

| Referencia | Qué tomar | Cómo aplicarlo |
|---|---|---|
| Imagen 1: Cinema 4D con cubo, herramientas y editor de curvas | Visor de trabajo grande, herramientas agrupadas, jerarquía espacial, ejes y suelo legibles | Área de cámara/maqueta central, rail de herramientas y controles de transformación. No implementar un editor de curvas solo porque aparece en la imagen |
| Imagen 2: objeto orgánico iluminado, árbol a la derecha y materiales abajo | Separación clara entre contenido 3D, objetos, atributos y biblioteca | Árbol de escena arriba a la derecha, inspector debajo y biblioteca inferior con miniaturas |
| Imagen 3: escena colorida con interfaz gris | UI discreta frente a una imagen rica, filas compactas, paneles rectangulares y propiedades alineadas | Grises neutros y acentos funcionales; llevar materiales, sombras y color al escenario. No trasladar el amarillo/rojo saturado a toda la UI |

No reproducir menús de modelado, partículas, nodos, render offline o escultura que CineOptics no ofrece. Tampoco usar logotipos de esos programas ni copiar sus iconos. La referencia es la organización de un editor profesional, no una réplica completa de Cinema 4D.

## 3. Punto de partida verificado

- La aplicación modular ya usa TypeScript, Vite y DOM/CSS; el renderer es Canvas 2D.
- `src/render/actor-geometry.ts` construye ocho esquinas por actor y proyecta su envolvente: el resultado actual es un prisma, sin anatomía, ropa, articulaciones ni materiales.
- `src/render/canvas-renderer.ts` rellena polígonos de actores y dibuja retículas/frustums. El visor no construye una locación detallada.
- `ProjectDocument.scene` contiene `locationId` y `backgroundDistanceM`, pero `deriveFrame` no los transporta al frame actual. No basta con añadir miniaturas de escenarios: hay que llevar la escena al renderer.
- La UI actual concentra navegación e inspector a la izquierda, usa tintes verdosos, ámbar, bordes redondeados y grupos espaciados. El nuevo lenguaje será más neutro, rectangular y compacto.
- El handoff A más reciente declara integración de gestos, reproducción, foco y cola de guardado. G declara G-001–G-004 corregidos, con 41 pruebas y smoke de Chrome, pero mantiene abiertas las puertas completas de aceptación. Son resultados reportados por esas entregas; este plan no reejecutó las pruebas.

Conservar el core de cámara/óptica, los IDs, la persistencia y los flujos ya integrados. La evolución visual debe proteger esos avances.

## 4. Composición de la interfaz

### Layout principal: espacio de trabajo «Planificación»

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Archivo  Edición  Vista  Ayuda     Proyecto · Guardado      Capturar plano   │
├────────────────────────────────────────────────────────────────────────────┤
│ Selección  Mover  Girar │ Espacio: Mundo │ Ajuste │ Calidad │ Layout         │
├────┬───────────────────────────────────────────────────┬───────────────────┤
│    │ Cámara  Planta  Maqueta  Elevación                 │ Escena    Buscar  │
│    ├───────────────────────────────────────────────────┤ Cámara principal  │
│ H  │                                                   │ Actores           │
│ E  │                                                   │  · Personaje A    │
│ R  │                  VISOR PRINCIPAL                  │  · Personaje B    │
│ R  │                                                   │ Escenario         │
│ A  │       Guías / selección solo cuando aportan        ├───────────────────┤
│ M  │                                                   │ Atributos         │
│ .  │                                                   │ Transformación    │
│    │                                                   │ Apariencia / pose │
│    ├───────────────────────────────────────────────────┤ Cámara / foco     │
│    │ Inicio  Reproducir/Pausar  Tiempo ─────── Duración  │                   │
├────┴───────────────────────────────────────────────────┤                   │
│ Planilla │ Escenarios │ Personajes                     │                   │
│ [miniatura] [miniatura] [miniatura] [miniatura]          │                   │
├───────────────────────────────────────────────────────┴───────────────────┤
│ 50 mm · f/2.8 · Foco axial 2,40 m · DoF estimada …   Estado / ayuda breve    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Medidas iniciales en píxeles CSS

| Región | Valor inicial | Comportamiento |
|---|---:|---|
| Menú/proyecto | 32 px alto | Acciones secundarias dentro de menú; estado de guardado siempre localizable |
| Barra de herramientas | 36 px alto | Agrupaciones separadas; herramientas no implementadas no se muestran |
| Rail izquierdo | 40 px ancho | Solo herramientas frecuentes, con tooltip y nombre accesible |
| Pestañas del visor | 30 px alto | Cambian vista sin modificar cámara de toma |
| Columna derecha | 320 px ancho | Redimensionable entre 280–400 px cuando hay espacio |
| Árbol de escena | 220 px alto inicial | Divisor con inspector ajustable; lista con scroll propio |
| Transporte | 36 px alto | Rango temporal, play/pausa y duración; sin pistas vacías decorativas |
| Biblioteca inferior | 160 px alto inicial | Colapsable; divisor entre 120–280 px condicionado al alto de ventana |
| Estado técnico | 24 px alto | Datos compactos; detalles extensos en inspector |

Estas son medidas de arranque, ajustables mediante QA. A 1280×720 la biblioteca empieza colapsada si dejarla abierta reduce el visor útil por debajo de 320 px de alto. En ventanas grandes, el visor debe seguir siendo la región dominante.

### Tres espacios de trabajo, con la misma aplicación

- **Planificación:** layout anterior; estado inicial.
- **Composición:** oculta rail y biblioteca, reduce panel derecho y concentra encuadre, focal, apertura y foco. Atajo para maximizar/restaurar visor.
- **Planilla:** lista/miniaturas ocupa el área central y mantiene una previsualización del plano seleccionado; cargar el plano sigue siendo una acción explícita.

Guardar la distribución como preferencia de UI, separada del documento de escena. Incluir «Restablecer distribución». Primera versión con regiones fijas y divisores: no construir un sistema general de ventanas flotantes y docking arbitrario.

## 5. Sistema visual

### Tokens propuestos

| Token | Valor | Uso |
|---|---|---|
| `--studio-bg` | `#202124` | Fondo de aplicación |
| `--studio-panel` | `#2B2D31` | Paneles y barras |
| `--studio-panel-raised` | `#34363B` | Menús y encabezados activos |
| `--studio-input` | `#222428` | Campos editables |
| `--studio-line` | `#45484F` | Separadores de 1 px |
| `--studio-text` | `#E8E9ED` | Texto principal |
| `--studio-muted` | `#B2B5BE` | Texto secundario |
| `--studio-accent` | `#86B8FA` | Herramienta/pestaña activa y foco de teclado |
| `--studio-selection` | `#E9B65C` | Contorno del objeto seleccionado |
| `--studio-focus` | `#8DD6AF` | Indicador de actor/plano de foco |
| `--studio-error` | `#FF9B96` | Error con icono y texto |

Paleta objetivo, no certificación de contraste. Medir combinaciones reales: texto normal al menos 4,5:1 y límites/indicadores esenciales al menos 3:1. El contorno de un actor debe tener halo claro/oscuro para seguir siendo visible sobre escenarios diferentes.

### Tipografía, espaciado y acabado

- Fuente de sistema (`Segoe UI`, Inter si está empaquetada, sans-serif); números con cifras tabulares. Monoespaciada solo para tiempo y lecturas técnicas.
- Texto de controles 12–13 px en densidad compacta; 14 px en cómoda. No copiar el texto diminuto de las capturas de referencia.
- Encabezados de panel de 12–13 px semibold; evitar títulos grandes dentro de cada sección.
- Filas de objetos de 28 px; controles numéricos de 28–30 px; botones de herramientas de 30–32 px. Modo cómodo con objetivos táctiles cercanos a 44 px.
- Escala de separación 4/8/12/16 px. Secciones con encabezado y divisor; evitar tarjetas anidadas.
- Radios 2–4 px en campos y botones, 6 px en menús. Paneles rectangulares sin esquinas flotantes.
- Sin sombras grandes ni desenfoque translúcido permanente. Sombra corta solo en menús/popovers.
- Iconos SVG de 16–18 px, trazos coherentes y color heredado. No emojis como herramientas.
- Transiciones de 100–150 ms para hover/panel; respetar reducción de movimiento. Nada de animar layout mientras se arrastra una entidad.

### Estados obligatorios

Normal, hover, foco visible, activo, deshabilitado con motivo, carga, guardado, error y vacío. Una acción en desarrollo no aparece como botón funcional. La selección se distingue del foco óptico: no usar el mismo color ni cambiar AF por seleccionar una fila.

## 6. Especificación por componente

### Menú y barra de herramientas

Archivo: Nuevo, Abrir, Guardar, Exportar proyecto, Exportar CSV, Capturar imagen. Edición: solo acciones existentes; Deshacer/Rehacer se muestran cuando haya historial real. Vista: layouts, guías, retícula, restablecer distribución. Ayuda: atajos y límites de simulación.

Seleccionar, mover y girar son herramientas sobre entidades. No ofrecer escala libre sobre actores: su altura física se cambia en metros desde atributos. Herramientas X/Y/Z solo si el gesto respeta esa restricción; controles numéricos siempre disponibles. Atajos sugeridos V/W/E para selección/mover/girar y F para encuadrar en la cámara de editor; no activarlos en inputs ni secuestrar atajos esenciales del navegador.

### Árbol de escena

Grupos: Cámara, Actores, Escenario. Luces aparece al tener entidades o presets de iluminación reales. Fila con icono, nombre, color de actor y selección; renombrar con Enter/doble clic. Ocultar/mostrar solo se añade cuando el dato tiene persistencia y efecto en render, mapas y captura.

La escena no es una réplica de un árbol de modelado completo. Props del escenario pueden ser elementos de solo lectura en la primera biblioteca; no sugerir que son editables si no lo son. Buscar por nombre y desplazar al seleccionado.

### Inspector contextual

| Selección | Secciones |
|---|---|
| Cámara | Posición/orientación; sensor/gate; focal/apertura; aspecto/squeeze; foco; movimiento |
| Actor | Nombre; X/Y/Z; altura; giro; pose; apariencia; «Usar como foco» |
| Escenario | Preset; dimensiones compatibles; separación del fondo; variante de iluminación |
| Plano de planilla | Nombre/notas; resumen técnico; Cargar/Duplicar/Eliminar |
| Ninguna | Resumen del proyecto y acciones para añadir actor/elegir escenario |

Labels a la izquierda y valores alineados a la derecha; unidades visibles. Secciones plegables que recuerdan su estado. Más precisión en edición que en lectura si es útil. Inputs inválidos no destruyen el valor anterior. No reconstruir el panel entero cada frame ni perder cursor al actualizar.

### Visor

En Cámara, mostrar el encuadre de salida inscrito y el exterior atenuado. No cambiar el recorte al abrir paneles. En Maqueta, cámara libre del editor independiente de la cámara de toma; órbita, pan y zoom con modo explícito. En Planta/Elevación, ejes, retícula métrica y orientación comprensibles.

En edición: contorno sutil de selección, gizmo y etiqueta breve. En imagen limpia y exportación: ocultar gizmos, retícula, badges y contornos. La retícula de suelo no debe aparecer obligatoriamente en todos los escenarios.

No añadir cuatro visores simultáneos en la primera entrega. Esa opción multiplica el trabajo de render y reduce el área de composición; dejarla como evolución posterior.

### Biblioteca y planilla

Tres pestañas: Planilla, Escenarios, Personajes. Miniaturas sobre fondo neutro y proporción estable; cada preset tiene nombre y contenido real reconocible. La miniatura de un escenario debe provenir del preset implementado, no de una imagen aspiracional inconexa.

Planilla muestra número, nombre, focal, apertura y miniatura respetando su aspecto con `contain`, sin recortar planos verticales o scope. Seleccionar no carga automáticamente. Cargar, duplicar, eliminar y ordenar tienen controles accesibles. Notas completas en inspector, no una gran textarea por tarjeta.

### Transporte

Mantener el tiempo de proyecto, play/pausa y duración ya integrados. Timeline compacto de una sola banda, con marcas útiles. No dibujar curvas, keyframes o pistas de animación sin edición real. El playhead se puede arrastrar y también editar por teclado.

## 7. Responsive y accesibilidad

| Tamaño | Distribución |
|---|---|
| ≥1440 px | Layout completo, panel derecho 320 px y biblioteca inferior |
| 1100–1439 px | Panel derecho 280–300 px; reducir textos de herramientas; biblioteca según alto disponible |
| 768–1099 px | Árbol/atributos en panel conmutado; biblioteca plegada inicialmente; herramientas esenciales visibles |
| <768 px | Visor y panel por turnos, densidad cómoda, biblioteca en hoja inferior; edición básica sin fingir escritorio completo |

Divisores accesibles por teclado y puntero, límites de tamaño, `min-width:0`/`min-height:0` donde corresponda. Panel oculto fuera del orden de Tab. Escape cierra menús y devuelve foco. No usar solo hover o color para explicar una acción. Navegación y edición completas sin arrastrar.

Matriz mínima: 1920×1080, 1440×900, 1280×720, 1024×768, 768×1024 y 390×844; zoom 200% y DPR 1/2 en muestras representativas.

## 8. Cómo mejorar los personajes

### Dirección artística

**Humanos estilizados de previsualización**, de proporciones adultas naturales, rostro simplificado y ropa mate. Deben leerse bien tanto de cuerpo entero como en plano medio/primer plano. Evitar intentar fotorealismo sin modelos, texturas y trabajo artístico adecuados.

Separar identidad del actor (nombre, ID y color de selección) de su apariencia. Su color no tiñe obligatoriamente piel y cuerpo entero. El color sirve para un detalle de vestuario y para overlays de identificación.

### Dos niveles de representación

**Nivel funcional, obligatorio y sin dependencia externa:** maniquí 3D articulado construido con volúmenes suaves: cabeza ovalada con frente/nariz orientables, cuello, tórax, pelvis, brazos, manos, muslos, pantorrillas y pies. Geometría con normales suaves y materiales mate. Evitar el conjunto de cajas actual y muñecos de palitos.

El maniquí es una mejora inmediata y un fallback estable; no se presenta como la calidad final de un personaje detallado. Un conjunto coherente de cápsulas puede ser útil para blocking, pero no reemplaza anatomía diseñada en un primer plano.

**Nivel visual recomendado:** un modelo humano estilizado GLB con rig sencillo, topología y materiales revisados, tres variantes de apariencia y poses compatibles. Integrarlo como recurso local versionado. El agente puede conectar y optimizar el asset; no debe afirmar haber modelado un humano profesional si solo creó primitivas. Si no hay asset adecuado disponible, entregar el maniquí pulido y registrar este nivel como pendiente.

### Requisitos de figura y poses

- Altura real determinada por el parámetro del actor; base en el suelo y escala comprobada con regla de 1 m.
- Articulaciones con pivotes anatómicos aproximados. Pose sentado flexiona caderas/rodillas; no reduce todo el cuerpo a un 65% de altura.
- De pie: contrapeso leve y brazos naturales; sentado: pies en suelo y altura de asiento compatible; caminando: pose estática de paso, sin prometer un ciclo de marcha.
- Giro corporal y dirección visible del rostro coherentes. Posteriormente puede separarse mirada de torso.
- Punto de foco explícito en los ojos/cabeza según pose, común a core y renderer. Los assets no deben cambiarlo silenciosamente.
- Silueta reconocible frontal, perfil y espalda; hombros y manos no penetran torso; pies no flotan.
- Materiales: piel simplificada, cabello como volumen, ropa con rugosidad alta y diferencias de valor moderadas. Sin piel plástica, brillos excesivos ni texturas estiradas.
- Probar las poses a 24/50/85/135 mm, varios ángulos, plano entero, medio y cercano. Un asset que solo funciona de lejos no cumple la meta de encuadre facial.

## 9. Cómo mejorar los escenarios

### Primero tres escenarios completos

| Escenario | Geometría y escala de partida | Iluminación | Utilidad cinematográfica |
|---|---|---|---|
| Estudio / ciclorama | Suelo de 12×12 m, fondo curvo de unos 4 m de alto, banco opcional y carta de escala | Luz principal amplia, relleno suave, separación de fondo | Aprender encuadre, foco y perspectiva con pocas distracciones |
| Interior / cafetería | Habitación aprox. 8×6×3 m, ventana, puerta, mesa de 0,75 m, sillas compatibles con pose sentado y lámparas | Ventana lateral + lámparas cálidas como prácticos | Diálogo de dos actores, primeros planos y profundidad entre mesas/fondo |
| Exterior / calle | Módulos de fachada, acera, esquina, poste y capas de fondo a distancias distintas | Día nublado inicial; variante nocturna después | Separación de planos, escala, entradas/salidas y parallax |

Las dimensiones son parámetros iniciales de arte, no medidas de una locación real. Después pueden añadirse nave/pasillo, bosque y azotea. No volver a ofrecer ocho nombres que dibujan esencialmente la misma escena.

### Receta de calidad por escenario

1. **Volumen:** suelo, paredes/fachadas, vanos y objetos con profundidad real.
2. **Escala:** puertas, mesas y sillas proporcionadas respecto al actor.
3. **Tres capas:** un elemento de primer término, zona de actuación y fondo separado. Cambiar focal/distancia debe revelar parallax coherente.
4. **Materiales:** paleta limitada y superficies distinguibles (pared, suelo, metal, tela, vidrio simplificado). Añadir bevels discretos en bordes importantes.
5. **Luz:** dirección principal reconocible, relleno moderado y sombras de contacto. Un maniquí bien iluminado puede verse mucho mejor que un modelo detallado con luz plana.
6. **Composición inicial:** cámara con horizonte razonable, actor encuadrado y fondo interesante; evitar arrancar dentro de una pared o mirando vacío.
7. **Ayudas separadas:** guías técnicas activables; imagen limpia para revisar y exportar.

Mover la separación de fondo desplaza el grupo designado como fondo; no estira indiscriminadamente puertas/mesas. Cambiar escenario no elimina actores ni cámara: advertir posiciones incompatibles y ofrecer «Encuadrar escena», sin saltos ocultos.

HDRI puede apoyar cielo, reflejos y ambiente, pero no reemplaza paredes u objetos próximos: una imagen de fondo no ofrece geometría ni parallax para blocking. La niebla será opcional y sutil; no usarla para esconder escenarios vacíos.

## 10. Ruta técnica para que el salto visual sea real

### Recomendación

Mantener TypeScript/Vite y adoptar **Three.js con WebGL 2 para Cámara y Maqueta**, conservando Canvas 2D para Planta/Elevación y como modo técnico de respaldo. No introducir React ni un motor de juego completo para este cambio.

Esta es una evolución deliberada del plan anterior, que posponía 3D real. Ahora responde a la solicitud concreta de mejorar personajes y escenarios; sigue siendo una propuesta, no una migración ejecutada. La primera entrega de UI puede completarse con el renderer actual.

Three.js ofrece renderer WebGL 2 y carga glTF mediante GLTFLoader. Consultar APIs de la versión elegida al implementar; fijar versión y lockfile. [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

### Integración sin romper cámara ni proyectos

1. Crear una fachada de viewport con operaciones de montaje, resize, render, picking, captura y dispose. La API actual acepta `CanvasRenderingContext2D`: no sirve como contrato universal de WebGL.
2. Usar superficies separadas para WebGL y Canvas 2D, con tamaño y ciclo de vida estables. No pedir contextos 2D y WebGL sobre el mismo canvas ya inicializado. Reconectar gestos explícitamente a la superficie activa.
3. Core sigue produciendo la cámara evaluada y el gate. El adaptador 3D convierte ejes y matrices: el proyecto mira inicialmente hacia +Z y una cámara Three mira por su -Z local. Probar la conversión, no corregirla a ojo cambiando signos en varias partes.
4. Derivar la proyección desde el gate efectivo y squeeze ya definidos. Evitar aplicar recorte o squeeze dos veces. Comparar puntos de control entre renderer actual, core y nuevo adaptador.
5. Cámara libre de Maqueta es estado de editor, nunca la cámara guardada del plano. Mostrar el frustum de la cámara de toma dentro del set.
6. Extender el modelo de presentación del frame con escenario, referencias de apariencia y luces necesarias. No hacer que cada renderer lea directamente el estado global.
7. Mantener IDs y transformaciones estables por entidad. La escena GPU se actualiza; no reconstruir meshes, materiales y texturas por frame.
8. Planta/Elevación reciben huellas de props/actores desde la misma definición del set. No mostrar un café en el visor y una planta vacía inconexa.
9. Captura renderiza un frame de cámara explícito, con recursos listos y salida de color consistente, a un target de exportación; devuelve Blob. No asumir que la captura 2D existente funcionará sin cambios ni depender de un framebuffer ya descartado.
10. Si WebGL 2 no está disponible o se pierde el contexto, ofrecer modo técnico con aviso y reintento. No dejar un rectángulo negro sin explicación ni tratar el fallback como calidad 3D aprobada.

### Datos y compatibilidad

Separar presets de presentación en un registro con ID/versiones. Añadir al documento solo elecciones del usuario: `characterAssetId`, variante/material, pose, escenario y preset de luz, cuando esos campos se implementen. Elegir versión de esquema y migración explícita; no cambiar a escondidas el formato `schemaVersion: 1`.

Proyectos anteriores asignan maniquí y estudio por defecto. Sus coordenadas, focal, foco, planos y miniaturas permanecen recuperables. Snapshots nuevos guardan referencias suficientes para reconstruir la apariencia y su versión; si un recurso falta, mostrar fallback identificado. Las preferencias de panel y calidad no alteran el plano físico.

## 11. Iluminación, materiales y efectos

Prioridad: forma → luz → materiales → detalle → efectos. Primero aprobar un render sólido nítido; después añadir DoF.

- Luz principal amplia, relleno moderado y separación de fondo por escenario. Sombras suaves de contacto y oclusión real aportan más que bloom intenso.
- Gestión de color explícita entre texturas, cálculos y salida; visor y captura comparten tone mapping. Mantener exposición de previsualización separada del modelo óptico y declarar aproximaciones.
- DoF visual como efecto de profundidad, conectado a distancia axial/apertura con escala calibrada mediante casos de prueba. Etiquetarlo como aproximación de previsualización: no prometer simulación exacta de lentes.
- Nada de aplicar un blur uniforme al canvas para fingir profundidad. La persona enfocada debe permanecer nítida frente al fondo desenfocado.
- No incluir motion blur, refracción compleja, cabello por hebras, subsurface scattering ni ray tracing en esta versión.
- Tres calidades: Técnico (guías y formas simples), Equilibrado (materiales y sombras moderadas), Alto (más resolución de sombras y DoF si el equipo lo soporta). No alterar cámara/gate/posición al cambiar calidad.

## 12. Assets y presupuesto visual

### Estrategia de recursos

Construir estudio y maniquí con geometría local para no bloquear el primer resultado. Para completar apariencia, integrar pocos modelos seleccionados y coherentes en vez de acumular packs distintos. El formato preferido de intercambio es GLB, con texturas compactas y jerarquía comprensible.

El código de Luna puede crear escena, luces, materiales, controles y poses procedurales. Para humanos más convincentes, conviene un asset diseñado por un artista o una biblioteca adecuada; aumentar el esfuerzo de razonamiento no sustituye ese recurso.

Poly Haven es una fuente candidata de materiales, HDRI y props: su página declara los assets bajo CC0. Seleccionar cada recurso por utilidad, tamaño y compatibilidad; no se ha elegido ni descargado ninguno en esta entrega. [Licencia de assets de Poly Haven](https://polyhaven.com/license).

Para personajes, el asset específico queda por seleccionar. Comprobar que su licencia permite distribuirlo dentro de una aplicación web: que se permita usar un modelo en un render no implica necesariamente permiso para entregar su archivo al navegador. No adquirir packs ni usar imágenes adjuntas como texturas del producto.

Al implementar, crear manifest con ID, versión, archivo local, fuente, autor, licencia, atribución si corresponde, escala, triángulos, texturas, rig y poses. No usar hotlinks a assets de terceros ni depender de una cuenta del usuario para abrir una escena guardada.

### Objetivos iniciales, pendientes de medición

| Recurso | Presupuesto de arranque |
|---|---|
| Personaje detallado | 10–25 mil triángulos; LOD menor para actores lejanos |
| Escena completa equilibrada | Aproximadamente hasta 250 mil triángulos visibles con seis actores |
| Texturas | 1K habitual; 2K en protagonistas/superficies que lo requieran; evitar 4K indiscriminado |
| Carga del primer set | Meta ≤10 MB de assets transferidos; resto bajo demanda |
| Sombras | Una luz con sombras principal por defecto, mapa 1024; 2048 en Alto si se sostiene |
| Resolución del visor | DPR limitado inicialmente a 1,5 en Equilibrado; exportación independiente |
| Rendimiento | Meta 30 fps sostenidos en el equipo de referencia y 60 cuando sea viable; medir p95 y memoria |

Presupuestos orientativos, no garantías. Bajar efectos y resolución antes que precisión geométrica. Cargar solo el escenario activo, reutilizar recursos y liberar GPU al reemplazar assets. No renderizar permanentemente una escena estática ni mantener activos visores ocultos.

## 13. Plan secuencial para un único agente

Usar **un chat/agente de implementación con GPT-6 Luna en Alto**, reutilizado por hitos. No hace falta volver a lanzar varios chats en paralelo: layout, renderer y datos tendrán integración estrecha. La selección efectiva del modelo se realiza al lanzar el chat/agente, no mediante este archivo.

| Hito | Trabajo | Puerta de aceptación |
|---|---|---|
| D0 — Baseline | Leer entregas actuales, registrar estado Git y obtener capturas de la app; revisar checks existentes | Identificados cambios ajenos y flujos que deben conservarse; no confundir este plan con funcionalidad actual |
| D1 — Interfaz de editor | Tokens, shell, columna derecha, árbol, inspector, biblioteca, transporte y responsive | Layout funciona con renderer actual; guardar, cargar, capturar, foco y gestos conservados; capturas revisadas |
| D2 — Corte vertical 3D | Fachada de viewport, adaptador de cámara, estudio, un maniquí articulado, luz/sombra y captura | Estudio + personaje útil en Cámara/Maqueta; proyección coincide con core; exportación igual al visor limpio |
| D3 — Personajes | Afinar proporciones/poses, tres variantes y, si hay asset apto, GLB riggeado | Frente/perfil/espalda y planos cercanos legibles; pies apoyados, foco coherente y seis actores operables |
| D4 — Escenarios | Estudio final, interior y calle; biblioteca con miniaturas reales, huellas en mapas | Cada set distinguible, a escala, persistente y útil con 24/50/85 mm |
| D5 — Acabado y cierre | DoF aproximado si cumple rendimiento, calidades, teclado, responsive, migración/recuperación y mediciones | Evidencia visual real, regresiones revisadas y pendientes declarados; ningún fallo crítico de cámara/datos |

En D2, alcanzar primero el corte vertical completo antes de multiplicar assets: un estudio y un personaje bien resueltos deben demostrar el enfoque. D3/D4 no deben convertirse en una reescritura del core óptico.

La salida D1 es una interfaz mejorada; no debe declararse como cierre de la solicitud de escenarios/personajes. Si faltan assets humanos, distinguir «maniquí articulado aprobado» de «personaje detallado pendiente».

### Propiedad de archivos para esta implementación

El agente de diseño asume integración de este encargo porque habrá un único escritor activo. Puede trabajar en UI/estilos y, por hitos, renderer/interacción, contratos, composición, esquema y dependencias necesarias. Esto amplía la antigua propiedad C/F de solo UI para este encargo concreto; no autoriza revertir trabajo ajeno ni editar módulos sin necesidad.

Estructura sugerida, a adaptar sin duplicar módulos que ya existan:

```text
src/styles/studio-tokens.css
src/styles/studio-layout.css
src/ui/studio/                  # shell, árbol, inspector, biblioteca
src/render/viewport-host.ts     # ciclo de vida y selección de superficie
src/render/webgl/              # cámara, escena GPU, materiales, captura
src/scene/presets/              # estudio, interior, calle
src/scene/characters/           # maniquí, rigs y poses
src/assets/catalog.ts          # manifiesto de assets versionados
public/assets/                 # solo recursos seleccionados y distribuibles
tests/render/                  # equivalencia de proyección y captura
tests/project/                 # migración y snapshots visuales
docs/handoffs/DESIGN.md         # resultados reales y límites
```

No mantener dos implementaciones UI activas desconectadas ni una demo bonita separada del producto. No tocar `cine_shot_visualizer_3d_pro.html`.

## 14. Validación visual y funcional

### Capturas obligatorias durante implementación

Guardar antes/después en idéntico tamaño y estado, por hito. D1: layout de planificación, cámara maximizada, inspector y planilla a 1440×900/1280×720. D2: estudio con maniquí, luz y sombras. D3: tres poses y primer plano. D4: los tres escenarios con dos actores. D5: tablet, móvil y modo de calidad reducida.

No aceptar una imagen generada por IA o un mockup estático como prueba de la aplicación. Esta entrega de planificación no contiene esas capturas ni declara QA visual nueva.

### Criterios medibles de cierre

- Cámara y core coinciden al proyectar puntos patrón: centro, bordes, roll y squeeze 1/1,33/2; error objetivo ≤1 píxel en una salida de prueba fija.
- Abrir/cerrar o redimensionar paneles conserva coordenadas normalizadas del encuadre.
- Personajes reconocibles y poses distintas a escala; sin pies flotantes o deformación por aspecto/squeeze.
- Escenarios con geometría y parallax real, sombras de contacto y actor separado del fondo.
- Punto de foco visible/numérico coincide con el punto declarado por la pose; no se recupera el error de distancia de UI.
- Cambiar calidad o maximizar visor no cambia el proyecto ni sus magnitudes físicas.
- Capturar desde cualquier vista genera la cámara de toma; recargar/importar conserva escenario, apariencia, pose, cámara y planos.
- Assets cargando/fallidos y WebGL no disponible tienen estados recuperables; captura espera recursos requeridos o explica el error.
- Árbol, controles, biblioteca y divisores funcionan por teclado; foco visible y sin acciones esenciales recortadas en tamaños objetivo.
- Tests, tipos y build pertinentes pasan; medir FPS/p95 y memoria con seis actores y un escenario, sin inventar resultados de GPU a partir de mocks.
- Revisar regresiones de los casos relevantes de `docs/VALIDACION.md`; no dar por cerradas las brechas anteriores solo porque cambió el aspecto.

## 15. Prompt para el nuevo agente

Selecciona GPT-6 Luna y razonamiento Alto, y copia:

> Implementa el plan de `desing.md` para CineOptics. Lee primero AGENTS.md, README.md y los handoffs actuales A/G. Este encargo incorpora diseño de editor inspirado en las referencias de Cinema 4D/Adobe y mejora real de personajes/escenarios; no es solo recolorear la interfaz.
>
> Trabaja como único agente e integrador del encargo, por hitos D0–D5. No lances otros agentes. Conserva cambios ajenos, el HTML original, core óptico y flujos de captura/guardado integrados. Documenta el baseline y sigue las puertas de aceptación; no declares terminados hitos que no verificaste.
>
> Primero implementa D1 sobre el renderer existente: superficies grises neutras, barras compactas, visor protagonista, árbol/inspector a la derecha, biblioteca/planilla abajo y transporte funcional. Mantén los controles conectados al proyecto real; no dejes menús decorativos ni una maqueta separada.
>
> Después implementa D2 como un corte vertical completo: Three.js/WebGL 2 para Cámara/Maqueta, adaptador de cámara que preserve gate/squeeze y core, superficies Canvas separadas para vistas técnicas, estudio con geometría, maniquí articulado, luz/sombra y exportación consistente. Actualiza contratos y composición lo necesario, con pruebas de proyección y persistencia; no reescribas toda la app.
>
> Continúa con personajes, tres escenarios y acabado según D3–D5. Usa primero geometría local bien resuelta. Si integras assets, registra fuente/licencia/versión, escala y tamaño; no compres ni dependas de servicios externos. Un humano detallado requiere un asset adecuado: si falta, declara ese nivel pendiente y conserva un maniquí útil, sin presentarlo como modelado profesional.
>
> Prueba la aplicación real en navegador y captura evidencia antes/después. Verifica escritorio/tablet/móvil, teclado, seis actores, proyección/foco, snapshots, importación y recuperación. Mide rendimiento real. Si una capacidad del entorno impide una prueba, registra exactamente qué falta y continúa el trabajo independiente posible.
>
> Entrega `docs/handoffs/DESIGN.md` con hitos completados, archivos, pruebas, capturas, recursos y pendientes. No publiques ni despliegues. No consideres toda la solicitud terminada al completar solo CSS o D1.

## 16. Respuesta directa sobre personajes y escenarios

Sí se pueden mejorar mucho. Actualmente el problema está en la representación: los personajes son prismas y el entorno del visor es mínimo. La mejor inversión es **geometría 3D coherente, personajes articulados, escenarios a escala y buena iluminación**, conservando la cámara técnica que ya existe.

La ruta recomendada es interfaz de editor → estudio + maniquí 3D bien iluminado → humano estilizado con asset adecuado → tres escenarios completos. Luna puede hacer la programación y una base procedural útil; la calidad de un humano detallado depende también del modelo artístico. Un fondo generado como imagen puede servir de inspiración o paisaje lejano, pero no sustituye el set 3D cuando necesitas mover la cámara y entender el blocking.
