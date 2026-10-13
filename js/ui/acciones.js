// Acciones de usuario: cada una abre su formulario o confirmación y llama a la regla
// de negocio correspondiente. Las usan los módulos y el panel de documentos.
'use strict';

const ACCIONES = {};

// Botón de acción; se deshabilita si el rol de demostración no tiene permiso.
function btnAcc(accion, arg, texto, { clase = 'btn-sec btn-chico', permiso, ico } = {}) {
  const bloqueado = permiso && !puede(permiso);
  return `<button class="btn ${clase}" data-accion="${accion}" data-arg="${esc(arg ?? '')}" ${bloqueado ? `disabled title="Tu rol de demostración (${esc(S.rol)}) no tiene permiso"` : ''}>${ico ? icono(ico) : ''}${esc(texto)}</button>`;
}

const opsMateriales = () => S.materiales.map(m => [m.codigo, `${m.codigo} · ${m.descripcion}`]);
const opsProveedores = (cat) => S.proveedores.filter(p => p.estado === 'Activo' && (!cat || p.categorias.includes(cat))).map(p => [p.codigo, `${p.codigo} · ${p.razon}`]);
const opsProductos = () => S.productos.map(p => [p.codigo, `${p.codigo} · ${p.nombre}`]);

// ------------------------------------------------------------- solicitudes

