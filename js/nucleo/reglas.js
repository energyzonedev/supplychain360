// Reglas de negocio. Cada operación valida, actualiza el estado, deja rastro en la
// auditoría y devuelve { ok, mensaje, registro }. Ninguna deja inventarios negativos
// ni permite duplicar documentos por accidente.
'use strict';

const exito = (mensaje, registro, extra = {}) => ({ ok: true, mensaje, registro, ...extra });
const fallo = mensaje => ({ ok: false, mensaje });
const ABIERTOS_SC = ['Borrador', 'Pendiente de autorización', 'Autorizada'];
const OC_ABIERTA = ['Pendiente', 'Enviada', 'Confirmada', 'Parcialmente recibida'];

function historial(reg, accion, detalle = '') {
  (reg.historial = reg.historial || []).push({ fecha: ahora(), usuario: usuarioActual(), accion, detalle });
  auditar(accion, reg.folio, detalle);
}

// ======================================================= inventario: consultas

const PESO_UNIDAD = { kg: 1, L: 0.95, m: 0.2, pza: 0.05 };

const lotesDe = mat => S.lotes.filter(l => l.material === mat && l.cantidad > 0);
const fifo = (a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada) || a.lote.localeCompare(b.lote);
const lotesDisponibles = mat => lotesDe(mat).filter(l => l.estado === 'Disponible' && l.cantidad - l.reservada > 1e-9).sort(fifo);

function existencias(mat) {
  const ls = lotesDe(mat);
  const fisica = suma(ls, l => l.cantidad);
  const reservada = suma(ls, l => l.reservada);
  const bloqueada = suma(ls.filter(l => l.estado !== 'Disponible'), l => l.cantidad);
  const disponible = suma(ls.filter(l => l.estado === 'Disponible'), l => l.cantidad - l.reservada);
  return { fisica, reservada, bloqueada, disponible };
}

function enTransito(mat) {
  return suma(S.ordenesCompra.filter(o => OC_ABIERTA.includes(o.estado)).flatMap(o => o.lineas)
    .filter(l => l.material === mat), l => Math.max(0, l.cantidad - l.recibido));
}

function estadoMaterial(mat) {
  const m = material(mat);
  const e = existencias(mat);
  // El nivel se mide con la existencia física; lo reservado ya está comprometido con una orden.
  if (e.fisica <= 0) return 'Agotado';
  if (e.fisica < m.min) return 'Crítico';
  if (e.fisica < m.min * 1.25) return 'Bajo';
  if (e.fisica > m.max) return 'Exceso';
  return 'Normal';
}

function registrarMovimiento(tipo, { material: mat, producto: prod, lote, cantidad, referencia, motivo = '', costo }) {
  const mov = {
    folio: nuevoFolio('MOV'), fecha: ahora(), tipo, material: mat || null, producto: prod || null, lote,
    cantidad: redondear(cantidad, 3), costoUnit: costo ?? (mat ? material(mat).costo : producto(prod).precio * 0.55),
    referencia, motivo, usuario: usuarioActual(),
  };
  S.movimientos.push(mov);
  return mov;
}

// Aparta material en lotes disponibles, del más antiguo al más nuevo (FIFO).
function reservarFIFO(mat, cantidad) {
  let resta = cantidad;
  const reservas = [];
  for (const l of lotesDisponibles(mat)) {
    if (resta <= 1e-9) break;
    const t = Math.min(resta, l.cantidad - l.reservada);
    l.reservada = redondear(l.reservada + t, 3);
    reservas.push({ lote: l.lote, cantidad: redondear(t, 3) });
    resta -= t;
  }
  return { reservas, reservado: redondear(cantidad - resta, 3) };
}

function liberarReservas(reservas) {
  reservas.forEach(r => {
    const l = S.lotes.find(x => x.lote === r.lote);
    if (l) l.reservada = Math.max(0, redondear(l.reservada - r.cantidad, 3));
  });
}

// ===================================================== solicitudes de compra

function crearSolicitud(d) {
  if (!puede('solicitud.crear')) return sinPermiso('solicitud.crear');
  const m = material(d.material);
  const cant = Number(d.cantidad);
  if (!m) return fallo('Selecciona un material del catálogo.');
  if (!(cant > 0)) return fallo('La cantidad debe ser mayor que cero.');
  if (!d.area) return fallo('Indica el área solicitante.');
  if (!String(d.motivo || '').trim()) return fallo('Escribe el motivo de la solicitud.');
  const sc = {
    folio: nuevoFolio('SC'), fecha: hoy(), creada: ahora(), area: d.area, material: m.codigo, cantidad: redondear(cant, 3),
    unidad: m.unidad, motivo: String(d.motivo).trim(), prioridad: d.prioridad || 'Media',
    costoEst: redondear(cant * m.costo), solicitante: d.solicitante || usuarioActual(),
    autorizador: d.autorizador || 'Gerencia de Compras (L. Mendoza)',
    estado: d.borrador ? 'Borrador' : 'Pendiente de autorización',
    comentarios: [], historial: [], oc: null, fechaAutorizacion: null, fechaCierre: null, origen: d.origen || 'Manual',
  };
  S.solicitudes.push(sc);
  historial(sc, 'Solicitud creada', `${sc.estado} · ${fmt.cant(sc.cantidad, m.unidad)} de ${m.descripcion}`);
  guardar();
  return exito(`Solicitud ${sc.folio} creada (${sc.estado.toLowerCase()}).`, sc);
}

function editarSolicitud(folio, d) {
  const sc = buscarPor('solicitudes', folio);
  if (!sc) return fallo('No existe la solicitud.');
  if (sc.estado !== 'Borrador') return fallo('Sólo se editan solicitudes en borrador.');
  const m = material(d.material || sc.material);
  const cant = Number(d.cantidad ?? sc.cantidad);
  if (!(cant > 0)) return fallo('La cantidad debe ser mayor que cero.');
  Object.assign(sc, {
    material: m.codigo, unidad: m.unidad, cantidad: redondear(cant, 3), area: d.area || sc.area,
    motivo: (d.motivo ?? sc.motivo).trim(), prioridad: d.prioridad || sc.prioridad, costoEst: redondear(cant * m.costo),
  });
  historial(sc, 'Solicitud editada');
  guardar();
  return exito(`Solicitud ${folio} actualizada.`, sc);
}

function enviarSolicitud(folio) {
  const sc = buscarPor('solicitudes', folio);
  if (!sc || sc.estado !== 'Borrador') return fallo('La solicitud no está en borrador.');
  sc.estado = 'Pendiente de autorización';
  historial(sc, 'Enviada a autorización');
  guardar();
  return exito(`${folio} enviada a autorización.`, sc);
}

function autorizarSolicitud(folio, comentario = '') {
  if (!puede('solicitud.autorizar')) return sinPermiso('solicitud.autorizar');
  const sc = buscarPor('solicitudes', folio);
  if (!sc || sc.estado !== 'Pendiente de autorización') return fallo('La solicitud no está pendiente de autorización.');
  sc.estado = 'Autorizada';
  sc.fechaAutorizacion = ahora();
  if (comentario) sc.comentarios.push({ fecha: ahora(), usuario: usuarioActual(), texto: comentario });
  historial(sc, 'Solicitud autorizada', comentario);
  guardar();
  return exito(`${folio} autorizada. Ya puede convertirse en orden de compra.`, sc);
}

function rechazarSolicitud(folio, motivo) {
  if (!puede('solicitud.autorizar')) return sinPermiso('solicitud.autorizar');
  const sc = buscarPor('solicitudes', folio);
  if (!sc || sc.estado !== 'Pendiente de autorización') return fallo('La solicitud no está pendiente de autorización.');
  if (!String(motivo || '').trim()) return fallo('El rechazo necesita un motivo.');
  sc.estado = 'Rechazada';
  sc.fechaCierre = ahora();
  sc.comentarios.push({ fecha: ahora(), usuario: usuarioActual(), texto: 'Motivo de rechazo: ' + motivo });
  historial(sc, 'Solicitud rechazada', motivo);
  guardar();
  return exito(`${folio} rechazada.`, sc);
}

function comentarSolicitud(folio, texto) {
  const sc = buscarPor('solicitudes', folio);
  if (!sc || !String(texto || '').trim()) return fallo('Escribe un comentario.');
  sc.comentarios.push({ fecha: ahora(), usuario: usuarioActual(), texto: texto.trim() });
  historial(sc, 'Comentario agregado', texto.trim());
  guardar();
  return exito('Comentario registrado.', sc);
}

// Una solicitud autorizada genera UNA orden de compra; la referencia de origen se conserva.
function convertirSolicitud(folio, opciones = {}) {
  if (!puede('compra')) return sinPermiso('compra');
  const sc = buscarPor('solicitudes', folio);
  if (!sc) return fallo('No existe la solicitud.');
  if (sc.oc) return fallo(`${folio} ya generó la orden ${sc.oc}; no se duplica.`);
  if (sc.estado !== 'Autorizada') return fallo('Sólo una solicitud autorizada puede convertirse en orden de compra.');
  const m = material(sc.material);
  const r = crearOrdenCompra({
    solicitud: sc.folio, proveedor: opciones.proveedor || m.proveedor,
    lineas: [{ material: sc.material, cantidad: sc.cantidad, precio: opciones.precio ?? m.costo }],
  });
  if (!r.ok) return r;
  sc.oc = r.registro.folio;
  sc.estado = 'Convertida en orden de compra';
  historial(sc, 'Convertida en orden de compra', sc.oc);
  guardar();
  return exito(`${folio} convertida en ${sc.oc}.`, r.registro);
}

