import { useState } from 'react'
import Modal, { Campo, Input, Textarea } from './Modal.jsx'
import { isoToDate, isoHoy } from '../utils.js'

export default function EditarMantModal({ item, idPropiedad, onGuardar, onCerrar, onEliminar }) {
  const esNuevo = !item

  const [form, setForm] = useState({
    Fecha: item?.Fecha ? isoToDate(item.Fecha) : isoHoy(),
    Descripcion: item?.Descripcion ?? '',
    Costo: item?.Costo ?? 0,
    Observacion: item?.Observacion ?? '',
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function guardar() {
    onGuardar({
      ...(item ?? {}),
      IdPropiedad: idPropiedad,
      Fecha: form.Fecha ? new Date(form.Fecha).toISOString() : null,
      Descripcion: form.Descripcion,
      Costo: parseFloat(form.Costo) || 0,
      Observacion: form.Observacion,
    })
  }

  return (
    <Modal
      titulo={esNuevo ? 'Nuevo mantenimiento' : 'Editar mantenimiento'}
      onCerrar={onCerrar}
      onGuardar={guardar}
    >
      <Campo label="Fecha">
        <Input type="date" value={form.Fecha} onChange={v => set('Fecha', v)} />
      </Campo>
      <Campo label="Descripción">
        <Input value={form.Descripcion} onChange={v => set('Descripcion', v)} placeholder="Ej: Cambio calefón" />
      </Campo>
      <Campo label="Costo ($)">
        <Input type="number" value={form.Costo} onChange={v => set('Costo', v)} />
      </Campo>
      <Campo label="Observaciones">
        <Textarea value={form.Observacion} onChange={v => set('Observacion', v)} placeholder="Quién pagó, proveedor, estado..." />
      </Campo>
      {!esNuevo && onEliminar && (
        <button onClick={onEliminar} style={{ color: 'var(--red)', fontSize: 14, padding: '8px 0', textAlign: 'center' }}>
          Eliminar registro
        </button>
      )}
    </Modal>
  )
}
