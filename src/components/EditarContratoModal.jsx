import { useState } from 'react'
import Modal, { Campo, Input, Textarea, Select, Toggle } from './Modal.jsx'
import { isoToDate } from '../utils.js'

export default function EditarContratoModal({ contrato, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    FechaInicio: isoToDate(contrato.FechaInicio),
    FechaFin: isoToDate(contrato.FechaFin),
    MontoInicial: contrato.MontoInicial ?? 0,
    MontoAnterior: contrato.MontoAnterior ?? 0,
    TipoAjuste: contrato.TipoAjuste ?? '',
    depositoMoneda: contrato.depositoMoneda ?? 'ARS',
    Deposito: contrato.Deposito ?? 0,
    notas: contrato.notas ?? '',
    activo: contrato.activo ?? true,
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function guardar() {
    onGuardar({
      ...contrato,
      FechaInicio: form.FechaInicio ? new Date(form.FechaInicio).toISOString() : null,
      FechaFin: form.FechaFin ? new Date(form.FechaFin).toISOString() : null,
      MontoInicial: parseFloat(form.MontoInicial) || 0,
      MontoAnterior: parseFloat(form.MontoAnterior) || 0,
      TipoAjuste: form.TipoAjuste,
      depositoMoneda: form.depositoMoneda,
      Deposito: parseFloat(form.Deposito) || 0,
      notas: form.notas,
      activo: form.activo,
    })
  }

  return (
    <Modal titulo="Editar contrato" onCerrar={onCerrar} onGuardar={guardar}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Inicio">
          <Input type="date" value={form.FechaInicio} onChange={v => set('FechaInicio', v)} />
        </Campo>
        <Campo label="Vencimiento">
          <Input type="date" value={form.FechaFin} onChange={v => set('FechaFin', v)} />
        </Campo>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Monto actual ($)">
          <Input type="number" value={form.MontoInicial} onChange={v => set('MontoInicial', v)} />
        </Campo>
        <Campo label="Monto anterior ($)">
          <Input type="number" value={form.MontoAnterior} onChange={v => set('MontoAnterior', v)} />
        </Campo>
      </div>

      <Campo label="Tipo de ajuste">
        <Input value={form.TipoAjuste} onChange={v => set('TipoAjuste', v)} placeholder="Ej: ICL trimestral" />
      </Campo>

      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Depósito en garantía</div>
        <Campo label="Moneda">
          <div style={{ display: 'flex', gap: 8 }}>
            {['ARS', 'USD'].map(m => (
              <button
                key={m}
                onClick={() => set('depositoMoneda', m)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  border: `2px solid ${form.depositoMoneda === m ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.depositoMoneda === m ? '#dbeafe' : 'var(--surface)',
                  color: form.depositoMoneda === m ? 'var(--accent)' : 'var(--text2)',
                }}
              >
                {m === 'ARS' ? '$ ARS' : 'U$D'}
              </button>
            ))}
          </div>
        </Campo>
        <Campo label={`Monto (${form.depositoMoneda})`}>
          <Input type="number" value={form.Deposito} onChange={v => set('Deposito', v)} />
        </Campo>
      </div>

      <Toggle value={form.activo} onChange={v => set('activo', v)} label="Contrato activo" />

      <Campo label="Notas">
        <Textarea value={form.notas} onChange={v => set('notas', v)} placeholder="Observaciones del contrato..." />
      </Campo>
    </Modal>
  )
}
