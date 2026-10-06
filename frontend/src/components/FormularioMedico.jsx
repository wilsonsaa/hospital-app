import { useState, useEffect } from 'react';
import { db } from '../db';
import { cie10APS } from '../cie10Data';

export default function FormularioMedico({ usuario, tarea, volver }) {
    const [guardando, setGuardando] = useState(false);
    const [pacienteInfo, setPacienteInfo] = useState(null);
    const [archivosAdjuntos, setArchivosAdjuntos] = useState([]);

    const [historia, setHistoria] = useState({
        motivo_consulta: '', enfermedad_actual: '', antecedentes_patologicos: '',
        sv_fc: '', sv_fr: '', sv_ta_sistolica: '', sv_ta_diastolica: '',
        peso_kg: '', talla_cm: '', imc_calc: '', perim_abdominal: '', perim_braquial: '',
        diagnostico_principal: '', diagnostico_relacionado_1: '', diagnostico_relacionado_2: '',
        situacion_entorno: '', acciones_cuidado: '', objetivos_concertaciones: '', seguimiento: ''
    });

    // 🚀 BLINDAJE EXTREMO
    const pacienteIdSeguro = tarea?.paciente_id || '';

    useEffect(() => {
        const cargarDatosPaciente = async () => {
            if (!pacienteIdSeguro) return;
            const paciente = await db.pacientes.get(pacienteIdSeguro);
            if (paciente && paciente.datos) {
                setPacienteInfo(paciente.datos);
                setHistoria(prev => ({
                    ...prev,
                    peso_kg: paciente.datos.peso_kg || '', talla_cm: paciente.datos.talla_cm || '',
                    perim_abdominal: paciente.datos.perim_abdominal || '', perim_braquial: paciente.datos.perim_braquial || '',
                    sv_ta_sistolica: paciente.datos.ta_sistolica || '', sv_ta_diastolica: paciente.datos.ta_diastolica || ''
                }));
            } else { setPacienteInfo({ primer_nombre: 'Paciente', primer_apellido: 'Prueba', sexo_asignado: 'Desconocido' }); }
        };
        cargarDatosPaciente();
    }, [pacienteIdSeguro]);

    useEffect(() => {
        const peso = parseFloat(historia.peso_kg);
        const tallaM = parseFloat(historia.talla_cm) / 100;
        if (peso > 0 && tallaM > 0) {
            const imc = (peso / (tallaM * tallaM)).toFixed(1);
            let estado = '';
            if (imc < 18.5) estado = 'Bajo peso';
            else if (imc < 25) estado = 'Normal';
            else if (imc < 30) estado = 'Sobrepeso';
            else estado = 'Obesidad';
            setHistoria(prev => ({ ...prev, imc_calc: `${imc} (${estado})` }));
        } else { setHistoria(prev => ({ ...prev, imc_calc: '' })); }
    }, [historia.peso_kg, historia.talla_cm]);

    const manejarSubidaArchivo = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) return alert(`⚠️ El archivo ${file.name} supera los 5MB permitidos.`);
            const reader = new FileReader();
            reader.onloadend = () => {
                setArchivosAdjuntos(prev => [...prev, { id: crypto.randomUUID(), nombre: file.name, tipo: file.type, datosBase64: reader.result }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const eliminarArchivo = (id) => setArchivosAdjuntos(prev => prev.filter(a => a.id !== id));

    const guardarAtencion = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await db.form_clinico.add({
                id_atencion: crypto.randomUUID(),
                paciente_id: pacienteIdSeguro,
                profesional_doc: usuario?.documento || '000',
                microterritorio: usuario?.microterritorio || 'N/A',
                fecha: new Date().toISOString(),
                datos: { ...historia, archivos: archivosAdjuntos },
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
            } else if (tarea.id) {
                // Fallback por si la tarea no tiene origen explícito pero igual debe cerrarse/atenderse
                await db.canalizaciones.update(tarea.id, {
                    estado: 'Atendido',
                    profesional_atendio: usuario?.documento || 'Profesional',
                    sincronizado: 0
                });
            }

            alert("✅ Atención clínica guardada con éxito.");
            volver();
        } catch (error) {
            console.error(error);
            alert("❌ Error guardando la atención.");
        }
        setGuardando(false);
    };

    if (!tarea) return <div style={{ textAlign: 'center', padding: '50px', color: '#1e293b' }}><h2>Cargando formulario...</h2></div>;

    return (
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#ffffff', colorScheme: 'light', color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ color: 'var(--inst-blue)', margin: 0 }}>🩺 Atención Médica / Clínica</h2>
                <button onClick={volver} className="btn-back" style={{ margin: 0 }}>❌ Cancelar</button>
            </div>

            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#1e40af' }}>👤 Paciente: {pacienteInfo?.primer_nombre} {pacienteInfo?.primer_apellido} | 🪪 Doc: {tarea?.paciente_id}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#1e3a8a' }}>🚨 Motivo Consulta: {tarea?.motivo}</p>
            </div>

            {pacienteInfo && pacienteInfo.primer_nombre !== 'Paciente' && (
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', fontSize: '1.1rem' }}>
                        📋 Datos Previos Recolectados por el Promotor
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', fontSize: '0.9rem', color: '#475569' }}>
                        <p style={{ margin: 0 }}><strong>🎂 Edad:</strong> {pacienteInfo.edad_calc} años ({pacienteInfo.curso_vida})</p>
                        <p style={{ margin: 0 }}><strong>🚻 Sexo/Género:</strong> {pacienteInfo.sexo_asignado} / {pacienteInfo.identidad_genero}</p>
                        <p style={{ margin: 0 }}><strong>🏥 EPS:</strong> {pacienteInfo.nombre_eps || 'Ninguna'} ({pacienteInfo.regimen_salud})</p>
                        <p style={{ margin: 0 }}><strong>🎓 Escolaridad:</strong> {pacienteInfo.nivel_escolaridad}</p>
                        <p style={{ margin: 0 }}><strong>💼 Ocupación:</strong> {pacienteInfo.ocupacion_actual || 'Ninguna'}</p>
                        <p style={{ margin: 0 }}><strong>🤒 Enf. Crónica:</strong> {pacienteInfo.enfermedad_cronica || 'Ninguna'}</p>
                        <p style={{ margin: 0 }}><strong>♿ Discapacidad:</strong> {pacienteInfo.discapacidad === 'Sí' ? pacienteInfo.tipo_discapacidad : 'No'}</p>
                        <p style={{ margin: 0 }}><strong>⚖️ Antropometría:</strong> Peso: {pacienteInfo.peso_kg}kg | Talla: {pacienteInfo.talla_cm}cm</p>
                    </div>
                </div>
            )}

            <form onSubmit={guardarAtencion} className="form-grid">
                <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>📝 Anamnesis</h3>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>🗣️ Motivo de Consulta Médico</label><textarea value={historia.motivo_consulta} onChange={e => setHistoria({ ...historia, motivo_consulta: e.target.value })} rows="2" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>🤒 Enfermedad Actual</label><textarea value={historia.enfermedad_actual} onChange={e => setHistoria({ ...historia, enfermedad_actual: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>🩺 Antecedentes Patológicos</label><textarea value={historia.antecedentes_patologicos} onChange={e => setHistoria({ ...historia, antecedentes_patologicos: e.target.value })} rows="2" style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea></div>

                <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>💓 Signos Vitales y Antropometría</h3>
                <div className="form-group"><label>💓 Frec. Cardíaca (bpm)</label><input type="number" value={historia.sv_fc} onChange={e => setHistoria({ ...historia, sv_fc: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group"><label>🫁 Frec. Respiratoria (rpm)</label><input type="number" value={historia.sv_fr} onChange={e => setHistoria({ ...historia, sv_fr: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group"><label>🩺 TA Sistólica (mmHg)</label><input type="number" value={historia.sv_ta_sistolica} onChange={e => setHistoria({ ...historia, sv_ta_sistolica: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group"><label>🩺 TA Diastólica (mmHg)</label><input type="number" value={historia.sv_ta_diastolica} onChange={e => setHistoria({ ...historia, sv_ta_diastolica: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>

                <div className="form-group"><label>⚖️ Peso (Kg)</label><input type="number" step="0.1" value={historia.peso_kg} onChange={e => setHistoria({ ...historia, peso_kg: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group"><label>📏 Talla (cm)</label><input type="number" step="0.1" value={historia.talla_cm} onChange={e => setHistoria({ ...historia, talla_cm: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group"><label>📊 IMC (Calculado)</label><input type="text" value={historia.imc_calc} readOnly style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', color: '#334155', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group"><label>📏 Perím. Abdominal (cm)</label><input type="number" step="0.1" value={historia.perim_abdominal} onChange={e => setHistoria({ ...historia, perim_abdominal: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>

                <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>🩺 Diagnósticos (CIE-10)</h3>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>🎯 Diagnóstico Principal (CIE-10)</label><input list="cie10-opciones" value={historia.diagnostico_principal} onChange={e => setHistoria({ ...historia, diagnostico_principal: e.target.value })} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>➕ Diagnóstico Relacionado 1</label><input list="cie10-opciones" value={historia.diagnostico_relacionado_1} onChange={e => setHistoria({ ...historia, diagnostico_relacionado_1: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                <datalist id="cie10-opciones">{cie10APS.map((cie, index) => <option key={index} value={cie} />)}</datalist>

                <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>📋 Plan de Manejo Interdisciplinario</h3>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>1. SITUACIÓN EN EL ENTORNO Y SALUD</label>
                    <textarea value={historia.situacion_entorno} onChange={e => setHistoria({ ...historia, situacion_entorno: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>2. ACCIONES DE CUIDADO INDICADAS</label>
                    <textarea value={historia.acciones_cuidado} onChange={e => setHistoria({ ...historia, acciones_cuidado: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>3. OBJETIVOS Y CONCERTACIONES</label>
                    <textarea value={historia.objetivos_concertaciones} onChange={e => setHistoria({ ...historia, objetivos_concertaciones: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>4. SEGUIMIENTO</label>
                    <textarea value={historia.seguimiento} onChange={e => setHistoria({ ...historia, seguimiento: e.target.value })} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                </div>

                <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                    <label style={{ backgroundColor: '#e2e8f0', color: '#334155', padding: '10px 15px', borderRadius: '8px', border: '2px dashed #94a3b8', fontWeight: 'bold', cursor: 'pointer', display: 'block', textAlign: 'center' }}>
                        📎 Anexar Documentos / Exámenes
                        <input type="file" multiple onChange={manejarSubidaArchivo} style={{ display: 'none' }} />
                    </label>
                    {archivosAdjuntos.length > 0 && (
                        <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
                            {archivosAdjuntos.map(a => (
                                <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '4px', marginBottom: '5px', border: '1px solid #cbd5e1' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#334155' }}>📄 {a.nombre}</span>
                                    <button type="button" onClick={() => eliminarArchivo(a.id)} style={{ color: 'red', background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>❌</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '20px' }}>
                    <button type="submit" disabled={guardando} className="btn-save" style={{ padding: '15px 40px', fontSize: '1.2rem' }}>{guardando ? 'Guardando...' : '💾 Firmar y Cerrar Atención'}</button>
                </div>
            </form>
        </div>
    );
}