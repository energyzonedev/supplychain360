// Panel lateral de documento: datos, relaciones navegables (trazabilidad de punta a
// punta), historial y acciones disponibles según el estado.
'use strict';

let docAbierto = null;

const campo = (etq, val) => `<div><span>${esc(etq)}</span>${val}</div>`;
const seccion = (titulo, html) => html ? `<section><div class="seccion-tit">${esc(titulo)}</div>${html}</section>` : '';
const relaciones = folios => { const f = [...new Set(folios.filter(Boolean))]; return f.length ? `<div class="relaciones">${f.map(docLink).join('')}</div>` : ''; };
const tablaSimple = (cab, filas) => filas.length ? `<div class="tabla-cont"><table><thead><tr>${cab.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.t || c)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((v, i) => `<td class="${cab[i].num ? 'num' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="vacio">Sin registros.</p>';
const timeline = eventos => eventos.length ? `<ul class="linea-tiempo">${eventos.slice().reverse().map(e => `<li class="${/rechaz|retras|cancel|incid|paro/i.test(e.accion || e.estado || '') ? 'mal' : ''}"><time>${fmt.fechaHora(e.fecha)} · ${esc(e.usuario || '')}</time><b>${esc(e.accion || e.estado)}</b>${e.detalle || e.nota ? ` — ${esc(e.detalle || e.nota)}` : ''}</li>`).join('')}</ul>` : '';

// Lo que depende de un documento, hacia adelante en la cadena.
function impactoAguasAbajo(folio) {
  const d = documento(folio);
  if (!d) return [];
  const r = [];
  const porMateriales = mats => {
    S.ordenesProduccion.filter(o => ['Planificada', 'Pendiente de materiales', 'Lista para iniciar'].includes(o.estado) && Object.keys(producto(o.producto).bom).some(m => mats.includes(m)))
      .forEach(o => r.push({ folio: o.folio, texto: `${producto(o.producto).nombre} · ${o.estado.toLowerCase()} · inicio ${fmt.fecha(o.iniPlan)}` }));
  };
  const porProductos = prods => S.pedidos.filter(p => !['Entregado', 'Cancelado', 'Despachado'].includes(p.estado) && p.lineas.some(l => prods.includes(l.producto)))
    .forEach(p => r.push({ folio: p.folio, texto: `${cliente(p.cliente).nombre} · compromiso ${fmt.fecha(p.comprometida)}` }));
  if (d.col === 'embarques' || d.col === 'ordenesCompra') {
    const oc = d.col === 'embarques' ? buscarPor('ordenesCompra', d.reg.oc) : d.reg;
    porMateriales(oc.lineas.map(l => l.material));
    porProductos(S.productos.filter(p => oc.lineas.some(l => p.bom[l.material])).map(p => p.codigo));
  } else if (d.col === 'ordenesProduccion') porProductos([d.reg.producto]);
  else if (d.col === 'lotes') porMateriales([d.reg.material]);
  else if (d.col === 'lotesPT') porProductos([d.reg.producto]);
  else if (d.col === 'materiales') { porMateriales([d.reg.codigo]); }
  const vistos = new Set();
  return r.filter(x => !vistos.has(x.folio) && vistos.add(x.folio)).slice(0, 12);
}

function abrirDocumento(folio) {
  const d = documento(folio);
  if (!d) { aviso(`No encontré ${folio}.`, 'mal'); return; }
  docAbierto = folio;
  const cont = document.getElementById('cajon');
  const { cuerpo, acciones, titulo } = renderDocumento(d);
  cont.innerHTML = `<div class="cajon-fondo" data-cerrar-cajon></div>
    <aside class="cajon" role="dialog" aria-label="${esc(d.tipo)} ${esc(folio)}">
      <div class="cajon-cab"><div><small>${esc(d.tipo)}</small><h2>${esc(titulo || folio)}</h2></div><button class="icono-btn" data-cerrar-cajon aria-label="Cerrar">${icono('cerrar')}</button></div>
      <div class="cajon-cuerpo">${acciones ? `<div class="acciones-fila">${acciones}</div>` : ''}${cuerpo}</div>
    </aside>`;
  cont.hidden = false;
  cont.querySelectorAll('[data-cerrar-cajon]').forEach(b => b.onclick = cerrarDocumento);
  cont.querySelector('.cajon-cab button').focus();
}

function cerrarDocumento() {
  const c = document.getElementById('cajon');
  c.hidden = true; c.innerHTML = ''; docAbierto = null;
}

