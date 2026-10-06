import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { territoriosData } from '../territoriosData';
import MapaTerritorio from './MapaTerritorio';

// 1. Asegúrate de recibir las nuevas funciones de sincronización aquí arriba
export default function Login({ onLoginSuccess, ejecutarSincronizacion, sincronizando, isOnline, ultimaSinc }) {
    const [paso, setPaso] = useState(0);
    const [claveEntrada, setClaveEntrada] = useState('');
    const [doc, setDoc] = useState('');
    const [esNuevo, setEsNuevo] = useState(false);

    const [datosProf, setDatosProf] = useState({ nombre: '', rol: '', territorio: '', microterritorio: '' });

    // 🚀 ESTADOS PARA MODALIDAD Y JORNADAS
    const [modalidad, setModalidad] = useState('turno'); // 'turno' | 'jornada'
    const [jornadaSeleccionada, setJornadaSeleccionada] = useState('');

    // 🚀 BLINDAJE: Solo mostrar jornadas activas al iniciar sesión
    const jornadasOficiales = useLiveQuery(() => db.jornadas.filter(j => j.estado !== 'Desactivado').toArray(), []) || [];

    // Extraemos de Dexie solo a los activos
    const profesionalesActivos = useLiveQuery(() => db.profesionales.filter(p => p.estado !== 'Desactivado').toArray(), []);

    const CLAVE_MAESTRA = "Mosquera2026";

    const perfilesOficiales = [
        { id: 'promotor', nombre: 'Promotor Aux. de Enfermería' },
        { id: 'medico', nombre: 'Profesional Médico' },
        { id: 'jefe_enfermeria', nombre: 'Profesional Jefe de Enfermería' },
        { id: 'psicologia', nombre: 'Profesional Psicología' },
        { id: 'fisioterapeuta', nombre: 'Profesional Complementario Fisioterapeuta' },
        { id: 'nutricionista', nombre: 'Profesional Complementario Nutricionista' },
        { id: 'gestor', nombre: 'Gestor Comunitario' }
    ];

    const validarClaveGlobal = (e) => {
        e.preventDefault();
        if (claveEntrada === CLAVE_MAESTRA) setPaso(1);
        else { alert("❌ Contraseña incorrecta."); setClaveEntrada(''); }
    };

    const buscarProfesional = async (e) => {
        e.preventDefault();
        if (!doc) return;

        const prof = await db.profesionales.get(doc);

        if (prof) {
            // 🛡️ VERIFICACIÓN ANTI-ZOMBIE
            if (prof.estado === 'Desactivado') {
                alert("🛑 ACCESO DENEGADO: Su perfil ha sido desactivado por el Coordinador.");
                return; // Bloquea el paso al formulario de sesión
            }

            setDatosProf({ nombre: prof.nombre, rol: prof.rol, territorio: '', microterritorio: '' });
            setEsNuevo(false);
        } else {
            setDatosProf({ nombre: '', rol: '', territorio: '', microterritorio: '' });
            setEsNuevo(true);
            alert("⚠️ Documento nuevo. Registre sus datos.");
        }
        setPaso(2);
    };

    // Función para manejar el cambio entre Turno y Jornada
    const handleModalidad = (tipo) => {
        setModalidad(tipo);
        setJornadaSeleccionada('');
        setDatosProf(prev => ({ ...prev, territorio: '', microterritorio: '' }));
    };

    // Función para manejar la selección de Jornada
    const handleJornadaChange = (e) => {
        const val = e.target.value;
        setJornadaSeleccionada(val);
        if (val !== '') {
            setDatosProf(prev => ({ ...prev, territorio: 'Jornada', microterritorio: 'N/A' }));
        } else {
            setDatosProf(prev => ({ ...prev, territorio: '', microterritorio: '' }));
        }
    };

    const iniciarSesion = async (e) => {
        e.preventDefault();

        let jId = null;
        let jNombre = '';

        // VALIDACIONES SEGÚN MODALIDAD
        if (modalidad === 'jornada') {
            if (!jornadaSeleccionada) return alert("⚠️ Debe seleccionar una Jornada de Atención.");

            jId = jornadaSeleccionada;
            jNombre = jornadasOficiales.find(j => String(j.id) === String(jId))?.nombre || '';

            // Aseguramos que territorio y microterritorio estén asignados para jornadas
            datosProf.territorio = 'Jornada';
            datosProf.microterritorio = 'N/A';
        } else {
            // Modalidad Turno Normal
            if (!datosProf.microterritorio) return alert("⚠️ Seleccione un microterritorio para iniciar su turno.");
        }

        const sesion = {
            documento: doc,
            ...datosProf,
            modalidad: modalidad,
            jornada_id: jId,
            jornada_nombre: jNombre,
            fecha_inicio: new Date().toISOString()
        };

        await db.profesionales.put({
            documento: doc,
            nombre: datosProf.nombre,
            rol: datosProf.rol,
            territorio_asignado: datosProf.territorio,
            microterritorio_asignado: datosProf.microterritorio
        });

        localStorage.setItem('sesionActual', JSON.stringify(sesion));

        if (onLoginSuccess) onLoginSuccess(sesion);
    };

    return (
        // 👇 AQUÍ LA SOLUCIÓN: Agregado width: '100%' y boxSizing al contenedor general 👇
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
            {/* Agregado margin: '0 auto' a la card por seguridad extra 👇 */}
            <div className="card" style={{ maxWidth: '550px', width: '100%', margin: '0 auto', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderTop: '5px solid var(--inst-blue)', backgroundColor: '#ffffff', colorScheme: 'light', color: '#1e293b' }}>
                <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                    <img src="/logo-hospital.jpg" alt="Hospital" style={{ width: '80px', marginBottom: '10px' }} />
                    <h2 style={{ color: 'var(--inst-blue)', margin: '0 0 5px 0' }}>🏥 Ingreso APS</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Identificación y Asignación</p>
                </div>

                {/* 🚀 BLOQUE: SINCRONIZACIÓN PRE-LOGIN */}
                <div style={{ marginBottom: '25px', textAlign: 'center', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#475569' }}>
                        ¿Cambios en perfiles o nuevas jornadas?
                    </p>
                    <button
                        type="button"
                        onClick={ejecutarSincronizacion}
                        disabled={!isOnline || sincronizando}
                        style={{
                            backgroundColor: isOnline ? (sincronizando ? '#94a3b8' : '#0ea5e9') : '#cbd5e1',
                            color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px',
                            cursor: (!isOnline || sincronizando) ? 'not-allowed' : 'pointer', fontWeight: 'bold', width: '100%',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                        }}>
                        {sincronizando ? '⏳ Descargando datos...' : '🔄 Sincronizar Base de Datos'}
                    </button>
                    <small style={{ display: 'block', marginTop: '8px', color: '#64748b', fontSize: '0.75rem' }}>
                        {isOnline ? '🟢 Conectado' : '🔴 Sin internet'} | Última Sincronización: {ultimaSinc || 'Nunca'}
                    </small>
                </div>
                {/* ----------------------------------------- */}

                {paso === 0 && (
                    <form onSubmit={validarClaveGlobal} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="form-group">
                            <label>🔐 Contraseña Global</label>
                            <input type="password" value={claveEntrada} onChange={(e) => setClaveEntrada(e.target.value)} required autoFocus autoComplete="new-password" style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '10px', borderRadius: '6px' }} />
                        </div>
                        <button type="submit" className="btn-save" style={{ width: '100%', marginTop: '5px' }}>Desbloquear Terminal 🔓</button>
                    </form>
                )}

                {paso === 1 && (
                    <form onSubmit={buscarProfesional} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="form-group">
                            <label>🪪 Su Número de Documento</label>
                            <input type="number" value={doc} onChange={(e) => setDoc(e.target.value)} required autoFocus style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '10px', borderRadius: '6px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                            <button type="button" onClick={() => setPaso(0)} className="btn-back" style={{ flex: 1, margin: 0 }}>⬅ Atrás</button>
                            <button type="submit" className="btn-save" style={{ flex: 2, margin: 0 }}>Buscar Perfil 🔍</button>
                        </div>
                    </form>
                )}

                {paso === 2 && (
                    <form onSubmit={iniciarSesion} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="form-group">
                            <label>👤 Nombre Completo</label>
                            <input type="text" value={datosProf.nombre} onChange={(e) => setDatosProf({ ...datosProf, nombre: e.target.value })} required readOnly={!esNuevo} style={{ backgroundColor: !esNuevo ? '#e2e8f0' : 'white', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '10px', borderRadius: '6px' }} />
                        </div>

                        <div className="form-group">
                            <label>💼 Perfil Profesional</label>
                            <select value={datosProf.rol} onChange={(e) => setDatosProf({ ...datosProf, rol: e.target.value })} required disabled={!esNuevo} style={{ backgroundColor: !esNuevo ? '#e2e8f0' : 'white', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '10px', borderRadius: '6px' }}>
                                <option value="">-- Seleccione su Perfil --</option>
                                {perfilesOficiales.map(perfil => (<option key={perfil.id} value={perfil.id}>{perfil.nombre}</option>))}
                                {(!esNuevo && datosProf.rol === 'soporte') || (datosProf.nombre.toUpperCase() === 'ADMIN') ? (<option value="soporte">👑 Coordinador / Super Admin</option>) : null}
                            </select>
                        </div>

                        <h4 style={{ color: 'var(--inst-orange)', borderBottom: '2px solid #eee', paddingBottom: '5px', marginTop: '10px' }}>📍 Modalidad de Trabajo</h4>

                        {/* 🚀 BOTONES DE SELECCIÓN DE MODALIDAD */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => handleModalidad('turno')}
                                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: modalidad === 'turno' ? 'var(--inst-blue)' : '#e2e8f0', color: modalidad === 'turno' ? 'white' : '#475569', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>
                                🗺️ Turno Regular
                            </button>
                            <button
                                type="button"
                                onClick={() => handleModalidad('jornada')}
                                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: modalidad === 'jornada' ? 'var(--inst-green)' : '#e2e8f0', color: modalidad === 'jornada' ? 'white' : '#475569', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>
                                🎪 Jornada de Salud
                            </button>
                        </div>

                        {/* INTERFAZ SI ELIGEN JORNADA DE SALUD */}
                        {modalidad === 'jornada' && (
                            <div className="form-group" style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '2px solid #bbf7d0' }}>
                                <label style={{ color: '#166534', fontWeight: 'bold' }}>🎪 Seleccionar Jornada Asignada</label>
                                <select
                                    required
                                    value={jornadaSeleccionada}
                                    onChange={handleJornadaChange}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#1e293b' }}
                                >
                                    <option value="">-- Seleccione una jornada --</option>
                                    {jornadasOficiales?.map(jor => (
                                        <option key={jor.id} value={jor.id}>{jor.nombre}</option>
                                    ))}
                                </select>
                                <small style={{ color: '#64748b', display: 'block', marginTop: '5px' }}>*Si su jornada no aparece, solicite al Coordinador que la cree.</small>
                            </div>
                        )}

                        {/* INTERFAZ SI ELIGEN TURNO REGULAR */}
                        {modalidad === 'turno' && (
                            <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '8px', border: '2px solid #cbd5e1' }}>
                                <label style={{ fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '5px' }}>🗺️ Territorio General</label>
                                <select value={datosProf.territorio} onChange={(e) => setDatosProf({ ...datosProf, territorio: e.target.value, microterritorio: '' })} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', marginBottom: '15px', width: '100%', padding: '10px', borderRadius: '6px' }}>
                                    <option value="">1. Seleccione...</option>
                                    {Object.keys(territoriosData).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>

                                <label style={{ fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '5px' }}>📍 Microterritorio</label>
                                <select value={datosProf.microterritorio} onChange={(e) => setDatosProf({ ...datosProf, microterritorio: e.target.value })} required disabled={!datosProf.territorio} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '10px', borderRadius: '6px' }}>
                                    <option value="">2. Seleccione...</option>
                                    {datosProf.territorio && Object.keys(territoriosData[datosProf.territorio]).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        )}

                        {/* MUESTRA EL MAPA SOLO SI ES UN TURNO REGULAR */}
                        {modalidad === 'turno' && datosProf.territorio && (
                            <div style={{ height: '200px', width: '100%', marginTop: '5px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--inst-blue)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)' }}>
                                <MapaTerritorio territorio={datosProf.territorio} microterritorio={datosProf.microterritorio} />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button type="button" onClick={() => setPaso(1)} className="btn-back" style={{ flex: 1, margin: 0 }}>⬅ Volver</button>
                            <button type="submit" className="btn-save" style={{ flex: 2, margin: 0 }}>✅ Ingresar al Tablero</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}