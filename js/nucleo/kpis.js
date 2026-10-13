// Los 20 KPIs. Todos se calculan con los registros de la simulación; ninguno se
// escribe a mano. Si el denominador es cero se informa «Sin datos suficientes».
'use strict';

const DEF_KPI = [
  // clave, grupo, nombre, unidad, mayorMejor, metaClave, definición, fórmula
  ['proveedores', 'Compras', 'Cumplimiento de proveedores', '%', true, 'proveedores', 'Órdenes de compra recibidas en o antes de la fecha prometida por el proveedor.', 'Entregas recibidas a tiempo ÷ entregas evaluables × 100'],
  ['variacionPrecio', 'Compras', 'Variación del precio de compra', '%', false, 'variacionPrecio', 'Cuánto se pagó por encima (o por debajo) del precio de referencia de cada material.', '(Precio real − precio de referencia) ÷ precio de referencia × 100, ponderado por cantidad'],
  ['cicloCompras', 'Compras', 'Tiempo de ciclo de compras', 'días hábiles', false, 'cicloCompras', 'Días hábiles entre la autorización de la solicitud y la emisión de su orden de compra.', 'Promedio de días hábiles (autorización → emisión de OC)'],
  ['entradaATiempo', 'Transporte', 'Entregas de entrada a tiempo', '%', true, 'entradaATiempo', 'Embarques que llegaron a planta dentro de la fecha estimada original.', 'Embarques a tiempo ÷ embarques entregados × 100'],
  ['costoTransporteUnidad', 'Transporte', 'Costo de transporte por unidad recibida', 'MXN/u', false, 'costoTransporteUnidad', 'Flete de entrada dividido entre las unidades de material aceptadas en esos embarques (kg, m, L o piezas, según el material).', 'Costo de los embarques entregados ÷ unidades aceptadas en esos embarques'],
  ['exactitud', 'Almacén', 'Exactitud del inventario', '%', true, 'exactitud', 'Conteos físicos que coincidieron con el registro del sistema.', 'Registros auditados correctos ÷ registros auditados × 100'],
  ['rotacion', 'Almacén', 'Rotación del inventario', 'vueltas/año', true, 'rotacionAnual', 'Veces que se consume el inventario promedio de materiales, anualizado para compararlo con la meta.', '(Costo de materiales consumidos ÷ inventario promedio valorizado) × 365 ÷ días del periodo'],
  ['criticos', 'Almacén', 'Materiales críticos', '%', false, 'criticos', 'Materiales activos con existencia por debajo de su mínimo (foto actual).', 'Materiales bajo mínimo ÷ materiales activos × 100'],
  ['planProduccion', 'Producción', 'Cumplimiento del plan de producción', '%', true, 'planProduccion', 'Unidades aceptadas contra unidades planificadas de las órdenes que vencían en el periodo.', 'Unidades aceptadas ÷ unidades planificadas × 100'],
  ['calidad', 'Producción', 'Rendimiento de calidad', '%', true, 'calidad', 'Unidades buenas entre unidades fabricadas.', 'Unidades aceptadas ÷ unidades fabricadas × 100'],
  ['eficiencia', 'Producción', 'Eficiencia del tiempo de producción', '%', true, 'eficiencia', 'Tiempo estándar de lo fabricado contra el tiempo real registrado en las operaciones.', 'Tiempo estándar de las unidades procesadas ÷ tiempo real × 100'],
  ['oee', 'Producción', 'OEE (eficiencia global de los equipos)', '%', true, 'oee', 'Disponibilidad × rendimiento × calidad. Disponibilidad = tiempo operando ÷ (tiempo operando + paros); rendimiento = tiempo estándar ÷ tiempo operando; calidad = aceptadas ÷ fabricadas. Los tres como decimales. La meta es una referencia, no una garantía.', 'Disponibilidad × rendimiento × calidad × 100'],
  ['otif', 'Distribución', 'OTIF (completas y a tiempo)', '%', true, 'otif', 'Pedidos entregados completos y dentro de la fecha comprometida. Un pedido vencido sin entregar cuenta como falla.', 'Pedidos completos y a tiempo ÷ pedidos evaluables × 100'],
  ['costoLogisticoUnidad', 'Distribución', 'Costo logístico por unidad', 'MXN/u', false, 'costoLogisticoUnidad', 'Costo logístico total del periodo entre las unidades de producto entregadas a clientes.', 'Costo logístico total ÷ unidades entregadas'],
  ['costoCompras', 'Financieros', 'Costo total de compras', 'MXN', null, null, 'Subtotal sin IVA de las órdenes de compra emitidas en el periodo. Incluye: precio × cantidad. Excluye: IVA (acreditable), flete (va en costo logístico) y órdenes canceladas.', 'Σ cantidad × precio de las OC emitidas en el periodo'],
  ['valorInventario', 'Financieros', 'Valor actual del inventario', 'MXN', null, null, 'Foto actual: existencia física de lotes de material (a su costo de compra) más producto terminado en existencia (a su costo de fabricación). Incluye lotes en cuarentena y bloqueados.', 'Σ existencia × costo unitario de cada lote'],
  ['costoUnidadProducida', 'Financieros', 'Costo de producción por unidad aceptada', 'MXN/u', false, null, 'Órdenes terminadas en el periodo. Incluye: materiales efectivamente consumidos (salidas menos devoluciones) y tiempo real de línea × costo por minuto. Cada orden se cuenta una sola vez.', '(Materiales consumidos + minutos reales × costo/minuto) ÷ unidades aceptadas'],
  ['costoLogistico', 'Financieros', 'Costo logístico total', 'MXN', null, null, 'Incluye: flete de entrada de embarques entregados en el periodo, costo de envío de pedidos despachados en el periodo y operación del almacén por día. Ningún costo se cuenta dos veces.', 'Flete de entrada + envíos a clientes + almacén × días'],
  ['desperdicio', 'Financieros', 'Desperdicio de materiales', '%', false, 'desperdicio', 'Valor del material contenido en las unidades rechazadas más el material rechazado en la recepción, contra todo el material consumido o rechazado.', '(Material en unidades rechazadas + material rechazado en recepción) ÷ (material consumido + rechazado en recepción) × 100'],
  ['cicloAbastecimiento', 'Financieros', 'Tiempo total del ciclo de abastecimiento', 'días', false, 'cicloAbastecimiento', 'Días naturales desde que se crea la solicitud de compra hasta que su orden se recibe completa.', 'Promedio de días (creación de la solicitud → recepción completa)'],
];

