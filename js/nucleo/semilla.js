// Genera los datos de demostración: 30 días de operación simulada con las MISMAS
// reglas de negocio que usa la interfaz. Así compras, transporte, inventario,
// producción y pedidos cuadran entre sí por construcción. Semilla fija.
//
// Historia del mes: a finales de septiembre Polímeros Industriales (PRV-003) entrega
// la resina con retraso; la Línea A se queda sin material y sube el costo por
// compras urgentes. El 1 de octubre la Línea B tiene una falla mecánica de 3 horas.
'use strict';

const EVENTO_DEMO = {
  titulo: 'Retraso de Polímeros Industriales (PRV-003)',
  proveedor: 'PRV-003',
  desde: '2026-09-23', hasta: '2026-09-27',  // órdenes confirmadas en esta ventana llegan 5 días tarde
  retraso: 8,
  paroLinea: 'L-B', paroFecha: '2026-10-01', paroMinutos: 180,
};

const ROTACION = { 'L-A': ['PT-001', 'PT-002', 'PT-005', 'PT-006', 'PT-001'], 'L-B': ['PT-003', 'PT-004', 'PT-008'], 'L-C': ['PT-007'] };

function cantidadPlan(prod) {
  return Math.floor((960 * 0.82) / producto(prod).tEst / 10) * 10;
}

function generarDemostracion() {
  S = estadoVacio();
  const az = crearAzar(20261013);
  const inicio = sumarDias(FECHA_BASE, -DIAS_HISTORIA);
  const fin = sumarDias(FECHA_BASE, -1);
  S.relojSim = sumarDias(inicio, -1);

  // ---- niveles mínimo y máximo a partir del consumo planeado
  const consumo = {};
  S.lineas.forEach(l => ROTACION[l.codigo].forEach(pc => {
    Object.entries(producto(pc).bom).forEach(([m, q]) => {
      consumo[m] = (consumo[m] || 0) + q * cantidadPlan(pc) / ROTACION[l.codigo].length * (6 / 7);
    });
  }));
  S.materiales.forEach(m => {
    const prov = proveedor(m.proveedor);
    const c = consumo[m.codigo] || 1;
    const redondeo = ['pza'].includes(m.unidad) ? 10 : 1;
    m.lead = prov.lead;
    m.consumoDiario = redondear(c, 2);
    m.min = Math.ceil((c * (prov.lead + 5)) / redondeo) * redondeo;
    m.max = Math.ceil((m.min * 2.4 + c * 6) / redondeo) * redondeo;
    // inventario inicial en un lote
    const cant = redondear(m.min * az.entre(1.6, 2.2), m.unidad === 'pza' ? 0 : 1);
    const lote = 'L-' + nuevoFolio('LT').slice(3);
    S.lotes.push({ lote, material: m.codigo, cantidad: cant, reservada: 0, estado: 'Disponible', fechaEntrada: `${S.relojSim}T07:00`, origen: 'Inventario inicial', oc: null, costo: m.costo, ubicacion: m.ubicacion });
    registrarMovimiento('Inventario inicial', { material: m.codigo, lote, cantidad: cant, referencia: 'APERTURA', costo: m.costo });
  });
  // producto terminado inicial: dos días de producción
  S.productos.forEach(p => {
    const cant = cantidadPlan(p.codigo) * 2;
    const costoUnit = redondear(suma(Object.entries(p.bom), ([m, q]) => q * material(m).costo) + p.tEst * 1.1 * S.config.costoMinutoProduccion);
    const lote = nuevoFolio('LPT');
    S.lotesPT.push({ lote, producto: p.codigo, op: null, fecha: S.relojSim, fabricada: cant, aprobada: cant, existencia: cant, reservada: 0, despachada: 0, ubicacion: 'PT-INI', costoUnit, calidad: 'Aprobado' });
    registrarMovimiento('Inventario inicial', { producto: p.codigo, lote, cantidad: cant, referencia: 'APERTURA', costo: costoUnit });
  });

  const plan = { autorizar: [], convertir: [], confirmar: [], llegadas: {}, entregas: {}, rot: { 'L-A': 0, 'L-B': 0, 'L-C': 0 } };

  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) {
    S.relojSim = d;
    const dow = diaSemana(d);
    const habil = dow >= 1 && dow <= 5;
    S.horaSim = '07:30';
    moverEmbarques(d, az, plan);
    if (dow !== 0) { S.horaSim = '08:00'; producirDia(d, az, plan); }
    S.horaSim = '14:00';
    if (habil) comprasDia(d, az, plan);
    S.horaSim = '12:00';
    (plan.entregas[d] || []).forEach(f => entregarPedido(f, d));
    if (dow !== 0) { S.horaSim = '16:00'; pedidosDia(d, az, plan); }
    if (dow === 5) { S.horaSim = '18:00'; conteoCiclico(d, az); }
    if (d === '2026-09-30') {
      S.horaSim = '11:00';
      const r = crearIncidencia({ area: 'Compras', tipo: 'Error documental', operacion: 'OC', descripcion: 'Factura de proveedor con RFC incorrecto; se detuvo el pago hasta corregirla', severidad: 'Baja', impacto: 'Sin impacto operativo', responsable: USUARIO_ROL['Compras'], accion: 'Solicitar refacturación', compromiso: '2026-10-05' }, true);
      r.registro.operacion = S.ordenesCompra[S.ordenesCompra.length - 1].folio;
    }
    if (d === '2026-09-22') {
      S.horaSim = '10:00';
      const sc = crearSolicitud({ area: 'Mantenimiento', material: 'MAT-019', cantidad: 120, motivo: 'Reserva anual de lubricante', prioridad: 'Baja', solicitante: 'Mantenimiento (H. Cruz)' }).registro;
      rechazarSolicitud(sc.folio, 'Hay existencia suficiente para el trimestre; no se justifica la compra anual.');
    }
  }

  cierreAlDiaBase(az, plan);

  // incidencias antiguas: resueltas con su acción; las recientes quedan abiertas
  S.incidencias.forEach(i => {
    if (i.compromiso < sumarDias(FECHA_BASE, -3)) { i.estado = 'Cerrada'; i.fechaCierre = `${i.compromiso}T17:00`; i.historial.push({ fecha: i.fechaCierre, usuario: 'Sistema (histórico)', accion: 'Incidencia cerrada' }); }
    else if (i.compromiso < FECHA_BASE) i.estado = 'En atención';
  });

  S.relojSim = null;
  S.rol = 'Administrador';
  S.generado = ahoraMexico();
  return S;
}

