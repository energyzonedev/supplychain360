// Configuración · Guía de inicio rápido · Simulación completa demostrativa.
'use strict';

MODULOS.configuracion = {
  titulo: 'Configuración', icono: 'config', grupo: 'Sistema', pestana: 'general',
  render(main) {
    const c = S.config;
    const p = this.pestana;
    main.innerHTML = `
      ${encabezado('Configuración', 'Parámetros de cálculo, metas de los KPIs, roles de demostración, persistencia y auditoría.')}
      <div class="pestanas">${[['general', 'Parámetros y metas'], ['roles', 'Roles de demostración'], ['datos', 'Datos y persistencia'], ['auditoria', 'Historial de auditoría']].map(([id, t]) => `<button class="${p === id ? 'activa' : ''}" data-pest="${id}">${t}</button>`).join('')}</div>
      <div id="cfg"></div>`;
    main.querySelectorAll('[data-pest]').forEach(b => b.onclick = () => { this.pestana = b.dataset.pest; refrescar(); });
    const cont = main.querySelector('#cfg');
    if (p === 'general') {
      const etiquetas = { proveedores: 'Cumplimiento de proveedores (%)', variacionPrecio: 'Variación de precio máxima (%)', cicloCompras: 'Ciclo de compras máximo (días hábiles)', entradaATiempo: 'Entregas de entrada a tiempo (%)', costoTransporteUnidad: 'Costo de transporte por unidad (MXN)', exactitud: 'Exactitud del inventario (%)', rotacionAnual: 'Rotación anual mínima (vueltas)', criticos: 'Materiales críticos máximo (%)', planProduccion: 'Cumplimiento del plan (%)', calidad: 'Rendimiento de calidad (%)', eficiencia: 'Eficiencia del tiempo (%)', oee: 'OEE de referencia (%)', otif: 'OTIF (%)', costoLogisticoUnidad: 'Costo logístico por unidad (MXN)', desperdicio: 'Desperdicio máximo (%)', cicloAbastecimiento: 'Ciclo de abastecimiento máximo (días)' };
      cont.innerHTML = `<section class="tarjeta"><form id="fCfg" class="form" style="padding:0" novalidate>
        <h2>Parámetros de cálculo</h2>
        <div class="form-campos">
          <label class="campo"><span>IVA (%) — impuesto configurable de las órdenes de compra</span><input name="iva" type="number" min="0" max="50" step="0.01" value="${redondear(c.iva * 100, 2)}"></label>
          <label class="campo"><span>Costo por minuto de línea (MXN)</span><input name="costoMinutoProduccion" type="number" min="0" step="0.01" value="${c.costoMinutoProduccion}"></label>
          <label class="campo"><span>Costo diario de operación del almacén (MXN)</span><input name="costoAlmacenDia" type="number" min="0" step="1" value="${c.costoAlmacenDia}"></label>
          <label class="campo"><span>Posiciones de tarima del almacén</span><input name="posicionesAlmacen" type="number" min="1" step="1" value="${c.posicionesAlmacen}"></label>
        </div>
        <h2 style="margin-top:8px">Metas de los KPIs</h2>
        <div class="form-campos">${Object.keys(c.metas).map(k => `<label class="campo"><span>${esc(etiquetas[k] || k)}</span><input name="meta_${k}" type="number" min="0" step="any" value="${c.metas[k]}"></label>`).join('')}</div>
        <p class="form-error" role="alert"></p>
        <div class="form-acc">${btnAcc('', '', 'Guardar configuración', { clase: '', permiso: 'configuracion' }).replace('data-accion=""', 'type="submit"')}</div>
      </form></section>`;
      cont.querySelector('#fCfg').onsubmit = e => {
        e.preventDefault();
        const r = guardarConfiguracion(Object.fromEntries(new FormData(e.target).entries()));
        if (!r.ok) e.target.querySelector('.form-error').textContent = r.mensaje; else operar(r);
      };
    }
    if (p === 'roles') cont.innerHTML = `<section class="tarjeta"><h2>Roles de demostración</h2>
      <p>${pill('Sólo demostración', 'alerta')} No hay autenticación configurada: el selector de rol de la cabecera sirve para mostrar la segregación de funciones y <b>no es un sistema de seguridad real</b>. Las reglas de negocio verifican el rol en cada operación, pero en una aplicación productiva los permisos deben validarse en el servidor o en la base de datos (por ejemplo, con políticas de seguridad a nivel de fila).</p>
      <div class="tabla-cont"><table><thead><tr><th>Rol</th><th>Usuario de ejemplo</th><th>Puede</th></tr></thead><tbody>${ROLES.map(r => `<tr><td><b>${r}</b>${r === S.rol ? ' ' + pill('Rol actual', 'info') : ''}</td><td>${esc(USUARIO_ROL[r])}</td><td>${esc(Object.entries(PERMISOS).filter(([, rs]) => rs.includes(r)).map(([k]) => k).join(', ') || 'Consultar dashboard, KPIs y reportes')}</td></tr>`).join('')}</tbody></table></div>
      <div class="acciones-fila" style="margin-top:10px">${ROLES.map(r => `<button class="btn ${r === S.rol ? '' : 'btn-sec'} btn-chico" data-rol="${r}">Usar «${r}»</button>`).join('')}</div></section>`;
    cont.querySelectorAll('[data-rol]').forEach(b => b.onclick = () => cambiarRol(b.dataset.rol));
    if (p === 'datos') {
      const tam = (JSON.stringify(S).length / 1024).toFixed(0);
      cont.innerHTML = `<div class="rejilla r2"><section class="tarjeta"><h2>Persistencia</h2>
        <div class="campos"><div><span>Adaptador activo</span>${esc(adaptador.nombre)} ${pill(persistenciaOk ? 'Guardando' : 'Sin guardar', persistenciaOk ? 'bien' : 'critico')}</div><div><span>Tamaño de los datos</span>${tam} KB</div>
        <div><span>Base de datos remota</span>${esc(AdaptadorSupabase.nombre)} ${pill('No conectada', 'neutro')}</div><div><span>Datos generados</span>${fmt.fechaHora(S.generado)}</div></div>
        <p class="nota" style="margin-top:10px">Los datos viven en este navegador. Para migrar a Supabase u otra base relacional, implementa <code>cargar</code>, <code>guardar</code> y <code>borrar</code> en <code>AdaptadorSupabase</code> (js/nucleo/almacen-datos.js) con la URL y la clave pública del proyecto; el README describe las tablas sugeridas. No se simula ninguna conexión que no exista.</p></section>
        <section class="tarjeta"><h2>Respaldo y restauración</h2>
        <div class="acciones-fila"><button class="btn btn-sec" id="dExport">${icono('descarga')} Exportar respaldo (JSON)</button><label class="btn btn-sec" style="cursor:pointer">Importar respaldo<input type="file" id="dImport" accept="application/json" hidden></label>
        <button class="btn btn-peligro" data-accion="restaurar">Restaurar datos de demostración</button></div>
        <p class="nota" style="margin-top:10px">Restaurar borra todas las operaciones registradas y regenera los 30 días de histórico originales.</p></section></div>`;
      cont.querySelector('#dExport').onclick = () => descargar(`sc360-respaldo-${hoy()}.json`, JSON.stringify(S), 'application/json');
      cont.querySelector('#dImport').onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        f.text().then(t => {
          const d = JSON.parse(t);
          if (d.version !== VERSION_DATOS || !Array.isArray(d.ordenesCompra)) throw new Error('formato');
          confirmar('¿Reemplazar los datos actuales con el respaldo?', { titulo: 'Importar respaldo', boton: 'Importar', peligro: true }).then(si => { if (si) { S = d; S.relojSim = null; guardar(); operar(exito('Respaldo importado.')); } });
        }).catch(() => aviso('El archivo no es un respaldo válido de SupplyChain 360.', 'mal'));
      };
    }
    if (p === 'auditoria') cont.innerHTML = `<section class="tarjeta"><p class="nota">Cada cambio importante queda registrado: quién, cuándo, con qué rol y sobre qué documento.</p>${tabla('auditoria', {
      exportar: 'auditoria', orden: ['Fecha', 'desc'], porPagina: 20,
      columnas: [
        { t: 'Fecha', v: a => fmt.fechaHora(a.fecha), o: a => a.fecha },
        { t: 'Usuario', v: a => esc(a.usuario), o: a => a.usuario },
        { t: 'Rol', v: a => esc(a.rol), o: a => a.rol },
        { t: 'Acción', v: a => esc(a.accion), o: a => a.accion },
        { t: 'Documento', v: a => documento(a.folio) ? docLink(a.folio) : esc(a.folio), o: a => a.folio },
        { t: 'Detalle', v: a => esc(a.detalle), o: a => a.detalle },
      ],
      filas: S.auditoria, filtros: [{ id: 'r', t: 'Rol', valor: a => a.rol }, { id: 'a', t: 'Acción', valor: a => a.accion }],
    })}</section>`;
  },
};