function periodoDesde(dias) {
  const hasta = hoy();
  return { desde: sumarDias(hasta, -(dias - 1)), hasta, dias };
}

const enRango = (f, r) => !!f && f.slice(0, 10) >= r.desde && f.slice(0, 10) <= r.hasta;

// Valor del inventario de materiales y PT al cierre de cada fecha, reconstruido con los movimientos.
function valorInventarioAl(fecha) {
  let mat = 0, pt = 0;
  for (const m of S.movimientos) {
    if (m.fecha.slice(0, 10) > fecha) continue;
    const v = m.cantidad * m.costoUnit;
    if (m.material) mat += v; else pt += v;
  }
  return { materiales: mat, terminado: pt, total: mat + pt };
}

function seriesInventario(desde, hasta) {
  const fechas = rangoFechas(desde, hasta);
  const movs = S.movimientos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  let i = 0, mat = 0, pt = 0;
  return fechas.map(f => {
    while (i < movs.length && movs[i].fecha.slice(0, 10) <= f) {
      const v = movs[i].cantidad * movs[i].costoUnit;
      if (movs[i].material) mat += v; else pt += v;
      i++;
    }
    return { fecha: f, materiales: mat, terminado: pt, total: mat + pt };
  });
}

// Material de una unidad de producto, a costo actual.
const costoMaterialUnidad = prod => suma(Object.entries(producto(prod).bom), ([m, q]) => q * material(m).costo);

