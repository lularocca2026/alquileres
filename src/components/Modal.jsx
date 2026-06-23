import { useEffect } from 'react'

export default function Modal({ titulo, onCerrar, onGuardar, children, guardarLabel = 'Guardar' }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '16px 16px 0 0',
        width: '100%',
        maxHeight: '90dvh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{titulo}</div>
          <button onClick={onCerrar} style={{ fontSize: 20, color: 'var(--text2)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          {children}
        </div>
        {onGuardar && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button className="btn btn-primary btn-full" onClick={onGuardar} style={{ padding: '14px' }}>
              {guardarLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Campo({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>{label}</label>
      {children}
    </div>
  )
}

export function Input({ value, onChange, type = 'text', placeholder }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        fontSize: 15,
        background: 'var(--bg)',
        color: 'var(--text)',
        width: '100%',
      }}
    />
  )
}

export function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        fontSize: 14,
        background: 'var(--bg)',
        color: 'var(--text)',
        width: '100%',
        resize: 'vertical',
        fontFamily: 'inherit',
      }}
    />
  )
}

export function Select({ value, onChange, options }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        fontSize: 15,
        background: 'var(--bg)',
        color: 'var(--text)',
        width: '100%',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Toggle({ value, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: value ? 'var(--accent)' : 'var(--border)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: 'white', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontSize: 14 }}>{label}</span>
    </label>
  )
}
