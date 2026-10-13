// Estado de la aplicación, persistencia, folios, auditoría y permisos de demostración.
//
// Persistencia: no hay servidor configurado. Se usa el almacenamiento local del
// navegador mediante un adaptador; para migrar a una base relacional (por ejemplo
// Supabase) basta con implementar los mismos tres métodos en otro adaptador.
'use strict';

const CLAVE_DATOS = 'sc360-datos-v1';
const VERSION_DATOS = 1;

const AdaptadorLocal = {
  nombre: 'Almacenamiento local del navegador (localStorage)',
  conectado: true,
  cargar() {
    try { return JSON.parse(localStorage.getItem(CLAVE_DATOS) || 'null'); } catch (e) { return null; }
  },
  guardar(estado) {
    try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(estado)); return true; } catch (e) { return false; }
  },
  borrar() {
    try { localStorage.removeItem(CLAVE_DATOS); } catch (e) { /* sin almacenamiento */ }
  },
};

// Interfaz preparada para una base de datos remota. No está conectada: no hay
// credenciales configuradas, y el sistema no finge lo contrario. Ver README.md.
const AdaptadorSupabase = {
  nombre: 'Supabase (no configurado)',
  conectado: false,
  url: '', claveAnonima: '',
  cargar() { throw new Error('Supabase no está configurado.'); },
  guardar() { throw new Error('Supabase no está configurado.'); },
  borrar() { throw new Error('Supabase no está configurado.'); },
};

let S = null;               // el estado completo
let adaptador = AdaptadorLocal;
let persistenciaOk = true;

function estadoVacio() {
  return {
    version: VERSION_DATOS,
    config: clonar(CONFIG_INICIAL),
    rol: 'Administrador',
    relojSim: null, horaSim: '09:00',
    contadores: {},
    proveedores: clonar(PROVEEDORES),
    materiales: clonar(MATERIALES),
    productos: clonar(PRODUCTOS),
    lineas: clonar(LINEAS),
    clientes: clonar(CLIENTES),
    transportistas: clonar(TRANSPORTISTAS),
    lotes: [], solicitudes: [], ordenesCompra: [], embarques: [], recepciones: [], movimientos: [],
    suministros: [], ordenesProduccion: [], operaciones: [], lotesPT: [], pedidos: [], incidencias: [],
    conteos: [], auditoria: [],
  };
}

// ------------------------------------------------------------------ reloj

// Fecha operativa: durante la generación del histórico es la fecha simulada; después,
// la fecha de hoy en México (o la fecha base, si el reloj del equipo va atrás).
function hoy() {
  if (S && S.relojSim) return S.relojSim;
  const h = ahoraMexico().slice(0, 10);
  return h > FECHA_BASE ? h : FECHA_BASE;
}
function ahora() {
  if (S && S.relojSim) return `${S.relojSim}T${S.horaSim}`;
  const a = ahoraMexico();
  return a.slice(0, 10) >= FECHA_BASE ? a : `${FECHA_BASE}T${a.slice(11, 16)}`;
}

function nuevoFolio(prefijo) {
  const n = (S.contadores[prefijo] || 0) + 1;
  S.contadores[prefijo] = n;
  return `${prefijo}-${String(n).padStart(4, '0')}`;
}

const usuarioActual = () => (S.relojSim ? 'Sistema (histórico)' : USUARIO_ROL[S.rol]);

function auditar(accion, folio, detalle = '') {
  S.auditoria.push({ fecha: ahora(), usuario: usuarioActual(), rol: S.relojSim ? 'Sistema' : S.rol, accion, folio, detalle });
}

function guardar() {
  if (S.relojSim) return;
  persistenciaOk = adaptador.guardar(S);
}

// --------------------------------------------------------------- permisos
// Selector de rol de DEMOSTRACIÓN: no es un sistema de seguridad. Sin autenticación
// real, cualquiera puede cambiar de rol; sólo sirve para mostrar la segregación de funciones.