function calcularKPIs(r, filtros = {}) {
  const { proveedor: fProv, material: fMat, producto: fProd } = filtros;
  const dias = diasEntre(r.desde, r.hasta) + 1;
  const ocsF = S.ordenesCompra.filter(o => (!fProv || o.proveedor === fProv) && (!fMat || o.lineas.some(l => l.material === fMat)));
  const opsF = S.ordenesProduccion.filter(o => !fProd || o.producto === fProd);
  const v = {}, det = {};

  // 1. proveedores
  const recibidas = ocsF.filter(o => o.estado === 'Recibida' && enRango(o.fechaRecepcion, r));
  const aTiempo = recibidas.filter(o => o.fechaRecepcion <= o.fechaPrometida);
  v.proveedores = dividir(aTiempo.length, recibidas.length) * 100 || (recibidas.length ? 0 : null);
  det.proveedores = `${aTiempo.length} de ${recibidas.length} órdenes recibidas a tiempo`;

  // 2. variación de precio
  const lineasEm = ocsF.filter(o => o.estado !== 'Cancelada' && enRango(o.fechaEmision, r)).flatMap(o => o.lineas).filter(l => !fMat || l.material === fMat);
  const ref = suma(lineasEm, l => l.cantidad * material(l.material).precioRef);
  const real = suma(lineasEm, l => l.cantidad * l.precio);
  v.variacionPrecio = ref ? (real - ref) / ref * 100 : null;
  det.variacionPrecio = `${fmt.mxn(real, 0)} pagados contra ${fmt.mxn(ref, 0)} a precio de referencia`;

  // 3. ciclo de compras
  const conSol = ocsF.filter(o => o.solicitud && enRango(o.fechaEmision, r)).map(o => ({ oc: o, sc: buscarPor('solicitudes', o.solicitud) })).filter(x => x.sc && x.sc.fechaAutorizacion);
  v.cicloCompras = conSol.length ? promedio(conSol.map(x => diasHabilesEntre(x.sc.fechaAutorizacion.slice(0, 10), x.oc.fechaEmision))) : null;
  det.cicloCompras = `${conSol.length} órdenes con solicitud de origen`;

  // 4. entradas a tiempo (contra la llegada estimada original del embarque)
  const embs = S.embarques.filter(e => e.estado === 'Entregado' && enRango(e.llegada, r) && (!fProv || e.proveedor === fProv));
  const embOk = embs.filter(e => e.llegada <= e.etaOriginal);
  v.entradaATiempo = embs.length ? 100 * embOk.length / embs.length : null;
  det.entradaATiempo = `${embOk.length} de ${embs.length} embarques llegaron a tiempo`;

  // 5. costo de transporte por unidad recibida
  const recs = embs.map(e => buscarPor('recepciones', e.recepcion)).filter(Boolean);
  const unidades = suma(recs.flatMap(x => x.lineas), l => l.aceptado);
  v.costoTransporteUnidad = unidades ? suma(embs, e => e.costo) / unidades : null;
  det.costoTransporteUnidad = `${fmt.mxn(suma(embs, e => e.costo), 0)} de flete ÷ ${fmt.num(unidades)} unidades`;

  // 6. exactitud
  const cnts = S.conteos.filter(c => enRango(c.fecha, r) && (!fMat || c.material === fMat));
  v.exactitud = cnts.length ? 100 * cnts.filter(c => Math.abs(c.diferencia) < 1e-6).length / cnts.length : null;
  det.exactitud = `${cnts.filter(c => Math.abs(c.diferencia) < 1e-6).length} de ${cnts.length} conteos sin diferencia`;

  // 7. rotación
  const salidas = S.movimientos.filter(m => m.material && ['Salida a producción', 'Devolución de producción'].includes(m.tipo) && enRango(m.fecha, r) && (!fMat || m.material === fMat));
  const consumido = -suma(salidas, m => m.cantidad * m.costoUnit);
  const serieInv = seriesInventario(r.desde, r.hasta);
  const invProm = fMat ? null : promedio(serieInv.map(x => x.materiales));
  v.rotacion = invProm ? (consumido / invProm) * 365 / dias : null;
  det.rotacion = `${fmt.mxn(consumido, 0)} consumidos · inventario promedio ${fmt.mxn(invProm, 0)}`;

  // 8. materiales críticos (foto actual)
  const activos = S.materiales.filter(m => m.activo);
  const bajo = activos.filter(m => ['Crítico', 'Agotado'].includes(estadoMaterial(m.codigo)));
  v.criticos = activos.length ? 100 * bajo.length / activos.length : null;
  det.criticos = `${bajo.length} de ${activos.length} materiales bajo su mínimo`;

  // 9-12. producción
  const opsPer = opsF.filter(o => o.estado !== 'Cancelada' && enRango(o.finPlan, r) && o.finPlan <= hoy());
  const plan = suma(opsPer, o => o.planificada), acept = suma(opsPer, o => o.aceptada);
  v.planProduccion = plan ? 100 * acept / plan : null;
  det.planProduccion = `${fmt.num(acept)} aceptadas de ${fmt.num(plan)} planificadas`;
  const termin = opsF.filter(o => o.estado === 'Terminada' && enRango(o.finReal, r));
  const fab = suma(termin, o => o.fabricada), ok = suma(termin, o => o.aceptada);
  v.calidad = fab ? 100 * ok / fab : null;
  det.calidad = `${fmt.num(ok)} buenas de ${fmt.num(fab)} fabricadas`;
  const opes = S.operaciones.filter(o => termin.some(t => t.folio === o.op));
  const tStd = suma(opes, o => o.procesada * o.tEstUnit), tReal = suma(opes, o => o.tReal);
  v.eficiencia = tReal ? 100 * tStd / tReal : null;
  det.eficiencia = `${fmt.num(tStd, 0)} min estándar ÷ ${fmt.num(tReal, 0)} min reales`;
  const paros = suma(termin.flatMap(o => o.paros), p => p.minutos);
  const disp = tReal ? tReal / (tReal + paros) : null;
  const rend = tReal ? Math.min(1, tStd / tReal) : null;
  const cal = fab ? ok / fab : null;
  v.oee = disp != null && cal != null ? disp * rend * cal * 100 : null;
  det.oee = disp != null ? `Disponibilidad ${fmt.pct(disp * 100)} × rendimiento ${fmt.pct(rend * 100)} × calidad ${fmt.pct(cal * 100)}` : '';

  // 13. OTIF
  const evaluables = S.pedidos.filter(p => p.estado !== 'Cancelado' && enRango(p.comprometida, r) && p.comprometida < hoy() && (!fProd || p.lineas.some(l => l.producto === fProd)));
  const otifOk = evaluables.filter(p => p.estado === 'Entregado' && p.completo && p.entrega <= p.comprometida);
  v.otif = evaluables.length ? 100 * otifOk.length / evaluables.length : null;
  det.otif = `${otifOk.length} de ${evaluables.length} pedidos completos y a tiempo`;

  // 14 y 18. costo logístico (sin duplicar)
  const fleteEntrada = suma(S.embarques.filter(e => e.estado === 'Entregado' && enRango(e.llegada, r)), e => e.costo);
  const despachados = S.pedidos.filter(p => p.despacho && enRango(p.despacho, r));
  const envios = suma(despachados, p => p.costoEnvio);
  const almacen = S.config.costoAlmacenDia * dias;
  v.costoLogistico = fleteEntrada + envios + almacen;
  det.costoLogistico = `Flete de entrada ${fmt.mxn(fleteEntrada, 0)} + envíos ${fmt.mxn(envios, 0)} + almacén ${fmt.mxn(almacen, 0)}`;
  const entregadas = suma(S.pedidos.filter(p => p.entrega && enRango(p.entrega, r)).flatMap(p => p.lineas), l => l.despachada);
  v.costoLogisticoUnidad = entregadas ? v.costoLogistico / entregadas : null;
  det.costoLogisticoUnidad = `${fmt.mxn(v.costoLogistico, 0)} ÷ ${fmt.num(entregadas)} unidades entregadas`;

  // 15. compras
  v.costoCompras = suma(ocsF.filter(o => o.estado !== 'Cancelada' && enRango(o.fechaEmision, r)), o => totalesOC(o).subtotal);
  det.costoCompras = `${ocsF.filter(o => o.estado !== 'Cancelada' && enRango(o.fechaEmision, r)).length} órdenes emitidas`;

  // 16. valor del inventario (foto actual)
  const vMat = suma(S.lotes, l => l.cantidad * l.costo), vPT = suma(S.lotesPT, l => l.existencia * l.costoUnit);
  v.valorInventario = vMat + vPT;
  det.valorInventario = `Materiales ${fmt.mxn(vMat, 0)} + producto terminado ${fmt.mxn(vPT, 0)}`;

  // 17. costo por unidad aceptada
  const costoProd = suma(termin, o => costoMaterialesOP(o.folio)) + tReal * S.config.costoMinutoProduccion;
  v.costoUnidadProducida = ok ? costoProd / ok : null;
  det.costoUnidadProducida = `${fmt.mxn(costoProd, 0)} ÷ ${fmt.num(ok)} unidades aceptadas`;

  // 19. desperdicio
  const matRechazado = suma(termin, o => o.defectuosa * costoMaterialUnidad(o.producto));
  const recRech = suma(S.recepciones.filter(x => enRango(x.fecha, r)).flatMap(x => x.lineas.map(l => ({ ...l, oc: x.oc }))), l => {
    const oc = buscarPor('ordenesCompra', l.oc);
    return l.rechazado * (oc.lineas.find(y => y.material === l.material) || {}).precio;
  });
  const base = consumido + recRech;
  v.desperdicio = base ? 100 * (matRechazado + recRech) / base : null;
  det.desperdicio = `${fmt.mxn(matRechazado + recRech, 0)} de ${fmt.mxn(base, 0)} en material`;

  // 20. ciclo de abastecimiento
  const ciclo = ocsF.filter(o => o.estado === 'Recibida' && enRango(o.fechaRecepcion, r) && o.solicitud).map(o => {
    const sc = buscarPor('solicitudes', o.solicitud);
    return sc ? diasEntre(sc.fecha, o.fechaRecepcion) : null;
  }).filter(x => x != null);
  v.cicloAbastecimiento = ciclo.length ? promedio(ciclo) : null;
  det.cicloAbastecimiento = `${ciclo.length} órdenes recibidas con solicitud de origen`;

  return DEF_KPI.map(([clave, grupo, nombre, unidad, mayorMejor, metaClave, definicion, formula]) => {
    const valor = v[clave] == null || !Number.isFinite(v[clave]) ? null : v[clave];
    const meta = metaClave ? S.config.metas[metaClave] : null;
    return { clave, grupo, nombre, unidad, mayorMejor, meta, definicion, formula, valor, detalle: det[clave], semaforo: semaforoKPI(valor, meta, mayorMejor) };
  });
}