// ========================================================== órdenes de compra

function totalesOC(oc) {
  const subtotal = suma(oc.lineas, l => l.cantidad * l.precio);
  const iva = subtotal * oc.ivaPct;
  return { subtotal: redondear(subtotal), iva: redondear(iva), transporte: redondear(oc.transporteEst), total: redondear(subtotal + iva + oc.transporteEst) };
}

function estimarFlete(prov, pesoKg) {
  const t = elegirTransportista(pesoKg);
  return redondear(t.base + t.porKm * prov.km);
}

function elegirTransportista(pesoKg) {
  return S.transportistas.slice().sort((a, b) => a.capacidadKg - b.capacidadKg).find(t => t.capacidadKg >= pesoKg) ||
    S.transportistas.reduce((a, b) => (a.capacidadKg > b.capacidadKg ? a : b));
}

const pesoLineas = lineas => suma(lineas, l => l.cantidad * (PESO_UNIDAD[material(l.material).unidad] || 0.1));

function crearOrdenCompra(d) {
  if (!puede('compra')) return sinPermiso('compra');
  const prov = proveedor(d.proveedor);
  if (!prov) return fallo('Selecciona un proveedor.');
  if (prov.estado !== 'Activo') return fallo(`${prov.razon} está ${prov.estado.toLowerCase()}.`);
  const lineas = (d.lineas || []).filter(l => l.material);
  if (!lineas.length) return fallo('Agrega al menos un material.');
  const vistos = new Set();
  for (const l of lineas) {
    if (!material(l.material)) return fallo('Hay un material que no existe en el catálogo.');
    if (vistos.has(l.material)) return fallo(`${l.material} aparece dos veces; junta las cantidades en una línea.`);
    vistos.add(l.material);
    if (!(Number(l.cantidad) > 0)) return fallo(`La cantidad de ${l.material} debe ser mayor que cero.`);
    if (!(Number(l.precio) > 0)) return fallo(`El precio de ${l.material} debe ser mayor que cero.`);
  }
  if (d.solicitud) {
    const sc = buscarPor('solicitudes', d.solicitud);
    if (sc && sc.oc) return fallo(`${d.solicitud} ya tiene la orden ${sc.oc}.`);
  }
  const lins = lineas.map(l => ({ material: l.material, cantidad: redondear(Number(l.cantidad), 3), precio: redondear(Number(l.precio), 4), recibido: 0, aceptado: 0, rechazado: 0 }));
  const oc = {
    folio: nuevoFolio('OC'), solicitud: d.solicitud || null, proveedor: prov.codigo, fechaEmision: hoy(),
    fechaPrometida: d.fechaPrometida || sumarDias(hoy(), prov.lead), lineas: lins,
    ivaPct: d.ivaPct ?? S.config.iva,
    transporteEst: d.transporteEst != null && d.transporteEst !== '' ? Number(d.transporteEst) : estimarFlete(prov, pesoLineas(lins)),
    estado: 'Pendiente', fechaConfirmacion: null, fechaRecepcion: null, fechaCierre: null, historial: [],
  };
  S.ordenesCompra.push(oc);
  historial(oc, 'Orden de compra emitida', `${prov.razon} · ${fmt.mxn(totalesOC(oc).total)}`);
  guardar();
  return exito(`Orden ${oc.folio} emitida a ${prov.razon} por ${fmt.mxn(totalesOC(oc).total)}.`, oc);
}

function editarLineasOC(folio, lineas) {
  if (!puede('compra')) return sinPermiso('compra');
  const oc = buscarPor('ordenesCompra', folio);
  if (!oc || oc.estado !== 'Pendiente') return fallo('Sólo se modifican materiales de órdenes pendientes (antes de enviarse).');
  const prueba = crearOrdenCompraValidar(lineas);
  if (prueba) return fallo(prueba);
  oc.lineas = lineas.map(l => ({ material: l.material, cantidad: redondear(Number(l.cantidad), 3), precio: redondear(Number(l.precio), 4), recibido: 0, aceptado: 0, rechazado: 0 }));
  historial(oc, 'Materiales modificados', `${oc.lineas.length} líneas`);
  guardar();
  return exito(`${folio} actualizada: ${fmt.mxn(totalesOC(oc).total)}.`, oc);
}

function crearOrdenCompraValidar(lineas) {
  if (!lineas.length) return 'Agrega al menos un material.';
  const v = new Set();
  for (const l of lineas) {
    if (!material(l.material)) return 'Material inválido.';
    if (v.has(l.material)) return `${l.material} está repetido.`;
    v.add(l.material);
    if (!(Number(l.cantidad) > 0) || !(Number(l.precio) > 0)) return 'Cantidades y precios deben ser mayores que cero.';
  }
  return null;
}

function enviarOC(folio) {
  if (!puede('compra')) return sinPermiso('compra');
  const oc = buscarPor('ordenesCompra', folio);
  if (!oc || oc.estado !== 'Pendiente') return fallo('La orden no está pendiente.');
  oc.estado = 'Enviada';
  historial(oc, 'Orden enviada al proveedor');
  guardar();
  return exito(`${folio} enviada al proveedor.`, oc);
}

function confirmarOC(folio, fechaPrometida) {
  if (!puede('compra')) return sinPermiso('compra');
  const oc = buscarPor('ordenesCompra', folio);
  if (!oc || !['Pendiente', 'Enviada'].includes(oc.estado)) return fallo('La orden no espera confirmación.');
  if (fechaPrometida && fechaPrometida < oc.fechaEmision) return fallo('La fecha prometida no puede ser anterior a la emisión.');
  if (fechaPrometida && fechaPrometida !== oc.fechaPrometida) historial(oc, 'Fecha prometida cambiada por el proveedor', `${fmt.fecha(oc.fechaPrometida)} → ${fmt.fecha(fechaPrometida)}`);
  if (fechaPrometida) oc.fechaPrometida = fechaPrometida;
  oc.estado = 'Confirmada';
  oc.fechaConfirmacion = ahora();
  historial(oc, 'Confirmada por el proveedor', `Entrega ${fmt.fecha(oc.fechaPrometida)}`);
  guardar();
  return exito(`${folio} confirmada para el ${fmt.fecha(oc.fechaPrometida)}.`, oc);
}

// Simulación de cambio de precio o plazo, antes de recibir.
function cambiarCondicionesOC(folio, { precios = {}, fechaPrometida }) {
  if (!puede('compra')) return sinPermiso('compra');
  const oc = buscarPor('ordenesCompra', folio);
  if (!oc || !OC_ABIERTA.includes(oc.estado) || oc.lineas.some(l => l.recibido > 0)) return fallo('Sólo se cambian condiciones de órdenes abiertas sin recepciones.');
  const cambios = [];
  oc.lineas.forEach(l => {
    const p = Number(precios[l.material]);
    if (p > 0 && p !== l.precio) { cambios.push(`${l.material}: ${fmt.mxn(l.precio)} → ${fmt.mxn(p)}`); l.precio = p; }
  });
  if (fechaPrometida && fechaPrometida !== oc.fechaPrometida) {
    if (fechaPrometida < oc.fechaEmision) return fallo('La fecha prometida no puede ser anterior a la emisión.');
    cambios.push(`entrega ${fmt.fecha(oc.fechaPrometida)} → ${fmt.fecha(fechaPrometida)}`);
    oc.fechaPrometida = fechaPrometida;
  }
  if (!cambios.length) return fallo('No hubo cambios.');
  historial(oc, 'Condiciones modificadas', cambios.join('; '));
  guardar();
  return exito(`${folio}: ${cambios.join('; ')}.`, oc);
}

function cancelarOC(folio, motivo) {
  if (!puede('compra')) return sinPermiso('compra');
  const oc = buscarPor('ordenesCompra', folio);
  if (!oc || !OC_ABIERTA.includes(oc.estado)) return fallo('La orden no se puede cancelar en su estado actual.');
  if (oc.lineas.some(l => l.recibido > 0)) return fallo('La orden ya tiene recepciones; no se cancela.');
  if (!String(motivo || '').trim()) return fallo('Indica el motivo de la cancelación.');
  oc.estado = 'Cancelada';
  oc.fechaCierre = ahora();
  S.embarques.filter(e => e.oc === folio && !['Entregado', 'Cancelado'].includes(e.estado)).forEach(e => { e.estado = 'Cancelado'; e.eventos.push({ fecha: ahora(), estado: 'Cancelado', nota: 'Orden de compra cancelada' }); });
  const sc = oc.solicitud && buscarPor('solicitudes', oc.solicitud);
  if (sc) { sc.oc = null; sc.estado = 'Autorizada'; historial(sc, 'Orden de compra cancelada; vuelve a autorizada', folio); }
  historial(oc, 'Orden cancelada', motivo);
  guardar();
  return exito(`${folio} cancelada.`, oc);
}

// Estado mostrado: una orden abierta con la fecha prometida vencida está «Retrasada».
function estadoOC(oc) {
  if (OC_ABIERTA.includes(oc.estado) && oc.fechaPrometida < hoy()) return 'Retrasada';
  return oc.estado;
}

