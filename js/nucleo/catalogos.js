// Catálogos ficticios de NovaManufactura México. Datos de demostración: ningún
// proveedor, cliente, persona ni correo corresponde a una entidad real.
'use strict';

const EMPRESA = {
  nombre: 'NovaManufactura México S.A. de C.V.',
  corto: 'NovaManufactura',
  planta: 'Planta Querétaro · Parque Industrial El Marqués (ficticio)',
  eslogan: 'Visibilidad total. Decisiones inteligentes. Operaciones eficientes',
};

// El histórico de demostración cubre los 30 días que terminan aquí.
const FECHA_BASE = '2026-10-13';
const DIAS_HISTORIA = 30;

const ROLES = ['Administrador', 'Compras', 'Almacén', 'Producción', 'Logística', 'Dirección'];
const USUARIO_ROL = {
  'Administrador': 'Ana Torres',
  'Compras': 'Luis Mendoza',
  'Almacén': 'Carmen Ruiz',
  'Producción': 'Jorge Salinas',
  'Logística': 'Patricia Vega',
  'Dirección': 'Ricardo Ibarra',
};

const AREAS = ['Producción', 'Almacén', 'Mantenimiento', 'Calidad', 'Compras', 'Logística'];
const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Urgente'];

const PROVEEDORES = [
  { codigo: 'PRV-001', razon: 'Aceros del Norte Demo S.A. de C.V.', contacto: 'Ing. Raúl Garza', categorias: ['Metales'], lead: 5, km: 690, puntualidad: 0.93, calificacion: 4.3 },
  { codigo: 'PRV-002', razon: 'Aluminios del Bajío Demo S.A.', contacto: 'Lic. Sofía Herrera', categorias: ['Metales'], lead: 4, km: 180, puntualidad: 0.95, calificacion: 4.5 },
  { codigo: 'PRV-003', razon: 'Polímeros Industriales Demo S.A. de C.V.', contacto: 'Ing. Mario Castro', categorias: ['Plásticos'], lead: 4, km: 35, puntualidad: 0.90, calificacion: 4.0 },
  { codigo: 'PRV-004', razon: 'ElectroComponentes del Centro Demo', contacto: 'Ing. Daniela Ríos', categorias: ['Electrónicos'], lead: 8, km: 220, puntualidad: 0.88, calificacion: 3.9 },
  { codigo: 'PRV-005', razon: 'Tornillería y Sujetadores Demo S.A.', contacto: 'Sr. Alberto Núñez', categorias: ['Tornillería'], lead: 3, km: 690, puntualidad: 0.97, calificacion: 4.7 },
  { codigo: 'PRV-006', razon: 'Empaques Corrugados del Valle Demo', contacto: 'Lic. Karla Medina', categorias: ['Empaques'], lead: 3, km: 60, puntualidad: 0.96, calificacion: 4.6 },
  { codigo: 'PRV-007', razon: 'Etiquetas y Códigos Demo S.A.', contacto: 'Lic. Óscar Lara', categorias: ['Etiquetas'], lead: 2, km: 215, puntualidad: 0.98, calificacion: 4.8 },
  { codigo: 'PRV-008', razon: 'Lubricantes Técnicos Demo S.A. de C.V.', contacto: 'Ing. Elena Paredes', categorias: ['Lubricantes'], lead: 4, km: 330, puntualidad: 0.94, calificacion: 4.2 },
  { codigo: 'PRV-009', razon: 'Pinturas Industriales Demo S.A.', contacto: 'Sr. Fernando Ortiz', categorias: ['Pinturas'], lead: 5, km: 140, puntualidad: 0.91, calificacion: 4.1 },
  { codigo: 'PRV-010', razon: 'Cables y Conductores Demo S.A.', contacto: 'Ing. Mónica Silva', categorias: ['Cables'], lead: 6, km: 170, puntualidad: 0.92, calificacion: 4.0 },
  { codigo: 'PRV-011', razon: 'Adhesivos Especiales Demo S.A. de C.V.', contacto: 'Lic. Andrés Pineda', categorias: ['Adhesivos'], lead: 5, km: 350, puntualidad: 0.90, calificacion: 3.8 },
  { codigo: 'PRV-012', razon: 'Suministros Industriales Integrales Demo', contacto: 'Sra. Laura Campos', categorias: ['Auxiliares', 'Empaques'], lead: 2, km: 25, puntualidad: 0.97, calificacion: 4.4 },
].map(p => ({ ...p, correo: `ventas.${p.codigo.toLowerCase()}@proveedor-demo.test`, estado: 'Activo', zona: ZONA_PROVEEDOR(p.codigo) }));

