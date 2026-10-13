// Solicitudes de compra · Compras y proveedores.
'use strict';

MODULOS.solicitudes = {
  titulo: 'Solicitudes de compra', icono: 'solicitud', grupo: 'Abastecimiento',
  render(main) {
    const pend = S.solicitudes.filter(s => s.estado === 'Pendiente de autorización');
    const aut = S.solicitudes.filter(s => s.estado === 'Autorizada');
    main.innerHTML = `
      ${encabezado('Solicitudes de compra', 'Necesidades de material: se autorizan o rechazan, y una solicitud autorizada se convierte en una sola orden de compra.',
        btnAcc('sc-nueva', '', 'Crear solicitud de compra', { clase: '', ico: 'mas', permiso: 'solicitud.crear' }))}
      <div class="indicadores">
        ${indicador({ titulo: 'Pendientes de autorización', valor: fmt.num(pend.length), estado: pend.length ? 'alerta' : 'bien', ico: 'solicitud' })}
        ${indicador({ titulo: 'Importe estimado pendiente', valor: fmt.mxnCorto(suma(pend, s => s.costoEst)), estado: 'info', ico: 'compras', nota: 'Solicitudes por autorizar' })}
        ${indicador({ titulo: 'Autorizadas sin convertir', valor: fmt.num(aut.length), estado: aut.length ? 'alerta' : 'bien', ico: 'check' })}
        ${indicador({ titulo: 'Borradores', valor: fmt.num(S.solicitudes.filter(s => s.estado === 'Borrador').length), estado: 'info', ico: 'solicitud' })}
      </div>
      <section class="tarjeta">${tabla('solicitudes', {
        titulo: 'Solicitudes de compra', exportar: 'solicitudes', placeholder: 'Folio, material, solicitante…', orden: ['Folio', 'desc'],
        columnas: [
          { t: 'Folio', v: s => docLink(s.folio), o: s => s.folio },
          { t: 'Fecha', v: s => fmt.fecha(s.fecha), o: s => s.fecha },
          { t: 'Área', v: s => esc(s.area), o: s => s.area },
          { t: 'Material', v: s => `${esc(material(s.material).descripcion)}<br><small class="tenue">${s.material}</small>`, o: s => material(s.material).descripcion + ' ' + s.material },
          { t: 'Cantidad', num: true, v: s => fmt.cant(s.cantidad, s.unidad), o: s => s.cantidad },
          { t: 'Motivo', v: s => `<span title="${esc(s.motivo)}">${esc(s.motivo.length > 38 ? s.motivo.slice(0, 36) + '…' : s.motivo)}</span>`, o: s => s.motivo },
          { t: 'Prioridad', v: s => pill(s.prioridad), o: s => PRIORIDADES.indexOf(s.prioridad) },
          { t: 'Costo estimado', num: true, v: s => fmt.mxn(s.costoEst, 0), o: s => s.costoEst },
          { t: 'Solicitante', v: s => esc(s.solicitante), o: s => s.solicitante },
          { t: 'Autoriza', v: s => esc(s.autorizador), o: s => s.autorizador },
          { t: 'Estado', v: s => pill(s.estado) + (s.oc ? `<br>${docLink(s.oc)}` : ''), o: s => s.estado },
          { t: 'Acciones', v: s => `<div class="acciones-fila">${
            s.estado === 'Pendiente de autorización' ? btnAcc('sc-autorizar', s.folio, 'Autorizar', { clase: 'btn-verde btn-chico', permiso: 'solicitud.autorizar' }) + btnAcc('sc-rechazar', s.folio, 'Rechazar', { permiso: 'solicitud.autorizar' })
              : s.estado === 'Autorizada' ? btnAcc('sc-convertir', s.folio, 'Convertir en OC', { clase: 'btn btn-chico', permiso: 'compra' })
                : s.estado === 'Borrador' ? btnAcc('sc-editar', s.folio, 'Editar', { permiso: 'solicitud.crear' }) + btnAcc('sc-enviar', s.folio, 'Enviar', { clase: 'btn btn-chico', permiso: 'solicitud.crear' }) : ''}</div>` },
        ],
        filas: S.solicitudes,
        texto: s => s.estado + ' ' + s.prioridad,
        filtros: [{ id: 'estado', t: 'Estado', valor: s => s.estado }, { id: 'prioridad', t: 'Prioridad', valor: s => s.prioridad, opciones: PRIORIDADES }, { id: 'mes', t: 'Fecha', valor: s => s.fecha >= sumarDias(hoy(), -7) ? 'Últimos 7 días' : s.fecha >= sumarDias(hoy(), -30) ? 'Últimos 30 días' : 'Anteriores', opciones: ['Últimos 7 días', 'Últimos 30 días', 'Anteriores'] }],
        claseFila: s => s.prioridad === 'Urgente' && !['Cerrada', 'Rechazada'].includes(s.estado) ? 'fila-mal' : '',
      })}</section>`;
  },
};

