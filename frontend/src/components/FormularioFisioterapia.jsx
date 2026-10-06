import { useState, useEffect } from 'react';
import { db } from '../db';

export default function FormularioFisioterapia({ usuario, tarea, volver }) {
    const [guardando, setGuardando] = useState(false);
    const [pacienteInfo, setPacienteInfo] = useState(null);
    const [archivosAdjuntos, setArchivosAdjuntos] = useState([]);

    const [historia, setHistoria] = useState({ situacion_entorno: '', acciones_cuidado: '', objetivos_concertaciones: '', seguimiento: '' });

    useEffect(() => {
        const cargarDatosPaciente = async () => {
            const paciente = await db.pacientes.get(tarea.paciente_id);
            if (paciente && paciente.datos) setPacienteInfo(paciente.datos);
            else setPacienteInfo({ primer_nombre: 'Paciente', primer_apellido: 'Prueba' });
        };
        cargarDatosPaciente();
    }, [tarea.paciente_id]);

    const manejarSubidaArchivo = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) return alert(`⚠️ El archivo ${file.name} supera los 5MB permitidos.`);
            const reader = new FileReader();
            reader.onloadend = () => setArchivosAdjuntos(prev => [...prev, { id: crypto.randomUUID(), nombre: file.name, tipo: file.type, datosBase64: reader.result }]);
            reader.readAsDataURL(file);
        });
    };

    const guardarAtencion = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await db.form_clinico.add({ id_atencion: crypto.randomUUID(), paciente_id: tarea.paciente_id, profesional_doc: usuario.documento, especialidad: 'Fisioterapia', fecha: new Date().toISOString(), datos: { ...historia, archivos: archivosAdjuntos }, sincronizado: 0 });
            // 🚀 CIERRE DE ALERTA ULTRA-BLINDADO
            if (tarea && tarea.origen === 'alerta') {
                // 1. Buscamos el ID, ya sea que venga como 'id' o 'id_canalizacion'
                const idAlerta = tarea.id || tarea.id_canalizacion;

                if (idAlerta) {
                    try {
                        // 2. Si hay un ID válido, intentamos cerrar la alerta
                        await db.canalizaciones.update(idAlerta, {
                            estado: 'Cerrada',
                            sincronizado: 0
                        });
                        console.log("✅ Alerta cerrada correctamente en la base de datos local.");
                    } catch (errorAlerta) {
                        // Si Dexie falla, lo atrapamos silenciosamente
                        console.error("⚠️ Fallo menor intentando cerrar la alerta:", errorAlerta);
                    }
                } else {
                    // 3. Si no hay ID, avisamos en consola pero NO detenemos el formulario
                    console.warn("⚠️ Advertencia: El paciente proviene de una alerta, pero no se encontró su ID para cerrarla. Tarea recibida:", tarea);
                }
            } else if (tarea && tarea.id) {
                await db.canalizaciones.update(tarea.id, { estado: 'Atendido', profesional_atendio: usuario.documento });
            }
            alert("✅ Valoración de Fisioterapia guardada.");
            volver();
        } catch (error) { alert("❌ Error guardando."); }
        setGuardando(false);
    };

    return (
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto', borderTop: '5px solid #7e22ce', backgroundColor: '#ffffff', colorScheme: 'light', color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ color: '#7e22ce', margin: 0 }}>🦴 Atención de Fisioterapia</h2>
                <button onClick={volver} className="btn-back" style={{ margin: 0 }}>❌ Cancelar</button>
            </div>

            <div style={{ backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#6b21a8' }}>👤 Paciente: {pacienteInfo?.primer_nombre} {pacienteInfo?.primer_apellido} | 🪪 Doc: {tarea.paciente_id}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#6b21a8' }}>🚨 Motivo Triage: {tarea.motivo}</p>
            </div>

            <form onSubmit={guardarAtencion} className="form-grid">
                <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>📝 Plan de Manejo Físico y Rehabilitación</h3>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>1. SITUACIÓN EN EL ENTORNO Y SALUD (Hallazgos motores, articulares y riesgos)</label><textarea value={historia.situacion_entorno} onChange={e => setHistoria({ ...historia, situacion_entorno: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>2. ACCIONES DE CUIDADO INDICADAS</label><textarea value={historia.acciones_cuidado} onChange={e => setHistoria({ ...historia, acciones_cuidado: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>3. OBJETIVOS Y CONCERTACIONES (Terapias o Ejercicios)</label><textarea value={historia.objetivos_concertaciones} onChange={e => setHistoria({ ...historia, objetivos_concertaciones: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>4. SEGUIMIENTO</label><textarea value={historia.seguimiento} onChange={e => setHistoria({ ...historia, seguimiento: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea></div>

                <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                    <label style={{ backgroundColor: '#e2e8f0', color: '#334155', padding: '10px 15px', borderRadius: '8px', border: '2px dashed #94a3b8', fontWeight: 'bold', cursor: 'pointer', display: 'block', textAlign: 'center' }}>
                        📎 Anexar Imágenes / Documentos
                        <input type="file" multiple onChange={manejarSubidaArchivo} style={{ display: 'none' }} />
                    </label>
                    {archivosAdjuntos.length > 0 && (
                        <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
                            {archivosAdjuntos.map(a => (
                                <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '4px', marginBottom: '5px', border: '1px solid #cbd5e1' }}>
                                    <span style={{ fontSize: '0.85rem' }}>📄 {a.nombre}</span>
                                    <button type="button" onClick={() => setArchivosAdjuntos(prev => prev.filter(x => x.id !== a.id))} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>❌</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '20px' }}><button type="submit" disabled={guardando} className="btn-save" style={{ backgroundColor: '#6b21a8', padding: '15px 40px', fontSize: '1.2rem' }}>{guardando ? 'Guardando...' : '💾 Firmar y Cerrar Atención'}</button></div>
            </form>
        </div>
    );
}