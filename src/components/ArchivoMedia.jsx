import { useState, useEffect, Component } from 'react'

// ─── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 24, color: 'var(--red)', fontSize: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Error al cargar archivos</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{this.state.error}</div>
        <button
          onClick={() => this.setState({ error: null })}
          style={{ marginTop: 12, padding: '8px 16px', background: 'var(--blue1)', color: 'white', borderRadius: 8, fontSize: 13 }}
        >
          Reintentar
        </button>
      </div>
    )
    return this.props.children
  }
}

// ─── Badge de tipos ────────────────────────────────────────────────────────────
function TipoBadge({ tipos }) {
  if (!tipos || typeof tipos !== 'object') return null
  const iconos = { fotos: '📷', audios: '🎙', pdfs: '📄', videos: '🎬' }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {Object.entries(tipos).map(([tipo, cant]) => (
        <span key={tipo} style={{
          fontSize: 12, padding: '2px 8px', borderRadius: 20,
          background: 'var(--surface2)', color: 'var(--text2)',
        }}>
          {iconos[tipo] || '📎'} {cant} {tipo}
        </span>
      ))}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
function ArchivoMediaInner({ onVolver, chatInicial, onImportar }) {
  const [chats, setChats] = useState([])
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [carpetaRaiz, setCarpetaRaiz] = useState('')
  const [toast, setToast] = useState(null)

  function mostrarToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    fetch('/api/chats')
      .then(r => r.json())
      .then(d => { setChats(d.chats || []); setCargando(false) })
      .catch(() => { setError('No se pudo conectar al backend. Asegurate de que INICIAR.bat esté corriendo.'); setCargando(false) })
    fetch('/api/config')
      .then(r => r.json())
      .then(d => setCarpetaRaiz(d?.whatsapp_carpeta || ''))
      .catch(() => {})
  }, [])

  async function generarExcel(nombreChat) {
    setGenerando(nombreChat)
    setResultado(null)
    try {
      const r = await fetch(`/api/generar-excel/${encodeURIComponent(nombreChat)}`, { method: 'POST' })
      const data = await r.json()
      if (data.ok) {
        setResultado({ chat: nombreChat })
        setChats(prev => prev.map(c => c.nombre === nombreChat ? { ...c, excel_existe: true } : c))
      } else {
        setError(data.error)
      }
    } catch (e) {
      setError(e.message)
    }
    setGenerando(null)
  }

  async function abrirCarpeta(nombreChat) {
    try {
      await fetch(`/api/abrir-carpeta/${encodeURIComponent(nombreChat)}`, { method: 'POST' })
      mostrarToast('📁 Carpeta abierta en el Explorador')
    } catch { mostrarToast('⚠ No se pudo abrir la carpeta') }
  }

  async function abrirExcel(nombreChat) {
    try {
      await fetch(`/api/abrir-excel/${encodeURIComponent(nombreChat)}`, { method: 'POST' })
      mostrarToast('📊 Excel abierto')
    } catch { mostrarToast('⚠ No se pudo abrir el Excel') }
  }

  // Título del header
  const titulo = chatInicial
    ? String(chatInicial)
    : 'Archivos importados'

  // Lista filtrada — busca el apellido dentro del nombre del chat
  const lista = chatInicial
    ? chats.filter(c => String(c?.nombre || '').toLowerCase().includes(String(chatInicial).toLowerCase()))
    : chats

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, background: 'var(--navy)', color: 'white',
          padding: '12px 24px', borderRadius: 30,
          fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(30,58,95,0.35)',
          animation: 'fadeIn 0.2s ease',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateX(-50%) translateY(8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>

      <div className="header">
        <button className="back-btn" onClick={onVolver}>←</button>
        <h1>{titulo}</h1>
      </div>

      <div className="content">
        {error && <div className="alert alert-red">⚠ {error}</div>}

        {cargando && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Cargando...</div>
        )}

        {!cargando && lista.length === 0 && !error && (
          <div className="card">
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: 'var(--text)' }}>
                {chatInicial ? `Sin archivos de ${chatInicial}` : 'No hay chats importados todavía'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
                Exportá el chat de WhatsApp y subilo para ver fotos, audios y documentos.
              </div>
              <button
                className="btn btn-primary btn-full"
                style={{ padding: '13px', fontSize: 14 }}
                onClick={onImportar}
              >
                📲 Importar ZIP de WhatsApp
              </button>
            </div>
          </div>
        )}

        {lista.map(chat => {
          if (!chat || !chat.nombre) return null
          return (
            <div key={chat.nombre} className="card">
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                  {chat.nombre.replace(/^Chat de WhatsApp con /i, '').replace(/^Inq\s+/i, '')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                  {chat.total || 0} archivos totales
                </div>
                <TipoBadge tipos={chat.tipos} />

                <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <button
                    onClick={() => abrirCarpeta(chat.nombre)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 14px', borderRadius: 10,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      color: 'var(--navy)', cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>📁</span>
                    <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>Ver carpeta</span>
                  </button>

                  {chat.excel_existe && (
                    <button
                      onClick={() => abrirExcel(chat.nombre)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '10px 14px', borderRadius: 10,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        color: 'var(--navy)', cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>📊</span>
                      <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>Ver Excel</span>
                    </button>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                    onClick={() => generarExcel(chat.nombre)}
                    disabled={generando === chat.nombre}
                  >
                    {generando === chat.nombre ? '⏳ Generando...' : chat.excel_existe ? 'Volver a crear Excel' : '📊 Crear Excel'}
                  </button>
                </div>

                {generando === chat.nombre && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                    Transcribiendo audios... puede tardar unos minutos.
                  </div>
                )}

                {resultado?.chat === chat.nombre && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8,
                    background: '#dcfce7', border: '1px solid #86efac',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>✅ Excel generado</div>
                    <button onClick={() => abrirExcel(chat.nombre)}
                      style={{ fontSize: 13, color: '#166534', fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#bbf7d0' }}>
                      Abrir →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {!cargando && carpetaRaiz && (
          <div style={{ padding: '8px 4px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
            Los archivos están en:<br />
            <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{carpetaRaiz}</code>
          </div>
        )}
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