function semaforoKPI(valor, meta, mayorMejor) {
  if (valor == null) return 'sindatos';
  if (meta == null || mayorMejor == null) return 'info';
  const ok = mayorMejor ? valor >= meta : valor <= meta;
  if (ok) return 'bien';
  const holgura = Math.max(Math.abs(meta) * 0.05, mayorMejor ? 0 : 0.5);
  return (mayorMejor ? valor >= meta - holgura : valor <= meta + holgura) ? 'alerta' : 'critico';
}

function formatoKPI(k, valor = k.valor) {
  if (valor == null) return 'Sin datos suficientes';
  switch (k.unidad) {
    case '%': return fmt.pct(valor, 1);
    case 'MXN': return fmt.mxnCorto(valor);
    case 'MXN/u': return fmt.mxn(valor, 2);
    case 'vueltas/año': return fmt.num(valor, 1) + ' vueltas/año';
    case 'días hábiles': return fmt.num(valor, 1) + ' días háb.';
    case 'días': return fmt.num(valor, 1) + ' días';
    default: return fmt.num(valor, 2);
  }
}

function formatoMeta(k) {
  if (k.meta == null) return 'Sin meta (indicador de seguimiento)';
  const s = k.mayorMejor ? '≥' : '≤';
  const v = k.unidad === '%' ? fmt.num(k.meta) + ' %' : k.unidad === 'MXN/u' ? fmt.mxn(k.meta, 2) : `${fmt.num(k.meta)} ${k.unidad}`;
  return `${s} ${v}`;
}

