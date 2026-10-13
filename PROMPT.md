# Prompt maestro del proyecto

La instrucción 2 de la tarea pide **«elaborar y mejorar el prompt para la creación de
la página web»**. Este archivo documenta el prompt final y cómo se llegó a él.

## Evolución

**v1 — ingenuo.** «Haz una página web para controlar la cadena de suministro de una
empresa con KPIs y un bot.» Resultado: una maqueta bonita y vacía.

**v2 — se nombran las actividades.** Aparecen las siete actividades, pero como tablas
inconexas.

**v3 — se encadenan los procesos.** Solicitud → orden de compra → embarque →
inventario → surtido → orden de producción → producto terminado.

**v4 — se fijan empresa y datos.** Empresa ficticia (ENVASA BIO), catálogos y KPIs
calculados desde archivos de datos, no escritos a mano.

**v5 — restricciones técnicas.** Sin CDN ni frameworks; bot por reglas, sin llaves de
API expuestas en un sitio público.

**v6 — SupplyChain 360 AI (prompt final).** Se amplía a una plataforma tipo ERP para
NovaManufactura México con 13 actividades, 20 KPIs con fórmula y meta, simulador de
escenarios A–E, incidencias, reportes, roles de demostración, trazabilidad entre
documentos y criterios de aceptación verificables. Es el prompt completo que se
entregó para construir el sitio (secciones 1 a 24: rol y objetivo, identidad visual,
navegación, dashboard, cada módulo, KPIs, simulador, datos de demostración, flujo
integral, incidencias, reportes, requisitos técnicos, seguridad, experiencia de
usuario y criterios de aceptación).

## Ajustes hechos al construirlo

El prompt v6 se respetó, con cuatro decisiones razonadas:

1. **HTML, CSS y JavaScript puro en lugar de React + TypeScript + Tailwind.** El
   prompt lo permite («o una biblioteca equivalente»). Sin compilación, la plataforma
   abre con doble clic y no depende de ningún CDN el día de la revisión.
2. **Persistencia local con adaptador.** Como pide el prompt cuando no hay servidor:
   `localStorage` detrás de un adaptador, con la interfaz para Supabase lista y
   documentada, sin simular una conexión que no existe.
3. **Se agregó un bot de ayuda por reglas.** El prompt v6 no lo pedía, pero la rúbrica
   le da 15 de 35 puntos. Responde con los datos de la plataforma y no usa API externa.
4. **Histórico de 30 días generado con las propias reglas de negocio.** Así los datos
   cuadran por construcción y los gráficos de tendencia tienen algo real que mostrar.

## Lo que más mejoró el resultado

Exigir **criterios de aceptación verificables** (sección 23) y **reglas de negocio
explícitas** (sin inventarios negativos, sin duplicar órdenes, recepción sólo de lo
aceptado, producto terminado sólo desde producción aprobada). Convierten «que se vea
completo» en algo que se puede probar paso a paso.
