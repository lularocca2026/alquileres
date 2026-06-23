import { useState, useEffect, Component } from 'react'
import { supabase } from '../supabase.js'

const BUCKET = 'archivos'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 24, color: 'var(--red)', fontSize: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Error al cargar archivos</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{this.state.error}</div>
        <button onClick={() => this.setState({ error: null })}
          style={{ marginTop: 12, padding: '8px 16px', background: 'var(--blue1)', color: 'white', borderRadius: 8, fontSize: 13 }}>
          Reintentar
        </button>
      </div>
    )
    return this.props.children
  }
}

function tipoArchivo(nombre) {
  const ext = nombre.split('.').pop().toLowerCase()
  if (['jpg','jpeg','png','gif','webp','heic'].includes(ext)) return 'foto'
  if (['mp3','ogg','opus','m4a','wav','aac'].includes(ext)) return 'audio'
  if (['mp4','mov','avi','mkv'].includes(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  if (['xlsx','xls'].includes(ext)) return 'excel'
  return 'otro'
}

const ICONOS = { foto: '📷', audio: '🎙', video: '🎬', pdf: '📄', excel: '📊', otro: '📎' }

function publicUrl(carpeta, archivo) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${carpeta}/${archivo}`)
  return data.publicUrl
}

// ─── Vista de archivos de una carpeta ─────────────────────────────────────────
function VistaArchivos({ carpeta, onVolver }) {
  const [archivos, setArchivos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.storage.from(BUCKET).list(carpeta, { limit: 500 })
      .then(({ data, error }) => {
        if (error) throw error
        setArchivos((data || []).filter(f => f.name && !f.id?.endsWith('/')))
        setCargando(false)
      })
      .catch(() => setCargando(false))
  }, [carpeta])

  const titulo = carpeta.replace(/^Chat de WhatsApp con /i, '').replace(/^Inq\s+/i, '')
  const excels = archivos.filter(f => tipoArchivo(f.name) === 'excel')
  const resto = archivos.filter(f => tipoArchivo(f.name) !== 'excel')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <h1 style={{ fontSize: 16 }}>{titulo}</h1>
      </div>

      <div className="content">
        {cargando && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando...</div>}

        {!cargando && archivos.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Sin archivos en esta carpeta</div>
        )}

        {/* Excel primero y destacado */}
        {excels.map(f => (
          <a key={f.name} href={publicUrl(carpeta, f.name)} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px',
              background: 'var(--blue1)', borderRadius: 12, marginBottom: 16,
              color: 'white', textDecoration: 'none' }}>
            <span style={{ fontSize: 32 }}>📊</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Ver Excel</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{f.name}</div>
            </div>
            <span style={{ fontSize: 20, opacity: 0.8 }}>↗</span>
          </a>
        ))}

        {/* Lista de todos los archivos */}
        {resto.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>
              Archivos ({resto.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {resto.map(f => {
                const tipo = tipoArchivo(f.name)
                return (
                  <a key={f.name} href={publicUrl(carpeta, f.name)} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)',
                      color: 'var(--text)', textDecoration: 'none' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{ICONOS[tipo]}</span>
                    <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--blue1)', flexShrink: 0 }}>↗</span>
                  </a>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Lista de carpetas (chats) ─────────────────────────────────────────────────
function ArchivoMediaInner({ onVolver, chatInicial, onImportar }) {
  const [carpetas, setCarpetas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [carpetaAbierta, setCarpetaAbierta] = useState(null)

  useEffect(() => {
    supabase.storage.from(BUCKET).list('', { limit: 100 })
      .then(({ data, error }) => {
        if (error) throw error
        setCarpetas((data || []).filter(i => !i.metadata))
        setCargando(false)
      })
      .catch(() => setCargando(false))
  }, [])

  // Si viene con chatInicial, busca la carpeta que coincide
  useEffect(() => {
    if (chatInicial && carpetas.length > 0) {
      const match = carpetas.find(c => c.name.toLowerCase().includes(String(chatInicial).toLowerCase()))
      if (match) setCarpetaAbierta(match.name)
    }
  }, [chatInicial, carpetas])

  if (carpetaAbierta) {
    return <VistaArchivos carpeta={carpetaAbierta} onVolver={() => setCarpetaAbierta(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <h1>Archivos importados</h1>
      </div>

      <div className="content">
        {cargando && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando...</div>}

        {!cargando && carpetas.length === 0 && (
          <div className="card">
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No hay archivos importados</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
                Exportá el chat de WhatsApp y subilo para ver fotos, audios y documentos.
              </div>
              <button className="btn btn-primary btn-full" style={{ padding: 13, fontSize: 14 }} onClick={onImportar}>
                📲 Importar ZIP de WhatsApp
              </button>
            </div>
          </div>
        )}

        {carpetas.map(c => {
          const nombre = c.name.replace(/^Chat de WhatsApp con /i, '').replace(/^Inq\s+/i, '')
          return (
            <div key={c.name} className="card" onClick={() => setCarpetaAbierta(c.name)}
              style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: 'var(--blue1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0
              }}>📁</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tocar para ver fotos y archivos</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>›</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ArchivoMedia({ onVolver, chatInicial, onImportar }) {
  return (
    <ErrorBoundary>
      <ArchivoMediaInner onVolver={onVolver} chatInicial={chatInicial} onImportar={onImportar} />
    </ErrorBoundary>
  )
}
