import { useState } from 'react'
import { useData } from '../DataContext.jsx'
import Modal, { Campo, Input } from './Modal.jsx'

function FormInquilino({ inicial, titulo, onGuardar, onCerrar }) {
  const [form, setForm] = useState(inicial)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <Modal titulo={titulo} onCerrar={onCerrar} onGuardar={() => onGuardar(form)}>
      <Campo label="Nombre completo">
        <Input value={form.Apellido || ''} onChange={v => set('Apellido', v)} />
      </Campo>
      <Campo label="DNI">
        <Input type="number" value={form.DNI || ''} onChange={v => set('DNI', parseInt(v) || 0)} />
      </Campo>
      <Campo label="Celular">
        <Input value={form.Celular || ''} onChange={v => set('Celular', v)} />
      </Campo>
      <Campo label="Email">
        <Input type="email" value={form.Email || ''} onChange={v => set('Email', v)} />
      </Campo>
      <Campo label="Observaciones">
        <Input value={form.observaciones || ''} onChange={v => set('observaciones', v)} />
      </Campo>
    </Modal>
  )
}

export default function Inquilinos({ onVolver }) {
  const { inquilinos, agregarInquilino, editarInquilino } = useData()
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmarArchivar, setConfirmarArchivar] = useState(null)
  const [verArchivados, setVerArchivados] = useState(false)

  const activos = inquilinos.filter(i => !i.archivado)
  const archivados = inquilinos.filter(i => i.archivado)
  const lista = verArchivados ? archivados : activos

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="header">
        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 18 }} onClick={onVolver}>
          ←
        </button>
        <h1 style={{ flex: 1, marginLeft: 10 }}>Inquilinos</h1>
        <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setAgregando(true)}>
          + Nuevo
        </button>
      </div>

      <div className="content">
        {/* Toggle activos / archivados */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => setVerArchivados(false)}
            style={{
              flex: 1, padding: '7px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
              background: !verArchivados ? 'var(--blue1)' : 'var(--surface)',
              color: !verArchivados ? 'white' : 'var(--text2)', cursor: 'pointer',
            }}
          >
            Activos ({activos.length})
          </button>
          <button
            onClick={() => setVerArchivados(true)}
            style={{
              flex: 1, padding: '7px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
              background: verArchivados ? 'var(--blue1)' : 'var(--surface)',
              color: verArchivados ? 'white' : 'var(--text2)', cursor: 'pointer',
            }}
          >
            Archivados ({archivados.length})
          </button>
        </div>

        {lista.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', marginTop: 40, fontSize: 14 }}>
            {verArchivados ? 'No hay inquilinos archivados' : 'No hay inquilinos cargados'}
          </div>
        )}

        {lista.map(inq => (
          <div key={inq.IdInquilino} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: inq.archivado ? 'var(--text3)' : 'var(--blue1)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 16, flexShrink: 0,
              }}>
                {inq.Apellido?.charAt(0) || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: inq.archivado ? 'var(--text3)' : 'var(--text)' }}>{inq.Apellido}</div>
                {inq.Celular && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{inq.Celular}</div>}
                {inq.Email && <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inq.Email}</div>}
                {inq.DNI > 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>DNI {inq.DNI}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!inq.archivado && (
                  <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setEditando(inq)}>
                    ✏
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  style={{ padding: '5px 10px', fontSize: 12, color: inq.archivado ? 'var(--blue1)' : 'var(--text3)' }}
                  onClick={() => setConfirmarArchivar(inq)}
                  title={inq.archivado ? 'Restaurar' : 'Archivar'}
                >
                  {inq.archivado ? '↩' : '🗄'}
                </button>
              </div>
            </div>

            {/* Confirmación inline */}
            {confirmarArchivar?.IdInquilino === inq.IdInquilino && (
              <div style={{ marginTop: 12, background: inq.archivado ? '#dbeafe' : '#fee2e2', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
                  {inq.archivado ? '¿Restaurar este inquilino?' : '¿Archivar este inquilino?'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '7px' }} onClick={() => setConfirmarArchivar(null)}>
                    Cancelar
                  </button>
                  <button
                    className="btn"
                    style={{ flex: 1, padding: '7px', background: inq.archivado ? 'var(--blue1)' : 'var(--red)', color: 'white' }}
                    onClick={() => {
                      editarInquilino(inq.IdInquilino, { archivado: !inq.archivado })
                      setConfirmarArchivar(null)
                    }}
                  >
                    {inq.archivado ? 'Restaurar' : 'Archivar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {agregando && (
        <FormInquilino
          titulo="Nuevo inquilino"
          inicial={{ Apellido: '', DNI: 0, Celular: '', Email: '', observaciones: '' }}
          onCerrar={() => setAgregando(false)}
          onGuardar={datos => { agregarInquilino(datos); setAgregando(false) }}
        />
      )}

      {editando && (
        <FormInquilino
          titulo="Editar inquilino"
          inicial={{ ...editando }}
          onCerrar={() => setEditando(null)}
          onGuardar={datos => { editarInquilino(editando.IdInquilino, datos); setEditando(null) }}
        />
      )}
    </div>
  )
}
