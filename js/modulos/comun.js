// Piezas compartidas por los módulos: registro, encabezado, indicadores y alertas.
'use strict';

const MODULOS = {};
let dibujos = [];               // gráficas del módulo actual (se redibujan al cambiar el tamaño)
let periodoDias = 15;           // selector de periodo de la cabecera

const periodoActual = () => periodoDesde(periodoDias);

function encabezado(titulo, sub, acciones = '') {
  return `<div class="enc"><div><h1>${esc(titulo)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${acciones ? `<div class="enc-acc">${acciones}</div>` : ''}</div>`;
}

// Tarjeta de indicador: valor, unidad, variación contra el periodo anterior y estado.
function indicador({ titulo, valor, unidad = '', delta = null, mayorMejor = true, deltaFmt, estado = '', nota = '', ico = 'kpi', ir = '' }) {
  let d = '<span class="tenue">sin periodo anterior comparable</span>';
  if (delta != null && Number.isFinite(delta)) {
    const mejor = delta === 0 ? null : (delta > 0) === mayorMejor;
    d = `<span class="delta ${mejor == null ? '' : mejor ? 'mejor' : 'peor'}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${deltaFmt ? deltaFmt(Math.abs(delta)) : fmt.num(Math.abs(delta), 1)}</span> <span class="tenue">vs. periodo anterior</span>`;
  }
  const etq = { bien: 'En meta', alerta: 'Atención', critico: 'Crítico', info: '' }[estado] || '';
  return `<button class="ind ${estado}" ${ir ? `data-accion="ir" data-arg="${ir}"` : ''}>
    <div class="ind-cab"><span>${esc(titulo)}</span><span class="ico-caja">${icono(ico)}</span></div>
    <div class="ind-valor">${valor}${unidad ? `<small>${esc(unidad)}</small>` : ''}</div>
    <div class="ind-pie">${d}${etq ? pill(etq, estado) : ''}</div>
    ${nota ? `<div class="ind-pie">${nota}</div>` : ''}
  </button>`;
}

// Cuántos documentos estaban abiertos en una fecha (para comparar contra el periodo anterior).
function abiertosEn(col, fecha, { creado, cerrado, filtro = () => true }) {
  return S[col].filter(x => filtro(x) && creado(x) && creado(x).slice(0, 10) <= fecha && (!cerrado(x) || cerrado(x).slice(0, 10) > fecha)).length;
}

