import { useState, useEffect } from 'react';
import { db } from '../db';

export default function FormularioPsicosocial({ usuario, tarea, volver }) {
    const [guardando, setGuardando] = useState(false);
    const [pacienteInfo, setPacienteInfo] = useState(null);

    const [archivosPruebas, setArchivosPruebas] = useState([]);
    const [archivosReportes, setArchivosReportes] = useState([]);

    const getEstiloAlerta = (condicion) => condicion ? { border: '2px solid #ef4444', backgroundColor: '#fef2f2', outline: 'none', color: '#1e293b' } : { backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' };

    const AlertaHelper = ({ condicion, mensaje }) => {
        if (!condicion) return null;
        return <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '4px 0 0 0', fontWeight: 'bold' }}>⚠️ {mensaje}</p>;
    };

    const [intervencion, setIntervencion] = useState({
        antecedentes: 'Ninguno',
        observaciones_antecedentes: '',
        valoracion_familiar: '',
        red_apoyo: '',
        plan_cuidado: '',
        acuerdos_recomendaciones: '',
        seguimiento_ebs: 'No',
        se_realiza_reporte: 'No'
    });

    // 🚀 BLINDAJE EXTREMO ANTI-PANTALLA BLANCA
    const pacienteIdSeguro = tarea?.paciente_id || '';

    useEffect(() => {
        const cargarDatosPaciente = async () => {
            if (!pacienteIdSeguro) return; // Si llega vacío por parpadeo de React, aborta la consulta
            const paciente = await db.pacientes.get(pacienteIdSeguro);
            if (paciente && paciente.datos) setPacienteInfo(paciente.datos);
            else setPacienteInfo({ primer_nombre: 'Paciente', primer_apellido: 'Prueba' });
        };
        cargarDatosPaciente();
    }, [pacienteIdSeguro]);

    const procesarArchivos = (e, setter) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) return alert(`⚠️ El archivo ${file.name} supera los 5MB.`);
            const reader = new FileReader();
            reader.onloadend = () => {
                setter(prev => [...prev, { id: crypto.randomUUID(), nombre: file.name, tipo: file.type, datosBase64: reader.result }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const guardarIntervencion = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await db.form_psicosocial.add({
                id_intervencion: crypto.randomUUID(),
                paciente_id: pacienteIdSeguro,
                profesional_doc: usuario?.documento || '000',
                fecha: new Date().toISOString(),
                datos: { ...intervencion, pruebas_adjuntas: archivosPruebas, reportes_adjuntos: archivosReportes },
                sincronizado: 0
            });

            // 🚀 Si esta atención provino de una alerta de canalización, la cerramos automáticamente
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
            } else if (tarea?.id) {
                // Fallback por si la tarea no tiene origen explícito pero igual debe cerrarse/atenderse
                await db.canalizaciones.update(tarea.id, {
                    estado: 'Atendido',
                    profesional_atendio: usuario?.documento || 'Profesional',
                    sincronizado: 0
                });
            }

            alert("✅ Intervención Psicosocial guardada con éxito.");
            volver();
        } catch (error) {
            console.error(error);
            alert("❌ Error guardando.");
        }
        setGuardando(false);
    };

    if (!tarea) return <div style={{ textAlign: 'center', padding: '50px', color: '#1e293b' }}><h2>Cargando formulario...</h2></div>;

    return (
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto', borderTop: '5px solid var(--inst-green)', backgroundColor: '#ffffff', colorScheme: 'light', color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ color: 'var(--inst-green)', margin: 0 }}>🧠 Atención Psicosocial</h2>
                <button onClick={volver} className="btn-back" style={{ margin: 0 }}>❌ Cancelar</button>
            </div>

            {pacienteInfo && pacienteInfo.primer_nombre !== 'Paciente' && (
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', fontSize: '1.1rem' }}>
                        📋 Datos Previos Recolectados por el Promotor
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', fontSize: '0.9rem', color: '#475569' }}>
                        <p style={{ margin: 0 }}><strong>👤 Paciente:</strong> {pacienteInfo.primer_nombre} {pacienteInfo.primer_apellido}</p>
                        <p style={{ margin: 0 }}><strong>🎂 Edad:</strong> {pacienteInfo.edad_calc} años</p>
                        <p style={{ margin: 0 }}><strong>🛑 Violencia/Acoso:</strong> <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>{pacienteInfo.violencia_acoso}</span></p>
                        <p style={{ margin: 0 }}><strong>⚠️ Abandono:</strong> <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>{pacienteInfo.estado_abandono}</span></p>
                        <p style={{ margin: 0 }}><strong>🚬 Consumo SPA:</strong> {pacienteInfo.consumo_spa === 'Sí' ? pacienteInfo.tipo_spa : 'No'}</p>
                    </div>
                </div>
            )}

            <form onSubmit={guardarIntervencion} className="form-grid">
                <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>📝 1. Antecedentes y Valoración</h3>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>1. Antecedentes Médicos y/o Psicológicos Individuales</label>
                    <select value={intervencion.antecedentes} onChange={e => setIntervencion({ ...intervencion, antecedentes: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                        <option>Ninguno</option>
                        <option>Ansiedad</option><option>Depresión</option><option>Esquizofrenia</option>
                        <option>Trastornos conducta alimentaria</option><option>Trastornos de neuro desarrollo</option>
                        <option>Trastorno bipolar</option><option>Deterioro cognitivo</option>
                        <option>Consumo de Spa</option><option>Violencias</option><option>Otros</option>
                    </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Observaciones de Antecedentes (Opcional)</label>
                    <textarea value={intervencion.observaciones_antecedentes} onChange={e => setIntervencion({ ...intervencion, observaciones_antecedentes: e.target.value })} rows="2" style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>2. Valoración Dinámica Familiar</label>
                    <textarea value={intervencion.valoracion_familiar} onChange={e => setIntervencion({ ...intervencion, valoracion_familiar: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>3. Red de Apoyo</label>
                    <textarea value={intervencion.red_apoyo} onChange={e => setIntervencion({ ...intervencion, red_apoyo: e.target.value })} rows="2" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1', backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '8px' }}>
                    <label>4. Pruebas Psicológicas Aplicadas (Familiograma / Ecomapa)</label>
                    <label style={{ marginTop: '10px', backgroundColor: 'white', color: '#334155', padding: '10px 15px', borderRadius: '8px', border: '2px dashed #94a3b8', fontWeight: 'bold', cursor: 'pointer', display: 'block', textAlign: 'center' }}>
                        📎 Seleccionar Pruebas / Familiograma
                        <input type="file" multiple onChange={(e) => procesarArchivos(e, setArchivosPruebas)} style={{ display: 'none' }} />
                    </label>
                    {archivosPruebas.length > 0 && (
                        <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
                            {archivosPruebas.map(a => (
                                <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#e2e8f0', padding: '8px', borderRadius: '4px', marginBottom: '5px' }}>
                                    <span style={{ fontSize: '0.85rem' }}>📄 {a.nombre}</span>
                                    <button type="button" onClick={() => setArchivosPruebas(prev => prev.filter(x => x.id !== a.id))} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>❌</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>📋 5. Cuidado y Acuerdos</h3>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>5. Plan de Cuidado</label>
                    <textarea value={intervencion.plan_cuidado} onChange={e => setIntervencion({ ...intervencion, plan_cuidado: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>6. Acuerdos y Recomendaciones</label>
                    <textarea value={intervencion.acuerdos_recomendaciones} onChange={e => setIntervencion({ ...intervencion, acuerdos_recomendaciones: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>

                <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>🛑 7. Remisiones y Reportes</h3>
                <div className="form-group">
                    <label>7. Requiere seguimiento por Psicología por parte de EBS</label>
                    <select value={intervencion.seguimiento_ebs} onChange={e => setIntervencion({ ...intervencion, seguimiento_ebs: e.target.value })} style={getEstiloAlerta(intervencion.seguimiento_ebs === 'Sí')}>
                        <option>No</option><option>Sí</option>
                    </select>
                    <AlertaHelper condicion={intervencion.seguimiento_ebs === 'Sí'} mensaje="Alerta de Seguimiento Externo" />
                </div>

                <div className="form-group">
                    <label>8. ¿Se realiza reporte institucional?</label>
                    <select value={intervencion.se_realiza_reporte} onChange={e => setIntervencion({ ...intervencion, se_realiza_reporte: e.target.value })} style={getEstiloAlerta(intervencion.se_realiza_reporte === 'Sí')}>
                        <option>No</option><option>Sí</option>
                    </select>
                    <AlertaHelper condicion={intervencion.se_realiza_reporte === 'Sí'} mensaje="Alerta de Reporte Formal" />
                </div>

                {intervencion.se_realiza_reporte === 'Sí' && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px 15px', borderRadius: '8px', border: '2px dashed #f87171', fontWeight: 'bold', cursor: 'pointer', display: 'block', textAlign: 'center' }}>
                            📎 Subir Evidencia de Reporte
                            <input type="file" multiple onChange={(e) => procesarArchivos(e, setArchivosReportes)} style={{ display: 'none' }} />
                        </label>
                        {archivosReportes.length > 0 && (
                            <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
                                {archivosReportes.map(a => (
                                    <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '4px', marginBottom: '5px', border: '1px solid #fca5a5' }}>
                                        <span style={{ fontSize: '0.85rem' }}>📄 {a.nombre}</span>
                                        <button type="button" onClick={() => setArchivosReportes(prev => prev.filter(x => x.id !== a.id))} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>❌</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '20px' }}>
                    <button type="submit" disabled={guardando} className="btn-save" style={{ padding: '15px 40px', fontSize: '1.2rem', backgroundColor: 'var(--inst-green)' }}>
                        {guardando ? 'Guardando...' : '🤝 Firmar y Cerrar Intervención'}
                    </button>
                </div>
            </form>
        </div>
    );
}