// Componentes de interfaz reutilizables: iconos, estados, tablas interactivas,
// formularios con validación, confirmaciones, avisos y gráficas en SVG.
'use strict';

// ------------------------------------------------------------------ iconos
const ICONOS = {
  tablero: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  solicitud: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  compras: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
  camion: '<path d="M1 5h13v11H1zM14 9h4l4 4v3h-8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/>',
  almacen: '<path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M7 21v-8h10v8M7 17h10"/>',
  suministro: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  planeacion: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h3M8 17h6"/>',
  fabrica: '<path d="M2 21V9l6 4V9l6 4V5l8 4v12z"/><path d="M6 17h2M11 17h2M16 17h2"/>',
  caja: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  pedido: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  kpi: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
  reporte: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 17v-3M12 17v-6M15 17v-2"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  incidencia: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  simulador: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  proveedor: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  campana: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  ayuda: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  cerrar: '<path d="M18 6L6 18M6 6l12 12"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  flecha: '<path d="M15 18l-6-6 6-6"/>',
  descarga: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  play: '<path d="M5 3l14 9-14 9z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  bot: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4M8 4h8M9 14h.01M15 14h.01"/>',
  chispa: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  logo: '<path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6a6 6 0 1 0 6 6"/><circle cx="12" cy="12" r="2"/><path d="M22 2l-8 8"/>',
};
const icono = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n] || ''}</svg>`;

// ------------------------------------------------------------------ estados
const TONO_ESTADO = {
  'Borrador': 'neutro', 'Pendiente de autorización': 'alerta', 'Autorizada': 'info', 'Rechazada': 'critico', 'Convertida en orden de compra': 'violeta', 'Cerrada': 'bien',
  'Pendiente': 'alerta', 'Enviada': 'info', 'Confirmada': 'info', 'Parcialmente recibida': 'alerta', 'Recibida': 'bien', 'Cancelada': 'neutro', 'Cancelado': 'neutro', 'Retrasada': 'critico',
  'Programado': 'neutro', 'En preparación': 'info', 'En tránsito': 'info', 'En revisión de recepción': 'violeta', 'Entregado': 'bien', 'Retrasado': 'critico', 'Incidencia reportada': 'critico',
  'Disponible': 'bien', 'Cuarentena': 'alerta', 'Dañado': 'critico', 'Normal': 'bien', 'Bajo': 'alerta', 'Crítico': 'critico', 'Agotado': 'critico', 'Exceso': 'violeta',
  'Preparando': 'info', 'Surtido parcial': 'alerta', 'Surtido completo': 'bien',
  'Planificada': 'neutro', 'Pendiente de materiales': 'critico', 'Lista para iniciar': 'info', 'En proceso': 'info', 'Pausada': 'alerta', 'Terminada': 'bien',
  'Aprobado': 'bien', 'Bloqueado': 'critico',
  'Registrado': 'neutro', 'Reservado': 'info', 'Reservado parcial': 'alerta', 'Despachado': 'violeta',
  'Abierta': 'critico', 'En atención': 'alerta', 'Resuelta': 'bien',
  'Baja': 'neutro', 'Media': 'info', 'Alta': 'alerta', 'Urgente': 'critico', 'Crítica': 'critico',
  'Conciliado': 'bien', 'Con diferencia': 'alerta',
};
const SIMBOLO = { bien: '✓', alerta: '!', critico: '✕', info: '•', neutro: '·', violeta: '◆' };
function pill(texto, tono) {
  const t = tono || TONO_ESTADO[texto] || 'neutro';
  return `<span class="pill p-${t}"><b aria-hidden="true">${SIMBOLO[t]}</b>${esc(texto)}</span>`;
}
const docLink = folio => folio ? `<button class="doc" data-doc="${esc(folio)}" title="Ver documento y relaciones">${esc(folio)}</button>` : '<span class="tenue">—</span>';
function barraProgreso(pct, tono) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return `<span class="barra-prog ${tono || (p >= 100 ? 'bien' : '')}"><span style="width:${p}%"></span></span> <span class="mono">${fmt.num(p, 0)} %</span>`;
}

// ------------------------------------------------------------------ avisos
function aviso(mensaje, tipo = 'ok') {
  const cont = document.getElementById('avisos');
  const a = document.createElement('div');
  a.className = `aviso ${tipo}`;
  a.setAttribute('role', tipo === 'mal' ? 'alert' : 'status');
  a.innerHTML = `<span>${esc(mensaje)}</span><button aria-label="Cerrar aviso">✕</button>`;
  a.querySelector('button').onclick = () => a.remove();
  cont.appendChild(a);
  setTimeout(() => a.remove(), tipo === 'mal' ? 9000 : 5500);
}

// Ejecuta una operación de negocio, avisa y redibuja.
function operar(resultado, { redibujar = true } = {}) {
  aviso(resultado.mensaje, resultado.ok ? 'ok' : 'mal');
  if (resultado.ok && redibujar) refrescar();
  return resultado;
}

// ---------------------------------------------------------- modal genérico
function abrirModal(html, ancho = false) {
  const dlg = document.getElementById('modal');
  dlg.className = 'modal' + (ancho ? ' ancho' : '');
  dlg.innerHTML = html;
  if (!dlg.open) dlg.showModal();
  return dlg;
}
const cerrarModal = () => { const d = document.getElementById('modal'); if (d.open) d.close(); };

function confirmar(mensaje, { titulo = 'Confirmar', boton = 'Confirmar', peligro = false } = {}) {
  return new Promise(ok => {
    const dlg = abrirModal(`<form method="dialog" class="form"><h2>${esc(titulo)}</h2><p>${esc(mensaje)}</p>
      <div class="form-acc"><button value="no" class="btn btn-sec">Cancelar</button><button value="si" class="btn ${peligro ? 'btn-peligro' : ''}">${esc(boton)}</button></div></form>`);
    dlg.addEventListener('close', () => ok(dlg.returnValue === 'si'), { once: true });
    dlg.returnValue = 'no';
  });
}

// Formulario con validación. campos: {id, etiqueta, tipo, requerido, opciones, valor, min, max, paso, ayuda, completo, columnas (para 'lineas')}
function formulario({ titulo, intro = '', campos, boton = 'Guardar', alEnviar, alCambiar, ancho = false, calculo = false }) {
  const opcionesHTML = (ops, val) => ops.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${esc(t)}</option>`;
  }).join('');
  const control = c => {
    const req = c.requerido ? 'required' : '';
    const attrs = `name="${c.id}" id="f-${c.id}" ${req} ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''} ${c.paso ? `step="${c.paso}"` : ''}`;
    if (c.tipo === 'select') return `<select ${attrs}>${c.vacio ? `<option value="">${esc(c.vacio)}</option>` : ''}${opcionesHTML(c.opciones, c.valor)}</select>`;
    if (c.tipo === 'textarea') return `<textarea ${attrs}>${esc(c.valor ?? '')}</textarea>`;
    if (c.tipo === 'checkbox') return `<input type="checkbox" ${attrs} ${c.valor ? 'checked' : ''}>`;
    if (c.tipo === 'info') return `<div class="calculo">${c.html}</div>`;
    if (c.tipo === 'lineas') return lineasHTML(c);
    return `<input type="${c.tipo || 'text'}" ${attrs} value="${esc(c.valor ?? '')}">`;
  };
  const lineasHTML = c => `<div class="lineas-form" data-lineas="${c.id}"><div class="tabla-cont"><table><thead><tr>${c.columnas.map(k => `<th>${esc(k.etiqueta)}</th>`).join('')}<th></th></tr></thead><tbody>${(c.filas && c.filas.length ? c.filas : [{}]).map(f => filaLinea(c, f)).join('')}</tbody></table></div>
    <button type="button" class="btn btn-sec btn-chico" data-agregar="${c.id}" style="margin-top:6px">${icono('mas')} Agregar renglón</button></div>`;
  const filaLinea = (c, f) => `<tr>${c.columnas.map(k => `<td>${k.tipo === 'select'
    ? `<select data-col="${k.id}"><option value="">—</option>${opcionesHTML(k.opciones, f[k.id])}</select>`
    : `<input data-col="${k.id}" type="${k.tipo || 'number'}" step="${k.paso || 'any'}" min="0" value="${esc(f[k.id] ?? '')}">`}</td>`).join('')}<td><button type="button" class="btn btn-sec btn-chico" data-quitar aria-label="Quitar renglón">✕</button></td></tr>`;

  const dlg = abrirModal(`<form class="form" novalidate>
    <h2>${esc(titulo)}</h2>${intro ? `<p class="nota">${intro}</p>` : ''}
    <div class="form-campos">${campos.map(c => c.tipo === 'checkbox'
      ? `<label class="campo campo-check ${c.completo ? 'completo' : ''}">${control(c)}<span>${esc(c.etiqueta)}</span></label>`
      : `<label class="campo ${c.completo || ['lineas', 'textarea', 'info'].includes(c.tipo) ? 'completo' : ''}" data-campo="${c.id}"><span>${esc(c.etiqueta || '')}${c.requerido ? ' <span class="req">*</span>' : ''}</span>${control(c)}${c.ayuda ? `<small>${c.ayuda}</small>` : ''}</label>`).join('')}</div>
    ${calculo ? '<div class="calculo" data-calculo></div>' : ''}
    <p class="form-error" role="alert"></p>
    <div class="form-acc"><button type="button" class="btn btn-sec" data-cancelar>Cancelar</button><button type="submit" class="btn">${esc(boton)}</button></div>
  </form>`, ancho);
  const form = dlg.querySelector('form');
  const leer = () => {
    const v = {};
    campos.forEach(c => {
      if (c.tipo === 'lineas') {
        v[c.id] = [...form.querySelectorAll(`[data-lineas="${c.id}"] tbody tr`)].map(tr => {
          const f = {};
          tr.querySelectorAll('[data-col]').forEach(el => { f[el.dataset.col] = el.value; });
          return f;
        }).filter(f => Object.values(f).some(x => x !== ''));
      } else if (c.tipo === 'checkbox') v[c.id] = form.elements[c.id].checked;
      else if (c.tipo !== 'info') v[c.id] = form.elements[c.id].value.trim();
    });
    return v;
  };
  const actualizar = () => {
    if (alCambiar) {
      const out = alCambiar(leer(), form);
      const el = form.querySelector('[data-calculo]');
      if (el && out != null) el.innerHTML = out;
    }
  };
  form.addEventListener('input', actualizar);
  form.addEventListener('change', actualizar);
  form.addEventListener('click', e => {
    const ag = e.target.closest('[data-agregar]');
    if (ag) {
      const c = campos.find(x => x.id === ag.dataset.agregar);
      form.querySelector(`[data-lineas="${c.id}"] tbody`).insertAdjacentHTML('beforeend', filaLinea(c, {}));
      actualizar();
    }
    const q = e.target.closest('[data-quitar]');
    if (q) { const tb = q.closest('tbody'); if (tb.children.length > 1) q.closest('tr').remove(); actualizar(); }
  });
  form.querySelector('[data-cancelar]').onclick = cerrarModal;
  form.onsubmit = e => {
    e.preventDefault();
    form.querySelectorAll('.invalido').forEach(x => x.classList.remove('invalido'));
    const v = leer();
    const faltan = campos.filter(c => c.requerido && c.tipo !== 'lineas' && (v[c.id] === '' || v[c.id] == null));
    const err = form.querySelector('.form-error');
    if (faltan.length) {
      faltan.forEach(c => form.querySelector(`[data-campo="${c.id}"]`)?.classList.add('invalido'));
      err.textContent = `Completa los campos obligatorios: ${faltan.map(c => c.etiqueta).join(', ')}.`;
      return;
    }
    for (const c of campos) {
      if (c.tipo === 'number' && v[c.id] !== '') {
        const n = Number(v[c.id]);
        if (!Number.isFinite(n) || (c.min != null && n < c.min) || (c.max != null && n > c.max)) {
          form.querySelector(`[data-campo="${c.id}"]`)?.classList.add('invalido');
          err.textContent = `«${c.etiqueta}» debe ser un número${c.min != null ? ` mayor o igual a ${c.min}` : ''}${c.max != null ? ` y menor o igual a ${c.max}` : ''}.`;
          return;
        }
      }
    }
    const r = alEnviar(v);
    if (r && r.ok === false) { err.textContent = r.mensaje; return; }
    cerrarModal();
    if (r && r.mensaje) operar(r);
  };
  actualizar();
  setTimeout(() => form.querySelector('input:not([type=checkbox]), select, textarea')?.focus(), 30);
  return form;
}

