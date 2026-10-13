// Pedidos y despachos · Incidencias.
'use strict';

MODULOS.pedidos = {
  titulo: 'Pedidos y despachos', icono: 'pedido', grupo: 'Distribución',
  render(main) {
    const r = periodoActual();
    const k = calcularKPIs(r);
    const K = c => k.find(x => x.clave === c);
    const abiertos = S.pedidos.filter(p => !['Entregado', 'Cancelado'].includes(p.estado));
    main.innerHTML = `
      ${encabezado('Pedidos y despachos', `Cierre del ciclo: reserva de producto terminado, preparación, despacho y entrega. Indicadores ${tituloPeriodo(r)}.`,
        btnAcc('ped-nuevo', '', 'Crear pedido', { clase: '', ico: 'mas', permiso: 'pedido' }))}
      <div class="indicadores">
        ${indicador({ titulo: 'OTIF', valor: formatoKPI(K('otif')), estado: K('otif').semaforo, ico: 'check', nota: esc(K('otif').detalle) })}
        ${indicador({ titulo: 'Pedidos abiertos', valor: fmt.num(abiertos.length), estado: 'info', ico: 'pedido', nota: `${abiertos.filter(p => estadoPedido(p) === 'Retrasado').length} atrasados` })}
        ${indicador({ titulo: 'Costo logístico por unidad', valor: formatoKPI(K('costoLogisticoUnidad')), estado: K('costoLogisticoUnidad').semaforo, ico: 'camion', nota: `Meta ${formatoMeta(K('costoLogisticoUnidad'))}` })}
        ${indicador({ titulo: 'Por despachar hoy o vencidos', valor: fmt.num(abiertos.filter(p => p.estado !== 'Despachado' && p.comprometida <= sumarDias(hoy(), 1)).length), estado: 'alerta', ico: 'planeacion' })}
      </div>
      <section class="tarjeta">${tabla('pedidos', {
        titulo: 'Pedidos de clientes', exportar: 'pedidos', orden: ['Pedido', 'desc'], placeholder: 'Pedido, cliente, producto…',
        columnas: [
          { t: 'Pedido', v: p => docLink(p.folio), o: p => p.folio },
          { t: 'Cliente', v: p => esc(cliente(p.cliente).nombre), o: p => cliente(p.cliente).nombre },
          { t: 'Productos', v: p => p.lineas.map(l => `${fmt.num(l.cantidad)} × ${esc(producto(l.producto).nombre)}`).join('<br>'), o: p => p.lineas.map(l => producto(l.producto).nombre).join(' ') },
          { t: 'Fecha', v: p => fmt.fecha(p.fecha), o: p => p.fecha },
          { t: 'Comprometida', v: p => fmt.fecha(p.comprometida), o: p => p.comprometida },
          { t: 'Despacho', v: p => fmt.fecha(p.despacho), o: p => p.despacho || '' },
          { t: 'Entrega', v: p => p.entrega ? `${fmt.fecha(p.entrega)}<br>${p.aTiempo && p.completo ? pill('OTIF', 'bien') : pill(p.aTiempo ? 'Incompleto' : 'Tarde', 'critico')}` : '—', o: p => p.entrega || '' },
          { t: 'Envío', num: true, v: p => fmt.mxn(p.costoEnvio, 0), o: p => p.costoEnvio },
          { t: 'Estado', v: p => pill(estadoPedido(p)), o: p => estadoPedido(p) },
          { t: 'Siguiente paso', v: p => { const a = { 'Registrado': ['ped-reservar', 'Reservar'], 'Reservado parcial': ['ped-reservar', 'Reservar faltante'], 'Reservado': ['ped-preparar', 'Preparar'], 'En preparación': ['ped-despachar', 'Despachar'], 'Despachado': ['ped-entregar', 'Registrar entrega'] }[p.estado]; return a ? btnAcc(a[0], p.folio, a[1], { clase: 'btn btn-chico', permiso: 'pedido' }) : ''; } },
        ],
        filas: S.pedidos,
        filtros: [{ id: 'e', t: 'Estado', valor: estadoPedido }, { id: 'c', t: 'Cliente', valor: p => cliente(p.cliente).nombre }],
        claseFila: p => estadoPedido(p) === 'Retrasado' ? 'fila-mal' : '',
      })}</section>
      <section class="tarjeta"><h2>Cumplimiento de fechas por cliente</h2>${tabla('porcli', { sinBarra: true, columnas: [
        { t: 'Cliente', v: c => esc(c.nombre) }, { t: 'Zona', v: c => esc(c.zona) }, { t: 'Entregados', num: true, v: c => fmt.num(c.ent.length) },
        { t: 'A tiempo y completos', v: c => c.ent.length ? barraProgreso(100 * c.ent.filter(p => p.aTiempo && p.completo).length / c.ent.length, 100 * c.ent.filter(p => p.aTiempo && p.completo).length / c.ent.length >= S.config.metas.otif ? 'bien' : 'alerta') : '<span class="tenue">Sin datos suficientes</span>' },
        { t: 'Costo de envío promedio', num: true, v: c => c.ent.length ? fmt.mxn(promedio(c.ent.map(p => p.costoEnvio)), 0) : '—' },
      ], filas: S.clientes.map(c => ({ ...c, ent: S.pedidos.filter(p => p.cliente === c.codigo && p.estado === 'Entregado') })) })}</section>`;
  },
};

