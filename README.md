# CineOptics Studio

Herramienta de previsualización de planos, óptica y blocking para dirección, dirección de fotografía y asistentes de cámara con conocimientos técnicos.

## Demo en vivo

Cuando termine el primer despliegue de GitHub Pages, la aplicación estará disponible en [panchogh.github.io/Cine](https://panchogh.github.io/Cine/). Cada cambio en `main` vuelve a publicar el sitio automáticamente.

## Estado

El proyecto contiene un prototipo autónomo: [cine_shot_visualizer_3d_pro.html](cine_shot_visualizer_3d_pro.html). Incluye HTML, CSS y JavaScript en un único archivo, con dos Canvas 2D y proyecciones calculadas a mano. El nombre «3D» describe las vistas y coordenadas; actualmente no hay un motor de geometría 3D ni WebGL.

La integración E/F conecta renderer, gestos, scheduler, reproducción, controles de posición, captura, snapshots y guardado manual/autosave. G-001 a G-004 tienen correcciones implementadas. La revisión focalizada en Chrome cubrió Órbita, Handheld, edición de texto literal, exportación/importación local de dos planos, Escape y navegación Tab/Shift+Tab. Hay captura/restauración y persistencia local en browser smoke previo. La matriz completa visual, almacenamiento fallido, responsive, lector de pantalla y métricas de runtime permanecen pendientes. Rack focus se aplaza como P2 porque aún requiere contrato temporal y persistencia propios. El renderer 3D usa Three.js de forma asíncrona; el HTML original permanece intacto como referencia.

## Entrada modular (integración E/F)

Requisitos: Node.js 20.19 o superior y npm. Las versiones exactas y dependencias transitivas están registradas en `package-lock.json`.

```powershell
npm ci
npm run dev
npm run build
npm run typecheck
npm test
```

La entrada es `index.html`. Las vistas Cámara, Planta, Maqueta y Elevación comparten la cámara evaluada del instante. La UI integra edición X/Y/Z de actor seleccionado, drag en Planta, selección, modos de movimiento y reproducción, foco alineado con el core, Nuevo proyecto, captura, snapshots y guardado local. Para comparar el comportamiento legado durante la migración, abrir la referencia original.

Los checks automáticos y el recorrido real limitado de Chrome se registran en [handoff A](docs/handoffs/A.md). La revisión de navegador es smoke QA y no equivale a completar la matriz de [validación](docs/VALIDACION.md).

## Abrir el prototipo

Abrir `cine_shot_visualizer_3d_pro.html` en un navegador de escritorio actualizado. El archivo no carga librerías, fuentes ni recursos externos. No requiere instalación ni servidor para su funcionamiento actual.

Flujo disponible: elegir un preset de plano, ajustar lente y foco, colocar personajes con los controles, alternar entre visor/planta/maqueta/elevación y capturar un plano en la planilla. La rueda cambia la focal; arrastrar el visor cambia orientación y arrastrar la maqueta cambia su órbita.

La planilla existe **solo en memoria** y se pierde al recargar. Su CSV contiene un resumen técnico; no permite reconstruir el proyecto. Hay errores conocidos de cámara, sincronización y controles sin efecto visual: consultar la auditoría antes de interpretar las lecturas como referencia técnica.

## Documentación para continuar

| Documento | Para qué sirve |
|---|---|
| [PLAN_MEJORA.md](PLAN_MEJORA.md) | Fases, prioridades, dependencias y cantidad de chats |
| [docs/AUDITORIA.md](docs/AUDITORIA.md) | Hallazgos con ubicación, impacto y forma de verificarlos |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Estructura propuesta, contratos, unidades y responsables |
| [docs/DISENO_UX.md](docs/DISENO_UX.md) | Dirección visual y comportamiento de la interfaz |
| [docs/VALIDACION.md](docs/VALIDACION.md) | Pruebas y criterios de cierre |
| [docs/PROMPTS_CHATS.md](docs/PROMPTS_CHATS.md) | Instrucciones listas para copiar a otros chats |
| [AGENTS.md](AGENTS.md) | Reglas compartidas para quienes implementen |

La integración E/F y los contratos para los siguientes módulos están documentados en [docs/handoffs/A.md](docs/handoffs/A.md). Las correcciones G-001–G-004 están integradas y recorridas parcialmente en Chrome; la puerta visual completa sigue abierta.

## Reproducir el diagnóstico

Con Node.js instalado, desde esta carpeta:

```powershell
node tools/audit-baseline.cjs
```

El script lee el HTML sin modificarlo, compila su JavaScript y ejecuta escenarios con dobles mínimos de DOM y Canvas. Los resultados de esta revisión están en [docs-audit-results.json](docs-audit-results.json). Es un diagnóstico del legado, no una suite de aceptación de la futura aplicación. No mide FPS ni demuestra cómo se ve la pantalla.

El diagnóstico del legado no mide rendimiento ni sustituye la aceptación de la app nueva. El smoke QA y la cobertura que aún falta se registran en la matriz y en el handoff A.

## Objetivo de la siguiente versión

El objetivo es un flujo claro de escena → cámara → encuadre/foco → captura → planilla, con cámara coherente en todas las vistas, controles confiables, proyectos recuperables y una interfaz sobria. La entrada modular ya usa TypeScript, módulos y Vite con Canvas 2D; no incluye backend ni motor 3D nuevo.

No se ha definido licencia de distribución. No se presupone una licencia open source.
