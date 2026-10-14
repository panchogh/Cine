# Encargos listos para otros chats

Elegir el modelo en el selector de cada chat; estos textos no cambian por sí solos el modelo. A completó la fase 1; leer [handoff A](handoffs/A.md) y confirmar sus límites antes de empezar B/C/D. Para aislamiento real, usar worktrees desde el commit base después de revisar el estado Git local.

Los prompts autorizan únicamente el encargo descrito. No piden publicar, crear cuentas ni iniciar más agentes.

## A — Base, contratos e integración

Copiar al primer chat:

```text
Trabaja como integrador de CineOptics. Lee AGENTS.md, README.md,
PLAN_MEJORA.md, docs/ARQUITECTURA.md y docs/AUDITORIA.md.
Implementa solo la fase 1: base modular TypeScript + Vite, sin backend,
conservando cine_shot_visualizer_3d_pro.html intacto como referencia.

Antes de modificar, comprueba si hay Git en esta carpeta o en sus padres.
Si falta, prepara un repositorio local y un baseline del proyecto para
poder aislar trabajo posterior; no publiques ni añadas remotos. Conserva
cualquier configuración existente y evita incluir dependencias generadas.

Crea la entrada nueva, módulos/adaptadores mínimos, tipos compartidos,
store, acciones, IDs estables, defaults, restricciones y fixtures.
Separa ProjectDocument, UIState y RuntimeState. Fija unidades, gate,
cámara evaluada por instante y APIs de render/captura/persistencia.
Extrae incrementalmente las cuatro vistas y controles existentes;
no intentes resolver a la vez toda la auditoría ni cambiar a un motor 3D.

Eres propietario de configuración, dependencias, contratos, state, data,
main.ts e index.html. Deja módulos que B/C/D puedan implementar de forma
independiente y comandos reproducibles de desarrollo, build, tipos y tests.
No declares correcciones que solo estén en un adaptador pendiente.

Verifica la puerta de fase 1 de docs/VALIDACION.md y actualiza los documentos
para reflejar lo implementado. Entrega docs/handoffs/A.md con archivos,
pruebas reales, fallos conocidos, commit base si existe y firmas definitivas.
Detente al terminar fase 1. No lances otros chats ni subagentes.
```

## B — Cámara y óptica

Lanzar después de A, en paralelo con C/D:

```text
Implementa el encargo B de CineOptics, usando GPT-6 Luna Alto seleccionado
en este chat. Lee AGENTS.md, el plan, arquitectura, auditoría, validación
y docs/handoffs/A.md. Confirma que fase 1 está integrada; si faltan sus
contratos, informa el faltante concreto sin empezar otra arquitectura.

Tu propiedad es src/core/ y tests/core/. Corrige A01–A05, A13–A15 y A20
en la lógica que corresponde al core: pose/órbita, gate efectivo, FOV,
proyección, foco axial, DoF, cámara animada evaluada, presets al actor
seleccionado y compensación de encuadre con límites explícitos.

Funciones puras, unidades explícitas, f-number separado de T y supuestos
documentados. Usa fixtures ópticos derivados independientemente, no una
copia de la función bajo prueba. Implementa V01–V09 y casos extremos.
No edites UI, renderer, configuración ni contratos compartidos. Si un
contrato necesita ajuste, entrega firma y justificación al integrador.

Entrega docs/handoffs/B.md con pruebas ejecutadas, tolerancias, fuentes
técnicas consultadas, limitaciones y commits si hay worktree. No lances
otros agentes ni avances a E hasta la integración 2.5.
```

## C — Interfaz y diseño

Lanzar después de A, en paralelo con B/D:

```text
Implementa C de CineOptics. Lee AGENTS.md, docs/handoffs/A.md,
docs/DISENO_UX.md, arquitectura y validación. Trabaja solo en src/ui/,
src/styles/ y tests/ui/. Usa los contratos y fixtures de fase 1.

Construye la interfaz sobria del brief: visor protagonista, cabecera corta,
panel contextual, vistas con nombres breves y controles precisos. Evita
duplicar telemetría. Haz que todos los controles deriven del estado al
cargar un plano, con labels, foco visible y estados de toggles correctos.
Corrige los aspectos de A06, A17, A21 y A22 que corresponden a UI.

No implementes óptica, persistencia ni una copia del renderer. Consume
las APIs acordadas; usa adaptadores/fixtures existentes si B/D aún trabajan.
No edites main.ts, contratos, lockfile ni configuración. Propón al integrador
los cambios compartidos que sean necesarios.

Verifica layout real si tienes navegador, teclado y restauración de
controles; si no puedes, distingue lo pendiente de lo validado. Entrega
docs/handoffs/C.md con evidencia, archivos y pruebas. No inicies F ni otros
agentes antes de integrar la fase 2.5.
```

## D — Proyectos y planilla

Lanzar después de A, en paralelo con B/C:

```text
Implementa D de CineOptics. Lee AGENTS.md, docs/handoffs/A.md, arquitectura,
auditoría y validación. Tu propiedad: src/project/, src/shotlist/ y
tests/project/. No construyas paneles ni modifiques el renderer.

Implementa snapshots independientes, catálogo de planos con IDs, duplicar,
eliminar y ordenar; proyecto versionado con guardado local y recuperación;
importación/exportación portable y CSV robusto. Recibe miniaturas Blob a
través del contrato, sin leer mainCanvas ni copiar toda la planilla.

Valida entradas antes de reemplazar el proyecto; maneja cuota, corrupción,
referencias inválidas y versiones no soportadas. Separa texto literal del
escape CSV y conserva la última versión válida. Define cuándo un guardado
está confirmado. Resuelve la parte de A08, A16 y A24 de tu módulo.

Prueba V21–V26 y contrato de captura/restauración con fixtures; declara lo
que requiere navegador real. No edites contratos, UI, main.ts ni configuración.
Entrega docs/handoffs/D.md con pruebas reales, esquema, comportamiento de
errores y propuestas de integración. No lances otros agentes.
```

## Volver a A — Integración 2.5

```text
Integra la fase 2 de CineOptics a partir de docs/handoffs/B.md, C.md y D.md.
Confirma que los trabajadores terminaron. Con worktrees, revisa e integra
sus commits concretos; en carpeta compartida, revisa el conjunto actual
sin revertir cambios ajenos. Orden lógico: core B, datos D, UI C.

Conecta las APIs, resuelve contratos y ejecuta build, tipos y tests relevantes.
Verifica acciones de eliminar actor, restaurar cámara y cargar snapshot.
No cierres 2.5 si existen incompatibilidades entre módulos. Publica las APIs
definitivas de render/gestos/captura para E y F y actualiza handoff A.
No lances automáticamente E/F: entrega el punto de partida integrado.
```

## E — Render y blocking

Reutilizar B después de integración 2.5:

```text
Implementa E de CineOptics sobre el estado integrado de fase 2.5. Relee
AGENTS.md, handoff A actualizado, B y docs/VALIDACION.md. Tu propiedad es
src/render/, src/interaction/ y tests/render/.

Haz que cámara, planta, maqueta, elevación, picking y captura consuman la
misma cámara evaluada y gate. Corrige A04/A05/A14/A16/A18 en representación,
implementa planta editable (A12), Pointer Events y selección con roll/DPR.
Usa geometría coherente para actores y un scheduler bajo demanda.

Implementa ND como atenuación relativa aproximada y grano reproducible;
no afirmes que existe motion blur. El frame exportado debe ser de cámara,
independiente de vista/panel, con snapshot y miniatura del mismo instante.
Optimiza A23 con mediciones; no migres a WebGL ni inventes fórmulas ópticas.

Trabaja en paralelo con F, que es dueño de la UI. No edites sus archivos,
core ni contratos compartidos. Verifica V13–V19 y coherencia visual real.
Entrega docs/handoffs/E.md con capturas si fue posible, pruebas, mediciones
y límites. No lances agentes adicionales.
```

## F — Flujos y pulido final de interfaz

Reutilizar C después de integración 2.5, en paralelo con E:

```text
Implementa F de CineOptics sobre fase 2.5 integrada. Lee AGENTS.md, handoffs
A/C/D actualizados, diseño UX y validación. E trabaja en render y gestos;
tú posees src/ui/, src/styles/ y tests/ui/.

Completa guardar/abrir, feedback de guardado y errores, notas, cargar plano,
duplicar/borrar/ordenar, exportar y estados vacíos. Conecta servicios D y
APIs de render/captura acordadas sin modificar sus implementaciones.
Completa restauración total de controles, reset con alcance claro, nombres
como texto literal, atajos que respeten edición y etiquetas honestas de A19.

Verifica responsive, teclado, foco, jerarquía y legibilidad según el brief.
No añadas nuevas funciones fuera de versión 1 ni cálculos físicos en UI.
No toques core, contratos, renderer, configuración ni lockfile. Registra
solicitudes de integración concretas para A.

Entrega docs/handoffs/F.md con los escenarios verificados, capturas si hay
navegador, archivos y límites. No confundas pruebas con fixtures con un
flujo real integrado. No lances otros agentes.
```

## G — Validación final

Reutilizar D o abrir un chat revisor tras integrar E/F:

```text
Revisa CineOptics como G después de integrar E/F. Lee AGENTS.md, plan,
auditoría, validación y handoffs. Tu propiedad son tests/e2e/ y
docs/handoffs/G.md; no edites código de implementación en paralelo con A.

Ejecuta escenarios relevantes V01–V26, verifica UI en las resoluciones del
brief, teclado, captura/restauración, recuperación y exportación. Mide
rendimiento con equipo/navegador/resolución documentados. Prioriza errores
que cambian encuadre, foco o datos y regresiones de funciones existentes.

Cada fallo debe incluir pasos, esperado/observado, evidencia y prioridad.
No declares aprobado lo no ejecutado. Si falta navegador, identifica la
limitación y completa las pruebas independientes. No afirmes cierre de
producto mientras quede QA obligatoria sin evidencia.

Entrega informe final y dictamen por puerta de aceptación. A asignará las
correcciones a sus dueños; verifica después solo cambios afectados y riesgos
pendientes. No lances otros agentes ni cambies dependencias globales.
```

## Plantilla de entrega común

```text
Rol / fase:
Estado de puerta de aceptación:
Commit base y entregas (si aplica):
Archivos propios modificados:
Comportamiento implementado:
Contratos consumidos / cambios compartidos propuestos:
Pruebas ejecutadas y resultados:
Evidencia visual o de rendimiento (si existe):
Pendientes y limitaciones:
Siguiente rol habilitado:
```
