// Dashboard general: resumen ejecutivo de toda la cadena.
'use strict';

MODULOS.dashboard = {
  titulo: 'Dashboard general', icono: 'tablero', grupo: 'General',
  render(main) {
    const r = periodoActual();
    const prev = { desde: sumarDias(r.desde, -r.dias), hasta: sumarDias(r.desde, -1) };
    const k = calcularKPIs(r), kp = calcularKPIs(prev);
    const K = c => k.find(x => x.clave === c), KP = c => kp.find(x => x.clave === c);
    const delta = c => (K(c).valor != null && KP(c).valor != null ? K(c).valor - KP(c).valor : null);
    const inv = valorInventarioAl(r.hasta).total, invPrev = valorInventarioAl(prev.hasta).total;
    const ocAbierta = o => OC_ABIERTA.includes(o.estado);
    const ocPend = S.ordenesCompra.filter(ocAbierta).length;
    const ocPendPrev = abiertosEn('ordenesCompra', prev.hasta, { creado: o => o.fechaEmision, cerrado: o => o.fechaCierre });
    const scAut = S.solicitudes.filter(s => s.estado === 'Pendiente de autorización').length;
    const scAutPrev = abiertosEn('solicitudes', prev.hasta, { creado: s => s.creada, cerrado: s => s.fechaAutorizacion || s.fechaCierre, filtro: s => s.estado !== 'Borrador' });
    const crit = S.materiales.filter(m => ['Crítico', 'Agotado'].includes(estadoMaterial(m.codigo))).length;
    const opProc = S.ordenesProduccion.filter(o => o.estado === 'En proceso').length;
    const opProcPrev = abiertosEn('ordenesProduccion', prev.hasta, { creado: o => o.iniReal, cerrado: o => o.finReal });
    const alertas = alertasSistema();

    main.innerHTML = `
      ${encabezado('Dashboard general', `Resumen ejecutivo ${tituloPeriodo(r)} · comparación contra los ${r.dias} días anteriores.`,
        btnAcc('ir', 'kpis', 'Consultar KPIs', { clase: 'btn-sec', ico: 'kpi' }) + btnAcc('ir', 'reportes', 'Exportar reporte', { clase: 'btn-sec', ico: 'descarga' }))}
      <div class="accesos">
        ${[['sc-nueva', 'Crear solicitud de compra', 'solicitud', 'solicitud.crear'], ['ir:almacen', 'Registrar recepción', 'camion', 'recepcion'], ['ir:suministro', 'Surtir materiales', 'suministro', 'suministro'], ['op-nueva', 'Crear orden de producción', 'planeacion', 'produccion'],
          ['ir:manufactura', 'Registrar avance de manufactura', 'fabrica', 'produccion'], ['ir:simulador', 'Simular escenario', 'simulador'], ['ir:kpis', 'Consultar KPIs', 'kpi'], ['ir:reportes', 'Exportar reporte', 'reporte']]
          .map(([acc, t, ic, perm]) => { const [a, arg] = acc.split(':'); const bloq = perm && !puede(perm); return `<button class="acceso" data-accion="${a}" data-arg="${arg || ''}" ${bloq ? `disabled title="Tu rol de demostración no tiene permiso"` : ''}><span class="ico-caja">${icono(ic)}</span>${t}</button>`; }).join('')}
      </div>
      <div class="indicadores">
        ${indicador({ titulo: 'Valor total del inventario', valor: fmt.mxnCorto(inv), delta: inv - invPrev, mayorMejor: false, deltaFmt: v => fmt.mxnCorto(v), estado: 'info', ico: 'almacen', ir: 'almacen', nota: 'Materiales y producto terminado' })}
        ${indicador({ titulo: 'Órdenes de compra pendientes', valor: fmt.num(ocPend), unidad: 'órdenes', delta: ocPend - ocPendPrev, mayorMejor: false, deltaFmt: v => fmt.num(v), estado: S.ordenesCompra.some(o => estadoOC(o) === 'Retrasada') ? 'alerta' : 'bien', ico: 'compras', ir: 'compras' })}
        ${indicador({ titulo: 'Solicitudes por autorizar', valor: fmt.num(scAut), unidad: 'solicitudes', delta: scAut - scAutPrev, mayorMejor: false, deltaFmt: v => fmt.num(v), estado: scAut ? 'alerta' : 'bien', ico: 'solicitud', ir: 'solicitudes' })}
        ${indicador({ titulo: 'Entregas de proveedores a tiempo', valor: K('proveedores').valor == null ? '—' : fmt.num(K('proveedores').valor, 1), unidad: '%', delta: delta('proveedores'), deltaFmt: v => fmt.num(v, 1) + ' pts', estado: K('proveedores').semaforo, ico: 'camion', ir: 'compras' })}
        ${indicador({ titulo: 'Materiales con existencias críticas', valor: fmt.num(crit), unidad: `de ${S.materiales.length}`, estado: crit === 0 ? 'bien' : crit <= 2 ? 'alerta' : 'critico', ico: 'incidencia', ir: 'almacen', nota: 'Foto actual: existencia bajo el mínimo' })}
        ${indicador({ titulo: 'Órdenes de producción en proceso', valor: fmt.num(opProc), unidad: 'órdenes', delta: opProc - opProcPrev, deltaFmt: v => fmt.num(v), estado: 'info', ico: 'fabrica', ir: 'planeacion' })}
        ${indicador({ titulo: 'Cumplimiento del plan de producción', valor: K('planProduccion').valor == null ? '—' : fmt.num(K('planProduccion').valor, 1), unidad: '%', delta: delta('planProduccion'), deltaFmt: v => fmt.num(v, 1) + ' pts', estado: K('planProduccion').semaforo, ico: 'planeacion', ir: 'planeacion' })}
        ${indicador({ titulo: 'Pedidos entregados a tiempo (OTIF)', valor: K('otif').valor == null ? '—' : fmt.num(K('otif').valor, 1), unidad: '%', delta: delta('otif'), deltaFmt: v => fmt.num(v, 1) + ' pts', estado: K('otif').semaforo, ico: 'pedido', ir: 'pedidos' })}
      </div>
      <div class="rejilla r21">
        <section class="tarjeta"><div class="tarjeta-cab"><h2>Costos logísticos y de producción por día</h2><span class="nota">MXN</span></div><div class="grafica" id="gCostos"></div></section>
        <section class="tarjeta"><div class="tarjeta-cab"><h2>Alertas críticas</h2>${pill(`${alertas.length}`, alertas.some(a => a.tono === 'critico') ? 'critico' : 'alerta')}</div>${listaAlertas(alertas, 7)}</section>
      </div>
      <div class="rejilla r3">
        <section class="tarjeta"><h2>Materiales consumidos por semana</h2><p class="nota">Valor de las salidas a producción, menos devoluciones.</p><div class="grafica" id="gSemana"></div></section>
        <section class="tarjeta"><h2>Inventario por categoría</h2><p class="nota">Valor actual de materiales.</p><div class="grafica" id="gDona"></div></section>
        <section class="tarjeta"><h2>Órdenes de producción por línea</h2><p class="nota">Pendientes, en proceso y terminadas en el periodo.</p><div class="grafica" id="gOPs"></div></section>
      </div>
      <div class="rejilla r2">
        <section class="tarjeta"><h2>Cumplimiento diario de entregas</h2><p class="nota">Pedidos entregados completos y a tiempo, por día de entrega.</p><div class="grafica" id="gEntregas"></div></section>
        <section class="tarjeta"><h2>Últimas transacciones</h2>${ultimasTransacciones()}</section>
      </div>
      <section class="tarjeta"><div class="tarjeta-cab"><h2>Órdenes que requieren atención</h2></div>${tabla('atencion', {
        columnas: [
          { t: 'Documento', v: x => docLink(x.folio), o: x => x.folio },
          { t: 'Tipo', v: x => esc(x.tipo), o: x => x.tipo },
          { t: 'Descripción', v: x => esc(x.desc), o: x => x.desc },
          { t: 'Fecha clave', v: x => fmt.fecha(x.fecha), o: x => x.fecha },
          { t: 'Estado', v: x => pill(x.estado), o: x => x.estado },
        ],
        filas: ordenesAtencion(), porPagina: 8, orden: ['Fecha clave', 'asc'], filtros: [{ id: 'tipo', t: 'Tipo', valor: x => x.tipo }],
      })}</section>`;

    const serie = serieOperativa(r.desde, r.hasta);
    const fechas = serie.map(x => x.fecha);
    dibujos.push(() => graficaLineas(document.getElementById('gCostos'), {
      etiquetas: fechas, yMin: 0, alto: 330, formato: (v, eje) => eje ? fmt.mxnCorto(v) : fmt.mxn(v, 0),
      series: [{ nombre: 'Costo logístico', valores: serie.map(x => x.costoLogistico), color: 'var(--s1)' }, { nombre: 'Costo de producción', valores: serie.map(x => x.costoProduccion), color: 'var(--s2)' }],
    }));
    // semanas (lunes a domingo) dentro del periodo
    const semanas = agrupar(serie, x => { const d = deISO(x.fecha); const lunes = new Date(d); lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return aISO(lunes); });
    const claves = Object.keys(semanas).sort();
    dibujos.push(() => graficaBarras(document.getElementById('gSemana'), {
      etiquetas: claves, etqFormato: f => 'Sem ' + fmt.fechaCorta(f), etqLarga: f => `Semana del ${fmt.fecha(f)}`, formato: (v, eje) => eje ? fmt.mxnCorto(v) : fmt.mxn(v, 0),
      series: [{ nombre: 'Consumo', valores: claves.map(c => suma(semanas[c], x => x.consumo)), color: 'var(--s1)' }],
    }));
    const porCat = agrupar(S.lotes.filter(l => l.cantidad > 0), l => material(l.material).categoria);
    const datos = Object.entries(porCat).map(([c, ls]) => ({ nombre: c, valor: suma(ls, l => l.cantidad * l.costo) })).sort((a, b) => b.valor - a.valor);
    const top = datos.slice(0, 5), resto = datos.slice(5);
    if (resto.length) top.push({ nombre: 'Otras categorías', valor: suma(resto, d => d.valor) });
    dibujos.push(() => graficaDona(document.getElementById('gDona'), { datos: top.map((d, i) => ({ ...d, color: i === 5 ? 'var(--linea-2)' : COLORES[i] })), formato: v => fmt.mxnCorto(v), centro: fmt.mxnCorto(suma(datos, d => d.valor)) }));
    const estados = [['Pendientes', o => ['Planificada', 'Pendiente de materiales', 'Lista para iniciar'].includes(o.estado), 'var(--s4)'], ['En proceso', o => ['En proceso', 'Pausada'].includes(o.estado), 'var(--s1)'], ['Terminadas', o => o.estado === 'Terminada' && enRango(o.finReal, r), 'var(--s3)']];
    dibujos.push(() => graficaBarras(document.getElementById('gOPs'), {
      etiquetas: S.lineas.map(l => l.codigo), etqFormato: c => c.replace('L-', 'Línea '), etqLarga: c => linea(c).nombre, formato: v => fmt.num(v),
      series: estados.map(([n, f, c]) => ({ nombre: n, color: c, valores: S.lineas.map(l => S.ordenesProduccion.filter(o => o.linea === l.codigo && f(o)).length) })),
    }));
    dibujos.push(() => graficaLineas(document.getElementById('gEntregas'), {
      etiquetas: fechas, yMin: 0, yMax: 100, formato: (v, eje) => eje ? fmt.num(v) + ' %' : fmt.pct(v, 0),
      meta: { valor: S.config.metas.otif, etiqueta: `Meta ${S.config.metas.otif} %` },
      series: [{ nombre: 'Entregas completas y a tiempo', valores: serie.map(x => x.entregasPct), color: 'var(--s3)' }],
    }));
  },
};