// ================================================================= embarques

function programarEmbarque(d) {
  if (!puede('embarque')) return sinPermiso('embarque');
  const oc = buscarPor('ordenesCompra', d.oc);
  if (!oc || !['Enviada', 'Confirmada', 'Parcialmente recibida'].includes(oc.estado)) return fallo('La orden debe estar enviada o confirmada para programar su embarque.');
  if (S.embarques.some(e => e.oc === oc.folio && !['Entregado', 'Cancelado'].includes(e.estado))) return fallo(`${oc.folio} ya tiene un embarque activo.`);
  const lineas = oc.lineas.map(l => ({ material: l.material, cantidad: redondear(l.cantidad - l.recibido, 3) })).filter(l => l.cantidad > 0);
  if (!lineas.length) return fallo('No hay material pendiente de enviar.');
  const peso = redondear(pesoLineas(lineas), 1);
  const t = d.transportista ? transportista(d.transportista) : elegirTransportista(peso);
  if (!t) return fallo('Selecciona un transportista.');
  if (peso > t.capacidadKg) return fallo(`El peso estimado (${fmt.num(peso)} kg) excede la capacidad de ${t.vehiculo} (${fmt.num(t.capacidadKg)} kg).`);
  const prov = proveedor(oc.proveedor);
  const salida = d.salida || sumarDias(oc.fechaPrometida, -Math.max(1, Math.ceil(prov.km / 500)));
  const eta = d.eta || oc.fechaPrometida;
  if (eta < salida) return fallo('La llegada estimada no puede ser anterior a la salida.');
  const emb = {
    folio: nuevoFolio('EMB'), oc: oc.folio, proveedor: prov.codigo, origen: prov.zona, destino: EMPRESA.planta,
    transportista: t.codigo, vehiculo: t.vehiculo, capacidadKg: t.capacidadKg, pallets: Number(d.pallets) || Math.max(1, Math.ceil(peso / 600)),
    pesoKg: peso, lineas, salidaProgramada: salida, salida: null, eta, etaOriginal: eta, llegada: null,
    costo: redondear(t.base + t.porKm * prov.km), estado: 'Programado', retrasado: false, incidencia: false,
    eventos: [{ fecha: ahora(), estado: 'Programado', nota: `${t.nombre} · ${t.vehiculo}` }],
  };
  S.embarques.push(emb);
  auditar('Embarque programado', emb.folio, `${oc.folio} · ${t.nombre}`);
  guardar();
  return exito(`Embarque ${emb.folio} programado: sale ${fmt.fecha(salida)}, llega ${fmt.fecha(eta)}. Costo ${fmt.mxn(emb.costo)}.`, emb);
}

const SIGUIENTE_EMB = { 'Programado': 'En preparación', 'En preparación': 'En tránsito', 'En tránsito': 'En revisión de recepción' };

function avanzarEmbarque(folio, nota = '') {
  if (!puede('embarque')) return sinPermiso('embarque');
  const e = buscarPor('embarques', folio);
  if (!e || !SIGUIENTE_EMB[e.estado]) return fallo('El embarque no puede avanzar desde su estado actual.');
  e.estado = SIGUIENTE_EMB[e.estado];
  if (e.estado === 'En tránsito') e.salida = hoy();
  if (e.estado === 'En revisión de recepción') e.llegada = hoy();
  e.eventos.push({ fecha: ahora(), estado: e.estado, nota });
  auditar(`Embarque: ${e.estado}`, folio, nota);
  guardar();
  return exito(`${folio}: ${e.estado}.`, e);
}

function registrarRetrasoEmbarque(folio, dias, motivo, causa = 'Retraso del proveedor') {
  if (!puede('embarque')) return sinPermiso('embarque');
  const e = buscarPor('embarques', folio);
  dias = parseInt(dias, 10);
  if (!e || ['Entregado', 'Cancelado', 'En revisión de recepción'].includes(e.estado)) return fallo('El embarque ya llegó o fue cancelado.');
  if (!(dias > 0)) return fallo('Indica los días de retraso.');
  if (!String(motivo || '').trim()) return fallo('Indica el motivo del retraso.');
  e.eta = sumarDias(e.eta, dias);
  e.retrasado = true;
  e.eventos.push({ fecha: ahora(), estado: 'Retrasado', nota: `+${dias} días: ${motivo}` });
  crearIncidencia({ area: 'Logística', tipo: causa, operacion: folio, descripcion: `${folio} (${e.oc}) se retrasa ${dias} días: ${motivo}`, severidad: dias >= 4 ? 'Alta' : 'Media', impacto: `Llegada movida al ${fmt.fecha(e.eta)}`, responsable: USUARIO_ROL['Logística'], accion: 'Dar seguimiento con el proveedor y revisar el plan de producción', compromiso: e.eta }, true);
  auditar('Retraso de embarque', folio, `${dias} días · ${motivo}`);
  guardar();
  return exito(`${folio} retrasado ${dias} días; nueva llegada ${fmt.fecha(e.eta)}.`, e);
}

function reportarIncidenciaEmbarque(folio, tipo, descripcion) {
  if (!puede('embarque')) return sinPermiso('embarque');
  const e = buscarPor('embarques', folio);
  if (!e) return fallo('No existe el embarque.');
  if (!String(descripcion || '').trim()) return fallo('Describe la incidencia.');
  e.incidencia = true;
  e.eventos.push({ fecha: ahora(), estado: 'Incidencia reportada', nota: `${tipo}: ${descripcion}` });
  const tipoInc = /da[ñn]o|p[ée]rdida/i.test(tipo) ? 'Daño durante el transporte' : 'Error documental';
  crearIncidencia({ area: 'Logística', tipo: tipoInc, operacion: folio, descripcion: `${tipo}: ${descripcion}`, severidad: 'Alta', impacto: 'Revisar cantidades en la recepción', responsable: USUARIO_ROL['Logística'], accion: 'Inspección al 100 % en la recepción', compromiso: sumarDias(hoy(), 2) }, true);
  guardar();
  return exito(`Incidencia registrada en ${folio}.`, e);
}

function estadoEmbarque(e) {
  if (['Entregado', 'Cancelado'].includes(e.estado)) return e.estado;
  if (e.incidencia && e.estado !== 'En revisión de recepción') return 'Incidencia reportada';
  if (e.retrasado || (e.estado !== 'En revisión de recepción' && e.eta < hoy())) return 'Retrasado';
  return e.estado;
}

// ================================================================ recepción

// Sólo lo aceptado entra al inventario. Lo rechazado queda registrado, no se almacena.
function registrarRecepcion(d) {
  if (!puede('recepcion')) return sinPermiso('recepcion');
  const oc = buscarPor('ordenesCompra', d.oc);
  if (!oc || !['Enviada', 'Confirmada', 'Parcialmente recibida'].includes(oc.estado)) return fallo('La orden no está en condiciones de recibirse.');
  const emb = d.embarque ? buscarPor('embarques', d.embarque) : S.embarques.find(e => e.oc === oc.folio && !['Entregado', 'Cancelado'].includes(e.estado));
  const lineas = (d.lineas || []).map(l => ({ ...l, recibido: Number(l.recibido) || 0, aceptado: Number(l.aceptado) || 0 })).filter(l => l.recibido > 0);
  if (!lineas.length) return fallo('Captura al menos una cantidad recibida.');
  for (const l of lineas) {
    const lo = oc.lineas.find(x => x.material === l.material);
    if (!lo) return fallo(`${l.material} no pertenece a la orden.`);
    const pend = lo.cantidad - lo.recibido;
    if (l.recibido > pend + 1e-6) return fallo(`De ${l.material} sólo faltan ${fmt.cant(pend, material(l.material).unidad)} por recibir.`);
    if (l.aceptado < 0 || l.aceptado > l.recibido + 1e-6) return fallo(`Lo aceptado de ${l.material} no puede superar lo recibido.`);
  }
  const rec = { folio: nuevoFolio('REC'), fecha: hoy(), oc: oc.folio, embarque: emb ? emb.folio : null, inspector: usuarioActual(), lineas: [] };
  lineas.forEach(l => {
    const lo = oc.lineas.find(x => x.material === l.material);
    const rechazado = redondear(l.recibido - l.aceptado, 3);
    let lote = null;
    if (l.aceptado > 0) {
      lote = 'L-' + nuevoFolio('LT').slice(3);
      S.lotes.push({
        lote, material: l.material, cantidad: redondear(l.aceptado, 3), reservada: 0, estado: l.cuarentena ? 'Cuarentena' : 'Disponible',
        fechaEntrada: ahora(), origen: rec.folio, oc: oc.folio, costo: lo.precio, ubicacion: material(l.material).ubicacion,
      });
      registrarMovimiento('Entrada por recepción', { material: l.material, lote, cantidad: l.aceptado, referencia: rec.folio, costo: lo.precio });
    }
    lo.recibido = redondear(lo.recibido + l.recibido, 3);
    lo.aceptado = redondear(lo.aceptado + l.aceptado, 3);
    lo.rechazado = redondear(lo.rechazado + rechazado, 3);
    rec.lineas.push({ material: l.material, recibido: l.recibido, aceptado: l.aceptado, rechazado, lote, cuarentena: !!l.cuarentena, nota: l.nota || '' });
  });
  S.recepciones.push(rec);
  const completa = oc.lineas.every(l => l.recibido >= l.cantidad - 1e-6);
  oc.estado = completa ? 'Recibida' : 'Parcialmente recibida';
  if (completa) { oc.fechaRecepcion = hoy(); oc.fechaCierre = ahora(); }
  historial(oc, completa ? 'Recepción completa' : 'Recepción parcial', rec.folio);
  if (emb) {
    emb.estado = 'Entregado';
    emb.llegada = emb.llegada || hoy();
    emb.salida = emb.salida || emb.salidaProgramada;
    emb.recepcion = rec.folio;
    emb.eventos.push({ fecha: ahora(), estado: 'Entregado', nota: `Recepción ${rec.folio}` });
  }
  if (completa && oc.solicitud) {
    const sc = buscarPor('solicitudes', oc.solicitud);
    if (sc && sc.estado === 'Convertida en orden de compra') { sc.estado = 'Cerrada'; sc.fechaCierre = ahora(); historial(sc, 'Cerrada por recepción completa', rec.folio); }
  }
  const totRech = suma(rec.lineas, l => l.rechazado);
  if (totRech > 0 && !d.sinIncidencia) {
    crearIncidencia({ area: 'Almacén', tipo: d.tipoIncidencia || 'Daño durante el transporte', operacion: rec.folio, descripcion: `Rechazo en inspección de ${oc.folio}: ${rec.lineas.filter(l => l.rechazado > 0).map(l => `${fmt.cant(l.rechazado, material(l.material).unidad)} de ${material(l.material).descripcion}`).join(', ')}`, severidad: 'Media', impacto: 'Material no disponible; puede requerir reposición', responsable: USUARIO_ROL['Almacén'], accion: 'Solicitar nota de crédito o reposición al proveedor', compromiso: sumarDias(hoy(), 5) }, true);
  }
  auditar('Recepción registrada', rec.folio, `${oc.folio} · ${completa ? 'completa' : 'parcial'}`);
  guardar();
  const aceptadoTxt = rec.lineas.map(l => `${fmt.cant(l.aceptado, material(l.material).unidad)} de ${material(l.material).descripcion}`).join(', ');
  return exito(`Recepción ${rec.folio}: entraron ${aceptadoTxt}${totRech ? `; se rechazaron ${fmt.num(totRech, 1)} unidades` : ''}. ${oc.folio} ${oc.estado.toLowerCase()}.`, rec);
}

