// Planeación de producción · Manufactura · Productos terminados.
'use strict';

MODULOS.planeacion = {
  titulo: 'Planeación de producción', menu: 'Planeación', icono: 'planeacion', grupo: 'Operación', vista: 'tabla', semana: 0,
  render(main) {
    const r = periodoActual();
    const k = calcularKPIs(r);
    const K = c => k.find(x => x.clave === c);
    const noPueden = S.ordenesProduccion.filter(o => ['Planificada', 'Pendiente de materiales'].includes(o.estado) && requerimientosOP(o).some(x => x.pendiente > x.reservado + x.disponible + 1e-6));
    main.innerHTML = `
      ${encabezado('Planeación y control de producción', `Órdenes de fabricación, materiales requeridos y calendario. Indicadores ${tituloPeriodo(r)}.`,
        btnAcc('op-nueva', '', 'Crear orden de producción', { clase: '', ico: 'mas', permiso: 'produccion' }))}
      <div class="indicadores">
        ${indicador({ titulo: 'Cumplimiento del plan', valor: formatoKPI(K('planProduccion')), estado: K('planProduccion').semaforo, ico: 'planeacion', nota: esc(K('planProduccion').detalle) })}
        ${indicador({ titulo: 'Órdenes en proceso / pausadas', valor: `${S.ordenesProduccion.filter(o => o.estado === 'En proceso').length} / ${S.ordenesProduccion.filter(o => o.estado === 'Pausada').length}`, estado: 'info', ico: 'fabrica' })}
        ${indicador({ titulo: 'Órdenes que no pueden iniciar', valor: fmt.num(noPueden.length), estado: noPueden.length ? 'critico' : 'bien', ico: 'incidencia', nota: noPueden.map(o => o.folio).join(', ') || 'Todas tienen material' })}
        ${indicador({ titulo: 'OEE del periodo', valor: formatoKPI(K('oee')), estado: K('oee').semaforo, ico: 'kpi', nota: esc(K('oee').detalle) })}
      </div>
      <div class="pestanas">${[['tabla', 'Órdenes de producción'], ['calendario', 'Calendario'], ['comparacion', 'Plan contra real']].map(([id, t]) => `<button class="${this.vista === id ? 'activa' : ''}" data-vista="${id}">${t}</button>`).join('')}</div>
      <div id="vistaCont"></div>`;
    main.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => { this.vista = b.dataset.vista; refrescar(); });
    const c = main.querySelector('#vistaCont');
    if (this.vista === 'tabla') c.innerHTML = `<section class="tarjeta">${tabla('ops', {
      titulo: 'Órdenes de producción', exportar: 'ordenes-produccion', orden: ['Folio', 'desc'], placeholder: 'Folio, producto, línea…',
      columnas: [
        { t: 'Folio', v: o => docLink(o.folio), o: o => o.folio },
        { t: 'Producto', v: o => esc(producto(o.producto).nombre), o: o => producto(o.producto).nombre },
        { t: 'Planificada', num: true, v: o => fmt.num(o.planificada), o: o => o.planificada },
        { t: 'Fabricada', num: true, v: o => fmt.num(o.fabricada), o: o => o.fabricada },
        { t: 'Aceptada', num: true, v: o => fmt.num(o.aceptada), o: o => o.aceptada },
        { t: 'Defectuosa', num: true, v: o => fmt.num(o.defectuosa), o: o => o.defectuosa },
        { t: 'Inicio plan / real', v: o => `${fmt.fecha(o.iniPlan)}<br><small class="tenue">${o.iniReal ? fmt.fechaHora(o.iniReal) : '—'}</small>`, o: o => o.iniPlan },
        { t: 'Fin plan / real', v: o => `${fmt.fecha(o.finPlan)}<br><small class="tenue">${o.finReal ? fmt.fechaHora(o.finReal) : '—'}</small>`, o: o => o.finPlan },
        { t: 'Línea', v: o => esc(o.linea), o: o => o.linea },
        { t: 'Responsable', v: o => esc(o.responsable), o: o => o.responsable },
        { t: 'Materiales', v: o => { const req = requerimientosOP(o); const f = req.filter(x => x.pendiente > 0); return o.estado === 'Terminada' || o.estado === 'Cancelada' ? '<span class="tenue">—</span>' : f.length ? pill(`Faltan ${f.length}`, f.some(x => x.pendiente > x.reservado + x.disponible) ? 'critico' : 'alerta') : pill('Surtidos', 'bien'); }, o: o => requerimientosOP(o).filter(x => x.pendiente > 0).length },
        { t: 'Avance', v: o => barraProgreso(100 * o.aceptada / o.planificada), o: o => o.aceptada / o.planificada },
        { t: 'Estado', v: o => pill(o.estado), o: o => o.estado },
      ],
      filas: S.ordenesProduccion,
      filtros: [{ id: 'est', t: 'Estado', valor: o => o.estado }, { id: 'lin', t: 'Línea', valor: o => o.linea }, { id: 'prod', t: 'Producto', valor: o => producto(o.producto).nombre }],
      claseFila: o => o.estado === 'Pendiente de materiales' ? 'fila-mal' : o.estado === 'Pausada' ? 'fila-alerta' : '',
    })}</section>`;
    if (this.vista === 'calendario') {
      const base = sumarDias(hoy(), -((diaSemana(hoy()) + 6) % 7) + 7 * this.semana);
      const dias = rangoFechas(base, sumarDias(base, 6));
      c.innerHTML = `<section class="tarjeta"><div class="tarjeta-cab"><h2>Semana del ${fmt.fecha(base)}</h2><div class="acciones-fila"><button class="btn btn-sec btn-chico" data-sem="-1">← Anterior</button><button class="btn btn-sec btn-chico" data-sem="0">Esta semana</button><button class="btn btn-sec btn-chico" data-sem="1">Siguiente →</button></div></div>
        <div style="overflow-x:auto"><div class="calendario"><div class="cab">Línea</div>${dias.map(d => `<div class="cab">${DIAS_SEM[diaSemana(d)].slice(0, 3)} ${fmt.fechaCorta(d)}${d === hoy() ? ' · hoy' : ''}</div>`).join('')}
        ${S.lineas.map(l => `<div class="cab">${esc(l.nombre.split(' · ')[0])}<br><small class="tenue">${esc(l.nombre.split(' · ')[1] || '')}</small></div>${dias.map(d => `<div>${S.ordenesProduccion.filter(o => o.linea === l.codigo && o.iniPlan <= d && o.finPlan >= d && o.estado !== 'Cancelada').map(o => `<button class="cal-op ${o.estado.split(' ')[0]}" data-doc="${o.folio}">${o.folio} · ${esc(producto(o.producto).nombre)}<br>${fmt.num(o.planificada)} u · ${esc(o.estado)}</button>`).join('')}</div>`).join('')}`).join('')}
        </div></div></section>`;
      c.querySelectorAll('[data-sem]').forEach(b => b.onclick = () => { this.semana = b.dataset.sem === '0' ? 0 : this.semana + Number(b.dataset.sem); refrescar(); });
    }
    if (this.vista === 'comparacion') {
      const serie = rangoFechas(r.desde, r.hasta).map(f => {
        const ops = S.ordenesProduccion.filter(o => o.finPlan === f && o.estado !== 'Cancelada' && f <= hoy());
        return { f, plan: ops.length ? suma(ops, o => o.planificada) : null, real: ops.length ? suma(ops, o => o.aceptada) : null };
      });
      c.innerHTML = `<section class="tarjeta"><h2>Producción planificada contra real</h2><p class="nota">Unidades por fecha de fin planificada.</p><div class="grafica" id="gPlan"></div></section>
        <section class="tarjeta"><h2>Por línea</h2>${tabla('porlinea', { sinBarra: true, columnas: [
          { t: 'Línea', v: l => esc(l.nombre) }, { t: 'Órdenes', num: true, v: l => fmt.num(l.n) }, { t: 'Planificadas', num: true, v: l => fmt.num(l.plan) }, { t: 'Aceptadas', num: true, v: l => fmt.num(l.acept) },
          { t: 'Cumplimiento', v: l => barraProgreso(l.plan ? 100 * l.acept / l.plan : 0, l.plan && 100 * l.acept / l.plan >= S.config.metas.planProduccion ? 'bien' : 'alerta') }, { t: 'Paros (min)', num: true, v: l => fmt.num(l.paros) },
        ], filas: S.lineas.map(l => { const ops = S.ordenesProduccion.filter(o => o.linea === l.codigo && enRango(o.finPlan, r) && o.finPlan <= hoy() && o.estado !== 'Cancelada'); return { ...l, n: ops.length, plan: suma(ops, o => o.planificada), acept: suma(ops, o => o.aceptada), paros: suma(ops.flatMap(o => o.paros), p => p.minutos) }; }) })}</section>`;
      dibujos.push(() => graficaBarras(document.getElementById('gPlan'), { etiquetas: serie.map(x => x.f), etqFormato: fmt.fechaCorta, etqLarga: fmt.fecha, formato: v => fmt.num(v),
        series: [{ nombre: 'Aceptadas', valores: serie.map(x => x.real), color: 'var(--s3)' }, { nombre: 'Faltante contra plan', valores: serie.map(x => x.plan == null ? null : Math.max(0, x.plan - x.real)), color: 'var(--s8)' }] }));
    }
  },
};

