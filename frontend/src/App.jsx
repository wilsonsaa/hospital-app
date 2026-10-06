import { useState, useEffect } from 'react'
import { db } from './db'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Componentes Base
import Login from './components/Login'
import DashboardPromotor from './components/DashboardPromotor'
import DashboardGestor from './components/DashboardGestor'
import PerfilPaciente from './components/PerfilPaciente' // (Excel 360°)

// Componentes Existentes y Formularios
import FormularioPromotor from './components/FormularioPromotor'
import DashboardMedico from './components/DashboardMedico' // Tablero universal de tareas
import FormularioMedico from './components/FormularioMedico'
import FormularioPsicosocial from './components/FormularioPsicosocial'
import FormularioGestor from './components/FormularioGestor'
import DashboardCoordinador from './components/DashboardCoordinador'
import FormularioEnfermeria from './components/FormularioEnfermeria'
import FormularioNutricion from './components/FormularioNutricion'
import FormularioFisioterapia from './components/FormularioFisioterapia'

import './App.css'

function App() {
  // Estado global de la sesión
  const [sesion, setSesion] = useState(null)

  // Manejo de navegación interna
  const [vista, setVista] = useState('MAIN')
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)

  // Estados del motor Offline/Sincronización
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState('');
  const [ultimaSinc, setUltimaSinc] = useState(localStorage.getItem('ultima_sinc') || 'Nunca');
  const [eventoInstalacion, setEventoInstalacion] = useState(null);

  // Registro de Service Worker (PWA)
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) { console.log('SW Registrado'); },
    onRegisterError(error) { console.error('Error SW', error); }
  });

  const verificarYActualizarApp = async () => {
    const registrosLocales = await db.pacientes.filter(p => p.sincronizado === 0).count();
    if (registrosLocales > 0) {
      alert("⚠️ ALERTA DE SEGURIDAD:\nTienes datos recolectados sin subir al servidor. Por favor, asegúrate de tener internet y presiona el botón 'Sincronizar' (🔄) antes de actualizar.");
    } else {
      if (window.confirm("La aplicación se actualizará para instalar las nuevas funciones. ¿Continuar?")) {
        await updateServiceWorker(true);
        // Le damos 1.5 segundos al Service Worker para limpiar la caché antes de forzar el reinicio
        setTimeout(() => {
          window.location.reload(true);
        }, 1500);
      }
    }
  };

  // 1️⃣ Al cargar la app, revisamos si ya había alguien logueado (modo offline)
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('sesionActual');
    if (sesionGuardada) {
      setSesion(JSON.parse(sesionGuardada));
    }
  }, []);

  // 🔪 Corta un arreglo grande en lotes para no saturar memoria RAM ni el servidor
  const dividirEnLotes = (arreglo, tamañoLote) => {
    const lotes = [];
    for (let i = 0; i < arreglo.length; i += tamañoLote) {
      lotes.push(arreglo.slice(i, i + tamañoLote));
    }
    return lotes;
  };

  // Tabla Dexie -> nombre de su columna de llave primaria (para marcar solo el lote ya subido)
  const LLAVE_PRIMARIA = {
    hogares: 'id',
    pacientes: 'numero_documento',
    canalizaciones: 'id',
    form_clinico: 'id_atencion',
    form_psicosocial: 'id_intervencion',
    cartografias: 'id',
    jornadas: 'id',
    profesionales: 'documento',
  };

  const TAMAÑO_LOTE = 150;
  // 📉 250 es el número mágico para no asfixiar la RAM de una tablet
  const TAMAÑO_PAGINA_DESCARGA = 250;

  // 🚀 MOTOR DE DESCARGA PAGINADA (VERSIÓN ULTRA-LIGERA ANTI OUT-OF-MEMORY)
  // Baja una tabla en páginas pequeñas en lugar de un solo JSON gigante,
  // guardando cada página en Dexie antes de pedir la siguiente (libera RAM entre páginas).
  const descargarTablaPaginada = async (tabla) => {
    let offset = 0;
    let hayMasDatos = true;

    while (hayMasDatos) {
      setMensajeSync(`Descargando ${tabla}... (${offset} registros)`);

      const res = await fetch(`/api/registros?tabla=${tabla}&limit=${TAMAÑO_PAGINA_DESCARGA}&offset=${offset}`);
      if (!res.ok) throw new Error(`Fallo de red descargando ${tabla}`);

      const resultado = await res.json();
      if (resultado.status !== 'ok') throw new Error(resultado.detalle || `Error del servidor en ${tabla}`);

      let pagina = resultado.data[tabla] || [];
      if (pagina.length > 0) {
        await db[tabla].bulkPut(pagina.map(d => ({ ...d, sincronizado: 1 })));
      }

      const cantidadRecibida = pagina.length;

      // 🧹 Rompemos la referencia explícitamente para que la RAM se libere al instante
      pagina = null;

      if (cantidadRecibida < TAMAÑO_PAGINA_DESCARGA) {
        hayMasDatos = false; // última página (o tabla vacía)
      } else {
        offset += TAMAÑO_PAGINA_DESCARGA;
        // 🛡️ Flush a disco: pausamos 50ms para darle tiempo a Dexie/IndexedDB
        // de vaciar la cola de escritura antes de pedir la siguiente página
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  };

  // 🚀 EL MOTOR DE SINCRONIZACIÓN BIDIRECCIONAL (PUSH & PULL), por lotes/páginas
  const ejecutarSincronizacion = async () => {
    if (!navigator.onLine) return;
    setSincronizando(true);
    setMensajeSync('Iniciando sincronización...');

    try {
      // === FASE 1: PUSH por lotes (evita payloads gigantes en una sola petición) ===
      let totalSubir = 0;

      for (const [tabla, llave] of Object.entries(LLAVE_PRIMARIA)) {
        const filtro = tabla === 'profesionales'
          ? (r => r.sincronizado === 0 || r.sincronizado === undefined)
          : (r => r.sincronizado === 0);

        const pendientes = await db[tabla].filter(filtro).toArray();
        if (pendientes.length === 0) continue;

        totalSubir += pendientes.length;
        const lotes = dividirEnLotes(pendientes, TAMAÑO_LOTE);

        for (let i = 0; i < lotes.length; i++) {
          const lote = lotes[i];
          setMensajeSync(`Subiendo ${tabla}... (lote ${i + 1}/${lotes.length})`);

          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [tabla]: lote })
          });
          const result = await response.json();

          if (result.status === 'ok') {
            const idsLote = lote.map(r => r[llave]);
            await db[tabla].where(llave).anyOf(idsLote).modify({ sincronizado: 1 });
          } else {
            console.warn(`El servidor falló subiendo un lote de "${tabla}".`, result.detalle);
          }
        }
      }

      // === FASE 2: PULL tabla por tabla, paginado (libera memoria RAM entre páginas y tablas) ===
      for (const tabla of Object.keys(LLAVE_PRIMARIA)) {
        await descargarTablaPaginada(tabla);
      }

      const hora = new Date().toLocaleTimeString();
      setUltimaSinc(hora); localStorage.setItem('ultima_sinc', hora);
      setMensajeSync('✅ Base de datos actualizada con éxito');
      alert(`✅ Sincronización Completa.\nSubidos: ${totalSubir} registros nuevos.\nSe ha descargado toda la información actualizada del sector.`);

    } catch (error) {
      console.error("Error sync:", error);
      setMensajeSync('❌ Error de conexión al sincronizar');
      alert("❌ Error de red durante la sincronización.");
    } finally {
      setSincronizando(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); };
    const handleOffline = () => setIsOnline(false);
    const capturarInstalacion = (e) => { e.preventDefault(); setEventoInstalacion(e); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', capturarInstalacion);

    if (navigator.onLine && sesion) ejecutarSincronizacion();

    return () => {
      window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); window.removeEventListener('beforeinstallprompt', capturarInstalacion);
    };
  }, [sesion]);

  const instalarApp = async () => {
    if (!eventoInstalacion) return;
    eventoInstalacion.prompt();
    const { outcome } = await eventoInstalacion.userChoice;
    if (outcome === 'accepted') setEventoInstalacion(null);
  };

  const handleLoginSuccess = (datosSesion) => {
    setSesion(datosSesion);
  };

  const cerrarSesion = () => {
    if (window.confirm("¿Cerrar sesión?")) {
      localStorage.removeItem('sesionActual');
      setSesion(null);
      setVista('MAIN');
      setTareaSeleccionada(null);
    }
  }

  // Ruteo de formularios clínicos
  const manejarAbrirHistoria = (tarea) => {
    setTareaSeleccionada(tarea);
    switch (tarea.rol_destino) {
      case 'medico': setVista('FORM_MEDICO'); break;
      case 'psicologia':
      case 'psicosocial': setVista('FORM_PSICOSOCIAL'); break;
      case 'gestor': setVista('FORM_GESTOR'); break;
      case 'jefe_enfermeria': setVista('FORM_ENFERMERIA'); break;
      case 'nutricionista': setVista('FORM_NUTRICION'); break;
      case 'fisioterapeuta': setVista('FORM_FISIOTERAPIA'); break;
      default:
        alert(`Rol no reconocido: ${tarea.rol_destino}`);
        setTareaSeleccionada(null); setVista('MAIN');
    }
  };

  if (!sesion) {
    return (
      <>
        <style>{`:root { color-scheme: light !important; background-color: #f8fafc; color: #334155; }`}</style>
        <div className="container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <Login
            onLoginSuccess={handleLoginSuccess}
            ejecutarSincronizacion={ejecutarSincronizacion}
            sincronizando={sincronizando}
            isOnline={isOnline}
            ultimaSinc={ultimaSinc}
          />
        </div>
      </>
    )
  }

  const rolesClinicos = ['medico', 'psicologia', 'psicosocial', 'jefe_enfermeria', 'nutricionista', 'fisioterapeuta'];

  return (
    <>
      <style>{`
            :root { color-scheme: light !important; background-color: #f8fafc; color: #1e293b; }
            body { background-color: #f8fafc; color: #1e293b; }
            .card { background-color: #ffffff; color: #334155; }
        `}</style>

      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '50px' }}>

        <header style={{
          backgroundColor: 'var(--inst-blue, #1e3a8a)', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flexWrap: 'wrap', gap: '10px'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.2rem' }}>🏥 Hospital APS Mosquera</h1>
            <div style={{ fontSize: '0.85rem', color: '#bae6fd', marginTop: '4px' }}>
              👤 {sesion.nombre.toUpperCase()} ({sesion.rol.toUpperCase()}) | 📍 {sesion.territorio} ➡️ {sesion.microterritorio}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {eventoInstalacion && <button onClick={instalarApp} style={{ backgroundColor: '#fbbf24', color: '#92400e', border: 'none', borderRadius: '20px', padding: '5px 15px', cursor: 'pointer', fontWeight: 'bold' }}>📲 Instalar App</button>}

            {/* INTERFAZ LIMPIA: Solo mostramos estado de red y sincronización */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
              <span title={isOnline ? "Conectado a Internet" : "Trabajando Offline (Sin Internet)"}>{isOnline ? '🟢' : '🔴'}</span>
              <span style={{ fontSize: '0.8rem' }}>{sincronizando && mensajeSync ? mensajeSync : `Sinc: ${ultimaSinc}`}</span>
              <button onClick={ejecutarSincronizacion} disabled={!isOnline || sincronizando} style={{ background: 'none', border: 'none', cursor: (!isOnline || sincronizando) ? 'not-allowed' : 'pointer', fontSize: '1.2rem', padding: 0, opacity: (!isOnline || sincronizando) ? 0.5 : 1 }}>
                {sincronizando ? '⏳' : '🔄'}
              </button>
            </div>

            <button onClick={cerrarSesion} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Cerrar Sesión 🚪
            </button>
          </div>
        </header>

        <main className="container" style={{ paddingTop: '20px' }}>
          {vista === 'MAIN' && (
            <>
              {/* 🟢 TABLERO EXCLUSIVO DEL PROMOTOR */}
              {sesion.rol === 'promotor' && (
                <DashboardPromotor usuarioActual={sesion} onNuevaFicha={() => setVista('FORM_PROMOTOR')} />
              )}

              {/* 🤝 TABLERO EXCLUSIVO DEL GESTOR COMUNITARIO */}
              {sesion.rol === 'gestor' && (
                <DashboardGestor usuarioActual={sesion} onNuevaCartografia={() => setVista('FORM_GESTOR')} />
              )}

              {/* 🔵 TABLERO CLÍNICO UNIVERSAL (Para médicos, psicólogos, nutricionistas, etc.) */}
              {rolesClinicos.includes(sesion.rol) && (
                <div className="p-6">
                  <div style={{ textAlign: 'center', marginBottom: '20px', color: '#64748b' }}>
                    <h2>Bienvenido, {sesion.nombre}</h2>
                    <p>Módulo clínico de atención puntual.</p>
                  </div>
                  {/* Panel universal de atenciones/canalizaciones pendientes */}
                  <DashboardMedico usuarioActual={sesion} onAbrirHistoria={manejarAbrirHistoria} />
                </div>
              )}

              {/* 🚀 EL GENERADOR DE REPORTES 360 PARA TODOS LOS ROLES OPERATIVOS (Incluido Gestor) */}
              {(sesion.rol === 'promotor' || sesion.rol === 'gestor' || rolesClinicos.includes(sesion.rol)) && (
                <div className="p-6">
                  <hr style={{ margin: '30px 0', borderColor: '#e2e8f0' }} />
                  <h3 style={{ color: 'var(--inst-blue)', marginBottom: '15px' }}>🔍 Explorador Integral de Pacientes</h3>
                  <PerfilPaciente usuarioActual={sesion} />
                </div>
              )}

              {/* 👑 PANEL EXCLUSIVO DEL COORDINADOR */}
              {sesion.rol === 'soporte' && (
                <div className="p-6">
                  <h2 style={{ textAlign: 'center', color: 'var(--inst-blue)' }}>👑 Panel General de Coordinación</h2>
                  <DashboardCoordinador onAbrirHistoria={manejarAbrirHistoria} />
                  <hr style={{ margin: '30px 0', borderColor: '#e2e8f0' }} />
                  <PerfilPaciente usuarioActual={sesion} />
                </div>
              )}

              {/* OTROS ROLES (Si creaste más y no los hemos mapeado aún) */}
              {!['promotor', 'soporte', 'gestor', ...rolesClinicos].includes(sesion.rol) && (
                <div style={{ textAlign: 'center', marginTop: '50px', color: '#1e293b' }}>
                  <h2>Bienvenido, {sesion.nombre}</h2>
                  <p>Tu módulo ({sesion.rol}) está conectado y listo para ensamblarse.</p>
                </div>
              )}
            </>
          )}

          {/* VISTAS DE FORMULARIOS AL DAR CLIC EN ABRIR HISTORIA O NUEVA FICHA */}
          {vista === 'FORM_PROMOTOR' && <FormularioPromotor usuario={sesion} volver={() => setVista('MAIN')} />}
          {vista === 'FORM_GESTOR' && <FormularioGestor usuario={sesion} volver={() => setVista('MAIN')} />}

          {vista === 'FORM_MEDICO' && tareaSeleccionada && <FormularioMedico usuario={sesion} tarea={tareaSeleccionada} volver={() => { setTareaSeleccionada(null); setVista('MAIN'); }} />}
          {vista === 'FORM_PSICOSOCIAL' && tareaSeleccionada && <FormularioPsicosocial usuario={sesion} tarea={tareaSeleccionada} volver={() => { setTareaSeleccionada(null); setVista('MAIN'); }} />}
          {vista === 'FORM_ENFERMERIA' && tareaSeleccionada && <FormularioEnfermeria usuario={sesion} tarea={tareaSeleccionada} volver={() => { setTareaSeleccionada(null); setVista('MAIN'); }} />}
          {vista === 'FORM_NUTRICION' && tareaSeleccionada && <FormularioNutricion usuario={sesion} tarea={tareaSeleccionada} volver={() => { setTareaSeleccionada(null); setVista('MAIN'); }} />}
          {vista === 'FORM_FISIOTERAPIA' && tareaSeleccionada && <FormularioFisioterapia usuario={sesion} tarea={tareaSeleccionada} volver={() => { setTareaSeleccionada(null); setVista('MAIN'); }} />}
        </main>
      </div>
    </>
  );
}

export default App;