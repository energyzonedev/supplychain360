// KPIs y analítica · Reportes y exportación.
'use strict';

MODULOS.kpis = {
  titulo: 'KPIs y analítica', icono: 'kpi', grupo: 'Análisis',
  f: { dias: 0, desde: '', hasta: '', proveedor: '', material: '', producto: '' }, area: '', sel: 'otif',
  rango() {
    if (this.f.desde && this.f.hasta && this.f.hasta >= this.f.desde) return { desde: this.f.desde, hasta: this.f.hasta, dias: diasEntre(this.f.desde, this.f.hasta) + 1 };
    return periodoDesde(this.f.dias || periodoDias);
  },
  render(main) {
    const r = this.rango();
    const filtros = { proveedor: this.f.proveedor, material: this.f.material, producto: this.f.producto };
    const todos = kpisConTendencia(r, filtros);
    const kpis = this.area ? todos.filter(k => k.grupo === this.area) : todos;
    const sel = todos.find(k => k.clave === this.sel) || todos[0];
    const grupos = [...new Set(DEF_KPI.map(d => d[1]))];
    const cuenta = t => todos.filter(k => k.semaforo === t).length;
    const fuera = todos.filter(k => ['alerta', 'critico'].includes(k.semaforo));
    const hayFiltros = this.f.proveedor || this.f.material || this.f.producto || this.f.desde;
    const sel_ = (id, etq, ops) => `<label class="filtro">${etq}<select data-kf="${id}"><option value="">Todos</option>${ops.map(([v, t]) => `<option value="${esc(v)}" ${this.f[id] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const estadoTxt = k => ({ bien: 'En meta', alerta: 'Atención', critico: 'Fuera de meta', info: 'Seguimiento', sindatos: 'Sin datos' })[k.semaforo];
    const tono = k => (k.semaforo === 'sindatos' || k.semaforo === 'info' ? 'neutro' : k.semaforo);
    const flecha = k => (k.delta == null || k.delta === 0 ? '' : `<span class="delta ${k.mayorMejor == null ? '' : (k.delta > 0) === k.mayorMejor ? 'mejor' : 'peor'}" title="Contra el periodo anterior">${k.delta > 0 ? '▲' : '▼'}</span>`);

    main.innerHTML = `
      ${encabezado('KPIs y analítica', `${tituloPeriodo(r)} · comparado contra los ${r.dias} días anteriores.`,
        `<label class="filtro filtro-linea">Periodo<select data-kf="dias">${[[0, `${periodoDias} días (cabecera)`], [7, '7 días'], [15, '15 días'], [30, '30 días']].map(([v, t]) => `<option value="${v}" ${Number(this.f.dias) === v && !this.f.desde ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
         <button class="btn btn-sec" id="kExport">${icono('descarga')} Exportar</button>`)}
      <div class="kpi-resumen">
        <div class="kr bien"><b>${cuenta('bien')}</b><span>en meta</span></div>
        <div class="kr alerta"><b>${cuenta('alerta')}</b><span>en atención</span></div>
        <div class="kr critico"><b>${cuenta('critico')}</b><span>fuera de meta</span></div>
        <div class="kr"><b>${cuenta('info') + cuenta('sindatos')}</b><span>de seguimiento</span></div>
      </div>
      <div class="pestanas">${[['', 'Todos'], ...grupos.map(g => [g, g])].map(([v, t]) => `<button class="${this.area === v ? 'activa' : ''}" data-karea="${esc(v)}">${esc(t)}</button>`).join('')}</div>
      <details class="mas-filtros" ${hayFiltros ? 'open' : ''}><summary>Más filtros${hayFiltros ? ' (activos)' : ''}</summary>
        <div class="acciones-fila" style="align-items:flex-end;margin-top:10px">
          <label class="filtro">Desde<input type="date" data-kf="desde" value="${this.f.desde}" max="${hoy()}"></label>
          <label class="filtro">Hasta<input type="date" data-kf="hasta" value="${this.f.hasta}" max="${hoy()}"></label>
          ${sel_('proveedor', 'Proveedor', S.proveedores.map(p => [p.codigo, p.razon]))}
          ${sel_('material', 'Material', S.materiales.map(m => [m.codigo, m.descripcion]))}
          ${sel_('producto', 'Producto', S.productos.map(p => [p.codigo, p.nombre]))}
          <button class="btn btn-sec btn-chico" id="kLimpiar">Limpiar</button>
        </div>
        <p class="nota" style="margin-top:6px">Proveedor y material filtran compras, transporte y almacén; producto filtra producción y distribución.</p>
      </details>
      <div class="kpi-grid">${kpis.map(k => `
        <button class="kpi-card ${k.semaforo}${k.clave === sel.clave ? ' sel' : ''}" data-ksel="${k.clave}">
          <span class="kc-nombre">${esc(k.nombre)}</span>
          <span class="kc-valor">${esc(formatoKPI(k))} ${flecha(k)}</span>
          <span class="kc-pie"><span>Meta ${esc(k.meta == null ? '—' : formatoMeta(k))}</span>${pill(estadoTxt(k), tono(k))}</span>
        </button>`).join('')}</div>
      <div class="rejilla r21">
        <section class="tarjeta" id="kDetalle"><div class="tarjeta-cab"><div><span class="nota">${esc(sel.grupo)}</span><h2>${esc(sel.nombre)}</h2></div>${pill(estadoTxt(sel), tono(sel))}</div>
          <div class="kd-cifras">
            <div><span>Valor actual</span><b>${esc(formatoKPI(sel))}</b></div>
            <div><span>Meta</span><b>${esc(sel.meta == null ? '—' : formatoMeta(sel))}</b></div>
            <div><span>Periodo anterior</span><b>${sel.anterior == null ? '—' : esc(formatoKPI(sel, sel.anterior))}</b></div>
          </div>
          <div class="grafica" id="kTend"></div>
          <p class="nota" style="margin-top:4px">Tendencia: ventana móvil de 7 días.</p>
          <details style="margin-top:10px"><summary class="nota" style="cursor:pointer">Definición, fórmula e interpretación</summary>
            <div class="calculo" style="margin-top:8px"><b>Definición.</b> ${esc(sel.definicion)}<br><b>Fórmula.</b> ${esc(sel.formula)}<br><b>Cálculo.</b> ${esc(sel.detalle || '—')}<br><b>Interpretación.</b> ${esc(sel.interpretacion)}</div></details>
        </section>
        <section class="tarjeta"><h2>Qué atender</h2>
          ${fuera.length ? `<ul class="lista-al" style="margin:10px 0 14px">${fuera.map(k => `<li><button data-ksel="${k.clave}"><span class="ic ${k.semaforo}">${k.semaforo === 'critico' ? '✕' : '!'}</span><span><b>${esc(k.nombre)}</b><small>${esc(formatoKPI(k))} · meta ${esc(formatoMeta(k))}</small></span></button></li>`).join('')}</ul>` : '<p class="vacio">Todos los indicadores con meta están en rango.</p>'}
          <details><summary class="nota" style="cursor:pointer">Recomendaciones operativas</summary><ul class="pasos-guia" style="margin-top:8px">${recomendaciones(todos).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
        </section>
      </div>`;

    main.querySelectorAll('[data-kf]').forEach(el => el.addEventListener('change', () => {
      this.f[el.dataset.kf] = el.value;
      if (el.dataset.kf === 'dias') { this.f.desde = ''; this.f.hasta = ''; }
      refrescar();
    }));
    main.querySelectorAll('[data-karea]').forEach(b => b.onclick = () => { this.area = b.dataset.karea; refrescar(); });
    main.querySelector('#kLimpiar').onclick = () => { this.f = { dias: 0, desde: '', hasta: '', proveedor: '', material: '', producto: '' }; refrescar(); };
    main.querySelectorAll('[data-ksel]').forEach(b => b.onclick = () => {
      this.sel = b.dataset.ksel;
      refrescar();
      document.getElementById('kDetalle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    main.querySelector('#kExport').onclick = () => exportarCSV(`sc360-kpis-${r.desde}-${r.hasta}`,
      [`SupplyChain 360 AI · ${EMPRESA.nombre}`, 'Reporte: KPIs globales', `Periodo evaluado: ${fmt.fecha(r.desde)} a ${fmt.fecha(r.hasta)} (${r.dias} días)`, `Filtros: ${['proveedor', 'material', 'producto'].filter(k => this.f[k]).map(k => `${k}=${this.f[k]}`).join('; ') || 'ninguno'}`, `Generado: ${fmt.fechaHora(ahoraMexico())} (hora de México)`, 'Datos ficticios de demostración'],
      ['Grupo', 'Indicador', 'Valor', 'Unidad', 'Meta', 'Semáforo', 'Valor periodo anterior', 'Detalle', 'Fórmula'],
      todos.map(k => [k.grupo, k.nombre, k.valor == null ? 'Sin datos suficientes' : redondear(k.valor, 4), k.unidad, k.meta == null ? '' : formatoMeta(k), k.semaforo, k.anterior == null ? '' : redondear(k.anterior, 4), k.detalle, k.formula]));
    const fechas = rangoFechas(r.desde, r.hasta);
    const idx = DEF_KPI.findIndex(d => d[0] === sel.clave);
    const vals = fechas.map(f => calcularKPIs({ desde: sumarDias(f, -6), hasta: f }, filtros)[idx].valor);
    const esPct = sel.unidad === '%';
    dibujos.push(() => graficaLineas(document.getElementById('kTend'), {
      etiquetas: fechas, alto: 210, formato: (v, eje) => (eje ? (esPct ? fmt.num(v) + ' %' : sel.unidad === 'MXN' ? fmt.mxnCorto(v) : fmt.num(v, 1)) : formatoKPI(sel, v)),
      meta: sel.meta != null ? { valor: sel.meta, etiqueta: `Meta ${formatoMeta(sel)}` } : null, yMin: esPct ? 0 : undefined,
      series: [{ nombre: sel.nombre, valores: vals, color: 'var(--s1)' }],
    }));
  },
};

// ================================================================== REPORTES

const REPORTES = [
  { id: 'inventario', titulo: 'Inventario actual', periodo: false, unidades: 'Cantidades en la unidad de cada material; valores en MXN.',
    columnas: ['Código', 'Material', 'Categoría', 'Unidad', 'Existencia física', 'Reservada', 'Disponible', 'Mínimo', 'Máximo', 'Costo unitario', 'Valor', 'Estado'],
    filas: () => S.materiales.map(m => { const e = existencias(m.codigo); return [m.codigo, m.descripcion, m.categoria, m.unidad, e.fisica, e.reservada, e.disponible, m.min, m.max, m.costo, suma(lotesDe(m.codigo), l => l.cantidad * l.costo), estadoMaterial(m.codigo)]; }) },
  { id: 'compras-proveedor', titulo: 'Compras por proveedor', unidades: 'MXN sin IVA, órdenes emitidas en el periodo.',
    columnas: ['Proveedor', 'Razón social', 'Órdenes', 'Subtotal', 'IVA', 'Flete estimado', 'Total'],
    filas: r => S.proveedores.map(p => { const o = S.ordenesCompra.filter(x => x.proveedor === p.codigo && x.estado !== 'Cancelada' && enRango(x.fechaEmision, r)); const t = o.map(totalesOC); return [p.codigo, p.razon, o.length, suma(t, x => x.subtotal), suma(t, x => x.iva), suma(t, x => x.transporte), suma(t, x => x.total)]; }).filter(f => f[2] > 0) },
  { id: 'solicitudes-pendientes', titulo: 'Solicitudes pendientes', periodo: false, unidades: 'Costo estimado en MXN.',
    columnas: ['Folio', 'Fecha', 'Área', 'Material', 'Cantidad', 'Unidad', 'Prioridad', 'Costo estimado', 'Solicitante', 'Estado'],
    filas: () => S.solicitudes.filter(s => ABIERTOS_SC.includes(s.estado)).map(s => [s.folio, fmt.fecha(s.fecha), s.area, material(s.material).descripcion, s.cantidad, s.unidad, s.prioridad, s.costoEst, s.solicitante, s.estado]) },
  { id: 'costos-logisticos', titulo: 'Costos logísticos', unidades: 'MXN por día; el almacén se carga como costo fijo diario.',
    columnas: ['Fecha', 'Flete de entrada', 'Envíos a clientes', 'Almacén', 'Total'],
    filas: r => rangoFechas(r.desde, r.hasta).map(f => { const a = suma(S.embarques.filter(e => e.estado === 'Entregado' && e.llegada === f), e => e.costo), b = suma(S.pedidos.filter(p => p.despacho === f), p => p.costoEnvio), c = S.config.costoAlmacenDia; return [fmt.fecha(f), a, b, c, a + b + c]; }) },
  { id: 'desempeno-proveedores', titulo: 'Desempeño de proveedores', periodo: false, unidades: 'Porcentajes y días; histórico completo.',
    columnas: ['Proveedor', 'Razón social', 'OC recibidas', 'Puntualidad %', 'Atraso promedio (días)', 'Variación de precio %', 'Rechazo en recepción %', 'Calificación'],
    filas: () => S.proveedores.map(p => { const d = desempenoProveedor(p.codigo); return [p.codigo, p.razon, d.n, d.puntualidad ?? 'Sin datos suficientes', d.atraso, d.variacion ?? '', d.rechazo ?? '', p.calificacion]; }) },
  { id: 'cumplimiento-produccion', titulo: 'Cumplimiento de producción', unidades: 'Unidades; órdenes con fin planificado en el periodo.',
    columnas: ['Orden', 'Producto', 'Línea', 'Fin planificado', 'Planificada', 'Aceptada', 'Defectuosa', 'Cumplimiento %', 'Estado'],
    filas: r => S.ordenesProduccion.filter(o => enRango(o.finPlan, r)).map(o => [o.folio, producto(o.producto).nombre, o.linea, fmt.fecha(o.finPlan), o.planificada, o.aceptada, o.defectuosa, redondear(100 * o.aceptada / o.planificada, 1), o.estado]) },
  { id: 'calidad', titulo: 'Calidad y desperdicio', unidades: 'Unidades rechazadas por causa en órdenes iniciadas en el periodo.',
    columnas: ['Causa', 'Unidades rechazadas', 'Costo de material estimado (MXN)'],
    filas: r => { const ops = S.ordenesProduccion.filter(o => enRango(o.iniReal, r)); const d = S.operaciones.filter(x => ops.some(o => o.folio === x.op)).flatMap(x => x.defectos.map(y => ({ ...y, prod: buscarPor('ordenesProduccion', x.op).producto }))); return Object.entries(agrupar(d, x => x.causa)).map(([c, l]) => [c, suma(l, x => x.cantidad), suma(l, x => x.cantidad * costoMaterialUnidad(x.prod))]); } },
  { id: 'pedidos-a-tiempo', titulo: 'Pedidos entregados a tiempo', unidades: 'Pedidos con fecha comprometida en el periodo.',
    columnas: ['Pedido', 'Cliente', 'Comprometida', 'Entrega', 'Completo', 'A tiempo', 'OTIF', 'Estado'],
    filas: r => S.pedidos.filter(p => enRango(p.comprometida, r)).map(p => [p.folio, cliente(p.cliente).nombre, fmt.fecha(p.comprometida), fmt.fecha(p.entrega), p.completo == null ? '' : p.completo ? 'Sí' : 'No', p.aTiempo == null ? '' : p.aTiempo ? 'Sí' : 'No', p.estado === 'Entregado' && p.completo && p.aTiempo ? 'Sí' : 'No', estadoPedido(p)]) },
  { id: 'incidencias-area', titulo: 'Incidencias por área', unidades: 'Número de incidencias registradas en el periodo.',
    columnas: ['Área', 'Total', 'Abiertas', 'Severidad alta o crítica', 'Tipos'],
    filas: r => Object.entries(agrupar(S.incidencias.filter(i => enRango(i.fecha, r)), i => i.area)).map(([a, l]) => [a, l.length, l.filter(i => !['Resuelta', 'Cerrada'].includes(i.estado)).length, l.filter(i => ['Alta', 'Crítica'].includes(i.severidad)).length, [...new Set(l.map(i => i.tipo))].join('; ')]) },
  { id: 'kpis', titulo: 'KPIs globales', unidades: 'Cada indicador en su propia unidad.',
    columnas: ['Grupo', 'Indicador', 'Valor', 'Unidad', 'Meta', 'Semáforo', 'Detalle'],
    filas: r => calcularKPIs(r).map(k => [k.grupo, k.nombre, k.valor == null ? 'Sin datos suficientes' : redondear(k.valor, 3), k.unidad, k.meta == null ? '' : formatoMeta(k), k.semaforo, k.detalle]) },
];

MODULOS.reportes = {
  titulo: 'Reportes', icono: 'reporte', grupo: 'Análisis', sel: 'inventario', desde: '', hasta: '',
  render(main) {
    const rep = REPORTES.find(x => x.id === this.sel);
    const def = periodoActual();
    const r = { desde: this.desde || def.desde, hasta: this.hasta || def.hasta };
    const filas = rep.filas(r);
    const cel = v => typeof v === 'number' ? (Number.isInteger(v) ? fmt.num(v) : fmt.num(v, 2)) : esc(v);
    const enc = [`SupplyChain 360 AI · ${EMPRESA.nombre}`, `Reporte: ${rep.titulo}`, rep.periodo === false ? 'Periodo: foto al momento de generarlo' : `Periodo evaluado: ${fmt.fecha(r.desde)} a ${fmt.fecha(r.hasta)}`, `Unidades: ${rep.unidades}`, `Generado: ${fmt.fechaHora(ahoraMexico())} (hora de México)`, 'Datos ficticios de demostración'];
    main.innerHTML = `
      ${encabezado('Reportes y exportación', 'Las exportaciones usan exactamente los datos filtrados y llevan título, fecha de generación, unidades y periodo.')}
      <section class="tarjeta no-imprimir"><div class="acciones-fila" style="align-items:flex-end">
        <label class="filtro">Reporte<select id="rSel">${REPORTES.map(x => `<option value="${x.id}" ${x.id === this.sel ? 'selected' : ''}>${esc(x.titulo)}</option>`).join('')}</select></label>
        ${rep.periodo === false ? '<span class="nota">Este reporte es una foto del estado actual.</span>' : `<label class="filtro">Desde<input type="date" id="rDesde" value="${r.desde}"></label><label class="filtro">Hasta<input type="date" id="rHasta" value="${r.hasta}"></label>`}
        <span style="margin-left:auto" class="acciones-fila">
          <button class="btn" id="rCsv">${icono('descarga')} CSV</button>
          <button class="btn btn-sec" id="rXls">${icono('descarga')} Excel (.xls)</button>
          <button class="btn btn-sec" id="rPdf">${icono('reporte')} PDF / imprimir</button>
        </span></div></section>
      <section class="tarjeta" id="rVista">
        <div style="margin-bottom:10px">${enc.map((l, i) => i === 1 ? `<h2>${esc(rep.titulo)}</h2>` : i === 0 ? '' : `<div class="nota">${esc(l)}</div>`).join('')}</div>
        <div class="tabla-cont"><table><thead><tr>${rep.columnas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.length ? filas.map(f => `<tr>${f.map(v => `<td class="${typeof v === 'number' ? 'num' : ''}">${cel(v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${rep.columnas.length}" class="vacio">Sin datos suficientes en el periodo.</td></tr>`}</tbody></table></div>
        <p class="nota" style="margin-top:8px">${fmt.num(filas.length)} renglones.</p>
      </section>`;
    main.querySelector('#rSel').onchange = e => { this.sel = e.target.value; refrescar(); };
    main.querySelector('#rDesde')?.addEventListener('change', e => { this.desde = e.target.value; refrescar(); });
    main.querySelector('#rHasta')?.addEventListener('change', e => { this.hasta = e.target.value; refrescar(); });
    const nombre = `sc360-${rep.id}-${rep.periodo === false ? hoy() : r.desde + '_' + r.hasta}`;
    main.querySelector('#rCsv').onclick = () => exportarCSV(nombre, enc, rep.columnas, filas);
    main.querySelector('#rXls').onclick = () => {
      const html = `<html><head><meta charset="utf-8"></head><body>${enc.map(l => `<div>${esc(l)}</div>`).join('')}<br><table border="1"><tr>${rep.columnas.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${filas.map(f => `<tr>${f.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
      descargar(nombre + '.xls', html, 'application/vnd.ms-excel;charset=utf-8');
    };
    main.querySelector('#rPdf').onclick = () => window.print();
  },
};
