import { useState, useEffect } from 'react'
import { DataProvider } from './DataContext.jsx'
import { supabase } from './supabase.js'
import Login from './Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import PropiedadDetalle from './components/PropiedadDetalle.jsx'
import ImportarZip from './components/ImportarZip.jsx'
import ArchivoMedia from './components/ArchivoMedia.jsx'
import AlertasICL from './components/ActualizacionICL.jsx'
import Inquilinos from './components/Inquilinos.jsx'
import './App.css'

function AppInterna() {
  const [vista, setVista] = useState('dashboard')
  const [propiedadId, setPropiedadId] = useState(null)
  const [chatSeleccionado, setChatSeleccionado] = useState(null)

  function abrirPropiedad(id) {
    setPropiedadId(id)
    setVista('propiedad')
  }

  function volver() {
    setVista('dashboard')
    setPropiedadId(null)
  }

  return (
    <div className="app">
      {vista === 'dashboard' && (
        <Dashboard
          onAbrirPropiedad={abrirPropiedad}
          onImportar={() => setVista('importar')}
          onArchivos={chat => { setChatSeleccionado(chat || null); setVista('archivos') }}
          onInquilinos={() => setVista('inquilinos')}
        />
      )}
      {vista === 'propiedad' && (
        <PropiedadDetalle idPropiedad={propiedadId} onVolver={volver} />
      )}
      {vista === 'importar' && (
        <ImportarZip onVolver={volver} />
      )}
      {vista === 'archivos' && (
        <ArchivoMedia
          chatInicial={chatSeleccionado}
          onVolver={volver}
          onImportar={() => setVista('importar')}
        />
      )}
      {vista === 'inquilinos' && (
        <Inquilinos onVolver={volver} />
      )}
      <AlertasICL />
    </div>
  )
}

export default function App() {
  const [sesion, setSesion] = useState(undefined) // undefined = cargando, null = sin login

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Mientras verifica la sesión
  if (sesion === undefined) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
        <div style={{ fontSize: 32 }}>🏠</div>
      </div>
    )
  }

  // Sin sesión → login
  if (!sesion) return <Login />

  // Con sesión → app
  return (
    <DataProvider>
      <AppInterna />
    </DataProvider>
  )
}
