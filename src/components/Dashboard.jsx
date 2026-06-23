import { useState } from 'react'
import { useData } from '../DataContext.jsx'
import { supabase } from '../supabase.js'
import { formatPesos, diasParaVencer, formatFecha } from '../utils.js'
import { BannerICL, AlertasICLModal } from './ActualizacionICL.jsx'

function estadoPago(pagos, contrato) {
  if (!contrato) return null
  const hoy = new Date()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const pagoMes = pagos.find(p => {
    const d = new Date(p.Periodo)
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return mes === mesActual && p.Pagado
  })
  return pagoMes ? 'pagado' : 'pendiente'
}

function AlertasResumen({ propiedades }) {
  const { getContratoActivo, getInquilino } = useData()
  const alertas = []

  for (const p of propiedades) {
    const contrato = getContratoActivo(p.IdPropiedad)
    if (!contrato) continue
    const dias = diasParaVencer(contrato.FechaFin)
    if (dias !== null && dias <= 60) {
      const inq = getInquilino(contrato.IdInquilino)
      if (dias < 0) {
        alertas.push({ tipo: 'red', texto: `⚠ Contrato vencido: ${p.Direccion} (${inq?.Apellido}) — venció hace ${Math.abs(dias)} días` })
      } else if (dias <= 30) {
        alertas.push({ tipo: 'orange', texto: `⏰ Vence pronto: ${p.Direccion} — ${dias} días (${formatFecha(contrato.FechaFin)})` })
      } else {
        alertas.push({ tipo: 'yellow', texto: `📅 Próximo vencimiento: ${p.Direccion} — ${dias} días` })
      }
    }
  }

  if (!alertas.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alertas.map((a, i) => (
        <div key={i} className={`alert alert-${a.tipo}`}>{a.texto}</div>
      ))}
    </div>
  )
}

function ResumenTotales({ propiedades }) {
  const { getContratoActivo, getPagosContrato } = useData()
  let totalMes = 0, pagados = 0, pendientes = 0

  for (const p of propiedades) {
    const contrato = getContratoActivo(p.IdPropiedad)
    if (!contrato) continue
    const pagos = getPagosContrato(contrato.IdContrato)
    const estado = estadoPago(pagos, contrato)
    totalMes += contrato.MontoInicial || 0
    if (estado === 'pagado') pagados++
    else pendientes++
  }

  return (
    <div className="summary-grid">
      <div className="summary-tile">
        <div className="label">Total alquileres / mes</div>
        <div className="value" style={{ fontSize: 17 }}>{formatPesos(totalMes)}</div>
      </div>
      <div className="summary-tile">
        <div className="label">Pagados / Pendientes</div>
        <div className="value" style={{ fontSize: 18 }}>
          <span className="green">{pagados}</span>
          <span style={{ color: '#ccc', margin: '0 4px' }}>/</span>
          <span className="red">{pendientes}</span>
        </div>
      </div>
    </div>
  )
}

function PropiedadCard({ propiedad, onClick, onArchivos }) {
  const { getContratoActivo, getInquilino, getPagosContrato } = useData()
  const contrato = getContratoActivo(propiedad.IdPropiedad)
  const inquilino = contrato ? getInquilino(contrato.IdInquilino) : null
  const pagos = contrato ? getPagosContrato(contrato.IdContrato) : []
  const estado = estadoPago(pagos, contrato)
  const dias = contrato ? diasParaVencer(contrato.FechaFin) : null
  const apellido = inquilino?.Apellido?.split(/[\s/]/)[0] || ''

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{propiedad.Direccion}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
              {propiedad.Tipo} · {propiedad.Ciudad}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {contrato && (
              <span className={`badge ${estado === 'pagado' ? 'badge-green' : 'badge-red'}`}>
                {estado === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
              </span>
            )}
            {!contrato && <span className="badge badge-gray">Sin contrato</span>}
          </div>
        </div>

        {inquilino && (
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
            👤 {inquilino.Apellido}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {contrato && (
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
              {formatPesos(contrato.MontoInicial)}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)' }}>/mes</span>
            </div>
          )}
          {!contrato && <div />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {dias !== null && dias < 0 && <span className="badge badge-red">Contrato vencido</span>}
            {dias !== null && dias >= 0 && dias <= 60 && <span className="badge badge-orange">Vence en {dias}d</span>}
            <button
              onClick={e => { e.stopPropagation(); onArchivos(apellido) }}
              title="Ver archivos importados"
              style={{
                width: 30, height: 30, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#FEF9C3', border: '1px solid #FDE047',
                fontSize: 16, cursor: 'pointer',
              }}
            >
              📁
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ onAbrirPropiedad, onImportar, onArchivos, onInquilinos }) {
  const { propiedades, exportarJSON, sincronizado } = useData()
  const [mostrarICL, setMostrarICL] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <h1 style={{ flex: 'none' }}>🏠 Alquileres</h1>
          <span
            title={sincronizado ? 'Sincronizado entre dispositivos' : 'Sin conexión — guardado local'}
            style={{
              width: 9, height: 9, borderRadius: '50%',
              background: sincronizado ? '#4ADE80' : '#FBBF24',
              boxShadow: sincronizado ? '0 0 6px #4ADE80' : 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 13 }} onClick={exportarJSON} title="Descargar copia de respaldo">
            ⤓
          </button>
          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 13 }} onClick={onInquilinos} title="Inquilinos">
            👤
          </button>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onImportar}>
            + WhatsApp
          </button>
          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => supabase.auth.signOut()} title="Cerrar sesión">
            ⎋
          </button>
        </div>
      </div>

      <div className="content">
        <ResumenTotales propiedades={propiedades} />
        <AlertasResumen propiedades={propiedades} />
        <BannerICL onClick={() => setMostrarICL(true)} />
        {mostrarICL && <AlertasICLModal onCerrarTodo={() => setMostrarICL(false)} />}

        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
          Propiedades
        </div>

        {propiedades.map(p => (
          <PropiedadCard
            key={p.IdPropiedad}
            propiedad={p}
            onClick={() => onAbrirPropiedad(p.IdPropiedad)}
            onArchivos={apellido => onArchivos(apellido)}
          />
        ))}
      </div>
    </div>
  )
}