// -------------------------------------------------------- tabla interactiva
// Búsqueda, filtros, ordenamiento por columna, paginación y exportación a CSV.
const TABLAS = {};
const estadoTablas = {};

function tabla(id, cfg) {
  TABLAS[id] = cfg;
  estadoTablas[id] = estadoTablas[id] || { q: '', f: {}, orden: cfg.orden ? cfg.orden[0] : null, dir: cfg.orden ? cfg.orden[1] : 'desc', pag: 0 };
  return `<div class="tabla-int" id="tbl-${id}">${cuerpoTabla(id)}</div>`;
}

function filasFiltradas(id) {
  const cfg = TABLAS[id], st = estadoTablas[id];
  let filas = cfg.filas;
  const q = normalizar(st.q);
  if (q) filas = filas.filter(f => normalizar(cfg.columnas.map(c => (c.o ? c.o(f) : '')).join(' ') + ' ' + (cfg.texto ? cfg.texto(f) : '')).includes(q));
  (cfg.filtros || []).forEach(fl => { const v = st.f[fl.id]; if (v) filas = filas.filter(f => String(fl.valor(f)) === v); });
  if (st.orden != null) {
    const col = cfg.columnas.find(c => c.t === st.orden);
    if (col && col.o) {
      const s = st.dir === 'asc' ? 1 : -1;
      filas = filas.slice().sort((a, b) => { const x = col.o(a), y = col.o(b); return (x > y ? 1 : x < y ? -1 : 0) * s; });
    }
  }
  return filas;
}

