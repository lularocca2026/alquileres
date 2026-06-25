import { useState } from 'react'
import { useData } from '../DataContext.jsx'
import { formatPesos, formatFecha, isoHoy, parseLocalDate } from '../utils.js'

export const ARQUILER_URL = 'https://arquiler.com/'

// Registra una actualización de monto en el historial del contrato
export function registrarActualizacion(contrato, nuevoMonto, tipo, editarContrato) {
  const anterior = contrato.MontoInicial
  const porcentaje = parseFloat((((nuevoMonto - anterior) / anterior) * 100).toFixed(2))
  const entrada = { fecha: isoHoy(), montoAnterior: anterior, montoNuevo: nuevoMonto, porcentaje, tipo }
  editarContrato(contrato.IdContrato, {
    MontoAnterior: anterior,
    MontoInicial: nuevoMonto,
    fechaUltimoAumento: isoHoy(),
    iclPospuestoHasta: null,
    historialICL: [...(contrato.historialICL || []), entrada],
  })
}

// Cada cuántos meses corresponde el ajuste según el tipo. Devuelve el ciclo en
// meses, o null si el contrato no tiene un ajuste periódico reconocible.
export function cicloICL(tipoAjuste) {
  const t = (tipoAjuste || '').toLowerCase()
  // Formato numérico explícito: "ICL 3 meses", "cada 6 meses", "ajuste 4 mes"
  const m = t.match(/(\d+)\s*mes/)
  if (m) return parseInt(m[1]) || null
  if (t.includes('mensual')) return 1
  if (t.includes('bimestr')) return 2
  if (t.includes('cuatrimestr')) return 4
  if (t.includes('trimestr')) return 3
  if (t.includes('semestr')) return 6
  if (t.includes('anual') || t.includes('año') || t.includes('ano')) return 12
  // ICL / índice sin período explícito → trimestral (lo habitual)
  if (t.includes('icl') || t.includes('indice') || t.includes('índice')) return 3
  return null
}

// Estado de ajuste de un contrato: 'corresponde' (toca este mes o ya pasó),
// 'proximo' (toca el mes que viene) o null (no aplica / no es ICL / pospuesto)
export function estadoICL(contrato) {
  if (!contrato || !contrato.activo || contrato.archivado) return null
  const ciclo = cicloICL(contrato.TipoAjuste)
  if (!ciclo) return null // sin ajuste periódico reconocible
  // ¿pospuesto manualmente?
  if (contrato.iclPospuestoHasta) {
    const hasta = parseLocalDate(contrato.iclPospuestoHasta)
    if (hasta && new Date() < hasta) return null
  }
  const fechaRef = parseLocalDate(contrato.fechaUltimoAumento || contrato.FechaInicio)
  // Sin fecha base (nunca se ajustó y sin inicio cargado): corresponde definir el ajuste ahora
  if (!fechaRef || isNaN(fechaRef)) return 'corresponde'
  const hoy = new Date()
  const meses = (hoy.getFullYear() - fechaRef.getFullYear()) * 12 + (hoy.getMonth() - fechaRef.getMonth())
  if (meses >= ciclo) return 'corresponde'
  if (meses === ciclo - 1) return 'proximo'
  return null
}