// ------------------------------------------------------------------ transporte

function moverEmbarques(d, az, plan) {
  S.embarques.filter(e => !['Entregado', 'Cancelado'].includes(e.estado)).forEach(e => {
    const llegada = plan.llegadas[e.folio];
    if (e.estado === 'Programado' && d >= e.salidaProgramada) { avanzarEmbarque(e.folio, 'Carga en andén del proveedor'); avanzarEmbarque(e.folio, 'Salida de origen'); }
    if (llegada && llegada > e.eta && !e.retrasado && d >= sumarDias(e.eta, -1)) {
      const p = proveedor(e.proveedor);
      registrarRetrasoEmbarque(e.folio, diasEntre(e.eta, llegada), p.codigo === EVENTO_DEMO.proveedor ? 'El proveedor no liberó el material a tiempo (problema en su línea de producción)' : az.elegir(['Retraso en la carga del proveedor', 'Tráfico y revisión en carretera', 'Documentación incompleta en origen']));
    }
    if (llegada && llegada <= d && e.estado === 'En tránsito') {
      avanzarEmbarque(e.folio, 'Arribo a planta');
      const oc = buscarPor('ordenesCompra', e.oc);
      const danio = az.prob(0.08);
      const lineas = e.lineas.map(l => {
        const m = material(l.material);
        const rech = danio ? redondear(l.cantidad * az.entre(0.02, 0.06), m.unidad === 'pza' ? 0 : 1) : 0;
        return { material: l.material, recibido: l.cantidad, aceptado: redondear(l.cantidad - rech, 3) };
      });
      registrarRecepcion({ oc: oc.folio, embarque: e.folio, lineas });
    }
  });
}

// ------------------------------------------------------------------ producción

