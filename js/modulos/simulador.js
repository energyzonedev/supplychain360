// Simulador de escenarios logísticos. Calcula sobre una copia de los datos: la
// información de demostración no cambia hasta que el usuario pulsa «Aplicar».
'use strict';

const HORIZONTE = 14; // días de proyección

// Ritmos actuales medidos en el histórico (últimos 14 días).
function ritmosBase() {
  const r = periodoDesde(14);
  const ops = S.ordenesProduccion.filter(o => o.estado === 'Terminada' && enRango(o.finReal, r));
  const porProd = {};
  S.productos.forEach(p => { porProd[p.codigo] = suma(ops.filter(o => o.producto === p.codigo), o => o.aceptada) / 14; });
  const consumo = {};
  S.materiales.forEach(m => { consumo[m.codigo] = suma(S.productos, p => (p.bom[m.codigo] || 0) * porProd[p.codigo]); });
  const minutosLinea = {};
  S.lineas.forEach(l => { minutosLinea[l.codigo] = suma(S.productos.filter(p => p.linea === l.codigo), p => porProd[p.codigo] * p.tEst); });
  return { porProd, consumo, minutosLinea, cumplimiento: calcularKPIs(periodoDesde(14)).find(k => k.clave === 'planProduccion').valor };
}

// Proveedor cuyos materiales tienen la menor cobertura (días de consumo disponibles).
function proveedorMasExpuesto() {
  const cob = S.proveedores.map(p => {
    const mats = S.materiales.filter(m => m.proveedor === p.codigo && m.consumoDiario);
    return { p, c: mats.length ? Math.min(...mats.map(m => (existencias(m.codigo).fisica + enTransito(m.codigo)) / m.consumoDiario)) : Infinity };
  });
  return cob.sort((a, b) => a.c - b.c)[0].p.codigo;
}

