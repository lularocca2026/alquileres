import { useState, useRef } from 'react'
import JSZip from 'jszip'
import { supabase } from '../supabase.js'
import { useData } from '../DataContext.jsx'
import { formatPesos, formatFecha } from '../utils.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function limpiarClave(s) {
  return s
    .replace(/[°º]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parsearChat(texto) {
  texto = texto.replace(/^\uFEFF/, '')
  const lineas = texto.split('\n')
  const mensajes = []
  let actual = null

  const RE_AND = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2})\s+-\s+([^:]+):\s*(.*)/
  const RE_IOS = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s*(.*)/
  const RE_MEDIA = /^(.+\.(jpg|jpeg|png|gif|webp|heic|mp3|ogg|opus|m4a|wav|aac|mp4|mov|avi|pdf|xlsx?|docx?|zip))\s*(\(.*?\))?$/i

  for (const linea of lineas) {
    const m = linea.match(RE_AND) || linea.match(RE_IOS)
    if (m) {
      if (actual) mensajes.push(actual)
      const [, fecha, hora, autor, contenido] = m
      const mediaMatch = contenido.trim().match(RE_MEDIA)
      actual = {
        fecha_str: `${fecha} ${hora}`,
        autor: autor.trim(),
        texto: mediaMatch ? '' : contenido.trim(),
        archivo: mediaMatch ? mediaMatch[1] : null,
        url: null,
      }
    } else if (actual && linea.trim()) {
      actual.texto += '\n' + linea.trim()
    }
  }
  if (actual) mensajes.push(actual)
  return mensajes
}

// ─── Preview de un item detectado ─────────────────────────────────────────────
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

