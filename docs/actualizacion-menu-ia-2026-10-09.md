# Menú, consultas y actualización de pantallas

- El menú espera la sesión validada: no muestra permisos guardados de otra sesión mientras se consulta `/auth/me`.
- Los permisos se sincronizan al navegar, al recuperar el foco, entre pestañas y cada cinco segundos. Las respuestas de una sesión anterior se descartan.
- Las consultas de API usan `no-store` tanto en el cliente como en el middleware autenticado.
- Las pestañas detectan cambios en el archivo JavaScript publicado consultando el HTML sin caché. La versión nueva se aplica al navegar; no se interrumpe un formulario en edición.
- Los 24 botones de IA usan consultas predefinidas y permisos explícitos. Las instrucciones de presentación no se utilizan como términos SQL.
- Las respuestas comerciales incluyen clientes, cotizaciones u oportunidades reales. Las consultas de viajes, vehículos, cobranza y operaciones aplican estados o cifras registrados.
- La IA utiliza MySQL y reglas de análisis; no llama a proveedores de pago.

Validación: `node tests/regression-access-operations.cjs` desde backend, compilación Vite y verificación de solo lectura en producción. La regresión bloquea cualquier llamada externa de IA y comprueba todos los botones con roles completos y restringidos.

Despliegue: respaldar frontend, fuentes y base de datos; publicar fuentes y compilación; reiniciar `gl365-api`; comprobar HTTPS, consultas y permiso de Melissa. Nginx debe servir HTML con `Cache-Control: no-store`.
