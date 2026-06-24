import { useState } from 'react'
import { useData } from '../DataContext.jsx'
import { formatPesos, formatUSD, formatFecha, formatMes, diasParaVencer } from '../utils.js'
import EditarPagoModal from './EditarPagoModal.jsx'
import EditarContratoModal from './EditarContratoModal.jsx'
import EditarMantModal from './EditarMantModal.jsx'
import NuevoContratoModal from './NuevoContratoModal.jsx'
import Modal, { Campo, Input, Textarea } from './Modal.jsx'
import { ARQUILER_URL, registrarActualizacion } from './ActualizacionICL.jsx'

// URLs de las oficinas virtuales de cada servicio (verificadas)
function getServicioUrl(label, valor, ciudad) {
  const esCaba = ciudad?.toLowerCase().includes('caba')
  const esEdenor = valor?.toLowerCase().includes('edenor')
  switch (label) {
    case 'Aguas':
      return esCaba
        ? 'https://oficinavirtual.aysa.com.ar'
        : 'https://aguasrionegrinas.com/oficina-virtual/'
    case 'EDERSA / Edenor':
      return esEdenor
        ? 'https://www.edenordigital.com'
        : 'https://tramites.edersa.com.ar'
    case 'Camuzzi':
      return 'https://oficinavirtual.camuzzigas.com.ar/'
    case 'Municipal':
      if (ciudad?.toLowerCase().includes('cipolletti')) return 'https://www.cipolletti.gob.ar'
      if (ciudad?.toLowerCase().includes('oro')) return 'https://fernandezoro.gob.ar'
      if (esCaba) return 'https://lb.agip.gob.ar/ConsultaABL/'
      return null
    case 'Rentas pvcia':
      if (esCaba) return 'https://www.arba.gov.ar'
      return 'https://agencia.rionegro.gov.ar/'
    default:
      return null
  }
}

// ─── Tab Pagos ───────────────────────────────────────────────────────────────

function FilaPago({ pago, contratoMonto, onClick }) {
  const esperado = pago.MontoEsperado ?? contratoMonto ?? 0
  const cobrado = pago.Monto ?? 0
  const expExtr = pago['exp extraordinarias'] ?? 0
  const descuento = pago.descuento ?? 0
  const totalDescuentos = expExtr + descuento
  const diferencia = cobrado - esperado

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 0',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
      }}
    >
      {/* Cabecera: período + estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          {pago.Periodo ? formatMes(pago.Periodo) : '—'}
        </div>
        <span className={`badge ${pago.Pagado ? 'badge-green' : 'badge-red'}`}>
          {pago.Pagado ? '✓ Cobrado' : 'Pendiente'}
        </span>
      </div>

      {/* Grilla: esperado / cobrado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: totalDescuentos > 0 ? 8 : 0 }}>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Alquiler</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatPesos(esperado)}</div>
        </div>
        <div style={{
          background: diferencia < -1000 ? '#fee2e2' : diferencia > 1000 ? '#dcfce7' : 'var(--bg)',
          borderRadius: 8, padding: '8px 10px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Cobrado</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: diferencia < -1000 ? 'var(--red)' : diferencia > 1000 ? 'var(--green)' : 'var(--text)' }}>
            {formatPesos(cobrado)}
          </div>
        </div>
      </div>

      {/* Descuentos */}
      {expExtr > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--orange)', background: '#ffedd5', borderRadius: 6, padding: '5px 8px', marginBottom: 4 }}>
          <span>↳ Expensas extraordinarias (propietario)</span>
          <span>- {formatPesos(expExtr)}</span>
        </div>
      )}
      {descuento > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--accent)', background: '#dbeafe', borderRadius: 6, padding: '5px 8px', marginBottom: 4 }}>
          <span>↳ {pago.descuentoDetalle || 'Descuento'}</span>
          <span>- {formatPesos(descuento)}</span>
        </div>
      )}

      {/* Footer: fecha + diferencia */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: totalDescuentos > 0 ? 6 : 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {formatFecha(pago.FechaPago)}
        </div>
        {Math.abs(diferencia) > 1000 && (
          <div style={{ fontSize: 12, color: diferencia < 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
            {diferencia > 0 ? '+' : ''}{formatPesos(diferencia)} vs esperado
          </div>
        )}
      </div>

      {pago.observaciones && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>
          {pago.observaciones}
        </div>
      )}
    </div>
  )
}