function producirDia(d, az, plan) {
  S.lineas.forEach(l => {
    let op = S.ordenesProduccion.find(o => o.linea === l.codigo && o.estado === 'Pendiente de materiales');
    if (op) {
      const sum = S.suministros.find(s => s.op === op.folio && ['Pendiente', 'Preparando', 'Surtido parcial'].includes(s.estado));
      if (sum) surtirSuministro(sum.folio);
      if (op.estado !== 'Lista para iniciar') return;   // la línea espera material
    } else {
      const rot = ROTACION[l.codigo];
      const prod = rot[plan.rot[l.codigo]++ % rot.length];
      op = crearOP({ producto: prod, cantidad: cantidadPlan(prod), iniPlan: d, finPlan: d, linea: l.codigo }).registro;
      const r = crearSuministro(op.folio, { fechaRequerida: d });
      const s = r.registro;
      prepararSuministro(s.folio);
      const rs = surtirSuministro(s.folio);
      if (op.estado !== 'Lista para iniciar') {
        const falt = (rs.faltantes || []).map(f => material(f.material).descripcion).join(', ');
        crearIncidencia({ area: 'Producción', tipo: 'Faltante de materiales', operacion: op.folio, descripcion: `${op.folio} no puede iniciar: falta ${falt}`, severidad: 'Alta', impacto: `${linea(l.codigo).nombre} detenida; ${fmt.num(op.planificada)} unidades en riesgo`, responsable: USUARIO_ROL['Almacén'], accion: 'Acelerar el embarque pendiente con el proveedor', compromiso: sumarDias(d, 2) }, true);
        return;
      }
    }
    ejecutarOP(op, d, az);
  });
}

function ejecutarOP(op, d, az) {
  iniciarOP(op.folio);
  const ops = operacionesDe(op.folio);
  let factor = az.entre(0.9, 1.0);
  if (op.linea === EVENTO_DEMO.paroLinea && d === EVENTO_DEMO.paroFecha) {
    pausarOP(op.folio, { causa: 'Falla mecánica', minutos: EVENTO_DEMO.paroMinutos, incidencia: true });
    reanudarOP(op.folio);
    factor = 0.72;
  } else if (az.prob(0.15)) {
    pausarOP(op.folio, { causa: az.elegir(CAUSAS_PARO.filter(c => c !== 'Falta de material')), minutos: az.entero(15, 55) });
    reanudarOP(op.folio);
  }
  const fab = Math.round(op.planificada * factor);
  const pico = az.prob(0.07);
  const rechazos = [0, Math.round(fab * az.entre(0, 0.005)), Math.round(fab * az.entre(0, 0.006)), Math.round(fab * (pico ? az.entre(0.04, 0.06) : az.entre(0.004, 0.016))), Math.round(fab * az.entre(0, 0.003)), 0];
  let entrada = fab;
  ops.forEach((o, i) => {
    const rech = Math.min(rechazos[i], entrada);
    const causa = rech ? (i === 3 ? az.elegir(CAUSAS_DEFECTO) : az.elegir(CAUSAS_DEFECTO.slice(0, 4))) : '';
    registrarAvance(o.folio, { procesadas: entrada, rechazadas: rech, causa, minutos: redondear(entrada * o.tEstUnit * az.entre(1.0, 1.17), 1), observaciones: i === 3 ? `Inspección por muestreo: ${rech} rechazadas` : '' });
    entrada -= rech;
  });
  if (pico) crearIncidencia({ area: 'Calidad', tipo: 'Defectos de fabricación', operacion: op.folio, descripcion: `Rechazo alto en inspección de ${op.folio} (${producto(op.producto).nombre}): ${rechazos[3]} unidades`, severidad: 'Media', impacto: 'Baja el rendimiento de calidad del periodo', responsable: USUARIO_ROL['Producción'], accion: 'Ajuste de parámetros y capacitación', compromiso: sumarDias(d, 3) }, true);
  S.horaSim = '15:30';
  completarOP(op.folio);
  // material no usado (unidades no fabricadas) vuelve al almacén
  const sum = S.suministros.find(s => s.op === op.folio);
  const sobrante = (op.planificada - fab) / op.planificada;
  if (sum && sobrante > 0.01) {
    sum.lineas.forEach(l => {
      const m = material(l.material);
      const q = m.unidad === 'pza' ? Math.floor(l.surtido * sobrante) : redondear(l.surtido * sobrante, 2);
      if (q > 0) devolverMaterial(sum.folio, l.material, q, 'Material no utilizado al cierre de la orden');
    });
  }
  S.horaSim = '08:00';
}

// -------------------------------------------------------------------- compras

