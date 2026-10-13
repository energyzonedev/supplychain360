// Transporte y logística de entrada · Almacén e inventarios · Suministro a producción.
'use strict';

// Posiciones esquemáticas (no geográficas) de las zonas ficticias para el mapa de rutas.
const POS_ZONA = {
  'PRV-001': [210, 40], 'PRV-005': [250, 60], 'PRV-002': [150, 150], 'PRV-003': [330, 175], 'PRV-012': [345, 205],
  'PRV-004': [440, 250], 'PRV-007': [470, 225], 'PRV-006': [380, 150], 'PRV-008': [540, 260], 'PRV-009': [410, 280],
  'PRV-010': [480, 180], 'PRV-011': [90, 220],
};
const PLANTA = [360, 190];

// Google Maps: ruta de referencia entre la ciudad de origen del proveedor y la planta.
// No es rastreo GPS: los embarques son ficticios y no hay posición en tiempo real.
const DESTINO_MAPA = 'El Marqués, Querétaro, México';
const ciudadZona = zona => String(zona || '').replace(/\s*\(.*\)\s*$/, '').trim() + ', México';
const urlRuta = (origen, embed) => `https://maps.google.com/maps?saddr=${encodeURIComponent(origen)}&daddr=${encodeURIComponent(DESTINO_MAPA)}${embed ? '&output=embed' : ''}`;