MODULOS.compras = {
  titulo: 'Compras y proveedores', icono: 'compras', grupo: 'Abastecimiento',
  pestana: 'ordenes',
  render(main) {
    const p = this.pestana;
    const r = periodoActual();
    const k = calcularKPIs(r);
    const K = c => k.find(x => x.clave === c);
    main.innerHTML = `
      ${encabezado('Compras y proveedores', `Órdenes de compra, catálogo de proveedores y materiales. Indicadores ${tituloPeriodo(r)}.`,
        btnAcc('oc-nueva', '', 'Crear orden de compra', { clase: '', ico: 'mas', permiso: 'compra' }))}
      <div class="indicadores">
        ${indicador({ titulo: 'Cumplimiento de proveedores', valor: formatoKPI(K('proveedores')), estado: K('proveedores').semaforo, ico: 'proveedor', nota: esc(K('proveedores').detalle) })}
        ${indicador({ titulo: 'Variación de precio', valor: formatoKPI(K('variacionPrecio')), estado: K('variacionPrecio').semaforo, ico: 'compras', nota: `Meta ${formatoMeta(K('variacionPrecio'))}` })}
        ${indicador({ titulo: 'Ciclo de compras', valor: formatoKPI(K('cicloCompras')), estado: K('cicloCompras').semaforo, ico: 'planeacion', nota: 'Autorización → emisión de OC' })}
        ${indicador({ titulo: 'Compras del periodo', valor: formatoKPI(K('costoCompras')), estado: 'info', ico: 'reporte', nota: esc(K('costoCompras').detalle) + ' · sin IVA' })}
      </div>
      <div class="pestanas" role="tablist">${[['ordenes', 'Órdenes de compra'], ['proveedores', 'Proveedores'], ['materiales', 'Catálogo de materiales'], ['desempeno', 'Desempeño de proveedores']].map(([id, t]) => `<button role="tab" class="${p === id ? 'activa' : ''}" data-pest="${id}">${t}</button>`).join('')}</div>
      <div id="pestCont"></div>`;
    main.querySelectorAll('[data-pest]').forEach(b => b.onclick = () => { this.pestana = b.dataset.pest; refrescar(); });
    const cont = main.querySelector('#pestCont');
    if (p === 'ordenes') cont.innerHTML = `<section class="tarjeta">${tabla('ocs', {
      titulo: 'Órdenes de compra', exportar: 'ordenes-compra', orden: ['Número', 'desc'], placeholder: 'Folio, proveedor, material…',
      columnas: [
        { t: 'Número', v: o => docLink(o.folio), o: o => o.folio },
        { t: 'Solicitud', v: o => docLink(o.solicitud), o: o => o.solicitud || '' },
        { t: 'Proveedor', v: o => esc(proveedor(o.proveedor).razon), o: o => proveedor(o.proveedor).razon },
        { t: 'Materiales', v: o => o.lineas.map(l => esc(material(l.material).descripcion)).join('<br>'), o: o => o.lineas.map(l => material(l.material).descripcion).join(' ') },
        { t: 'Emisión', v: o => fmt.fecha(o.fechaEmision), o: o => o.fechaEmision },
        { t: 'Prometida', v: o => fmt.fecha(o.fechaPrometida), o: o => o.fechaPrometida },
        { t: 'Total', num: true, v: o => fmt.mxn(totalesOC(o).total), o: o => totalesOC(o).total },
        { t: 'Recibido', v: o => barraProgreso(100 * suma(o.lineas, l => l.recibido) / suma(o.lineas, l => l.cantidad)), o: o => suma(o.lineas, l => l.recibido) / suma(o.lineas, l => l.cantidad) },
        { t: 'Estado', v: o => pill(estadoOC(o)), o: o => estadoOC(o) },
        { t: 'Acciones', v: o => `<div class="acciones-fila">${o.estado === 'Pendiente' ? btnAcc('oc-enviar', o.folio, 'Enviar', { permiso: 'compra' }) : ''}${['Pendiente', 'Enviada'].includes(o.estado) ? btnAcc('oc-confirmar', o.folio, 'Confirmar', { permiso: 'compra' }) : ''}${['Enviada', 'Confirmada', 'Parcialmente recibida'].includes(o.estado) ? btnAcc('oc-recibir', o.folio, 'Recibir', { clase: 'btn-verde btn-chico', permiso: 'recepcion' }) : ''}</div>` },
      ],
      filas: S.ordenesCompra,
      filtros: [{ id: 'estado', t: 'Estado', valor: estadoOC }, { id: 'prov', t: 'Proveedor', valor: o => proveedor(o.proveedor).razon }, { id: 'per', t: 'Periodo', valor: o => o.fechaEmision >= r.desde ? 'Periodo actual' : 'Anteriores', opciones: ['Periodo actual', 'Anteriores'] }],
      claseFila: o => estadoOC(o) === 'Retrasada' ? 'fila-mal' : '',
    })}</section>`;
    if (p === 'proveedores') cont.innerHTML = `<section class="tarjeta">${tabla('provs', {
      titulo: 'Proveedores', exportar: 'proveedores', orden: ['Código', 'asc'], porPagina: 12,
      columnas: [
        { t: 'Código', v: x => docLink(x.codigo), o: x => x.codigo },
        { t: 'Razón social', v: x => esc(x.razon), o: x => x.razon },
        { t: 'Contacto', v: x => `${esc(x.contacto)}<br><small class="tenue">${esc(x.correo)}</small>`, o: x => x.contacto },
        { t: 'Categorías', v: x => esc(x.categorias.join(', ')), o: x => x.categorias.join(', ') },
        { t: 'Entrega promedio', num: true, v: x => `${x.lead} días`, o: x => x.lead },
        { t: 'Precio de referencia', v: x => S.materiales.filter(m => m.proveedor === x.codigo).map(m => `${esc(m.codigo)} ${fmt.mxn(m.precioRef)}/${m.unidad}`).join('<br>'), o: x => '' },
        { t: 'Puntualidad', num: true, v: x => { const d = desempenoProveedor(x.codigo); return d.puntualidad == null ? `<span class="tenue">${fmt.pct(x.puntualidad * 100, 0)} (catálogo)</span>` : fmt.pct(d.puntualidad, 0); }, o: x => desempenoProveedor(x.codigo).puntualidad ?? x.puntualidad * 100 },
        { t: 'Calificación', num: true, v: x => `${fmt.num(x.calificacion, 1)} ★`, o: x => x.calificacion },
        { t: 'Estado', v: x => pill(x.estado, 'bien'), o: x => x.estado },
      ],
      filas: S.proveedores, filtros: [{ id: 'cat', t: 'Categoría', valor: x => x.categorias[0] }],
    })}</section>`;
    if (p === 'materiales') cont.innerHTML = `<section class="tarjeta">${tabla('mats', {
      titulo: 'Catálogo de materiales', exportar: 'materiales', orden: ['Código', 'asc'], porPagina: 25,
      columnas: [
        { t: 'Código', v: m => docLink(m.codigo), o: m => m.codigo },
        { t: 'Descripción', v: m => esc(m.descripcion), o: m => m.descripcion },
        { t: 'Categoría', v: m => esc(m.categoria), o: m => m.categoria },
        { t: 'Unidad', v: m => m.unidad, o: m => m.unidad },
        { t: 'Costo unitario', num: true, v: m => fmt.mxn(m.costo), o: m => m.costo },
        { t: 'Proveedor habitual', v: m => docLink(m.proveedor), o: m => m.proveedor },
        { t: 'Inventario actual', num: true, v: m => fmt.num(existencias(m.codigo).fisica, 1), o: m => existencias(m.codigo).fisica },
        { t: 'Mínimo', num: true, v: m => fmt.num(m.min), o: m => m.min },
        { t: 'Máximo', num: true, v: m => fmt.num(m.max), o: m => m.max },
        { t: 'Reposición', num: true, v: m => `${m.lead} días`, o: m => m.lead },
        { t: 'Estado', v: m => pill(estadoMaterial(m.codigo)), o: m => estadoMaterial(m.codigo) },
      ],
      filas: S.materiales, filtros: [{ id: 'cat', t: 'Categoría', valor: m => m.categoria }, { id: 'est', t: 'Estado', valor: m => estadoMaterial(m.codigo) }],
    })}</section>`;
    if (p === 'desempeno') {
      const filas = S.proveedores.map(x => ({ ...x, d: desempenoProveedor(x.codigo) }));
      cont.innerHTML = `<div class="rejilla r2"><section class="tarjeta"><h2>Puntualidad real por proveedor</h2><p class="nota">Órdenes recibidas en o antes de la fecha prometida (todo el histórico).</p><div class="grafica" id="gProv"></div></section>
        <section class="tarjeta"><h2>Evaluación</h2>${tabla('desemp', {
        sinBarra: true, porPagina: 12, orden: ['Puntualidad', 'asc'],
        columnas: [
          { t: 'Proveedor', v: x => docLink(x.codigo) + ' ' + esc(x.razon.replace(/ Demo.*$/, '')), o: x => x.razon },
          { t: 'OC recibidas', num: true, v: x => fmt.num(x.d.n), o: x => x.d.n },
          { t: 'Puntualidad', num: true, v: x => x.d.puntualidad == null ? '<span class="tenue">Sin datos</span>' : pill(fmt.pct(x.d.puntualidad, 0), x.d.puntualidad >= 95 ? 'bien' : x.d.puntualidad >= 85 ? 'alerta' : 'critico'), o: x => x.d.puntualidad ?? 999 },
          { t: 'Atraso prom.', num: true, v: x => x.d.atraso ? `${fmt.num(x.d.atraso, 1)} d` : '—', o: x => x.d.atraso },
          { t: 'Var. precio', num: true, v: x => fmt.pct(x.d.variacion, 1), o: x => x.d.variacion ?? 0 },
          { t: 'Rechazo', num: true, v: x => fmt.pct(x.d.rechazo, 1), o: x => x.d.rechazo ?? 0 },
        ], filas,
      })}</section></div>`;
      const conDatos = filas.filter(x => x.d.puntualidad != null);
      dibujos.push(() => graficaBarras(document.getElementById('gProv'), {
        etiquetas: conDatos.map(x => x.codigo), etqFormato: c => c.replace('PRV-0', 'P'), etqLarga: c => proveedor(c).razon, formato: (v, e) => e ? fmt.num(v) + ' %' : fmt.pct(v, 0),
        meta: { valor: S.config.metas.proveedores, etiqueta: `Meta ${S.config.metas.proveedores} %` },
        series: [{ nombre: 'Puntualidad', valores: conDatos.map(x => x.d.puntualidad), color: 'var(--s1)' }],
      }));
    }
  },
};