function cambiarRol(rol) {
  S.rol = rol;
  guardar();
  aviso(`Ahora operas como ${USUARIO_ROL[rol]} (${rol}). Es un rol de demostración.`);
  pintarCabecera();
  refrescar();
}

ACCIONES['restaurar'] = () => confirmar('Se borrarán todas las operaciones que registraste y se regenerarán los datos ficticios de demostración originales. ¿Continuar?', { titulo: 'Restaurar datos de demostración', boton: 'Restaurar', peligro: true })
  .then(si => { if (si) { restaurarDemostracion(); simCompleta.respaldo = null; aviso('Datos de demostración restaurados.'); pintarCabecera(); refrescar(); } });

// ===================================================== GUÍA Y MODO DEMOSTRACIÓN

MODULOS.guia = {
  titulo: 'Modo demostración', icono: 'chispa', grupo: null,
  render(main) {
    main.innerHTML = `
      ${encabezado('Modo demostración', 'Datos ficticios de demostración de NovaManufactura México. Prueba el flujo completo en menos de cinco minutos.')}
      <div class="rejilla r2">
        <section class="tarjeta"><h2>Guía de inicio rápido (5 minutos)</h2>
          <ol class="pasos-guia">
            <li><b>Solicitud.</b> En el Dashboard pulsa «Crear solicitud de compra» (por ejemplo, Resina de polipropileno).</li>
            <li><b>Autorización.</b> En «Solicitudes de compra», autoriza la solicitud y pulsa «Convertir en OC».</li>
            <li><b>Proveedor.</b> Abre la orden (clic en su folio): «Enviar al proveedor», «Registrar confirmación» y «Programar embarque».</li>
            <li><b>Transporte.</b> En «Transporte», avanza el embarque hasta «En revisión de recepción».</li>
            <li><b>Recepción.</b> «Registrar recepción»: captura lo aceptado (prueba rechazar unas unidades). Sólo lo aceptado sube el inventario.</li>
            <li><b>Producción.</b> «Crear orden de producción», luego «Solicitar materiales» y «Surtir materiales»: el almacén descuenta por PEPS.</li>
            <li><b>Manufactura.</b> «Iniciar» la orden y registra el avance etapa por etapa; al final, «Completar fabricación» genera el lote de producto terminado.</li>
            <li><b>Pedido.</b> En «Pedidos», crea un pedido, resérvalo, prepáralo, despáchalo y registra la entrega.</li>
            <li><b>Resultado.</b> Revisa «KPIs y analítica»: los indicadores se recalculan con lo que registraste. Cualquier folio abre su trazabilidad completa.</li>
          </ol>
          <p class="nota" style="margin-top:10px">¿Sin tiempo? Usa «Ejecutar simulación completa»: hace todo lo anterior solo y muestra cada paso.</p>
        </section>
        <section class="tarjeta"><h2>Ejecutar simulación completa</h2>
          <p class="nota">Recorre la cadena de extremo a extremo con datos de demostración y muestra cada evento con su folio. Al terminar puedes deshacerla y volver exactamente al estado anterior.</p>
          <div class="acciones-fila" style="margin:10px 0"><button class="btn" id="simIr" ${simCompleta.corriendo ? 'disabled' : ''}>${icono('play')} Ejecutar simulación completa</button>
          <button class="btn btn-sec" id="simDeshacer" ${simCompleta.respaldo && !simCompleta.corriendo ? '' : 'disabled'}>Restablecer estado previo</button>
          <button class="btn btn-sec btn-chico" data-accion="restaurar">Restaurar datos de demostración</button></div>
          <ul class="registro-sim" id="simLog">${simCompleta.log.map(l => `<li class="${l.ok ? 'ok' : 'mal'}"><b>${l.ok ? '✓' : '✕'}</b><span>${l.html}</span></li>`).join('') || '<li><span class="tenue">Aún no se ha ejecutado.</span></li>'}</ul>
        </section>
      </div>`;
    main.querySelector('#simIr').onclick = () => ejecutarSimulacionCompleta();
    main.querySelector('#simDeshacer').onclick = () => confirmar('¿Volver al estado anterior a la simulación completa?', { titulo: 'Restablecer', boton: 'Restablecer' }).then(si => {
      if (!si) return;
      S = simCompleta.respaldo; simCompleta.respaldo = null; simCompleta.log = []; guardar();
      aviso('Estado previo restablecido.'); pintarCabecera(); refrescar();
    });
  },
};