// ============================================================ inventario: ajustes

function cambiarEstadoLote(loteId, nuevo, motivo) {
  if (!puede('inventario')) return sinPermiso('inventario');
  const l = S.lotes.find(x => x.lote === loteId);
  if (!l) return fallo('No existe el lote.');
  if (nuevo !== 'Disponible' && l.reservada > 0) return fallo('El lote tiene material reservado para producción; libera la reserva primero.');
  if (!String(motivo || '').trim()) return fallo('Indica el motivo.');
  const antes = l.estado;
  l.estado = nuevo;
  registrarMovimiento('Cambio de estado de lote', { material: l.material, lote: l.lote, cantidad: 0, referencia: l.lote, motivo: `${antes} → ${nuevo}: ${motivo}`, costo: l.costo });
  auditar('Cambio de estado de lote', l.lote, `${antes} → ${nuevo}: ${motivo}`);
  guardar();
  return exito(`Lote ${l.lote}: ${antes} → ${nuevo}.`, l);
}

// Ajuste auditable: nunca reescribe movimientos anteriores, agrega uno nuevo.
function registrarAjuste({ lote: loteId, cantidad, motivo }) {
  if (!puede('inventario')) return sinPermiso('inventario');
  const l = S.lotes.find(x => x.lote === loteId);
  cantidad = Number(cantidad);
  if (!l) return fallo('Selecciona un lote.');
  if (!cantidad) return fallo('El ajuste debe ser distinto de cero.');
  if (!String(motivo || '').trim()) return fallo('Todo ajuste necesita un motivo.');
  if (l.cantidad + cantidad < l.reservada - 1e-9) return fallo(`El lote quedaría por debajo de lo reservado (${fmt.num(l.reservada, 2)}).`);
  if (l.cantidad + cantidad < -1e-9) return fallo('El ajuste dejaría existencias negativas.');
  l.cantidad = redondear(l.cantidad + cantidad, 3);
  const mov = registrarMovimiento('Ajuste de inventario', { material: l.material, lote: l.lote, cantidad, referencia: l.lote, motivo, costo: l.costo });
  auditar('Ajuste de inventario', mov.folio, `${l.lote} ${cantidad > 0 ? '+' : ''}${cantidad} · ${motivo}`);
  guardar();
  return exito(`Ajuste ${mov.folio}: ${cantidad > 0 ? '+' : ''}${fmt.cant(cantidad, material(l.material).unidad)} en ${l.lote}.`, mov);
}

function registrarConteo({ lote: loteId, fisico }) {
  if (!puede('inventario')) return sinPermiso('inventario');
  const l = S.lotes.find(x => x.lote === loteId);
  fisico = Number(fisico);
  if (!l) return fallo('Selecciona un lote.');
  if (!(fisico >= 0)) return fallo('El conteo físico debe ser cero o mayor.');
  const c = {
    folio: nuevoFolio('CNT'), fecha: hoy(), material: l.material, lote: l.lote, teorico: l.cantidad, fisico: redondear(fisico, 3),
    diferencia: redondear(fisico - l.cantidad, 3), ajustado: false, usuario: usuarioActual(),
  };
  c.estado = Math.abs(c.diferencia) < 1e-6 ? 'Conciliado' : 'Con diferencia';
  S.conteos.push(c);
  auditar('Conteo físico', c.folio, `${l.lote}: teórico ${c.teorico}, físico ${c.fisico}`);
  guardar();
  return exito(c.estado === 'Conciliado' ? `Conteo ${c.folio}: sin diferencias.` : `Conteo ${c.folio}: diferencia de ${c.diferencia > 0 ? '+' : ''}${fmt.num(c.diferencia, 2)}. Puedes aplicar el ajuste.`, c);
}

function aplicarAjusteConteo(folio) {
  const c = buscarPor('conteos', folio);
  if (!c || c.estado !== 'Con diferencia' || c.ajustado) return fallo('El conteo no tiene una diferencia pendiente.');
  const r = registrarAjuste({ lote: c.lote, cantidad: c.diferencia, motivo: `Ajuste por conteo físico ${c.folio}` });
  if (!r.ok) return r;
  c.ajustado = true;
  c.movimiento = r.registro.folio;
  crearIncidencia({ area: 'Almacén', tipo: 'Diferencias de inventario', operacion: c.folio, descripcion: `Diferencia de ${fmt.num(c.diferencia, 2)} en ${c.lote} (${material(c.material).descripcion})`, severidad: 'Baja', impacto: 'Exactitud del inventario', responsable: USUARIO_ROL['Almacén'], accion: `Ajuste ${r.registro.folio} aplicado; revisar causa`, compromiso: sumarDias(hoy(), 3) }, true);
  guardar();
  return r;
}

// ========================================================= suministro a producción

function requerimientosOP(op) {
  const p = producto(op.producto);
  return Object.entries(p.bom).map(([mat, porUnidad]) => {
    const requerido = redondear(porUnidad * op.planificada, 3);
    const sums = S.suministros.filter(s => s.op === op.folio);
    const lin = sums.flatMap(s => s.lineas).filter(l => l.material === mat);
    const surtido = redondear(suma(lin, l => l.surtido), 3);
    const reservado = redondear(suma(lin, l => suma(l.reservas, r => r.cantidad)), 3);
    const e = existencias(mat);
    return { material: mat, porUnidad, requerido, surtido, reservado, pendiente: Math.max(0, redondear(requerido - surtido, 3)), disponible: e.disponible };
  });
}

function crearSuministro(opFolio, d = {}) {
  if (!puede('suministro')) return sinPermiso('suministro');
  const op = buscarPor('ordenesProduccion', opFolio);
  if (!op || !['Planificada', 'Pendiente de materiales', 'Lista para iniciar', 'En proceso'].includes(op.estado)) return fallo('La orden no admite surtido en su estado actual.');
  if (S.suministros.some(s => s.op === op.folio && ['Pendiente', 'Preparando', 'Surtido parcial'].includes(s.estado))) return fallo(`${op.folio} ya tiene una solicitud de suministro abierta.`);
  const req = requerimientosOP(op).filter(r => r.pendiente > 0);
  if (!req.length) return fallo('La orden ya tiene todo su material surtido.');
  const sum = {
    folio: nuevoFolio('SUM'), op: op.folio, linea: op.linea, fecha: hoy(), fechaRequerida: d.fechaRequerida || op.iniPlan,
    responsable: d.responsable || USUARIO_ROL['Almacén'], destino: linea(op.linea).nombre, estado: 'Pendiente', fechaCierre: null,
    lineas: req.map(r => {
      const { reservas } = reservarFIFO(r.material, r.pendiente);
      return { material: r.material, solicitado: r.pendiente, surtido: 0, devuelto: 0, reservas, lotes: [], origen: material(r.material).ubicacion };
    }),
  };
  S.suministros.push(sum);
  const faltan = sum.lineas.filter(l => suma(l.reservas, r => r.cantidad) < l.solicitado - 1e-6);
  if (faltan.length && ['Planificada', 'Lista para iniciar'].includes(op.estado)) op.estado = 'Pendiente de materiales';
  auditar('Solicitud de suministro', sum.folio, `${op.folio} · ${sum.lineas.length} materiales`);
  guardar();
  return exito(`Solicitud ${sum.folio} creada para ${op.folio}${faltan.length ? `; faltan existencias de ${faltan.length} material(es)` : '; todo el material quedó reservado'}.`, sum, { faltantes: faltan.map(l => ({ material: l.material, cantidad: redondear(l.solicitado - suma(l.reservas, r => r.cantidad), 3) })) });
}