function cuerpoTabla(id) {
  const cfg = TABLAS[id], st = estadoTablas[id];
  const filas = filasFiltradas(id);
  const porPag = cfg.porPagina || 12;
  const paginas = Math.max(1, Math.ceil(filas.length / porPag));
  st.pag = Math.min(st.pag, paginas - 1);
  const vis = filas.slice(st.pag * porPag, (st.pag + 1) * porPag);
  const filtros = (cfg.filtros || []).map(fl => {
    const ops = fl.opciones || [...new Set(cfg.filas.map(fl.valor))].filter(x => x !== '' && x != null).sort();
    return `<select data-tfiltro="${id}" data-f="${fl.id}" aria-label="${esc(fl.t)}"><option value="">${esc(fl.t)}: todos</option>${ops.map(o => `<option ${String(o) === st.f[fl.id] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  }).join('');
  const cab = cfg.columnas.map(c => `<th class="${c.num ? 'num' : ''}" scope="col">${c.o ? `<button data-torden="${id}" data-col="${esc(c.t)}">${esc(c.t)}${st.orden === c.t ? (st.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>` : esc(c.t)}</th>`).join('');
  const cuerpo = vis.length ? vis.map(f => `<tr class="${cfg.claseFila ? cfg.claseFila(f) : ''}">${cfg.columnas.map(c => `<td class="${c.num ? 'num' : ''}">${c.v(f)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${cfg.columnas.length}" class="vacio">${esc(cfg.vacio || 'Sin registros con estos filtros.')}</td></tr>`;
  return `${cfg.sinBarra ? '' : `<div class="tabla-barra">
      ${cfg.buscar === false ? '' : `<label class="buscar">${icono('buscar')}<input type="search" data-tbuscar="${id}" value="${esc(st.q)}" placeholder="${esc(cfg.placeholder || 'Buscar…')}" aria-label="Buscar en la tabla"></label>`}
      ${filtros}
      <div class="der">${cfg.extra || ''}${cfg.exportar ? `<button class="btn btn-sec btn-chico" data-texportar="${id}">${icono('descarga')} CSV</button>` : ''}</div>
    </div>`}
    <div class="tabla-cont"><table><thead><tr>${cab}</tr></thead><tbody>${cuerpo}</tbody></table></div>
    <div class="paginacion"><span>${fmt.num(filas.length)} registro${filas.length === 1 ? '' : 's'}${filas.length !== cfg.filas.length ? ` de ${fmt.num(cfg.filas.length)}` : ''}</span>
      ${paginas > 1 ? `<div><button class="btn btn-sec btn-chico" data-tpag="${id}" data-d="-1" ${st.pag === 0 ? 'disabled' : ''}>Anterior</button><span style="align-self:center">Página ${st.pag + 1} de ${paginas}</span><button class="btn btn-sec btn-chico" data-tpag="${id}" data-d="1" ${st.pag >= paginas - 1 ? 'disabled' : ''}>Siguiente</button></div>` : ''}</div>`;
}

function redibujarTabla(id, enfocarBusqueda = false) {
  const el = document.getElementById('tbl-' + id);
  if (!el) return;
  el.innerHTML = cuerpoTabla(id);
  if (enfocarBusqueda) { const i = el.querySelector('[data-tbuscar]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

function exportarCSV(nombre, encabezado, columnas, filas, notas = []) {
  const celda = v => {
    const s = v == null ? '' : typeof v === 'number' ? String(redondear(v, 4)) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [
    ...encabezado.map(l => celda(l)),
    '',
    columnas.map(celda).join(','),
    ...filas.map(f => f.map(celda).join(',')),
    ...(notas.length ? ['', ...notas.map(celda)] : []),
  ];
  descargar(`${nombre}.csv`, '﻿' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
}

function descargar(nombreArchivo, contenido, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

function exportarTabla(id) {
  const cfg = TABLAS[id];
  const cols = cfg.columnas.filter(c => c.o);
  exportarCSV(`sc360-${cfg.exportar}-${hoy()}`, [`SupplyChain 360 AI · ${EMPRESA.nombre}`, `Tabla: ${cfg.titulo || cfg.exportar}`, `Generado: ${fmt.fechaHora(ahoraMexico())} (hora de México)`, 'Datos ficticios de demostración'],
    cols.map(c => c.t), filasFiltradas(id).map(f => cols.map(c => c.o(f))));
}

// Eventos delegados de todas las tablas.
function enlazarTablas(raiz) {
  raiz.addEventListener('input', e => {
    const b = e.target.closest('[data-tbuscar]');
    if (b) { const id = b.dataset.tbuscar; estadoTablas[id].q = b.value; estadoTablas[id].pag = 0; redibujarTabla(id, true); }
  });
  raiz.addEventListener('change', e => {
    const f = e.target.closest('[data-tfiltro]');
    if (f) { const id = f.dataset.tfiltro; estadoTablas[id].f[f.dataset.f] = f.value; estadoTablas[id].pag = 0; redibujarTabla(id); }
  });
  raiz.addEventListener('click', e => {
    const o = e.target.closest('[data-torden]');
    if (o) {
      const st = estadoTablas[o.dataset.torden];
      if (st.orden === o.dataset.col) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.orden = o.dataset.col; st.dir = 'asc'; }
      redibujarTabla(o.dataset.torden);
    }
    const p = e.target.closest('[data-tpag]');
    if (p) { estadoTablas[p.dataset.tpag].pag += Number(p.dataset.d); redibujarTabla(p.dataset.tpag); }
    const x = e.target.closest('[data-texportar]');
    if (x) exportarTabla(x.dataset.texportar);
  });
}

// ------------------------------------------------------------------ gráficas
const SVG_NS = 'http://www.w3.org/2000/svg';
const COLORES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

function marcasEje(min, max, n = 4) {
  if (max === min) max = min + 1;
  const bruto = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map(m => m * mag).find(p => p >= bruto);
  const r = [];
  for (let v = Math.floor(min / paso) * paso; v <= Math.ceil(max / paso) * paso + paso / 2; v += paso) r.push(redondear(v, 6));
  return r;
}

const leyenda = series => (series.length < 2 ? '' : `<div class="leyenda">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('')}</div>`);

function marco(el, { etiquetas, alto = 230, yMin, yMax, formato, meta, etqFormato = fmt.fechaCorta }) {
  const ancho = Math.max(280, el.clientWidth || 600);
  const m = { i: 58, d: 12, a: 12, b: 26 };
  const n = etiquetas.length;
  const paso = (ancho - m.i - m.d) / n;
  const x = i => m.i + (i + 0.5) * paso;
  const marcas = marcasEje(yMin, yMax);
  const y0 = marcas[0], y1 = marcas[marcas.length - 1];
  const y = v => m.a + (alto - m.a - m.b) * (1 - (v - y0) / (y1 - y0 || 1));
  let s = `<svg viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img">`;
  marcas.forEach(v => { s += `<line class="g-rejilla" x1="${m.i}" x2="${ancho - m.d}" y1="${y(v)}" y2="${y(v)}"/><text class="g-eje" x="${m.i - 6}" y="${y(v) + 4}" text-anchor="end">${esc(formato(v, true))}</text>`; });
  s += `<line class="g-base" x1="${m.i}" x2="${ancho - m.d}" y1="${y(y0)}" y2="${y(y0)}"/>`;
  const cada = Math.max(1, Math.ceil(n / ((ancho - m.i) / 56)));
  etiquetas.forEach((f, i) => { if (i % cada === 0) s += `<text class="g-eje" x="${x(i)}" y="${alto - 8}" text-anchor="middle">${esc(etqFormato(f))}</text>`; });
  if (meta) s += `<line class="g-meta" x1="${m.i}" x2="${ancho - m.d}" y1="${y(meta.valor)}" y2="${y(meta.valor)}"/><text class="g-meta-txt" x="${ancho - m.d - 4}" y="${y(meta.valor) - 5 < m.a + 10 ? y(meta.valor) + 14 : y(meta.valor) - 5}" text-anchor="end">${esc(meta.etiqueta)}</text>`;
  return { s, ancho, alto, m, paso, x, y, y0, n };
}

function lectura(el, g, etiquetas, texto, etqLarga = fmt.fecha) {
  const svg = el.querySelector('svg');
  const guia = document.createElementNS(SVG_NS, 'line');
  guia.setAttribute('class', 'g-guia'); guia.setAttribute('y1', g.m.a); guia.setAttribute('y2', g.alto - g.m.b); guia.style.display = 'none';
  svg.appendChild(guia);
  const globo = document.createElement('div');
  globo.className = 'globo'; globo.hidden = true;
  el.appendChild(globo);
  const capa = document.createElementNS(SVG_NS, 'rect');
  capa.setAttribute('x', g.m.i); capa.setAttribute('y', 0); capa.setAttribute('width', g.ancho - g.m.i - g.m.d); capa.setAttribute('height', g.alto); capa.setAttribute('fill', 'transparent');
  svg.appendChild(capa);
  const mover = ev => {
    const c = svg.getBoundingClientRect();
    const px = (ev.clientX - c.left) * (g.ancho / c.width);
    const i = Math.min(g.n - 1, Math.max(0, Math.floor((px - g.m.i) / g.paso)));
    guia.setAttribute('x1', g.x(i)); guia.setAttribute('x2', g.x(i)); guia.style.display = '';
    globo.innerHTML = `<strong>${esc(etqLarga(etiquetas[i]))}</strong>${texto(i)}`;
    globo.hidden = false;
    const xr = g.x(i) * (c.width / g.ancho);
    const izq = xr > c.width / 2;
    globo.style.left = izq ? '' : `${xr + 12}px`;
    globo.style.right = izq ? `${c.width - xr + 12}px` : '';
  };
  capa.addEventListener('pointermove', mover);
  capa.addEventListener('pointerdown', mover);
  capa.addEventListener('pointerleave', () => { guia.style.display = 'none'; globo.hidden = true; });
}

// Líneas: los null son huecos (no se dibujan como cero).
function graficaLineas(el, { etiquetas, series, formato = v => fmt.num(v), yMin, yMax, meta, alto, etqFormato, etqLarga }) {
  if (!el) return;
  const vals = series.flatMap(s => s.valores).filter(v => v != null);
  if (!vals.length) { el.innerHTML = '<p class="vacio">Sin datos suficientes en el periodo.</p>'; return; }
  const g = marco(el, { etiquetas, alto, formato, meta, etqFormato, yMin: yMin ?? Math.min(...vals, meta ? meta.valor : Infinity), yMax: yMax ?? Math.max(...vals, meta ? meta.valor : -Infinity) });
  let s = g.s;
  // Los días sin dato (domingos, días sin entregas) no se dibujan como cero: la línea
  // une los días que sí tienen dato y cada uno lleva su punto.
  series.forEach(se => {
    const pts = se.valores.map((v, i) => (v == null ? null : [g.x(i), g.y(v)])).filter(Boolean);
    const d = pts.map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    s += `<path class="g-linea" d="${d}" stroke="${se.color}"/>`;
    const r = pts.length > 40 ? 2.5 : 3.5;
    pts.forEach(p => { s += `<circle class="g-punto" cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${se.color}"/>`; });
  });
  el.innerHTML = leyenda(series) + s + '</svg>';
  lectura(el, g, etiquetas, i => series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.nombre)}: <b>${se.valores[i] == null ? 'sin datos' : formato(se.valores[i])}</b></span>`).join(''), etqLarga);
}

// Barras (apiladas cuando hay varias series).
function graficaBarras(el, { etiquetas, series, formato = v => fmt.num(v), meta, alto, etqFormato = x => x, etqLarga = x => x }) {
  if (!el) return;
  const tot = etiquetas.map((_, i) => suma(series, s => s.valores[i] || 0));
  if (!tot.some(v => v > 0)) { el.innerHTML = '<p class="vacio">Sin datos suficientes en el periodo.</p>'; return; }
  const g = marco(el, { etiquetas, alto, formato, meta, etqFormato, yMin: 0, yMax: Math.max(...tot, meta ? meta.valor : 0) });
  let s = g.s;
  const w = Math.min(28, g.paso * 0.62);
  etiquetas.forEach((_, i) => {
    let acum = 0;
    const vis = series.filter(se => se.valores[i] > 0);
    vis.forEach((se, j) => {
      const v = se.valores[i];
      const yb = g.y(acum + v), alto = Math.max(0, g.y(acum) - yb - (j > 0 ? 2 : 0));
      const x0 = g.x(i) - w / 2;
      if (j === vis.length - 1 && alto > 4) s += `<path d="M${x0} ${yb + alto}V${yb + 4}Q${x0} ${yb} ${x0 + 4} ${yb}H${x0 + w - 4}Q${x0 + w} ${yb} ${x0 + w} ${yb + 4}V${yb + alto}Z" fill="${se.color}"/>`;
      else s += `<rect x="${x0}" y="${yb}" width="${w}" height="${alto}" fill="${se.color}"/>`;
      acum += v;
    });
  });
  el.innerHTML = leyenda(series) + s + '</svg>';
  lectura(el, g, etiquetas, i => (series.length > 1 ? series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.nombre)}: <b>${formato(se.valores[i] || 0)}</b></span>`).join('') : '') + `<span>Total: <b>${formato(tot[i])}</b></span>`, etqLarga);
}

// Dona con leyenda y porcentajes.
function graficaDona(el, { datos, formato = v => fmt.num(v), centro = '' }) {
  if (!el) return;
  const total = suma(datos, d => d.valor);
  if (!total) { el.innerHTML = '<p class="vacio">Sin datos.</p>'; return; }
  const R = 70, r = 46, cx = 85, cy = 85;
  let a0 = -Math.PI / 2, s = `<svg viewBox="0 0 170 170" role="img">`;
  datos.forEach(d => {
    const a1 = a0 + 2 * Math.PI * d.valor / total;
    const gap = datos.length > 1 ? 0.012 : 0;
    const p = (ang, rad) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    if (datos.length === 1) s += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${d.color}" stroke-width="${R - r}"/>`;
    else s += `<path d="M${p(a0 + gap, R)}A${R} ${R} 0 ${grande} 1 ${p(a1 - gap, R)}L${p(a1 - gap, r)}A${r} ${r} 0 ${grande} 0 ${p(a0 + gap, r)}Z" fill="${d.color}"><title>${esc(d.nombre)}: ${esc(formato(d.valor))}</title></path>`;
    a0 = a1;
  });
  s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="g-etq" style="font-size:13px;fill:var(--tinta)">${esc(centro)}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" class="g-eje">total</text></svg>`;
  el.innerHTML = `<div class="dona">${s}<ul>${datos.map(d => `<li><i style="width:10px;height:10px;border-radius:3px;background:${d.color}"></i>${esc(d.nombre)}<b>${esc(formato(d.valor))} · ${fmt.pct(100 * d.valor / total, 0)}</b></li>`).join('')}</ul></div>`;
}
