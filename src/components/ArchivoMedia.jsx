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

function parseFechaChat(s) {
  if (!s) return 0
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/)
  if (!m) return 0
  const [, d, mo, y, h, mi] = m
  const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
  return new Date(year, parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi)).getTime()
}

const TIPO_BADGE = { foto: 'FOTO', audio: 'AUDIO', video: 'VIDEO', pdf: 'PDF', excel: 'EXCEL', otro: 'OTRO' }
const BADGE_COLOR = { foto: '#dbeafe', audio: '#fef9c3', video: '#f3e8ff', pdf: '#fee2e2', excel: '#dcfce7', otro: 'var(--bg)' }
const BADGE_TEXT  = { foto: '#1d4ed8', audio: '#92400e', video: '#7e22ce', pdf: '#b91c1c', excel: '#166534', otro: 'var(--text3)' }

// ─── Vista de archivos de una carpeta ─────────────────────────────────────────
function VistaArchivos({ carpeta, onVolver }) {
  const [registros, setRegistros] = useState([])
  const [soloArchivos, setSoloArchivos] = useState(false)
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

      if (resumenData?.mensajes?.length) {
        // Con resumen: mostrar todos los mensajes con contenido
        const nombresResumen = new Set(resumenData.mensajes.map(m => m.archivo?.toLowerCase()).filter(Boolean))
        const lista = [
          ...resumenData.mensajes
            .filter(m => m.archivo || (m.texto && m.texto.trim().length > 3))
            .map(m => ({
              tipo: m.archivo ? tipoArchivo(m.archivo) : 'texto',
              fecha: m.fecha_str || null,
              autor: m.autor || null,
              contenido: m.archivo || m.texto?.trim() || '',
              esArchivo: !!m.archivo,
              url: m.url || null,
              ts: parseFechaChat(m.fecha_str),
            })),
          // archivos en storage sin entrada en resumen
          ...archivosStorage
            .filter(f => !nombresResumen.has(f.name.toLowerCase()))
            .map(f => ({
              tipo: tipoArchivo(f.name),
              fecha: f.created_at ? new Date(f.created_at).toLocaleDateString('es-AR') : null,
              autor: null,
              contenido: f.name,
              esArchivo: true,
              url: publicUrl(carpeta, f.name),
              ts: f.created_at ? new Date(f.created_at).getTime() : 0,
            })),
        ].sort((a, b) => a.ts - b.ts)
        setRegistros(lista)
      } else {
        // Sin resumen: solo archivos del storage
        const lista = archivosStorage.map(f => ({
          tipo: tipoArchivo(f.name),
          fecha: f.created_at ? new Date(f.created_at).toLocaleDateString('es-AR') : null,
          autor: null,
          contenido: f.name,
          esArchivo: true,
          url: publicUrl(carpeta, f.name),
          ts: f.created_at ? new Date(f.created_at).getTime() : 0,
        })).sort((a, b) => a.ts - b.ts)
        setRegistros(lista)
      }
      setCargando(false)
    }
    cargar()
  }, [carpeta])

  const titulo = carpeta.replace(/^Chat de WhatsApp con /i, '').replace(/^Inq\s+/i, '')
  const lista = soloArchivos ? registros.filter(r => r.esArchivo) : registros

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <h1 style={{ fontSize: 15 }}>{titulo}</h1>
        {!cargando && <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{lista.length}</span>}
      </div>

      {/* Filtro */}
      {!cargando && registros.some(r => !r.esArchivo) && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          {[false, true].map(v => (
            <button key={String(v)} onClick={() => setSoloArchivos(v)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 13, border: '1px solid var(--border)',
                background: soloArchivos === v ? 'var(--accent)' : 'transparent',
                color: soloArchivos === v ? 'white' : 'var(--text2)', cursor: 'pointer',
              }}>
              {v ? 'Solo archivos' : 'Todo'}
            </button>
          ))}
        </div>
      )}

      <div className="content" style={{ padding: 0 }}>
        {cargando && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando...</div>}
        {!cargando && lista.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Sin mensajes</div>
        )}

        {lista.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
          }}>
            {/* Icono */}
            <span style={{ fontSize: 16, flexShrink: 0, paddingTop: 2 }}>
              {r.tipo === 'texto' ? '💬' : ICONOS[r.tipo]}
            </span>

            {/* Contenido */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Cabecera: fecha · badge · autor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
                {r.fecha && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.fecha}</span>}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                  background: r.tipo === 'texto' ? '#f3f4f6' : BADGE_COLOR[r.tipo],
                  color: r.tipo === 'texto' ? 'var(--text3)' : BADGE_TEXT[r.tipo],
                }}>
                  {r.tipo === 'texto' ? 'TEXTO' : TIPO_BADGE[r.tipo]}
                </span>
                {r.autor && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {r.autor.replace(/^Inq\s+/i, '')}
                  </span>
                )}
              </div>
              {/* Texto o nombre de archivo */}
              <div style={{
                fontSize: 13,
                color: r.esArchivo ? 'var(--text)' : 'var(--text2)',
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {r.contenido}
              </div>
            </div>

            {/* Link Ver */}
            {r.url
              ? <a href={r.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0, textDecoration: 'none', paddingLeft: 6, paddingTop: 2 }}>
                  Ver
                </a>
              : <span style={{ width: 26 }} />
            }
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