const ESCENARIOS = {
  A: {
    nombre: 'Retraso del proveedor', ico: 'camion',
    controles: () => [
      { id: 'prov', t: 'Proveedor', tipo: 'select', ops: S.proveedores.map(p => [p.codigo, p.razon]), def: proveedorMasExpuesto() },
      { id: 'dias', t: 'Días adicionales de entrega', tipo: 'rango', min: 1, max: 15, def: 7, suf: ' días' },
    ],
    calcular(v, base) {
      const prov = proveedor(v.prov);
      const mats = S.materiales.filter(m => m.proveedor === prov.codigo);
      const filas = mats.map(m => {
        // cobertura con el consumo planeado (no con el histórico, que bajó durante el desabasto)
        const disp = existencias(m.codigo).fisica - existencias(m.codigo).bloqueada;
        const c = m.consumoDiario || base.consumo[m.codigo] || 0.0001;
        const cobertura = disp / c;
        const ocs = S.ordenesCompra.filter(o => OC_ABIERTA.includes(o.estado) && o.lineas.some(l => l.material === m.codigo));
        const llegadaBase = ocs.length ? ocs.map(o => o.fechaPrometida).sort()[0] : sumarDias(hoy(), prov.lead + 1);
        const llegadaSim = sumarDias(llegadaBase, Number(v.dias));
        const necesitaBase = Math.max(0, diasEntre(hoy(), llegadaBase));
        const necesitaSim = Math.max(0, diasEntre(hoy(), llegadaSim));
        return { m, cobertura, llegadaBase, llegadaSim, faltaBase: Math.max(0, necesitaBase - cobertura), faltaSim: Math.max(0, necesitaSim - cobertura) };
      });
      const prods = S.productos.filter(p => mats.some(m => p.bom[m.codigo]));
      const diasParoBase = Math.max(0, ...filas.map(f => f.faltaBase)), diasParoSim = Math.max(0, ...filas.map(f => f.faltaSim));
      const uBase = suma(prods, p => base.porProd[p.codigo]) * diasParoBase, uSim = suma(prods, p => base.porProd[p.codigo]) * diasParoSim;
      const plan = suma(Object.values(base.porProd)) * HORIZONTE;
      const riesgo = f => Math.min(100, Math.round(100 * Math.max(0, f) / Math.max(1, Math.min(...filas.map(x => x.cobertura)) + 1)));
      return {
        comparacion: [
          ['Fecha de recepción más próxima', fmt.fecha(filas.map(f => f.llegadaBase).sort()[0]), fmt.fecha(filas.map(f => f.llegadaSim).sort()[0]), 'texto'],
          ['Materiales que se agotarían antes de recibir', filas.filter(f => f.faltaBase > 0).length, filas.filter(f => f.faltaSim > 0).length, 'menor'],
          ['Días de paro estimados (productos afectados)', fmt.num(diasParoBase, 1), fmt.num(diasParoSim, 1), 'menor'],
          ['Unidades en riesgo', fmt.num(uBase), fmt.num(uSim), 'menor'],
          [`Cumplimiento del plan estimado (${HORIZONTE} días)`, fmt.pct(Math.max(0, 100 - 100 * uBase / plan), 1), fmt.pct(Math.max(0, 100 - 100 * uSim / plan), 1), 'mayor'],
          ['Riesgo de retraso de producción', `${riesgo(diasParoBase)} %`, `${riesgo(diasParoSim)} %`, 'menor'],
        ],
        detalle: `<table><thead><tr><th>Material</th><th class="num">Cobertura</th><th>Recepción base</th><th>Recepción simulada</th><th>Resultado</th></tr></thead><tbody>${filas.map(f => `<tr><td>${esc(f.m.descripcion)}</td><td class="num">${fmt.num(f.cobertura, 1)} días</td><td>${fmt.fecha(f.llegadaBase)}</td><td>${fmt.fecha(f.llegadaSim)}</td><td>${f.faltaSim > 0 ? pill(`Faltante ${fmt.num(f.faltaSim, 1)} días`, 'critico') : pill('Cubierto', 'bien')}</td></tr>`).join('')}</tbody></table>
          <p class="nota" style="margin-top:6px">Productos afectados: ${prods.map(p => esc(p.nombre)).join(', ') || 'ninguno'}.</p>`,
        aplicar: `Aumentar el tiempo de entrega de ${prov.razon} a ${prov.lead + Number(v.dias)} días y mover las órdenes abiertas.`,
      };
    },
    aplicar(v) {
      const prov = proveedor(v.prov);
      prov.lead += Number(v.dias);
      S.materiales.filter(m => m.proveedor === prov.codigo).forEach(m => { m.lead = prov.lead; });
      const ocs = S.ordenesCompra.filter(o => o.proveedor === prov.codigo && OC_ABIERTA.includes(o.estado) && !o.lineas.some(l => l.recibido > 0));
      ocs.forEach(o => cambiarCondicionesOC(o.folio, { fechaPrometida: sumarDias(o.fechaPrometida, Number(v.dias)) }));
      auditar('Escenario aplicado', 'SIM-A', `${prov.codigo} +${v.dias} días`);
      return exito(`Aplicado: ${prov.razon} entrega en ${prov.lead} días; ${ocs.length} órdenes reprogramadas.`);
    },
  },
  B: {
    nombre: 'Aumento de demanda', ico: 'kpi',
    controles: () => [{ id: 'pct', t: 'Incremento de demanda', tipo: 'opciones', ops: [[10, '+10 %'], [20, '+20 %'], [30, '+30 %']], def: 20 }],
    calcular(v, base) {
      const f = 1 + Number(v.pct) / 100;
      const lineas = S.lineas.map(l => {
        const usoBase = base.minutosLinea[l.codigo] / l.minutosDia, usoSim = usoBase * f;
        return { l, usoBase, usoSim };
      });
      const faltantes = S.materiales.map(m => {
        const req = (base.consumo[m.codigo] || 0) * f * HORIZONTE;
        const tiene = existencias(m.codigo).disponible + enTransito(m.codigo);
        return { m, adicional: (base.consumo[m.codigo] || 0) * (f - 1) * HORIZONTE, falta: Math.max(0, req - tiene) };
      }).filter(x => x.adicional > 0).sort((a, b) => b.falta - a.falta);
      // Sobre el cumplimiento real: lo limitan la capacidad de la línea más cargada y los materiales nuevos en faltante.
      const faltBase = S.materiales.filter(m => (base.consumo[m.codigo] || 0) * HORIZONTE > existencias(m.codigo).disponible + enTransito(m.codigo)).length;
      const extra = Math.max(0, faltantes.filter(x => x.falta > 0).length - faltBase);
      const cumplSim = Math.max(0, (base.cumplimiento ?? 100) * Math.min(...lineas.map(x => x.usoSim > 0.98 ? 0.98 / x.usoSim : 1)) * (1 - 0.03 * extra));
      return {
        comparacion: [
          ['Demanda diaria (unidades)', fmt.num(suma(Object.values(base.porProd))), fmt.num(suma(Object.values(base.porProd)) * f), 'texto'],
          ...lineas.map(x => [`Utilización de ${x.l.nombre.split(' ·')[0]}`, fmt.pct(100 * x.usoBase, 0), fmt.pct(100 * x.usoSim, 0), 'menor']),
          [`Materiales con faltante en ${HORIZONTE} días`, S.materiales.filter(m => (base.consumo[m.codigo] || 0) * HORIZONTE > existencias(m.codigo).disponible + enTransito(m.codigo)).length, faltantes.filter(x => x.falta > 0).length, 'menor'],
          ['Cumplimiento del plan estimado', fmt.pct(base.cumplimiento ?? 100, 1), fmt.pct(cumplSim, 1), 'mayor'],
        ],
        detalle: `<table><thead><tr><th>Material</th><th class="num">Adicional requerido (${HORIZONTE} días)</th><th class="num">Faltante</th></tr></thead><tbody>${faltantes.slice(0, 10).map(x => `<tr><td>${esc(x.m.descripcion)}</td><td class="num">${fmt.cant(x.adicional, x.m.unidad)}</td><td class="num">${x.falta > 0 ? `<b style="color:var(--rojo)">${fmt.cant(x.falta, x.m.unidad)}</b>` : '0'}</td></tr>`).join('')}</tbody></table>
          <p class="nota" style="margin-top:6px">${lineas.filter(x => x.usoSim > 0.98).map(x => `${esc(x.l.nombre.split(' ·')[0])} rebasaría su capacidad (${fmt.pct(100 * x.usoSim, 0)}).`).join(' ') || 'Las líneas tienen capacidad para absorber el incremento.'}</p>`,
        aplicar: `Crear solicitudes de compra (borrador) para los ${faltantes.filter(x => x.falta > 0).length} materiales con faltante.`,
        _faltantes: faltantes.filter(x => x.falta > 0),
      };
    },
    aplicar(v, res) {
      const creadas = res._faltantes.filter(x => !S.solicitudes.some(s => s.material === x.m.codigo && ABIERTOS_SC.includes(s.estado)))
        .map(x => crearSolicitud({ area: 'Producción', material: x.m.codigo, cantidad: Math.ceil(x.falta), motivo: `Aumento de demanda simulado (+${v.pct} %)`, prioridad: 'Alta', borrador: true, origen: 'Simulador' })).filter(r => r.ok);
      return exito(`Se crearon ${creadas.length} solicitudes en borrador para revisión.`);
    },
  },
  C: {
    nombre: 'Incremento de costos', ico: 'compras',
    controles: () => [
      { id: 'cat', t: 'Materiales afectados', tipo: 'select', ops: [['', 'Todas las categorías'], ...[...new Set(S.materiales.map(m => m.categoria))].map(c => [c, c])], def: '' },
      { id: 'mat', t: 'Aumento en precio de materiales', tipo: 'rango', min: 0, max: 40, def: 10, suf: ' %' },
      { id: 'trans', t: 'Aumento en costo de transporte', tipo: 'rango', min: 0, max: 40, def: 8, suf: ' %' },
    ],
    calcular(v) {
      const fm = m => (!v.cat || m.categoria === v.cat) ? 1 + Number(v.mat) / 100 : 1;
      const ft = 1 + Number(v.trans) / 100;
      const r = periodoDesde(30);
      const k = calcularKPIs(r);
      const K = c => k.find(x => x.clave === c).valor || 0;
      const costoUnit = (p, sim) => suma(Object.entries(p.bom), ([m, q]) => q * material(m).costo * (sim ? fm(material(m)) : 1)) + p.tEst * 1.1 * S.config.costoMinutoProduccion;
      const comprasSim = suma(S.ordenesCompra.filter(o => o.estado !== 'Cancelada' && enRango(o.fechaEmision, r)).flatMap(o => o.lineas), l => l.cantidad * l.precio * fm(material(l.material)));
      const fleteBase = suma(S.embarques.filter(e => e.estado === 'Entregado' && enRango(e.llegada, r)), e => e.costo) + suma(S.pedidos.filter(p => p.despacho && enRango(p.despacho, r)), p => p.costoEnvio);
      return {
        comparacion: [
          ['Costo de compras (30 días)', fmt.mxn(K('costoCompras'), 0), fmt.mxn(comprasSim, 0), 'menor'],
          ['Costo logístico total (30 días)', fmt.mxn(K('costoLogistico'), 0), fmt.mxn(K('costoLogistico') + fleteBase * (ft - 1), 0), 'menor'],
          ['Costo de producción por unidad', fmt.mxn(K('costoUnidadProducida')), fmt.mxn(K('costoUnidadProducida') * (suma(S.productos, p => costoUnit(p, true)) / suma(S.productos, p => costoUnit(p, false)))), 'menor'],
          ['Margen bruto promedio estimado', fmt.pct(promedio(S.productos.map(p => 100 * (p.precio - costoUnit(p, false)) / p.precio)), 1), fmt.pct(promedio(S.productos.map(p => 100 * (p.precio - costoUnit(p, true)) / p.precio)), 1), 'mayor'],
        ],
        detalle: `<table><thead><tr><th>Producto</th><th class="num">Costo unitario base</th><th class="num">Costo simulado</th><th class="num">Precio</th><th class="num">Margen simulado</th></tr></thead><tbody>${S.productos.map(p => `<tr><td>${esc(p.nombre)}</td><td class="num">${fmt.mxn(costoUnit(p, false))}</td><td class="num">${fmt.mxn(costoUnit(p, true))}</td><td class="num">${fmt.mxn(p.precio)}</td><td class="num">${fmt.pct(100 * (p.precio - costoUnit(p, true)) / p.precio, 1)}</td></tr>`).join('')}</tbody></table>`,
        aplicar: `Actualizar el costo vigente de ${v.cat || 'todos los materiales'} (+${v.mat} %) y las tarifas de transporte (+${v.trans} %). El precio de referencia no cambia, así que la variación de precio de las compras futuras lo reflejará.`,
      };
    },
    aplicar(v) {
      S.materiales.filter(m => !v.cat || m.categoria === v.cat).forEach(m => { m.costo = redondear(m.costo * (1 + Number(v.mat) / 100), 4); });
      S.transportistas.forEach(t => { t.base = redondear(t.base * (1 + Number(v.trans) / 100)); t.porKm = redondear(t.porKm * (1 + Number(v.trans) / 100)); });
      auditar('Escenario aplicado', 'SIM-C', `materiales +${v.mat} %, transporte +${v.trans} %`);
      return exito('Costos actualizados. Las nuevas órdenes y embarques usarán los costos simulados.');
    },
  },
  D: {
    nombre: 'Falla de maquinaria', ico: 'fabrica',
    controles: () => [
      { id: 'lin', t: 'Línea', tipo: 'select', ops: S.lineas.map(l => [l.codigo, l.nombre]), def: 'L-B' },
      { id: 'horas', t: 'Horas de paro', tipo: 'rango', min: 1, max: 48, def: 8, suf: ' h' },
      { id: 'cap', t: 'Capacidad durante la recuperación', tipo: 'rango', min: 30, max: 100, def: 70, suf: ' %' },
    ],
    calcular(v, base) {
      const l = linea(v.lin);
      const afectadas = S.ordenesProduccion.filter(o => o.linea === l.codigo && ['Planificada', 'Pendiente de materiales', 'Lista para iniciar', 'En proceso', 'Pausada'].includes(o.estado));
      const minPerdidos = Number(v.horas) * 60 + l.minutosDia * (1 - Number(v.cap) / 100);
      const diasRetraso = minPerdidos / l.minutosDia;
      const prods = S.productos.filter(p => p.linea === l.codigo);
      const unidades = suma(prods, p => base.porProd[p.codigo] * p.tEst) ? minPerdidos / (suma(prods, p => base.porProd[p.codigo] * p.tEst) / suma(prods, p => base.porProd[p.codigo])) : 0;
      const plan = suma(Object.values(base.porProd)) * HORIZONTE;
      return {
        comparacion: [
          ['Capacidad efectiva el día de la falla (min)', fmt.num(l.minutosDia), fmt.num(Math.max(0, l.minutosDia - minPerdidos)), 'mayor'],
          ['Unidades no producidas', '0', fmt.num(unidades), 'menor'],
          ['Retraso estimado de las órdenes', '0 días', `${fmt.num(diasRetraso, 1)} días`, 'menor'],
          [`Cumplimiento del plan estimado (${HORIZONTE} días)`, fmt.pct(base.cumplimiento ?? 100, 1), fmt.pct(Math.max(0, (base.cumplimiento ?? 100) - 100 * unidades / plan), 1), 'mayor'],
          ['Pedidos abiertos de productos de la línea', '—', fmt.num(S.pedidos.filter(p => !['Entregado', 'Cancelado', 'Despachado'].includes(p.estado) && p.lineas.some(x => prods.some(y => y.codigo === x.producto))).length), 'texto'],
        ],
        detalle: `<p><b>Órdenes afectadas en ${esc(l.nombre)}:</b></p>${afectadas.length ? `<table><thead><tr><th>Orden</th><th>Producto</th><th>Fin planificado</th><th>Nuevo fin estimado</th></tr></thead><tbody>${afectadas.map(o => `<tr><td>${docLink(o.folio)}</td><td>${esc(producto(o.producto).nombre)}</td><td>${fmt.fecha(o.finPlan)}</td><td>${fmt.fecha(sumarDias(o.finPlan, Math.ceil(diasRetraso)))}</td></tr>`).join('')}</tbody></table>` : '<p class="vacio">La línea no tiene órdenes abiertas.</p>'}`,
        aplicar: `Registrar el paro como incidencia${afectadas.some(o => o.estado === 'En proceso') ? ' y pausar la orden en proceso' : ''}.`,
      };
    },
    aplicar(v) {
      const l = linea(v.lin);
      const op = S.ordenesProduccion.find(o => o.linea === l.codigo && o.estado === 'En proceso');
      if (op) return pausarOP(op.folio, { causa: 'Falla mecánica', minutos: Number(v.horas) * 60, incidencia: true });
      return crearIncidencia({ area: 'Producción', tipo: 'Paro de maquinaria', operacion: l.codigo, descripcion: `Falla simulada en ${l.nombre}: ${v.horas} h de paro`, severidad: Number(v.horas) >= 8 ? 'Alta' : 'Media', impacto: `Capacidad al ${v.cap} % durante la recuperación`, responsable: USUARIO_ROL['Producción'], accion: 'Mantenimiento correctivo', compromiso: sumarDias(hoy(), 1) });
    },
  },
  E: {
    nombre: 'Reducción de inventario', ico: 'almacen',
    controles: () => [{ id: 'red', t: 'Reducción de mínimos y máximos', tipo: 'rango', min: 5, max: 60, def: 25, suf: ' %' }, { id: 'tasa', t: 'Costo anual de mantener inventario', tipo: 'rango', min: 10, max: 40, def: 25, suf: ' %' }],
    calcular(v, base) {
      const f = 1 - Number(v.red) / 100;
      const filas = S.materiales.map(m => {
        const c = base.consumo[m.codigo] || 0;
        const minSim = Math.round(m.min * f);
        const seguridad = c * m.lead;               // consumo durante el reabastecimiento
        const promBase = (m.min + m.max) / 2, promSim = (minSim + Math.round(m.max * f)) / 2;
        return { m, minSim, riesgo: minSim < seguridad, ahorro: (promBase - promSim) * m.costo };
      });
      const ahorroAnual = suma(filas, x => x.ahorro) * Number(v.tasa) / 100;
      const riesgoBase = S.materiales.filter(m => m.min < (base.consumo[m.codigo] || 0) * m.lead).length;
      return {
        comparacion: [
          ['Inventario promedio objetivo (valor)', fmt.mxn(suma(S.materiales, m => (m.min + m.max) / 2 * m.costo), 0), fmt.mxn(suma(S.materiales, m => (m.min + m.max) / 2 * m.costo) - suma(filas, x => x.ahorro), 0), 'menor'],
          ['Ahorro anual estimado por mantener menos inventario', '$0', fmt.mxn(ahorroAnual, 0), 'mayor'],
          ['Materiales con riesgo de desabasto', riesgoBase, filas.filter(x => x.riesgo).length, 'menor'],
          ['Materiales críticos hoy con la nueva política', S.materiales.filter(m => existencias(m.codigo).fisica < m.min).length, filas.filter(x => existencias(x.m.codigo).fisica < x.minSim).length, 'menor'],
        ],
        detalle: `<table><thead><tr><th>Material</th><th class="num">Mínimo actual</th><th class="num">Mínimo simulado</th><th class="num">Consumo en reposición</th><th>Riesgo</th></tr></thead><tbody>${filas.filter(x => x.riesgo).concat(filas.filter(x => !x.riesgo).slice(0, 4)).map(x => `<tr><td>${esc(x.m.descripcion)}</td><td class="num">${fmt.num(x.m.min)}</td><td class="num">${fmt.num(x.minSim)}</td><td class="num">${fmt.num((base.consumo[x.m.codigo] || 0) * x.m.lead, 0)}</td><td>${x.riesgo ? pill('Desabasto probable', 'critico') : pill('Cubierto', 'bien')}</td></tr>`).join('')}</tbody></table>`,
        aplicar: `Reducir mínimos y máximos de los ${S.materiales.length} materiales en ${v.red} %.`,
      };
    },
    aplicar(v) {
      const f = 1 - Number(v.red) / 100;
      S.materiales.forEach(m => { m.min = Math.round(m.min * f); m.max = Math.round(m.max * f); });
      auditar('Escenario aplicado', 'SIM-E', `mínimos y máximos −${v.red} %`);
      return exito(`Política de inventario ajustada: mínimos y máximos −${v.red} %.`);
    },
  },
};

