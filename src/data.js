import rawData from '../data/alquileres.json'

export const data = rawData

// Propiedades con datos reales (excluye entradas vacías)
export const propiedades = rawData.propiedades.filter(p => p.Ciudad && p.Tipo)

export const inquilinos = rawData.inquilinos

export const contratos = rawData.contratos.filter(c => c.IdPropiedad > 0 && c.IdInquilino > 0)

export const pagos = rawData.pagos

export const mantenimiento = rawData.mantenimiento.filter(m => m.Descripcion)

export function getInquilino(id) {
  return rawData.inquilinos.find(i => i.IdInquilino === id)
}

export function getContrato(id) {
  return contratos.find(c => c.IdContrato === id)
}

export function getContratoActivo(idPropiedad) {
  return contratos.find(c => c.IdPropiedad === idPropiedad && c.activo)
}

export function getPagosContrato(idContrato) {
  return pagos.filter(p => p.IdContrato === idContrato).sort((a, b) =>
    new Date(b.FechaPago) - new Date(a.FechaPago)
  )
}

export function getMantenimientoPropiedad(idPropiedad) {
  return mantenimiento.filter(m => m.IdPropiedad === idPropiedad).sort((a, b) =>
    new Date(b.Fecha) - new Date(a.Fecha)
  )
}

export function formatPesos(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function diasParaVencer(fechaFin) {
  if (!fechaFin) return null
  const hoy = new Date()
  const fin = new Date(fechaFin)
  return Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
}
