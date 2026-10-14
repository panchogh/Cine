# Handoff B — óptica y cámara

## Estado de entrega

**Implementación matemática B lista para integración 2.5; integración con `deriveFrame` pendiente.** La fase 1 está integrada en el checkout: el handoff A registra los commits `ca5cceb` y `d1accdd`, tres pruebas de contrato, typecheck y build aprobados. La verificación HTTP quedó parcial por la restricción de sockets local, como declara A. El commit base visible al comenzar este trabajo era `3f05106` (`docs: record phase-one handoff commit`). No se creó commit ni worktree para B.

## Archivos de propiedad B

- `src/core/geometry.ts`: base de cámara, órbita, gate efectivo, FOV, proyección con squeeze/roll y foco axial.
- `src/core/optics.ts`: DoF thin-lens, pupil entrance y resolución actor/manual de foco.
- `src/core/camera.ts`: muestreo temporal de movimientos, presets por ID y compensación de encuadre con límites obligatorios.
- `src/core/index.ts`: exports del core.
- `tests/core/optics-camera.test.ts`: fixtures de aceptación para V01–V09.

No se editaron contratos, estado, UI, renderer ni configuración. Mientras avanzaba el trabajo aparecieron en el árbol otros archivos sin seguimiento y una eliminación fuera de esta propiedad (`src/project/`, `src/shotlist/`, `src/ui/`, `tests/project/`, `tests/ui/` y `src/project/repository.ts`); no se inspeccionaron ni modificaron como parte de B.

## Contratos comprobados y faltantes concretos

Los tipos básicos de fase 1 están presentes (`ProjectDocument`, `CameraDocument`, `EvaluatedCamera`, `FrameGate`, `FrameModel`, `FrameActor`) y permiten escribir cálculo puro sin iniciar otra arquitectura. Faltan datos para que esos contratos conecten el resultado a toda la aplicación:

1. `CameraDocument.motion` solo guarda `{ kind, durationS }`. No serializa recorrido de push-in, objetivo/ángulo de órbita ni amplitud/frecuencia/fase de handheld. El evaluator requiere que esos parámetros sean explícitos. Para órbita de navegación persistente también falta `orbitTargetM`/modo de cámara; yaw solo no identifica una órbita.
2. `EvaluatedCamera` no incluye `fNumber`, squeeze, distancias axial y de cinta separadas, ni avisos. `FrameModel` no publica métricas de FOV/DoF o advertencias derivadas. El `deriveFrame` de fase 1 sigue llamando al evaluator estático de `src/render/frame.ts` y al gate provisional.
3. `FrameActor` elimina `pose` y `yawDeg`. Los mapas que necesiten aplicar la misma pose/ejes y el punto de foco pose-aware no pueden recibir esos datos desde el `FrameModel`.
4. `deriveFrameGate` compartido recibe el proyecto entero; el core expone cálculo sobre `{ sensorGateMm, outputAspect, squeeze }`, lo que permite un adaptador sin acoplar geometría a UI ni viewport.

Propuesta para integración A (solo firma, no cambio aplicado):

```ts
type CameraMotion =
  | { kind: 'static'; durationS: number }
  | { kind: 'push_in'; durationS: number; travelM: number }
  | { kind: 'orbit'; durationS: number; targetM: Vec3; totalAngleDeg: number }
  | { kind: 'handheld'; durationS: number; translationM: number; rotationDeg: number; frequencyHz: number; phaseRad: number };

type CameraEvaluation = { camera: EvaluatedCamera; warning?: string };
evaluateCamera(project: ProjectDocument, timeSeconds: number): CameraEvaluation
deriveFrameGate(camera: Pick<CameraDocument, 'sensorGateMm' | 'outputAspect' | 'squeeze'>): FrameGate
projectPoint(worldPointM: Vec3, camera: EvaluatedCamera, gate: FrameGate, viewport: { widthPx: number; heightPx: number }): ProjectedPoint | null
computeOptics(camera: CameraDocument, gate: FrameGate, focus: FocusResult): { fov: FieldOfView; dof: DepthOfField }
```

Para esa adaptación, enriquecer `EvaluatedCamera` con `fNumber`, `squeeze`, foco axial/cinta/objetivo, y `FrameModel` con métricas y `warnings`; enriquecer `FrameActor` con `pose` y `yawDeg`. A debe decidir el cambio de contrato y conectarlo durante 2.5. `shotPreset(project, selectedActorId, kind, secondActorId?)` devuelve un plan de cámara/IDs; la UI/store debe despachar el patch y marcar el encuadre como personalizado si luego cambia.

## Supuestos y convenciones

