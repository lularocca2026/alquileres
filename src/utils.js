export function formatPesos(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function formatUSD(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// Parsea una fecha (ISO o "YYYY-MM-DD") usando sus componentes en hora LOCAL,
// evitando el corrimiento de un día por zona horaria (UTC → UTC-3).
export function parseLocalDate(iso) {
  if (!iso) return null
  const datePart = String(iso).split('T')[0]
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return new Date(iso) // fallback para otros formatos
  return new Date(y, m - 1, d) // medianoche local
}

export function formatFecha(iso) {
  if (!iso) return '—'
  return parseLocalDate(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatMes(iso) {
  if (!iso) return '—'
  return parseLocalDate(iso).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export function diasParaVencer(fechaFin) {
  if (!fechaFin) return null
  const fin = parseLocalDate(fechaFin)
  if (!fin) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  fin.setHours(0, 0, 0, 0)
  return Math.round((fin - hoy) / (1000 * 60 * 60 * 24))
}

export function isoHoy() {
  return new Date().toISOString().split('T')[0]
}

export function isoToDate(iso) {
  if (!iso) return ''
  return iso.split('T')[0]
}