// Detecta contratos con ICL que necesitan actualización
export function usePendientesICL() {
  const { contratos, getInquilino, getPropiedad } = useData()
  const hoy = new Date()

  return contratos
    .filter(c => {
      if (!c.activo || c.archivado) return false
      const ciclo = cicloICL(c.TipoAjuste)
      if (!ciclo) return false

      // Fecha de referencia: última actualización o inicio del contrato
      const fechaRef = parseLocalDate(c.fechaUltimoAumento || c.FechaInicio)
      if (!fechaRef || isNaN(fechaRef)) return false

      // Calcular meses transcurridos
      const meses =
        (hoy.getFullYear() - fechaRef.getFullYear()) * 12 +
        (hoy.getMonth() - fechaRef.getMonth())

      // Pospuesto?
      if (c.iclPospuestoHasta) {
        const hasta = parseLocalDate(c.iclPospuestoHasta)
        if (hasta && hoy < hasta) return false
      }

      return meses >= ciclo
    })
    .map(c => {
      const fechaRef = parseLocalDate(c.fechaUltimoAumento || c.FechaInicio)
      const meses =
        (hoy.getFullYear() - fechaRef.getFullYear()) * 12 +
        (hoy.getMonth() - fechaRef.getMonth())
      return {
        contrato: c,
        inquilino: getInquilino(c.IdInquilino),
        propiedad: getPropiedad(c.IdPropiedad),
        mesesDesdeAjuste: meses,
        fechaRef,
      }
    })
}