function ZONA_PROVEEDOR(c) {
  return {
    'PRV-001': 'Monterrey, N.L. (zona ficticia norte)', 'PRV-002': 'León, Gto. (zona Bajío)', 'PRV-003': 'Querétaro, Qro. (zona local)',
    'PRV-004': 'Ciudad de México (zona centro)', 'PRV-005': 'Monterrey, N.L. (zona norte)', 'PRV-006': 'San Juan del Río, Qro.',
    'PRV-007': 'Ciudad de México (zona centro)', 'PRV-008': 'Puebla, Pue. (zona oriente)', 'PRV-009': 'Toluca, Edo. Méx.',
    'PRV-010': 'Pachuca, Hgo.', 'PRV-011': 'Guadalajara, Jal. (zona occidente)', 'PRV-012': 'Querétaro, Qro. (zona local)',
  }[c];
}

// costo = costo unitario actual; precioRef = precio de referencia pactado (para la variación de precio).
const MATERIALES = [
  ['MAT-001', 'Lámina de acero calibre 18', 'Metales', 'kg', 28.5, 'PRV-001', 'A-01'],
  ['MAT-002', 'Barra de acero 1/2"', 'Metales', 'kg', 31.0, 'PRV-001', 'A-02'],
  ['MAT-003', 'Perfil de aluminio 20×20 mm', 'Metales', 'm', 64.0, 'PRV-002', 'A-03'],
  ['MAT-004', 'Lámina de aluminio 1 mm', 'Metales', 'kg', 72.0, 'PRV-002', 'A-04'],
  ['MAT-005', 'Resina de polipropileno (PP)', 'Plásticos', 'kg', 34.0, 'PRV-003', 'B-01'],
  ['MAT-006', 'Resina ABS', 'Plásticos', 'kg', 46.0, 'PRV-003', 'B-02'],
  ['MAT-007', 'Masterbatch de color', 'Plásticos', 'kg', 95.0, 'PRV-003', 'B-03'],
  ['MAT-008', 'Tarjeta electrónica de control', 'Electrónicos', 'pza', 185.0, 'PRV-004', 'C-01'],
  ['MAT-009', 'Sensor de proximidad', 'Electrónicos', 'pza', 92.0, 'PRV-004', 'C-02'],
  ['MAT-010', 'LED indicador', 'Electrónicos', 'pza', 4.5, 'PRV-004', 'C-03'],
  ['MAT-011', 'Tornillo M4 × 12', 'Tornillería', 'pza', 0.65, 'PRV-005', 'D-01'],
  ['MAT-012', 'Remache pop 3/16"', 'Tornillería', 'pza', 0.4, 'PRV-005', 'D-02'],
  ['MAT-013', 'Bisagra de acero inoxidable', 'Tornillería', 'pza', 12.5, 'PRV-005', 'D-03'],
  ['MAT-014', 'Caja de cartón corrugado', 'Empaques', 'pza', 9.8, 'PRV-006', 'E-01'],
  ['MAT-015', 'Separador de cartón', 'Empaques', 'pza', 2.1, 'PRV-006', 'E-02'],
  ['MAT-016', 'Bolsa de polietileno', 'Empaques', 'pza', 0.9, 'PRV-012', 'E-03'],
  ['MAT-017', 'Etiqueta de producto', 'Etiquetas', 'pza', 0.75, 'PRV-007', 'E-04'],
  ['MAT-018', 'Etiqueta de código de barras', 'Etiquetas', 'pza', 0.35, 'PRV-007', 'E-05'],
  ['MAT-019', 'Lubricante industrial', 'Lubricantes', 'L', 88.0, 'PRV-008', 'F-01'],
  ['MAT-020', 'Pintura electrostática negra', 'Pinturas', 'kg', 110.0, 'PRV-009', 'F-02'],
  ['MAT-021', 'Primer anticorrosivo', 'Pinturas', 'L', 76.0, 'PRV-009', 'F-03'],
  ['MAT-022', 'Cable calibre 22 AWG', 'Cables', 'm', 3.2, 'PRV-010', 'C-04'],
  ['MAT-023', 'Adhesivo epóxico', 'Adhesivos', 'kg', 210.0, 'PRV-011', 'F-04'],
  ['MAT-024', 'Cinta doble cara', 'Adhesivos', 'm', 1.8, 'PRV-011', 'F-05'],
  ['MAT-025', 'Película stretch', 'Auxiliares', 'kg', 42.0, 'PRV-012', 'G-01'],
].map(([codigo, descripcion, categoria, unidad, costo, proveedor, ubicacion]) => ({
  codigo, descripcion, categoria, unidad, costo, precioRef: costo, proveedor, ubicacion, activo: true,
  // min, max y lead se calculan en la semilla a partir del consumo planeado
  min: 0, max: 0, lead: 0,
}));