// KPIs del periodo y del periodo anterior de la misma duración, con tendencia.
function kpisConTendencia(r, filtros = {}) {
  const prev = { desde: sumarDias(r.desde, -(diasEntre(r.desde, r.hasta) + 1)), hasta: sumarDias(r.desde, -1) };
  const actual = calcularKPIs(r, filtros);
  const anterior = calcularKPIs(prev, filtros);
  return actual.map((k, i) => {
    const a = anterior[i].valor;
    const delta = k.valor != null && a != null ? k.valor - a : null;
    return { ...k, anterior: a, delta, interpretacion: interpretarKPI(k, delta) };
  });
}

function interpretarKPI(k, delta) {
  if (k.valor == null) return 'No hay registros suficientes en el periodo para calcularlo.';
  const mejora = delta == null ? '' : (delta === 0 ? ' Sin cambio contra el periodo anterior.' :
    ((k.mayorMejor === true && delta > 0) || (k.mayorMejor === false && delta < 0)) ? ' Mejoró contra el periodo anterior.' :
      k.mayorMejor == null ? '' : ' Empeoró contra el periodo anterior.');
  const t = {
    bien: 'Cumple la meta.', alerta: 'Está cerca de la meta, pero fuera de ella.', critico: 'Está claramente fuera de la meta.', info: 'Indicador de seguimiento.',
  }[k.semaforo];
  return t + mejora;
}