MODULOS.simulador = {
  titulo: 'Simulador de escenarios', icono: 'simulador', grupo: 'Análisis', esc: 'A', valores: {}, historial: [], resultado: null,
  render(main) {
    const e = ESCENARIOS[this.esc];
    const ctrls = e.controles();
    const v = this.valores[this.esc] = this.valores[this.esc] || Object.fromEntries(ctrls.map(c => [c.id, c.def]));
    main.innerHTML = `
      ${encabezado('Simulador de escenarios logísticos', 'Las simulaciones se calculan en un entorno controlado: los datos no cambian hasta que pulses «Aplicar cambios».')}
      <div class="pestanas">${Object.entries(ESCENARIOS).map(([k, x]) => `<button class="${k === this.esc ? 'activa' : ''}" data-esc="${k}">${k} · ${esc(x.nombre)}</button>`).join('')}</div>
      <div>
        <section class="tarjeta"><h2>${icono(e.ico)} Escenario ${this.esc}: ${esc(e.nombre)}</h2>
          <div class="form-campos" style="margin:12px 0">${ctrls.map(c => `<label class="campo ${c.tipo === 'rango' ? 'completo' : ''}"><span>${esc(c.t)}</span>${c.tipo === 'select' ? `<select data-sv="${c.id}">${c.ops.map(([a, b]) => `<option value="${esc(a)}" ${String(v[c.id]) === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`
            : c.tipo === 'opciones' ? `<div class="acciones-fila">${c.ops.map(([a, b]) => `<button type="button" class="chip ${String(v[c.id]) === String(a) ? 'on' : ''}" data-svo="${c.id}" data-val="${a}">${b}</button>`).join('')}</div>`
              : `<div class="control-rango"><input type="range" data-sv="${c.id}" min="${c.min}" max="${c.max}" value="${v[c.id]}"><output>${v[c.id]}${c.suf}</output></div>`}</label>`).join('')}</div>
          <div class="acciones-fila"><button class="btn" id="sEjecutar">${icono('play')} Ejecutar simulación</button><button class="btn btn-sec" id="sReset">Restablecer valores</button>${this.resultado && this.resultado.esc === this.esc ? btnAcc('', '', 'Aplicar cambios', { clase: 'btn-verde', permiso: 'simulador.aplicar' }).replace('data-accion=""', 'id="sAplicar"') : ''}</div>
          <div id="sRes" style="margin-top:16px">${this.resultado && this.resultado.esc === this.esc ? resultadoHTML(this.resultado.r) : '<p class="vacio">Ajusta las variables y pulsa «Ejecutar simulación» para comparar la situación base contra el escenario.</p>'}</div>
        </section>
        <section class="tarjeta"><h2>Comparar escenarios ejecutados</h2>${this.historial.length ? `<div class="tabla-cont"><table><thead><tr><th>#</th><th>Escenario</th><th>Variables</th><th>Indicador principal</th><th>Base</th><th>Simulado</th></tr></thead><tbody>${this.historial.map((h, i) => `<tr><td>${i + 1}</td><td>${esc(h.nombre)}</td><td>${esc(h.vars)}</td><td>${esc(h.ind[0])}</td><td class="num">${esc(String(h.ind[1]))}</td><td class="num">${esc(String(h.ind[2]))}</td></tr>`).join('')}</tbody></table></div><button class="btn btn-sec btn-chico" id="sLimpiar" style="margin-top:8px">Limpiar comparación</button>` : '<p class="vacio">Cada simulación que ejecutes se agrega aquí para compararla con las demás.</p>'}</section>
      </div>`;
    main.querySelectorAll('[data-esc]').forEach(b => b.onclick = () => { this.esc = b.dataset.esc; refrescar(); });
    main.querySelectorAll('[data-sv]').forEach(el => el.addEventListener('input', () => {
      v[el.dataset.sv] = el.value;
      const out = el.parentElement.querySelector('output');
      if (out) out.textContent = el.value + (ctrls.find(c => c.id === el.dataset.sv).suf || '');
    }));
    main.querySelectorAll('[data-svo]').forEach(b => b.onclick = () => { v[b.dataset.svo] = b.dataset.val; refrescar(); });
    main.querySelector('#sReset').onclick = () => { delete this.valores[this.esc]; this.resultado = null; refrescar(); };
    main.querySelector('#sEjecutar').onclick = () => {
      const r = e.calcular(v, ritmosBase());
      this.resultado = { esc: this.esc, r, v: { ...v } };
      const principal = r.comparacion.find(x => x[3] !== 'texto') || r.comparacion[0];
      this.historial.push({ nombre: `${this.esc} · ${e.nombre}`, vars: ctrls.map(c => `${c.t}: ${c.tipo === 'select' ? (c.ops.find(o => String(o[0]) === String(v[c.id])) || [])[1] : v[c.id] + (c.suf || '')}`).join('; '), ind: principal });
      refrescar();
    };
    main.querySelector('#sLimpiar')?.addEventListener('click', () => { this.historial = []; refrescar(); });
    main.querySelector('#sAplicar')?.addEventListener('click', () => {
      const res = this.resultado;
      confirmar(`${res.r.aplicar} Esto modifica los datos de demostración y queda en la auditoría.`, { titulo: 'Aplicar escenario', boton: 'Aplicar cambios' }).then(si => {
        if (!si) return;
        const out = e.aplicar(res.v, res.r);
        guardar();
        this.resultado = null;
        operar(out);
      });
    });
  },
};

function resultadoHTML(r) {
  return `<div class="tabla-cont comparacion"><table><thead><tr><th>Indicador</th><th class="num">Situación base</th><th class="num">Escenario simulado</th></tr></thead><tbody>${r.comparacion.map(([n, b, s, sentido]) => {
    const nb = parseFloat(String(b).replace(/[^0-9.-]/g, '')), ns = parseFloat(String(s).replace(/[^0-9.-]/g, ''));
    const cls = sentido === 'texto' || !Number.isFinite(nb) || !Number.isFinite(ns) || nb === ns ? '' : ((ns < nb) === (sentido === 'menor') ? 'mejor' : 'peor');
    return `<tr><td>${esc(n)}</td><td class="num">${esc(String(b))}</td><td class="num ${cls}">${esc(String(s))}</td></tr>`;
  }).join('')}</tbody></table></div><div style="margin-top:12px">${r.detalle}</div>`;
}
