import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'
import rawData from '../data/alquileres.json'

// Datos iniciales (solo si Supabase está vacío la primera vez)
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

export function DataProvider({ children }) {
  const [estado, setEstado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [sincronizado, setSincronizado] = useState(true)
  const guardandoRef = useRef(false)

  // ── Carga inicial + suscripción Realtime ─────────────────────────────────
  useEffect(() => {
    let cancelado = false

    async function cargar() {
      const { data, error } = await supabase
        .from('estado_app').select('data').eq('id', 1).single()
      if (cancelado) return

      if (error) {
        setSincronizado(false)
        setCargando(false)
        return
      }

      const d = data?.data
      if (d && Object.keys(d).length > 0) {
        setEstado(d)
      } else {
        // Supabase vacío → sembrar con el import de Access
        const inicial = estadoInicial()
        setEstado(inicial)
        await supabase.from('estado_app')
          .update({ data: inicial, updated_at: new Date().toISOString() })
          .eq('id', 1)
      }
      setSincronizado(true)
      setCargando(false)
    }
    cargar()

    // Realtime: cuando otro dispositivo guarda, actualizamos al instante
    const canal = supabase
      .channel('estado_app_cambios')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'estado_app', filter: 'id=eq.1' },
        payload => {
          if (guardandoRef.current) return // ignorar el eco de nuestro propio guardado
          if (payload.new?.data) setEstado(payload.new.data)
        }
      )
      .subscribe()

    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [])

  // ── Guardar en Supabase ──────────────────────────────────────────────────
  async function guardar(nuevo) {
    setEstado(nuevo)
    guardandoRef.current = true
    const { error } = await supabase.from('estado_app')
      .update({ data: nuevo, updated_at: new Date().toISOString() })
      .eq('id', 1)
    setSincronizado(!error)
    setTimeout(() => { guardandoRef.current = false }, 300)
  }

  const actualizar = useCallback((nuevo) => { guardar(nuevo) }, [])

  // ── Propiedades ──
  function editarPropiedad(id, cambios) {
    actualizar({ ...estado, propiedades: estado.propiedades.map(p => p.IdPropiedad === id ? { ...p, ...cambios } : p) })
  }
  // ── Inquilinos ──
  function editarInquilino(id, cambios) {
    actualizar({ ...estado, inquilinos: estado.inquilinos.map(i => i.IdInquilino === id ? { ...i, ...cambios } : i) })
  }
  function agregarInquilino(inquilino) {
    const nuevoId = Math.max(...estado.inquilinos.map(i => i.IdInquilino), 0) + 1
    actualizar({ ...estado, inquilinos: [...estado.inquilinos, { ...inquilino, IdInquilino: nuevoId }] })
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

  // ── Export JSON (respaldo) ──
  async function exportarJSON() {
    const contenido = JSON.stringify(estado, null, 2)
    const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'alquileres.json'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
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
      editarPropiedad, editarInquilino, agregarInquilino,
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