// Recomendaciones a partir de las causas registradas (incidencias y KPIs fuera de meta).
function recomendaciones(kpis) {
  const r = [];
  const inc = S.incidencias.filter(i => !['Resuelta', 'Cerrada'].includes(i.estado));
  const porTipo = agrupar(S.incidencias.filter(i => i.fecha >= sumarDias(hoy(), -30)), i => i.tipo);
  const k = c => kpis.find(x => x.clave === c);
  if (['alerta', 'critico'].includes(k('proveedores').semaforo)) {
    const malos = S.proveedores.map(p => ({ p, d: desempenoProveedor(p.codigo) })).filter(x => x.d.n && x.d.puntualidad < 90).sort((a, b) => a.d.puntualidad - b.d.puntualidad);
    r.push(`Cumplimiento de proveedores bajo meta. Revisar plazos con ${malos.slice(0, 2).map(x => `${x.p.razon} (${fmt.pct(x.d.puntualidad, 0)} a tiempo)`).join(' y ') || 'los proveedores con retrasos'}, o subir el punto de reorden de sus materiales.`);
  }
  if (['alerta', 'critico'].includes(k('variacionPrecio').semaforo)) r.push('La variación de precio supera la meta: hubo compras urgentes con sobreprecio. Negociar precios fijos o cubrir con inventario de seguridad.');
  if (['alerta', 'critico'].includes(k('criticos').semaforo)) r.push(`Hay materiales bajo el mínimo. Autorizar y convertir las solicitudes pendientes (${S.solicitudes.filter(s => s.estado === 'Pendiente de autorización').length} por autorizar).`);
  if (['alerta', 'critico'].includes(k('calidad').semaforo) || (porTipo['Defectos de fabricación'] || []).length >= 3) {
    const causas = agrupar(S.operaciones.flatMap(o => o.defectos), d => d.causa);
    const top = Object.entries(causas).map(([c, l]) => [c, suma(l, x => x.cantidad)]).sort((a, b) => b[1] - a[1])[0];
    if (top) r.push(`Principal causa de defecto: «${top[0]}» (${fmt.num(top[1])} unidades). Atacarla primero eleva calidad y OEE.`);
  }
  if (['alerta', 'critico'].includes(k('otif').semaforo)) r.push('El OTIF está bajo meta. Reservar producto terminado con más anticipación y revisar pedidos con entregas incompletas.');
  if ((porTipo['Paro de maquinaria'] || []).length) r.push('Se registraron paros de maquinaria: programar mantenimiento preventivo en la línea afectada.');
  if (inc.length) r.push(`${inc.length} incidencias siguen abiertas; de ellas, ${inc.filter(i => ["Alta", "Crítica"].includes(i.severidad)).length} con severidad alta o crítica.`);
  if (!r.length) r.push('Todos los indicadores con meta están dentro de rango. Mantener la política actual de inventario y compras.');
  return r;
}