const PERMISOS = {
  'solicitud.crear': ['Administrador', 'Compras', 'Almacén', 'Producción'],
  'solicitud.autorizar': ['Administrador', 'Compras', 'Dirección'],
  'compra': ['Administrador', 'Compras'],
  'proveedor': ['Administrador', 'Compras'],
  'embarque': ['Administrador', 'Logística', 'Compras'],
  'recepcion': ['Administrador', 'Almacén'],
  'inventario': ['Administrador', 'Almacén'],
  'suministro': ['Administrador', 'Almacén', 'Producción'],
  'produccion': ['Administrador', 'Producción'],
  'excepcion': ['Administrador'],
  'terminado': ['Administrador', 'Almacén', 'Producción'],
  'pedido': ['Administrador', 'Logística'],
  'incidencia': ['Administrador', 'Compras', 'Almacén', 'Producción', 'Logística'],
  'configuracion': ['Administrador'],
  'simulador.aplicar': ['Administrador', 'Dirección'],
};

function puede(permiso) {
  if (!S || S.relojSim) return true;
  return (PERMISOS[permiso] || []).includes(S.rol);
}

function sinPermiso(permiso) {
  return { ok: false, mensaje: `El rol de demostración «${S.rol}» no puede realizar esta acción. Roles permitidos: ${(PERMISOS[permiso] || []).join(', ')}.` };
}

// --------------------------------------------------------------- búsquedas

const material = c => S.materiales.find(m => m.codigo === c);
const producto = c => S.productos.find(p => p.codigo === c);
const proveedor = c => S.proveedores.find(p => p.codigo === c);
const cliente = c => S.clientes.find(x => x.codigo === c);
const transportista = c => S.transportistas.find(t => t.codigo === c);
const linea = c => S.lineas.find(l => l.codigo === c);
const buscarPor = (col, folio) => S[col].find(x => x.folio === folio);

// Resuelve cualquier folio o código al tipo de documento que es.
const TIPOS_DOC = {
  SC: ['solicitudes', 'Solicitud de compra', 'solicitudes'],
  OC: ['ordenesCompra', 'Orden de compra', 'compras'],
  EMB: ['embarques', 'Embarque', 'transporte'],
  REC: ['recepciones', 'Recepción', 'almacen'],
  SUM: ['suministros', 'Solicitud de suministro', 'suministro'],
  OP: ['ordenesProduccion', 'Orden de producción', 'planeacion'],
  OPE: ['operaciones', 'Operación de manufactura', 'manufactura'],
  PED: ['pedidos', 'Pedido de cliente', 'pedidos'],
  INC: ['incidencias', 'Incidencia', 'incidencias'],
  MOV: ['movimientos', 'Movimiento de inventario', 'almacen'],
  CNT: ['conteos', 'Conteo físico', 'almacen'],
};

function documento(folio) {
  if (!folio) return null;
  const f = String(folio).toUpperCase();
  if (/^L-/.test(f)) { const l = S.lotes.find(x => x.lote === f); return l && { tipo: 'Lote de material', col: 'lotes', reg: l, modulo: 'almacen' }; }
  if (/^LPT-/.test(f)) { const l = S.lotesPT.find(x => x.lote === f); return l && { tipo: 'Lote de producto terminado', col: 'lotesPT', reg: l, modulo: 'terminados' }; }
  if (/^MAT-/.test(f)) { const m = material(f); return m && { tipo: 'Material', col: 'materiales', reg: m, modulo: 'almacen' }; }
  if (/^PRV-/.test(f)) { const p = proveedor(f); return p && { tipo: 'Proveedor', col: 'proveedores', reg: p, modulo: 'compras' }; }
  if (/^PT-/.test(f)) { const p = producto(f); return p && { tipo: 'Producto', col: 'productos', reg: p, modulo: 'terminados' }; }
  const pre = f.split('-')[0];
  const t = TIPOS_DOC[pre];
  if (!t) return null;
  const reg = buscarPor(t[0], f);
  return reg && { tipo: t[1], col: t[0], reg, modulo: t[2] };
}

// ------------------------------------------------------------ arranque

function iniciarDatos() {
  const guardado = adaptador.cargar();
  if (guardado && guardado.version === VERSION_DATOS) {
    S = guardado;
    S.relojSim = null;
    return 'cargado';
  }
  S = generarDemostracion();
  guardar();
  return 'generado';
}

function restaurarDemostracion() {
  adaptador.borrar();
  S = generarDemostracion();
  guardar();
}