const LINEAS = [
  { codigo: 'L-A', nombre: 'Línea A · Inyección y ensamble plástico', minutosDia: 960 },
  { codigo: 'L-B', nombre: 'Línea B · Metalmecánica', minutosDia: 960 },
  { codigo: 'L-C', nombre: 'Línea C · Ensamble electrónico', minutosDia: 960 },
];

// bom: cantidad de material por unidad. tEst: minutos estándar por unidad.
const PRODUCTOS = [
  { codigo: 'PT-001', nombre: 'EcoBox Industrial', linea: 'L-A', precio: 420, tEst: 6.0,
    bom: { 'MAT-005': 1.2, 'MAT-001': 0.6, 'MAT-011': 8, 'MAT-013': 2, 'MAT-020': 0.05, 'MAT-014': 1, 'MAT-017': 1 } },
  { codigo: 'PT-002', nombre: 'EcoBox Mini', linea: 'L-A', precio: 210, tEst: 3.5,
    bom: { 'MAT-005': 0.6, 'MAT-011': 4, 'MAT-013': 2, 'MAT-016': 1, 'MAT-017': 1 } },
  { codigo: 'PT-003', nombre: 'Caja de Herramientas Pro', linea: 'L-B', precio: 690, tEst: 9.0,
    bom: { 'MAT-001': 1.8, 'MAT-013': 2, 'MAT-012': 12, 'MAT-020': 0.12, 'MAT-021': 0.08, 'MAT-014': 1, 'MAT-018': 1 } },
  { codigo: 'PT-004', nombre: 'Gabinete Metálico G2', linea: 'L-B', precio: 1450, tEst: 14.0,
    bom: { 'MAT-001': 3.2, 'MAT-002': 0.8, 'MAT-013': 2, 'MAT-011': 16, 'MAT-020': 0.2, 'MAT-014': 1, 'MAT-018': 1 } },
  { codigo: 'PT-005', nombre: 'Organizador Modular', linea: 'L-A', precio: 260, tEst: 4.0,
    bom: { 'MAT-006': 0.9, 'MAT-007': 0.03, 'MAT-015': 2, 'MAT-016': 1, 'MAT-017': 1 } },
  { codigo: 'PT-006', nombre: 'Contenedor Apilable', linea: 'L-A', precio: 300, tEst: 4.5,
    bom: { 'MAT-005': 1.5, 'MAT-007': 0.04, 'MAT-024': 0.5, 'MAT-016': 1, 'MAT-018': 1 } },
  { codigo: 'PT-007', nombre: 'Caja Inteligente IoT', linea: 'L-C', precio: 2350, tEst: 18.0,
    bom: { 'MAT-006': 1.1, 'MAT-008': 1, 'MAT-009': 1, 'MAT-010': 2, 'MAT-022': 1.2, 'MAT-011': 6, 'MAT-023': 0.02, 'MAT-014': 1, 'MAT-017': 1 } },
  { codigo: 'PT-008', nombre: 'Charola Industrial de Aluminio', linea: 'L-B', precio: 780, tEst: 8.0,
    bom: { 'MAT-004': 1.4, 'MAT-003': 1.6, 'MAT-012': 8, 'MAT-019': 0.01, 'MAT-025': 0.05, 'MAT-018': 1 } },
];

