import { useState, useRef } from 'react'
import { useData } from '../DataContext.jsx'
import { formatPesos, formatFecha } from '../utils.js'

// ─── Estados del flujo ────────────────────────────────────────────────────────
// instrucciones → subiendo → procesando → preview → confirmado

// ─── Preview de un pago detectado ─────────────────────────────────────────────
function FilaDetectada({ item, tipo, seleccionado, onToggle }) {
  const colorTipo = { pago: 'var(--green)', mantenimiento: 'var(--orange)', observacion: 'var(--accent)', inconsistencia: 'var(--red)' }
  const iconoTipo = { pago: '💰', mantenimiento: '🔧', observacion: '📝', inconsistencia: '⚠️' }

  return (
    <div
      onClick={tipo !== 'inconsistencia' ? onToggle : undefined}
      style={{
        display: 'flex', gap: 12, padding: '12px 14px',
        borderRadius: 10, marginBottom: 8,
        background: tipo === 'inconsistencia' ? '#fee2e2' :
          seleccionado ? '#f0f7ff' : 'var(--bg)',
        border: `1px solid ${tipo === 'inconsistencia' ? '#fca5a5' :
          seleccionado ? '#bfdbfe' : 'var(--border)'}`,
        cursor: tipo !== 'inconsistencia' ? 'pointer' : 'default',
        opacity: (!seleccionado && tipo !== 'inconsistencia') ? 0.6 : 1,
      }}
    >
      {tipo !== 'inconsistencia' && (
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          border: `2px solid ${seleccionado ? 'var(--accent)' : 'var(--border)'}`,
          background: seleccionado ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {seleccionado && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13 }}>{iconoTipo[tipo]}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: colorTipo[tipo], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {tipo}
          </span>
          {item.confianza && (
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
              {item.confianza === 'alta' ? '●●●' : item.confianza === 'media' ? '●●○' : '●○○'}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {item.descripcion || item.texto || item.descripcion_inconsistencia}
        </div>
        {item.monto > 0 && (
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, marginTop: 2 }}>
            {formatPesos(item.monto)}
          </div>
        )}
        {item.costo > 0 && (
          <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 2 }}>
            Costo: {formatPesos(item.costo)}
          </div>
        )}
        {item.fecha && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {formatFecha(item.fecha)}
          </div>
        )}
        {item.inquilino_probable && (
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            👤 {item.inquilino_probable}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Álbum de fotos ────────────────────────────────────────────────────────────
function AlbumFotos({ fotos }) {
  const [abierta, setAbierta] = useState(null)

  if (!fotos?.length) return null

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>
        📷 Fotos ({fotos.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {fotos.map((f, i) => (
          <div
            key={i}
            onClick={() => setAbierta(f)}
            style={{
              aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
              background: 'var(--surface2)', cursor: 'pointer',
            }}
          >
            {f.data ? (
              <img src={f.data} alt={f.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 24 }}>
                🎬
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {abierta && (
        <div
          onClick={() => setAbierta(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <button
            onClick={() => setAbierta(null)}
            style={{ position: 'absolute', top: 16, right: 16, color: 'white', fontSize: 28, background: 'none' }}
          >
            ×
          </button>
          {abierta.data && (
            <img
              src={abierta.data}
              alt={abierta.nombre}
              style={{ maxWidth: '100%', maxHeight: '80dvh', borderRadius: 8, objectFit: 'contain' }}
              onClick={e => e.stopPropagation()}
            />
          )}
          <div style={{ color: 'white', fontSize: 13, marginTop: 12, opacity: 0.7 }}>{abierta.nombre}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {fotos.indexOf(abierta) > 0 && (
              <button
                onClick={e => { e.stopPropagation(); setAbierta(fotos[fotos.indexOf(abierta) - 1]) }}
                style={{ color: 'white', background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: 8 }}
              >
                ←
              </button>
            )}
            {fotos.indexOf(abierta) < fotos.length - 1 && (
              <button
                onClick={e => { e.stopPropagation(); setAbierta(fotos[fotos.indexOf(abierta) + 1]) }}
                style={{ color: 'white', background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: 8 }}
              >
                →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Transcripciones ──────────────────────────────────────────────────────────
function Transcripciones({ lista }) {
  if (!lista?.length) return null
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>🎙 Audios transcriptos ({lista.length})</div>
      {lista.map((t, i) => (
        <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{t.nombre}</div>
          <div style={{ fontSize: 14 }}>{t.texto}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ImportarZip({ onVolver }) {
  const { agregarPago, agregarMantenimiento, editarContrato, contratos } = useData()
  const [fase, setFase] = useState('instrucciones')
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [progreso, setProgreso] = useState('')
  const [seleccionados, setSeleccionados] = useState({})
  const [confirmados, setConfirmados] = useState(false)
  const [backendDisponible, setBackendDisponible] = useState(null)
  const inputRef = useRef(null)

  // Verificar si el backend local está corriendo
  useState(() => {
    fetch('/api/health', { signal: AbortSignal.timeout(2000) })
      .then(r => setBackendDisponible(r.ok))
      .catch(() => setBackendDisponible(false))
  })

  function toggleItem(tipo, idx) {
    const key = `${tipo}_${idx}`
    setSeleccionados(s => ({ ...s, [key]: !s[key] }))
  }

  function isSeleccionado(tipo, idx) {
    return seleccionados[`${tipo}_${idx}`] ?? true // por defecto seleccionado
  }

  async function procesarArchivo(file) {
    setFase('subiendo')
    setError(null)
    setProgreso('Subiendo archivo...')

    const formData = new FormData()
    formData.append('archivo', file)

    try {
      setProgreso('Analizando conversación con IA...')
      const res = await fetch('/api/procesar-zip', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
      }

      const data = await res.json()
      setResultado(data)

      // Seleccionar todo por defecto excepto inconsistencias
      const sel = {}
      data.analisis?.pagos?.forEach((_, i) => { sel[`pago_${i}`] = true })
      data.analisis?.mantenimiento?.forEach((_, i) => { sel[`mantenimiento_${i}`] = true })
      data.analisis?.observaciones?.forEach((_, i) => { sel[`observacion_${i}`] = true })
      setSeleccionados(sel)

      setFase('preview')
    } catch (e) {
      setError(e.message || 'Error procesando el archivo')
      setFase('instrucciones')
    }
  }

  function confirmarImportacion() {
    const { analisis } = resultado
    const contratoActivo = contratos.find(c => c.activo && c.IdPropiedad > 0)

    // Importar pagos seleccionados
    analisis?.pagos?.forEach((p, i) => {
      if (!isSeleccionado('pago', i)) return
      agregarPago({
        IdContrato: contratoActivo?.IdContrato ?? 0,
        Periodo: p.fecha,
        FechaPago: p.fecha,
        Monto: p.monto,
        MontoEsperado: contratoActivo?.MontoInicial ?? 0,
        'exp extraordinarias': 0,
        descuento: 0,
        Pagado: true,
        observaciones: `[WhatsApp] ${p.descripcion}`,
      })
    })

    // Importar mantenimiento seleccionado
    analisis?.mantenimiento?.forEach((m, i) => {
      if (!isSeleccionado('mantenimiento', i)) return
      agregarMantenimiento({
        IdPropiedad: contratoActivo?.IdPropiedad ?? 0,
        Fecha: m.fecha,
        Descripcion: m.descripcion,
        Costo: m.costo ?? 0,
        Observacion: `[WhatsApp] ${m.estado ?? ''}`,
      })
    })

    // Agregar observaciones seleccionadas a notas del contrato activo
    const obsSeleccionadas = analisis?.observaciones?.filter((_, i) => isSeleccionado('observacion', i))
    if (obsSeleccionadas?.length && contratoActivo) {
      const nuevasNotas = obsSeleccionadas
        .map(o => `[${formatFecha(o.fecha)}] ${o.texto}`)
        .join('\n')
      const notasActuales = contratoActivo.notas ?? ''
      editarContrato(contratoActivo.IdContrato, {
        notas: notasActuales ? `${notasActuales}\n\n--- WhatsApp ---\n${nuevasNotas}` : `--- WhatsApp ---\n${nuevasNotas}`,
      })
    }

    setConfirmados(true)
  }

  const totalDetectado = resultado
    ? (resultado.analisis?.pagos?.length ?? 0) +
      (resultado.analisis?.mantenimiento?.length ?? 0) +
      (resultado.analisis?.observaciones?.length ?? 0)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <h1>Importar desde WhatsApp</h1>
      </div>

      <div className="content">

        {/* ── Instrucciones ── */}
        {fase === 'instrucciones' && (
          <>
            <div className="card">
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Cómo exportar un chat</div>
                {[
                  'Abrí el chat con el inquilino en WhatsApp',
                  'Tocá los 3 puntitos → Más → Exportar chat',
                  'Elegí "Con archivos" para incluir fotos y audios',
                  'Compartí el .zip a esta app',
                ].map((paso, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 14, paddingTop: 3 }}>{paso}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="alert alert-yellow">
              💡 La IA detecta pagos, reparaciones y observaciones. Los audios se transcriben automáticamente.
            </div>

            {backendDisponible === false && (
              <div className="alert alert-red">
                <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Backend no disponible</div>
                <div style={{ fontSize: 13 }}>
                  Esta función requiere el backend local. Abrí <strong>INICIAR.bat</strong> en la computadora de Lucre y volvé a intentar.
                </div>
              </div>
            )}

            {error && backendDisponible !== false && (
              <div className="alert alert-red">⚠ {error}</div>
            )}

            <input ref={inputRef} type="file" accept=".zip,.txt" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && procesarArchivo(e.target.files[0])}
            />
            <button
              className="btn btn-primary btn-full"
              style={{ padding: '14px 16px', fontSize: 15, opacity: backendDisponible === false ? 0.5 : 1 }}
              onClick={() => backendDisponible !== false && inputRef.current?.click()}
            >
              📁 Seleccionar ZIP de WhatsApp
            </button>
          </>
        )}

        {/* ── Procesando ── */}
        {(fase === 'subiendo') && (
          <div style={{ textAlign: 'center', padding: '60px 16px' }}>
            <div style={{ fontSize: 44, marginBottom: 16, animation: 'spin 1s linear infinite' }}>⚙️</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{progreso}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Puede tardar un minuto si hay muchos archivos</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── Preview ── */}
        {fase === 'preview' && resultado && !confirmados && (
          <>
            {/* Resumen */}
            <div className="card">
              <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{resultado.total_mensajes}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>mensajes</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{resultado.analisis?.pagos?.length ?? 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>pagos</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}>{resultado.analisis?.mantenimiento?.length ?? 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>mantenimiento</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{resultado.analisis?.observaciones?.length ?? 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>observaciones</div>
                </div>
                {resultado.fotos?.length > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{resultado.fotos.length}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>fotos</div>
                  </div>
                )}
              </div>
            </div>

            {/* Inconsistencias siempre arriba */}
            {resultado.analisis?.inconsistencias?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>
                  ⚠ Posibles problemas
                </div>
                {resultado.analisis.inconsistencias.map((item, i) => (
                  <FilaDetectada
                    key={i}
                    item={{ descripcion: item.descripcion || item.descripcion_inconsistencia, ...item }}
                    tipo="inconsistencia"
                    seleccionado={false}
                  />
                ))}
              </div>
            )}

            {/* Pagos */}
            {resultado.analisis?.pagos?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
                  Pagos detectados — tocá para incluir/excluir
                </div>
                {resultado.analisis.pagos.map((item, i) => (
                  <FilaDetectada key={i} item={item} tipo="pago"
                    seleccionado={isSeleccionado('pago', i)}
                    onToggle={() => toggleItem('pago', i)}
                  />
                ))}
              </div>
            )}

            {/* Mantenimiento */}
            {resultado.analisis?.mantenimiento?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Mantenimiento</div>
                {resultado.analisis.mantenimiento.map((item, i) => (
                  <FilaDetectada key={i} item={item} tipo="mantenimiento"
                    seleccionado={isSeleccionado('mantenimiento', i)}
                    onToggle={() => toggleItem('mantenimiento', i)}
                  />
                ))}
              </div>
            )}

            {/* Observaciones */}
            {resultado.analisis?.observaciones?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Observaciones</div>
                {resultado.analisis.observaciones.map((item, i) => (
                  <FilaDetectada key={i} item={item} tipo="observacion"
                    seleccionado={isSeleccionado('observacion', i)}
                    onToggle={() => toggleItem('observacion', i)}
                  />
                ))}
              </div>
            )}

            {/* Transcripciones */}
            <Transcripciones lista={resultado.transcripciones} />

            {/* Álbum de fotos */}
            <AlbumFotos fotos={resultado.fotos} />

            {totalDetectado === 0 && !resultado.fotos?.length && !resultado.transcripciones?.length && (
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>🔍</div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>No se detectaron eventos automáticamente</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  La conversación puede no tener menciones de pagos o mantenimiento, o el formato no fue reconocido.
                </div>
              </div>
            )}

            {/* Botones — siempre visibles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', bottom: 0, background: 'var(--bg)', paddingBottom: 16, paddingTop: 8 }}>
              <button
                className="btn btn-primary btn-full"
                style={{ padding: '14px' }}
                onClick={confirmarImportacion}
              >
                {totalDetectado > 0
                  ? `Confirmar importación (${totalDetectado} items)`
                  : 'Confirmar y guardar fotos/audios'}
              </button>
              <button className="btn btn-secondary btn-full" style={{ padding: '12px' }}
                onClick={() => { setFase('instrucciones'); setResultado(null) }}>
                Cargar otro ZIP
              </button>
            </div>
          </>
        )}

        {/* ── Confirmado ── */}
        {confirmados && (
          <div style={{ textAlign: 'center', padding: '60px 16px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>¡Datos importados!</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 32 }}>
              Los pagos y observaciones ya están en la app. Recordá guardar el JSON.
            </div>
            <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={onVolver}>
              Volver al inicio
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
