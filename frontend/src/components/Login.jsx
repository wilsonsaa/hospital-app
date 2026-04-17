import { useState } from 'react';
import { db } from '../db';
import { territoriosData } from '../territoriosData';
import MapaTerritorio from './MapaTerritorio';

export default function Login({ onLoginSuccess }) {
    const [paso, setPaso] = useState(0);
    const [claveEntrada, setClaveEntrada] = useState('');
    const [doc, setDoc] = useState('');
    const [esNuevo, setEsNuevo] = useState(false);
    const [datosProf, setDatosProf] = useState({ nombre: '', rol: '', territorio: '', microterritorio: '' });

    const CLAVE_MAESTRA = "Mosquera2026";

    const validarClaveGlobal = (e) => { e.preventDefault(); if (claveEntrada === CLAVE_MAESTRA) setPaso(1); else { alert("❌ Contraseña incorrecta."); setClaveEntrada(''); } };

    const buscarProfesional = async (e) => {
        e.preventDefault(); if (!doc) return;
        const prof = await db.profesionales.get(doc);
        if (prof) { setDatosProf({ nombre: prof.nombre, rol: prof.rol, territorio: '', microterritorio: '' }); setEsNuevo(false); }
        else { setDatosProf({ nombre: '', rol: '', territorio: '', microterritorio: '' }); setEsNuevo(true); alert("⚠️ Documento nuevo. Registre sus datos."); }
        setPaso(2);
    };

    const iniciarSesion = async (e) => {
        e.preventDefault();
        const sesion = { documento: doc, ...datosProf, fecha_inicio: new Date().toISOString() };
        await db.profesionales.put({ documento: doc, nombre: datosProf.nombre, rol: datosProf.rol, territorio_asignado: datosProf.territorio });
        localStorage.setItem('sesionActual', JSON.stringify(sesion));
        onLoginSuccess(sesion);
    };

    return (
        <div className="card" style={{ maxWidth: '500px', margin: '20px auto', padding: '20px', borderTop: '5px solid var(--inst-blue)' }}>
            <div style={{ textAlign: 'center', marginBottom: '25px' }}><img src="/logo-hospital.jpg" alt="Hospital" style={{ width: '80px', marginBottom: '10px' }} /><h2 style={{ color: 'var(--inst-blue)', margin: '0 0 5px 0' }}>Control de Acceso APS</h2><p style={{ color: '#64748b', margin: 0 }}>Identificación y Asignación</p></div>

            {paso === 0 && (<form onSubmit={validarClaveGlobal}><div className="form-group"><label>🔐 Contraseña Global</label><input type="password" value={claveEntrada} onChange={(e) => setClaveEntrada(e.target.value)} required autoFocus /></div><button type="submit" className="btn-save" style={{ width: '100%', marginTop: '15px' }}>Desbloquear Terminal 🔓</button></form>)}

            {paso === 1 && (<form onSubmit={buscarProfesional}><div className="form-group"><label>🪪 Su Número de Documento</label><input type="number" value={doc} onChange={(e) => setDoc(e.target.value)} required autoFocus /></div><div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}><button type="button" onClick={() => setPaso(0)} className="btn-back" style={{ flex: 1, margin: 0 }}>⬅ Atrás</button><button type="submit" className="btn-save" style={{ flex: 2, margin: 0 }}>Buscar Perfil 🔍</button></div></form>)}

            {paso === 2 && (
                <form onSubmit={iniciarSesion}>
                    <div className="form-group"><label>👤 Nombre Completo</label><input type="text" value={datosProf.nombre} onChange={(e) => setDatosProf({ ...datosProf, nombre: e.target.value })} required readOnly={!esNuevo} style={{ backgroundColor: !esNuevo ? '#e2e8f0' : 'white' }} /></div>
                    <div className="form-group">
                        <label>💼 Rol en el Sistema</label>
                        <select value={datosProf.rol} onChange={(e) => setDatosProf({ ...datosProf, rol: e.target.value })} required disabled={!esNuevo} style={{ backgroundColor: !esNuevo ? '#e2e8f0' : 'white' }}>
                            <option value="">Seleccione...</option>
                            <option value="promotor">Rol 1: Promotor (Caracterización)</option>
                            <option value="medico">Rol 2: Clínico (Médico/Enfermero)</option>
                            <option value="psicosocial">Rol 3: Trabajo Social / Psicología</option>
                            <option value="gestor">Rol 5: Gestor Comunitario (Cartografía)</option>

                            {/* 🔒 PUERTA TRASERA DEL SUPER ADMIN */}
                            {(!esNuevo && datosProf.rol === 'soporte') || (datosProf.nombre.toUpperCase() === 'ADMIN') ? (
                                <option value="soporte">👑 Rol 4: Coordinador / Super Admin</option>
                            ) : null}

                        </select>
                    </div>

                    <h4 style={{ color: 'var(--inst-orange)', borderBottom: '2px solid #eee', paddingBottom: '5px', marginTop: '20px' }}>📍 Asignación de Turno Territorial</h4>

                    <div className="form-group"><label>Territorio General</label><select value={datosProf.territorio} onChange={(e) => setDatosProf({ ...datosProf, territorio: e.target.value, microterritorio: '' })} required><option value="">1. Seleccione...</option>{Object.keys(territoriosData).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="form-group"><label>Microterritorio Específico</label><select value={datosProf.microterritorio} onChange={(e) => setDatosProf({ ...datosProf, microterritorio: e.target.value })} required disabled={!datosProf.territorio}><option value="">2. Seleccione...</option>{datosProf.territorio && Object.keys(territoriosData[datosProf.territorio]).map(m => <option key={m} value={m}>{m}</option>)}</select></div>

                    {datosProf.territorio && (
                        <div style={{ height: '200px', width: '100%', marginTop: '15px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--inst-blue)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)' }}>
                            <MapaTerritorio territorio={datosProf.territorio} microterritorio={datosProf.microterritorio} />
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}><button type="button" onClick={() => setPaso(1)} className="btn-back" style={{ flex: 1, margin: 0 }}>⬅ Volver</button><button type="submit" className="btn-save" style={{ flex: 2, margin: 0 }}>✅ Iniciar Turno</button></div>
                </form>
            )}
        </div>
    );
}