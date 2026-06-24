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
  // Construir URL con encoding correcto para espacios y caracteres especiales
  const base = import.meta.env.VITE_SUPABASE_URL
  const path = carpeta.split('/').map(encodeURIComponent).join('/') +
    '/' + archivo.split('/').map(encodeURIComponent).join('/')
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

// ─── Vista de archivos de una carpeta ─────────────────────────────────────────
function VistaArchivos({ carpeta, onVolver }) {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const EXCLUIR = ['_resumen.json', '_chat.txt']
      const [{ data: storageData }, resumenData] = await Promise.all([
        supabase.storage.from(BUCKET).list(carpeta, { limit: 500 }),
        fetch(publicUrl(carpeta, '_resumen.json')).then(r => r.ok ? r.json() : null).catch(() => null),
      ])

      const archivosStorage = (storageData || [])
        .filter(f => f.name && !EXCLUIR.includes(f.name) && !f.name.endsWith('.txt'))

      const mensajesConArchivo = resumenData?.mensajes?.filter(m => m.url) || []
      const nombresConFecha = new Set(mensajesConArchivo.map(m => m.archivo?.toLowerCase()))

      const lista = [
        ...mensajesConArchivo.map(m => ({
          nombre: m.archivo || '',
          tipo: tipoArchivo(m.archivo || ''),
          fecha: m.fecha_str || null,
          url: m.url,
        })),
        ...archivosStorage
          .filter(f => !nombresConFecha.has(f.name.toLowerCase()))
          .map(f => ({
            nombre: f.name,
            tipo: tipoArchivo(f.name),
            fecha: null,
            url: publicUrl(carpeta, f.name),
          })),
      ]

      setRegistros(lista)
      setCargando(false)
    }
    cargar()
  }, [carpeta])

  const titulo = carpeta.replace(/^Chat de WhatsApp con /i, '').replace(/^Inq\s+/i, '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <h1 style={{ fontSize: 16 }}>{titulo}</h1>
        {!cargando && <span style={{ fontSize: 13, color: 'var(--text3)' }}>{registros.length}</span>}
      </div>

      <div className="content">
        {cargando && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando...</div>}

        {!cargando && registros.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Sin archivos</div>
        )}

        {registros.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{ICONOS[r.tipo]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>
                {r.fecha || '—'} · <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{r.tipo}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.nombre}
              </div>
            </div>
            <a href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0, textDecoration: 'none', padding: '6px 10px' }}>
              Ver
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Lista de carpetas (chats) ─────────────────────────────────────────────────
function palabrasMatch(nombre, filtro) {
  // Divide por espacios y guiones, filtra palabras > 2 letras
  const palabras = String(filtro).toLowerCase().split(/[\s\-,]+/).filter(p => p.length > 2)
  const target = nombre.toLowerCase()
  return palabras.some(p => target.includes(p))
}

function ArchivoMediaInner({ onVolver, chatInicial, onImportar }) {
  const [carpetas, setCarpetas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [carpetaAbierta, setCarpetaAbierta] = useState(null)
  const [mostrarTodas, setMostrarTodas] = useState(false)

  useEffect(() => {
    supabase.storage.from(BUCKET).list('', { limit: 100 })
      .then(({ data, error }) => {
        if (error) throw error
        const todas = (data || []).filter(i => !i.metadata)
        setCarpetas(todas)
        setCargando(false)
        // Auto-abrir solo si hay exactamente 1 coincidencia
        if (chatInicial) {
          const matches = todas.filter(c => palabrasMatch(c.name, chatInicial))
          if (matches.length === 1) setCarpetaAbierta(matches[0].name)
        }
      })
      .catch(() => setCargando(false))
  }, [])

  if (carpetaAbierta) {
    return <VistaArchivos carpeta={carpetaAbierta} onVolver={() => setCarpetaAbierta(null)} />
  }

  const carpetasFiltradas = chatInicial && !mostrarTodas
    ? carpetas.filter(c => palabrasMatch(c.name, chatInicial))
    : carpetas

  const sinCoincidencia = !cargando && chatInicial && !mostrarTodas && carpetasFiltradas.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <h1>{chatInicial && !mostrarTodas ? `Archivos · ${chatInicial}` : 'Archivos importados'}</h1>
      </div>

      <div className="content">
        {cargando && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando...</div>}

        {sinCoincidencia && (
          <div className="alert alert-yellow">
            No se encontró chat para "{chatInicial}".{' '}
            <span onClick={() => setMostrarTodas(true)}
              style={{ fontWeight: 600, color: 'var(--blue1)', cursor: 'pointer', textDecoration: 'underline' }}>
              Ver todos
            </span>
          </div>
        )}

        {!sinCoincidencia && chatInicial && !mostrarTodas && carpetasFiltradas.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>
              {carpetasFiltradas.length} chat{carpetasFiltradas.length > 1 ? 's' : ''} encontrado{carpetasFiltradas.length > 1 ? 's' : ''}
            </span>
            <button onClick={() => setMostrarTodas(true)}
              style={{ fontSize: 12, color: 'var(--blue1)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver todos
            </button>
          </div>
        )}

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

        {carpetasFiltradas.map(c => {
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