MODULOS.transporte = {
  embMapa: null,
  titulo: 'Transporte y logística de entrada', menu: 'Transporte y logística', icono: 'camion', grupo: 'Abastecimiento',
  render(main) {
    const r = periodoActual();
    const k = calcularKPIs(r);
    const K = c => k.find(x => x.clave === c);
    const activos = S.embarques.filter(e => !['Entregado', 'Cancelado'].includes(e.estado));
    const opcionesMapa = [...activos, ...S.embarques.filter(e => e.estado === 'Entregado').slice(-8).reverse()];
    const embMapa = opcionesMapa.find(e => e.folio === this.embMapa) || opcionesMapa[0] || S.embarques[S.embarques.length - 1];
    const sinEmbarque = S.ordenesCompra.filter(o => ['Enviada', 'Confirmada', 'Parcialmente recibida'].includes(o.estado) && !S.embarques.some(e => e.oc === o.folio && !['Entregado', 'Cancelado'].includes(e.estado)));
    main.innerHTML = `
      ${encabezado('Transporte y logística de entrada', `Traslado de materiales del proveedor a la planta. Indicadores ${tituloPeriodo(r)}.`)}
      <div class="indicadores">
        ${indicador({ titulo: 'Embarques activos', valor: fmt.num(activos.length), estado: 'info', ico: 'camion', nota: `${activos.filter(e => estadoEmbarque(e) === 'Retrasado').length} retrasados` })}
        ${indicador({ titulo: 'Entregas de entrada a tiempo', valor: formatoKPI(K('entradaATiempo')), estado: K('entradaATiempo').semaforo, ico: 'check', nota: esc(K('entradaATiempo').detalle) })}
        ${indicador({ titulo: 'Costo de transporte por unidad', valor: formatoKPI(K('costoTransporteUnidad')), estado: K('costoTransporteUnidad').semaforo, ico: 'compras', nota: `Meta ${formatoMeta(K('costoTransporteUnidad'))}` })}
        ${indicador({ titulo: 'Órdenes sin embarque programado', valor: fmt.num(sinEmbarque.length), estado: sinEmbarque.length ? 'alerta' : 'bien', ico: 'planeacion' })}
      </div>
      <div class="rejilla r21">
        <section class="tarjeta"><div class="tarjeta-cab"><h2>Ruta en Google Maps</h2>
            <label class="filtro">Embarque<select id="selMapa">${opcionesMapa.map(e => `<option value="${e.folio}" ${e.folio === embMapa.folio ? 'selected' : ''}>${e.folio} · ${esc(proveedor(e.proveedor).razon.replace(/ Demo.*$/, ''))} · ${esc(estadoEmbarque(e))}</option>`).join('')}</select></label></div>
          <div class="mapa-google">${navigator.onLine
            ? `<iframe title="Ruta de ${esc(ciudadZona(embMapa.origen))} a la planta en Google Maps" src="${urlRuta(ciudadZona(embMapa.origen), true)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`
            : '<p class="vacio">Sin conexión a internet: Google Maps no está disponible. Abajo está el mapa esquemático.</p>'}</div>
          <p class="nota" style="margin-top:8px">${docLink(embMapa.folio)} · ${esc(ciudadZona(embMapa.origen))} → ${esc(DESTINO_MAPA)} · ${fmt.num(proveedor(embMapa.proveedor).km)} km · llegada estimada ${fmt.fecha(embMapa.eta)}. Ruta de referencia en Google Maps; no es rastreo GPS. <a href="${urlRuta(ciudadZona(embMapa.origen), false)}" target="_blank" rel="noopener">Abrir en Google Maps ↗</a></p>
          <details style="margin-top:8px"><summary class="nota" style="cursor:pointer">Mapa esquemático de todas las rutas (funciona sin internet)</summary><div class="mapa">${mapaRutas(activos)}</div></details>
        </section>
        <section class="tarjeta"><h2>Órdenes listas para embarcar</h2>${sinEmbarque.length ? `<ul class="lista-al">${sinEmbarque.map(o => `<li><button data-doc="${o.folio}"><span class="ic info">•</span><span><b>${o.folio} · ${esc(proveedor(o.proveedor).razon)}</b><small>Prometida ${fmt.fecha(o.fechaPrometida)} · ${esc(o.estado)}</small></span></button></li>`).join('')}</ul><p class="nota" style="margin-top:8px">Abre la orden y usa «Programar embarque».</p>` : '<p class="vacio">Todas las órdenes enviadas tienen embarque.</p>'}</section>
      </div>
      <section class="tarjeta">${tabla('embarques', {
        titulo: 'Embarques', exportar: 'embarques', orden: ['Folio', 'desc'], placeholder: 'Folio, orden, transportista…',
        columnas: [
          { t: 'Folio', v: e => docLink(e.folio), o: e => e.folio },
          { t: 'Orden', v: e => docLink(e.oc), o: e => e.oc },
          { t: 'Proveedor / origen', v: e => `${esc(proveedor(e.proveedor).razon)}<br><small class="tenue">${esc(e.origen)}</small>`, o: e => proveedor(e.proveedor).razon },
          { t: 'Transportista', v: e => `${esc(transportista(e.transportista).nombre)}<br><small class="tenue">${esc(e.vehiculo)} · ${fmt.num(e.capacidadKg)} kg</small>`, o: e => transportista(e.transportista).nombre },
          { t: 'Carga', num: true, v: e => `${fmt.num(e.pallets)} tar.<br><small class="tenue">${fmt.num(e.pesoKg)} kg</small>`, o: e => e.pesoKg },
          { t: 'Salida', v: e => fmt.fecha(e.salida || e.salidaProgramada), o: e => e.salida || e.salidaProgramada },
          { t: 'Llegada estimada', v: e => fmt.fecha(e.eta) + (e.eta !== e.etaOriginal ? `<br><small class="tenue">orig. ${fmt.fecha(e.etaOriginal)}</small>` : ''), o: e => e.eta },
          { t: 'Llegada real', v: e => e.llegada ? fmt.fecha(e.llegada) + (diasEntre(e.etaOriginal, e.llegada) > 0 ? `<br>${pill(`+${diasEntre(e.etaOriginal, e.llegada)} d`, 'critico')}` : '') : '—', o: e => e.llegada || '' },
          { t: 'Costo', num: true, v: e => fmt.mxn(e.costo, 0), o: e => e.costo },
          { t: 'Estado', v: e => pill(estadoEmbarque(e)), o: e => estadoEmbarque(e) },
          { t: 'Acciones', v: e => `<div class="acciones-fila">${SIGUIENTE_EMB[e.estado] ? btnAcc('emb-avanzar', e.folio, SIGUIENTE_EMB[e.estado], { permiso: 'embarque' }) : ''}${e.estado === 'En revisión de recepción' ? btnAcc('emb-recibir', e.folio, 'Recibir', { clase: 'btn-verde btn-chico', permiso: 'recepcion' }) : ''}</div>` },
        ],
        filas: S.embarques,
        filtros: [{ id: 'est', t: 'Estado', valor: estadoEmbarque }, { id: 'tr', t: 'Transportista', valor: e => transportista(e.transportista).nombre }],
        claseFila: e => estadoEmbarque(e) === 'Retrasado' ? 'fila-mal' : '',
      })}</section>`;
    main.querySelector('#selMapa')?.addEventListener('change', ev => { this.embMapa = ev.target.value; refrescar(); });
  },
};

function mapaRutas(activos) {
  const activosPorProv = agrupar(activos, e => e.proveedor);
  let s = '<svg viewBox="0 0 620 320" role="img" aria-label="Mapa esquemático de rutas de proveedores a la planta">';
  S.proveedores.forEach(p => {
    const [x, y] = POS_ZONA[p.codigo] || [300, 300];
    const emb = activosPorProv[p.codigo] || [];
    const cls = emb.some(e => estadoEmbarque(e) === 'Retrasado') ? 'retraso' : emb.some(e => ['En tránsito', 'En preparación'].includes(e.estado)) ? 'activa' : '';
    s += `<path class="ruta ${cls}" d="M${x} ${y} Q${(x + PLANTA[0]) / 2} ${Math.min(y, PLANTA[1]) - 30} ${PLANTA[0]} ${PLANTA[1]}"><title>${esc(p.razon)} · ${p.km} km</title></path>`;
  });
  S.proveedores.forEach(p => {
    const [x, y] = POS_ZONA[p.codigo] || [300, 300];
    const n = (activosPorProv[p.codigo] || []).length;
    s += `<circle class="nodo" cx="${x}" cy="${y}" r="${n ? 7 : 5}"/><text x="${x + 9}" y="${y + 4}">${p.codigo.replace('PRV-0', 'P')}${n ? ` · ${n} emb.` : ''}</text>`;
  });
  s += `<rect class="planta" x="${PLANTA[0] - 9}" y="${PLANTA[1] - 9}" width="18" height="18" rx="4"/><text x="${PLANTA[0] - 30}" y="${PLANTA[1] + 26}" style="font-weight:700;fill:var(--tinta)">Planta</text></svg>`;
  return s + `<div class="leyenda" style="margin-top:6px"><span><i style="background:var(--azul)"></i>En tránsito</span><span><i style="background:var(--rojo)"></i>Retrasado</span><span><i style="background:var(--linea-2)"></i>Sin envío activo</span></div>`;
}

// =================================================================== ALMACÉN

MODULOS.almacen = {
  titulo: 'Almacén e inventarios', icono: 'almacen', grupo: 'Operación', pestana: 'inventario',
  render(main) {
    const p = this.pestana;
    const hoyF = hoy();
    const mats = S.materiales.map(m => ({ ...m, e: existencias(m.codigo) }));
    const valor = suma(S.lotes, l => l.cantidad * l.costo);
    const movHoy = S.movimientos.filter(m => m.fecha.slice(0, 10) === hoyF && m.material);
    const tarimas = suma(S.lotes.filter(l => l.cantidad > 0), l => Math.ceil(l.cantidad * (PESO_UNIDAD[material(l.material).unidad] || 0.1) / 600)) + suma(S.lotesPT.filter(l => l.existencia > 0), l => Math.ceil(l.existencia / 40));
    const porRecibir = S.ordenesCompra.filter(o => ['Enviada', 'Confirmada', 'Parcialmente recibida'].includes(o.estado));
    main.innerHTML = `
      ${encabezado('Almacén e inventarios', 'Existencias por lote con trazabilidad. Las salidas siguen PEPS (primero en entrar, primero en salir).')}
      <div class="indicadores">
        ${indicador({ titulo: 'Valor del inventario de materiales', valor: fmt.mxnCorto(valor), estado: 'info', ico: 'almacen', nota: `${fmt.num(S.lotes.filter(l => l.cantidad > 0).length)} lotes con existencia` })}
        ${indicador({ titulo: 'Materiales disponibles / comprometidos', valor: `${fmt.mxnCorto(suma(mats, m => m.e.disponible * m.costo))}`, estado: 'info', ico: 'caja', nota: `Comprometido (reservado): ${fmt.mxnCorto(suma(mats, m => m.e.reservada * m.costo))}` })}
        ${indicador({ titulo: 'En cuarentena o dañado', valor: fmt.mxnCorto(suma(mats, m => m.e.bloqueada * m.costo)), estado: mats.some(m => m.e.bloqueada > 0) ? 'alerta' : 'bien', ico: 'incidencia', nota: `${S.lotes.filter(l => l.estado !== 'Disponible' && l.cantidad > 0).length} lotes retenidos` })}
        ${indicador({ titulo: 'Materiales bajo el mínimo', valor: fmt.num(mats.filter(m => ['Crítico', 'Agotado'].includes(estadoMaterial(m.codigo))).length), unidad: `de ${mats.length}`, estado: mats.some(m => ['Crítico', 'Agotado'].includes(estadoMaterial(m.codigo))) ? 'critico' : 'bien', ico: 'kpi', nota: `Entradas hoy: ${movHoy.filter(m => m.cantidad > 0).length} · salidas hoy: ${movHoy.filter(m => m.cantidad < 0).length} · ocupación ≈ ${fmt.pct(100 * tarimas / S.config.posicionesAlmacen, 0)}` })}
      </div>
      <div class="pestanas" role="tablist">${[['inventario', 'Inventario por lote'], ['materiales', 'Resumen por material'], ['recepcion', `Recepción e inspección (${porRecibir.length})`], ['movimientos', 'Movimientos'], ['conteos', 'Conteos físicos'], ['abc', 'Clasificación ABC']].map(([id, t]) => `<button role="tab" class="${p === id ? 'activa' : ''}" data-pest="${id}">${t}</button>`).join('')}</div>
      <div id="pestCont"></div>`;
    main.querySelectorAll('[data-pest]').forEach(b => b.onclick = () => { this.pestana = b.dataset.pest; refrescar(); });
    const c = main.querySelector('#pestCont');
    if (p === 'inventario') c.innerHTML = `<section class="tarjeta"><p class="nota">Cantidad disponible = existencia física − cantidad reservada. Los lotes en cuarentena o dañados no están disponibles.</p>${tabla('lotes', {
      titulo: 'Inventario por lote', exportar: 'inventario-lotes', orden: ['Código', 'asc'], porPagina: 15, placeholder: 'Material, lote, ubicación…',
      columnas: [
        { t: 'Código', v: l => docLink(l.material), o: l => l.material },
        { t: 'Material', v: l => esc(material(l.material).descripcion), o: l => material(l.material).descripcion },
        { t: 'Categoría', v: l => esc(material(l.material).categoria), o: l => material(l.material).categoria },
        { t: 'Ubicación', v: l => esc(l.ubicacion), o: l => l.ubicacion },
        { t: 'Lote', v: l => docLink(l.lote) + `<br><small class="tenue">${fmt.fecha(l.fechaEntrada)}</small>`, o: l => l.lote },
        { t: 'Física', num: true, v: l => fmt.num(l.cantidad, 2), o: l => l.cantidad },
        { t: 'Reservada', num: true, v: l => fmt.num(l.reservada, 2), o: l => l.reservada },
        { t: 'Disponible', num: true, v: l => `<b>${fmt.num(l.estado === 'Disponible' ? l.cantidad - l.reservada : 0, 2)}</b>`, o: l => (l.estado === 'Disponible' ? l.cantidad - l.reservada : 0) },
        { t: 'Mín. / máx.', num: true, v: l => `${fmt.num(material(l.material).min)} / ${fmt.num(material(l.material).max)}`, o: l => material(l.material).min },
        { t: 'Costo unit.', num: true, v: l => fmt.mxn(l.costo), o: l => l.costo },
        { t: 'Valor total', num: true, v: l => fmt.mxn(l.cantidad * l.costo, 0), o: l => l.cantidad * l.costo },
        { t: 'Estado', v: l => pill(l.estado) + (l.estado === 'Disponible' && ['Crítico', 'Agotado'].includes(estadoMaterial(l.material)) ? '<br>' + pill('Material bajo mínimo', 'critico') : ''), o: l => l.estado },
        { t: 'Acciones', v: l => `<div class="acciones-fila">${btnAcc('lote-conteo', l.lote, 'Contar', { permiso: 'inventario' })}${btnAcc('lote-ajuste', l.lote, 'Ajustar', { permiso: 'inventario' })}${btnAcc('lote-estado', l.lote, l.estado === 'Disponible' ? 'Retener' : 'Liberar', { permiso: 'inventario' })}</div>` },
      ],
      filas: S.lotes.filter(l => l.cantidad > 0),
      filtros: [{ id: 'cat', t: 'Categoría', valor: l => material(l.material).categoria }, { id: 'est', t: 'Estado del lote', valor: l => l.estado }, { id: 'mat', t: 'Material', valor: l => l.material }],
      claseFila: l => l.estado !== 'Disponible' ? 'fila-alerta' : '',
    })}</section>`;
    if (p === 'materiales') c.innerHTML = `<section class="tarjeta">${tabla('resmat', {
      titulo: 'Inventario por material', exportar: 'inventario-materiales', orden: ['Estado', 'asc'], porPagina: 25,
      columnas: [
        { t: 'Código', v: m => docLink(m.codigo), o: m => m.codigo },
        { t: 'Material', v: m => esc(m.descripcion), o: m => m.descripcion },
        { t: 'Física', num: true, v: m => fmt.cant(m.e.fisica, m.unidad), o: m => m.e.fisica },
        { t: 'Reservada', num: true, v: m => fmt.num(m.e.reservada, 1), o: m => m.e.reservada },
        { t: 'Disponible', num: true, v: m => fmt.num(m.e.disponible, 1), o: m => m.e.disponible },
        { t: 'Retenida', num: true, v: m => fmt.num(m.e.bloqueada, 1), o: m => m.e.bloqueada },
        { t: 'En tránsito', num: true, v: m => fmt.num(enTransito(m.codigo), 1), o: m => enTransito(m.codigo) },
        { t: 'Mínimo', num: true, v: m => fmt.num(m.min), o: m => m.min },
        { t: 'Nivel', v: m => barraProgreso(100 * m.e.fisica / (m.max || 1), ['Crítico', 'Agotado'].includes(estadoMaterial(m.codigo)) ? 'critico' : estadoMaterial(m.codigo) === 'Bajo' ? 'alerta' : 'bien'), o: m => m.e.fisica / (m.max || 1) },
        { t: 'Valor', num: true, v: m => fmt.mxn(suma(lotesDe(m.codigo), l => l.cantidad * l.costo), 0), o: m => suma(lotesDe(m.codigo), l => l.cantidad * l.costo) },
        { t: 'Estado', v: m => pill(estadoMaterial(m.codigo)), o: m => ['Agotado', 'Crítico', 'Bajo', 'Normal', 'Exceso'].indexOf(estadoMaterial(m.codigo)) },
        { t: '', v: m => ['Crítico', 'Agotado', 'Bajo'].includes(estadoMaterial(m.codigo)) ? btnAcc('sc-nueva', m.codigo, 'Solicitar', { permiso: 'solicitud.crear' }) : '' },
      ],
      filas: mats, filtros: [{ id: 'est', t: 'Estado', valor: m => estadoMaterial(m.codigo) }, { id: 'cat', t: 'Categoría', valor: m => m.categoria }],
    })}</section>`;
    if (p === 'recepcion') {
      const enRev = S.embarques.filter(e => e.estado === 'En revisión de recepción');
      c.innerHTML = `<section class="tarjeta"><h2>Recepción, inspección y entrada al almacén</h2><p class="nota">Registra lo recibido y lo aceptado en la inspección. Sólo lo aceptado aumenta las existencias; puedes mandar un lote a cuarentena.</p>
        ${enRev.length ? `<p>${pill(`${enRev.length} embarque(s) en el andén esperando inspección`, 'alerta')}</p>` : ''}
        ${tabla('recibir', {
          titulo: 'Órdenes por recibir', orden: ['Prometida', 'asc'],
          columnas: [
            { t: 'Orden', v: o => docLink(o.folio), o: o => o.folio },
            { t: 'Proveedor', v: o => esc(proveedor(o.proveedor).razon), o: o => proveedor(o.proveedor).razon },
            { t: 'Materiales pendientes', v: o => o.lineas.filter(l => l.cantidad > l.recibido).map(l => `${esc(material(l.material).descripcion)}: ${fmt.cant(l.cantidad - l.recibido, material(l.material).unidad)}`).join('<br>'), o: o => '' },
            { t: 'Embarque', v: o => { const e = S.embarques.find(x => x.oc === o.folio && !['Entregado', 'Cancelado'].includes(x.estado)); return e ? `${docLink(e.folio)}<br>${pill(estadoEmbarque(e))}` : '<span class="tenue">Sin embarque</span>'; }, o: o => '' },
            { t: 'Prometida', v: o => fmt.fecha(o.fechaPrometida), o: o => o.fechaPrometida },
            { t: 'Estado', v: o => pill(estadoOC(o)), o: o => estadoOC(o) },
            { t: 'Acción', v: o => btnAcc('oc-recibir', o.folio, 'Registrar recepción', { clase: 'btn-verde btn-chico', permiso: 'recepcion' }) },
          ],
          filas: porRecibir, vacio: 'No hay órdenes pendientes de recibir.',
        })}</section>
        <section class="tarjeta"><h2>Recepciones registradas</h2>${tabla('recs', {
          orden: ['Folio', 'desc'], porPagina: 8, exportar: 'recepciones',
          columnas: [
            { t: 'Folio', v: x => docLink(x.folio), o: x => x.folio }, { t: 'Fecha', v: x => fmt.fecha(x.fecha), o: x => x.fecha },
            { t: 'Orden', v: x => docLink(x.oc), o: x => x.oc }, { t: 'Embarque', v: x => docLink(x.embarque), o: x => x.embarque || '' },
            { t: 'Aceptado', num: true, v: x => fmt.num(suma(x.lineas, l => l.aceptado), 1), o: x => suma(x.lineas, l => l.aceptado) },
            { t: 'Rechazado', num: true, v: x => { const rr = suma(x.lineas, l => l.rechazado); return rr ? `<b style="color:var(--rojo)">${fmt.num(rr, 1)}</b>` : '0'; }, o: x => suma(x.lineas, l => l.rechazado) },
            { t: 'Lotes', v: x => x.lineas.map(l => docLink(l.lote) + (l.cuarentena ? ' ' + pill('Cuarentena') : '')).join(' '), o: x => '' },
          ], filas: S.recepciones,
        })}</section>`;
    }
    if (p === 'movimientos') c.innerHTML = `<section class="tarjeta">${tabla('movs', {
      titulo: 'Movimientos de inventario', exportar: 'movimientos', orden: ['Folio', 'desc'], porPagina: 15, placeholder: 'Lote, material, referencia…',
      columnas: [
        { t: 'Folio', v: m => docLink(m.folio), o: m => m.folio },
        { t: 'Fecha', v: m => fmt.fechaHora(m.fecha), o: m => m.fecha },
        { t: 'Tipo', v: m => esc(m.tipo), o: m => m.tipo },
        { t: 'Artículo', v: m => docLink(m.material || m.producto), o: m => m.material || m.producto },
        { t: 'Lote', v: m => docLink(m.lote), o: m => m.lote },
        { t: 'Cantidad', num: true, v: m => `<span style="color:${m.cantidad < 0 ? 'var(--rojo)' : m.cantidad > 0 ? 'var(--verde)' : 'inherit'}">${m.cantidad > 0 ? '+' : ''}${fmt.num(m.cantidad, 2)}</span>`, o: m => m.cantidad },
        { t: 'Valor', num: true, v: m => fmt.mxn(m.cantidad * m.costoUnit, 0), o: m => m.cantidad * m.costoUnit },
        { t: 'Referencia', v: m => documento(m.referencia) ? docLink(m.referencia) : esc(m.referencia), o: m => m.referencia },
        { t: 'Motivo', v: m => esc(m.motivo || ''), o: m => m.motivo || '' },
        { t: 'Usuario', v: m => esc(m.usuario), o: m => m.usuario },
      ],
      filas: S.movimientos,
      filtros: [{ id: 'tipo', t: 'Tipo', valor: m => m.tipo }, { id: 'f', t: 'Fecha', valor: m => m.fecha.slice(0, 10) === hoyF ? 'Hoy' : m.fecha >= sumarDias(hoyF, -7) ? 'Últimos 7 días' : 'Anteriores', opciones: ['Hoy', 'Últimos 7 días', 'Anteriores'] }, { id: 'mat', t: 'Material', valor: m => m.material || m.producto }],
    })}</section>`;
    if (p === 'conteos') {
      const k = calcularKPIs(periodoActual()).find(x => x.clave === 'exactitud');
      c.innerHTML = `<section class="tarjeta"><div class="tarjeta-cab"><h2>Conteos físicos: inventario teórico contra físico</h2>${pill(`Exactitud del periodo: ${formatoKPI(k)}`, k.semaforo === 'sindatos' ? 'neutro' : k.semaforo)}</div>
        <p class="nota">Para simular un conteo, abre un lote en «Inventario por lote» y pulsa «Contar». Las diferencias se ajustan con un movimiento auditable.</p>${tabla('conteos', {
        orden: ['Folio', 'desc'], exportar: 'conteos',
        columnas: [
          { t: 'Folio', v: x => docLink(x.folio), o: x => x.folio }, { t: 'Fecha', v: x => fmt.fecha(x.fecha), o: x => x.fecha },
          { t: 'Material', v: x => esc(material(x.material).descripcion), o: x => material(x.material).descripcion }, { t: 'Lote', v: x => docLink(x.lote), o: x => x.lote },
          { t: 'Teórico', num: true, v: x => fmt.num(x.teorico, 2), o: x => x.teorico }, { t: 'Físico', num: true, v: x => fmt.num(x.fisico, 2), o: x => x.fisico },
          { t: 'Diferencia', num: true, v: x => fmt.num(x.diferencia, 2), o: x => x.diferencia },
          { t: 'Estado', v: x => pill(x.estado) + (x.ajustado ? ' ' + pill('Ajustado', 'bien') : ''), o: x => x.estado },
          { t: '', v: x => x.estado === 'Con diferencia' && !x.ajustado ? btnAcc('conteo-ajustar', x.folio, 'Aplicar ajuste', { permiso: 'inventario' }) : '' },
        ], filas: S.conteos,
      })}</section>`;
    }
    if (p === 'abc') {
      const r = periodoDesde(30);
      const cons = S.materiales.map(m => ({ ...m, valor: -suma(S.movimientos.filter(x => x.material === m.codigo && ['Salida a producción', 'Devolución de producción'].includes(x.tipo) && enRango(x.fecha, r)), x => x.cantidad * x.costoUnit) })).sort((a, b) => b.valor - a.valor);
      const tot = suma(cons, x => x.valor);
      let acum = 0;
      cons.forEach(x => { acum += x.valor; x.acum = tot ? 100 * acum / tot : 0; x.clase = x.acum <= 80 ? 'A' : x.acum <= 95 ? 'B' : 'C'; });
      c.innerHTML = `<section class="tarjeta"><h2>Clasificación ABC por valor de consumo (últimos 30 días)</h2><p class="nota">A = hasta 80 % del valor acumulado · B = 80–95 % · C = el resto. Los materiales A merecen conteo y seguimiento más frecuentes.</p>
        <div class="rejilla r3" style="margin:10px 0">${['A', 'B', 'C'].map(cl => `<div class="calculo"><b>Clase ${cl}</b>: ${cons.filter(x => x.clase === cl).length} materiales · ${fmt.mxnCorto(suma(cons.filter(x => x.clase === cl), x => x.valor))}</div>`).join('')}</div>
        ${tabla('abc', { sinBarra: true, porPagina: 25, columnas: [
          { t: 'Clase', v: x => pill(x.clase, x.clase === 'A' ? 'critico' : x.clase === 'B' ? 'alerta' : 'neutro') },
          { t: 'Material', v: x => `${docLink(x.codigo)} ${esc(x.descripcion)}` },
          { t: 'Valor consumido', num: true, v: x => fmt.mxn(x.valor, 0) },
          { t: '% del total', num: true, v: x => fmt.pct(tot ? 100 * x.valor / tot : 0, 1) },
          { t: '% acumulado', num: true, v: x => fmt.pct(x.acum, 1) },
        ], filas: cons })}</section>`;
    }
  },
};

// ======================================================== SUMINISTRO A PRODUCCIÓN

MODULOS.suministro = {
  titulo: 'Suministro a producción', icono: 'suministro', grupo: 'Operación',
  render(main) {
    const abiertas = S.suministros.filter(s => ['Pendiente', 'Preparando', 'Surtido parcial'].includes(s.estado));
    const sinSolicitud = S.ordenesProduccion.filter(o => ['Planificada', 'Pendiente de materiales', 'Lista para iniciar'].includes(o.estado) && requerimientosOP(o).some(r => r.pendiente > 0) && !S.suministros.some(s => s.op === o.folio && ['Pendiente', 'Preparando', 'Surtido parcial'].includes(s.estado)));
    const filas = S.suministros.flatMap(s => s.lineas.map(l => ({ s, l })));
    main.innerHTML = `
      ${encabezado('Suministro a producción', 'Traslado interno del almacén a las líneas. Se valida la disponibilidad y nunca se surte más de lo que hay.')}
      <div class="indicadores">
        ${indicador({ titulo: 'Solicitudes abiertas', valor: fmt.num(abiertas.length), estado: abiertas.length ? 'alerta' : 'bien', ico: 'suministro' })}
        ${indicador({ titulo: 'Órdenes sin solicitar material', valor: fmt.num(sinSolicitud.length), estado: sinSolicitud.length ? 'alerta' : 'bien', ico: 'planeacion' })}
        ${indicador({ titulo: 'Surtido completo (histórico)', valor: fmt.pct(100 * S.suministros.filter(s => s.estado === 'Surtido completo').length / (S.suministros.length || 1), 0), estado: 'info', ico: 'check' })}
        ${indicador({ titulo: 'Material surtido hoy', valor: fmt.mxnCorto(-suma(S.movimientos.filter(m => m.tipo === 'Salida a producción' && m.fecha.slice(0, 10) === hoy()), m => m.cantidad * m.costoUnit)), estado: 'info', ico: 'caja' })}
      </div>
      ${sinSolicitud.length ? `<section class="tarjeta"><h2>Órdenes que necesitan material</h2><div class="acciones-fila">${sinSolicitud.map(o => `<span class="calculo">${docLink(o.folio)} ${esc(producto(o.producto).nombre)} · ${pill(o.estado)} ${btnAcc('sum-nueva', o.folio, 'Crear solicitud de materiales', { clase: 'btn btn-chico', permiso: 'suministro' })}</span>`).join('')}</div></section>` : ''}
      <section class="tarjeta">${tabla('sums', {
        titulo: 'Solicitudes de suministro', exportar: 'suministros', orden: ['Folio', 'desc'],
        columnas: [
          { t: 'Folio', v: x => docLink(x.s.folio), o: x => x.s.folio },
          { t: 'Orden', v: x => docLink(x.s.op), o: x => x.s.op },
          { t: 'Línea', v: x => esc(x.s.linea), o: x => x.s.linea },
          { t: 'Material', v: x => esc(material(x.l.material).descripcion), o: x => material(x.l.material).descripcion },
          { t: 'Solicitado', num: true, v: x => fmt.num(x.l.solicitado, 2), o: x => x.l.solicitado },
          { t: 'Surtido', num: true, v: x => fmt.num(x.l.surtido, 2), o: x => x.l.surtido },
          { t: 'Pendiente', num: true, v: x => { const p = Math.max(0, x.l.solicitado - x.l.surtido); return p > 0 && x.s.estado !== 'Cancelado' ? `<b style="color:var(--rojo)">${fmt.num(p, 2)}</b>` : '0'; }, o: x => x.l.solicitado - x.l.surtido },
          { t: 'Origen → destino', v: x => `${esc(x.l.origen)} → ${esc(x.s.linea)}`, o: x => x.l.origen },
          { t: 'Requerida', v: x => fmt.fecha(x.s.fechaRequerida), o: x => x.s.fechaRequerida },
          { t: 'Responsable', v: x => esc(x.s.responsable), o: x => x.s.responsable },
          { t: 'Estado', v: x => pill(x.s.estado), o: x => x.s.estado },
          { t: 'Acción', v: x => ['Pendiente', 'Preparando', 'Surtido parcial'].includes(x.s.estado) ? btnAcc('sum-surtir', x.s.folio, 'Surtir', { clase: 'btn btn-chico', permiso: 'suministro' }) : '' },
        ],
        filas, porPagina: 15,
        filtros: [{ id: 'est', t: 'Estado', valor: x => x.s.estado }, { id: 'lin', t: 'Línea', valor: x => x.s.linea }],
        claseFila: x => x.l.solicitado - x.l.surtido > 0 && !['Cancelado'].includes(x.s.estado) ? 'fila-alerta' : '',
      })}</section>
      <section class="tarjeta"><h2>Porcentaje de surtido por orden</h2>${tabla('pctsum', { sinBarra: true, porPagina: 8, orden: ['Solicitud', 'desc'], columnas: [
        { t: 'Solicitud', v: s => docLink(s.folio), o: s => s.folio }, { t: 'Orden', v: s => docLink(s.op), o: s => s.op },
        { t: 'Surtido', v: s => barraProgreso(porcentajeSurtido(s)), o: s => porcentajeSurtido(s) }, { t: 'Estado', v: s => pill(s.estado), o: s => s.estado },
        { t: '', v: s => s.lineas.some(l => l.surtido - l.devuelto > 0) && s.estado !== 'Cancelado' ? btnAcc('sum-devolver', s.folio, 'Devolución', { permiso: 'suministro' }) : '' },
      ], filas: S.suministros })}</section>`;
  },
};
