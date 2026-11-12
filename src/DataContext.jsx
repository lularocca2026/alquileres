import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import rawData from '../data/alquileres.json'

// Limpia datos crudos de Access (solo se usa la primera vez, si el backend está vacío)
const PROPS_VALIDAS = rawData.propiedades.filter(p => p.Ciudad && p.Tipo)
const CONTRATOS_VALIDOS = rawData.contratos.filter(c => c.IdPropiedad > 0 && c.IdInquilino > 0)
const MANT_VALIDO = rawData.mantenimiento.filter(m => m.Descripcion)

function estadoInicial() {
  return {
    propiedades: PROPS_VALIDAS,
    inquilinos: rawData.inquilinos,
    contratos: CONTRATOS_VALIDOS,
    pagos: rawData.pagos,
    mantenimiento: MANT_VALIDO,
  }
}

const DataContext = createContext(null)
const POLL_MS = 3000 // cada cuánto revisa si otro dispositivo cambió algo

export function DataProvider({ children }) {
  const [estado, setEstado] = useState(null)        // null = todavía cargando
  const [cargando, setCargando] = useState(true)
  const [sincronizado, setSincronizado] = useState(true) // false si backend no responde
  const versionRef = useRef(0)
  const guardandoRef = useRef(false)

  // ── Carga inicial desde el backend ──────────────────────────────────────
  useEffect(() => {
    let cancelado = false
    async function cargar() {
      try {
        const r = await fetch('/api/data')
        const json = await r.json()
        if (cancelado) return
        if (json.data) {
          setEstado(json.data)
          versionRef.current = json.version
        } else {
          // Backend vacío → inicializar desde el import de Access y guardarlo
          const inicial = (() => {
            try {
              const cache = localStorage.getItem('alquileres_data')
              if (cache) return JSON.parse(cache)
            } catch {}
            return estadoInicial()
          })()
          setEstado(inicial)
          await guardarBackend(inicial)
        }
        setSincronizado(true)
      } catch {
        // Backend caído → usar caché local
        if (cancelado) return
        let cache = estadoInicial()
        try {
          const c = localStorage.getItem('alquileres_data')
          if (c) cache = JSON.parse(c)
        } catch {}
        setEstado(cache)
        setSincronizado(false)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [])

  // ── Polling: detecta cambios hechos en otro dispositivo ─────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      if (guardandoRef.current) return // no pisar mientras guardamos
      try {
        const r = await fetch('/api/data-version')
        const { version } = await r.json()
        if (version && version !== versionRef.current) {
          const rd = await fetch('/api/data')
          const json = await rd.json()
          if (json.data) {
            setEstado(json.data)
            versionRef.current = json.version
          }
        }
        setSincronizado(true)
      } catch {
        setSincronizado(false)
      }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [])

  // ── Guardar en el backend ────────────────────────────────────────────────
  async function guardarBackend(nuevo) {
    guardandoRef.current = true
    try {
      const r = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: nuevo }),
      })
      const json = await r.json()
      if (json.version) versionRef.current = json.version
      setSincronizado(true)
    } catch {
      setSincronizado(false)
    } finally {
      guardandoRef.current = false
    }
  }

  const actualizar = useCallback((nuevo) => {
    setEstado(nuevo)
    localStorage.setItem('alquileres_data', JSON.stringify(nuevo)) // caché de respaldo
    guardarBackend(nuevo)
  }, [])

  // ── Propiedades ──
  function editarPropiedad(id, cambios) {
    actualizar({ ...estado, propiedades: estado.propiedades.map(p => p.IdPropiedad === id ? { ...p, ...cambios } : p) })
  }

  // ── Inquilinos ──
  function editarInquilino(id, cambios) {
    actualizar({ ...estado, inquilinos: estado.inquilinos.map(i => i.IdInquilino === id ? { ...i, ...cambios } : i) })
  }

  // ── Contratos ──
  function editarContrato(id, cambios) {
    actualizar({ ...estado, contratos: estado.contratos.map(c => c.IdContrato === id ? { ...c, ...cambios } : c) })
  }
  function agregarContrato(contrato) {
    const nuevoId = Math.max(...estado.contratos.map(c => c.IdContrato), 0) + 1
    const contratos = estado.contratos.map(c =>
      c.IdPropiedad === contrato.IdPropiedad ? { ...c, activo: false } : c
    )
    actualizar({ ...estado, contratos: [...contratos, { ...contrato, IdContrato: nuevoId }] })
  }

  // ── Pagos ──
  function editarPago(id, cambios) {
    actualizar({ ...estado, pagos: estado.pagos.map(p => p.idpago === id ? { ...p, ...cambios } : p) })
  }
  function agregarPago(pago) {
    const nuevoId = Math.max(...estado.pagos.map(p => p.idpago), 0) + 1
    actualizar({ ...estado, pagos: [...estado.pagos, { ...pago, idpago: nuevoId }] })
  }
  function eliminarPago(id) {
    actualizar({ ...estado, pagos: estado.pagos.filter(p => p.idpago !== id) })
  }

  // ── Mantenimiento ──
  function editarMantenimiento(id, cambios) {
    actualizar({ ...estado, mantenimiento: estado.mantenimiento.map(m => m.IdMantenimiento === id ? { ...m, ...cambios } : m) })
  }
  function agregarMantenimiento(item) {
    const nuevoId = Math.max(...estado.mantenimiento.map(m => m.IdMantenimiento), 0) + 1
    actualizar({ ...estado, mantenimiento: [...estado.mantenimiento, { ...item, IdMantenimiento: nuevoId }] })
  }
  function eliminarMantenimiento(id) {
    actualizar({ ...estado, mantenimiento: estado.mantenimiento.filter(m => m.IdMantenimiento !== id) })
  }

  // ── Export JSON (descarga de respaldo) ──
  async function exportarJSON() {
    const contenido = JSON.stringify(estado, null, 2)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'alquileres.json',
          startIn: 'downloads',
          types: [{ description: 'Archivo JSON', accept: { 'application/json': ['.json'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(contenido)
        await writable.close()
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'alquileres.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── Helpers de consulta ──
  function getPropiedad(id) { return estado.propiedades.find(p => p.IdPropiedad === id) }
  function getInquilino(id) { return estado.inquilinos.find(i => i.IdInquilino === id) }
  function getContratoActivo(idProp) { return estado.contratos.find(c => c.IdPropiedad === idProp && c.activo) }
  function getContratosPropiedad(idProp) { return estado.contratos.filter(c => c.IdPropiedad === idProp && c.IdInquilino > 0).sort((a,b) => new Date(b.FechaInicio||0) - new Date(a.FechaInicio||0)) }
  function getPagosContrato(idContrato) {
    return estado.pagos.filter(p => p.IdContrato === idContrato).sort((a, b) => new Date(b.FechaPago) - new Date(a.FechaPago))
  }
  function getMantPropiedad(idProp) {
    return estado.mantenimiento.filter(m => m.IdPropiedad === idProp).sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha))
  }

  // Pantalla de carga mientras llega el estado del backend
  if (cargando || !estado) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text2)' }}>
        <div style={{ fontSize: 32 }}>🏠</div>
        <div style={{ fontSize: 14 }}>Cargando datos...</div>
      </div>
    )
  }

  return (
    <DataContext.Provider value={{
      ...estado,
      sincronizado,
      editarPropiedad, editarInquilino,
      editarContrato, agregarContrato,
      editarPago, agregarPago, eliminarPago,
      editarMantenimiento, agregarMantenimiento, eliminarMantenimiento,
      exportarJSON,
      getPropiedad, getInquilino, getContratoActivo, getContratosPropiedad, getPagosContrato, getMantPropiedad,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