function comprasDia(d, az, plan) {
  // autorizaciones y conversiones que quedaron del día anterior
  plan.autorizar.splice(0).forEach(f => { autorizarSolicitud(f, 'Autorizado por punto de reorden'); plan.convertir.push(f); });
  plan.convertir.splice(0).forEach(f => {
    const sc = buscarPor('solicitudes', f);
    const m = material(sc.material);
    const enEvento = m.proveedor === EVENTO_DEMO.proveedor && d >= EVENTO_DEMO.desde && d <= EVENTO_DEMO.hasta;
    const r = convertirSolicitud(f, { precio: redondear(m.costo * (enEvento ? az.entre(1.06, 1.1) : az.entre(0.98, 1.045)), 2) });
    if (r.ok) { enviarOC(r.registro.folio); plan.confirmar.push(r.registro.folio); }
  });
  const listas = plan.confirmar.filter(f => buscarPor('ordenesCompra', f).fechaEmision < d);
  plan.confirmar = plan.confirmar.filter(f => !listas.includes(f));
  listas.forEach(f => {
    const oc = buscarPor('ordenesCompra', f);
    // el proveedor confirma una fecha que todavía es alcanzable
    confirmarOC(f, oc.fechaPrometida > d ? oc.fechaPrometida : sumarDias(d, Math.max(1, proveedor(oc.proveedor).lead - 1)));
    const prov = proveedor(oc.proveedor);
    const r = programarEmbarque({ oc: f });
    if (!r.ok) return;
    let atraso = az.prob(1 - prov.puntualidad) ? az.entero(1, 3) : 0;
    if (prov.codigo === EVENTO_DEMO.proveedor && d >= EVENTO_DEMO.desde && d <= EVENTO_DEMO.hasta) atraso = EVENTO_DEMO.retraso;
    plan.llegadas[r.registro.folio] = sumarDias(r.registro.eta, atraso);
  });

  // punto de reorden
  S.materiales.forEach(m => {
    const pos = existencias(m.codigo).disponible + enTransito(m.codigo);
    if (pos >= m.min) return;
    if (S.solicitudes.some(s => s.material === m.codigo && ABIERTOS_SC.includes(s.estado))) return;
    const redondeo = m.unidad === 'pza' ? 50 : 5;
    const cant = Math.ceil((m.max - pos) / redondeo) * redondeo;
    const urgente = existencias(m.codigo).disponible < m.min * 0.5;
    const sc = crearSolicitud({ area: 'Almacén', material: m.codigo, cantidad: cant, motivo: 'Existencia + tránsito por debajo del mínimo (punto de reorden)', prioridad: urgente ? 'Urgente' : 'Alta', solicitante: 'MRP automático', origen: 'Punto de reorden' }).registro;
    if (urgente || az.prob(0.5)) { autorizarSolicitud(sc.folio, 'Autorización inmediata por prioridad'); plan.convertir.push(sc.folio); }
    else plan.autorizar.push(sc.folio);
  });
  // las urgentes se convierten el mismo día
  if (plan.convertir.length) comprasConvertirMismoDia(d, az, plan);
}

function comprasConvertirMismoDia(d, az, plan) {
  plan.convertir.splice(0).forEach(f => {
    const sc = buscarPor('solicitudes', f);
    if (sc.prioridad !== 'Urgente') { plan.convertir.push(f); return; }
    const m = material(sc.material);
    const enEvento = m.proveedor === EVENTO_DEMO.proveedor && d >= EVENTO_DEMO.desde && d <= EVENTO_DEMO.hasta;
    const r = convertirSolicitud(f, { precio: redondear(m.costo * (enEvento ? az.entre(1.06, 1.1) : az.entre(0.99, 1.05)), 2) });
    if (r.ok) { enviarOC(r.registro.folio); plan.confirmar.push(r.registro.folio); }
  });
}

// -------------------------------------------------------------------- pedidos