// ─── Modal de actualización de un contrato ────────────────────────────────────
function ModalActualizacion({ item, onConfirmar, onNoAumentar, onPosponer, onCerrar }) {
  const { contrato, inquilino, propiedad, mesesDesdeAjuste, fechaRef } = item
  const [nuevoMonto, setNuevoMonto] = useState(Math.round(contrato.MontoInicial))
  const [editando, setEditando] = useState(false)

  const variacion = nuevoMonto - contrato.MontoInicial
  const porcentaje = ((variacion / contrato.MontoInicial) * 100).toFixed(1)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '16px 16px 0 0',
        width: '100%',
        maxHeight: '92dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Actualización ICL
              </span>
            </div>
            <button onClick={onCerrar} style={{ color: 'var(--text3)', fontSize: 20, padding: '0 4px' }}>×</button>
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, marginTop: 6 }}>{propiedad?.Direccion}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {inquilino?.Apellido} · {mesesDesdeAjuste} meses sin actualizar
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Desde cuándo */}
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Último ajuste</div>
              <div style={{ fontWeight: 600 }}>{formatFecha(fechaRef.toISOString())}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Monto actual</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatPesos(contrato.MontoInicial)}</div>
            </div>
          </div>

          {/* Link ICL */}
          <a
            href={ARQUILER_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 10,
              background: '#dbeafe', border: '1px solid #bfdbfe',
              textDecoration: 'none',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>Ver índice ICL actualizado</div>
              <div style={{ fontSize: 12, color: '#1e40af' }}>arquiler.com</div>
            </div>
            <span style={{ fontSize: 20, color: 'var(--accent)' }}>↗</span>
          </a>

          {/* Nuevo monto */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
              Nuevo monto mensual
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 15, color: 'var(--text2)', pointerEvents: 'none',
                }}>$</span>
                <input
                  type="number"
                  value={nuevoMonto}
                  onChange={e => setNuevoMonto(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%', padding: '12px 12px 12px 26px',
                    borderRadius: 10, border: '2px solid var(--accent)',
                    fontSize: 18, fontWeight: 700, background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            </div>

            {/* Variación */}
            {variacion !== 0 && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 8,
                background: variacion > 0 ? '#dcfce7' : '#fee2e2',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: variacion > 0 ? 'var(--green)' : 'var(--red)' }}>
                  {variacion > 0 ? '▲' : '▼'} {variacion > 0 ? '+' : ''}{formatPesos(variacion)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: variacion > 0 ? 'var(--green)' : 'var(--red)' }}>
                  {variacion > 0 ? '+' : ''}{porcentaje}%
                </span>
              </div>
            )}
          </div>

          {/* Opciones secundarias */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onNoAumentar}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 8,
                background: 'var(--bg)', border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text2)',
              }}
            >
              No aumentar ahora
            </button>
            <button
              onClick={() => onPosponer(30)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 8,
                background: 'var(--bg)', border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text2)',
              }}
            >
              Recordar en 30 días
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            className="btn btn-primary btn-full"
            style={{ padding: 14, fontSize: 15 }}
            onClick={() => onConfirmar(nuevoMonto)}
          >
            Confirmar aumento a {formatPesos(nuevoMonto)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Lógica compartida del gestor ────────────────────────────────────────────
function useGestorICL(onCerrarTodo) {
  const pendientes = usePendientesICL()
  const { editarContrato } = useData()
  const [indiceActual, setIndiceActual] = useState(0)
  const [cerrado, setCerrado] = useState(false)

  function siguiente() {
    if (indiceActual + 1 >= pendientes.length) {
      setCerrado(true)
      onCerrarTodo?.()
    } else {
      setIndiceActual(i => i + 1)
    }
  }

  function confirmar(nuevoMonto, tipo = 'ICL') {
    registrarActualizacion(pendientes[indiceActual].contrato, nuevoMonto, tipo, editarContrato)
    siguiente()
  }

  function noAumentar() {
    const item = pendientes[indiceActual]
    editarContrato(item.contrato.IdContrato, {
      fechaUltimoAumento: isoHoy(),
      iclPospuestoHasta: null,
    })
    siguiente()
  }

  function posponer(dias) {
    const item = pendientes[indiceActual]
    const hasta = new Date()
    hasta.setDate(hasta.getDate() + dias)
    editarContrato(item.contrato.IdContrato, { iclPospuestoHasta: hasta.toISOString() })
    siguiente()
  }

  return { pendientes, indiceActual, cerrado, confirmar, noAumentar, posponer, siguiente }
}

// ─── Auto-popup al abrir la app ───────────────────────────────────────────────
export default function AlertasICL() {
  const { pendientes, indiceActual, cerrado, confirmar, noAumentar, posponer, siguiente } = useGestorICL()
  if (cerrado || !pendientes.length || indiceActual >= pendientes.length) return null
  return (
    <>
      <ModalActualizacion
        item={pendientes[indiceActual]}
        onConfirmar={confirmar}
        onNoAumentar={noAumentar}
        onPosponer={posponer}
        onCerrar={siguiente}
      />
      {pendientes.length > 1 && (
        <div style={{
          position: 'fixed', top: 60, right: 16, zIndex: 200,
          background: 'var(--orange)', color: 'white',
          borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700,
        }}>
          {indiceActual + 1} / {pendientes.length}
        </div>
      )}
    </>
  )
}

// ─── Modal desde banner (click manual) ───────────────────────────────────────
export function AlertasICLModal({ onCerrarTodo }) {
  const { pendientes, indiceActual, cerrado, confirmar, noAumentar, posponer, siguiente } = useGestorICL(onCerrarTodo)
  if (cerrado || !pendientes.length || indiceActual >= pendientes.length) return null
  return (
    <>
      <ModalActualizacion
        item={pendientes[indiceActual]}
        onConfirmar={confirmar}
        onNoAumentar={noAumentar}
        onPosponer={posponer}
        onCerrar={siguiente}
      />
      {pendientes.length > 1 && (
        <div style={{
          position: 'fixed', top: 60, right: 16, zIndex: 200,
          background: 'var(--orange)', color: 'white',
          borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700,
        }}>
          {indiceActual + 1} / {pendientes.length}
        </div>
      )}
    </>
  )
}

// ─── Banner en dashboard cuando hay pendientes (modal ya cerrado) ─────────────
export function BannerICL({ onClick }) {
  const pendientes = usePendientesICL()
  if (!pendientes.length) return null

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff7ed', border: '1px solid #fed7aa',
        borderRadius: 10, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 20 }}>📈</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#9a3412' }}>
          {pendientes.length} contrato{pendientes.length > 1 ? 's' : ''} con actualización ICL pendiente
        </div>
        <div style={{ fontSize: 12, color: '#c2410c' }}>
          {pendientes.map(p => p.propiedad?.Direccion).join(', ')}
        </div>
      </div>
      <span style={{ color: '#c2410c', fontSize: 18 }}>›</span>
    </div>
  )
}