function TabPagos({ contrato }) {
  const { getPagosContrato, editarPago, agregarPago, eliminarPago } = useData()
  const [modal, setModal] = useState(null) // null | {pago} | 'nuevo'

  const pagos = getPagosContrato(contrato.IdContrato)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{pagos.length} pagos</span>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setModal('nuevo')}>
          + Agregar
        </button>
      </div>

      {pagos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)' }}>Sin pagos registrados</div>
      )}

      {pagos.map(p => (
        <FilaPago
          key={p.idpago}
          pago={p}
          contratoMonto={contrato.MontoInicial}
          onClick={() => setModal(p)}
        />
      ))}

      {modal && (
        <EditarPagoModal
          pago={modal === 'nuevo' ? null : modal}
          contratoMonto={contrato.MontoInicial}
          onCerrar={() => setModal(null)}
          onGuardar={datos => {
            if (modal === 'nuevo') agregarPago({ ...datos, IdContrato: contrato.IdContrato })
            else editarPago(modal.idpago, datos)
            setModal(null)
          }}
          onEliminar={modal !== 'nuevo' ? () => { eliminarPago(modal.idpago); setModal(null) } : null}
        />
      )}
    </div>
  )
}

// ─── Tab Contrato ─────────────────────────────────────────────────────────────

function PanelActualizacionMonto({ contrato }) {
  const { editarContrato } = useData()
  const [modo, setModo] = useState(null) // null | 'porcentaje' | 'monto'
  const [valor, setValor] = useState('')

  const actual = contrato.MontoInicial

  // Calcular nuevo monto según modo
  const nuevoMonto = modo === 'porcentaje'
    ? Math.round(actual * (1 + parseFloat(valor || 0) / 100))
    : Math.round(parseFloat(valor || actual))
  const variacion = nuevoMonto - actual
  const pct = actual > 0 ? ((variacion / actual) * 100).toFixed(1) : 0

  function aplicar(tipo) {
    if (nuevoMonto <= 0 || nuevoMonto === actual) return
    registrarActualizacion(contrato, nuevoMonto, tipo, editarContrato)
    setModo(null)
    setValor('')
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Actualizar monto
      </div>

      {/* Botones de modo */}
      {!modo && (
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={ARQUILER_URL} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 12px', borderRadius: 8,
              background: '#dbeafe', border: '1px solid #bfdbfe',
              fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none',
            }}
          >
            Ver ICL ↗
          </a>
          <button
            onClick={() => { setModo('porcentaje'); setValor('') }}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
            }}
          >
            % Porcentaje
          </button>
          <button
            onClick={() => { setModo('monto'); setValor(String(Math.round(actual))) }}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
            }}
          >
            $ Monto
          </button>
        </div>
      )}

      {/* Input según modo */}
      {modo && (
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)', fontSize: 15 }}>
                {modo === 'porcentaje' ? '%' : '$'}
              </span>
              <input
                type="number"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder={modo === 'porcentaje' ? 'Ej: 12.5' : String(Math.round(actual))}
                autoFocus
                style={{
                  width: '100%', padding: '11px 12px 11px 28px',
                  borderRadius: 8, border: '2px solid var(--accent)',
                  fontSize: 17, fontWeight: 700, background: 'var(--surface)', color: 'var(--text)',
                }}
              />
            </div>
            <button onClick={() => setModo(null)} style={{ color: 'var(--text3)', fontSize: 20, padding: '0 4px' }}>×</button>
          </div>

          {/* Preview resultado */}
          {valor !== '' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {formatPesos(actual)} → <strong>{formatPesos(nuevoMonto)}</strong>
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: variacion > 0 ? '#dcfce7' : '#fee2e2',
                color: variacion > 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {variacion > 0 ? '+' : ''}{pct}%
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => aplicar('ICL')}
              disabled={!valor || nuevoMonto === actual}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: 'var(--accent)', color: 'white',
                opacity: (!valor || nuevoMonto === actual) ? 0.4 : 1,
              }}
            >
              Aplicar ICL
            </button>
            <button
              onClick={() => aplicar('Manual')}
              disabled={!valor || nuevoMonto === actual}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
                opacity: (!valor || nuevoMonto === actual) ? 0.4 : 1,
              }}
            >
              Aplicar manual
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HistorialICL({ historial }) {
  if (!historial?.length) return null

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Historial de actualizaciones
      </div>
      {[...historial].reverse().map((h, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 14 }}>
              {formatPesos(h.montoAnterior)} → <strong>{formatPesos(h.montoNuevo)}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {formatFecha(h.fecha)}
              {h.tipo && h.tipo !== 'ICL' && (
                <span style={{ marginLeft: 6, color: 'var(--text3)' }}>· {h.tipo}</span>
              )}
            </div>
          </div>
          <span style={{
            fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: h.porcentaje >= 0 ? '#dcfce7' : '#fee2e2',
            color: h.porcentaje >= 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {h.porcentaje >= 0 ? '+' : ''}{h.porcentaje}%
          </span>
        </div>
      ))}
    </div>
  )
}