function prepararSuministro(folio) {
  if (!puede('suministro')) return sinPermiso('suministro');
  const s = buscarPor('suministros', folio);
  if (!s || s.estado !== 'Pendiente') return fallo('La solicitud no está pendiente.');
  s.estado = 'Preparando';
  auditar('Suministro en preparación', folio);
  guardar();
  return exito(`${folio} en preparación.`, s);
}

// Surte lo que haya (primero lo reservado, luego FIFO). Nunca más de lo disponible.
function surtirSuministro(folio, cantidades = null) {
  if (!puede('suministro')) return sinPermiso('suministro');
  const s = buscarPor('suministros', folio);
  if (!s || !['Pendiente', 'Preparando', 'Surtido parcial'].includes(s.estado)) return fallo('La solicitud no está abierta.');
  const op = buscarPor('ordenesProduccion', s.op);
  let totalSurtido = 0;
  const faltantes = [];
  for (const l of s.lineas) {
    const pend = redondear(l.solicitado - l.surtido, 3);
    if (pend <= 0) continue;
    const reservado = suma(l.reservas, r => r.cantidad);
    const posible = redondear(reservado + existencias(l.material).disponible, 3);
    let pedir = cantidades && cantidades[l.material] != null ? Number(cantidades[l.material]) : Math.min(pend, posible);
    if (pedir < 0) return fallo('Las cantidades no pueden ser negativas.');
    if (pedir > pend + 1e-6) return fallo(`De ${l.material} sólo faltan ${fmt.num(pend, 2)} por surtir.`);
    if (pedir > posible + 1e-6) return fallo(`De ${l.material} sólo hay ${fmt.num(posible, 2)} disponibles; no se surte de más.`);
    let resta = pedir;
    // 1) consumir lo reservado
    for (const r of l.reservas) {
      if (resta <= 1e-9) break;
      const lote = S.lotes.find(x => x.lote === r.lote);
      const t = Math.min(resta, r.cantidad, lote.cantidad);
      if (t <= 0) continue;
      lote.cantidad = redondear(lote.cantidad - t, 3);
      lote.reservada = Math.max(0, redondear(lote.reservada - t, 3));
      r.cantidad = redondear(r.cantidad - t, 3);
      l.lotes.push({ lote: lote.lote, cantidad: redondear(t, 3) });
      registrarMovimiento('Salida a producción', { material: l.material, lote: lote.lote, cantidad: -t, referencia: s.folio, motivo: s.op, costo: lote.costo });
      resta -= t;
    }
    l.reservas = l.reservas.filter(r => r.cantidad > 1e-9);
    // 2) completar con lotes disponibles (FIFO)
    for (const lote of lotesDisponibles(l.material)) {
      if (resta <= 1e-9) break;
      const t = Math.min(resta, lote.cantidad - lote.reservada);
      lote.cantidad = redondear(lote.cantidad - t, 3);
      l.lotes.push({ lote: lote.lote, cantidad: redondear(t, 3) });
      registrarMovimiento('Salida a producción', { material: l.material, lote: lote.lote, cantidad: -t, referencia: s.folio, motivo: s.op, costo: lote.costo });
      resta -= t;
    }
    l.surtido = redondear(l.surtido + pedir - resta, 3);
    totalSurtido += pedir - resta;
    if (l.surtido < l.solicitado - 1e-6) faltantes.push({ material: l.material, cantidad: redondear(l.solicitado - l.surtido, 3) });
  }
  if (totalSurtido <= 0 && faltantes.length) return { ok: false, mensaje: 'No hay existencias disponibles para surtir. Genera una solicitud de compra para el faltante.', faltantes };
  s.estado = faltantes.length ? 'Surtido parcial' : 'Surtido completo';
  if (!faltantes.length) s.fechaCierre = ahora();
  actualizarEstadoMaterialesOP(op);
  auditar(`Suministro: ${s.estado.toLowerCase()}`, folio, s.op);
  guardar();
  return exito(`${folio}: ${s.estado.toLowerCase()} (${porcentajeSurtido(s).toFixed(0)} %).${faltantes.length ? ' Faltan: ' + faltantes.map(f => `${fmt.cant(f.cantidad, material(f.material).unidad)} de ${material(f.material).descripcion}`).join(', ') + '.' : ''}`, s, { faltantes });
}

const porcentajeSurtido = s => 100 * (dividir(suma(s.lineas, l => l.surtido / l.solicitado), s.lineas.length) || 0);

function actualizarEstadoMaterialesOP(op) {
  if (!op || !['Planificada', 'Pendiente de materiales', 'Lista para iniciar'].includes(op.estado)) return;
  const completo = requerimientosOP(op).every(r => r.pendiente <= 1e-6);
  op.estado = completo ? 'Lista para iniciar' : 'Pendiente de materiales';
}

function devolverMaterial(folio, mat, cantidad, motivo) {
  if (!puede('suministro')) return sinPermiso('suministro');
  const s = buscarPor('suministros', folio);
  const l = s && s.lineas.find(x => x.material === mat);
  cantidad = Number(cantidad);
  if (!l) return fallo('Selecciona un material del vale.');
  if (!(cantidad > 0)) return fallo('La cantidad debe ser mayor que cero.');
  if (cantidad > l.surtido - l.devuelto + 1e-6) return fallo(`Sólo se surtieron ${fmt.num(l.surtido - l.devuelto, 2)} sin devolver.`);
  if (!String(motivo || '').trim()) return fallo('Indica el motivo de la devolución.');
  // vuelve al último lote del que salió
  const ult = l.lotes[l.lotes.length - 1];
  const lote = S.lotes.find(x => x.lote === ult.lote);
  lote.cantidad = redondear(lote.cantidad + cantidad, 3);
  l.devuelto = redondear(l.devuelto + cantidad, 3);
  registrarMovimiento('Devolución de producción', { material: mat, lote: lote.lote, cantidad, referencia: folio, motivo, costo: lote.costo });
  auditar('Devolución de material', folio, `${mat} ${cantidad} · ${motivo}`);
  guardar();
  return exito(`Devueltos ${fmt.cant(cantidad, material(mat).unidad)} al lote ${lote.lote}.`, s);
}

function cancelarSuministro(folio) {
  if (!puede('suministro')) return sinPermiso('suministro');
  const s = buscarPor('suministros', folio);
  if (!s || !['Pendiente', 'Preparando', 'Surtido parcial'].includes(s.estado)) return fallo('La solicitud no está abierta.');
  // Lo ya surtido se queda surtido (cuenta para la orden); sólo se libera lo reservado.
  s.lineas.forEach(l => { liberarReservas(l.reservas); l.reservas = []; });
  s.estado = 'Cancelado';
  s.fechaCierre = ahora();
  actualizarEstadoMaterialesOP(buscarPor('ordenesProduccion', s.op));
  auditar('Suministro cancelado', folio);
  guardar();
  return exito(`${folio} cancelada; las reservas se liberaron.`, s);
}

// Propone solicitudes de compra para los faltantes, sin duplicar las que ya están abiertas.
function proponerCompraFaltantes(faltantes, referencia) {
  const creadas = [], omitidas = [];
  faltantes.forEach(f => {
    const abierta = S.solicitudes.find(s => s.material === f.material && ABIERTOS_SC.includes(s.estado));
    if (abierta) { omitidas.push(abierta.folio); return; }
    const m = material(f.material);
    const cant = Math.max(f.cantidad, m.max - existencias(f.material).fisica - enTransito(f.material));
    const r = crearSolicitud({ area: 'Producción', material: f.material, cantidad: Math.ceil(cant), motivo: `Faltante para ${referencia}`, prioridad: 'Alta', origen: 'Propuesta automática' });
    if (r.ok) creadas.push(r.registro.folio);
  });
  return exito(`${creadas.length ? `Solicitudes propuestas: ${creadas.join(', ')}.` : 'No se crearon solicitudes nuevas.'}${omitidas.length ? ` Ya había solicitudes abiertas: ${omitidas.join(', ')}.` : ''}`, null, { creadas });
}

// ======================================================= órdenes de producción

function crearOP(d) {
  if (!puede('produccion')) return sinPermiso('produccion');
  const p = producto(d.producto);
  const cant = parseInt(d.cantidad, 10);
  if (!p) return fallo('Selecciona un producto.');
  if (!(cant > 0)) return fallo('La cantidad planificada debe ser mayor que cero.');
  if (!linea(d.linea)) return fallo('Asigna una línea de producción.');
  if (!d.iniPlan || !d.finPlan) return fallo('Define las fechas planificadas.');
  if (d.finPlan < d.iniPlan) return fallo('La fecha de fin no puede ser anterior a la de inicio.');
  const op = {
    folio: nuevoFolio('OP'), producto: p.codigo, planificada: cant, fabricada: 0, aceptada: 0, defectuosa: 0,
    iniPlan: d.iniPlan, finPlan: d.finPlan, iniReal: null, finReal: null, linea: d.linea,
    responsable: d.responsable || USUARIO_ROL['Producción'], estado: 'Planificada', paros: [], excepcion: null, lotePT: null, creada: ahora(), historial: [],
  };
  S.ordenesProduccion.push(op);
  historial(op, 'Orden de producción creada', `${fmt.num(cant)} × ${p.nombre} · ${linea(d.linea).nombre}`);
  guardar();
  return exito(`Orden ${op.folio} creada: ${fmt.num(cant)} ${p.nombre}.`, op);
}