// ================================================================ MANUFACTURA

MODULOS.manufactura = {
  titulo: 'Manufactura', icono: 'fabrica', grupo: 'Operación', opSel: null,
  render(main) {
    const activas = S.ordenesProduccion.filter(o => ['En proceso', 'Pausada'].includes(o.estado));
    const recientes = S.ordenesProduccion.filter(o => o.estado === 'Terminada').slice(-6).reverse();
    const ecobox = S.ordenesProduccion.filter(o => o.producto === 'PT-001' && ['En proceso', 'Pausada', 'Terminada'].includes(o.estado)).pop();
    if (!this.opSel || !buscarPor('ordenesProduccion', this.opSel)) this.opSel = (activas.find(o => o.producto === 'PT-001') || activas[0] || ecobox || recientes[0] || {}).folio;
    const op = this.opSel && buscarPor('ordenesProduccion', this.opSel);
    const ops = op ? operacionesDe(op.folio) : [];
    const cuello = ops.length ? ops.filter(o => o.procesada > 0 && o.tReal > 0).sort((a, b) => (b.tReal / (b.procesada * b.tEstUnit)) - (a.tReal / (a.procesada * a.tEstUnit)))[0] : null;
    const wip = ops.filter(o => entradaPendiente(o) > 0 && o.etapa > 1).sort((a, b) => entradaPendiente(b) - entradaPendiente(a))[0];
    const pendientes = op ? op.planificada - (ops[0] ? ops[0].procesada : 0) : 0;
    const enProceso = ops.length ? suma(ops.slice(1), o => entradaPendiente(o)) : 0;
    main.innerHTML = `
      ${encabezado('Manufactura', 'Seguimiento operativo por etapa. Ejemplo principal: <b>EcoBox Industrial</b>, caja organizadora reutilizable de componentes plásticos y metálicos.')}
      <section class="tarjeta"><div class="tarjeta-cab"><h2>Orden en piso</h2>
        <label class="filtro">Orden <select id="selOp">${[...activas, ...recientes].map(o => `<option value="${o.folio}" ${o.folio === this.opSel ? 'selected' : ''}>${o.folio} · ${esc(producto(o.producto).nombre)} · ${esc(o.estado)}</option>`).join('')}</select></label></div>
      ${op ? `<div class="campos campos-4">
          <div><span>Orden</span>${docLink(op.folio)} ${pill(op.estado)}</div><div><span>Producto</span>${esc(producto(op.producto).nombre)}</div><div><span>Línea</span>${esc(linea(op.linea).nombre)}</div><div><span>Responsable</span>${esc(op.responsable)}</div>
          <div><span>Programadas</span>${fmt.num(op.planificada)}</div><div><span>Aceptadas (en almacén PT)</span>${fmt.num(op.aceptada)}</div><div><span>Defectuosas</span>${fmt.num(op.defectuosa)}</div><div><span>Avance</span>${barraProgreso(100 * op.aceptada / op.planificada)}</div></div>
        <p class="nota" style="margin-top:10px">Conciliación: ${fmt.num(op.planificada)} programadas = ${fmt.num(op.aceptada)} aceptadas + ${fmt.num(op.defectuosa)} defectuosas + ${fmt.num(enProceso)} en proceso + ${fmt.num(pendientes)} sin iniciar ${op.aceptada + op.defectuosa + enProceso + pendientes === op.planificada ? pill('Cuadra', 'bien') : pill('Revisar', 'critico')}</p>
        <div class="acciones-fila" style="margin:8px 0 14px">${op.estado === 'En proceso' ? btnAcc('op-pausar', op.folio, 'Registrar paro', { permiso: 'produccion' }) + btnAcc('op-completar', op.folio, 'Completar fabricación', { clase: 'btn-verde btn-chico', permiso: 'produccion' }) : ''}${op.estado === 'Pausada' ? btnAcc('op-reanudar', op.folio, 'Reanudar', { clase: 'btn btn-chico', permiso: 'produccion' }) : ''}${['Lista para iniciar', 'Planificada', 'Pendiente de materiales'].includes(op.estado) ? btnAcc('op-iniciar', op.folio, 'Iniciar', { clase: 'btn btn-chico', permiso: 'produccion' }) : ''}</div>
        ${ops.length ? `<div class="etapas">${ops.map(o => {
          const ent = entradaPendiente(o);
          const rend = o.tReal ? 100 * o.procesada * o.tEstUnit / o.tReal : null;
          const esCuello = (cuello && cuello.folio === o.folio && rend < 95) || (wip && wip.folio === o.folio);
          return `<article class="etapa ${o.estado} ${esCuello ? 'cuello' : ''}">
            <h3>${o.etapa}. ${esc(o.operacion)}</h3>${pill(o.estado)}${esCuello ? pill('Cuello de botella', 'alerta') : ''}
            <div class="num-grande">${fmt.num(o.aceptada)}<small class="tenue"> aceptadas</small></div>
            ${barraProgreso(100 * o.procesada / (o.programada || 1))}
            <dl><dt>Procesadas</dt><dd>${fmt.num(o.procesada)}</dd><dt>Defectuosas</dt><dd>${fmt.num(o.defectuosa)}</dd><dt>Por procesar</dt><dd>${fmt.num(ent)}</dd>
            <dt>T. estándar</dt><dd>${fmt.num(o.procesada * o.tEstUnit, 0)} min</dd><dt>T. real</dt><dd>${fmt.num(o.tReal, 0)} min</dd><dt>Rendimiento</dt><dd>${rend == null ? '—' : fmt.pct(rend, 0)}</dd></dl>
            ${o.observaciones ? `<small class="tenue">${esc(o.observaciones)}</small>` : ''}
            <div class="acciones-fila">${op.estado === 'En proceso' && ent > 0 ? btnAcc('ope-avance', o.folio, 'Registrar avance', { clase: 'btn btn-chico', permiso: 'produccion' }) : ''}${o.etapa === 4 && op.estado === 'En proceso' ? btnAcc('ope-inspeccion', o.folio, 'Inspección', { permiso: 'produccion' }) : ''}${op.estado === 'En proceso' && o.estado === 'En proceso' && ent > 0 ? btnAcc('ope-pausar', o.folio, 'Pausar', { permiso: 'produccion' }) : ''}${o.estado === 'Pausada' ? btnAcc('ope-iniciar', o.folio, 'Reanudar', { permiso: 'produccion' }) : ''}</div>
          </article>`; }).join('')}</div>` : `<p class="vacio">La orden aún no inicia. Primero surte el material y pulsa «Iniciar».</p>`}`
        : '<p class="vacio">No hay órdenes en piso.</p>'}
      </section>
      <div class="rejilla r2">
        <section class="tarjeta"><h2>Causas de defectos (30 días)</h2><div class="grafica" id="gDef"></div></section>
        <section class="tarjeta"><h2>Registros de operaciones</h2>${tabla('opes', { orden: ['Folio', 'desc'], porPagina: 8, exportar: 'operaciones', columnas: [
          { t: 'Folio', v: o => docLink(o.folio), o: o => o.folio }, { t: 'Orden', v: o => docLink(o.op), o: o => o.op }, { t: 'Operación', v: o => esc(o.operacion), o: o => o.operacion },
          { t: 'Procesadas', num: true, v: o => fmt.num(o.procesada), o: o => o.procesada }, { t: 'Defectuosas', num: true, v: o => fmt.num(o.defectuosa), o: o => o.defectuosa },
          { t: 'Real (min)', num: true, v: o => fmt.num(o.tReal, 0), o: o => o.tReal }, { t: 'Estado', v: o => pill(o.estado), o: o => o.estado },
        ], filas: S.operaciones, filtros: [{ id: 'et', t: 'Etapa', valor: o => o.operacion }] })}</section>
      </div>`;
    main.querySelector('#selOp')?.addEventListener('change', e => { this.opSel = e.target.value; refrescar(); });
    const desde = sumarDias(hoy(), -30);
    const causas = agrupar(S.operaciones.filter(o => S.ordenesProduccion.some(x => x.folio === o.op && (x.iniReal || '') >= desde)).flatMap(o => o.defectos), d => d.causa);
    const datos = Object.entries(causas).map(([c, l]) => [c, suma(l, x => x.cantidad)]).sort((a, b) => b[1] - a[1]);
    dibujos.push(() => graficaBarras(document.getElementById('gDef'), { etiquetas: datos.map(d => d[0]), etqFormato: c => c.split(' ')[0], etqLarga: c => c, formato: v => fmt.num(v) + ' u', series: [{ nombre: 'Unidades', valores: datos.map(d => d[1]), color: 'var(--s8)' }] }));
  },
};