function ultimasTransacciones() {
  const ult = S.auditoria.slice(-40).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 9);
  return `<ul class="transacciones">${ult.map(a => `<li><time>${fmt.fechaHora(a.fecha)}</time><span><b>${esc(a.accion)}</b> ${documento(a.folio) ? docLink(a.folio) : esc(a.folio)}<br><small class="tenue">${esc(a.usuario)}${a.detalle ? ' · ' + esc(a.detalle) : ''}</small></span></li>`).join('')}</ul>`;
}

function ordenesAtencion() {
  const f = [];
  S.ordenesCompra.filter(o => OC_ABIERTA.includes(o.estado)).forEach(o => f.push({ folio: o.folio, tipo: 'Orden de compra', desc: `${proveedor(o.proveedor).razon} · ${o.lineas.map(l => material(l.material).descripcion).join(', ')}`, fecha: o.fechaPrometida, estado: estadoOC(o) }));
  S.solicitudes.filter(s => ['Pendiente de autorización', 'Autorizada'].includes(s.estado)).forEach(s => f.push({ folio: s.folio, tipo: 'Solicitud de compra', desc: `${material(s.material).descripcion} · ${s.prioridad}`, fecha: s.fecha, estado: s.estado }));
  S.ordenesProduccion.filter(o => !['Terminada', 'Cancelada'].includes(o.estado)).forEach(o => f.push({ folio: o.folio, tipo: 'Orden de producción', desc: `${producto(o.producto).nombre} · ${fmt.num(o.planificada)} u · ${linea(o.linea).codigo}`, fecha: o.finPlan, estado: o.estado }));
  S.pedidos.filter(p => !['Entregado', 'Cancelado'].includes(p.estado)).forEach(p => f.push({ folio: p.folio, tipo: 'Pedido', desc: cliente(p.cliente).nombre, fecha: p.comprometida, estado: estadoPedido(p) }));
  S.embarques.filter(e => !['Entregado', 'Cancelado'].includes(e.estado)).forEach(e => f.push({ folio: e.folio, tipo: 'Embarque', desc: `${proveedor(e.proveedor).razon} → planta`, fecha: e.eta, estado: estadoEmbarque(e) }));
  return f;
}
