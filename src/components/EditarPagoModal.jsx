import { useState } from 'react'
import Modal, { Campo, Input, Textarea, Toggle } from './Modal.jsx'
import { isoToDate, isoHoy } from '../utils.js'

export default function EditarPagoModal({ pago, contratoMonto, onGuardar, onCerrar, onEliminar }) {
  const esNuevo = !pago

  const [form, setForm] = useState({
    Periodo: pago?.Periodo ? isoToDate(pago.Periodo) : isoHoy(),
    FechaPago: pago?.FechaPago ? isoToDate(pago.FechaPago) : isoHoy(),
    MontoEsperado: pago?.MontoEsperado ?? contratoMonto ?? 0,
    Monto: pago?.Monto ?? 0,
    expExtraordinarias: pago?.['exp extraordinarias'] ?? 0,
    descuento: pago?.descuento ?? 0,
    descuentoDetalle: pago?.descuentoDetalle ?? '',
    Pagado: pago?.Pagado ?? true,
    observaciones: pago?.observaciones ?? '',
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function guardar() {
    onGuardar({
      ...pago,
      Periodo: form.Periodo ? new Date(form.Periodo).toISOString() : null,
      FechaPago: form.FechaPago ? new Date(form.FechaPago).toISOString() : null,
      MontoEsperado: parseFloat(form.MontoEsperado) || 0,
      Monto: parseFloat(form.Monto) || 0,
      'exp extraordinarias': parseFloat(form.expExtraordinarias) || 0,
      descuento: parseFloat(form.descuento) || 0,
      descuentoDetalle: form.descuentoDetalle,
      Pagado: form.Pagado,
      observaciones: form.observaciones,
    })
  }

  return (
    <Modal
      titulo={esNuevo ? 'Nuevo pago' : 'Editar pago'}
      onCerrar={onCerrar}
      onGuardar={guardar}
    >
      <Campo label="Período (mes de alquiler)">
        <Input type="date" value={form.Periodo} onChange={v => set('Periodo', v)} />
      </Campo>

      <Campo label="Fecha de pago">
        <Input type="date" value={form.FechaPago} onChange={v => set('FechaPago', v)} />
      </Campo>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Alquiler esperado ($)">
          <Input type="number" value={form.MontoEsperado} onChange={v => set('MontoEsperado', v)} />
        </Campo>
        <Campo label="Monto cobrado ($)">
          <Input type="number" value={form.Monto} onChange={v => set('Monto', v)} />
        </Campo>
      </div>

      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Descuentos / Deducciones</div>
        <Campo label="Expensas extraordinarias a cargo propietario ($)">
          <Input type="number" value={form.expExtraordinarias} onChange={v => set('expExtraordinarias', v)} />
        </Campo>
        <Campo label="Otros descuentos ($)">
          <Input type="number" value={form.descuento} onChange={v => set('descuento', v)} />
        </Campo>
        <Campo label="Detalle del descuento">
          <Input value={form.descuentoDetalle} onChange={v => set('descuentoDetalle', v)} placeholder="Ej: arreglo caldera descontado" />
        </Campo>
      </div>

      <Toggle value={form.Pagado} onChange={v => set('Pagado', v)} label="Cobrado" />

      <Campo label="Observaciones">
        <Textarea value={form.observaciones} onChange={v => set('observaciones', v)} placeholder="Notas adicionales..." />
      </Campo>

      {!esNuevo && onEliminar && (
        <button
          onClick={onEliminar}
          style={{ color: 'var(--red)', fontSize: 14, padding: '8px 0', textAlign: 'center' }}
        >
          Eliminar pago
        </button>
      )}
    </Modal>
  )
}