// No inicia sin materiales completos, salvo excepción autorizada y auditada.
function iniciarOP(folio, { excepcion = false, motivo = '' } = {}) {
  if (!puede('produccion')) return sinPermiso('produccion');
  const op = buscarPor('ordenesProduccion', folio);
  if (!op) return fallo('No existe la orden.');
  if (!['Planificada', 'Pendiente de materiales', 'Lista para iniciar'].includes(op.estado)) return fallo('La orden ya inició o está cerrada.');
  const faltan = requerimientosOP(op).filter(r => r.pendiente > 1e-6);
  if (faltan.length) {
    if (!excepcion) return fallo(`No puede iniciar: faltan por surtir ${faltan.map(f => material(f.material).descripcion).join(', ')}.`);
    if (!puede('excepcion')) return sinPermiso('excepcion');
    if (!String(motivo).trim()) return fallo('La excepción necesita un motivo.');
    op.excepcion = { fecha: ahora(), usuario: usuarioActual(), motivo, faltantes: faltan.map(f => f.material) };
    historial(op, 'Inicio por excepción autorizada', motivo);
  }
  op.estado = 'En proceso';
  op.iniReal = ahora();
  const p = producto(op.producto);
  ETAPAS.forEach(et => {
    S.operaciones.push({
      folio: nuevoFolio('OPE'), op: op.folio, etapa: et.n, operacion: et.nombre, programada: op.planificada,
      procesada: 0, aceptada: 0, defectuosa: 0, tEstUnit: redondear(p.tEst * et.frac, 3), tReal: 0,
      responsable: op.responsable, estado: et.n === 1 ? 'En proceso' : 'Pendiente', observaciones: '', defectos: [],
    });
  });
  historial(op, 'Orden iniciada');
  guardar();
  return exito(`${folio} en proceso.`, op);
}

const operacionesDe = opFolio => S.operaciones.filter(o => o.op === opFolio).sort((a, b) => a.etapa - b.etapa);

// Unidades que esperan entrar a una etapa: lo aceptado por la anterior menos lo ya procesado.
function entradaPendiente(ope) {
  const ops = operacionesDe(ope.op);
  const previa = ops.find(o => o.etapa === ope.etapa - 1);
  const entrada = previa ? previa.aceptada : ope.programada;
  return redondear(entrada - ope.procesada, 3);
}

function registrarAvance(opeFolio, { procesadas, rechazadas = 0, causa = '', minutos = 0, observaciones = '' }) {
  if (!puede('produccion')) return sinPermiso('produccion');
  const ope = buscarPor('operaciones', opeFolio);
  if (!ope) return fallo('No existe la operación.');
  const op = buscarPor('ordenesProduccion', ope.op);
  if (op.estado !== 'En proceso') return fallo(`La orden ${op.folio} está ${op.estado.toLowerCase()}.`);
  procesadas = parseInt(procesadas, 10) || 0;
  rechazadas = parseInt(rechazadas, 10) || 0;
  minutos = Number(minutos) || 0;
  const disp = entradaPendiente(ope);
  if (procesadas <= 0) return fallo('Registra al menos una unidad procesada.');
  if (procesadas > disp) return fallo(`A «${ope.operacion}» sólo le llegan ${fmt.num(disp)} unidades pendientes; no se cuenta dos veces una unidad.`);
  if (rechazadas < 0 || rechazadas > procesadas) return fallo('Las rechazadas no pueden superar las procesadas.');
  if (rechazadas > 0 && !String(causa).trim()) return fallo('Indica la causa del defecto.');
  if (minutos < 0) return fallo('El tiempo no puede ser negativo.');
  ope.procesada += procesadas;
  ope.defectuosa += rechazadas;
  ope.aceptada += procesadas - rechazadas;
  ope.tReal = redondear(ope.tReal + minutos, 1);
  if (rechazadas) ope.defectos.push({ fecha: ahora(), cantidad: rechazadas, causa });
  if (observaciones) ope.observaciones = observaciones;
  ope.estado = entradaPendiente(ope) <= 0 && etapaPreviaCerrada(ope) ? 'Terminada' : 'En proceso';
  const sig = operacionesDe(op.folio).find(o => o.etapa === ope.etapa + 1);
  if (sig && sig.estado === 'Pendiente') sig.estado = 'En proceso';
  recalcularOP(op);
  auditar('Avance de manufactura', opeFolio, `${op.folio} · ${ope.operacion}: +${procesadas} (${rechazadas} rechazadas)`);
  guardar();
  return exito(`${ope.operacion}: +${fmt.num(procesadas)} procesadas, ${fmt.num(rechazadas)} rechazadas.`, ope);
}

function etapaPreviaCerrada(ope) {
  if (ope.etapa === 1) return ope.procesada >= ope.programada;
  const previa = operacionesDe(ope.op).find(o => o.etapa === ope.etapa - 1);
  return previa.estado === 'Terminada';
}

function cambiarEstadoOperacion(opeFolio, estado) {
  if (!puede('produccion')) return sinPermiso('produccion');
  const ope = buscarPor('operaciones', opeFolio);
  if (!ope || ope.estado === 'Terminada') return fallo('La operación ya terminó.');
  ope.estado = estado;
  auditar(`Operación ${estado.toLowerCase()}`, opeFolio);
  guardar();
  return exito(`${ope.operacion}: ${estado.toLowerCase()}.`, ope);
}

function registrarInspeccion(opeFolio, observaciones) {
  const ope = buscarPor('operaciones', opeFolio);
  if (!ope || ope.etapa !== 4) return fallo('La inspección se registra en la etapa de calidad.');
  if (!String(observaciones || '').trim()) return fallo('Escribe el resultado de la inspección.');
  ope.observaciones = observaciones;
  (ope.inspecciones = ope.inspecciones || []).push({ fecha: ahora(), usuario: usuarioActual(), texto: observaciones });
  auditar('Inspección de calidad', opeFolio, observaciones);
  guardar();
  return exito('Inspección registrada.', ope);
}

function recalcularOP(op) {
  const ops = operacionesDe(op.folio);
  if (!ops.length) return;
  op.fabricada = ops.find(o => o.etapa === 3).procesada;
  op.defectuosa = suma(ops, o => o.defectuosa);
  op.aceptada = ops.find(o => o.etapa === 6).aceptada;
}

function pausarOP(folio, { causa, minutos, incidencia = false }) {
  if (!puede('produccion')) return sinPermiso('produccion');
  const op = buscarPor('ordenesProduccion', folio);
  minutos = Number(minutos) || 0;
  if (!op || op.estado !== 'En proceso') return fallo('Sólo se pausa una orden en proceso.');
  if (!causa) return fallo('Indica la causa del paro.');
  if (minutos < 0) return fallo('Los minutos no pueden ser negativos.');
  op.estado = 'Pausada';
  op.paros.push({ fecha: ahora(), causa, minutos });
  historial(op, 'Paro registrado', `${causa} · ${minutos} min`);
  if (incidencia) crearIncidencia({ area: 'Producción', tipo: 'Paro de maquinaria', operacion: folio, descripcion: `${causa} en ${linea(op.linea).nombre} (${minutos} min)`, severidad: minutos >= 120 ? 'Alta' : 'Media', impacto: `Retrasa ${folio} y las órdenes siguientes de la línea`, responsable: USUARIO_ROL['Producción'], accion: 'Mantenimiento correctivo y reprogramación', compromiso: sumarDias(hoy(), 1) }, true);
  guardar();
  return exito(`${folio} pausada: ${causa}.`, op);
}

function reanudarOP(folio) {
  if (!puede('produccion')) return sinPermiso('produccion');
  const op = buscarPor('ordenesProduccion', folio);
  if (!op || op.estado !== 'Pausada') return fallo('La orden no está pausada.');
  op.estado = 'En proceso';
  historial(op, 'Orden reanudada');
  guardar();
  return exito(`${folio} reanudada.`, op);
}

// Costo de materiales efectivamente consumidos por la orden (salidas menos devoluciones).
function costoMaterialesOP(opFolio) {
  const sums = S.suministros.filter(s => s.op === opFolio).map(s => s.folio);
  return -suma(S.movimientos.filter(m => sums.includes(m.referencia) && ['Salida a producción', 'Devolución de producción'].includes(m.tipo)), m => m.cantidad * m.costoUnit);
}

