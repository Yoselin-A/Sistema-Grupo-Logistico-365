# Correcciones de accesos y expedientes — 9 de octubre de 2026

## Comportamiento

- Proveedores y Pilotos tienen permisos independientes. CRM ya no permite abrir Proveedores.
- Roles muestra Proveedores, Flota, Pilotos, Logística y Rutas por separado. El servidor consulta los permisos actuales en cada petición; el menú se sincroniza al volver a la pestaña y cada 15 segundos.
- Gerencia y Administrador mantienen el acceso administrativo protegido que ya existía.
- Reportes e IA solo devuelven los datos de módulos concedidos. La IA responde desde MySQL y no utiliza APIs de modelos ni créditos de proveedores.
- FYDUCA y Centroamérica conservan los documentos del piloto al editar. Finalizar guarda el estado anterior en MySQL; Regresar restaura el estado sin exigir documentos ausentes de expedientes históricos ni cambiar fechas o costos.
- El alta rápida de pilotos guarda DPI, NIT y nacimiento. Las actualizaciones parciales de la ficha conservan los campos no enviados. El expediente del piloto también muestra los documentos registrados en sus asignaciones, sin copiar costos.
- Comprobantes permite serie y número manual al crear. Un número vacío se genera automáticamente. El PDF muestra la serie y número guardados; se retiró el QR decorativo y la autorización ficticia.

## Migración

Desde `backend`, ejecutar `node scripts/migrate-module-access.cjs` con el `.env` existente.

La migración agrega los dos módulos nuevos. Proveedores se concede inicialmente solo a roles administrativos protegidos; los demás roles se configuran desde Mantenimiento. Pilotos conserva, una sola vez, los accesos que antes dependían de Flota. Repetir la migración no vuelve a conceder permisos revocados.

Los documentos ausentes del maestro se recuperan solo si todos los valores registrados en sus expedientes coinciden. No se sobrescriben documentos existentes ni se elige un valor cuando hay versiones distintas.

## Verificación local

`node tests/regression-access-operations.cjs`, desde `backend`, utiliza registros temporales y elimina los registros de negocio creados al terminar. No ejecutar esta prueba en producción.

Resultados comprobados:

1. Melissa no puede abrir Proveedores por API.
2. Concesión y revocación desde Mantenimiento entran en vigor usando el mismo JWT.
3. Reportes e IA no publican datos de módulos no concedidos.
4. Ocho consultas de IA responden con cero llamadas externas, incluso con una clave de proveedor configurada.
5. Alta rápida y edición parcial conservan los documentos de pilotos.
6. Edición, finalización y reapertura de FYDUCA y Centroamérica conservan nacimiento y funcionan sin DPI histórico.
7. Serie y número manual quedan guardados en MySQL.
8. `npm run build` terminó correctamente. Se mantiene el aviso preexistente de tamaño del paquete JavaScript.

Revisión visual local: formulario de Roles con permisos independientes y formulario de creación de Comprobantes con serie y número visibles.

## Publicación

Publicar juntos frontend, rutas de backend, middleware, utilidades y migración. Respaldar la base de datos y los archivos anteriores antes de migrar; conservar el `.env` y reiniciar `gl365-api` después de reemplazar el backend.