- Ejes: X derecha, Y arriba, Z hacia fondo; yaw 0 mira +Z, yaw positivo gira hacia +X; pitch positivo mira arriba. Los ángulos de entrada/salida son grados y se convierten explícitamente a radianes.
- Escena en metros; gate, focal, círculo de confusión en milímetros; viewport en píxeles CSS. Proyección pinhole, frame centrado que contiene el aspecto de salida y crop efectivo inscrito centrado.
- Squeeze horizontal: la relación del gate de salida es `widthMm × squeeze / heightMm`; la proyección aplica squeeze a X. No se simulan distorsión, breathing, pupil magnification, aberraciones, viñeta ni calibración de un lente real.
- Punto de foco actor aproximado por altura: de pie/caminando al 90% de la altura; sentado al 55%. No es un modelo anatómico ni metadato de pose de animación.
- La DoF usa fórmula thin-lens geométrica para el plano axial. `H = f²/(N·c)+f`; `Dnear = H·s/(H+s−2f)` y `Dfar = H·s/(H−s)`, con todas las magnitudes convertidas a mm antes de operar. Infinity empieza en `s >= H`. Es una aproximación para lente delgada, no una promesa de nitidez percibida.
- `fNumber` gobierna pupila/DoF (`D = f/N`). No existe T-stop en el cálculo y nunca se asume transmisión.
- Los presets son aproximaciones de encuadre basadas en fracción de gate; el two-shot calcula con altura y separación horizontal aproximadas. No clasifican automáticamente el encuadre real.
- Los movimientos necesitan amplitud explícita. Si faltan datos, la evaluación conserva la pose base y devuelve aviso. Push-in interpola suave de base a recorrido durante `durationS`; órbita interpola yaw en grados alrededor de `targetM` con radio derivado de la pose base; handheld usa senos deterministas. Valores no serializados quedan como parámetros de la llamada hasta que A ajuste el contrato.
- La compensación conserva tamaño proyectado axial con la razón de focales. Los límites mínimo/máximo de distancia son argumentos obligatorios; al alcanzarlos devuelve saturación y aviso visible.

## Pruebas y tolerancias

Comandos ejecutados:

- `npm test -- --run tests/core/optics-camera.test.ts` — 9/9 aprobados.
- `npm test` — 20/20 aprobados en 4 archivos.
- `npx tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --lib ES2022,DOM,DOM.Iterable --skipLibCheck --moduleResolution Bundler --allowImportingTsExtensions --verbatimModuleSyntax --strict --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch src/core/geometry.ts src/core/optics.ts src/core/camera.ts src/core/index.ts tests/core/optics-camera.test.ts` — aprobado para los archivos propios de B.
- `npm run typecheck` — falla fuera de B: `src/project/schema.ts:50` trata `cameraPosition` (tipo `unknown`) como objeto; `src/ui/workspace.ts:165` declara `focusText` sin usar. En esta ejecución no hubo errores de tipos en `src/core/` ni `tests/core/`.
- `npm run build` — bloqueado en el typecheck por los dos errores anteriores; Vite no llegó a compilar el bundle.

Tolerancias automáticas B: FOV validado a 0,001°; DoF a 1e-8 m usando fixture numérico independiente; invariancia normalizada de proyección a 1e-10; radio/orbita y compensación a 1e-12. V03 de navegador (1 px), inspección visual, accesibilidad y rendimiento no se ejecutaron.

Fixtures independientes: V01 se deriva del modelo rectilíneo `FOV = 2 atan(tamañoSensor/(2·f))`; V06 usa el caso 50 mm, f/2.8, CoC 0,03 mm y foco 3 m resuelto aparte con fórmulas thin-lens, esperado H=29,8119047619 m, cerca=2,73404177888 m y lejos=3,33567178759 m. No se genera el esperado invocando la función de prueba. DoF acepta el rango central declarado por `LIMITS` sin clamps; valores fuera del rango lanzan `RangeError` explícito para que la capa de integración lo presente como aviso.

## Fuentes técnicas consultadas

- Carl Zeiss, [Depth of Field and Bokeh](https://lenspire.zeiss.com/photo/app/uploads/2022/02/technical-article-depth-of-field-and-bokeh.pdf): pupila de entrada `f/N`, interpretación de hiperfocal, CoC y límites de la idealización geométrica (aberraciones/difracción fuera del modelo).
- ARRI, [Why 6:5? I thought you needed 4:3 for anamorphic?](https://www.arri.com/en/learn/camera-systems/frequently-asked-questions/alexa-sxt-faq/why-6-5-i-thought-you-needed-4-3-for-anamorphic--41676): relación entre squeeze 2×, área de sensor y aspecto descomprimido.
- Canon, [Focal length and field of view](https://files.canon-europe.com/files/webcontent/rf-lens-world/knowledge/focus/index.html): relación cualitativa de focal y campo de visión. La expresión rectilínea usada para FOV se validó además por fixture matemático.

## Puerta / siguiente paso

Las funciones y pruebas de B están listas para que A integre en 2.5. La puerta integrada de fase 2 sigue pendiente hasta que A actualice las firmas/tipos que elija y conecte `deriveFrame`/las vistas al mismo `CameraEvaluation` y gate; este handoff no habilita E todavía. El build/tipos global también necesita resolver el fallo ajeno registrado arriba.