// ======================================================= PRODUCTOS TERMINADOS

MODULOS.terminados = {
  titulo: 'Productos terminados', icono: 'caja', grupo: 'Operación',
  render(main) {
    const lotes = S.lotesPT.filter(l => l.existencia > 0);
    main.innerHTML = `
      ${encabezado('Productos terminados', 'Cada lote nace de una orden de producción terminada y aprobada (o de una devolución en inspección); el inventario no se modifica a mano.')}
      <div class="indicadores">
        ${indicador({ titulo: 'Unidades en existencia', valor: fmt.num(suma(lotes, l => l.existencia)), estado: 'info', ico: 'caja', nota: `${lotes.length} lotes` })}
        ${indicador({ titulo: 'Valor (a costo)', valor: fmt.mxnCorto(suma(lotes, l => l.existencia * l.costoUnit)), estado: 'info', ico: 'reporte' })}
        ${indicador({ titulo: 'Reservadas para pedidos', valor: fmt.num(suma(lotes, l => l.reservada)), estado: 'info', ico: 'pedido' })}
        ${indicador({ titulo: 'Lotes bloqueados', valor: fmt.num(lotes.filter(l => l.calidad === 'Bloqueado').length), estado: lotes.some(l => l.calidad === 'Bloqueado') ? 'alerta' : 'bien', ico: 'incidencia' })}
      </div>
      <section class="tarjeta"><h2>Existencias por producto</h2>${tabla('ptprod', { sinBarra: true, columnas: [
        { t: 'Código', v: p => docLink(p.codigo) }, { t: 'Producto', v: p => esc(p.nombre) },
        { t: 'Existencia', num: true, v: p => fmt.num(suma(lotes.filter(l => l.producto === p.codigo), l => l.existencia)) },
        { t: 'Reservada', num: true, v: p => fmt.num(suma(lotes.filter(l => l.producto === p.codigo), l => l.reservada)) },
        { t: 'Disponible', num: true, v: p => `<b>${fmt.num(disponiblePT(p.codigo))}</b>` },
        { t: 'Pedidos abiertos', num: true, v: p => fmt.num(suma(S.pedidos.filter(x => !['Entregado', 'Cancelado', 'Despachado'].includes(x.estado)).flatMap(x => x.lineas).filter(l => l.producto === p.codigo), l => l.cantidad - l.despachada)) },
        { t: 'Precio', num: true, v: p => fmt.mxn(p.precio) },
      ], filas: S.productos })}</section>
      <section class="tarjeta">${tabla('lpt', {
        titulo: 'Lotes de producto terminado', exportar: 'producto-terminado', orden: ['Lote', 'desc'],
        columnas: [
          { t: 'Código', v: l => docLink(l.producto), o: l => l.producto },
          { t: 'Nombre', v: l => esc(producto(l.producto).nombre), o: l => producto(l.producto).nombre },
          { t: 'Lote', v: l => docLink(l.lote), o: l => l.lote },
          { t: 'Orden de origen', v: l => l.op ? docLink(l.op) : `<span class="tenue">${l.devolucionDe ? 'Devolución ' + esc(l.devolucionDe) : 'Inventario inicial'}</span>`, o: l => l.op || '' },
          { t: 'Fabricación', v: l => fmt.fecha(l.fecha), o: l => l.fecha },
          { t: 'Fabricada', num: true, v: l => fmt.num(l.fabricada), o: l => l.fabricada },
          { t: 'Aprobada', num: true, v: l => fmt.num(l.aprobada), o: l => l.aprobada },
          { t: 'Disponible', num: true, v: l => `<b>${fmt.num(l.calidad === 'Aprobado' ? l.existencia - l.reservada : 0)}</b> <small class="tenue">de ${fmt.num(l.existencia)}</small>`, o: l => l.existencia - l.reservada },
          { t: 'Ubicación', v: l => esc(l.ubicacion), o: l => l.ubicacion },
          { t: 'Costo unit.', num: true, v: l => fmt.mxn(l.costoUnit), o: l => l.costoUnit },
          { t: 'Calidad', v: l => pill(l.calidad), o: l => l.calidad },
          { t: 'Acciones', v: l => `<div class="acciones-fila">${l.calidad === 'Aprobado' ? btnAcc('lpt-bloquear', l.lote, 'Bloquear', { permiso: 'terminado' }) : btnAcc('lpt-liberar', l.lote, 'Liberar', { permiso: 'terminado' })}${btnAcc('lpt-transferir', l.lote, 'Mover', { permiso: 'terminado' })}</div>` },
        ],
        filas: lotes, filtros: [{ id: 'p', t: 'Producto', valor: l => producto(l.producto).nombre }, { id: 'c', t: 'Calidad', valor: l => l.calidad }],
      })}</section>`;
  },
};
