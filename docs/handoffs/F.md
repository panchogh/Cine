# Handoff F — flujos y pulido final de interfaz

## Rol / fase

F sobre fase 2.5 integrada. **Implementación lista; aceptación visual e interacción real en navegador pendiente.** No se modificaron contratos, `main.ts`, renderer, core, configuración ni lockfile. No se inició otra fase ni agentes.

## Archivos de F

- `src/ui/workspace.ts`
- `src/styles/workspace.css`
- `tests/ui/workspace.test.ts`
- `docs/handoffs/F.md`

## Flujos implementados

- **Guardar:** botón y Ctrl/Cmd+S guardan documento y miniaturas con `projectRepository.saveWithAssets`. Muestra progreso, confirmación o error. El autosave conectado por A sigue informando su resultado mediante `persistenceStatus`.
- **Abrir/exportar:** menú de proyecto abre un JSON CineOptics validado; verifica miniaturas antes de reemplazar la sesión y conserva el ID local que usa la recuperación de A. Exporta proyecto portable con assets y planilla CSV por separado. Un archivo inválido deja intacto el proyecto abierto. Descargas reutilizan y revocan el object URL.
- **Planilla:** vacío con CTA de captura; para cada plano hay selección independiente de Cargar, edición de nombre/notas, duplicar, borrar y ordenar. Muestra miniatura, focal, f-number, modo/distancia de foco y tiempo. Los snapshots antiguos sin escena independiente no se ofrecen como restaurables. La selección por ID mantiene el foco al terminar acciones de lista.
- **Restauración:** Cargar consume el callback existente de `restoreShot`; tras `project/snapshotRestored`, los controles y las lecturas se vuelven a derivar del estado nuevo.
- **Reset:** «Restablecer cámara» repone solo parámetros de cámara; conserva escena, identidad y planilla y dirige AF al actor seleccionado (o al primero existente).
- **Texto y atajos:** nombres/notas se presentan con nodos y propiedades de texto, nunca `innerHTML`. Ctrl/Cmd+S y Ctrl/Cmd+O se ignoran en campos editables; Escape cierra menú/panel, salvo mientras se edita texto.
- **Etiquetas técnicas:** `f/` para apertura; «DoF estimada» con CoC explícito; gate de salida, FOV/DoF y lecturas aproximadas se identifican sin atribuir calibración comercial.

## Contratos consumidos y solicitudes a A

- UI usa `ProjectRepository.saveWithAssets`, `serializePortableProject`, `deserializePortableProject`, `captureFrame`/callbacks existentes, `captureShot` del flujo ya integrado, `restoreShot`, `duplicateShot`, `deleteShot`, `moveShot`, `renameShot`, `setShotNotes`, `exportShotCsv` y `createObjectUrlLease`.
- No se requiere cambiar contratos para estos flujos. Solicito que A, al revisar la integración, considere pasar un callback de guardado explícito a `mountWorkspace` y encolarlo junto al autosave. El botón actual llama al repositorio directamente, así que su mensaje de éxito se mantiene en UI; centralizar la escritura en `main.ts` permitiría que guardado manual y automático compartan una sola cola y fuente de estado. No bloquea los flujos actuales.
- A debe verificar en navegador que la importación, que conserva el ID local, se recupera tras recarga y que el feedback de error de cuota/IndexedDB llega a la cabecera. Esos servicios y el estado están conectados, pero el navegador no fue accesible desde este entorno.

## Pruebas ejecutadas

- `npx vitest run tests/ui/workspace.test.ts`: **6/6 aprobadas**. Incluye proyección de estado restaurado, cálculo del gate efectivo, conservación de identidad al abrir portable, alcance del reset, elegibilidad de snapshots y guardia de atajos en campos editables.
- `npm test`: **36/36 aprobadas**, 7 archivos en la última ejecución.
- `npm run typecheck`: **aprobado**.
- `npm run build`: **aprobado**, Vite 8.3.4 (23 módulos transformados).
- `git diff --check -- src/ui src/styles/workspace.css tests/ui`: sin errores reportados.

Las pruebas UI ejercitan funciones y estado con Vitest. No equivalen a abrir/exportar archivos mediante diálogos reales, usar IndexedDB del navegador, recorrer teclado en DOM real ni comprobar visualmente cambios de snapshot.

## Evidencia visual y límites

- Vite inició en `127.0.0.1:5174`; el navegador integrado recibió `net::ERR_CONNECTION_TIMED_OUT` al abrirlo. En `5173` ya había otro proceso y la página tampoco respondió. No hay capturas visuales.
- Responsive en 1920×1080, 1440×900, 1280×720, 1024×768, 768×1024, 390×844, zoom 200% y DPR 2 queda **sin verificar**. También quedan sin verificar teclado/foco reales, contraste medido, diálogos de archivos y persistencia IndexedDB/reload.
- El guard de atajos se probó como función; no se afirma que la navegación real de teclado o el retorno de foco pase aceptación hasta comprobarla en navegador.
- CSV y portabilidad usan las suites de D para formato y round-trip; no se probó Excel/Sheets ni transferencia de archivo real desde el navegador.

## Siguiente paso

A debe revisar el guardado manual frente al autosave y ejecutar la aceptación de navegador V12, V17, V20, responsive y teclado. La puerta F no está cerrada hasta esa verificación visual e interactiva.
