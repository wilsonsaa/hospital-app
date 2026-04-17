import { useState, useEffect } from 'react'
import { db } from './db'
import { useRegisterSW } from 'virtual:pwa-register/react' // <-- IMPORT PARA PWA
import Login from './components/Login'
import FormularioPromotor from './components/FormularioPromotor'
import DashboardMedico from './components/DashboardMedico'
import FormularioMedico from './components/FormularioMedico'
import FormularioPsicosocial from './components/FormularioPsicosocial'
import DashboardCoordinador from './components/DashboardCoordinador'
import FormularioGestor from './components/FormularioGestor'
import './App.css'

function App() {
  const [usuarioActual, setUsuarioActual] = useState(null)
  const [vista, setVista] = useState('MAIN')
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)

  // Estados para la sincronización
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSinc, setUltimaSinc] = useState(localStorage.getItem('ultima_sinc') || 'Nunca');

  // Estado para guardar el evento de instalación de la App
  const [eventoInstalacion, setEventoInstalacion] = useState(null);

  // 🔒 EL CANDADO DE ACTUALIZACIÓN (Regla de Oro 2)
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) { console.log('SW Registrado'); },
    onRegisterError(error) { console.error('Error SW', error); }
  });

  // 🛠️ REPARACIÓN DEL BOTÓN DE ACTUALIZAR
  const verificarYActualizarApp = async () => {
    // Contamos si hay algún dato en las tablas (excepto profesionales y parámetros)
    const registrosLocales = (await db.hogares.count()) + (await db.pacientes.count()) + (await db.canalizaciones.count());

    if (registrosLocales > 0) {
      alert("⚠️ ALERTA DE SEGURIDAD:\nTienes datos recolectados sin subir al servidor. Por favor, asegúrate de tener internet, presiona el botón 'Sincronizar' (🔄) y vacía tu bandeja antes de instalar la actualización.");
    } else {
      if (window.confirm("La bandeja está limpia. La aplicación se reiniciará para instalar las nuevas funciones. ¿Continuar?")) {
        await updateServiceWorker(true); // Espera a que el worker se actualice
        window.location.reload(); // 🚀 FORZA LA RECARGA DE LA PANTALLA
      }
    }
  };

  // Recuperar sesión
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('sesionActual');
    if (sesionGuardada) setUsuarioActual(JSON.parse(sesionGuardada));
  }, [])

  // ========================================================
  // 🗑️ EL MOTOR DE SINCRONIZACIÓN Y BORRADO LOCAL (Regla de Oro 1)
  // ========================================================
  const ejecutarSincronizacion = async () => {
    if (!navigator.onLine) return; // Si no hay internet, abortamos
    setSincronizando(true);

    try {
      const payload = {
        viviendas: await db.viviendas.toArray(),
        hogares: await db.hogares.toArray(),
        pacientes: await db.pacientes.toArray(),
        canalizaciones: await db.canalizaciones.toArray(),
        form_clinico: await db.form_clinico.toArray(),
        form_psicosocial: await db.form_psicosocial.toArray(),
        cartografias: await db.cartografias.toArray()
      };

      const totalRegistros = Object.values(payload).reduce((acc, array) => acc + array.length, 0);

      if (totalRegistros > 0) {
        const response = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();

        if (result.status === 'ok') {
          // 🛑 REGLA 1 APLICADA: Si Python nos dice que guardó todo, BORRAMOS localmente las tablas (excepto 'profesionales')
          await db.viviendas.clear();
          await db.hogares.clear();
          await db.pacientes.clear();
          await db.canalizaciones.clear();
          await db.form_clinico.clear();
          await db.form_psicosocial.clear();
          await db.cartografias.clear();

          const hora = new Date().toLocaleTimeString();
          setUltimaSinc(hora); localStorage.setItem('ultima_sinc', hora);
          alert(`✅ Sincronización exitosa. Se subieron y limpiaron ${totalRegistros} registros del dispositivo.`);
        } else {
          alert("❌ El servidor falló. Los datos seguirán guardados en la tablet para intentarlo luego.");
        }
      } else {
        console.log("No hay datos nuevos para sincronizar.");
      }
    } catch (error) {
      console.error("Error sync:", error);
    } finally {
      setSincronizando(false);
    }
  };

  // Escuchadores de conexión a Internet e Instalación PWA
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); ejecutarSincronizacion(); }; // Auto-sync al volver el internet
    const handleOffline = () => setIsOnline(false);

    // Escuchar si el navegador permite instalar la app
    const capturarInstalacion = (e) => {
      e.preventDefault();
      setEventoInstalacion(e); // Guardamos el evento para usarlo en el botón
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', capturarInstalacion); // <-- Escuchador PWA

    // Intentar sincronizar al arrancar la app por primera vez si hay internet
    if (navigator.onLine && usuarioActual) {
      ejecutarSincronizacion();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', capturarInstalacion);
    };
  }, [usuarioActual]); // Se ejecuta cuando el usuario se loguea

  // Función que se ejecuta al darle clic al botón de instalar
  const instalarApp = async () => {
    if (!eventoInstalacion) return;
    eventoInstalacion.prompt(); // Muestra el mensaje nativo de Android/Chrome
    const { outcome } = await eventoInstalacion.userChoice;
    if (outcome === 'accepted') {
      console.log('App Salud-Mosquera instalada con éxito');
      setEventoInstalacion(null); // Ocultamos el botón
    }
  };

  const cerrarSesion = () => {
    if (window.confirm("¿Cerrar sesión?")) {
      localStorage.removeItem('sesionActual');
      setUsuarioActual(null);
      setVista('MAIN');
      setTareaSeleccionada(null);
    }
  }

  if (!usuarioActual) {
    return (
      <div className="container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <Login onLoginSuccess={(sesion) => setUsuarioActual(sesion)} />
      </div>
    )
  }

  const HeaderInstitucional = () => (
    <>
      {/* 🛠️ CAMBIO AL LOGO DEL HOSPITAL */}
      <div className="header-institucional">
        <div className="logos-container">
          <img src="/logo-hospital.png" alt="Hospital" className="logo" style={{ width: '120px' }} />
        </div>
        <h1 className="title-hospital">Hospital María Auxiliadora</h1>
        <h2 className="subtitle-alcaldia">Sistema APS - Mosquera</h2>
      </div>

      {/* BARRA SUPERIOR DE ESTADO Y SINCRONIZACIÓN (Responsive) */}
      <div style={{ backgroundColor: 'var(--inst-blue)', color: 'white', padding: '10px 15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <span style={{ fontWeight: 'bold', marginRight: '15px' }}>👤 {usuarioActual.nombre.toUpperCase()} ({usuarioActual.rol.toUpperCase()})</span>
          <br className="mobile-break" />
          <span style={{ color: '#bae6fd' }}>📍 {usuarioActual.territorio} ➡️ {usuarioActual.microterritorio}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>

          {/* BOTÓN DE INSTALACIÓN (Solo aparece si no está instalada) */}
          {eventoInstalacion && (
            <button onClick={instalarApp} style={{ backgroundColor: '#fbbf24', color: '#92400e', border: 'none', borderRadius: '20px', padding: '5px 15px', cursor: 'pointer', fontWeight: 'bold' }}>
              📲 Instalar App
            </button>
          )}

          {/* 🚨 BOTÓN NUEVO: AVISO DE ACTUALIZACIÓN DEL SISTEMA */}
          {needRefresh && (
            <button onClick={verificarYActualizarApp} style={{ backgroundColor: '#ef4444', color: 'white', border: '2px solid white', borderRadius: '20px', padding: '5px 15px', cursor: 'pointer', fontWeight: 'bold' }}>
              ⚠️ Actualizar
            </button>
          )}

          {/* INDICADOR Y BOTÓN DE SINCRONIZACIÓN */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
            <span title={isOnline ? "Conectado a Internet" : "Trabajando Offline (Sin Internet)"}>
              {isOnline ? '🟢' : '🔴'}
            </span>
            <span style={{ fontSize: '0.8rem' }}>Sinc: {ultimaSinc}</span>
            <button
              onClick={ejecutarSincronizacion}
              disabled={!isOnline || sincronizando}
              style={{ background: 'none', border: 'none', cursor: (!isOnline || sincronizando) ? 'not-allowed' : 'pointer', fontSize: '1.2rem', padding: 0, opacity: (!isOnline || sincronizando) ? 0.5 : 1 }}
              title="Sincronizar Manualmente"
            >
              {sincronizando ? '⏳' : '🔄'}
            </button>
          </div>

          <button onClick={cerrarSesion} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}>
            🚪 Salir
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="container">
      <HeaderInstitucional />

      {vista === 'MAIN' && (
        <>
          {usuarioActual.rol === 'promotor' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <button onClick={() => setVista('FORM_PROMOTOR')} className="btn-save">
                🗺️ Iniciar Caracterización
              </button>
            </div>
          )}

          {usuarioActual.rol === 'gestor' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <button onClick={() => setVista('FORM_GESTOR')} className="btn-save" style={{ backgroundColor: 'var(--inst-blue)' }}>
                📍 Realizar Cartografía
              </button>
            </div>
          )}

          {(usuarioActual.rol === 'medico' || usuarioActual.rol === 'psicosocial') && (
            <DashboardMedico
              usuario={usuarioActual}
              onAbrirHistoria={(tarea) => {
                setTareaSeleccionada(tarea);
                setVista(usuarioActual.rol === 'medico' ? 'FORM_MEDICO' : 'FORM_PSICOSOCIAL');
              }}
            />
          )}

          {usuarioActual.rol === 'soporte' && (
            <DashboardCoordinador />
          )}
        </>
      )}

      {vista === 'FORM_PROMOTOR' && (
        <FormularioPromotor usuario={usuarioActual} volver={() => setVista('MAIN')} />
      )}

      {vista === 'FORM_GESTOR' && (
        <FormularioGestor usuario={usuarioActual} volver={() => setVista('MAIN')} />
      )}

      {vista === 'FORM_MEDICO' && tareaSeleccionada && (
        <FormularioMedico
          usuario={usuarioActual}
          tarea={tareaSeleccionada}
          volver={() => {
            setTareaSeleccionada(null);
            setVista('MAIN');
          }}
        />
      )}

      {vista === 'FORM_PSICOSOCIAL' && tareaSeleccionada && (
        <FormularioPsicosocial
          usuario={usuarioActual}
          tarea={tareaSeleccionada}
          volver={() => {
            setTareaSeleccionada(null);
            setVista('MAIN');
          }}
        />
      )}
    </div>
  )
}

export default App