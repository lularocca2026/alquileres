import { useState } from 'react'
import { supabase } from './supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  async function entrar(e) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : error.message)
    }
    setCargando(false)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%', maxWidth: 360, background: 'var(--surface)',
        borderRadius: 16, padding: 28, border: '1px solid var(--border)',
        boxShadow: '0 4px 20px rgba(30,58,95,0.12)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏠</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>Alquileres</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Ingresá con tu cuenta</div>
        </div>

        <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
              style={{
                width: '100%', padding: '11px 12px', borderRadius: 8,
                border: '1px solid var(--border)', fontSize: 15, background: 'var(--bg)', color: 'var(--text)',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
              style={{
                width: '100%', padding: '11px 12px', borderRadius: 8,
                border: '1px solid var(--border)', fontSize: 15, background: 'var(--bg)', color: 'var(--text)',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--red)', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit" disabled={cargando}
            className="btn btn-primary"
            style={{ padding: 13, fontSize: 15, marginTop: 4, opacity: cargando ? 0.6 : 1 }}
          >
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