MODULOS.incidencias = {
  titulo: 'Incidencias', icono: 'incidencia', grupo: 'Distribución',
  render(main) {
    const abiertas = S.incidencias.filter(i => !['Resuelta', 'Cerrada'].includes(i.estado));
    const vencidas = abiertas.filter(i => i.compromiso < hoy());
    // impacto en KPIs: qué indicadores tocan las incidencias abiertas
    const kpiDe = { 'Retraso del proveedor': 'Cumplimiento de proveedores, entregas de entrada', 'Daño durante el transporte': 'Desperdicio, entregas de entrada', 'Diferencias de inventario': 'Exactitud del inventario', 'Faltante de materiales': 'Cumplimiento del plan, OTIF', 'Defectos de fabricación': 'Rendimiento de calidad, OEE, desperdicio', 'Paro de maquinaria': 'OEE, cumplimiento del plan', 'Pedido incompleto': 'OTIF', 'Error documental': 'Ciclo de compras' };
    const porTipo = agrupar(abiertas, i => i.tipo);
    main.innerHTML = `
      ${encabezado('Gestión de incidencias', 'Problemas logísticos y productivos: registro, asignación, seguimiento y cierre.', btnAcc('inc-nueva', '', 'Registrar incidencia', { clase: '', ico: 'mas', permiso: 'incidencia' }))}
      <div class="indicadores">
        ${indicador({ titulo: 'Incidencias abiertas', valor: fmt.num(abiertas.length), estado: abiertas.length ? 'alerta' : 'bien', ico: 'incidencia' })}
        ${indicador({ titulo: 'Severidad alta o crítica', valor: fmt.num(abiertas.filter(i => ['Alta', 'Crítica'].includes(i.severidad)).length), estado: abiertas.some(i => ['Alta', 'Crítica'].includes(i.severidad)) ? 'critico' : 'bien', ico: 'campana' })}
        ${indicador({ titulo: 'Con compromiso vencido', valor: fmt.num(vencidas.length), estado: vencidas.length ? 'critico' : 'bien', ico: 'planeacion' })}
        ${indicador({ titulo: 'Resueltas en 30 días', valor: fmt.num(S.incidencias.filter(i => i.fechaCierre && i.fechaCierre >= sumarDias(hoy(), -30)).length), estado: 'info', ico: 'check' })}
      </div>
      <div class="rejilla r2">
        <section class="tarjeta"><h2>Incidencias por área (todas)</h2><div class="grafica" id="gArea"></div></section>
        <section class="tarjeta"><h2>Impacto de las abiertas sobre los KPIs</h2>${Object.keys(porTipo).length ? `<ul class="lista-al">${Object.entries(porTipo).map(([t, l]) => `<li><button data-doc="${l[0].folio}"><span class="ic alerta">!</span><span><b>${esc(t)} · ${l.length}</b><small>Afecta: ${esc(kpiDe[t] || '—')}</small></span></button></li>`).join('')}</ul>` : '<p class="vacio">No hay incidencias abiertas.</p>'}</section>
      </div>
      <section class="tarjeta">${tabla('incs', {
        titulo: 'Incidencias', exportar: 'incidencias', orden: ['Folio', 'desc'],
        columnas: [
          { t: 'Folio', v: i => docLink(i.folio), o: i => i.folio },
          { t: 'Fecha', v: i => fmt.fecha(i.fecha), o: i => i.fecha },
          { t: 'Área', v: i => esc(i.area), o: i => i.area },
          { t: 'Tipo', v: i => esc(i.tipo), o: i => i.tipo },
          { t: 'Operación', v: i => documento(i.operacion) ? docLink(i.operacion) : esc(i.operacion || '—'), o: i => i.operacion },
          { t: 'Descripción', v: i => `<span title="${esc(i.descripcion)}">${esc(i.descripcion.length > 60 ? i.descripcion.slice(0, 58) + '…' : i.descripcion)}</span>`, o: i => i.descripcion },
          { t: 'Severidad', v: i => pill(i.severidad), o: i => SEVERIDADES.indexOf(i.severidad) },
          { t: 'Responsable', v: i => esc(i.responsable), o: i => i.responsable },
          { t: 'Compromiso', v: i => fmt.fecha(i.compromiso) + (i.compromiso < hoy() && !['Resuelta', 'Cerrada'].includes(i.estado) ? '<br>' + pill('Vencido', 'critico') : ''), o: i => i.compromiso },
          { t: 'Estado', v: i => pill(i.estado), o: i => i.estado },
          { t: '', v: i => btnAcc('inc-actualizar', i.folio, ['Resuelta', 'Cerrada'].includes(i.estado) ? 'Editar' : 'Actualizar', { permiso: 'incidencia' }) },
        ],
        filas: S.incidencias,
        filtros: [{ id: 'e', t: 'Estado', valor: i => i.estado }, { id: 't', t: 'Tipo', valor: i => i.tipo, opciones: TIPOS_INCIDENCIA }, { id: 'a', t: 'Área', valor: i => i.area }, { id: 's', t: 'Severidad', valor: i => i.severidad, opciones: SEVERIDADES }],
      })}</section>`;
    const areas = agrupar(S.incidencias, i => i.area);
    const claves = Object.keys(areas).sort();
    dibujos.push(() => graficaBarras(document.getElementById('gArea'), { etiquetas: claves, formato: v => fmt.num(v),
      series: [{ nombre: 'Abiertas', valores: claves.map(a => areas[a].filter(i => !['Resuelta', 'Cerrada'].includes(i.estado)).length), color: 'var(--s8)' }, { nombre: 'Resueltas o cerradas', valores: claves.map(a => areas[a].filter(i => ['Resuelta', 'Cerrada'].includes(i.estado)).length), color: 'var(--s3)' }] }));
  },
};
