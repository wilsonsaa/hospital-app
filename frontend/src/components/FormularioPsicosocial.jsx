import { useState } from 'react';
import { db } from '../db';

export default function FormularioPsicosocial({ usuario, tarea, volver }) {
    const [guardando, setGuardando] = useState(false);
    const [intervencion, setIntervencion] = useState({
        alertas_violencia: 'Ninguna',
        riesgo_desescolarizacion: 'No',
        activacion_comite: [],
        red_apoyo_efectiva: '',
        acuerdos_plan_cuidado: ''
    });

    const manejarComites = (e) => {
        const { value, checked } = e.target;
        if (checked) {
            setIntervencion({ ...intervencion, activacion_comite: [...intervencion.activacion_comite, value] });
        } else {
            setIntervencion({ ...intervencion, activacion_comite: intervencion.activacion_comite.filter(c => c !== value) });
        }
    };

    const guardarIntervencion = async (e) => {
        e.preventDefault();
        setGuardando(true);

        try {
            const fecha_hora = new Date().toISOString();

            // 1. Guardamos la intervención psicosocial
            await db.form_psicosocial.add({
                id_intervencion: crypto.randomUUID(),
                paciente_id: tarea.paciente_id,
                profesional_doc: usuario.documento,
                fecha: fecha_hora,
                datos_psicosociales: intervencion,
                sincronizado: 0
            });

            // 2. ACTUALIZAMOS EL TICKET (Canalización) a "Atendido"
            await db.canalizaciones.update(tarea.id, {
                estado: 'Atendido',
                fecha_atencion: fecha_hora,
                profesional_atendio: usuario.nombre
            });

            alert("✅ Intervención psicosocial registrada con éxito.");
            volver(); // Devolvemos al profesional a su bandeja
        } catch (error) {
            console.error(error);
            alert("❌ Error guardando la intervención.");
        }
        setGuardando(false);
    };

    // ... (Mantén toda la parte superior igual desde el import hasta la función guardarIntervencion)

    return (
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '3px solid var(--inst-green)', paddingBottom: '10px' }}>
                <h2 style={{ color: 'var(--inst-green)', margin: 0 }}>🧠 Intervención Psicosocial APS</h2>
                <button type="button" onClick={volver} className="btn-back" style={{ margin: 0 }}>⬅ Volver a la Bandeja</button>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><strong style={{ color: '#166534' }}>👨‍👩‍👧‍👦 Familia / Paciente:</strong> {tarea.nombre_paciente}</div>
                <div><strong style={{ color: '#166534' }}>🪪 Documento:</strong> {tarea.paciente_id}</div>
                <div><strong style={{ color: '#166534' }}>🚨 Alerta de Triage:</strong> <span style={{ color: '#b91c1c', fontWeight: 'bold', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>{tarea.motivo}</span></div>
                <div><strong style={{ color: '#166534' }}>📅 Fecha de reporte:</strong> {new Date(tarea.fecha_creacion).toLocaleDateString()}</div>
            </div>

            <form onSubmit={guardarIntervencion} className="form-grid">
                <h3 style={{ gridColumn: '1 / -1', color: 'var(--inst-blue)' }}>🏠 1. Valoración Dinámica Familiar</h3>

                <div className="form-group">
                    <label>⚠️ ¿Indicios de Violencia Intrafamiliar?</label>
                    <select value={intervencion.alertas_violencia} onChange={e => setIntervencion({ ...intervencion, alertas_violencia: e.target.value })} required>
                        <option value="Ninguna">Ninguna</option>
                        <option value="Física">Física</option>
                        <option value="Psicológica">Psicológica</option>
                        <option value="Sexual">Sexual</option>
                        <option value="Económica">Económica</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>🎒 Riesgo de Desescolarización (Niños/Jóvenes)</label>
                    <select value={intervencion.riesgo_desescolarizacion} onChange={e => setIntervencion({ ...intervencion, riesgo_desescolarizacion: e.target.value })} required>
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                    </select>
                </div>

                <h3 style={{ gridColumn: '1 / -1', color: 'var(--inst-blue)', marginTop: '10px' }}>🏛️ 2. Articulación Institucional y Comunitaria</h3>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>📞 Requiere reporte / Activación de Comités (Seleccione varias si aplica)</label>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        <label><input type="checkbox" value="ICBF" onChange={manejarComites} /> 🟢 ICBF</label>
                        <label><input type="checkbox" value="Comisaría de Familia" onChange={manejarComites} /> 🔵 Comisaría de Familia</label>
                        <label><input type="checkbox" value="Justicia Transicional" onChange={manejarComites} /> ⚖️ Justicia Transicional</label>
                        <label><input type="checkbox" value="Secretaría de Educación" onChange={manejarComites} /> 🏫 Secretaría de Educación</label>
                        <label><input type="checkbox" value="Ninguna" onChange={manejarComites} /> ✔️ Ninguna</label>
                    </div>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>🤝 Redes de Apoyo Efectivas Identificadas</label>
                    <textarea value={intervencion.red_apoyo_efectiva} onChange={e => setIntervencion({ ...intervencion, red_apoyo_efectiva: e.target.value })} rows="2" placeholder="Ej: Apoyo de vecinos, asiste a la parroquia, líder comunal..."></textarea>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>📝 Acuerdos Logrados / Plan de Cuidado Familiar</label>
                    <textarea value={intervencion.acuerdos_plan_cuidado} onChange={e => setIntervencion({ ...intervencion, acuerdos_plan_cuidado: e.target.value })} rows="4" required placeholder="Detalle los compromisos que asume el hogar y el profesional..."></textarea>
                </div>

                <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '20px' }}>
                    <button type="submit" disabled={guardando} className="btn-save" style={{ padding: '15px 40px', fontSize: '1.2rem', backgroundColor: 'var(--inst-green)' }}>
                        {guardando ? 'Guardando...' : '🤝 Firmar y Cerrar Intervención'}
                    </button>
                </div>
            </form>
        </div>
    );
}