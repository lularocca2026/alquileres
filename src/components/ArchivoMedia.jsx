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

// Clave muy tolerante para emparejar nombre del chat con nombre real en storage:
// ignora mayúsculas, acentos, espacios, guiones y cualquier caracter no alfanumérico.
function matchKey(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.]/g, '')
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

const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg',
  m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel', vcf: 'text/vcard',
}

// download() funciona con bucket privado; genera blob URL para abrir en browser
function BtnVer({ path }) {
  const [estado, setEstado] = useState('idle')
  async function abrir() {
    setEstado('loading')
    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (data) {
      const ext = path.split('.').pop().toLowerCase()
      const type = MIME_MAP[ext] || 'application/octet-stream'
      const blob = new Blob([data], { type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setEstado('idle')
    } else {
      console.error('download error', error)
      setEstado('error')
      setTimeout(() => setEstado('idle'), 2000)
    }
  }
  return (
    <button onClick={abrir} disabled={estado === 'loading'}
      style={{
        fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer',
        color: estado === 'error' ? 'var(--red)' : 'var(--accent)',
        background: 'none', padding: 0,
        opacity: estado === 'loading' ? 0.5 : 1,
      }}>
      {estado === 'loading' ? '...' : estado === 'error' ? 'Error' : 'Ver'}
    </button>
  )
}

// ─── Vista de archivos de una carpeta ─────────────────────────────────────────
function VistaArchivos({ carpeta, onVolver }) {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const EXCLUIR = ['_resumen.json', '_chat.txt']

      // Listar TODOS los archivos del storage (paginado por si hay > 1000)
      let archivosStorage = []
      let offset = 0
      while (true) {
        const { data } = await supabase.storage.from(BUCKET).list(carpeta, {
          limit: 1000, offset, sortBy: { column: 'name', order: 'asc' },
        })
        if (!data || data.length === 0) break
        archivosStorage.push(...data)
        if (data.length < 1000) break
        offset += 1000
      }
      archivosStorage = archivosStorage
        .filter(f => f.name && !EXCLUIR.includes(f.name) && !f.name.endsWith('.txt'))

      // Resumen del chat (metadata: fecha, autor, texto)
      const { data: resumenBlob } = await supabase.storage.from(BUCKET).download(`${carpeta}/_resumen.json`)
      let resumenData = null
      if (resumenBlob) {
        try { resumenData = JSON.parse(await resumenBlob.text()) } catch {}
      }

      const mensajes = resumenData?.mensajes || []

      // Index del resumen por matchKey del nombre de archivo → metadata del mensaje
      const metaPorArchivo = {}
      for (const m of mensajes) {
        if (m.archivo) metaPorArchivo[matchKey(m.archivo)] = m
      }
      const clavesUsadas = new Set()

      // 1) FUENTE DE VERDAD: cada archivo en storage SIEMPRE se puede abrir
      const filasArchivos = archivosStorage.map(f => {
        const key = matchKey(f.name)
        const meta = metaPorArchivo[key]
        if (meta) clavesUsadas.add(key)
        return {
          tipo: tipoArchivo(f.name),
          fecha: meta?.fecha_str || (f.created_at ? new Date(f.created_at).toLocaleDateString('es-AR') : null),
          autor: meta?.autor || null,
          contenido: meta?.archivo || f.name,
          esArchivo: true,
          path: `${carpeta}/${f.name}`,
          ts: parseFechaChat(meta?.fecha_str) || (f.created_at ? new Date(f.created_at).getTime() : 0),
        }
      })

      // 2) Mensajes de TEXTO (sin archivo) + referencias a archivos que NO están en storage
      const filasTexto = mensajes
        .filter(m => {
          if (m.archivo) return !clavesUsadas.has(matchKey(m.archivo)) // archivo faltante
          return m.texto && m.texto.trim().length > 3                   // texto real
        })
        .map(m => ({
          tipo: m.archivo ? tipoArchivo(m.archivo) : 'texto',
          fecha: m.fecha_str || null,
          autor: m.autor || null,
          contenido: m.archivo || m.texto.trim(),
          esArchivo: !!m.archivo,
          path: null, // no está en storage
          ts: parseFechaChat(m.fecha_str),
        }))

      const lista = [...filasArchivos, ...filasTexto].sort((a, b) => a.ts - b.ts)
      setRegistros(lista)
      setCargando(false)
    }
    cargar()
  }, [carpeta])

  const titulo = carpeta.replace(/^Chat de WhatsApp con /i, '').replace(/^Inq\s+/i, '')
  const lista = registros

  async function borrarArchivo(path) {
    if (!window.confirm('¿Borrar este archivo de la nube? No se puede deshacer.')) return
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) { alert('No se pudo borrar: ' + error.message); return }
    setRegistros(rs => rs.filter(r => r.path !== path))
  }

  async function borrarTodos() {
    if (!window.confirm(`¿Borrar TODOS los archivos de "${titulo}"? Borra todo el chat importado y no se puede deshacer.`)) return
    // Repetir listar + borrar en lotes hasta vaciar la carpeta (remove tiene límite de lote)
    for (let ronda = 0; ronda < 40; ronda++) {
      const { data, error: errList } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 1000 })
      if (errList) { alert('No se pudo listar: ' + errList.message); return }
      const paths = (data || []).filter(f => f.name).map(f => `${carpeta}/${f.name}`)
      if (paths.length === 0) { onVolver(); return } // ya está vacía
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100))
        if (error) { alert('No se pudo borrar: ' + error.message); return }
      }
    }
    // Si tras 40 rondas todavía quedan, avisar
    const { data } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 1000 })
    const quedan = (data || []).filter(f => f.name).length
    if (quedan > 0) alert(`Quedaron ${quedan} archivos sin borrar. Volvé a intentar.`)
    else onVolver()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <h1 style={{ fontSize: 15 }}>{titulo}</h1>
        {!cargando && <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{lista.length}</span>}
      </div>

      {!cargando && registros.some(r => r.path) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button onClick={borrarTodos}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
            🗑 Borrar todos los archivos
          </button>
        </div>
      )}

      <div style={{ flex: 1 }}>
        {cargando && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando...</div>}
        {!cargando && lista.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Sin mensajes</div>
        )}

        {!cargando && lista.length > 0 && (
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12 }}>
            <colgroup>
              <col style={{ width: 58 }} />{/* Fecha */}
              <col style={{ width: 50 }} />{/* Tipo */}
              <col style={{ width: 56 }} />{/* Autor */}
              <col />{/* Mensaje / Archivo (resto) */}
              <col style={{ width: 50 }} />{/* Ver / borrar */}
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 1 }}>
                {['Fecha','Tipo','Autor','Mensaje','Ver'].map((h, i) => (
                  <th key={h} style={{
                    padding: '8px 6px', textAlign: i === 4 ? 'center' : 'left',
                    fontWeight: 700, fontSize: 11, color: 'var(--text2)',
                    borderBottom: '2px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                  <td style={{ padding: '7px 6px', color: 'var(--text3)', verticalAlign: 'top', fontSize: 11 }}>
                    {r.fecha || '—'}
                  </td>
                  <td style={{ padding: '7px 4px', verticalAlign: 'top' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 4px', borderRadius: 4, display: 'inline-block',
                      background: r.tipo === 'texto' ? '#f3f4f6' : BADGE_COLOR[r.tipo],
                      color: r.tipo === 'texto' ? 'var(--text3)' : BADGE_TEXT[r.tipo],
                    }}>
                      {r.tipo === 'texto' ? 'TEXTO' : TIPO_BADGE[r.tipo]}
                    </span>
                  </td>
                  <td style={{ padding: '7px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)', verticalAlign: 'top', fontSize: 11 }}>
                    {r.autor ? r.autor.replace(/^Inq\s+/i, '') : '—'}
                  </td>
                  <td style={{ padding: '7px 6px', verticalAlign: 'top' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', color: r.esArchivo ? 'var(--text)' : 'var(--text2)' }}>
                      {r.contenido}
                    </div>
                  </td>
                  <td style={{ padding: '7px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                    {r.path
                      ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                          <BtnVer path={r.path} />
                          <button onClick={() => borrarArchivo(r.path)} title="Borrar archivo"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1, opacity: 0.7 }}>
                            🗑
                          </button>
                        </div>
                      : r.esArchivo
                        ? <span style={{ fontSize: 10, color: 'var(--text3)' }}>—</span>
                        : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
        if (chatInicial) {
          const matches = todas.filter(c => palabrasMatch(c.name, chatInicial))
          // 1 coincidencia → abrir directo; 0 → no hay archivos, ir a importar
          if (matches.length === 1) setCarpetaAbierta(matches[0].name)
          else if (matches.length === 0 && onImportar) onImportar()
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
