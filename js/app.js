// Armazón de la aplicación: menú, cabecera, buscador global, notificaciones y enrutador.
'use strict';

const ORDEN_MENU = ['dashboard', 'solicitudes', 'compras', 'transporte', 'almacen', 'suministro', 'planeacion', 'manufactura', 'terminados', 'pedidos', 'kpis', 'reportes', 'incidencias', 'simulador', 'configuracion'];
let moduloActual = 'dashboard';

function pintarMenu() {
  let grupo = null;
  const pendSC = S.solicitudes.filter(s => s.estado === 'Pendiente de autorización').length;
  const incAb = S.incidencias.filter(i => !['Resuelta', 'Cerrada'].includes(i.estado)).length;
  const badge = { solicitudes: pendSC, incidencias: incAb };
  document.getElementById('nav').innerHTML = ORDEN_MENU.map(id => {
    const m = MODULOS[id];
    const g = m.grupo !== grupo ? `<div class="nav-grupo">${esc(m.grupo)}</div>` : '';
    grupo = m.grupo;
    return `${g}<a href="#${id}" data-mod="${id}" class="${id === moduloActual ? 'activo' : ''}" ${id === moduloActual ? 'aria-current="page"' : ''} title="${esc(m.titulo)}">${icono(m.icono)}<span>${esc(m.menu || m.titulo)}</span>${badge[id] ? `<b class="num">${badge[id]}</b>` : ''}</a>`;
  }).join('');
}

function pintarCabecera() {
  const alertas = alertasSistema();
  const n = alertas.filter(a => a.tono === 'critico').length || alertas.length;
  document.getElementById('notifBurbuja').textContent = n;
  document.getElementById('notifBurbuja').hidden = !alertas.length;
  document.getElementById('perfilNombre').textContent = USUARIO_ROL[S.rol];
  document.getElementById('perfilRol').textContent = `${S.rol} · demo`;
  document.getElementById('perfilAvatar').textContent = USUARIO_ROL[S.rol].split(' ').map(x => x[0]).join('');
  const con = document.getElementById('conexion');
  con.classList.toggle('fuera', !navigator.onLine || !persistenciaOk);
  con.querySelector('span').textContent = !persistenciaOk ? 'Sin guardar (almacenamiento lleno o bloqueado)' : navigator.onLine ? 'En línea · datos locales' : 'Sin internet · datos locales';
  con.title = `Persistencia: ${adaptador.nombre}. No hay servidor ni base de datos remota configurados.`;
  pintarMenu();
}

