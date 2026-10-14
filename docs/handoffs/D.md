# Handoff D — proyectos y planilla

## Estado de la puerta

Implementación de D entregada en el área de propiedad. V21–V26 pasan en fixtures Vitest. El guardado IndexedDB y el flujo visual integrado aún requieren verificación en navegador real. No se declara cerrada la puerta de fase 2 hasta integrar los contratos con A/C y completar esa comprobación.

## Archivos propios

- `src/project/repository.ts`: conserva el import path de fase 1 y publica el repositorio implementado.
- `src/project/storage.ts`: IndexedDB atómico, base de recuperación, validación en escritura/lectura, carga de assets, errores tipados y base en memoria para fixtures.
- `src/project/schema.ts`: snapshot independiente y validación del proyecto, IDs, rangos, referencias y versión.
- `src/project/portable.ts`: envoltorio JSON portable versión 1, miniaturas Base64 y validación completa antes de devolver el candidato importado.
- `src/shotlist/catalog.ts`: captura, restauración, duplicado, borrado, orden y texto de plano; validación de Blob y extensión independiente.
- `src/shotlist/csv.ts`: CSV RFC 4180, parser, representación de texto literal, protección de fórmulas y gestión de object URL.
- `tests/project/project.test.ts`: seis pruebas agrupadas para V21–V26 y captura/restauración.

No se modificaron contratos, UI, `main.ts`, renderer, configuración ni dependencias. `docs/handoffs/D.md` es la entrega del rol.

## Esquema y comportamiento

El documento mantiene `ProjectDocument.schemaVersion: 1`. Cada plano nuevo amplía `ShotSnapshot` con `snapshotVersion: 1`, escena propia, cámara, look y `thumbnailId`; no guarda la lista de planos dentro de sí mismo. Cada captura clona escena/look y usa el estado de cámara que recibe. Restaurar repone escena, cámara y look y conserva identidad y catálogo actuales. Los planos fase 1 sin escena independiente se pueden conservar/exportar, pero `restoreShot` los rechaza porque no permiten una restauración fiel.

IndexedDB guarda proyecto y assets en una transacción `readwrite`; conserva una copia válida anterior en el mismo commit. `save()` confirma únicamente al resolverse luego de `transaction.oncomplete`. Una cuota, aborto o error de almacenamiento rechaza el guardado; no se emite `savedAt` y la transacción anterior permanece válida. `loadWithAssets()` informa si recurrió a la copia previa. `saveWithAssets()` acepta el mapa de Blob; ediciones sin cambios de miniatura reutilizan sus assets. Al guardar se eliminan de la colección los assets sin referencias. Los assets faltantes impiden confirmar.

El sobre portable es `{ format: "cineoptics-project", formatVersion: 1, project, thumbnails }`. Se rechazan JSON truncado, versión futura, versión de esquema no admitida, campos/rangos/referencias inválidos, assets Base64 corruptos o faltantes y entradas mayores a 64 MiB. La importación produce un candidato validado y assets; el integrador debe reemplazar estado solo después de que la promesa termine correctamente.

CSV guarda los nombres/notas originales sin mutarlos. Solo su representación exportada antepone apóstrofo a texto que podría iniciar fórmula; cada campo se entrecomilla y duplica comillas. `createObjectUrlLease()` revoca la URL anterior al generar una nueva y al disponer el lease. No se construyen URLs dentro de exportShotCsv.

## Errores y decisiones

- `ProjectStorageError.code`: `unavailable`, `quota`, `corrupt`, `invalid`, `missing-asset` o `unknown`.
- Si el proyecto actual es inválido, se intenta la última copia válida de IndexedDB; si ambas fallan, se informa corrupción sin sustituir el proyecto en memoria.
- El repositorio no usa `localStorage`: IndexedDB almacena proyecto/Blob sin serializar miniaturas en cada plano. No se implementó temporizador de autosave; `save` es la primitiva confirmable que UI/F debe programar y anunciar.
- Límite de thumbnail: 2 MiB y 1280×720 px. `captureShot` verifica tamaño/tipo; el borde de navegador debe llamar `validateThumbnailBlob` para decodificar y verificar resolución, y comunicar el rechazo.
- Exportación portable requiere cada miniatura referenciada. No se descartan assets silenciosamente para “hacer pasar” la exportación.
- La neutralización CSV evita fórmulas en lectores comunes, pero la prueba de abrir el archivo en una aplicación de planillas concreta requiere entorno de escritorio.

