import { useState } from 'react'
import Modal, { Campo, Input, Textarea } from './Modal.jsx'
import { isoHoy } from '../utils.js'

export default function NuevoContratoModal({ idPropiedad, inquilinos, onGuardar, onCerrar, onAgregarInquilino }) {
  const [form, setForm] = useState({
    IdInquilino: '',
    FechaInicio: isoHoy(),
    FechaFin: '',
    MontoInicial: '',
    TipoAjuste: '',
    depositoMoneda: 'ARS',
    Deposito: '',
    notas: '',
  })
  const [mostrarNuevoInq, setMostrarNuevoInq] = useState(false)
  const [nuevoInq, setNuevoInq] = useState({ Apellido: '', Celular: '' })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function guardarNuevoInq() {
    if (!nuevoInq.Apellido.trim()) return
    const nuevoId = Math.max(...inquilinos.map(i => i.IdInquilino), 0) + 1
    onAgregarInquilino({ Apellido: nuevoInq.Apellido, Celular: nuevoInq.Celular, DNI: 0, Email: '', observaciones: '' })
    set('IdInquilino', nuevoId)
    setNuevoInq({ Apellido: '', Celular: '' })
    setMostrarNuevoInq(false)
  }

  function guardar() {
    onGuardar({
      IdPropiedad: idPropiedad,
      IdInquilino: parseInt(form.IdInquilino),
      FechaInicio: form.FechaInicio ? new Date(form.FechaInicio).toISOString() : null,
      FechaFin: form.FechaFin ? new Date(form.FechaFin).toISOString() : null,
      MontoInicial: parseFloat(form.MontoInicial) || 0,
      MontoAnterior: 0,
      TipoAjuste: form.TipoAjuste,
      depositoMoneda: form.depositoMoneda,
      Deposito: parseFloat(form.Deposito) || 0,
      notas: form.notas,
      activo: true,
      archivado: false,
    })
  }

  return (
    <Modal titulo="Nuevo contrato" onCerrar={onCerrar} onGuardar={guardar} guardarLabel="Crear contrato">
      <Campo label="Inquilino">
        <select
          value={form.IdInquilino}
          onChange={e => set('IdInquilino', e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 15, background: 'var(--bg)', color: 'var(--text)', width: '100%' }}
        >
          <option value="">— Seleccionar —</option>
          {inquilinos.map(i => (
            <option key={i.IdInquilino} value={i.IdInquilino}>{i.Apellido}</option>
          ))}
        </select>

        {!mostrarNuevoInq && onAgregarInquilino && (
          <button
            onClick={() => setMostrarNuevoInq(true)}
            style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            + Agregar nuevo inquilino
          </button>
        )}

        {mostrarNuevoInq && (
          <div style={{ marginTop: 10, background: 'var(--bg)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Nuevo inquilino</div>
            <Input placeholder="Nombre completo *" value={nuevoInq.Apellido} onChange={v => setNuevoInq(n => ({ ...n, Apellido: v }))} />
            <Input placeholder="Celular" value={nuevoInq.Celular} onChange={v => setNuevoInq(n => ({ ...n, Celular: v }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: 13 }}
                onClick={() => { setMostrarNuevoInq(false); setNuevoInq({ Apellido: '', Celular: '' }) }}>
                Cancelar
              </button>
              <button className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: 13 }}
                onClick={guardarNuevoInq} disabled={!nuevoInq.Apellido.trim()}>
                Agregar
              </button>
            </div>
          </div>
        )}
      </Campo>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Inicio">
          <Input type="date" value={form.FechaInicio} onChange={v => set('FechaInicio', v)} />
        </Campo>
        <Campo label="Vencimiento">
          <Input type="date" value={form.FechaFin} onChange={v => set('FechaFin', v)} />
        </Campo>
      </div>

      <Campo label="Monto mensual ($)">
        <Input type="number" value={form.MontoInicial} onChange={v => set('MontoInicial', v)} placeholder="0" />
      </Campo>

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
          <Input type="number" value={form.Deposito} onChange={v => set('Deposito', v)} placeholder="0" />
        </Campo>
      </div>

      <Campo label="Notas">
        <Textarea value={form.notas} onChange={v => set('notas', v)} placeholder="Observaciones, condiciones especiales..." />
      </Campo>
    </Modal>
  )
}
