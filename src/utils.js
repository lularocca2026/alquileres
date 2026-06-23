export function formatPesos(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function formatUSD(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatMes(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export function diasParaVencer(fechaFin) {
  if (!fechaFin) return null
  const hoy = new Date()
  const fin = new Date(fechaFin)
  return Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
}

export function isoHoy() {
  return new Date().toISOString().split('T')[0]
}

export function isoToDate(iso) {
  if (!iso) return ''
  return iso.split('T')[0]
}