const simCompleta = { corriendo: false, respaldo: null, log: [] };

async function ejecutarSimulacionCompleta() {
  if (simCompleta.corriendo) return;
  simCompleta.corriendo = true;
  simCompleta.respaldo = clonar(S);
  simCompleta.log = [];
  const rolPrevio = S.rol;
  S.rol = 'Administrador';
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const paso = async (texto, fn) => {
    const r = fn();
    const folio = r && r.registro && (r.registro.folio || r.registro.lote);
    simCompleta.log.push({ ok: r.ok !== false, html: `<b>${esc(texto)}</b>${folio ? ' · ' + docLink(folio) : ''}<br><small class="tenue">${esc(r.mensaje || '')}</small>` });
    if (location.hash === '#guia') refrescar();
    const ul = document.getElementById('simLog');
    if (ul) ul.scrollTop = ul.scrollHeight;
    await espera(450);
    if (r.ok === false) throw new Error(r.mensaje);
    return r.registro;
  };
  try {
    const mat = 'MAT-005';
    const sc = await paso('1. Solicitud de compra de resina PP', () => crearSolicitud({ area: 'Producción', material: mat, cantidad: 300, motivo: 'Simulación completa demostrativa', prioridad: 'Alta' }));
    await paso('2. Autorización de la solicitud', () => autorizarSolicitud(sc.folio, 'Autorizada en la simulación completa'));
    const oc = await paso('3. Conversión en orden de compra', () => convertirSolicitud(sc.folio));
    await paso('4. Envío al proveedor', () => enviarOC(oc.folio));
    await paso('5. Confirmación del proveedor', () => confirmarOC(oc.folio, sumarDias(hoy(), 2)));
    const emb = await paso('6. Preparación del embarque', () => programarEmbarque({ oc: oc.folio, salida: hoy(), eta: sumarDias(hoy(), 2) }));
    await paso('7. Transporte: en preparación', () => avanzarEmbarque(emb.folio, 'Simulación'));
    await paso('7. Transporte: en tránsito', () => avanzarEmbarque(emb.folio, 'Simulación'));
    await paso('8. Llegada a planta', () => avanzarEmbarque(emb.folio, 'Simulación'));
    const lo = oc.lineas[0];
    await paso('9. Recepción e inspección (6 kg rechazados)', () => registrarRecepcion({ oc: oc.folio, embarque: emb.folio, lineas: [{ material: mat, recibido: lo.cantidad, aceptado: lo.cantidad - 6 }] }));
    // producto cuyo material alcanza para 50 unidades (de preferencia uno que use la resina recibida)
    const prod = [...S.productos].sort((x, y) => (y.bom[mat] ? 1 : 0) - (x.bom[mat] ? 1 : 0)).find(p => Object.entries(p.bom).every(([m, q]) => existencias(m).disponible >= q * 50));
    if (!prod) throw new Error('No hay material suficiente para fabricar 50 unidades de ningún producto. Restaura los datos de demostración y vuelve a intentarlo.');
    const op = await paso(`10. Orden de fabricación: 50 ${prod.nombre}`, () => crearOP({ producto: prod.codigo, cantidad: 50, iniPlan: hoy(), finPlan: hoy(), linea: prod.linea }));
    const sum = await paso('11. Solicitud de suministro', () => crearSuministro(op.folio));
    await paso('12. Surtido a producción (PEPS)', () => surtirSuministro(sum.folio));
    await paso('13. Inicio de la orden', () => iniciarOP(op.folio));
    let entrada = 50;
    for (const o of operacionesDe(op.folio)) {
      const rech = o.etapa === 4 ? 1 : 0;
      await paso(`14. ${o.operacion}`, () => registrarAvance(o.folio, { procesadas: entrada, rechazadas: rech, causa: rech ? 'Dimensión fuera de tolerancia' : '', minutos: Math.round(entrada * o.tEstUnit * 1.05) }));
      entrada -= rech;
    }
    const lpt = await paso('15. Control de calidad y producto terminado', () => completarOP(op.folio));
    const ped = await paso('16. Pedido del cliente', () => crearPedido({ cliente: 'CLI-006', lineas: [{ producto: op.producto, cantidad: 40 }], comprometida: sumarDias(hoy(), 2) }));
    await paso('17. Reserva de producto terminado', () => reservarPedido(ped.folio));
    await paso('17. Preparación del pedido', () => prepararPedido(ped.folio));
    await paso('18. Despacho', () => despacharPedido(ped.folio));
    await paso('19. Entrega al cliente', () => entregarPedido(ped.folio, hoy()));
    simCompleta.log.push({ ok: true, html: `<b>Listo.</b> Cadena completa: ${docLink(sc.folio)} → ${docLink(oc.folio)} → ${docLink(emb.folio)} → ${docLink(op.folio)} → ${docLink(lpt.lote)} → ${docLink(ped.folio)}. Abre cualquier folio para ver su trazabilidad; los KPIs ya incluyen estas operaciones.` });
  } catch (e) {
    simCompleta.log.push({ ok: false, html: `<b>La simulación se detuvo:</b> ${esc(e.message)}` });
  } finally {
    S.rol = rolPrevio;
    guardar();
    simCompleta.corriendo = false;
    pintarCabecera();
    refrescar();
  }
}