ACCIONES['sc-nueva'] = (mat) => formulario({
  titulo: 'Crear solicitud de compra',
  intro: 'Registra una necesidad de material. Queda pendiente de autorización (o en borrador, si lo marcas).',
  campos: [
    { id: 'area', etiqueta: 'Área solicitante', tipo: 'select', opciones: AREAS, valor: 'Producción', requerido: true },
    { id: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', opciones: PRIORIDADES, valor: 'Media', requerido: true },
    { id: 'material', etiqueta: 'Material', tipo: 'select', opciones: opsMateriales(), valor: mat || '', vacio: 'Selecciona…', requerido: true, completo: true },
    { id: 'cantidad', etiqueta: 'Cantidad', tipo: 'number', min: 0.001, paso: 'any', requerido: true },
    { id: 'solicitante', etiqueta: 'Solicitante', valor: usuarioActual(), requerido: true },
    { id: 'motivo', etiqueta: 'Motivo', tipo: 'textarea', requerido: true },
    { id: 'borrador', etiqueta: 'Guardar como borrador (se podrá editar antes de enviarla)', tipo: 'checkbox' },
  ],
  calculo: true,
  alCambiar: v => {
    const m = material(v.material);
    if (!m) return 'Selecciona un material para ver el costo estimado.';
    const e = existencias(m.codigo);
    return `Unidad: <b>${m.unidad}</b> · costo ${fmt.mxn(m.costo)} · disponible ${fmt.cant(e.disponible, m.unidad)} (mín. ${fmt.cant(m.min, m.unidad)}) · en tránsito ${fmt.cant(enTransito(m.codigo), m.unidad)}<br>Costo estimado: <b>${fmt.mxn((Number(v.cantidad) || 0) * m.costo)}</b>`;
  },
  boton: 'Crear solicitud',
  alEnviar: crearSolicitud,
});

ACCIONES['sc-editar'] = folio => {
  const sc = buscarPor('solicitudes', folio);
  formulario({
    titulo: `Editar ${folio}`, intro: 'Sólo se editan solicitudes en borrador.',
    campos: [
      { id: 'area', etiqueta: 'Área', tipo: 'select', opciones: AREAS, valor: sc.area, requerido: true },
      { id: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', opciones: PRIORIDADES, valor: sc.prioridad, requerido: true },
      { id: 'material', etiqueta: 'Material', tipo: 'select', opciones: opsMateriales(), valor: sc.material, requerido: true, completo: true },
      { id: 'cantidad', etiqueta: 'Cantidad', tipo: 'number', min: 0.001, paso: 'any', valor: sc.cantidad, requerido: true },
      { id: 'motivo', etiqueta: 'Motivo', tipo: 'textarea', valor: sc.motivo, requerido: true },
    ],
    boton: 'Guardar cambios', alEnviar: v => editarSolicitud(folio, v),
  });
};
ACCIONES['sc-enviar'] = f => operar(enviarSolicitud(f));
ACCIONES['sc-autorizar'] = f => formulario({ titulo: `Autorizar ${f}`, campos: [{ id: 'c', etiqueta: 'Comentario (opcional)', tipo: 'textarea' }], boton: 'Autorizar', alEnviar: v => autorizarSolicitud(f, v.c) });
ACCIONES['sc-rechazar'] = f => formulario({ titulo: `Rechazar ${f}`, campos: [{ id: 'm', etiqueta: 'Motivo del rechazo', tipo: 'textarea', requerido: true }], boton: 'Rechazar', alEnviar: v => rechazarSolicitud(f, v.m) });
ACCIONES['sc-comentar'] = f => formulario({ titulo: `Comentar ${f}`, campos: [{ id: 't', etiqueta: 'Comentario', tipo: 'textarea', requerido: true }], boton: 'Agregar comentario', alEnviar: v => comentarSolicitud(f, v.t) });
ACCIONES['sc-convertir'] = f => {
  const sc = buscarPor('solicitudes', f);
  const m = material(sc.material);
  formulario({
    titulo: `Convertir ${f} en orden de compra`,
    intro: `${fmt.cant(sc.cantidad, m.unidad)} de ${esc(m.descripcion)}. La orden conservará el folio de origen.`,
    campos: [
      { id: 'proveedor', etiqueta: 'Proveedor', tipo: 'select', opciones: opsProveedores(m.categoria), valor: m.proveedor, requerido: true, completo: true },
      { id: 'precio', etiqueta: `Precio unitario (MXN por ${m.unidad})`, tipo: 'number', min: 0.0001, paso: 'any', valor: m.costo, requerido: true },
    ],
    calculo: true,
    alCambiar: v => `Subtotal ${fmt.mxn(sc.cantidad * (Number(v.precio) || 0))} · referencia ${fmt.mxn(m.precioRef)} (${fmt.pct(100 * ((Number(v.precio) || 0) - m.precioRef) / m.precioRef, 1)})`,
    boton: 'Generar orden de compra', alEnviar: v => convertirSolicitud(f, { proveedor: v.proveedor, precio: Number(v.precio) }),
  });
};

// ---------------------------------------------------------- órdenes de compra

function calculoOC(v) {
  const lineas = (v.lineas || []).filter(l => material(l.material) && Number(l.cantidad) > 0);
  const sub = suma(lineas, l => l.cantidad * (Number(l.precio) || material(l.material).costo));
  const prov = proveedor(v.proveedor);
  const flete = v.transporte !== '' && v.transporte != null ? Number(v.transporte) || 0 : (prov && lineas.length ? estimarFlete(prov, pesoLineas(lineas.map(l => ({ material: l.material, cantidad: Number(l.cantidad) })))) : 0);
  return `Subtotal <b>${fmt.mxn(sub)}</b> · IVA ${fmt.pct(S.config.iva * 100, 0)} ${fmt.mxn(sub * S.config.iva)} · flete estimado ${fmt.mxn(flete)} · <b>Total ${fmt.mxn(sub * (1 + S.config.iva) + flete)}</b>${prov ? `<br>Entrega estimada: ${fmt.fecha(sumarDias(hoy(), prov.lead))} (${prov.lead} días)` : ''}`;
}

ACCIONES['oc-nueva'] = (mat) => {
  const m = mat && material(mat);
  formulario({
    titulo: 'Crear orden de compra', ancho: true,
    intro: 'Agrega o quita materiales; los totales se calculan solos. Deja el precio vacío para usar el costo vigente.',
    campos: [
      { id: 'proveedor', etiqueta: 'Proveedor', tipo: 'select', opciones: opsProveedores(), valor: m ? m.proveedor : '', vacio: 'Selecciona…', requerido: true },
      { id: 'transporte', etiqueta: 'Costo de transporte estimado (opcional)', tipo: 'number', min: 0, paso: 'any' },
      { id: 'lineas', etiqueta: 'Materiales', tipo: 'lineas', filas: m ? [{ material: m.codigo, cantidad: Math.max(1, Math.ceil(m.max - existencias(m.codigo).fisica)), precio: m.costo }] : [], columnas: [
        { id: 'material', etiqueta: 'Material', tipo: 'select', opciones: opsMateriales() },
        { id: 'cantidad', etiqueta: 'Cantidad' }, { id: 'precio', etiqueta: 'Precio unitario' },
      ] },
    ],
    calculo: true, alCambiar: calculoOC, boton: 'Emitir orden',
    alEnviar: v => crearOrdenCompra({ proveedor: v.proveedor, transporteEst: v.transporte, lineas: v.lineas.map(l => ({ material: l.material, cantidad: Number(l.cantidad), precio: Number(l.precio) || (material(l.material) || {}).costo })) }),
  });
};

ACCIONES['oc-editar'] = f => {
  const oc = buscarPor('ordenesCompra', f);
  formulario({
    titulo: `Materiales de ${f}`, ancho: true,
    campos: [{ id: 'lineas', etiqueta: 'Materiales', tipo: 'lineas', filas: oc.lineas, columnas: [
      { id: 'material', etiqueta: 'Material', tipo: 'select', opciones: opsMateriales() }, { id: 'cantidad', etiqueta: 'Cantidad' }, { id: 'precio', etiqueta: 'Precio unitario' }] }],
    calculo: true, alCambiar: v => calculoOC({ ...v, proveedor: oc.proveedor, transporte: oc.transporteEst }), boton: 'Guardar',
    alEnviar: v => editarLineasOC(f, v.lineas),
  });
};
ACCIONES['oc-enviar'] = f => operar(enviarOC(f));
ACCIONES['oc-confirmar'] = f => {
  const oc = buscarPor('ordenesCompra', f);
  formulario({ titulo: `Registrar confirmación del proveedor · ${f}`, campos: [{ id: 'fecha', etiqueta: 'Fecha de entrega confirmada', tipo: 'date', valor: oc.fechaPrometida, requerido: true }], boton: 'Confirmar', alEnviar: v => confirmarOC(f, v.fecha) });
};
ACCIONES['oc-condiciones'] = f => {
  const oc = buscarPor('ordenesCompra', f);
  formulario({
    titulo: `Simular cambio de precio o plazo · ${f}`, intro: 'Registra un cambio comunicado por el proveedor. Queda en la auditoría.',
    campos: [...oc.lineas.map(l => ({ id: 'p_' + l.material, etiqueta: `Precio ${material(l.material).descripcion}`, tipo: 'number', min: 0.0001, paso: 'any', valor: l.precio })),
      { id: 'fecha', etiqueta: 'Nueva fecha prometida', tipo: 'date', valor: oc.fechaPrometida }],
    boton: 'Aplicar cambio',
    alEnviar: v => cambiarCondicionesOC(f, { precios: Object.fromEntries(oc.lineas.map(l => [l.material, Number(v['p_' + l.material])])), fechaPrometida: v.fecha }),
  });
};
ACCIONES['oc-cancelar'] = f => formulario({ titulo: `Cancelar ${f}`, intro: 'Esta acción no se puede deshacer.', campos: [{ id: 'm', etiqueta: 'Motivo de la cancelación', tipo: 'textarea', requerido: true }], boton: 'Cancelar orden', alEnviar: v => cancelarOC(f, v.m) });

ACCIONES['oc-embarque'] = f => {
  const oc = buscarPor('ordenesCompra', f);
  const prov = proveedor(oc.proveedor);
  const pend = oc.lineas.map(l => ({ material: l.material, cantidad: l.cantidad - l.recibido })).filter(l => l.cantidad > 0);
  const peso = pesoLineas(pend);
  formulario({
    titulo: `Programar embarque · ${f}`, intro: `${esc(prov.razon)} · ${esc(prov.zona)} → planta. Peso estimado ${fmt.num(peso)} kg.`,
    campos: [
      { id: 'transportista', etiqueta: 'Transportista', tipo: 'select', opciones: S.transportistas.map(t => [t.codigo, `${t.nombre} · ${t.vehiculo} (${fmt.num(t.capacidadKg)} kg)`]), valor: elegirTransportista(peso).codigo, requerido: true, completo: true },
      { id: 'salida', etiqueta: 'Fecha de salida', tipo: 'date', valor: hoy() > sumarDias(oc.fechaPrometida, -1) ? hoy() : sumarDias(oc.fechaPrometida, -1), requerido: true },
      { id: 'eta', etiqueta: 'Llegada estimada', tipo: 'date', valor: oc.fechaPrometida >= hoy() ? oc.fechaPrometida : sumarDias(hoy(), 1), requerido: true },
      { id: 'pallets', etiqueta: 'Tarimas', tipo: 'number', min: 1, paso: 1, valor: Math.max(1, Math.ceil(peso / 600)) },
    ],
    calculo: true,
    alCambiar: v => { const t = transportista(v.transportista); return t ? `Costo del flete: <b>${fmt.mxn(t.base + t.porKm * prov.km)}</b> (${fmt.mxn(t.base)} base + ${fmt.num(prov.km)} km × ${fmt.mxn(t.porKm)}) · capacidad ${peso <= t.capacidadKg ? 'suficiente' : '<b style="color:var(--rojo)">insuficiente</b>'}` : ''; },
    boton: 'Programar', alEnviar: v => programarEmbarque({ oc: f, ...v }),
  });
};

ACCIONES['oc-recibir'] = f => {
  const oc = buscarPor('ordenesCompra', f);
  const emb = S.embarques.find(e => e.oc === f && !['Entregado', 'Cancelado'].includes(e.estado));
  const pend = oc.lineas.filter(l => l.cantidad - l.recibido > 0);
  formulario({
    titulo: `Registrar recepción e inspección · ${f}`, ancho: true,
    intro: `${emb ? `Embarque ${emb.folio}. ` : ''}Sólo lo <b>aceptado</b> en la inspección entra al inventario. Marca cuarentena si el lote requiere análisis antes de usarse.`,
    campos: pend.flatMap(l => {
      const m = material(l.material);
      const p = redondear(l.cantidad - l.recibido, 3);
      return [
        { id: 'r_' + l.material, etiqueta: `${m.descripcion}: recibido (${m.unidad}, pendiente ${fmt.num(p, 2)})`, tipo: 'number', min: 0, max: p, paso: 'any', valor: p },
        { id: 'a_' + l.material, etiqueta: 'Aceptado en inspección', tipo: 'number', min: 0, paso: 'any', valor: p },
        { id: 'q_' + l.material, etiqueta: `Enviar ${m.descripcion} a cuarentena`, tipo: 'checkbox', completo: true },
      ];
    }),
    calculo: true,
    alCambiar: v => {
      const rech = suma(pend, l => (Number(v['r_' + l.material]) || 0) - (Number(v['a_' + l.material]) || 0));
      return rech > 0 ? `Se rechazarán <b>${fmt.num(rech, 2)}</b> unidades; quedan registradas y se abre una incidencia.` : 'Sin rechazos.';
    },
    boton: 'Registrar recepción',
    alEnviar: v => registrarRecepcion({ oc: f, embarque: emb && emb.folio, lineas: pend.map(l => ({ material: l.material, recibido: v['r_' + l.material], aceptado: v['a_' + l.material], cuarentena: v['q_' + l.material] })) }),
  });
};

// ---------------------------------------------------------------- embarques

ACCIONES['emb-avanzar'] = f => operar(avanzarEmbarque(f));
ACCIONES['emb-retraso'] = f => formulario({ titulo: `Registrar retraso · ${f}`, campos: [
  { id: 'd', etiqueta: 'Días de retraso', tipo: 'number', min: 1, max: 30, paso: 1, valor: 2, requerido: true },
  { id: 'c', etiqueta: 'Causa', tipo: 'select', opciones: ['Retraso del proveedor', 'Daño durante el transporte', 'Error documental'], requerido: true },
  { id: 'm', etiqueta: 'Motivo', tipo: 'textarea', requerido: true }], boton: 'Registrar', alEnviar: v => registrarRetrasoEmbarque(f, v.d, v.m, v.c) });
ACCIONES['emb-incidencia'] = f => formulario({ titulo: `Reportar incidencia · ${f}`, campos: [
  { id: 't', etiqueta: 'Tipo', tipo: 'select', opciones: ['Daño en la carga', 'Pérdida de bultos', 'Documentación incompleta'], requerido: true },
  { id: 'd', etiqueta: 'Descripción', tipo: 'textarea', requerido: true }], boton: 'Reportar', alEnviar: v => reportarIncidenciaEmbarque(f, v.t, v.d) });
ACCIONES['emb-recibir'] = f => ACCIONES['oc-recibir'](buscarPor('embarques', f).oc);

// --------------------------------------------------------------- inventario

ACCIONES['lote-estado'] = l => {
  const lote = S.lotes.find(x => x.lote === l);
  formulario({ titulo: `Cambiar estado del lote ${l}`, intro: `Estado actual: ${lote.estado}.`, campos: [
    { id: 'e', etiqueta: 'Nuevo estado', tipo: 'select', opciones: ['Disponible', 'Cuarentena', 'Dañado'].filter(x => x !== lote.estado), requerido: true },
    { id: 'm', etiqueta: 'Motivo', tipo: 'textarea', requerido: true }], boton: 'Aplicar', alEnviar: v => cambiarEstadoLote(l, v.e, v.m) });
};
ACCIONES['lote-ajuste'] = l => {
  const lote = S.lotes.find(x => x.lote === l);
  const m = material(lote.material);
  formulario({ titulo: `Ajuste de inventario · ${l}`, intro: `${esc(m.descripcion)} · existencia ${fmt.cant(lote.cantidad, m.unidad)} · reservado ${fmt.cant(lote.reservada, m.unidad)}. El ajuste crea un movimiento auditable; no modifica el historial.`, campos: [
    { id: 'c', etiqueta: `Cantidad a ajustar (${m.unidad}, negativa para restar)`, tipo: 'number', paso: 'any', requerido: true },
    { id: 'm', etiqueta: 'Motivo', tipo: 'textarea', requerido: true }], boton: 'Revisar ajuste',
    alEnviar: v => {
      confirmar(`¿Aplicar un ajuste de ${v.c > 0 ? '+' : ''}${v.c} ${m.unidad} al lote ${l}?`, { titulo: 'Ajuste crítico', boton: 'Aplicar ajuste', peligro: true })
        .then(si => { if (si) operar(registrarAjuste({ lote: l, cantidad: v.c, motivo: v.m })); });
      return { ok: true };
    } });
};
ACCIONES['lote-conteo'] = l => {
  const lote = S.lotes.find(x => x.lote === l);
  const m = material(lote.material);
  formulario({ titulo: `Conteo físico · ${l}`, intro: `${esc(m.descripcion)}. Captura lo que contaste; el sistema compara contra el teórico.`, campos: [
    { id: 'f', etiqueta: `Cantidad contada (${m.unidad})`, tipo: 'number', min: 0, paso: 'any', requerido: true }], boton: 'Registrar conteo', alEnviar: v => registrarConteo({ lote: l, fisico: v.f }) });
};
ACCIONES['conteo-ajustar'] = f => confirmar(`¿Aplicar el ajuste del conteo ${f}?`, { titulo: 'Ajuste por conteo', boton: 'Aplicar', peligro: true }).then(si => si && operar(aplicarAjusteConteo(f)));

// --------------------------------------------------------------- suministro

ACCIONES['sum-nueva'] = op => {
  const r = crearSuministro(op);
  operar(r);
  if (r.ok && r.faltantes && r.faltantes.length) ofrecerCompraFaltantes(r.faltantes, op);
};
function ofrecerCompraFaltantes(faltantes, ref) {
  confirmar(`Faltan: ${faltantes.map(f => `${fmt.cant(f.cantidad, material(f.material).unidad)} de ${material(f.material).descripcion}`).join('; ')}. ¿Generar solicitudes de compra para cubrirlo?`, { titulo: 'Material insuficiente', boton: 'Generar propuesta' })
    .then(si => { if (si) operar(proponerCompraFaltantes(faltantes, ref)); });
}
ACCIONES['sum-preparar'] = f => operar(prepararSuministro(f));
ACCIONES['sum-surtir'] = f => {
  const s = buscarPor('suministros', f);
  const lin = s.lineas.filter(l => l.solicitado - l.surtido > 0);
  formulario({
    titulo: `Surtir ${f} → ${s.op}`, ancho: true,
    intro: 'Se surte primero lo reservado y después los lotes más antiguos (PEPS/FIFO). No se puede entregar más de lo disponible.',
    campos: lin.map(l => {
      const m = material(l.material);
      const pend = redondear(l.solicitado - l.surtido, 3);
      const posible = redondear(suma(l.reservas, r => r.cantidad) + existencias(l.material).disponible, 3);
      return { id: l.material, etiqueta: `${m.descripcion} (pendiente ${fmt.num(pend, 2)} ${m.unidad} · disponible ${fmt.num(posible, 2)})`, tipo: 'number', min: 0, max: Math.min(pend, posible), paso: 'any', valor: Math.min(pend, posible) };
    }),
    boton: 'Surtir',
    alEnviar: v => {
      const r = surtirSuministro(f, Object.fromEntries(lin.map(l => [l.material, Number(v[l.material])])));
      if (r.faltantes && r.faltantes.length) setTimeout(() => ofrecerCompraFaltantes(r.faltantes, s.op), 300);
      return r;
    },
  });
};
ACCIONES['sum-devolver'] = f => {
  const s = buscarPor('suministros', f);
  formulario({ titulo: `Devolver material no utilizado · ${f}`, campos: [
    { id: 'm', etiqueta: 'Material', tipo: 'select', opciones: s.lineas.filter(l => l.surtido - l.devuelto > 0).map(l => [l.material, `${material(l.material).descripcion} (surtido ${fmt.num(l.surtido - l.devuelto, 2)})`]), requerido: true, completo: true },
    { id: 'c', etiqueta: 'Cantidad', tipo: 'number', min: 0.001, paso: 'any', requerido: true },
    { id: 'r', etiqueta: 'Motivo', tipo: 'textarea', requerido: true }], boton: 'Registrar devolución', alEnviar: v => devolverMaterial(f, v.m, v.c, v.r) });
};
ACCIONES['sum-cancelar'] = f => confirmar(`¿Cancelar ${f}? Se liberan las reservas; lo ya surtido se queda en la línea.`, { titulo: 'Cancelar solicitud de suministro', boton: 'Cancelar solicitud', peligro: true }).then(si => si && operar(cancelarSuministro(f)));

// --------------------------------------------------------------- producción

ACCIONES['op-nueva'] = (prod) => formulario({
  titulo: 'Crear orden de producción',
  campos: [
    { id: 'producto', etiqueta: 'Producto', tipo: 'select', opciones: opsProductos(), valor: prod || 'PT-001', requerido: true, completo: true },
    { id: 'cantidad', etiqueta: 'Cantidad planificada', tipo: 'number', min: 1, paso: 1, valor: 100, requerido: true },
    { id: 'linea', etiqueta: 'Línea', tipo: 'select', opciones: S.lineas.map(l => [l.codigo, l.nombre]), valor: producto(prod || 'PT-001').linea, requerido: true },
    { id: 'iniPlan', etiqueta: 'Inicio planificado', tipo: 'date', valor: hoy(), requerido: true },
    { id: 'finPlan', etiqueta: 'Fin planificado', tipo: 'date', valor: hoy(), requerido: true },
    { id: 'responsable', etiqueta: 'Responsable', valor: USUARIO_ROL['Producción'], requerido: true },
  ],
  calculo: true,
  alCambiar: (v, form) => {
    const p = producto(v.producto);
    if (!p) return '';
    const q = Number(v.cantidad) || 0;
    const filas = Object.entries(p.bom).map(([m, x]) => { const req = x * q, d = existencias(m).disponible; return `<tr><td>${esc(material(m).descripcion)}</td><td class="num">${fmt.cant(req, material(m).unidad)}</td><td class="num">${fmt.cant(d, material(m).unidad)}</td><td>${d >= req ? pill('Suficiente', 'bien') : pill('Falta ' + fmt.num(req - d, 1), 'critico')}</td></tr>`; }).join('');
    const min = q * p.tEst, cap = linea(v.linea) ? linea(v.linea).minutosDia : 960;
    return `Tiempo estándar ${fmt.num(min)} min (≈ ${fmt.num(min / cap, 1)} días de línea)<div class="tabla-cont" style="margin-top:6px"><table><thead><tr><th>Material requerido</th><th class="num">Requiere</th><th class="num">Disponible</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>`;
  },
  boton: 'Crear orden', alEnviar: crearOP,
});

ACCIONES['op-iniciar'] = f => {
  const op = buscarPor('ordenesProduccion', f);
  const faltan = requerimientosOP(op).filter(r => r.pendiente > 1e-6);
  if (!faltan.length) { operar(iniciarOP(f)); return; }
  if (!puede('excepcion')) { aviso(`No puede iniciar: faltan por surtir ${faltan.map(x => material(x.material).descripcion).join(', ')}.`, 'mal'); return; }
  formulario({
    titulo: `${f} no tiene todo su material`, intro: `Faltan por surtir: ${faltan.map(x => `${fmt.cant(x.pendiente, material(x.material).unidad)} de ${esc(material(x.material).descripcion)}`).join('; ')}. Sólo el administrador puede iniciar por excepción y queda auditado.`,
    campos: [{ id: 'm', etiqueta: 'Motivo de la excepción', tipo: 'textarea', requerido: true }],
    boton: 'Iniciar por excepción', alEnviar: v => iniciarOP(f, { excepcion: true, motivo: v.m }),
  });
};
ACCIONES['op-pausar'] = f => formulario({ titulo: `Registrar paro · ${f}`, campos: [
  { id: 'causa', etiqueta: 'Causa', tipo: 'select', opciones: CAUSAS_PARO, requerido: true },
  { id: 'minutos', etiqueta: 'Minutos de paro', tipo: 'number', min: 0, paso: 1, valor: 30, requerido: true },
  { id: 'incidencia', etiqueta: 'Registrar también como incidencia (paro de maquinaria)', tipo: 'checkbox' }], boton: 'Pausar orden', alEnviar: v => pausarOP(f, v) });
ACCIONES['op-reanudar'] = f => operar(reanudarOP(f));
ACCIONES['op-completar'] = f => {
  const op = buscarPor('ordenesProduccion', f);
  recalcularOP(op);
  confirmar(`Terminar ${f} con ${fmt.num(op.aceptada)} unidades aceptadas de ${fmt.num(op.planificada)} planificadas. Se generará el lote de producto terminado.`, { titulo: 'Completar fabricación', boton: 'Terminar orden' }).then(si => si && operar(completarOP(f)));
};
ACCIONES['op-cancelar'] = f => formulario({ titulo: `Cancelar ${f}`, intro: 'Se liberan las reservas de material.', campos: [{ id: 'm', etiqueta: 'Motivo', tipo: 'textarea', requerido: true }], boton: 'Cancelar orden', alEnviar: v => cancelarOP(f, v.m) });

ACCIONES['ope-avance'] = f => {
  const o = buscarPor('operaciones', f);
  const disp = entradaPendiente(o);
  formulario({
    titulo: `Registrar avance · ${o.operacion}`, intro: `${o.op} · le llegan <b>${fmt.num(disp)}</b> unidades pendientes. Tiempo estándar ${fmt.num(o.tEstUnit, 2)} min por unidad.`,
    campos: [
      { id: 'procesadas', etiqueta: 'Unidades procesadas', tipo: 'number', min: 1, max: disp, paso: 1, valor: disp, requerido: true },
      { id: 'rechazadas', etiqueta: 'Unidades rechazadas', tipo: 'number', min: 0, paso: 1, valor: 0 },
      { id: 'causa', etiqueta: 'Causa del defecto (si hay rechazo)', tipo: 'select', opciones: CAUSAS_DEFECTO, vacio: '—' },
      { id: 'minutos', etiqueta: 'Minutos reales', tipo: 'number', min: 0, paso: 'any', valor: Math.round(disp * o.tEstUnit * 1.05) },
      { id: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
    ],
    calculo: true,
    alCambiar: v => { const p = Number(v.procesadas) || 0, r = Number(v.rechazadas) || 0, m = Number(v.minutos) || 0; return `Aceptadas: <b>${fmt.num(p - r)}</b> · rendimiento de la etapa ${m ? fmt.pct(100 * p * o.tEstUnit / m) : '—'}`; },
    boton: 'Registrar avance', alEnviar: v => registrarAvance(f, v),
  });
};
ACCIONES['ope-iniciar'] = f => operar(cambiarEstadoOperacion(f, 'En proceso'));
ACCIONES['ope-pausar'] = f => operar(cambiarEstadoOperacion(f, 'Pausada'));
ACCIONES['ope-inspeccion'] = f => formulario({ titulo: 'Registrar inspección de calidad', campos: [{ id: 't', etiqueta: 'Resultado de la inspección', tipo: 'textarea', requerido: true }], boton: 'Registrar', alEnviar: v => registrarInspeccion(f, v.t) });

// ------------------------------------------------------- producto terminado

ACCIONES['lpt-bloquear'] = l => formulario({ titulo: `Bloquear lote ${l}`, campos: [{ id: 'm', etiqueta: 'Motivo (incidencia de calidad)', tipo: 'textarea', requerido: true }], boton: 'Bloquear', alEnviar: v => cambiarCalidadLotePT(l, 'Bloqueado', v.m) });
ACCIONES['lpt-liberar'] = l => formulario({ titulo: `Liberar lote ${l}`, campos: [{ id: 'm', etiqueta: 'Resultado de la reinspección', tipo: 'textarea', requerido: true }], boton: 'Liberar', alEnviar: v => cambiarCalidadLotePT(l, 'Aprobado', v.m) });
ACCIONES['lpt-transferir'] = l => formulario({ titulo: `Transferir lote ${l}`, campos: [{ id: 'u', etiqueta: 'Ubicación destino', valor: 'PT-', requerido: true }], boton: 'Transferir', alEnviar: v => transferirLotePT(l, v.u) });

// ------------------------------------------------------------------ pedidos

ACCIONES['ped-nuevo'] = () => formulario({
  titulo: 'Crear pedido de cliente', ancho: true,
  campos: [
    { id: 'cliente', etiqueta: 'Cliente', tipo: 'select', opciones: S.clientes.map(c => [c.codigo, `${c.nombre} · ${c.zona}`]), vacio: 'Selecciona…', requerido: true },
    { id: 'comprometida', etiqueta: 'Fecha comprometida', tipo: 'date', valor: sumarDias(hoy(), 4), requerido: true },
    { id: 'costo', etiqueta: 'Costo de envío (vacío = estimado por distancia)', tipo: 'number', min: 0, paso: 'any' },
    { id: 'lineas', etiqueta: 'Productos', tipo: 'lineas', columnas: [{ id: 'producto', etiqueta: 'Producto', tipo: 'select', opciones: opsProductos() }, { id: 'cantidad', etiqueta: 'Cantidad' }] },
  ],
  calculo: true,
  alCambiar: v => (v.lineas || []).filter(l => producto(l.producto)).map(l => { const d = disponiblePT(l.producto); const q = Number(l.cantidad) || 0; return `${esc(producto(l.producto).nombre)}: disponible ${fmt.num(d)} ${d >= q ? pill('Alcanza', 'bien') : pill('Faltan ' + fmt.num(q - d), 'alerta')}`; }).join('<br>') || 'Agrega productos para validar disponibilidad.',
  boton: 'Registrar pedido',
  alEnviar: v => crearPedido({ cliente: v.cliente, comprometida: v.comprometida, costoEnvio: v.costo, lineas: v.lineas }),
});
ACCIONES['ped-reservar'] = f => operar(reservarPedido(f));
ACCIONES['ped-preparar'] = f => operar(prepararPedido(f));
ACCIONES['ped-despachar'] = f => {
  const r = despacharPedido(f);
  if (r.requiereConfirmacion) confirmar(r.mensaje, { titulo: 'Pedido incompleto', boton: 'Despachar incompleto', peligro: true }).then(si => si && operar(despacharPedido(f, { permitirIncompleto: true })));
  else operar(r);
};
ACCIONES['ped-entregar'] = f => formulario({ titulo: `Registrar entrega · ${f}`, campos: [{ id: 'fecha', etiqueta: 'Fecha de entrega', tipo: 'date', valor: hoy(), requerido: true }], boton: 'Registrar entrega', alEnviar: v => entregarPedido(f, v.fecha) });
ACCIONES['ped-retraso'] = f => formulario({ titulo: `Simular retraso · ${f}`, campos: [{ id: 'd', etiqueta: 'Días de retraso estimado', tipo: 'number', min: 1, paso: 1, valor: 2, requerido: true }, { id: 'm', etiqueta: 'Motivo', tipo: 'textarea', requerido: true }], boton: 'Registrar', alEnviar: v => simularRetrasoPedido(f, v.d, v.m) });
ACCIONES['ped-devolucion'] = f => {
  const p = buscarPor('pedidos', f);
  formulario({ titulo: `Devolución de cliente · ${f}`, campos: [
    { id: 'p', etiqueta: 'Producto', tipo: 'select', opciones: p.lineas.filter(l => l.despachada - l.devuelta > 0).map(l => [l.producto, `${producto(l.producto).nombre} (entregadas ${l.despachada - l.devuelta})`]), requerido: true, completo: true },
    { id: 'c', etiqueta: 'Cantidad', tipo: 'number', min: 1, paso: 1, requerido: true },
    { id: 'm', etiqueta: 'Motivo', tipo: 'textarea', requerido: true }], boton: 'Registrar devolución', alEnviar: v => devolucionPedido(f, v.p, v.c, v.m) });
};
ACCIONES['ped-cancelar'] = f => formulario({ titulo: `Cancelar ${f}`, campos: [{ id: 'm', etiqueta: 'Motivo', tipo: 'textarea', requerido: true }], boton: 'Cancelar pedido', alEnviar: v => cancelarPedido(f, v.m) });

// -------------------------------------------------------------- incidencias

ACCIONES['inc-nueva'] = (op) => formulario({
  titulo: 'Registrar incidencia', ancho: true,
  campos: [
    { id: 'area', etiqueta: 'Área', tipo: 'select', opciones: AREAS, requerido: true },
    { id: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: TIPOS_INCIDENCIA, requerido: true },
    { id: 'operacion', etiqueta: 'Operación relacionada (folio)', valor: op || '' },
    { id: 'severidad', etiqueta: 'Severidad', tipo: 'select', opciones: SEVERIDADES, valor: 'Media', requerido: true },
    { id: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', requerido: true },
    { id: 'impacto', etiqueta: 'Impacto estimado' },
    { id: 'responsable', etiqueta: 'Responsable', valor: usuarioActual(), requerido: true },
    { id: 'accion', etiqueta: 'Acción correctiva' },
    { id: 'compromiso', etiqueta: 'Fecha compromiso', tipo: 'date', valor: sumarDias(hoy(), 3), requerido: true },
    { id: 'evidencia', etiqueta: 'Evidencia o comentario', tipo: 'textarea' },
  ],
  boton: 'Registrar', alEnviar: v => crearIncidencia(v),
});
ACCIONES['inc-actualizar'] = f => {
  const i = buscarPor('incidencias', f);
  formulario({ titulo: `Actualizar ${f}`, campos: [
    { id: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ['Abierta', 'En atención', 'Resuelta', 'Cerrada'], valor: i.estado, requerido: true },
    { id: 'severidad', etiqueta: 'Severidad', tipo: 'select', opciones: SEVERIDADES, valor: i.severidad },
    { id: 'responsable', etiqueta: 'Responsable', valor: i.responsable },
    { id: 'compromiso', etiqueta: 'Fecha compromiso', tipo: 'date', valor: i.compromiso },
    { id: 'accion', etiqueta: 'Acción correctiva', tipo: 'textarea', valor: i.accion },
    { id: 'evidencia', etiqueta: 'Evidencia o comentario', tipo: 'textarea', valor: i.evidencia }], boton: 'Guardar', alEnviar: v => actualizarIncidencia(f, v) });
};

// ------------------------------------------------------------ navegación

ACCIONES['ir'] = m => { location.hash = '#' + m; };
ACCIONES['doc'] = f => abrirDocumento(f);

function enlazarAcciones(raiz) {
  raiz.addEventListener('click', e => {
    const b = e.target.closest('[data-accion]');
    if (b && !b.disabled) {
      e.preventDefault();
      const fn = ACCIONES[b.dataset.accion];
      if (fn) fn(b.dataset.arg || undefined);
      return;
    }
    const d = e.target.closest('[data-doc]');
    if (d) { e.preventDefault(); abrirDocumento(d.dataset.doc); }
  });
}