// Las seis etapas de manufactura y la fracción del tiempo estándar de cada una.
const ETAPAS = [
  { n: 1, nombre: 'Preparación de materiales', frac: 0.10 },
  { n: 2, nombre: 'Corte y acondicionamiento', frac: 0.20 },
  { n: 3, nombre: 'Ensamble', frac: 0.35 },
  { n: 4, nombre: 'Inspección de calidad', frac: 0.10 },
  { n: 5, nombre: 'Empaque', frac: 0.15 },
  { n: 6, nombre: 'Transferencia a almacén de PT', frac: 0.10 },
];

const CAUSAS_DEFECTO = ['Rebaba en pieza inyectada', 'Dimensión fuera de tolerancia', 'Falla de ensamble', 'Daño superficial / pintura', 'Componente electrónico defectuoso', 'Empaque dañado'];
const CAUSAS_PARO = ['Falla mecánica', 'Cambio de molde / herramental', 'Falta de material', 'Mantenimiento correctivo', 'Falla eléctrica', 'Ajuste de calidad'];

const CLIENTES = [
  { codigo: 'CLI-001', nombre: 'Distribuidora Ferretera del Centro (demo)', zona: 'CDMX', km: 220 },
  { codigo: 'CLI-002', nombre: 'Almacenes Industriales MX (demo)', zona: 'Monterrey', km: 690 },
  { codigo: 'CLI-003', nombre: 'Logística Total del Bajío (demo)', zona: 'León', km: 180 },
  { codigo: 'CLI-004', nombre: 'Comercializadora Norte (demo)', zona: 'Saltillo', km: 610 },
  { codigo: 'CLI-005', nombre: 'Hogar y Orden Retail (demo)', zona: 'Guadalajara', km: 350 },
  { codigo: 'CLI-006', nombre: 'TecnoRetail Industrial (demo)', zona: 'Querétaro', km: 30 },
];

const TRANSPORTISTAS = [
  { codigo: 'TR-01', nombre: 'Fletes Rápidos del Bajío (demo)', vehiculo: 'Camioneta 3.5 t', capacidadKg: 3500, base: 1800, porKm: 14 },
  { codigo: 'TR-02', nombre: 'Transportes Altiplano (demo)', vehiculo: 'Rabón 8 t', capacidadKg: 8000, base: 2600, porKm: 19 },
  { codigo: 'TR-03', nombre: 'Carga Nacional Integral (demo)', vehiculo: 'Tráiler 28 t', capacidadKg: 28000, base: 4200, porKm: 27 },
];

const TIPOS_INCIDENCIA = ['Retraso del proveedor', 'Daño durante el transporte', 'Diferencias de inventario', 'Faltante de materiales', 'Defectos de fabricación', 'Paro de maquinaria', 'Pedido incompleto', 'Error documental'];
const SEVERIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];

// Configuración inicial (editable en Configuración).
const CONFIG_INICIAL = {
  iva: 0.16,
  costoMinutoProduccion: 6.5,     // mano de obra y gastos de fabricación por minuto de línea
  costoAlmacenDia: 1800,          // operación diaria del almacén
  posicionesAlmacen: 600,
  metas: {
    proveedores: 95, variacionPrecio: 3, cicloCompras: 2, entradaATiempo: 95, costoTransporteUnidad: 2.5,
    exactitud: 98, rotacionAnual: 12, criticos: 5, planProduccion: 95, calidad: 98, eficiencia: 90, oee: 85,
    otif: 95, costoLogisticoUnidad: 70, desperdicio: 3, cicloAbastecimiento: 10,
  },
};