function pedidosDia(d, az, plan) {
  // surtir lo que vence mañana o ya venció
  S.pedidos.filter(p => ['Registrado', 'Reservado parcial'].includes(p.estado) && sumarDias(p.comprometida, -2) <= d && !p._retener).forEach(p => {
    if (p.estado === 'Registrado' || p.estado === 'Reservado parcial') reservarPedido(p.folio);
    const completo = p.lineas.every(l => l.reservada >= l.cantidad);
    if (!completo && d < p.comprometida) return;
    if (!p.lineas.some(l => l.reservada > 0)) return;
    prepararPedido(p.folio);
    despacharPedido(p.folio, { permitirIncompleto: true });
    const c = cliente(p.cliente);
    let llegada = sumarDias(d, c.km > 400 ? 2 : 1);
    if (az.prob(0.06)) llegada = sumarDias(llegada, 1);
    (plan.entregas[llegada] = plan.entregas[llegada] || []).push(p.folio);
  });
  if (diaSemana(d) === 6) return;   // los sábados no se reciben pedidos
  // La demanda de cada producto ronda el 85 % de lo que la planta produce de él.
  const n = az.entero(2, 3);
  const pedidos = Array.from({ length: n }, () => []);
  S.productos.forEach(p => {
    const rot = ROTACION[p.linea === 'L-C' && p.codigo !== 'PT-007' ? 'L-A' : p.linea];
    const porDia = cantidadPlan(p.codigo) * rot.filter(x => x === p.codigo).length / rot.length * (6 / 5);
    if (!porDia || !az.prob(0.85)) return;
    pedidos[az.entero(0, n - 1)].push({ producto: p.codigo, cantidad: Math.max(5, Math.round(porDia * 0.85 / 0.85 * az.entre(0.75, 0.95) / 5) * 5) });
  });
  pedidos.filter(l => l.length).forEach(lineas => crearPedido({ cliente: az.elegir(S.clientes).codigo, lineas, comprometida: sumarDias(d, az.entero(3, 5)) }));
}

// --------------------------------------------------------------- conteo cíclico

function conteoCiclico(d, az) {
  const lotes = S.lotes.filter(l => l.cantidad > 0 && l.reservada === 0 && l.estado === 'Disponible');
  for (let i = 0; i < 4 && lotes.length; i++) {
    const l = lotes.splice(az.entero(0, lotes.length - 1), 1)[0];
    const dif = az.prob(0.12) ? redondear(-l.cantidad * az.entre(0.005, 0.02), material(l.material).unidad === 'pza' ? 0 : 1) : 0;
    const c = registrarConteo({ lote: l.lote, fisico: redondear(l.cantidad + dif, 3) }).registro;
    if (c.estado === 'Con diferencia') aplicarAjusteConteo(c.folio);
  }
}

// --------------------------------------------- estado abierto al día base (hoy)