## Pruebas ejecutadas

- `npm test -- --reporter=verbose`: 20 tests aprobados en 4 archivos, incluidos los 6 casos D V21–V26, core y estado/UI que estaban presentes al ejecutar.
- V21: round-trip de seis actores, tres capturas, IDs, orden, notas multilínea y miniatura Blob.
- V22: lectura tras guardado, recuperación de versión anterior, cuota simulada y última versión intacta.
- V23: truncamiento, versión futura, referencia inexistente, NaN, valor fuera de rango y error de almacenamiento simulado.
- V24: comas, comillas, saltos, tildes, prefijo de fórmula, parser CSV y texto fuente intacto.
- V25: captura sin alias de escena, IDs nuevos al duplicar, restauración y poda de miniatura sin uso.
- V26: límite de bytes/resolución con decodificador simulado, miniatura requerida al exportar y revocación de object URLs.
- `npx tsc --ignoreConfig --noEmit --strict --noUnusedLocals --noUnusedParameters --target ES2022 --module ESNext --lib ES2022,DOM,DOM.Iterable --moduleResolution Bundler --skipLibCheck` sobre módulos y tests D: aprobado.
- `npm run typecheck`: aprobado en el árbol compartido final. Errores transitorios reportados durante cambios concurrentes en core/UI se resolvieron fuera de D y no fueron editados aquí.
- `npm run build`: aprobado; Vite 8.3.4 generó `dist/`.
- `git diff --check`: aprobado.
- No se ejecutó IndexedDB real, navegación, recarga real, aplicación de planillas ni prueba visual. No se declara validación de navegador.

## Propuestas concretas para integración A/F

1. Extender `ProjectRepository.save(project, assets?)` o consumir `saveWithAssets(project, assets)`; para restaurar tras recarga consumir `loadWithAssets(id)` y exponer su indicador `recovered`.
2. Después de una captura, convertir la cámara evaluada del mismo instante a `CameraDocument`, pedir al renderer un `Blob`, validar miniatura con `validateThumbnailBlob`, llamar `captureShot` y persistir proyecto+Blob en la misma operación `saveWithAssets`. El snapshot no lee `mainCanvas` ni copia la planilla.
3. En importación, esperar `deserializePortableProject`; reemplazar el store únicamente con `{project, assets}` validado. En fallo, conservar estado anterior y ofrecer su exportación.
4. Conectar `restoreShot`, `duplicateShot`, `deleteShot`, `moveShot`, `renameShot` y `setShotNotes` desde acciones/UI. Al borrar un plano, persistir para podar miniaturas que no sigan referenciadas.
5. La extensión de `ShotSnapshot` es local a D para no editar contratos compartidos durante fase paralela. Si A exige propiedades estáticas completas, formalizar `IndependentShotSnapshot` y sus tipos portables en `src/contracts/types.ts` durante integración 2.5.
6. Programar debounce/autoguardado en UI/F y mostrar “Guardado” solo tras resolución de `save`; rechazo debe mantener la última confirmación y mostrar “Error”. El navegador debe revisar cuotas y permisos reales.
7. Usar un único `createObjectUrlLease` por flujo de descarga y llamar `dispose()` cuando cierre/abandone el componente.

## Limitaciones / siguiente rol

La carpeta compartida recibió cambios concurrentes en `src/core/`, `src/ui/`, `tests/core/` y `tests/ui/`, fuera del alcance D; se dejaron intactos. La comprobación global de tipos quedó detenida por los dos errores externos listados. La siguiente acción corresponde a integración 2.5: formalizar contratos, corregir conflictos de tipos externos y conectar persistencia/UI; luego probar IndexedDB y recarga en navegador real.