// Al terminar se genera el lote de producto terminado con lo aceptado. Nada se cuenta dos veces.
function completarOP(folio) {
  if (!puede('produccion')) return sinPermiso('produccion');
  const op = buscarPor('ordenesProduccion', folio);
  if (!op || op.estado !== 'En proceso') return fallo('La orden debe estar en proceso.');
  const ops = operacionesDe(folio);
  const atoradas = ops.filter(o => o.etapa > 1 && entradaPendiente(o) > 0);
  if (atoradas.length) return fallo(`Hay unidades a medio proceso: ${atoradas.map(o => `${fmt.num(entradaPendiente(o))} en ${o.operacion}`).join(', ')}. Regístralas antes de terminar.`);
  recalcularOP(op);
  if (op.aceptada <= 0) return fallo('No hay unidades aceptadas transferidas al almacén.');
  ops.forEach(o => { o.estado = 'Terminada'; });
  op.estado = 'Terminada';
  op.finReal = ahora();
  const tReal = suma(ops, o => o.tReal);
  const costo = costoMaterialesOP(folio) + tReal * S.config.costoMinutoProduccion;
  const lote = {
    lote: nuevoFolio('LPT'), producto: op.producto, op: op.folio, fecha: hoy(), fabricada: op.fabricada, aprobada: op.aceptada,
    existencia: op.aceptada, reservada: 0, despachada: 0, ubicacion: `PT-${op.linea.slice(-1)}${String(1 + (S.lotesPT.length % 12)).padStart(2, '0')}`,
    costoUnit: redondear(costo / op.aceptada), calidad: 'Aprobado',
  };
  S.lotesPT.push(lote);
  op.lotePT = lote.lote;
  registrarMovimiento('Entrada de producto terminado', { producto: op.producto, lote: lote.lote, cantidad: op.aceptada, referencia: op.folio, costo: lote.costoUnit });
  historial(op, 'Orden terminada', `${fmt.num(op.aceptada)} aceptadas · lote ${lote.lote}`);
  guardar();
  return exito(`${folio} terminada: ${fmt.num(op.aceptada)} unidades aprobadas en el lote ${lote.lote}.`, lote);
}

function cancelarOP(folio, motivo) {
  if (!puede('produccion')) return sinPermiso('produccion');
  const op = buscarPor('ordenesProduccion', folio);
  if (!op || ['Terminada', 'Cancelada'].includes(op.estado)) return fallo('La orden ya está cerrada.');
  if (!String(motivo || '').trim()) return fallo('Indica el motivo de la cancelación.');
  S.suministros.filter(s => s.op === folio && ['Pendiente', 'Preparando', 'Surtido parcial'].includes(s.estado)).forEach(s => {
    s.lineas.forEach(l => { liberarReservas(l.reservas); l.reservas = []; });
    s.estado = 'Cancelado';
    s.fechaCierre = ahora();
  });
  op.estado = 'Cancelada';
  op.finReal = ahora();
  historial(op, 'Orden cancelada', motivo);
  guardar();
  return exito(`${folio} cancelada; se liberaron las reservas de material.`, op);
}

// ===================================================== productos terminados

function disponiblePT(prod) {
  return suma(S.lotesPT.filter(l => l.producto === prod && l.calidad === 'Aprobado'), l => l.existencia - l.reservada);
}

function cambiarCalidadLotePT(loteId, calidad, motivo) {
  if (!puede('terminado')) return sinPermiso('terminado');
  const l = S.lotesPT.find(x => x.lote === loteId);
  if (!l) return fallo('No existe el lote.');
  if (!String(motivo || '').trim()) return fallo('Indica el motivo.');
  if (calidad === 'Bloqueado' && l.reservada > 0) return fallo('El lote tiene unidades reservadas para pedidos; libéralas antes de bloquearlo.');
  const antes = l.calidad;
  l.calidad = calidad;
  if (calidad === 'Bloqueado') crearIncidencia({ area: 'Calidad', tipo: 'Defectos de fabricación', operacion: l.lote, descripcion: `Lote ${l.lote} bloqueado: ${motivo}`, severidad: 'Alta', impacto: `${fmt.num(l.existencia)} unidades no disponibles para pedidos`, responsable: USUARIO_ROL['Producción'], accion: 'Reinspección del lote', compromiso: sumarDias(hoy(), 2) }, true);
  auditar(`Lote PT ${calidad.toLowerCase()}`, l.lote, `${antes} → ${calidad}: ${motivo}`);
  guardar();
  return exito(`Lote ${l.lote}: ${calidad.toLowerCase()}.`, l);
}

function transferirLotePT(loteId, ubicacion) {
  if (!puede('terminado')) return sinPermiso('terminado');
  const l = S.lotesPT.find(x => x.lote === loteId);
  if (!l) return fallo('No existe el lote.');
  if (!String(ubicacion || '').trim()) return fallo('Indica la ubicación destino.');
  const antes = l.ubicacion;
  l.ubicacion = ubicacion.trim().toUpperCase();
  registrarMovimiento('Transferencia de ubicación', { producto: l.producto, lote: l.lote, cantidad: 0, referencia: l.lote, motivo: `${antes} → ${l.ubicacion}`, costo: l.costoUnit });
  auditar('Transferencia de ubicación', l.lote, `${antes} → ${l.ubicacion}`);
  guardar();
  return exito(`Lote ${l.lote} movido a ${l.ubicacion}.`, l);
}

// ================================================================== pedidos

function crearPedido(d) {
  if (!puede('pedido')) return sinPermiso('pedido');
  const c = cliente(d.cliente);
  if (!c) return fallo('Selecciona un cliente.');
  const lineas = (d.lineas || []).filter(l => l.producto);
  if (!lineas.length) return fallo('Agrega al menos un producto.');
  const v = new Set();
  for (const l of lineas) {
    if (!producto(l.producto)) return fallo('Producto inválido.');
    if (v.has(l.producto)) return fallo(`${l.producto} está repetido.`);
    v.add(l.producto);
    if (!(parseInt(l.cantidad, 10) > 0)) return fallo('Las cantidades deben ser mayores que cero.');
  }
  if (!d.comprometida) return fallo('Indica la fecha comprometida.');
  if (d.comprometida < hoy()) return fallo('La fecha comprometida no puede estar en el pasado.');
  const ped = {
    folio: nuevoFolio('PED'), cliente: c.codigo, fecha: hoy(), comprometida: d.comprometida, despacho: null, entrega: null,
    costoEnvio: d.costoEnvio != null && d.costoEnvio !== '' ? Number(d.costoEnvio) : redondear(900 + 9 * c.km),
    estado: 'Registrado', completo: null, aTiempo: null, historial: [],
    lineas: lineas.map(l => ({ producto: l.producto, cantidad: parseInt(l.cantidad, 10), reservada: 0, despachada: 0, devuelta: 0, reservas: [], lotes: [] })),
  };
  S.pedidos.push(ped);
  historial(ped, 'Pedido registrado', `${c.nombre} · compromiso ${fmt.fecha(ped.comprometida)}`);
  guardar();
  return exito(`Pedido ${ped.folio} registrado para ${c.nombre}.`, ped);
}

function reservarPedido(folio) {
  if (!puede('pedido')) return sinPermiso('pedido');
  const p = buscarPor('pedidos', folio);
  if (!p || !['Registrado', 'Reservado parcial'].includes(p.estado)) return fallo('El pedido no admite reserva en su estado actual.');
  let algo = 0;
  p.lineas.forEach(l => {
    let resta = l.cantidad - l.reservada - l.despachada;
    const lotes = S.lotesPT.filter(x => x.producto === l.producto && x.calidad === 'Aprobado' && x.existencia - x.reservada > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.lote.localeCompare(b.lote));
    for (const lote of lotes) {
      if (resta <= 0) break;
      const t = Math.min(resta, lote.existencia - lote.reservada);
      lote.reservada += t;
      l.reservas.push({ lote: lote.lote, cantidad: t });
      l.reservada += t;
      resta -= t;
      algo += t;
    }
  });
  if (!algo) return fallo('No hay producto terminado disponible para reservar.');
  const completo = p.lineas.every(l => l.reservada + l.despachada >= l.cantidad);
  p.estado = completo ? 'Reservado' : 'Reservado parcial';
  historial(p, completo ? 'Producto reservado' : 'Reserva parcial', `${fmt.num(algo)} unidades`);
  guardar();
  return exito(`${folio}: ${completo ? 'reserva completa' : 'reserva parcial'} (${fmt.num(algo)} unidades).`, p);
}

function prepararPedido(folio) {
  if (!puede('pedido')) return sinPermiso('pedido');
  const p = buscarPor('pedidos', folio);
  if (!p || !['Reservado', 'Reservado parcial'].includes(p.estado)) return fallo('Reserva el producto antes de preparar el pedido.');
  p.estado = 'En preparación';
  historial(p, 'Pedido en preparación');
  guardar();
  return exito(`${folio} en preparación.`, p);
}

