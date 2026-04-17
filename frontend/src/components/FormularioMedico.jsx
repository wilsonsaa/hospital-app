import { useState, useEffect } from 'react';
import { db } from '../db';
import { cie10APS } from '../cie10Data';

export default function FormularioMedico({ usuario, tarea, volver }) {
    const [guardando, setGuardando] = useState(false);
    const [pacienteInfo, setPacienteInfo] = useState(null);

    // Ampliamos el estado para incluir las recomendaciones del equipo médico
    const [historia, setHistoria] = useState({
        motivo_consulta: '',
        enfermedad_actual: '',
        antecedentes_patologicos: '', // NUEVO: Patologías
        sv_fc: '', sv_fr: '', sv_ta_sistolica: '', sv_ta_diastolica: '',
        diagnostico_principal: '',
        conducta_medica: '',
        medicamentos_prescritos: '',
        planificacion_familiar: '', // NUEVO: Condicional para mujeres
        estado_vacunacion: ''       // NUEVO: Condicional para menores de 11
    });

    // Efecto inteligente: Busca los datos demográficos del paciente antes de abrir el formulario
    useEffect(() => {
        const cargarDatosPaciente = async () => {
            const paciente = await db.pacientes.get(tarea.paciente_id);
            if (paciente && paciente.datos) {
                setPacienteInfo(paciente.datos);
            } else {
                // Fallback por si la data no está completa
                setPacienteInfo({ sexo: 'Desconocido', edad_calc: 99 });
            }
        };
        cargarDatosPaciente();
    }, [tarea.paciente_id]);

    const guardarHistoria = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            const fecha_hora = new Date().toISOString();
            await db.form_clinico.add({
                id_atencion: crypto.randomUUID(),
                paciente_id: tarea.paciente_id,
                profesional_doc: usuario.documento,
                fecha: fecha_hora,
                datos_clinicos: historia,
                sincronizado: 0
            });
            await db.canalizaciones.update(tarea.id, {
                estado: 'Atendido',
                fecha_atencion: fecha_hora,
                profesional_atendio: usuario.nombre
            });
            alert("✅ Atención médica registrada con éxito.");
            volver();
        } catch (error) {
            console.error(error);
            alert("❌ Error guardando la historia clínica.");
        }
        setGuardando(false);
    };

    return (
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '3px solid var(--inst-blue)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ color: 'var(--inst-blue)', margin: 0 }}>🩺 Historia Clínica APS</h2>
                <button type="button" onClick={volver} className="btn-back" style={{ margin: 0 }}>⬅ Volver a la Bandeja</button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div><strong style={{ color: '#64748b' }}>👤 Paciente:</strong> {tarea.nombre_paciente}</div>
                <div><strong style={{ color: '#64748b' }}>🪪 Documento:</strong> {tarea.paciente_id}</div>
                {pacienteInfo && (
                    <div><strong style={{ color: '#64748b' }}>🚻 Sexo / Edad:</strong> {pacienteInfo.sexo} | {pacienteInfo.edad_calc} años</div>
                )}
                <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: '#64748b' }}>🚨 Alerta de Triage:</strong> <span style={{ color: '#b91c1c', fontWeight: 'bold', backgroundColor: '#fee2e2', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '5px' }}>{tarea.motivo}</span></div>
            </div>

            {!pacienteInfo ? (
                <p style={{ textAlign: 'center' }}>Cargando expediente...</p>
            ) : (
                <form onSubmit={guardarHistoria} className="form-grid">

                    <h3 style={{ gridColumn: '1 / -1', color: 'var(--inst-orange)', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>🗣️ 1. Anamnesis y Antecedentes</h3>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>💬 Motivo de Consulta</label><textarea value={historia.motivo_consulta} onChange={e => setHistoria({ ...historia, motivo_consulta: e.target.value })} rows="2" required></textarea></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>🤒 Enfermedad Actual</label><textarea value={historia.enfermedad_actual} onChange={e => setHistoria({ ...historia, enfermedad_actual: e.target.value })} rows="3" required></textarea></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>📋 Patologías de Base / Antecedentes</label><textarea value={historia.antecedentes_patologicos} onChange={e => setHistoria({ ...historia, antecedentes_patologicos: e.target.value })} rows="2" placeholder="Ej: Hipertensión, asma, cirugías previas... (Dejar en blanco si no aplica)"></textarea></div>

                    {/* MÓDULOS INTELIGENTES BASADOS EN SEXO Y EDAD */}
                    {(pacienteInfo.sexo === 'Mujer' || pacienteInfo.edad_calc < 11) && (
                        <h3 style={{ gridColumn: '1 / -1', color: 'var(--inst-orange)', borderBottom: '1px solid #eee', paddingBottom: '5px', marginTop: '10px' }}>🛡️ 2. Promoción y Prevención Específica</h3>
                    )}

                    {pacienteInfo.sexo === 'Mujer' && (
                        <div className="form-group" style={{ gridColumn: '1 / -1', backgroundColor: '#fdf2f8', padding: '10px', borderRadius: '8px', border: '1px solid #fbcfe8' }}>
                            <label style={{ color: '#be185d' }}>🌸 Planificación Familiar (Aplica por ser Mujer)</label>
                            <select value={historia.planificacion_familiar} onChange={e => setHistoria({ ...historia, planificacion_familiar: e.target.value })} required>
                                <option value="">Seleccione...</option>
                                <option value="No aplica (Menor de edad / Menopausia)">No aplica (Menor de edad / Menopausia)</option>
                                <option value="No desea planificar">No desea planificar</option>
                                <option value="Planifica (Método de barrera)">Planifica (Método de barrera)</option>
                                <option value="Planifica (Hormonal / DIU / Implante)">Planifica (Hormonal / DIU / Implante)</option>
                                <option value="Planifica (Definitivo / Pomeroy)">Planifica (Definitivo / Pomeroy)</option>
                            </select>
                        </div>
                    )}

                    {pacienteInfo.edad_calc < 11 && (
                        <div className="form-group" style={{ gridColumn: '1 / -1', backgroundColor: '#f0fdfa', padding: '10px', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                            <label style={{ color: '#0f766e' }}>🧸 Estado de Vacunación (Aplica por ser Menor de 11 años)</label>
                            <select value={historia.estado_vacunacion} onChange={e => setHistoria({ ...historia, estado_vacunacion: e.target.value })} required>
                                <option value="">Seleccione...</option>
                                <option value="Esquema completo para la edad">Esquema completo para la edad</option>
                                <option value="Esquema incompleto">Esquema incompleto</option>
                                <option value="Sin carnet de vacunación / Desconocido">Sin carnet de vacunación / Desconocido</option>
                            </select>
                        </div>
                    )}

                    <h3 style={{ gridColumn: '1 / -1', color: 'var(--inst-orange)', borderBottom: '1px solid #eee', paddingBottom: '5px', marginTop: '10px' }}>🩸 3. Examen Físico (Signos Vitales)</h3>
                    <div className="form-group"><label>🫀 FC (Lat/min)</label><input type="number" value={historia.sv_fc} onChange={e => setHistoria({ ...historia, sv_fc: e.target.value })} required /></div>
                    <div className="form-group"><label>🫁 FR (Resp/min)</label><input type="number" value={historia.sv_fr} onChange={e => setHistoria({ ...historia, sv_fr: e.target.value })} required /></div>
                    <div className="form-group"><label>📈 TA Sistólica (mmHg)</label><input type="number" value={historia.sv_ta_sistolica} onChange={e => setHistoria({ ...historia, sv_ta_sistolica: e.target.value })} required /></div>
                    <div className="form-group"><label>📉 TA Diastólica (mmHg)</label><input type="number" value={historia.sv_ta_diastolica} onChange={e => setHistoria({ ...historia, sv_ta_diastolica: e.target.value })} required /></div>

                    <h3 style={{ gridColumn: '1 / -1', color: 'var(--inst-orange)', borderBottom: '1px solid #eee', paddingBottom: '5px', marginTop: '10px' }}>📋 4. Diagnóstico y Plan</h3>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>🔍 Diagnóstico Principal (CIE-10)</label>
                        <input list="cie10-opciones" value={historia.diagnostico_principal} onChange={e => setHistoria({ ...historia, diagnostico_principal: e.target.value })} required placeholder="Escriba o seleccione un código/enfermedad..." />
                        <datalist id="cie10-opciones">{cie10APS.map((cie, index) => <option key={index} value={cie} />)}</datalist>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>👨‍⚕️ Conducta Médica / Recomendaciones</label><textarea value={historia.conducta_medica} onChange={e => setHistoria({ ...historia, conducta_medica: e.target.value })} rows="3" required></textarea></div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>💊 Medicamentos Prescritos</label><textarea value={historia.medicamentos_prescritos} onChange={e => setHistoria({ ...historia, medicamentos_prescritos: e.target.value })} rows="2" placeholder="Nombre del medicamento, dosis, frecuencia y duración... (Deje en blanco si no hay prescripción)"></textarea></div>

                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '20px' }}>
                        <button type="submit" disabled={guardando} className="btn-save" style={{ padding: '15px 40px', fontSize: '1.2rem' }}>
                            {guardando ? 'Guardando...' : '💾 Firmar y Cerrar Atención'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}