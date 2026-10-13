# SupplyChain 360 AI

Plataforma integral de gestión y simulación logística para **NovaManufactura México
S.A. de C.V.**, empresa ficticia. Proyecto escolar A2U3 (Cadena de Suministros 4.0 y
Comercio Electrónico, Instituto Tecnológico de Toluca). **Todos los datos son ficticios
de demostración.**

## Cómo abrirla

- **Con doble clic** en `index.html`: funciona sin servidor ni internet.
- **Con servidor local** (recomendado para probar como en la web):

```bash
python -m http.server 8010
```

y abrir `http://localhost:8010`.

La primera vez se generan 30 días de operación (13/09/2026 al 12/10/2026, más el día
13/10/2026 con operaciones abiertas) con semilla fija: siempre salen los mismos datos.

## Qué incluye

| Módulo | Qué se puede hacer |
|---|---|
| Dashboard general | 8 indicadores con variación contra el periodo anterior, 5 gráficas, alertas que llevan al documento, últimas transacciones, órdenes que requieren atención |
| Solicitudes de compra | Crear, editar borradores, autorizar, rechazar con motivo, comentar, historial, convertir en una sola OC |
| Compras y proveedores | 12 proveedores, 25 materiales, órdenes con IVA configurable y flete, confirmación, recepción parcial, cambio simulado de precio y plazo, desempeño |
| Transporte | Programar embarques, asignar transportista y vehículo, avanzar estados, retrasos, incidencias, línea de tiempo, mapa esquemático de rutas |
| Almacén e inventarios | Lotes con PEPS, disponible = física − reservada, cuarentena, ajustes auditables, conteos físicos, movimientos, clasificación ABC |
| Suministro a producción | Solicitudes desde la orden, validación de disponibilidad, surtido parcial, propuesta de compra del faltante, devoluciones |
| Planeación | Órdenes de producción, requerimientos de material, bloqueo si falta material (excepción auditada), paros, calendario, plan contra real |
| Manufactura | Seis etapas de la EcoBox Industrial, avance por etapa, rechazos con causa, tiempos, rendimiento, cuello de botella, conciliación de unidades |
| Productos terminados | Lotes que sólo nacen de una orden aprobada, bloqueo por calidad, transferencias, trazabilidad hasta las órdenes de compra |
| Pedidos y despachos | Crear, reservar (PEPS), preparar, despachar (incompleto con confirmación), entregar, retrasos, devoluciones |
| KPIs y analítica | Los 20 KPIs con definición, fórmula, meta, tendencia, semáforo, interpretación, filtros y recomendaciones |
| Reportes | 10 reportes con filtro de periodo; CSV, Excel (.xls) y PDF (imprimir) |
| Incidencias | Registro, asignación, seguimiento, cierre e impacto sobre los KPIs |
| Simulador | Escenarios A–E con controles, comparación base contra simulado y «Aplicar cambios» explícito |
| Configuración | IVA, costos y metas; roles de demostración; respaldo JSON; auditoría |
| Modo demostración | Guía de 5 minutos y «Ejecutar simulación completa» (19 pasos, se puede deshacer) |
| Asistente | Bot por reglas que responde con los datos de la plataforma |

Cualquier folio subrayado abre un panel con el documento, sus relaciones (de la
solicitud al pedido entregado), su historial y las acciones disponibles.

## Arquitectura

HTML, CSS y JavaScript sin dependencias ni compilación. Se eligió así, en vez de
React + TypeScript, para que la plataforma abra con doble clic y no dependa de ningún
CDN el día de la revisión.

```
index.html
css/app.css
js/nucleo/   util · catalogos · almacen-datos (estado, adaptador, permisos) · reglas · semilla · kpis
js/ui/       componentes (tablas, formularios, gráficas SVG) · acciones · documento · bot
js/modulos/  un archivo por grupo de pantallas
js/app.js    menú, cabecera, buscador global, notificaciones, enrutador
```

- **Reglas de negocio** (`reglas.js`): cada operación valida, actualiza y audita. No
  hay inventarios negativos, una solicitud no genera dos órdenes, la recepción sólo
  suma lo aceptado y el producto terminado sólo nace de una orden aprobada.
- **Histórico** (`semilla.js`): se genera ejecutando esas mismas reglas día por día,
  así compras, transporte, inventario, producción y pedidos cuadran por construcción.
- **KPIs** (`kpis.js`): se calculan con los registros; si el denominador es cero se
  muestra «Sin datos suficientes».

## Persistencia y base de datos

No hay servidor configurado: los datos se guardan en el `localStorage` del navegador
mediante `AdaptadorLocal`. La plataforma no finge ninguna conexión externa.

Para migrar a Supabase (u otra base relacional), implementar `cargar`, `guardar` y
`borrar` en `AdaptadorSupabase` (`js/nucleo/almacen-datos.js`) con la URL y la clave
pública del proyecto. Tablas sugeridas, una por colección del estado: `solicitudes`,
`ordenes_compra` (+ `ordenes_compra_lineas`), `embarques`, `recepciones`, `lotes`,
`movimientos`, `suministros`, `ordenes_produccion`, `operaciones`, `lotes_pt`,
`pedidos`, `incidencias`, `conteos`, `auditoria` y los catálogos. Con autenticación
real, los permisos por rol deben validarse con políticas de seguridad a nivel de fila,
no sólo en la interfaz.

## Roles

El selector de rol de la cabecera es **sólo de demostración** y no es un sistema de
seguridad: no hay autenticación. Las reglas verifican el rol en cada operación para
mostrar la segregación de funciones.

## Historia de los datos

- A finales de septiembre, **Polímeros Industriales (PRV-003)** entrega la resina con
  8 días de retraso; las compras urgentes se pagan con sobreprecio.
- El 01/10/2026 la **Línea B** tiene una falla mecánica de 3 horas.
- Al día 13/10/2026 quedan abiertos: solicitudes por autorizar, un embarque retrasado,
  una orden de producción en proceso, otra lista, otra que no puede iniciar por falta
  de material, un pedido atrasado y un lote en cuarentena.