function TabContrato({ contrato, propiedad, onNuevoContrato }) {
  const { editarContrato, inquilinos } = useData()
  const [editando, setEditando] = useState(false)
  const [nuevoContrato, setNuevoContrato] = useState(false)
  const [confirmArchivar, setConfirmArchivar] = useState(false)
  const dias = diasParaVencer(contrato.FechaFin)
  const esUSD = contrato.depositoMoneda === 'USD'
  const vencido = dias !== null && dias < 0

  return (
    <div>
      {vencido && (
        <div className="alert alert-red" style={{ marginBottom: 12 }}>
          ⚠ Contrato vencido hace {Math.abs(dias)} días.
        </div>
      )}
      {!vencido && dias !== null && dias <= 30 && (
        <div className="alert alert-orange" style={{ marginBottom: 12 }}>
          ⏰ Vence en {dias} días ({formatFecha(contrato.FechaFin)})
        </div>
      )}

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13, flex: 1 }} onClick={() => setEditando(true)}>
          ✏ Editar
        </button>
        <button
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: 13, flex: 1 }}
          onClick={() => setNuevoContrato(true)}
        >
          + Nuevo contrato
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: 13, flex: 1, color: 'var(--text3)' }}
          onClick={() => setConfirmArchivar(true)}
        >
          Archivar
        </button>
      </div>
      {confirmArchivar && (
        <div style={{ background: '#fee2e2', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
            ¿Archivar contrato? No aparecerá más como activo.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={() => setConfirmArchivar(false)}>
              Cancelar
            </button>
            <button
              className="btn"
              style={{ flex: 1, padding: '8px', background: 'var(--red)', color: 'white' }}
              onClick={() => {
                editarContrato(contrato.IdContrato, { activo: false, archivado: true })
                setConfirmArchivar(false)
              }}
            >
              Sí, archivar
            </button>
          </div>
        </div>
      )}

      {/* Datos del contrato */}
      <div className="item-row">
        <div><div className="item-label">Inicio</div><div className="item-value">{formatFecha(contrato.FechaInicio)}</div></div>
        <div><div className="item-label">Vencimiento</div><div className="item-value">{formatFecha(contrato.FechaFin)}</div></div>
      </div>
      <div className="item-row">
        <div><div className="item-label">Monto actual</div><div className="item-value" style={{ color: 'var(--accent)' }}>{formatPesos(contrato.MontoInicial)}</div></div>
        <div><div className="item-label">Ajuste</div><div className="item-value">{contrato.TipoAjuste || '—'}</div></div>
      </div>
      {contrato.MontoAnterior > 0 && (
        <div className="item-row">
          <div className="item-label">Monto anterior</div>
          <div className="item-value">{formatPesos(contrato.MontoAnterior)}</div>
        </div>
      )}
      {contrato.Deposito > 0 && (
        <div className="item-row">
          <div>
            <div className="item-label">Depósito en garantía</div>
            <div className="item-value">
              {esUSD ? formatUSD(contrato.Deposito) : formatPesos(contrato.Deposito)}
              <span className={`badge ${esUSD ? 'badge-green' : 'badge-blue'}`} style={{ marginLeft: 6, fontSize: 11 }}>
                {esUSD ? 'USD' : 'ARS'}
              </span>
            </div>
          </div>
        </div>
      )}
      {contrato.notas && (
        <div className="item-row">
          <div>
            <div className="item-label">Notas</div>
            <div style={{ fontSize: 14, whiteSpace: 'pre-line' }}>{contrato.notas}</div>
          </div>
        </div>
      )}

      {/* Servicios */}
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Cuentas de servicios
        </div>
        {[
          ['Aguas', propiedad['aguas CTA']],
          ['EDERSA / Edenor', propiedad['NIS edersa']],
          ['Camuzzi', propiedad['camuzzi CTA']],
          ['Municipal', propiedad['Partida municipal']],
          ['Rentas pvcia', propiedad['Partida Rentas pvcia']],
          ['Catastro', propiedad['nomenclatura catastral']],
        ].filter(([, v]) => v).map(([label, val]) => {
          const url = getServicioUrl(label, val, propiedad.Ciudad)
          return (
            <div key={label} className="item-row" style={{ alignItems: 'center' }}>
              <div className="item-label" style={{ width: 120, flexShrink: 0 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                <span style={{
                  fontSize: 13,
                  fontFamily: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
                  letterSpacing: '0.03em',
                  color: 'var(--text)',
                  textAlign: 'right',
                  wordBreak: 'break-all',
                }}>{val}</span>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 8,
                      background: 'var(--accent)', color: 'white',
                      fontSize: 14, flexShrink: 0,
                      textDecoration: 'none',
                    }}
                    title={`Ir a ${label}`}
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Actualizar monto + historial */}
      <PanelActualizacionMonto contrato={contrato} />
      <HistorialICL historial={contrato.historialICL} />


      {editando && (
        <EditarContratoModal
          contrato={contrato}
          onCerrar={() => setEditando(false)}
          onGuardar={datos => { editarContrato(contrato.IdContrato, datos); setEditando(false) }}
        />
      )}

      {nuevoContrato && (
        <NuevoContratoModal
          idPropiedad={propiedad.IdPropiedad}
          inquilinos={inquilinos}
          onCerrar={() => setNuevoContrato(false)}
          onGuardar={datos => { onNuevoContrato(datos); setNuevoContrato(false) }}
        />
      )}
    </div>
  )
}

// ─── Tab Mantenimiento ────────────────────────────────────────────────────────

function TabMantenimiento({ idPropiedad }) {
  const { getMantPropiedad, editarMantenimiento, agregarMantenimiento, eliminarMantenimiento } = useData()
  const [modal, setModal] = useState(null)

  const items = getMantPropiedad(idPropiedad)
  const total = items.reduce((s, m) => s + (m.Costo || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>
          Total: <strong>{formatPesos(total)}</strong>
        </span>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setModal('nuevo')}>
          + Agregar
        </button>
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)' }}>Sin registros</div>
      )}

      {items.map(m => (
        <div key={m.IdMantenimiento} className="item-row" onClick={() => setModal(m)} style={{ cursor: 'pointer' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{m.Descripcion}</div>
            <div className="item-label">{formatFecha(m.Fecha)}</div>
            {m.Observacion && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{m.Observacion}</div>}
          </div>
          <div style={{ fontWeight: 600, color: 'var(--red)', whiteSpace: 'nowrap' }}>
            {formatPesos(m.Costo)}
          </div>
        </div>
      ))}

      {modal && (
        <EditarMantModal
          item={modal === 'nuevo' ? null : modal}
          idPropiedad={idPropiedad}
          onCerrar={() => setModal(null)}
          onGuardar={datos => {
            if (modal === 'nuevo') agregarMantenimiento(datos)
            else editarMantenimiento(modal.IdMantenimiento, datos)
            setModal(null)
          }}
          onEliminar={modal !== 'nuevo' ? () => { eliminarMantenimiento(modal.IdMantenimiento); setModal(null) } : null}
        />
      )}
    </div>
  )
}

// ─── Tab Inquilino ────────────────────────────────────────────────────────────

function EditarInquilinoModal({ inquilino, onGuardar, onCerrar }) {
  const [form, setForm] = useState({ ...inquilino })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <Modal titulo="Editar inquilino" onCerrar={onCerrar} onGuardar={() => onGuardar(form)}>
      <Campo label="Nombre completo">
        <Input value={form.Apellido} onChange={v => set('Apellido', v)} />
      </Campo>
      <Campo label="DNI">
        <Input type="number" value={form.DNI || ''} onChange={v => set('DNI', parseInt(v) || 0)} />
      </Campo>
      <Campo label="Celular">
        <Input value={form.Celular} onChange={v => set('Celular', v)} />
      </Campo>
      <Campo label="Email">
        <Input type="email" value={form.Email || ''} onChange={v => set('Email', v)} />
      </Campo>
      <Campo label="Observaciones">
        <Input value={form.observaciones || ''} onChange={v => set('observaciones', v)} />
      </Campo>
    </Modal>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PropiedadDetalle({ idPropiedad, onVolver, onArchivos }) {
  const { getPropiedad, getContratoActivo, getContratosPropiedad, getInquilino, editarInquilino, editarContrato, agregarContrato, inquilinos } = useData()
  const [tab, setTab] = useState('pagos')
  const [editandoInq, setEditandoInq] = useState(false)
  const [nuevoContrato, setNuevoContrato] = useState(false)

  const propiedad = getPropiedad(idPropiedad)
  if (!propiedad) return null

  const contrato = getContratoActivo(idPropiedad)
  const todosLosContratos = getContratosPropiedad(idPropiedad)
  const contratosAnteriores = todosLosContratos.filter(c => !c.activo)
  const inquilino = contrato ? getInquilino(contrato.IdInquilino) : null

  const tabEfectivo = (!contrato && tab === 'pagos') ? 'contrato' : tab

  const tabs = [
    ...(contrato ? [{ id: 'pagos', label: 'Pagos' }] : []),
    { id: 'contrato', label: 'Contrato' },
    { id: 'mantenimiento', label: 'Mantenimiento' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16 }}>{propiedad.Direccion}</h1>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 400 }}>
            {propiedad.Tipo} · {propiedad.Ciudad}
          </div>
        </div>
      </div>

      <div className="content">
        {/* Card inquilino */}
        {inquilino && (
          <div className="card">
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18, flexShrink: 0,
              }}>
                {inquilino.Apellido?.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{inquilino.Apellido}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{inquilino.Celular}</div>
                {inquilino.Email && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inquilino.Email}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {contrato && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>{formatPesos(contrato.MontoInicial)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>por mes</div>
                  </div>
                )}
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditandoInq(true)}>
                  ✏
                </button>
                {onArchivos && (
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => onArchivos(inquilino.Apellido)}>
                    📁
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="tabs">
          {tabs.map(t => (
            <button key={t.id} className={`tab ${tabEfectivo === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-body" style={{ paddingTop: 16 }}>
            {tabEfectivo === 'pagos' && contrato && <TabPagos contrato={contrato} />}
            {tabEfectivo === 'contrato' && contrato && <TabContrato contrato={contrato} propiedad={propiedad} onNuevoContrato={agregarContrato} />}
            {tabEfectivo === 'contrato' && !contrato && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--orange)' }}>
                  📋 Sin contrato activo
                </div>
                <button
                  className="btn btn-primary btn-full"
                  style={{ marginBottom: 10 }}
                  onClick={() => setNuevoContrato(true)}
                >
                  + Crear nuevo contrato
                </button>
                {contratosAnteriores.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text3)', margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                      Contratos anteriores
                    </div>
                    {contratosAnteriores.map(c => {
                      const inq = getInquilino(c.IdInquilino)
                      return (
                        <div key={c.IdContrato} style={{
                          background: 'var(--bg)', borderRadius: 10, padding: '12px 14px',
                          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{inq?.Apellido || 'Inquilino'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                              {formatFecha(c.FechaInicio)} → {formatFecha(c.FechaFin)}
                              {' · '}{formatPesos(c.MontoInicial)}
                            </div>
                            {c.archivado && (
                              <span className="badge badge-gray" style={{ marginTop: 4, fontSize: 11 }}>Archivado</span>
                            )}
                          </div>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}
                            onClick={() => editarContrato(c.IdContrato, { activo: true, archivado: false })}
                          >
                            Reactivar
                          </button>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}
            {tabEfectivo === 'mantenimiento' && <TabMantenimiento idPropiedad={idPropiedad} />}
          </div>
        </div>
      </div>

      {editandoInq && inquilino && (
        <EditarInquilinoModal
          inquilino={inquilino}
          onCerrar={() => setEditandoInq(false)}
          onGuardar={datos => { editarInquilino(inquilino.IdInquilino, datos); setEditandoInq(false) }}
        />
      )}

      {nuevoContrato && (
        <NuevoContratoModal
          idPropiedad={idPropiedad}
          inquilinos={inquilinos}
          onCerrar={() => setNuevoContrato(false)}
          onGuardar={datos => { agregarContrato(datos); setNuevoContrato(false) }}
        />
      )}
    </div>
  )
}
