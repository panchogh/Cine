# Instrucciones del proyecto

## Contexto

CineOptics es una herramienta técnica de previsualización cinematográfica. El usuario quiere una interfaz limpia y resultados coherentes entre visor, mapas y cálculos. La documentación del 2026-10-13 es una propuesta de implementación, no funcionalidad existente.

Leer `README.md`, `PLAN_MEJORA.md` y el encargo correspondiente en `docs/PROMPTS_CHATS.md`. Consultar `docs/AUDITORIA.md` para el problema concreto y `docs/ARQUITECTURA.md` para contratos.

## Alcance y coordinación

- Conservar `cine_shot_visualizer_3d_pro.html` como referencia durante la migración. Construir la nueva entrada por separado.
- Ejecutar solo el encargo asignado. No crear chats, delegar ni iniciar otras fases por la mera existencia del plan.
- Modelo recomendado por el usuario: GPT-6 Luna, razonamiento alto. La selección efectiva corresponde al chat o al lanzamiento del agente; escribirlo en un documento no cambia el modelo activo.
- Antes de editar, identificar archivos propios y compartidos. No revertir cambios ajenos. Si falta un contrato, proponer el cambio concreto al integrador y continuar trabajo independiente.
- Solo el integrador modifica contratos compartidos, dependencias, lockfile, configuración, entrada principal y documentación global. Los demás dejan su entrega en `docs/handoffs/<ROL>.md`.
- No iniciar tres editores sobre el HTML monolítico. El paralelismo requiere módulos y contratos estables.

## Implementación

- Usar metros en escena, milímetros en sensor/focal/CoC y grados en controles; conversiones explícitas al calcular.
- Una sola cámara evaluada por instante alimenta render, mapas, métricas y captura.
- Funciones de cálculo puras; render sin mutaciones del proyecto; UI mediante acciones sobre el estado.
- IDs estables para actores y planos. Validar referencias después de eliminar o importar.
- Nombres y notas como texto; no interpolar contenido del usuario en `innerHTML`.
- Diferenciar magnitudes físicas, aproximaciones visuales y metadatos. No presentar efectos artísticos como calibraciones de lentes comerciales.
- No añadir backend, cuentas, IA en la aplicación ni motor 3D nuevo sin necesidad del encargo.
- Elegir dependencias mínimas y fijarlas con lockfile al crear el proyecto modular.

## Validación y entrega

- No declarar pruebas de navegador, accesibilidad, rendimiento o compatibilidad que no se hayan realizado.
- Verificar los escenarios relevantes de `docs/VALIDACION.md`. Una comprobación con DOM simulado no sustituye navegador.
- Informar cambios, archivos, pruebas ejecutadas y limitaciones. No dar una fase por terminada si falta su puerta de aceptación.
- La auditoría del legado registra errores conocidos; no cambiar sus expectativas para hacer pasar la nueva aplicación. Crear pruebas de aceptación independientes para el comportamiento corregido.