function despacharPedido(folio, { permitirIncompleto = false } = {}) {
  if (!puede('pedido')) return sinPermiso('pedido');
  const p = buscarPor('pedidos', folio);
  if (!p || !['Reservado', 'Reservado parcial', 'En preparación'].includes(p.estado)) return fallo('El pedido debe estar reservado o en preparación.');
  const faltante = suma(p.lineas, l => l.cantidad - l.reservada - l.despachada);
  if (faltante > 0 && !permitirIncompleto) return { ok: false, requiereConfirmacion: true, mensaje: `Faltan ${fmt.num(faltante)} unidades. ¿Despachar incompleto?` };
  p.lineas.forEach(l => {
    l.reservas.forEach(r => {
      const lote = S.lotesPT.find(x => x.lote === r.lote);
      lote.existencia -= r.cantidad;
      lote.reservada -= r.cantidad;
      lote.despachada += r.cantidad;
      l.lotes.push({ ...r });
      registrarMovimiento('Salida de producto terminado', { producto: l.producto, lote: lote.lote, cantidad: -r.cantidad, referencia: p.folio, costo: lote.costoUnit });
    });
    l.despachada += l.reservada;
    l.reservada = 0;
    l.reservas = [];
  });
  p.despacho = hoy();
  p.estado = 'Despachado';
  p.completo = p.lineas.every(l => l.despachada >= l.cantidad);
  historial(p, 'Pedido despachado', p.completo ? 'completo' : 'incompleto');
  if (!p.completo) crearIncidencia({ area: 'Logística', tipo: 'Pedido incompleto', operacion: folio, descripcion: `${folio} salió con ${fmt.num(faltante)} unidades faltantes`, severidad: 'Media', impacto: 'Afecta el OTIF del periodo', responsable: USUARIO_ROL['Logística'], accion: 'Programar entrega complementaria', compromiso: sumarDias(hoy(), 3) }, true);
  guardar();
  return exito(`${folio} despachado ${p.completo ? 'completo' : 'incompleto'}.`, p);
}

function entregarPedido(folio, fecha) {
  if (!puede('pedido')) return sinPermiso('pedido');
  const p = buscarPor('pedidos', folio);
  if (!p || p.estado !== 'Despachado') return fallo('El pedido debe estar despachado.');
  const f = fecha || hoy();
  if (f < p.despacho) return fallo('La entrega no puede ser anterior al despacho.');
  p.entrega = f;
  p.estado = 'Entregado';
  p.aTiempo = f <= p.comprometida;
  historial(p, 'Pedido entregado', `${fmt.fecha(f)} · ${p.aTiempo ? 'a tiempo' : 'tarde'} · ${p.completo ? 'completo' : 'incompleto'}`);
  guardar();
  return exito(`${folio} entregado ${p.aTiempo ? 'a tiempo' : 'con retraso'}${p.completo ? '' : ' (incompleto)'}.`, p);
}

function simularRetrasoPedido(folio, dias, motivo) {
  if (!puede('pedido')) return sinPermiso('pedido');
  const p = buscarPor('pedidos', folio);
  dias = parseInt(dias, 10);
  if (!p || ['Entregado', 'Cancelado'].includes(p.estado)) return fallo('El pedido ya se cerró.');
  if (!(dias > 0) || !String(motivo || '').trim()) return fallo('Indica días y motivo del retraso.');
  p.retrasoEstimado = (p.retrasoEstimado || 0) + dias;
  historial(p, 'Retraso registrado', `+${dias} días · ${motivo}`);
  crearIncidencia({ area: 'Logística', tipo: 'Pedido incompleto', operacion: folio, descripcion: `Retraso estimado de ${dias} días: ${motivo}`, severidad: 'Media', impacto: 'Entrega fuera de la fecha comprometida; afecta OTIF', responsable: USUARIO_ROL['Logística'], accion: 'Avisar al cliente y reprogramar', compromiso: sumarDias(p.comprometida, dias) }, true);
  guardar();
  return exito(`${folio}: retraso estimado de ${dias} días.`, p);
}

function devolucionPedido(folio, prod, cantidad, motivo) {
  if (!puede('pedido')) return sinPermiso('pedido');
  const p = buscarPor('pedidos', folio);
  const l = p && p.lineas.find(x => x.producto === prod);
  cantidad = parseInt(cantidad, 10);
  if (!l || p.estado !== 'Entregado') return fallo('Sólo se registran devoluciones de pedidos entregados.');
  if (!(cantidad > 0) || cantidad > l.despachada - l.devuelta) return fallo(`Puedes devolver hasta ${fmt.num(l.despachada - l.devuelta)} unidades.`);
  if (!String(motivo || '').trim()) return fallo('Indica el motivo de la devolución.');
  l.devuelta += cantidad;
  const origen = S.lotesPT.find(x => x.lote === (l.lotes[0] || {}).lote);
  const lote = {
    lote: nuevoFolio('LPT'), producto: prod, op: origen ? origen.op : null, fecha: hoy(), fabricada: 0, aprobada: cantidad, existencia: cantidad,
    reservada: 0, despachada: 0, ubicacion: 'DEV-01', costoUnit: origen ? origen.costoUnit : 0, calidad: 'Bloqueado', devolucionDe: folio,
  };
  S.lotesPT.push(lote);
  registrarMovimiento('Devolución de cliente', { producto: prod, lote: lote.lote, cantidad, referencia: folio, motivo, costo: lote.costoUnit });
  historial(p, 'Devolución registrada', `${cantidad} × ${prod} · ${motivo}`);
  crearIncidencia({ area: 'Calidad', tipo: 'Defectos de fabricación', operacion: folio, descripcion: `Devolución de ${cantidad} ${producto(prod).nombre}: ${motivo}`, severidad: 'Media', impacto: `Lote ${lote.lote} bloqueado para inspección`, responsable: USUARIO_ROL['Producción'], accion: 'Inspeccionar devolución y analizar causa', compromiso: sumarDias(hoy(), 3) }, true);
  guardar();
  return exito(`Devolución registrada en el lote ${lote.lote} (bloqueado para inspección).`, lote);
}

function cancelarPedido(folio, motivo) {
  if (!puede('pedido')) return sinPermiso('pedido');
  const p = buscarPor('pedidos', folio);
  if (!p || ['Despachado', 'Entregado', 'Cancelado'].includes(p.estado)) return fallo('El pedido ya salió o está cancelado.');
  if (!String(motivo || '').trim()) return fallo('Indica el motivo.');
  p.lineas.forEach(l => {
    l.reservas.forEach(r => { const lote = S.lotesPT.find(x => x.lote === r.lote); lote.reservada -= r.cantidad; });
    l.reservas = []; l.reservada = 0;
  });
  p.estado = 'Cancelado';
  historial(p, 'Pedido cancelado', motivo);
  guardar();
  return exito(`${folio} cancelado; se liberaron las reservas.`, p);
}

function estadoPedido(p) {
  if (!['Entregado', 'Cancelado'].includes(p.estado) && (p.comprometida < hoy() || p.retrasoEstimado)) return 'Retrasado';
  return p.estado;
}

// =============================================================== incidencias

function crearIncidencia(d, interna = false) {
  if (!interna && !puede('incidencia')) return sinPermiso('incidencia');
  for (const c of ['area', 'tipo', 'descripcion', 'severidad']) if (!String(d[c] || '').trim()) return fallo('Completa área, tipo, descripción y severidad.');
  const inc = {
    folio: nuevoFolio('INC'), fecha: hoy(), area: d.area, tipo: d.tipo, operacion: d.operacion || '', descripcion: d.descripcion.trim(),
    severidad: d.severidad, impacto: d.impacto || '', responsable: d.responsable || usuarioActual(), accion: d.accion || '',
    compromiso: d.compromiso || sumarDias(hoy(), 3), estado: 'Abierta', evidencia: d.evidencia || '', fechaCierre: null, historial: [],
  };
  S.incidencias.push(inc);
  historial(inc, 'Incidencia registrada', `${inc.tipo} · ${inc.severidad}`);
  if (!interna) guardar();
  return exito(`Incidencia ${inc.folio} registrada.`, inc);
}

function actualizarIncidencia(folio, d) {
  if (!puede('incidencia')) return sinPermiso('incidencia');
  const inc = buscarPor('incidencias', folio);
  if (!inc) return fallo('No existe la incidencia.');
  if (d.estado === 'Resuelta' && !String(d.accion ?? inc.accion).trim()) return fallo('Para resolverla, registra la acción correctiva.');
  const cambios = [];
  ['estado', 'responsable', 'accion', 'compromiso', 'evidencia', 'severidad'].forEach(k => {
    if (d[k] != null && d[k] !== '' && d[k] !== inc[k]) { cambios.push(`${k}: ${d[k]}`); inc[k] = d[k]; }
  });
  if (!cambios.length) return fallo('No hubo cambios.');
  if (['Resuelta', 'Cerrada'].includes(inc.estado)) inc.fechaCierre = inc.fechaCierre || ahora();
  historial(inc, 'Incidencia actualizada', cambios.join('; '));
  guardar();
  return exito(`${folio} actualizada.`, inc);
}

// ============================================================ configuración

function guardarConfiguracion(d) {
  if (!puede('configuracion')) return sinPermiso('configuracion');
  const c = S.config;
  const num = (v, min = 0) => { const n = Number(v); return Number.isFinite(n) && n >= min ? n : null; };
  const iva = num(d.iva);
  if (iva == null || iva > 50) return fallo('El IVA debe estar entre 0 y 50 %.');
  c.iva = iva / 100;
  for (const k of ['costoMinutoProduccion', 'costoAlmacenDia', 'posicionesAlmacen']) {
    if (d[k] != null) { const n = num(d[k], 0); if (n == null) return fallo('Revisa los valores numéricos.'); c[k] = n; }
  }
  Object.keys(c.metas).forEach(k => { if (d['meta_' + k] != null) { const n = num(d['meta_' + k]); if (n == null) return; c.metas[k] = n; } });
  auditar('Configuración modificada', 'CONFIG', 'IVA, costos o metas');
  guardar();
  return exito('Configuración guardada. Los KPIs se recalcularon con las nuevas metas.');
}