// Alertas operativas: cada una lleva al documento o módulo que la resuelve.
function alertasSistema() {
  const a = [];
  S.materiales.forEach(m => {
    const e = estadoMaterial(m.codigo);
    if (e === 'Agotado' || e === 'Crítico') {
      const ex = existencias(m.codigo);
      a.push({ tono: 'critico', texto: `${m.descripcion} está ${e === 'Agotado' ? 'agotado' : 'por debajo del mínimo'}`, det: `${fmt.cant(ex.fisica, m.unidad)} contra mínimo ${fmt.cant(m.min, m.unidad)} · en tránsito ${fmt.cant(enTransito(m.codigo), m.unidad)}`, doc: m.codigo });
    }
  });
  S.ordenesCompra.filter(o => estadoOC(o) === 'Retrasada').forEach(o => a.push({ tono: 'critico', texto: `La orden ${o.folio} presenta retraso`, det: `${proveedor(o.proveedor).razon} · prometida ${fmt.fecha(o.fechaPrometida)}`, doc: o.folio }));
  S.embarques.filter(e => ['Retrasado', 'Incidencia reportada'].includes(estadoEmbarque(e))).forEach(e => a.push({ tono: 'critico', texto: `El embarque ${e.folio} (${e.oc}) está ${estadoEmbarque(e).toLowerCase()}`, det: `Llegada estimada ${fmt.fecha(e.eta)}${e.eta !== e.etaOriginal ? ` (original ${fmt.fecha(e.etaOriginal)})` : ''}`, doc: e.folio }));
  S.ordenesProduccion.filter(o => ['Pendiente de materiales', 'Planificada', 'Lista para iniciar'].includes(o.estado)).forEach(o => {
    const f = requerimientosOP(o).filter(r => r.pendiente > r.reservado + r.disponible + 1e-6);
    if (f.length) a.push({ tono: o.estado === 'Pendiente de materiales' ? 'critico' : 'alerta', texto: `La orden ${o.folio} requiere ${fmt.cant(f[0].pendiente - f[0].reservado - f[0].disponible, material(f[0].material).unidad)} adicionales de ${minusc(material(f[0].material).descripcion)}`, det: `${producto(o.producto).nombre} · inicio ${fmt.fecha(o.iniPlan)}${f.length > 1 ? ` · y ${f.length - 1} material(es) más` : ''}`, doc: o.folio });
  });
  // líneas bajo meta: último día con producción terminada
  const ultimo = S.ordenesProduccion.filter(o => o.estado === 'Terminada').map(o => o.finReal.slice(0, 10)).sort().pop();
  if (ultimo) S.lineas.forEach(l => {
    const ops = S.ordenesProduccion.filter(o => o.linea === l.codigo && o.estado === 'Terminada' && o.finReal.slice(0, 10) === ultimo);
    const pl = suma(ops, o => o.planificada), ac = suma(ops, o => o.aceptada);
    if (pl && 100 * ac / pl < S.config.metas.planProduccion) a.push({ tono: 'alerta', texto: `La producción de la ${l.nombre.split(' ·')[0]} está por debajo de la meta`, det: `${fmt.num(ac)} de ${fmt.num(pl)} unidades (${fmt.pct(100 * ac / pl, 0)}) el ${fmt.fecha(ultimo)}`, ir: 'planeacion' });
  });
  const pendAut = S.solicitudes.filter(s => s.estado === 'Pendiente de autorización');
  if (pendAut.length) a.push({ tono: 'alerta', texto: pendAut.length === 1 ? 'Existe una solicitud de compra pendiente de autorización' : `Existen ${pendAut.length} solicitudes de compra pendientes de autorización`, det: pendAut.map(s => s.folio).join(', '), ir: 'solicitudes' });
  S.pedidos.filter(p => estadoPedido(p) === 'Retrasado').forEach(p => a.push({ tono: 'critico', texto: `El pedido ${p.folio} está atrasado`, det: `${cliente(p.cliente).nombre} · comprometido ${fmt.fecha(p.comprometida)} · ${p.estado.toLowerCase()}`, doc: p.folio }));
  S.lotes.filter(l => l.estado === 'Cuarentena' && l.cantidad > 0).forEach(l => a.push({ tono: 'alerta', texto: `Lote ${l.lote} en cuarentena`, det: `${material(l.material).descripcion} · ${fmt.cant(l.cantidad, material(l.material).unidad)} sin liberar`, doc: l.lote }));
  S.incidencias.filter(i => !['Resuelta', 'Cerrada'].includes(i.estado) && ['Alta', 'Crítica'].includes(i.severidad)).forEach(i => a.push({ tono: 'alerta', texto: `Incidencia ${i.folio}: ${i.tipo.toLowerCase()}`, det: i.descripcion, doc: i.folio }));
  const orden = { critico: 0, alerta: 1, info: 2 };
  return a.sort((x, y) => orden[x.tono] - orden[y.tono]);
}

function listaAlertas(alertas, limite = 8) {
  if (!alertas.length) return '<p class="vacio">Sin alertas: la operación está en orden.</p>';
  return `<ul class="lista-al">${alertas.slice(0, limite).map(x => `<li><button ${x.doc ? `data-doc="${esc(x.doc)}"` : `data-accion="ir" data-arg="${x.ir}"`}><span class="ic ${x.tono}">${x.tono === 'critico' ? '✕' : '!'}</span><span><b>${esc(x.texto)}</b><small>${esc(x.det || '')}</small></span></button></li>`).join('')}</ul>${alertas.length > limite ? `<p class="nota" style="margin-top:8px">y ${alertas.length - limite} alertas más en el centro de notificaciones.</p>` : ''}`;
}

const tituloPeriodo = r => `del ${fmt.fecha(r.desde)} al ${fmt.fecha(r.hasta)}`;
