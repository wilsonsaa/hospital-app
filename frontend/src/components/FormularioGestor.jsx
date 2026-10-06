import { useState } from 'react';
import { db } from '../db';

export default function FormularioGestor({ usuario, volver }) {
    const [paso, setPaso] = useState(1);
    const [guardando, setGuardando] = useState(false);

    const getEstiloAlerta = (condicion) => condicion ? { border: '2px solid #ef4444', backgroundColor: '#fef2f2', outline: 'none', color: '#1e293b' } : { backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' };
    const AlertaHelper = ({ condicion, mensaje }) => {
        if (!condicion) return null;
        return <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '4px 0 0 0', fontWeight: 'bold' }}>⚠️ {mensaje}</p>;
    };

    const [form, setForm] = useState({
        tipologia_territorio: 'Urbano', lugar_reunion: '', disciplinas_participantes: '', nombre_jac: '', contacto_jac: '', correo_jac: '', direccion_jac: '',
        participacion_activa: 'Sí', preocupacion_principal: '', num_familias: '', num_casas: '', num_habitantes: '', pob_predominante: '',
        dif_migrante: 'No', dif_adulto_solo: 'No', dif_discapacidad: 'No', dif_indigena: 'NA',
        tipo_vivienda: 'Casa', tenencia_vivienda: 'Propia', estrato: '2', ocupacion_predom: 'Empleo informal',
        locales_comerciales: 'NA', industrias: 'NA', serv_salud_pub: 'NA', serv_colegios: 'NA', prob_inseguridad: 'No', prob_residuos: 'No', prob_spa: 'No', det_inundacion: 'No',
        capacidad_operativa: 'Sí', articulacion_intersectorial: 'No', riesgo_prioritario: '', clasificacion_final: 'Medio'
    });

    const handleChange = (name, value) => { setForm({ ...form, [name]: value }); };

    const guardarCartografia = async () => {
        setGuardando(true);
        try {
            await db.cartografias.add({ id: crypto.randomUUID(), fecha: new Date().toISOString(), gestor_doc: usuario.documento, territorio: usuario.territorio, microterritorio: usuario.microterritorio, datos: form, sincronizado: 0 });
            alert("✅ Cartografía guardada y firmada.");
            volver();
        } catch (error) { alert("❌ Error guardando en la tablet."); }
        setGuardando(false);
    };

    return (
        <div className="card" style={{ maxWidth: '950px', margin: '0 auto', borderTop: '5px solid var(--inst-green)', backgroundColor: '#ffffff', colorScheme: 'light', color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ color: 'var(--inst-green)', margin: 0 }}>📍 Cartografía Social (Gestor Comunitario)</h2>
                <button onClick={volver} className="btn-back" style={{ margin: 0 }}>❌ Cerrar</button>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '5px' }}>
                <button onClick={() => setPaso(1)} style={{ flex: 1, padding: '10px', backgroundColor: paso === 1 ? 'var(--inst-blue)' : '#e2e8f0', color: paso === 1 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>1. Comunidad</button>
                <button onClick={() => setPaso(2)} style={{ flex: 1, padding: '10px', backgroundColor: paso === 2 ? 'var(--inst-orange)' : '#e2e8f0', color: paso === 2 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>2. Determinantes</button>
                <button onClick={() => setPaso(3)} style={{ flex: 1, padding: '10px', backgroundColor: paso === 3 ? 'var(--inst-green)' : '#e2e8f0', color: paso === 3 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>3. Consolidación</button>
            </div>

            <div className="form-grid">
                {paso === 1 && (
                    <>
                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>👥 C1. Datos de Participación</h3>
                        <div className="form-group"><label>Lugar de Reunión</label><input type="text" value={form.lugar_reunion} onChange={e => handleChange('lugar_reunion', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <div className="form-group"><label>Nombre JAC / Líder</label><input type="text" value={form.nombre_jac} onChange={e => handleChange('nombre_jac', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <div className="form-group"><label>Contacto Líder</label><input type="number" value={form.contacto_jac} onChange={e => handleChange('contacto_jac', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <div className="form-group"><label>Preocupación Principal</label><input type="text" value={form.preocupacion_principal} onChange={e => handleChange('preocupacion_principal', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>

                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>📊 C2. Perfil Demográfico</h3>
                        <div className="form-group"><label>Familias aprox.</label><input type="number" value={form.num_familias} onChange={e => handleChange('num_familias', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <div className="form-group"><label>Habitantes aprox.</label><input type="number" value={form.num_habitantes} onChange={e => handleChange('num_habitantes', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <div className="form-group"><label>Población Predominante</label><input type="text" value={form.pob_predominante} onChange={e => handleChange('pob_predominante', e.target.value)} placeholder="Ej: Adultos mayores, niños..." style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <button type="button" onClick={() => setPaso(2)} className="btn-save" style={{ gridColumn: '1 / -1', marginTop: '15px' }}>Siguiente ➡️</button>
                    </>
                )}

                {paso === 2 && (
                    <>
                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>🏙️ C3. Determinantes y Entorno</h3>
                        <div className="form-group"><label>Tenencia de Vivienda Predom.</label><select value={form.tenencia_vivienda} onChange={e => handleChange('tenencia_vivienda', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Propia</option><option>Arriendo</option><option>Invasión</option></select></div>
                        <div className="form-group"><label>Ocupación Predominante</label><input type="text" value={form.ocupacion_predom} onChange={e => handleChange('ocupacion_predom', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <div className="form-group"><label>Industrias Cercanas</label><select value={form.industrias} onChange={e => handleChange('industrias', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>NA</option><option>Sí, presentes</option></select></div>

                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>⚠️ C4. Vulnerabilidades Globales</h3>
                        <div className="form-group">
                            <label>Inseguridad / Violencia</label>
                            <select value={form.prob_inseguridad} onChange={e => handleChange('prob_inseguridad', e.target.value)} style={getEstiloAlerta(form.prob_inseguridad === 'Alta')}>
                                <option>No</option><option>Alta</option>
                            </select>
                            <AlertaHelper condicion={form.prob_inseguridad === 'Alta'} mensaje="Alerta de Inseguridad Crítica" />
                        </div>
                        <div className="form-group">
                            <label>Zonas de Inundación</label>
                            <select value={form.det_inundacion} onChange={e => handleChange('det_inundacion', e.target.value)} style={getEstiloAlerta(form.det_inundacion === 'Sí')}>
                                <option>No</option><option>Sí</option>
                            </select>
                            <AlertaHelper condicion={form.det_inundacion === 'Sí'} mensaje="Alerta de Riesgo Natural" />
                        </div>
                        <button type="button" onClick={() => setPaso(3)} className="btn-save" style={{ gridColumn: '1 / -1', marginTop: '15px' }}>Siguiente ➡️</button>
                    </>
                )}

                {paso === 3 && (
                    <>
                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>🏁 C5. Priorización</h3>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Riesgo Prioritario a Intervenir</label><input type="text" value={form.riesgo_prioritario} onChange={e => handleChange('riesgo_prioritario', e.target.value)} placeholder="¿Cuál es la necesidad más urgente del barrio?" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <div className="form-group">
                            <label>Clasificación Final del Riesgo</label>
                            <select value={form.clasificacion_final} onChange={e => handleChange('clasificacion_final', e.target.value)} style={getEstiloAlerta(form.clasificacion_final === 'Alto' || form.clasificacion_final === 'Crítico')}>
                                <option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option>
                            </select>
                            <AlertaHelper condicion={form.clasificacion_final === 'Alto' || form.clasificacion_final === 'Crítico'} mensaje="Riesgo Comunitario Grave" />
                        </div>
                        <div className="form-group"><label>¿Supera capacidad del equipo APS?</label><select value={form.capacidad_operativa} onChange={e => handleChange('capacidad_operativa', e.target.value)} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Sí</option><option>No</option><option>Parcialmente</option></select></div>

                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '30px', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '2px dashed var(--inst-green)' }}>
                            <button onClick={guardarCartografia} disabled={guardando} className="btn-save" style={{ padding: '15px 40px', fontSize: '1.2rem', backgroundColor: 'var(--inst-green)' }}>{guardando ? 'Sincronizando...' : '💾 Firmar y Finalizar Cartografía'}</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}