function renderDocumento(d) {
  const r = d.reg;
  const imp = (folio) => {
    const l = impactoAguasAbajo(folio);
    return l.length ? seccion('Impacto potencial aguas abajo', `<ul class="lista-al">${l.map(x => `<li><button data-doc="${x.folio}"><span class="ic alerta">!</span><span><b>${x.folio}</b><small>${esc(x.texto)}</small></span></button></li>`).join('')}</ul>`) : '';
  };
  switch (d.col) {
    case 'solicitudes': {
      const m = material(r.material);
      let acc = '';
      if (r.estado === 'Borrador') acc += btnAcc('sc-editar', r.folio, 'Editar', { permiso: 'solicitud.crear' }) + btnAcc('sc-enviar', r.folio, 'Enviar a autorización', { clase: 'btn btn-chico', permiso: 'solicitud.crear' });
      if (r.estado === 'Pendiente de autorización') acc += btnAcc('sc-autorizar', r.folio, 'Autorizar', { clase: 'btn-verde btn-chico', permiso: 'solicitud.autorizar' }) + btnAcc('sc-rechazar', r.folio, 'Rechazar', { clase: 'btn-peligro btn-chico', permiso: 'solicitud.autorizar' });
      if (r.estado === 'Autorizada' && !r.oc) acc += btnAcc('sc-convertir', r.folio, 'Convertir en orden de compra', { clase: 'btn btn-chico', permiso: 'compra' });
      acc += btnAcc('sc-comentar', r.folio, 'Comentar');
      return { acciones: acc, cuerpo: `
        <div class="campos">${campo('Estado', pill(r.estado))}${campo('Prioridad', pill(r.prioridad))}${campo('Fecha', fmt.fecha(r.fecha))}${campo('Área solicitante', esc(r.area))}
        ${campo('Material', `${docLink(m.codigo)} ${esc(m.descripcion)}`)}${campo('Cantidad', fmt.cant(r.cantidad, r.unidad))}${campo('Costo estimado', fmt.mxn(r.costoEst))}${campo('Origen', esc(r.origen))}
        ${campo('Solicitante', esc(r.solicitante))}${campo('Responsable de autorización', esc(r.autorizador))}${campo('Autorizada', fmt.fechaHora(r.fechaAutorizacion))}${campo('Orden de compra', docLink(r.oc))}</div>
        ${seccion('Motivo', `<p>${esc(r.motivo)}</p>`)}
        ${seccion('Comentarios', r.comentarios.map(c => `<p><b>${esc(c.usuario)}</b> <span class="tenue">${fmt.fechaHora(c.fecha)}</span><br>${esc(c.texto)}</p>`).join(''))}
        ${seccion('Documentos relacionados', relaciones([r.oc, ...(r.oc ? S.embarques.filter(e => e.oc === r.oc).map(e => e.folio) : [])]))}
        ${seccion('Historial de cambios', timeline(r.historial))}` };
    }
    case 'ordenesCompra': {
      const t = totalesOC(r);
      const prov = proveedor(r.proveedor);
      const est = estadoOC(r);
      let acc = '';
      if (r.estado === 'Pendiente') acc += btnAcc('oc-editar', r.folio, 'Agregar o quitar materiales', { permiso: 'compra' }) + btnAcc('oc-enviar', r.folio, 'Enviar al proveedor', { clase: 'btn btn-chico', permiso: 'compra' });
      if (['Pendiente', 'Enviada'].includes(r.estado)) acc += btnAcc('oc-confirmar', r.folio, 'Registrar confirmación', { clase: 'btn btn-chico', permiso: 'compra' });
      if (['Enviada', 'Confirmada', 'Parcialmente recibida'].includes(r.estado) && !S.embarques.some(e => e.oc === r.folio && !['Entregado', 'Cancelado'].includes(e.estado))) acc += btnAcc('oc-embarque', r.folio, 'Programar embarque', { permiso: 'embarque' });
      if (['Enviada', 'Confirmada', 'Parcialmente recibida'].includes(r.estado)) acc += btnAcc('oc-recibir', r.folio, 'Registrar recepción', { clase: 'btn-verde btn-chico', permiso: 'recepcion' });
      if (OC_ABIERTA.includes(r.estado) && !r.lineas.some(l => l.recibido > 0)) acc += btnAcc('oc-condiciones', r.folio, 'Simular cambio de precio/plazo', { permiso: 'compra' }) + btnAcc('oc-cancelar', r.folio, 'Cancelar', { clase: 'btn-peligro btn-chico', permiso: 'compra' });
      const recs = S.recepciones.filter(x => x.oc === r.folio);
      const lotes = S.lotes.filter(l => l.oc === r.folio).map(l => l.lote);
      return { acciones: acc, cuerpo: `
        <div class="campos">${campo('Estado', pill(est))}${campo('Proveedor', `${docLink(prov.codigo)} ${esc(prov.razon)}`)}${campo('Solicitud de origen', docLink(r.solicitud))}${campo('Emisión', fmt.fecha(r.fechaEmision))}
        ${campo('Fecha prometida', fmt.fecha(r.fechaPrometida))}${campo('Recepción completa', fmt.fecha(r.fechaRecepcion))}${campo('Subtotal', fmt.mxn(t.subtotal))}${campo(`IVA (${fmt.pct(r.ivaPct * 100, 0)})`, fmt.mxn(t.iva))}${campo('Transporte estimado', fmt.mxn(t.transporte))}${campo('Total', `<b>${fmt.mxn(t.total)}</b>`)}</div>
        ${seccion('Materiales', tablaSimple([{ t: 'Material' }, { t: 'Cantidad', num: true }, { t: 'Precio', num: true }, { t: 'Importe', num: true }, { t: 'Recibido', num: true }, { t: 'Aceptado', num: true }, { t: 'Rechazado', num: true }],
          r.lineas.map(l => [`${docLink(l.material)} ${esc(material(l.material).descripcion)}`, fmt.cant(l.cantidad, material(l.material).unidad), fmt.mxn(l.precio), fmt.mxn(l.cantidad * l.precio), fmt.num(l.recibido, 2), fmt.num(l.aceptado, 2), fmt.num(l.rechazado, 2)])))}
        ${seccion('Documentos relacionados', relaciones([r.solicitud, ...S.embarques.filter(e => e.oc === r.folio).map(e => e.folio), ...recs.map(x => x.folio), ...lotes]))}
        ${OC_ABIERTA.includes(r.estado) ? imp(r.folio) : ''}
        ${seccion('Historial', timeline(r.historial))}` };
    }
    case 'embarques': {
      const est = estadoEmbarque(r);
      let acc = '';
      if (SIGUIENTE_EMB[r.estado]) acc += btnAcc('emb-avanzar', r.folio, `Pasar a «${SIGUIENTE_EMB[r.estado]}»`, { clase: 'btn btn-chico', permiso: 'embarque' });
      if (r.estado === 'En revisión de recepción') acc += btnAcc('emb-recibir', r.folio, 'Registrar recepción e inspección', { clase: 'btn-verde btn-chico', permiso: 'recepcion' });
      if (!['Entregado', 'Cancelado', 'En revisión de recepción'].includes(r.estado)) acc += btnAcc('emb-retraso', r.folio, 'Registrar retraso', { permiso: 'embarque' });
      if (!['Entregado', 'Cancelado'].includes(r.estado)) acc += btnAcc('emb-incidencia', r.folio, 'Reportar incidencia', { permiso: 'embarque' });
      const t = transportista(r.transportista);
      const dif = r.llegada ? diasEntre(r.etaOriginal, r.llegada) : null;
      return { acciones: acc, cuerpo: `
        <div class="campos">${campo('Estado', pill(est))}${campo('Orden de compra', docLink(r.oc))}${campo('Proveedor', `${docLink(r.proveedor)} ${esc(proveedor(r.proveedor).razon)}`)}${campo('Origen', esc(r.origen))}
        ${campo('Destino', esc(r.destino))}${campo('Transportista', esc(t.nombre))}${campo('Vehículo', `${esc(r.vehiculo)} · ${fmt.num(r.capacidadKg)} kg`)}${campo('Carga', `${fmt.num(r.pallets)} tarimas · ${fmt.num(r.pesoKg)} kg`)}
        ${campo('Salida', `${fmt.fecha(r.salida || r.salidaProgramada)}${r.salida ? '' : ' (programada)'}`)}${campo('Llegada estimada', `${fmt.fecha(r.eta)}${r.eta !== r.etaOriginal ? ` <span class="tenue">(original ${fmt.fecha(r.etaOriginal)})</span>` : ''}`)}
        ${campo('Llegada real', r.llegada ? `${fmt.fecha(r.llegada)} ${dif > 0 ? pill(`${dif} días tarde`, 'critico') : pill('A tiempo', 'bien')}` : '—')}${campo('Costo del transporte', fmt.mxn(r.costo))}</div>
        ${seccion('Carga', tablaSimple([{ t: 'Material' }, { t: 'Cantidad', num: true }], r.lineas.map(l => [esc(material(l.material).descripcion), fmt.cant(l.cantidad, material(l.material).unidad)])))}
        ${seccion('Ruta', `<p><a href="${urlRuta(ciudadZona(r.origen), false)}" target="_blank" rel="noopener">Ver la ruta ${esc(ciudadZona(r.origen))} → planta en Google Maps ↗</a><br><small class="tenue">Ruta de referencia; no es rastreo GPS.</small></p>`)}
        ${seccion('Línea de tiempo del envío', timeline(r.eventos))}
        ${seccion('Documentos relacionados', relaciones([r.oc, buscarPor('ordenesCompra', r.oc).solicitud, r.recepcion, ...S.lotes.filter(l => l.origen === r.recepcion).map(l => l.lote), ...S.incidencias.filter(i => i.operacion === r.folio).map(i => i.folio)]))}
        ${r.estado !== 'Entregado' ? imp(r.folio) : ''}` };
    }
    case 'recepciones':
      return { cuerpo: `<div class="campos">${campo('Fecha', fmt.fecha(r.fecha))}${campo('Orden de compra', docLink(r.oc))}${campo('Embarque', docLink(r.embarque))}${campo('Inspector', esc(r.inspector))}</div>
        ${seccion('Inspección', tablaSimple([{ t: 'Material' }, { t: 'Recibido', num: true }, { t: 'Aceptado', num: true }, { t: 'Rechazado', num: true }, { t: 'Lote' }], r.lineas.map(l => [esc(material(l.material).descripcion), fmt.num(l.recibido, 2), fmt.num(l.aceptado, 2), fmt.num(l.rechazado, 2), docLink(l.lote) + (l.cuarentena ? ' ' + pill('Cuarentena') : '')])))}` };
    case 'lotes': {
      const m = material(r.material);
      const movs = S.movimientos.filter(x => x.lote === r.lote);
      const sums = [...new Set(movs.filter(x => x.tipo === 'Salida a producción').map(x => x.referencia))];
      const ops = sums.map(s => buscarPor('suministros', s)?.op).filter(Boolean);
      const lpts = ops.map(o => buscarPor('ordenesProduccion', o)?.lotePT).filter(Boolean);
      let acc = btnAcc('lote-estado', r.lote, 'Cambiar estado', { permiso: 'inventario' }) + btnAcc('lote-ajuste', r.lote, 'Ajuste', { permiso: 'inventario' }) + btnAcc('lote-conteo', r.lote, 'Conteo físico', { permiso: 'inventario' });
      return { acciones: acc, cuerpo: `<div class="campos">${campo('Material', `${docLink(m.codigo)} ${esc(m.descripcion)}`)}${campo('Estado', pill(r.estado))}${campo('Existencia física', fmt.cant(r.cantidad, m.unidad))}${campo('Reservada', fmt.cant(r.reservada, m.unidad))}
        ${campo('Disponible', fmt.cant(r.estado === 'Disponible' ? r.cantidad - r.reservada : 0, m.unidad))}${campo('Costo unitario', fmt.mxn(r.costo))}${campo('Entrada', fmt.fechaHora(r.fechaEntrada))}${campo('Ubicación', esc(r.ubicacion))}</div>
        ${seccion('Trazabilidad', `<p class="nota">Origen → destino del lote.</p>${relaciones([r.oc, r.origen.startsWith('REC') ? r.origen : null, ...sums, ...ops, ...lpts])}`)}
        ${seccion('Movimientos del lote', tablaSimple([{ t: 'Fecha' }, { t: 'Tipo' }, { t: 'Cantidad', num: true }, { t: 'Referencia' }], movs.slice().reverse().map(x => [fmt.fechaHora(x.fecha), esc(x.tipo) + (x.motivo ? `<br><small class="tenue">${esc(x.motivo)}</small>` : ''), fmt.num(x.cantidad, 2), /^(REC|SUM|OP|APERTURA)/.test(x.referencia) && x.referencia !== 'APERTURA' ? docLink(x.referencia) : esc(x.referencia)])))}` };
    }
    case 'materiales': {
      const e = existencias(r.codigo);
      const lotes = lotesDe(r.codigo).sort(fifo);
      return { acciones: btnAcc('sc-nueva', r.codigo, 'Crear solicitud de compra', { clase: 'btn btn-chico', permiso: 'solicitud.crear' }) + btnAcc('oc-nueva', r.codigo, 'Orden de compra directa', { permiso: 'compra' }), titulo: `${r.codigo} · ${r.descripcion}`, cuerpo: `
        <div class="campos">${campo('Estado', pill(estadoMaterial(r.codigo)))}${campo('Categoría', esc(r.categoria))}${campo('Existencia física', fmt.cant(e.fisica, r.unidad))}${campo('Reservada', fmt.cant(e.reservada, r.unidad))}
        ${campo('Disponible', fmt.cant(e.disponible, r.unidad))}${campo('En cuarentena / dañada', fmt.cant(e.bloqueada, r.unidad))}${campo('Mínimo / máximo', `${fmt.num(r.min)} / ${fmt.num(r.max)} ${r.unidad}`)}${campo('En tránsito', fmt.cant(enTransito(r.codigo), r.unidad))}
        ${campo('Costo unitario', fmt.mxn(r.costo))}${campo('Precio de referencia', fmt.mxn(r.precioRef))}${campo('Proveedor habitual', `${docLink(r.proveedor)} ${esc(proveedor(r.proveedor).razon)}`)}${campo('Tiempo de reposición', `${r.lead} días`)}</div>
        ${seccion('Lotes (orden FIFO)', tablaSimple([{ t: 'Lote' }, { t: 'Entrada' }, { t: 'Estado' }, { t: 'Existencia', num: true }, { t: 'Reservada', num: true }], lotes.map(l => [docLink(l.lote), fmt.fecha(l.fechaEntrada), pill(l.estado), fmt.num(l.cantidad, 2), fmt.num(l.reservada, 2)])))}
        ${seccion('Órdenes de compra abiertas', relaciones(S.ordenesCompra.filter(o => OC_ABIERTA.includes(o.estado) && o.lineas.some(l => l.material === r.codigo)).map(o => o.folio)) || '<p class="vacio">Ninguna.</p>')}
        ${seccion('Productos que lo usan', relaciones(S.productos.filter(p => p.bom[r.codigo]).map(p => p.codigo)))}
        ${imp(r.codigo)}` };
    }
    case 'proveedores': {
      const dsp = desempenoProveedor(r.codigo);
      return { titulo: r.razon, acciones: btnAcc('oc-nueva', S.materiales.find(m => m.proveedor === r.codigo)?.codigo, 'Nueva orden de compra', { clase: 'btn btn-chico', permiso: 'compra' }), cuerpo: `
        <div class="campos">${campo('Código', r.codigo)}${campo('Estado', pill(r.estado, 'bien'))}${campo('Contacto', esc(r.contacto))}${campo('Correo (demostración)', esc(r.correo))}
        ${campo('Zona', esc(r.zona))}${campo('Categorías', esc(r.categorias.join(', ')))}${campo('Tiempo promedio de entrega', `${r.lead} días`)}${campo('Calificación interna', `${fmt.num(r.calificacion, 1)} / 5`)}
        ${campo('Entregas puntuales (catálogo)', fmt.pct(r.puntualidad * 100, 0))}${campo('Entregas puntuales (real)', dsp.puntualidad == null ? 'Sin datos suficientes' : fmt.pct(dsp.puntualidad, 1))}${campo('Variación de precio', dsp.variacion == null ? '—' : fmt.pct(dsp.variacion, 1))}${campo('Comprado', fmt.mxn(dsp.comprado, 0))}</div>
        ${seccion('Materiales que surte (precio de referencia)', tablaSimple([{ t: 'Material' }, { t: 'Precio ref.', num: true }, { t: 'Unidad' }], S.materiales.filter(m => m.proveedor === r.codigo).map(m => [`${docLink(m.codigo)} ${esc(m.descripcion)}`, fmt.mxn(m.precioRef), m.unidad])))}
        ${seccion('Órdenes de compra', relaciones(S.ordenesCompra.filter(o => o.proveedor === r.codigo).map(o => o.folio).reverse()))}` };
    }
    case 'suministros': {
      let acc = '';
      if (r.estado === 'Pendiente') acc += btnAcc('sum-preparar', r.folio, 'Preparar', { permiso: 'suministro' });
      if (['Pendiente', 'Preparando', 'Surtido parcial'].includes(r.estado)) acc += btnAcc('sum-surtir', r.folio, 'Surtir materiales', { clase: 'btn btn-chico', permiso: 'suministro' }) + btnAcc('sum-cancelar', r.folio, 'Cancelar', { clase: 'btn-peligro btn-chico', permiso: 'suministro' });
      if (r.lineas.some(l => l.surtido - l.devuelto > 0)) acc += btnAcc('sum-devolver', r.folio, 'Devolver material', { permiso: 'suministro' });
      return { acciones: acc, cuerpo: `<div class="campos">${campo('Estado', pill(r.estado))}${campo('Orden de producción', docLink(r.op))}${campo('Línea / destino', esc(r.destino))}${campo('Fecha requerida', fmt.fecha(r.fechaRequerida))}${campo('Responsable', esc(r.responsable))}${campo('Surtido', barraProgreso(porcentajeSurtido(r)))}</div>
        ${seccion('Materiales', tablaSimple([{ t: 'Material' }, { t: 'Origen' }, { t: 'Solicitado', num: true }, { t: 'Surtido', num: true }, { t: 'Pendiente', num: true }, { t: 'Devuelto', num: true }, { t: 'Lotes' }],
          r.lineas.map(l => [esc(material(l.material).descripcion), esc(l.origen), fmt.num(l.solicitado, 2), fmt.num(l.surtido, 2), fmt.num(Math.max(0, l.solicitado - l.surtido), 2), fmt.num(l.devuelto, 2), l.lotes.map(x => docLink(x.lote)).join(' ') || (l.reservas.length ? 'Reservado: ' + l.reservas.map(x => docLink(x.lote)).join(' ') : '—')])))}` };
    }
    case 'ordenesProduccion': {
      const p = producto(r.producto);
      const req = requerimientosOP(r);
      const ops = operacionesDe(r.folio);
      let acc = '';
      if (['Planificada', 'Pendiente de materiales', 'Lista para iniciar'].includes(r.estado) && !S.suministros.some(s => s.op === r.folio && ['Pendiente', 'Preparando', 'Surtido parcial'].includes(s.estado)) && req.some(x => x.pendiente > 0)) acc += btnAcc('sum-nueva', r.folio, 'Solicitar materiales', { permiso: 'suministro' });
      if (['Planificada', 'Pendiente de materiales', 'Lista para iniciar'].includes(r.estado)) acc += btnAcc('op-iniciar', r.folio, 'Iniciar', { clase: 'btn btn-chico', permiso: 'produccion' });
      if (r.estado === 'En proceso') acc += btnAcc('op-pausar', r.folio, 'Registrar paro', { permiso: 'produccion' }) + btnAcc('op-completar', r.folio, 'Completar fabricación', { clase: 'btn-verde btn-chico', permiso: 'produccion' });
      if (r.estado === 'Pausada') acc += btnAcc('op-reanudar', r.folio, 'Reanudar', { clase: 'btn btn-chico', permiso: 'produccion' });
      if (!['Terminada', 'Cancelada'].includes(r.estado)) acc += btnAcc('op-cancelar', r.folio, 'Cancelar', { clase: 'btn-peligro btn-chico', permiso: 'produccion' });
      const lpt = r.lotePT && S.lotesPT.find(l => l.lote === r.lotePT);
      const pedidos = lpt ? S.pedidos.filter(pd => pd.lineas.some(l => [...l.lotes, ...l.reservas].some(x => x.lote === lpt.lote))).map(pd => pd.folio) : [];
      return { acciones: acc, cuerpo: `
        <div class="campos">${campo('Estado', pill(r.estado))}${campo('Producto', `${docLink(p.codigo)} ${esc(p.nombre)}`)}${campo('Línea', esc(linea(r.linea).nombre))}${campo('Responsable', esc(r.responsable))}
        ${campo('Planificada', fmt.num(r.planificada))}${campo('Fabricada', fmt.num(r.fabricada))}${campo('Aceptada', fmt.num(r.aceptada))}${campo('Defectuosa', fmt.num(r.defectuosa))}
        ${campo('Inicio plan / real', `${fmt.fecha(r.iniPlan)} / ${fmt.fechaHora(r.iniReal)}`)}${campo('Fin plan / real', `${fmt.fecha(r.finPlan)} / ${fmt.fechaHora(r.finReal)}`)}${campo('Avance', barraProgreso(100 * r.aceptada / r.planificada))}${campo('Lote producido', docLink(r.lotePT))}</div>
        ${r.excepcion ? seccion('Inicio por excepción', `<p>${pill('Excepción auditada', 'alerta')} ${esc(r.excepcion.usuario)} · ${fmt.fechaHora(r.excepcion.fecha)}: ${esc(r.excepcion.motivo)}</p>`) : ''}
        ${seccion('Materiales requeridos', tablaSimple([{ t: 'Material' }, { t: 'Requerido', num: true }, { t: 'Surtido', num: true }, { t: 'Pendiente', num: true }, { t: 'Disponible', num: true }],
          req.map(x => [`${docLink(x.material)} ${esc(material(x.material).descripcion)}`, fmt.num(x.requerido, 2), fmt.num(x.surtido, 2), x.pendiente > 0 ? `<b style="color:var(--rojo)">${fmt.num(x.pendiente, 2)}</b>` : '0', fmt.num(x.disponible, 2)])))}
        ${seccion('Solicitudes de suministro', relaciones(S.suministros.filter(s => s.op === r.folio).map(s => s.folio)) || '<p class="vacio">Aún no se solicitan materiales.</p>')}
        ${ops.length ? seccion('Avance de manufactura', tablaSimple([{ t: 'Etapa' }, { t: 'Procesadas', num: true }, { t: 'Aceptadas', num: true }, { t: 'Defectuosas', num: true }, { t: 'Estado' }], ops.map(o => [`${docLink(o.folio)} ${esc(o.operacion)}`, fmt.num(o.procesada), fmt.num(o.aceptada), fmt.num(o.defectuosa), pill(o.estado)]))) : ''}
        ${r.paros.length ? seccion('Paros', tablaSimple([{ t: 'Fecha' }, { t: 'Causa' }, { t: 'Minutos', num: true }], r.paros.map(x => [fmt.fechaHora(x.fecha), esc(x.causa), fmt.num(x.minutos)]))) : ''}
        ${seccion('Pedidos atendidos con este lote', relaciones(pedidos))}
        ${r.estado !== 'Terminada' ? imp(r.folio) : ''}
        ${seccion('Historial', timeline(r.historial))}` };
    }
    case 'operaciones': {
      const op = buscarPor('ordenesProduccion', r.op);
      let acc = '';
      if (op.estado === 'En proceso' && entradaPendiente(r) > 0) acc += btnAcc('ope-avance', r.folio, 'Registrar avance', { clase: 'btn btn-chico', permiso: 'produccion' });
      if (r.etapa === 4) acc += btnAcc('ope-inspeccion', r.folio, 'Registrar inspección', { permiso: 'produccion' });
      return { acciones: acc, titulo: `${r.folio} · ${r.operacion}`, cuerpo: `<div class="campos">${campo('Orden', docLink(r.op))}${campo('Estado', pill(r.estado))}${campo('Programada', fmt.num(r.programada))}${campo('Procesada', fmt.num(r.procesada))}${campo('Aceptada', fmt.num(r.aceptada))}${campo('Defectuosa', fmt.num(r.defectuosa))}${campo('Tiempo estándar', `${fmt.num(r.procesada * r.tEstUnit, 0)} min`)}${campo('Tiempo real', `${fmt.num(r.tReal, 0)} min`)}${campo('Responsable', esc(r.responsable))}${campo('Observaciones', esc(r.observaciones || '—'))}</div>
        ${seccion('Defectos', tablaSimple([{ t: 'Fecha' }, { t: 'Causa' }, { t: 'Unidades', num: true }], r.defectos.map(x => [fmt.fechaHora(x.fecha), esc(x.causa), fmt.num(x.cantidad)])))}` };
    }
    case 'lotesPT': {
      const p = producto(r.producto);
      const op = r.op && buscarPor('ordenesProduccion', r.op);
      const sums = op ? S.suministros.filter(s => s.op === op.folio) : [];
      const lotesMat = [...new Set(sums.flatMap(s => s.lineas.flatMap(l => l.lotes.map(x => x.lote))))];
      const ocs = [...new Set(lotesMat.map(l => S.lotes.find(x => x.lote === l)?.oc).filter(Boolean))];
      const peds = S.pedidos.filter(pd => pd.lineas.some(l => [...l.lotes, ...l.reservas].some(x => x.lote === r.lote))).map(pd => pd.folio);
      let acc = r.calidad === 'Aprobado' ? btnAcc('lpt-bloquear', r.lote, 'Bloquear por calidad', { clase: 'btn-peligro btn-chico', permiso: 'terminado' }) : btnAcc('lpt-liberar', r.lote, 'Liberar', { clase: 'btn-verde btn-chico', permiso: 'terminado' });
      acc += btnAcc('lpt-transferir', r.lote, 'Transferir ubicación', { permiso: 'terminado' });
      return { acciones: acc, cuerpo: `<div class="campos">${campo('Producto', `${docLink(p.codigo)} ${esc(p.nombre)}`)}${campo('Calidad', pill(r.calidad))}${campo('Orden de origen', r.op ? docLink(r.op) : (r.devolucionDe ? `Devolución de ${docLink(r.devolucionDe)}` : 'Inventario inicial'))}${campo('Fecha de fabricación', fmt.fecha(r.fecha))}
        ${campo('Fabricada', fmt.num(r.fabricada))}${campo('Aprobada', fmt.num(r.aprobada))}${campo('Existencia', fmt.num(r.existencia))}${campo('Reservada', fmt.num(r.reservada))}${campo('Disponible', fmt.num(r.calidad === 'Aprobado' ? r.existencia - r.reservada : 0))}${campo('Despachada', fmt.num(r.despachada))}${campo('Ubicación', esc(r.ubicacion))}${campo('Costo unitario estimado', fmt.mxn(r.costoUnit))}</div>
        ${seccion('Trazabilidad hasta los materiales de origen', `<p class="nota">Orden → solicitudes de suministro → lotes de material → órdenes de compra.</p>${relaciones([r.op, ...sums.map(s => s.folio), ...lotesMat, ...ocs])}`)}
        ${seccion('Pedidos', relaciones(peds) || '<p class="vacio">Ningún pedido ha usado este lote.</p>')}` };
    }
    case 'productos': {
      const lotes = S.lotesPT.filter(l => l.producto === r.codigo && l.existencia > 0);
      return { titulo: `${r.codigo} · ${r.nombre}`, acciones: btnAcc('op-nueva', r.codigo, 'Crear orden de producción', { clase: 'btn btn-chico', permiso: 'produccion' }), cuerpo: `<div class="campos">${campo('Línea', esc(linea(r.linea).nombre))}${campo('Precio de venta', fmt.mxn(r.precio))}${campo('Tiempo estándar', `${fmt.num(r.tEst, 1)} min/unidad`)}${campo('Disponible para venta', fmt.num(disponiblePT(r.codigo)))}${campo('Costo de material', fmt.mxn(costoMaterialUnidad(r.codigo)))}</div>
        ${seccion('Lista de materiales (por unidad)', tablaSimple([{ t: 'Material' }, { t: 'Cantidad', num: true }], Object.entries(r.bom).map(([m, q]) => [`${docLink(m)} ${esc(material(m).descripcion)}`, fmt.cant(q, material(m).unidad)])))}
        ${seccion('Lotes en existencia', tablaSimple([{ t: 'Lote' }, { t: 'Calidad' }, { t: 'Existencia', num: true }, { t: 'Reservada', num: true }], lotes.map(l => [docLink(l.lote), pill(l.calidad), fmt.num(l.existencia), fmt.num(l.reservada)])))}` };
    }
    case 'pedidos': {
      const c = cliente(r.cliente);
      const est = estadoPedido(r);
      let acc = '';
      if (['Registrado', 'Reservado parcial'].includes(r.estado)) acc += btnAcc('ped-reservar', r.folio, 'Reservar producto', { clase: 'btn btn-chico', permiso: 'pedido' });
      if (['Reservado', 'Reservado parcial'].includes(r.estado)) acc += btnAcc('ped-preparar', r.folio, 'Preparar', { permiso: 'pedido' });
      if (['Reservado', 'Reservado parcial', 'En preparación'].includes(r.estado)) acc += btnAcc('ped-despachar', r.folio, 'Despachar', { clase: 'btn btn-chico', permiso: 'pedido' });
      if (r.estado === 'Despachado') acc += btnAcc('ped-entregar', r.folio, 'Registrar entrega', { clase: 'btn-verde btn-chico', permiso: 'pedido' });
      if (!['Entregado', 'Cancelado'].includes(r.estado)) acc += btnAcc('ped-retraso', r.folio, 'Simular retraso', { permiso: 'pedido' });
      if (r.estado === 'Entregado') acc += btnAcc('ped-devolucion', r.folio, 'Registrar devolución', { permiso: 'pedido' });
      if (!['Despachado', 'Entregado', 'Cancelado'].includes(r.estado)) acc += btnAcc('ped-cancelar', r.folio, 'Cancelar', { clase: 'btn-peligro btn-chico', permiso: 'pedido' });
      return { acciones: acc, cuerpo: `<div class="campos">${campo('Estado', pill(est))}${campo('Cliente', esc(c.nombre))}${campo('Fecha del pedido', fmt.fecha(r.fecha))}${campo('Fecha comprometida', fmt.fecha(r.comprometida))}
        ${campo('Despacho', fmt.fecha(r.despacho))}${campo('Entrega', r.entrega ? `${fmt.fecha(r.entrega)} ${r.aTiempo ? pill('A tiempo', 'bien') : pill('Tarde', 'critico')}` : '—')}${campo('Completo', r.completo == null ? '—' : r.completo ? pill('Completo', 'bien') : pill('Incompleto', 'critico'))}${campo('Costo de envío', fmt.mxn(r.costoEnvio))}</div>
        ${seccion('Productos', tablaSimple([{ t: 'Producto' }, { t: 'Pedida', num: true }, { t: 'Reservada', num: true }, { t: 'Despachada', num: true }, { t: 'Devuelta', num: true }, { t: 'Lotes' }],
          r.lineas.map(l => [`${docLink(l.producto)} ${esc(producto(l.producto).nombre)}`, fmt.num(l.cantidad), fmt.num(l.reservada), fmt.num(l.despachada), fmt.num(l.devuelta), [...l.lotes, ...l.reservas].map(x => docLink(x.lote)).join(' ') || '—'])))}
        ${seccion('Historial', timeline(r.historial))}` };
    }
    case 'incidencias':
      return { acciones: btnAcc('inc-actualizar', r.folio, 'Actualizar / resolver', { clase: 'btn btn-chico', permiso: 'incidencia' }), cuerpo: `<div class="campos">${campo('Estado', pill(r.estado))}${campo('Severidad', pill(r.severidad))}${campo('Tipo', esc(r.tipo))}${campo('Área', esc(r.area))}${campo('Fecha', fmt.fecha(r.fecha))}${campo('Operación relacionada', documento(r.operacion) ? docLink(r.operacion) : esc(r.operacion || '—'))}${campo('Responsable', esc(r.responsable))}${campo('Compromiso', fmt.fecha(r.compromiso))}</div>
        ${seccion('Descripción', `<p>${esc(r.descripcion)}</p>`)}${seccion('Impacto estimado', `<p>${esc(r.impacto || '—')}</p>`)}${seccion('Acción correctiva', `<p>${esc(r.accion || 'Pendiente de definir')}</p>`)}${r.evidencia ? seccion('Evidencia', `<p>${esc(r.evidencia)}</p>`) : ''}
        ${r.operacion && documento(r.operacion) ? imp(r.operacion) : ''}${seccion('Historial', timeline(r.historial))}` };
    case 'movimientos':
      return { cuerpo: `<div class="campos">${campo('Fecha', fmt.fechaHora(r.fecha))}${campo('Tipo', esc(r.tipo))}${campo('Artículo', docLink(r.material || r.producto))}${campo('Lote', docLink(r.lote))}${campo('Cantidad', fmt.num(r.cantidad, 3))}${campo('Costo unitario', fmt.mxn(r.costoUnit))}${campo('Referencia', documento(r.referencia) ? docLink(r.referencia) : esc(r.referencia))}${campo('Usuario', esc(r.usuario))}</div>${r.motivo ? seccion('Motivo', `<p>${esc(r.motivo)}</p>`) : ''}` };
    case 'conteos':
      return { acciones: r.estado === 'Con diferencia' && !r.ajustado ? btnAcc('conteo-ajustar', r.folio, 'Aplicar ajuste', { clase: 'btn btn-chico', permiso: 'inventario' }) : '', cuerpo: `<div class="campos">${campo('Fecha', fmt.fecha(r.fecha))}${campo('Lote', docLink(r.lote))}${campo('Material', docLink(r.material))}${campo('Estado', pill(r.estado))}${campo('Teórico', fmt.num(r.teorico, 2))}${campo('Físico', fmt.num(r.fisico, 2))}${campo('Diferencia', fmt.num(r.diferencia, 2))}${campo('Ajuste', r.movimiento ? docLink(r.movimiento) : (r.ajustado ? 'Aplicado' : '—'))}</div>` };
    default:
      return { cuerpo: '<p>Documento sin vista detallada.</p>' };
  }
}