function refrescar() {
  const main = document.getElementById('contenido');
  const y = window.scrollY;
  dibujos = [];
  try {
    MODULOS[moduloActual].render(main);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<section class="tarjeta"><h1>Ocurrió un error al mostrar este módulo</h1><p>${esc(e.message)}</p><p class="nota">Los datos no se perdieron. Prueba otro módulo o restaura los datos de demostración.</p></section>`;
  }
  dibujos.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  pintarCabecera();
  window.scrollTo(0, y);
  if (docAbierto) { if (documento(docAbierto)) abrirDocumento(docAbierto); else cerrarDocumento(); }
}

function irA(id) {
  if (!MODULOS[id]) id = 'dashboard';
  const cambio = id !== moduloActual;
  moduloActual = id;
  document.title = `${MODULOS[id].titulo} · SupplyChain 360 AI`;
  document.body.classList.remove('menu-abierto');
  cerrarDesplegables();
  if (cambio) { window.scrollTo(0, 0); }
  refrescar();
  if (cambio) document.getElementById('contenido').focus({ preventScroll: true });
}

// ------------------------------------------------------------- desplegables

function cerrarDesplegables(excepto) {
  document.querySelectorAll('.desplegable').forEach(d => { if (d !== excepto) d.hidden = true; });
}

function alternar(id, render) {
  const d = document.getElementById(id);
  const abrir = d.hidden;
  cerrarDesplegables();
  if (abrir) { d.innerHTML = render(); d.hidden = false; }
}

function panelNotificaciones() {
  const a = alertasSistema();
  return `<div class="desp-tit">Notificaciones · ${a.length}</div>${a.length ? a.map(x => `<button class="desp-item" ${x.doc ? `data-doc="${esc(x.doc)}"` : `data-accion="ir" data-arg="${x.ir}"`}><span class="ic ${x.tono}" style="width:20px;height:20px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:.65rem;flex:none">${x.tono === 'critico' ? '✕' : '!'}</span><span><b>${esc(x.texto)}</b><small>${esc(x.det || '')}</small></span></button>`).join('') : '<div class="desp-vacio">Sin notificaciones.</div>'}`;
}

function panelPerfil() {
  return `<div class="desp-tit">Rol de demostración</div><p class="nota" style="padding:0 8px">No es un sistema de seguridad real: no hay autenticación configurada.</p>${ROLES.map(r => `<button class="desp-item ${r === S.rol ? 'sel' : ''}" data-rol="${r}"><span><b>${esc(USUARIO_ROL[r])}</b><small>${r}${r === S.rol ? ' · actual' : ''}</small></span></button>`).join('')}`;
}

function panelAyuda() {
  return `<div class="desp-tit">Ayuda</div>
    <button class="desp-item" data-accion="ir" data-arg="guia"><span><b>Guía de inicio rápido</b><small>Prueba el flujo completo en 5 minutos</small></span></button>
    <button class="desp-item" id="ayudaBot"><span><b>Preguntar al asistente</b><small>KPIs, inventario, órdenes, cómo hacer cada operación</small></span></button>
    <button class="desp-item" data-accion="ir" data-arg="kpis"><span><b>¿Cómo se calculan los KPIs?</b><small>Cada indicador muestra definición, fórmula y meta</small></span></button>
    <div class="desp-vacio">Cualquier folio subrayado abre el documento con su trazabilidad completa.</div>`;
}

// Buscador global: órdenes, materiales, proveedores, productos y cualquier folio.
function resultadosBusqueda(texto) {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  const r = [];
  const add = (folio, titulo, sub) => r.push({ folio, titulo, sub });
  S.materiales.forEach(m => { if (normalizar(m.codigo + ' ' + m.descripcion + ' ' + m.categoria).includes(q)) add(m.codigo, `${m.codigo} · ${m.descripcion}`, `Material · ${estadoMaterial(m.codigo)} · ${fmt.cant(existencias(m.codigo).disponible, m.unidad)} disponibles`); });
  S.proveedores.forEach(p => { if (normalizar(p.codigo + ' ' + p.razon + ' ' + p.categorias.join(' ')).includes(q)) add(p.codigo, p.razon, `Proveedor · ${p.categorias.join(', ')}`); });
  S.productos.forEach(p => { if (normalizar(p.codigo + ' ' + p.nombre).includes(q)) add(p.codigo, `${p.codigo} · ${p.nombre}`, `Producto · ${fmt.num(disponiblePT(p.codigo))} disponibles`); });
  const docs = [['solicitudes', x => `${x.folio} ${material(x.material).descripcion}`, x => `Solicitud · ${x.estado}`], ['ordenesCompra', x => `${x.folio} ${proveedor(x.proveedor).razon}`, x => `Orden de compra · ${estadoOC(x)}`], ['embarques', x => `${x.folio} ${x.oc}`, x => `Embarque · ${estadoEmbarque(x)}`],
    ['ordenesProduccion', x => `${x.folio} ${producto(x.producto).nombre}`, x => `Orden de producción · ${x.estado}`], ['suministros', x => `${x.folio} ${x.op}`, x => `Suministro · ${x.estado}`], ['pedidos', x => `${x.folio} ${cliente(x.cliente).nombre}`, x => `Pedido · ${estadoPedido(x)}`],
    ['incidencias', x => `${x.folio} ${x.tipo} ${x.descripcion}`, x => `Incidencia · ${x.estado}`], ['recepciones', x => `${x.folio} ${x.oc}`, () => 'Recepción']];
  docs.forEach(([col, txt, sub]) => S[col].slice().reverse().forEach(x => { if (r.length < 40 && normalizar(txt(x)).includes(q)) add(x.folio, txt(x), sub(x)); }));
  S.lotes.forEach(l => { if (r.length < 40 && normalizar(l.lote).includes(q)) add(l.lote, `${l.lote} · ${material(l.material).descripcion}`, `Lote de material · ${l.estado}`); });
  S.lotesPT.forEach(l => { if (r.length < 40 && normalizar(l.lote).includes(q)) add(l.lote, `${l.lote} · ${producto(l.producto).nombre}`, `Lote de producto terminado · ${l.calidad}`); });
  return r.slice(0, 14);
}

function iniciarCabecera() {
  const buscar = document.getElementById('buscarGlobal');
  const res = document.getElementById('buscarRes');
  let sel = 0;
  const pintar = () => {
    const r = resultadosBusqueda(buscar.value);
    sel = Math.min(sel, Math.max(0, r.length - 1));
    res.innerHTML = buscar.value.trim().length < 2 ? '<div class="desp-vacio">Escribe un folio (OC-0012), material, proveedor o producto.</div>'
      : r.length ? r.map((x, i) => `<button class="desp-item ${i === sel ? 'sel' : ''}" data-doc="${esc(x.folio)}"><span><b>${esc(x.titulo)}</b><small>${esc(x.sub)}</small></span></button>`).join('') : '<div class="desp-vacio">Sin resultados.</div>';
    res.hidden = false;
    return r;
  };
  buscar.addEventListener('focus', () => { cerrarDesplegables(res); pintar(); });
  buscar.addEventListener('input', () => { sel = 0; pintar(); });
  buscar.addEventListener('keydown', e => {
    const r = resultadosBusqueda(buscar.value);
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, r.length - 1); pintar(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); pintar(); e.preventDefault(); }
    if (e.key === 'Enter' && r[sel]) { abrirDocumento(r[sel].folio); res.hidden = true; buscar.blur(); }
    if (e.key === 'Escape') { res.hidden = true; buscar.blur(); }
  });
  document.getElementById('btnNotif').onclick = e => { e.stopPropagation(); alternar('despNotif', panelNotificaciones); };
  document.getElementById('btnPerfil').onclick = e => { e.stopPropagation(); alternar('despPerfil', panelPerfil); };
  document.getElementById('btnAyuda').onclick = e => { e.stopPropagation(); alternar('despAyuda', panelAyuda); };
  document.getElementById('btnDemo').onclick = () => { location.hash = '#guia'; };
  document.getElementById('selPeriodo').onchange = e => { periodoDias = Number(e.target.value); refrescar(); };
  document.getElementById('btnContraer').onclick = () => {
    document.body.classList.toggle('menu-contraido');
    try { localStorage.setItem('sc360-menu', document.body.classList.contains('menu-contraido') ? '1' : '0'); } catch (e) { /* preferencia opcional */ }
    setTimeout(() => dibujos.forEach(f => f()), 50);
  };
  document.getElementById('btnMenuMovil').onclick = () => document.body.classList.toggle('menu-abierto');
  document.addEventListener('click', e => {
    if (!e.target.closest('.cab-der, .buscador')) cerrarDesplegables();
    const rol = e.target.closest('[data-rol]');
    if (rol && rol.closest('.desplegable')) { cerrarDesplegables(); cambiarRol(rol.dataset.rol); }
    if (e.target.closest('#ayudaBot')) { cerrarDesplegables(); document.getElementById('botBtn').click(); }
    if (e.target.closest('.desplegable [data-doc], .desplegable [data-accion]')) cerrarDesplegables();
    if (document.body.classList.contains('menu-abierto') && !e.target.closest('.lateral, #btnMenuMovil')) document.body.classList.remove('menu-abierto');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { cerrarDesplegables(); if (docAbierto && !document.getElementById('modal').open) cerrarDocumento(); }
  });
  addEventListener('online', pintarCabecera);
  addEventListener('offline', pintarCabecera);
}

function iniciar() {
  try { if (localStorage.getItem('sc360-menu') === '1' && innerWidth > 860) document.body.classList.add('menu-contraido'); } catch (e) { /* sin preferencias */ }
  // deja pintar el estado de carga antes de generar los datos la primera vez
  setTimeout(() => {
    let origen;
    try { origen = iniciarDatos(); } catch (e) {
      console.error(e);
      document.getElementById('contenido').innerHTML = `<section class="tarjeta"><h1>No se pudieron preparar los datos</h1><p>${esc(e.message)}</p><button class="btn" onclick="localStorage.removeItem('${CLAVE_DATOS}');location.reload()">Regenerar datos de demostración</button></section>`;
      return;
    }
    MODULOS.guia.grupo = null;
    iniciarCabecera();
    iniciarBot();
    const raiz = document.body;
    enlazarAcciones(raiz);
    enlazarTablas(raiz);
    addEventListener('hashchange', () => irA(location.hash.slice(1)));
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => dibujos.forEach(f => f()), 150); });
    moduloActual = '';
    irA(location.hash.slice(1) || 'dashboard');
    if (origen === 'generado') aviso('Se generaron los datos ficticios de demostración: 30 días de operación de NovaManufactura.');
    if (!persistenciaOk) aviso('El navegador no permite guardar datos locales: los cambios se perderán al recargar.', 'mal');
  }, 30);
}

iniciar();
