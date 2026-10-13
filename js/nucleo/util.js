// Utilidades comunes: formato (es-MX, DD/MM/AAAA, MXN), fechas, azar con semilla, HTML.
'use strict';

const ZONA = 'America/Mexico_City';

const fmt = {
  num(n, dec = 0) {
    if (n == null || !Number.isFinite(n)) return '—';
    return Number(n).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  },
  mxn(n, dec = 2) {
    if (n == null || !Number.isFinite(n)) return '—';
    return (n < 0 ? '-$' : '$') + fmt.num(Math.abs(n), dec);
  },
  // Cifras grandes compactas para tarjetas: $1.24 M, $845.2 mil
  mxnCorto(n) {
    if (n == null || !Number.isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e6) return (n < 0 ? '-' : '') + '$' + fmt.num(a / 1e6, 2) + ' M';
    if (a >= 1e4) return (n < 0 ? '-' : '') + '$' + fmt.num(a / 1e3, 1) + ' mil';
    return fmt.mxn(n, 0);
  },
  pct(n, dec = 1) {
    return n == null || !Number.isFinite(n) ? '—' : fmt.num(n, dec) + ' %';
  },
  // ISO AAAA-MM-DD -> DD/MM/AAAA
  fecha(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  },
  // DD/MM
  fechaCorta(iso) {
    if (!iso) return '—';
    const [, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}`;
  },
  fechaHora(isoDT) {
    if (!isoDT) return '—';
    return fmt.fecha(isoDT) + (isoDT.length > 10 ? ' ' + isoDT.slice(11, 16) : '');
  },
  cant(n, unidad) {
    const dec = ['kg', 'L', 'm'].includes(unidad) ? 1 : 0;
    return fmt.num(n, dec) + (unidad ? ' ' + unidad : '');
  },
};

const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function deISO(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function aISO(f) {
  const p = n => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
}
function sumarDias(iso, n) {
  const f = deISO(iso);
  f.setDate(f.getDate() + n);
  return aISO(f);
}
function diasEntre(a, b) {
  return Math.round((deISO(b.slice(0, 10)) - deISO(a.slice(0, 10))) / 86400000);
}
// Días hábiles (lunes a viernes) transcurridos de a a b.
function diasHabilesEntre(a, b) {
  if (b < a) return -diasHabilesEntre(b, a);
  let n = 0;
  for (let f = a; f < b; f = sumarDias(f, 1)) {
    const d = deISO(sumarDias(f, 1)).getDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}
function rangoFechas(desde, hasta) {
  const r = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) r.push(f);
  return r;
}
const diaSemana = iso => deISO(iso).getDay();
const esDomingo = iso => diaSemana(iso) === 0;

// Fecha y hora actuales en la zona horaria de México.
function ahoraMexico() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

// Generador pseudoaleatorio con semilla (mulberry32): los datos de demostración salen idénticos cada vez.
function crearAzar(semilla) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.entre = (min, max) => min + r() * (max - min);
  r.entero = (min, max) => Math.floor(min + r() * (max - min + 1));
  r.elegir = arr => arr[Math.floor(r() * arr.length)];
  r.prob = p => r() < p;
  return r;
}

function normalizar(t) {
  return String(t ?? '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const suma = (arr, fn = x => x) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
const promedio = arr => (arr.length ? suma(arr) / arr.length : null);
const redondear = (n, dec = 2) => Math.round((Number(n) + Number.EPSILON) * 10 ** dec) / 10 ** dec;
const dividir = (a, b) => (b ? a / b : null); // nunca divide entre cero
const agrupar = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); (m[k] = m[k] || []).push(x); return m; }, {});
const clonar = o => JSON.parse(JSON.stringify(o));
// «Resina PLA» -> «resina PLA»; respeta siglas como «LED».
const minusc = t => (t && !(t[1] && t[1] === t[1].toUpperCase() && /[A-Z]/.test(t[1])) ? t[0].toLowerCase() + t.slice(1) : t);