// ─── Álbum de fotos (usando URLs de Supabase) ─────────────────────────────────
function AlbumFotos({ fotos }) {
  const [abierta, setAbierta] = useState(null)
  if (!fotos?.length) return null

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>📷 Fotos ({fotos.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {fotos.map((f, i) => (
          <div key={i} onClick={() => setAbierta(f)}
            style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--surface2)', cursor: 'pointer' }}>
            {f.url
              ? <img src={f.url} alt={f.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 24 }}>📷</div>
            }
          </div>
        ))}
      </div>

      {abierta && (
        <div onClick={() => setAbierta(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <button onClick={() => setAbierta(null)}
            style={{ position: 'absolute', top: 16, right: 16, color: 'white', fontSize: 28, background: 'none' }}>
            ×
          </button>
          {abierta.url && (
            <img src={abierta.url} alt={abierta.nombre}
              style={{ maxWidth: '100%', maxHeight: '80dvh', borderRadius: 8, objectFit: 'contain' }}
              onClick={e => e.stopPropagation()} />
          )}
          <div style={{ color: 'white', fontSize: 13, marginTop: 12, opacity: 0.7 }}>{abierta.nombre}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {fotos.indexOf(abierta) > 0 && (
              <button onClick={e => { e.stopPropagation(); setAbierta(fotos[fotos.indexOf(abierta) - 1]) }}
                style={{ color: 'white', background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: 8 }}>←</button>
            )}
            {fotos.indexOf(abierta) < fotos.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setAbierta(fotos[fotos.indexOf(abierta) + 1]) }}
                style={{ color: 'white', background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: 8 }}>→</button>
            )}
          </div>
        </div>
      )}
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
  const inputRef = useRef(null)

  function toggleItem(tipo, idx) {
    setSeleccionados(s => ({ ...s, [`${tipo}_${idx}`]: !s[`${tipo}_${idx}`] }))
  }

  function isSeleccionado(tipo, idx) {
    return seleccionados[`${tipo}_${idx}`] ?? true
  }

  async function procesarArchivo(file) {
    setFase('subiendo')
    setError(null)

    try {
      let chatTexto, carpeta, mediaFiles = []

      if (file.name.endsWith('.txt')) {
        chatTexto = await file.text()
        carpeta = limpiarClave(file.name.replace(/\.txt$/i, ''))
      } else {
        setProgreso('Extrayendo ZIP...')
        const zip = await JSZip.loadAsync(file)

        let chatEntry = zip.file('_chat.txt')
        if (!chatEntry) {
          const encontrados = zip.file(/_chat\.txt$/i)
          chatEntry = encontrados[0] || null
        }
        if (!chatEntry) throw new Error('No se encontró _chat.txt en el ZIP. Asegurate de exportar el chat de WhatsApp.')

        chatTexto = await chatEntry.async('text')
        carpeta = limpiarClave(file.name.replace(/\.zip$/i, ''))
        mediaFiles = Object.values(zip.files).filter(
          f => !f.dir && !f.name.match(/(_chat\.txt|_resumen\.json)$/)
        )
      }

      setProgreso('Analizando mensajes...')
      const mensajes = parsearChat(chatTexto)
      const urlMap = {}
      let subidos = 0

      // ── Subir archivos de media ──────────────────────────────────────────────
      if (mediaFiles.length > 0) {
        // Construir mapa clave → entrada
        const fileMap = {}
        for (const f of mediaFiles) {
          const nombreBase = limpiarClave(f.name.split('/').pop())
          if (nombreBase) fileMap[`${carpeta}/${nombreBase}`] = { entrada: f, nombreOriginal: f.name.split('/').pop() }
        }

        const claves = Object.keys(fileMap)

        // Pedir signed URLs en lotes de 25
        const signedMap = {}
        for (let i = 0; i < claves.length; i += 25) {
          const lote = claves.slice(i, i + 25)
          try {
            const r = await fetch('/api/storage-upload-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paths: lote }),
            })
            if (r.ok) Object.assign(signedMap, await r.json())
          } catch {}
        }

        // Subir uno por uno mostrando progreso
        let idx = 0
        for (const [clave, { entrada, nombreOriginal }] of Object.entries(fileMap)) {
          idx++
          const nombreLimpio = clave.split('/').pop()
          setProgreso(`Subiendo ${idx}/${claves.length}: ${nombreLimpio}`)

          const signed = signedMap[clave]
          if (!signed) continue

          try {
            const blob = await entrada.async('blob')
            const { error: upErr } = await supabase.storage
              .from('archivos')
              .uploadToSignedUrl(signed.path, signed.token, blob)

            if (!upErr) {
              const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(clave)
              urlMap[nombreOriginal] = urlData.publicUrl
              urlMap[nombreLimpio] = urlData.publicUrl
              subidos++
            }
          } catch {}
        }
      }

      // ── Enriquecer mensajes con URLs ─────────────────────────────────────────
      const mensajesConUrls = mensajes.map(m => ({
        ...m,
        url: m.archivo ? (urlMap[m.archivo] || urlMap[limpiarClave(m.archivo)] || null) : null,
      }))

      const analisis = { pagos: [], mantenimiento: [], observaciones: [], inconsistencias: [] }

      // ── Guardar _resumen.json ────────────────────────────────────────────────
      try {
        const resumenBlob = new Blob([JSON.stringify({
          carpeta, total_mensajes: mensajes.length, mensajes: mensajesConUrls, analisis,
          generado: new Date().toISOString(),
        })], { type: 'application/json' })

        const rPath = `${carpeta}/_resumen.json`
        const rRes = await fetch('/api/storage-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [rPath] }),
        })
        if (rRes.ok) {
          const rData = await rRes.json()
          const signed = rData[rPath]
          if (signed) {
            await supabase.storage.from('archivos').uploadToSignedUrl(signed.path, signed.token, resumenBlob)
          }
        }
      } catch {}

      // ── Fotos para el preview ────────────────────────────────────────────────
      const fotos = mensajesConUrls
        .filter(m => m.url && m.archivo?.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i))
        .map(m => ({ nombre: m.archivo, url: m.url }))

      setResultado({ total_mensajes: mensajes.length, archivos_subidos: subidos, analisis, fotos })

      const sel = {}
      analisis.pagos?.forEach((_, i) => { sel[`pago_${i}`] = true })
      analisis.mantenimiento?.forEach((_, i) => { sel[`mantenimiento_${i}`] = true })
      analisis.observaciones?.forEach((_, i) => { sel[`observacion_${i}`] = true })
      setSeleccionados(sel)
      setFase('preview')

    } catch (e) {
      console.error('Error procesando ZIP:', e)
      setError(e.message || 'Error procesando el archivo')
      setFase('instrucciones')
    }
  }

  function confirmarImportacion() {
    const { analisis } = resultado
    const contratoActivo = contratos.find(c => c.activo && c.IdPropiedad > 0)

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
                  'Elegí "Con archivos" para incluir fotos y documentos',
                  'Compartí el .zip a esta app',
                ].map((paso, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 14, paddingTop: 3 }}>{paso}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="alert alert-yellow">
              💡 La IA detecta pagos, reparaciones y observaciones. Los archivos se guardan en la nube.
            </div>

            {error && <div className="alert alert-red">⚠ {error}</div>}

            <input ref={inputRef} type="file" accept=".zip,.txt" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && procesarArchivo(e.target.files[0])}
            />
            <button
              className="btn btn-primary btn-full"
              style={{ padding: '14px 16px', fontSize: 15 }}
              onClick={() => inputRef.current?.click()}
            >
              📁 Seleccionar ZIP de WhatsApp
            </button>
          </>
        )}

        {/* ── Procesando ── */}
        {fase === 'subiendo' && (
          <div style={{ textAlign: 'center', padding: '60px 16px' }}>
            <div style={{ fontSize: 44, marginBottom: 16, animation: 'spin 1s linear infinite' }}>⚙️</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{progreso}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Puede tardar un momento si hay muchos archivos</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── Preview ── */}
        {fase === 'preview' && resultado && !confirmados && (
          <>
            <div className="card">
              <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{resultado.total_mensajes}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>mensajes</div>
                </div>
                {resultado.archivos_subidos > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{resultado.archivos_subidos}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>archivos</div>
                  </div>
                )}
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
              </div>
            </div>

            {resultado.analisis?.inconsistencias?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>⚠ Posibles problemas</div>
                {resultado.analisis.inconsistencias.map((item, i) => (
                  <FilaDetectada key={i}
                    item={{ descripcion: item.descripcion || item.descripcion_inconsistencia, ...item }}
                    tipo="inconsistencia" seleccionado={false} />
                ))}
              </div>
            )}

            {resultado.analisis?.pagos?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
                  Pagos detectados — tocá para incluir/excluir
                </div>
                {resultado.analisis.pagos.map((item, i) => (
                  <FilaDetectada key={i} item={item} tipo="pago"
                    seleccionado={isSeleccionado('pago', i)}
                    onToggle={() => toggleItem('pago', i)} />
                ))}
              </div>
            )}

            {resultado.analisis?.mantenimiento?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Mantenimiento</div>
                {resultado.analisis.mantenimiento.map((item, i) => (
                  <FilaDetectada key={i} item={item} tipo="mantenimiento"
                    seleccionado={isSeleccionado('mantenimiento', i)}
                    onToggle={() => toggleItem('mantenimiento', i)} />
                ))}
              </div>
            )}

            {resultado.analisis?.observaciones?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Observaciones</div>
                {resultado.analisis.observaciones.map((item, i) => (
                  <FilaDetectada key={i} item={item} tipo="observacion"
                    seleccionado={isSeleccionado('observacion', i)}
                    onToggle={() => toggleItem('observacion', i)} />
                ))}
              </div>
            )}

            <AlbumFotos fotos={resultado.fotos} />

            {totalDetectado === 0 && !resultado.fotos?.length && (
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>🔍</div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>No se detectaron eventos automáticamente</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  {resultado.archivos_subidos > 0
                    ? `Se subieron ${resultado.archivos_subidos} archivos. Podés verlos en la sección Archivos.`
                    : 'La conversación puede no tener menciones de pagos o mantenimiento.'}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', bottom: 0, background: 'var(--bg)', paddingBottom: 16, paddingTop: 8 }}>
              <button className="btn btn-primary btn-full" style={{ padding: '14px' }} onClick={confirmarImportacion}>
                {totalDetectado > 0
                  ? `Confirmar importación (${totalDetectado} items)`
                  : `Confirmar y ver archivos`}
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
              Los pagos y observaciones ya están en la app. Los archivos están disponibles en la sección Archivos.
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
