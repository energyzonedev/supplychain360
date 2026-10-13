// Asistente de ayuda por reglas. Consulta los datos de la propia plataforma; no usa
// ninguna API externa (en un sitio estático una llave quedaría expuesta).
'use strict';

const SUGERENCIAS_BOT = ['¿Cuál es el OTIF del periodo?', '¿Qué materiales están críticos?', '¿Qué pasó con Polímeros Industriales?', '¿Cómo pruebo el flujo completo?'];
const PREGUNTAS_BOT = [
  '¿Cuál es el OTIF del periodo?', '¿Cuánto inventario hay de resina de polipropileno?', '¿Qué órdenes de compra están retrasadas?', '¿Qué embarques están en tránsito?',
  '¿Qué órdenes de producción no pueden iniciar?', '¿Cuánto se produjo ayer?', '¿Qué materiales están críticos?', '¿Qué pasó con Polímeros Industriales?',
  '¿Quién surte la tarjeta electrónica y cuánto tarda?', '¿Qué pedidos están atrasados?', '¿Cómo creo una solicitud de compra?', '¿Qué significa OEE?', '¿Qué incidencias están abiertas?',
];

const SIN_KPI = [
  ['otif', ['otif', 'a tiempo y completo', 'pedidos a tiempo', 'entregas completas']],
  ['proveedores', ['cumplimiento de proveedores', 'puntualidad de proveedores', 'proveedores a tiempo']],
  ['variacionPrecio', ['variacion de precio', 'variacion del precio', 'ppv']],
  ['cicloCompras', ['ciclo de compras', 'tiempo de compra']],
  ['entradaATiempo', ['entregas de entrada', 'entrada a tiempo', 'embarques a tiempo']],
  ['costoTransporteUnidad', ['costo de transporte', 'flete por unidad']],
  ['exactitud', ['exactitud', 'precision del inventario']],
  ['rotacion', ['rotacion']],
  ['criticos', ['porcentaje de materiales criticos', '% de materiales criticos']],
  ['planProduccion', ['cumplimiento del plan', 'plan de produccion']],
  ['calidad', ['rendimiento de calidad', 'calidad']],
  ['eficiencia', ['eficiencia del tiempo', 'eficiencia']],
  ['oee', ['oee', 'eficiencia global']],
  ['costoLogisticoUnidad', ['costo logistico por unidad']],
  ['costoCompras', ['costo de compras', 'costo total de compras', 'cuanto se compro', 'compras del periodo']],
  ['valorInventario', ['valor del inventario', 'valor de inventario', 'cuanto vale el inventario']],
  ['costoUnidadProducida', ['costo de produccion', 'costo por unidad producida']],
  ['costoLogistico', ['costo logistico']],
  ['desperdicio', ['desperdicio', 'merma']],
  ['cicloAbastecimiento', ['ciclo de abastecimiento']],
];