function desempenoProveedor(codigo) {
  const oc = S.ordenesCompra.filter(o => o.proveedor === codigo && o.estado === 'Recibida');
  const tarde = oc.filter(o => o.fechaRecepcion > o.fechaPrometida);
  const lin = S.ordenesCompra.filter(o => o.proveedor === codigo && o.estado !== 'Cancelada').flatMap(o => o.lineas);
  const ref = suma(lin, l => l.cantidad * material(l.material).precioRef);
  const rec = suma(oc.flatMap(o => o.lineas), l => l.recibido);
  return {
    n: oc.length,
    puntualidad: oc.length ? 100 * (oc.length - tarde.length) / oc.length : null,
    atraso: tarde.length ? promedio(tarde.map(o => diasEntre(o.fechaPrometida, o.fechaRecepcion))) : 0,
    variacion: ref ? 100 * (suma(lin, l => l.cantidad * l.precio) - ref) / ref : null,
    rechazo: rec ? 100 * suma(oc.flatMap(o => o.lineas), l => l.rechazado) / rec : null,
    comprado: suma(lin, l => l.cantidad * l.precio),
  };
}

// Serie diaria para las gráficas del tablero.
function serieOperativa(desde, hasta) {
  const inv = seriesInventario(desde, hasta);
  return rangoFechas(desde, hasta).map((f, i) => {
    const r = { desde: f, hasta: f };
    const terminadas = S.ordenesProduccion.filter(o => o.estado === 'Terminada' && o.finReal && o.finReal.slice(0, 10) === f);
    const ope = S.operaciones.filter(o => terminadas.some(t => t.folio === o.op));
    const costoProd = suma(terminadas, o => costoMaterialesOP(o.folio)) + suma(ope, o => o.tReal) * S.config.costoMinutoProduccion;
    const flete = suma(S.embarques.filter(e => e.estado === 'Entregado' && e.llegada === f), e => e.costo);
    const envios = suma(S.pedidos.filter(p => p.despacho === f), p => p.costoEnvio);
    const entregados = S.pedidos.filter(p => p.entrega === f);
    const consumo = -suma(S.movimientos.filter(m => m.material && ['Salida a producción', 'Devolución de producción'].includes(m.tipo) && m.fecha.slice(0, 10) === f), m => m.cantidad * m.costoUnit);
    return {
      fecha: f,
      costoLogistico: flete + envios + S.config.costoAlmacenDia,
      costoProduccion: terminadas.length ? costoProd : null,
      consumo,
      aceptadas: suma(terminadas, o => o.aceptada),
      entregasPct: entregados.length ? 100 * entregados.filter(p => p.aTiempo && p.completo).length / entregados.length : null,
      entregas: entregados.length,
      inventario: inv[i].total,
    };
  });
}