function cierreAlDiaBase(az, plan) {
  const d = FECHA_BASE;
  S.relojSim = d;
  S.horaSim = '07:30';
  moverEmbarques(d, az, plan);
  S.horaSim = '08:00';
  (plan.entregas[d] || []).forEach(f => entregarPedido(f, d));
  S.horaSim = '08:30';
  comprasDia(d, az, plan);
  // dos órdenes recién confirmadas: una ya viaja (y avisa retraso), otra está programada
  const enviadas = S.ordenesCompra.filter(o => o.estado === 'Enviada');
  enviadas.slice(0, 2).forEach((oc, i) => {
    confirmarOC(oc.folio);
    const r = programarEmbarque({ oc: oc.folio, salida: d, eta: sumarDias(d, proveedor(oc.proveedor).lead) });
    if (r.ok && i === 0) {
      avanzarEmbarque(r.registro.folio, 'Carga en andén del proveedor');
      avanzarEmbarque(r.registro.folio, 'Salida de origen');
      registrarRetrasoEmbarque(r.registro.folio, 2, 'Revisión documental en caseta de carretera', 'Retraso del proveedor');
    }
  });

  // Órdenes de producción del día en distintos estados
  // L-A: en proceso, con avance parcial
  const opA = crearOP({ producto: 'PT-001', cantidad: cantidadPlan('PT-001'), iniPlan: d, finPlan: d, linea: 'L-A' }).registro;
  const sA = crearSuministro(opA.folio).registro;
  surtirSuministro(sA.folio);
  if (opA.estado === 'Lista para iniciar') {
    iniciarOP(opA.folio);
    const o = operacionesDe(opA.folio);
    registrarAvance(o[0].folio, { procesadas: 90, minutos: 56 });
    registrarAvance(o[1].folio, { procesadas: 90, rechazadas: 1, causa: 'Rebaba en pieza inyectada', minutos: 112 });
    registrarAvance(o[2].folio, { procesadas: 60, minutos: 131 });
  }
  // L-B: lista para iniciar (material surtido)
  const opB = crearOP({ producto: 'PT-004', cantidad: cantidadPlan('PT-004'), iniPlan: d, finPlan: d, linea: 'L-B' }).registro;
  const sB = crearSuministro(opB.folio).registro;
  surtirSuministro(sB.folio);
  // L-C: material reservado y en preparación; todavía no se surte
  const opC = crearOP({ producto: 'PT-007', cantidad: cantidadPlan('PT-007'), iniPlan: d, finPlan: d, linea: 'L-C' }).registro;
  prepararSuministro(crearSuministro(opC.folio).registro.folio);
  // L-A, mañana: Contenedor Apilable sin bolsas ni etiquetas suficientes (vienen en camino)
  const opA2 = crearOP({ producto: 'PT-006', cantidad: cantidadPlan('PT-006') * 5, iniPlan: sumarDias(d, 1), finPlan: sumarDias(d, 2), linea: 'L-A' }).registro;
  const rA2 = crearSuministro(opA2.folio, { fechaRequerida: sumarDias(d, 1) });
  if (rA2.faltantes && rA2.faltantes.length) {
    crearIncidencia({ area: 'Producción', tipo: 'Faltante de materiales', operacion: opA2.folio, descripcion: `${opA2.folio} no puede iniciar: falta ${rA2.faltantes.map(f => `${fmt.cant(f.cantidad, material(f.material).unidad)} de ${material(f.material).descripcion}`).join(' y ')}`, severidad: 'Alta', impacto: 'Riesgo de retraso en pedidos de Contenedor Apilable', responsable: USUARIO_ROL['Compras'], accion: 'Dar seguimiento a las órdenes en tránsito', compromiso: sumarDias(d, 2) }, true);
  }
  // planificadas para mañana
  crearOP({ producto: 'PT-002', cantidad: cantidadPlan('PT-002'), iniPlan: sumarDias(d, 2), finPlan: sumarDias(d, 2), linea: 'L-A' });
  crearOP({ producto: 'PT-008', cantidad: cantidadPlan('PT-008'), iniPlan: sumarDias(d, 1), finPlan: sumarDias(d, 1), linea: 'L-B' });

  // Solicitudes de compra en distintos estados
  S.horaSim = '09:15';
  crearSolicitud({ area: 'Mantenimiento', material: 'MAT-019', cantidad: 40, motivo: 'Mantenimiento preventivo de prensas (pendiente de cotizar)', prioridad: 'Baja', solicitante: 'Mantenimiento (H. Cruz)', borrador: true });
  crearSolicitud({ area: 'Calidad', material: 'MAT-018', cantidad: 2000, motivo: 'Cambio de formato de etiqueta por requerimiento de cliente', prioridad: 'Media', solicitante: 'Calidad (M. Fuentes)' });
  crearSolicitud({ area: 'Producción', material: 'MAT-009', cantidad: 300, motivo: 'Inventario de seguridad para pedido especial de Caja Inteligente IoT', prioridad: 'Alta', solicitante: USUARIO_ROL['Producción'] });
  const scAut = crearSolicitud({ area: 'Producción', material: 'MAT-024', cantidad: 800, motivo: 'Nuevo diseño de Contenedor Apilable requiere más cinta', prioridad: 'Media', solicitante: USUARIO_ROL['Producción'] }).registro;
  autorizarSolicitud(scAut.folio, 'Autorizada; convertir esta semana');

  // un lote recibido en cuarentena por inspección
  const ocAbierta = S.ordenesCompra.find(o => ['Confirmada'].includes(o.estado) && S.embarques.some(e => e.oc === o.folio && e.estado === 'En tránsito' && e.eta <= sumarDias(d, 2)));
  if (ocAbierta) {
    const e = S.embarques.find(x => x.oc === ocAbierta.folio && x.estado === 'En tránsito');
    avanzarEmbarque(e.folio, 'Arribo anticipado');
    registrarRecepcion({ oc: ocAbierta.folio, embarque: e.folio, lineas: e.lineas.map(l => ({ material: l.material, recibido: l.cantidad, aceptado: l.cantidad, cuarentena: true })) });
  }

  // un pedido retenido que ya venció (atrasado al día base)
  S.relojSim = '2026-10-09';
  const pedAt = crearPedido({ cliente: 'CLI-002', lineas: [{ producto: 'PT-007', cantidad: 160 }], comprometida: '2026-10-12' }).registro;
  pedAt._retener = true;
  S.relojSim = d;
  reservarPedido(pedAt.folio);
}