const cont = (q, p) => new RegExp(`(^|[^a-z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(q);

function buscarEntidades(q) {
  const kpis = SIN_KPI.filter(([, ps]) => ps.some(p => cont(q, p))).map(([k]) => k);
  // preferir el nombre más largo (costo logístico por unidad antes que costo logístico)
  // Coincidencia por palabras (singular o plural); gana el material con más palabras en común.
  const raiz = w => w.replace(/(es|s)$/, '');
  const palabrasQ = q.split(' ').map(raiz).filter(w => w.length > 3);
  const puntaje = txt => normalizar(txt).split(' ').map(raiz).filter(w => w.length > 3 && palabrasQ.includes(w)).length;
  const conPuntaje = S.materiales.map(m => ({ m, p: cont(q, normalizar(m.codigo)) ? 9 : puntaje(m.descripcion) })).filter(x => x.p > 0);
  const mejor = Math.max(0, ...conPuntaje.map(x => x.p));
  const mats = conPuntaje.filter(x => x.p === mejor).map(x => x.m);
  const prods = S.productos.filter(p => cont(q, normalizar(p.codigo)) || cont(q, normalizar(p.nombre)) || (normalizar(p.nombre).split(' ').slice(-1)[0].length > 4 && cont(q, normalizar(p.nombre).split(' ').slice(-1)[0])));
  const provs = S.proveedores.filter(p => cont(q, normalizar(p.codigo)) || normalizar(p.razon).split(' ').filter(w => w.length > 5 && w !== 'industriales').some(w => cont(q, w)));
  const folio = (q.match(/\b(sc|oc|emb|rec|sum|op|ope|ped|inc|lpt|mat|prv|pt|l)-?\d{1,4}\b/i) || [])[0];
  return { kpis, mats, prods, provs, folio };
}

function fechaDe(q) {
  if (/\bantier\b|antes de ayer/.test(q)) return sumarDias(hoy(), -2);
  if (/\bayer\b/.test(q)) return sumarDias(hoy(), -1);
  if (/\bhoy\b/.test(q)) return hoy();
  const meses = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  let m = q.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/);
  if (m) return `${hoy().slice(0, 4)}-${String(meses[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = q.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (m) return `${m[3] || hoy().slice(0, 4)}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const lista = items => `<ul>${items.join('')}</ul>`;

function responderBot(texto) {
  const q = normalizar(texto);
  const e = buscarEntidades(q);
  const r = periodoActual();
  const k = calcularKPIs(r);
  const K = c => k.find(x => x.clave === c);

  if (!q) return { html: '<p>Escribe una pregunta.</p>', chips: SUGERENCIAS_BOT };
  if (/^(hola|buen(os|as)|que tal|hey)\b/.test(q) && q.split(' ').length <= 4) return { html: '<p>¡Hola! Soy el asistente de SupplyChain 360. Pregúntame por KPIs, inventario, compras, embarques, producción, pedidos o incidencias.</p>', chips: SUGERENCIAS_BOT };
  if (/^(gracias|ok|listo|perfecto)\b/.test(q)) return { html: '<p>Con gusto. ¿Algo más?</p>', chips: SUGERENCIAS_BOT };
  if (/que (puedes|sabes) hacer|^ayuda$|que te puedo preguntar/.test(q)) return { html: `<p>Respondo con los datos de la plataforma (${tituloPeriodo(r)}):</p>${lista(['<li>Valor, meta y significado de los 20 KPIs.</li>', '<li>Existencias de cualquier material o producto.</li>', '<li>Órdenes de compra, embarques, órdenes de producción y pedidos con retraso.</li>', '<li>Producción de un día, materiales críticos e incidencias abiertas.</li>', '<li>Proveedores, tiempos de entrega y desempeño.</li>', '<li>Cómo hacer cada operación.</li>'])}`, chips: PREGUNTAS_BOT.slice(0, 6) };

  // Un folio concreto: lo abre.
  if (e.folio && documento(e.folio.toUpperCase().replace(/^([A-Z]+)-?(\d+)$/, (m, a, n) => `${a}-${['MAT', 'PRV', 'PT'].includes(a) ? n.padStart(3, '0') : n.padStart(4, '0')}`))) {
    const f = e.folio.toUpperCase().replace(/^([A-Z]+)-?(\d+)$/, (m, a, n) => `${a}-${['MAT', 'PRV', 'PT'].includes(a) ? n.padStart(3, '0') : n.padStart(4, '0')}`);
    const d = documento(f);
    return { html: `<p>${esc(d.tipo)} ${docLink(f)}${d.reg.estado ? ' · ' + pill(d.reg.estado) : ''}. Ábrelo para ver sus datos, sus documentos relacionados y su historial.</p>`, doc: f };
  }

  // Cómo hacer algo
  if (/\bcomo (creo|crear|hago|hacer|registro|registrar|autorizo|autorizar|convierto|convertir|surto|surtir|recibo|recibir|inicio|iniciar|programo|programar|despacho|despachar|exporto|exportar|simulo|simular|cambio|cambiar|pruebo|probar|restauro|restaurar)\b|pasos para|como funciona|guia/.test(q)) {
    const ayudas = [
      [/flujo|completo|probar|pruebo|guia|demostracion/, 'guia', 'Probar el flujo completo', ['Abre «Modo demostración» (botón morado arriba).', 'Sigue la guía de 9 pasos o pulsa «Ejecutar simulación completa» para que el sistema lo haga solo.', 'Al final puedes «Restablecer estado previo».']],
      [/solicitud/, 'solicitudes', 'Crear una solicitud de compra', ['Pulsa «Crear solicitud de compra» (Dashboard o Solicitudes).', 'Elige área, material, cantidad, prioridad y motivo.', 'Queda «Pendiente de autorización»; un rol de Compras, Dirección o Administrador la autoriza o la rechaza con motivo.', 'Ya autorizada, «Convertir en OC» genera una sola orden de compra con el folio de origen.']],
      [/autoriz/, 'solicitudes', 'Autorizar una solicitud', ['En «Solicitudes de compra», filtra por «Pendiente de autorización».', 'Pulsa «Autorizar» (o «Rechazar», que exige motivo).']],
      [/orden de compra|convert|oc\b/, 'compras', 'Crear o convertir una orden de compra', ['Desde una solicitud autorizada: «Convertir en OC».', 'Directa: «Compras y proveedores» → «Crear orden de compra»; agrega materiales y los totales con IVA y flete se calculan solos.', 'Después: enviar, registrar confirmación y programar embarque.']],
      [/recib|recepcion/, 'almacen', 'Registrar una recepción', ['«Almacén» → pestaña «Recepción e inspección».', 'Captura recibido y aceptado por material; lo rechazado no entra al inventario y abre una incidencia.', 'Puedes mandar el lote a cuarentena.']],
      [/embarque|programo|programar/, 'transporte', 'Programar y mover un embarque', ['Abre la orden de compra y pulsa «Programar embarque» (transportista, fechas, tarimas).', 'En «Transporte» avanza: En preparación → En tránsito → En revisión de recepción.', 'Puedes registrar retrasos e incidencias de daño, pérdida o documentación.']],
      [/surt|suministro/, 'suministro', 'Surtir material a producción', ['Abre la orden de producción → «Solicitar materiales».', 'En «Suministro a producción» pulsa «Surtir»: se toma primero lo reservado y luego los lotes más antiguos (PEPS).', 'Si falta material, el sistema ofrece crear solicitudes de compra para el faltante.']],
      [/inici|orden de produccion|produccion/, 'planeacion', 'Crear e iniciar una orden de producción', ['«Planeación de producción» → «Crear orden de producción» (muestra los materiales requeridos y si alcanzan).', 'Surte el material; la orden pasa a «Lista para iniciar».', 'Sin material no inicia, salvo excepción del Administrador con motivo auditado.']],
      [/despach|pedido/, 'pedidos', 'Despachar un pedido', ['«Pedidos y despachos» → crea el pedido.', 'Reservar → Preparar → Despachar → Registrar entrega.', 'Si no alcanza el producto, el sistema pide confirmación para despachar incompleto.']],
      [/export|reporte/, 'reportes', 'Exportar un reporte', ['«Reportes» → elige el reporte y el periodo.', 'Descarga CSV, Excel (.xls) o imprime a PDF.']],
      [/simul|escenario/, 'simulador', 'Simular un escenario', ['«Simulador de escenarios» → elige A–E y mueve las variables.', '«Ejecutar simulación» compara la situación base contra el escenario sin tocar los datos.', '«Aplicar cambios» sólo si quieres llevarlo a los datos.']],
      [/rol|cambio|cambiar/, 'configuracion', 'Cambiar de rol de demostración', ['Pulsa tu nombre arriba a la derecha y elige otro rol.', 'Es sólo demostración: sirve para ver qué acciones se habilitan por rol.']],
      [/restaur/, 'configuracion', 'Restaurar los datos', ['Botón «Restaurar datos de demostración» (Modo demostración o Configuración → Datos).', 'Pide confirmación y regenera los 30 días de histórico.']],
    ];
    const a = ayudas.find(([re]) => re.test(q));
    if (a) return { html: `<p><b>${a[2]}:</b></p><ol>${a[3].map(x => `<li>${esc(x)}</li>`).join('')}</ol>`, ir: [['Ir ahí', a[1]]] };
  }

  // Definición de un KPI
  if (e.kpis.length && /que (es|significa|mide|quiere decir)|definicion|formula|como se calcula|para que sirve/.test(q)) {
    const x = K(e.kpis.sort((a, b) => SIN_KPI.findIndex(s => s[0] === a) - SIN_KPI.findIndex(s => s[0] === b))[0]);
    return { html: `<p><b>${esc(x.nombre)}.</b> ${esc(x.definicion)}</p><p><b>Fórmula:</b> ${esc(x.formula)}<br><b>Meta:</b> ${esc(formatoMeta(x))}<br><b>Valor (${tituloPeriodo(r)}):</b> ${esc(formatoKPI(x))} ${x.semaforo === 'sindatos' ? '' : pill({ bien: 'En meta', alerta: 'Atención', critico: 'Fuera de meta', info: 'Seguimiento' }[x.semaforo], x.semaforo)}</p>`, ir: [['Ver en KPIs', 'kpis']] };
  }

  // Proveedor / tiempo de entrega
  const pideProv = /proveedor|quien (surte|vende|provee)|\bsurte\b|cuanto tarda|tiempo de entrega|lead time/.test(q);
  if (pideProv && !e.kpis.includes('proveedores')) {
    let provs = e.provs;
    if (!provs.length && e.mats.length) provs = [...new Set(e.mats.map(m => proveedor(m.proveedor)))];
    if (provs.length) return { html: provs.map(p => { const d = desempenoProveedor(p.codigo); return `<p><b>${esc(p.razon)}</b> (${docLink(p.codigo)}), ${esc(p.zona)}. Surte ${esc(S.materiales.filter(m => m.proveedor === p.codigo).map(m => minusc(m.descripcion)).join(', '))}.</p><p>Entrega promedio: <b>${p.lead} días</b>. Puntualidad real: ${d.puntualidad == null ? 'sin datos suficientes' : `<b>${fmt.pct(d.puntualidad, 0)}</b> de ${d.n} órdenes${d.atraso ? `, atraso promedio ${fmt.num(d.atraso, 1)} días` : ''}`}.</p>`; }).join(''), ir: [['Ver proveedores', 'compras']] };
    return { html: `<p>Proveedores y tiempo de entrega:</p>${lista(S.proveedores.map(p => `<li>${docLink(p.codigo)} ${esc(p.razon)} · ${p.lead} días</li>`))}`, ir: [['Ver proveedores', 'compras']] };
  }

  // Evento del mes
  if (/que paso|que ocurrio|retraso de|polimeros|resina.*(retras|falt)|evento|por que (bajo|cayo)|problema/.test(q) || e.provs.some(p => p.codigo === EVENTO_DEMO.proveedor)) {
    const p = proveedor(EVENTO_DEMO.proveedor);
    const ocs = S.ordenesCompra.filter(o => o.proveedor === p.codigo);
    const tarde = ocs.filter(o => o.fechaRecepcion && o.fechaRecepcion > o.fechaPrometida);
    const dsp = desempenoProveedor(p.codigo);
    const paro = S.incidencias.find(i => i.tipo === 'Paro de maquinaria');
    return { html: `<p><b>${esc(EVENTO_DEMO.titulo)}.</b> Las órdenes de resina confirmadas entre el ${fmt.fecha(EVENTO_DEMO.desde)} y el ${fmt.fecha(EVENTO_DEMO.hasta)} llegaron ${EVENTO_DEMO.retraso} días tarde: ${tarde.map(o => docLink(o.folio)).join(', ') || 'ninguna en el histórico actual'}.</p>
      <p>Por eso ${esc(p.razon)} tiene ${dsp.puntualidad == null ? 'sin datos' : fmt.pct(dsp.puntualidad, 0)} de puntualidad y las compras urgentes se pagaron con sobreprecio (variación de precio del proveedor: ${fmt.pct(dsp.variacion, 1)}).</p>
      ${paro ? `<p>Además, ${fmt.fecha(paro.fecha)}: ${esc(paro.descripcion)} (${docLink(paro.folio)}).</p>` : ''}`, ir: [['Ver desempeño de proveedores', 'compras']] };
  }

  // Materiales críticos
  if (/critic|bajo (el )?minimo|por debajo|agotad|faltan materiales|que hay que (pedir|comprar)|desabasto/.test(q) && !e.kpis.includes('criticos')) {
    const c = S.materiales.filter(m => ['Crítico', 'Agotado'].includes(estadoMaterial(m.codigo)));
    return { html: c.length ? `<p><b>${c.length}</b> materiales están por debajo de su mínimo:</p>${lista(c.map(m => { const x = existencias(m.codigo); return `<li>${docLink(m.codigo)} ${esc(m.descripcion)}: ${fmt.cant(x.fisica, m.unidad)} contra mínimo ${fmt.cant(m.min, m.unidad)} · en tránsito ${fmt.cant(enTransito(m.codigo), m.unidad)}</li>`; }))}<p>Solicitudes pendientes de autorización: ${S.solicitudes.filter(s => s.estado === 'Pendiente de autorización').length}.</p>` : '<p>Ningún material está por debajo de su mínimo.</p>', ir: [['Ir a Almacén', 'almacen']] };
  }

  // Producción de un día
  const f = fechaDe(q);
  if (/produj|produc|fabric|unidades/.test(q) && f && !/orden/.test(q)) {
    const ops = S.ordenesProduccion.filter(o => o.estado === 'Terminada' && o.finReal.slice(0, 10) === f);
    if (!ops.length) return { html: `<p>No hay órdenes terminadas el ${fmt.fecha(f)}${esDomingo(f) ? ' (domingo: la planta no opera)' : ''}.</p>`, ir: [['Ver planeación', 'planeacion']] };
    return { html: `<p>El ${fmt.fecha(f)} se terminaron <b>${ops.length}</b> órdenes con <b>${fmt.num(suma(ops, o => o.aceptada))}</b> unidades aceptadas de ${fmt.num(suma(ops, o => o.planificada))} planificadas (${fmt.num(suma(ops, o => o.defectuosa))} defectuosas):</p>${lista(ops.map(o => `<li>${docLink(o.folio)} ${esc(producto(o.producto).nombre)}: ${fmt.num(o.aceptada)} u</li>`))}`, ir: [['Ver manufactura', 'manufactura']] };
  }

  // Órdenes de compra
  if (/orden(es)? de compra|\boc\b|compras? (pendiente|retrasad|abierta)/.test(q)) {
    const ab = S.ordenesCompra.filter(o => OC_ABIERTA.includes(o.estado));
    const ret = ab.filter(o => estadoOC(o) === 'Retrasada');
    return { html: `<p>Hay <b>${ab.length}</b> órdenes de compra abiertas${ret.length ? `, <b>${ret.length}</b> retrasadas` : ' y ninguna retrasada'}:</p>${lista(ab.map(o => `<li>${docLink(o.folio)} ${esc(proveedor(o.proveedor).razon)} · prometida ${fmt.fecha(o.fechaPrometida)} · ${pill(estadoOC(o))}</li>`))}`, ir: [['Ir a Compras', 'compras']] };
  }
  // Embarques
  if (/embarque|transito|camion|en camino|envio|transporte/.test(q) && !e.kpis.length) {
    const act = S.embarques.filter(x => !['Entregado', 'Cancelado'].includes(x.estado));
    return { html: act.length ? `<p><b>${act.length}</b> embarques activos:</p>${lista(act.map(x => `<li>${docLink(x.folio)} (${x.oc}) ${esc(proveedor(x.proveedor).razon)} · llega ${fmt.fecha(x.eta)} · ${pill(estadoEmbarque(x))}</li>`))}` : '<p>No hay embarques activos.</p>', ir: [['Ir a Transporte', 'transporte']] };
  }
  // Órdenes de producción
  if (/orden(es)? de produccion|\bop\b|no pueden? iniciar|en proceso|pausad|pendientes? de materiales/.test(q)) {
    const bloq = S.ordenesProduccion.filter(o => ['Planificada', 'Pendiente de materiales'].includes(o.estado) && requerimientosOP(o).some(x => x.pendiente > x.reservado + x.disponible + 1e-6));
    const proc = S.ordenesProduccion.filter(o => ['En proceso', 'Pausada', 'Lista para iniciar'].includes(o.estado));
    return { html: `${proc.length ? `<p>En piso o listas:</p>${lista(proc.map(o => `<li>${docLink(o.folio)} ${esc(producto(o.producto).nombre)} · ${fmt.num(o.aceptada)}/${fmt.num(o.planificada)} · ${pill(o.estado)}</li>`))}` : ''}
      ${bloq.length ? `<p><b>No pueden iniciar</b> por falta de material:</p>${lista(bloq.map(o => `<li>${docLink(o.folio)} ${esc(producto(o.producto).nombre)}: falta ${requerimientosOP(o).filter(x => x.pendiente > x.reservado + x.disponible).map(x => minusc(material(x.material).descripcion)).join(', ')}</li>`))}` : '<p>Todas las órdenes planificadas tienen material.</p>'}`, ir: [['Ir a Planeación', 'planeacion']] };
  }
  // Pedidos atrasados
  if (/pedido/.test(q)) {
    const at = S.pedidos.filter(p => estadoPedido(p) === 'Retrasado');
    return { html: at.length ? `<p><b>${at.length}</b> ${at.length === 1 ? 'pedido atrasado' : 'pedidos atrasados'}:</p>${lista(at.map(p => `<li>${docLink(p.folio)} ${esc(cliente(p.cliente).nombre)} · comprometido ${fmt.fecha(p.comprometida)} · ${esc(p.estado)}</li>`))}` : '<p>No hay pedidos atrasados.</p>', ir: [['Ir a Pedidos', 'pedidos']] };
  }
  // Incidencias
  if (/incidencia|problemas abiertos/.test(q)) {
    const ab = S.incidencias.filter(i => !['Resuelta', 'Cerrada'].includes(i.estado));
    return { html: ab.length ? `<p><b>${ab.length}</b> incidencias abiertas:</p>${lista(ab.map(i => `<li>${docLink(i.folio)} ${esc(i.tipo)} · ${pill(i.severidad)}</li>`))}` : '<p>No hay incidencias abiertas.</p>', ir: [['Ir a Incidencias', 'incidencias']] };
  }
  // Inventario
  if (/inventario|existencia|cuant[oa]s? (hay|tenemos|queda)|stock|disponible/.test(q) && !e.kpis.includes('valorInventario')) {
    if (e.mats.length || e.prods.length) return {
      html: [...e.mats.slice(0, 4).map(m => { const x = existencias(m.codigo); return `<p>${docLink(m.codigo)} <b>${esc(m.descripcion)}</b>: ${fmt.cant(x.fisica, m.unidad)} físicos, ${fmt.cant(x.reservada, m.unidad)} reservados, <b>${fmt.cant(x.disponible, m.unidad)} disponibles</b>. Mínimo ${fmt.cant(m.min, m.unidad)} · en tránsito ${fmt.cant(enTransito(m.codigo), m.unidad)} · ${pill(estadoMaterial(m.codigo))}</p>`; }),
        ...e.prods.slice(0, 3).map(p => `<p>${docLink(p.codigo)} <b>${esc(p.nombre)}</b>: ${fmt.num(disponiblePT(p.codigo))} unidades disponibles de producto terminado.</p>`)].join(''), ir: [['Ir a Almacén', 'almacen']] };
    return { html: `<p>Inventario: ${formatoKPI(K('valorInventario'))} (${esc(K('valorInventario').detalle)}). Pregúntame por un material o producto, por ejemplo «¿cuánto hay de resina ABS?».</p>`, ir: [['Ir a Almacén', 'almacen']] };
  }
  if ((e.mats.length || e.prods.length) && !e.kpis.length) return responderBot('inventario ' + texto);

  // Valor de un KPI
  if (e.kpis.length) {
    const x = K(e.kpis.sort((a, b) => SIN_KPI.find(s => s[0] === b)[1][0].length - SIN_KPI.find(s => s[0] === a)[1][0].length)[0]);
    return { html: `<p><b>${esc(x.nombre)}</b> ${tituloPeriodo(r)}: <b>${esc(formatoKPI(x))}</b>. Meta ${esc(formatoMeta(x))} ${x.semaforo === 'sindatos' || x.semaforo === 'info' ? '' : pill({ bien: 'En meta', alerta: 'Atención', critico: 'Fuera de meta' }[x.semaforo], x.semaforo)}</p><p class="tenue">${esc(x.detalle || '')}</p>`, ir: [['Ver en KPIs', 'kpis']], chips: [`¿Qué significa ${x.nombre}?`, '¿Qué pasó con Polímeros Industriales?'] };
  }
  if (/kpi|indicador|como vamos|resumen/.test(q)) {
    const fuera = k.filter(x => ['alerta', 'critico'].includes(x.semaforo));
    return { html: `<p>${tituloPeriodo(r)}: ${k.filter(x => x.semaforo === 'bien').length} indicadores en meta y ${fuera.length} fuera o en atención:</p>${lista(fuera.map(x => `<li>${esc(x.nombre)}: ${esc(formatoKPI(x))} (meta ${esc(formatoMeta(x))})</li>`))}`, ir: [['Ver KPIs', 'kpis']] };
  }

  return { html: `<p>No entendí «${esc(texto)}». Estas son preguntas que sí sé responder:</p>`, chips: PREGUNTAS_BOT };
}

function iniciarBot() {
  const btn = document.getElementById('botBtn');
  const panel = document.getElementById('botPanel');
  const msgs = document.getElementById('botMsgs');
  const chips = document.getElementById('botChips');
  const entrada = document.getElementById('botEntrada');
  const ponerChips = l => { chips.innerHTML = (l || SUGERENCIAS_BOT).map(c => `<button class="chip">${esc(c)}</button>`).join(''); chips.querySelectorAll('.chip').forEach(c => c.onclick = () => preguntar(c.textContent)); };
  const agregar = (quien, html) => { const d = document.createElement('div'); d.className = `msg msg-${quien}`; d.innerHTML = html; msgs.appendChild(d); return d; };
  function preguntar(t) {
    t = String(t).trim();
    if (!t) return;
    agregar('yo', esc(t));
    let r;
    try { r = responderBot(t); } catch (e) { console.error(e); r = { html: '<p>Tuve un problema con esa consulta. Prueba con otra pregunta.</p>', chips: PREGUNTAS_BOT }; }
    const acc = [...(r.ir || []).map(([txt, m]) => `<button class="btn btn-sec btn-chico" data-accion="ir" data-arg="${m}">${esc(txt)}</button>`), r.doc ? `<button class="btn btn-sec btn-chico" data-doc="${r.doc}">Abrir ${esc(r.doc)}</button>` : ''].join('');
    const d = agregar('bot', r.html + (acc ? `<div class="msg-acc">${acc}</div>` : ''));
    ponerChips(r.chips);
    msgs.scrollTop = Math.max(0, d.offsetTop - msgs.offsetTop - 40);
  }
  const abrir = () => {
    panel.hidden = false; btn.classList.add('oculto'); btn.setAttribute('aria-expanded', 'true');
    if (!msgs.children.length) { agregar('bot', '<p>Hola, soy el asistente de <b>SupplyChain 360 AI</b>. Respondo con los datos de la plataforma: KPIs, inventario, compras, embarques, producción, pedidos e incidencias.</p><p>Elige una pregunta o escribe la tuya.</p>'); ponerChips(); }
    if (innerWidth > 700) entrada.focus();
  };
  const cerrar = () => { panel.hidden = true; btn.classList.remove('oculto'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); };
  btn.onclick = abrir;
  document.getElementById('botCerrar').onclick = cerrar;
  panel.addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrar(); });
  panel.addEventListener('click', ev => { if (ev.target.closest('[data-accion="ir"]') && innerWidth < 700) cerrar(); });
  document.getElementById('botForm').onsubmit = ev => { ev.preventDefault(); preguntar(entrada.value); entrada.value = ''; };
}
