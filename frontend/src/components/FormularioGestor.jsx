import { useState } from 'react';
import { db } from '../db';

export default function FormularioGestor({ usuario, volver }) {
    const [paso, setPaso] = useState(1);
    const [guardando, setGuardando] = useState(false);

    // Estado unificado para los 69 campos
    const [form, setForm] = useState({
        tipologia_territorio: 'Urbano', lugar_reunion: '', disciplinas_participantes: '',
        nombre_jac: '', contacto_jac: '', correo_jac: '', direccion_jac: '',
        participacion_activa: 'Sí', preocupacion_principal: '',
        num_familias: '', num_casas: '', num_habitantes: '', pob_predominante: '',
        dif_migrante: 'No', dif_adulto_solo: 'No', dif_discapacidad: 'No', dif_indigena: 'NA',
        tipo_vivienda: 'Casa', tenencia_vivienda: 'Propia', estrato: '2', ocupacion_predom: 'Empleo informal',
        locales_comerciales: 'NA', industrias: 'NA', serv_salud_pub: 'NA', serv_colegios: 'NA',
        prob_inseguridad: 'No', prob_residuos: 'No', prob_spa: 'No', det_inundacion: 'No',
        capacidad_operativa: 'Sí', articulacion_intersectorial: 'No', riesgo_prioritario: '',
        clasificacion_final: 'Medio',
        // Aquí se guardarán las matrices dinámicamente
    });

    const handleChange = (id, val) => setForm({ ...form, [id]: val });

    const guardarCartografia = async () => {
        setGuardando(true);
        try {
            const fecha_hora = new Date().toISOString();
            await db.cartografias.add({
                id: crypto.randomUUID(),
                gestor_doc: usuario.documento,
                territorio: usuario.territorio,
                microterritorio: usuario.microterritorio,
                fecha: fecha_hora,
                datos_cartografia: form,
                sincronizado: 0
            });
            alert("✅ Cartografía Territorial guardada con éxito.");
            volver();
        } catch (error) {
            console.error(error);
            alert("❌ Error al guardar la cartografía.");
        }
        setGuardando(false);
    };

    // 🛠️ REEMPLAZO APLICADO: Motor para renderizar matrices
    const renderMatriz = (id_base, label, icono) => (
        <div className="matriz-grid">
            <strong style={{ color: '#475569' }}>{icono} {label}</strong>
            <div>
                <small style={{ display: 'block', color: '#94a3b8' }}>¿Presente?</small>
                <select value={form[`${id_base}_pre`] || 'No'} onChange={e => handleChange(`${id_base}_pre`, e.target.value)} style={{ width: '100%', padding: '5px' }}><option>Sí</option><option>No</option></select>
            </div>
            <div>
                <small style={{ display: 'block', color: '#94a3b8' }}>Probabilidad</small>
                <select value={form[`${id_base}_prob`] || 'NA'} onChange={e => handleChange(`${id_base}_prob`, e.target.value)} disabled={form[`${id_base}_pre`] === 'No'} style={{ width: '100%', padding: '5px' }}><option>NA</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>
            </div>
            <div>
                <small style={{ display: 'block', color: '#94a3b8' }}>Impacto</small>
                <select value={form[`${id_base}_imp`] || 'NA'} onChange={e => handleChange(`${id_base}_imp`, e.target.value)} disabled={form[`${id_base}_pre`] === 'No'} style={{ width: '100%', padding: '5px' }}><option>NA</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>
            </div>
        </div>
    );

    return (
        <div className="card" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* 🟢 LA TARJETA DE VERIFICACIÓN DE TERRITORIO (Requisito del usuario) */}
            <div style={{ backgroundColor: 'var(--inst-blue)', color: 'white', padding: '20px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 5px 0' }}>🗺️ Cartografía Territorial</h2>
                    <h3 style={{ margin: 0, color: '#bae6fd' }}>📍 Zona a evaluar: {usuario.territorio} ➡️ {usuario.microterritorio}</h3>
                </div>
                <button onClick={volver} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>❌ Cancelar</button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderBottom: '2px solid #e2e8f0', display: 'flex', gap: '15px', color: '#475569' }}>
                <span><strong>👤 Gestor:</strong> {usuario.nombre}</span>
                <span><strong>🪪 Documento:</strong> {usuario.documento}</span>
                <span><strong>📅 Fecha:</strong> {new Date().toLocaleDateString()}</span>
            </div>

            {/* PESTAÑAS DE NAVEGACIÓN */}
            <div style={{ display: 'flex', gap: '5px', padding: '20px 20px 0 20px', overflowX: 'auto' }}>
                <button onClick={() => setPaso(1)} style={{ flex: 1, padding: '10px', backgroundColor: paso === 1 ? 'var(--inst-orange)' : '#e2e8f0', color: paso === 1 ? 'white' : '#64748b', border: 'none', borderRadius: '8px 8px 0 0', fontWeight: 'bold', cursor: 'pointer' }}>📁 1. Perfil</button>
                <button onClick={() => setPaso(2)} style={{ flex: 1, padding: '10px', backgroundColor: paso === 2 ? 'var(--inst-blue)' : '#e2e8f0', color: paso === 2 ? 'white' : '#64748b', border: 'none', borderRadius: '8px 8px 0 0', fontWeight: 'bold', cursor: 'pointer' }}>🏥 2. Comunidad & Servicios</button>
                <button onClick={() => setPaso(3)} style={{ flex: 1, padding: '10px', backgroundColor: paso === 3 ? 'var(--inst-green)' : '#e2e8f0', color: paso === 3 ? 'white' : '#64748b', border: 'none', borderRadius: '8px 8px 0 0', fontWeight: 'bold', cursor: 'pointer' }}>📉 3. Matrices de Riesgo</button>
                <button onClick={() => setPaso(4)} style={{ flex: 1, padding: '10px', backgroundColor: paso === 4 ? '#334155' : '#e2e8f0', color: paso === 4 ? 'white' : '#64748b', border: 'none', borderRadius: '8px 8px 0 0', fontWeight: 'bold', cursor: 'pointer' }}>✅ 4. Cierre</button>
            </div>

            <div style={{ padding: '20px' }}>
                {paso === 1 && (
                    <div className="form-grid">
                        <h3 style={{ gridColumn: '1 / -1', borderBottom: '2px solid #eee' }}>📁 Datos Administrativos y Población</h3>
                        <div className="form-group"><label>🏙️ Tipología</label><select value={form.tipologia_territorio} onChange={e => handleChange('tipologia_territorio', e.target.value)}><option>Urbano</option><option>Rural</option></select></div>
                        <div className="form-group"><label>📍 Lugar de reunión</label><input type="text" value={form.lugar_reunion} onChange={e => handleChange('lugar_reunion', e.target.value)} placeholder="Ej: Caseta comunal" /></div>
                        <div className="form-group"><label>👨‍👩‍👧‍👦 Nº Familias (Aprox)</label><input type="number" value={form.num_familias} onChange={e => handleChange('num_familias', e.target.value)} /></div>
                        <div className="form-group"><label>👥 Nº Habitantes (Aprox)</label><input type="number" value={form.num_habitantes} onChange={e => handleChange('num_habitantes', e.target.value)} /></div>

                        <h3 style={{ gridColumn: '1 / -1', borderBottom: '2px solid #eee', marginTop: '15px' }}>🤝 Contacto Comunitario</h3>
                        <div className="form-group"><label>🗣️ Nombre Presidente(a) JAC</label><input type="text" value={form.nombre_jac} onChange={e => handleChange('nombre_jac', e.target.value)} /></div>
                        <div className="form-group"><label>📱 Teléfono JAC</label><input type="number" value={form.contacto_jac} onChange={e => handleChange('contacto_jac', e.target.value)} /></div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>⚠️ Principal preocupación en salud</label><textarea value={form.preocupacion_principal} onChange={e => handleChange('preocupacion_principal', e.target.value)} rows="2"></textarea></div>
                        <button onClick={() => setPaso(2)} className="btn-save" style={{ gridColumn: '1 / -1' }}>Siguiente ➡️</button>
                    </div>
                )}

                {paso === 2 && (
                    <div className="form-grid">
                        <h3 style={{ gridColumn: '1 / -1', borderBottom: '2px solid #eee' }}>🏘️ Caracterización Social y Servicios</h3>
                        <div className="form-group"><label>🏢 Tipo vivienda predom.</label><select value={form.tipo_vivienda} onChange={e => handleChange('tipo_vivienda', e.target.value)}><option>Casa</option><option>Apartamento</option><option>Invasión</option></select></div>
                        <div className="form-group"><label>💼 Ocupación predom.</label><select value={form.ocupacion_predom} onChange={e => handleChange('ocupacion_predom', e.target.value)}><option>Empleo formal</option><option>Empleo informal</option><option>Agrícola</option></select></div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>🏫 Colegios / Instituciones</label><input type="text" value={form.serv_colegios} onChange={e => handleChange('serv_colegios', e.target.value)} placeholder="Nombres o NA" /></div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>🩺 Centros de Salud Públicos</label><input type="text" value={form.serv_salud_pub} onChange={e => handleChange('serv_salud_pub', e.target.value)} placeholder="Nombres o NA" /></div>

                        <h3 style={{ gridColumn: '1 / -1', borderBottom: '2px solid #eee', marginTop: '15px' }}>🚧 Problemáticas Identificadas</h3>
                        <div className="form-group"><label>🥷 Inseguridad general</label><select value={form.prob_inseguridad} onChange={e => handleChange('prob_inseguridad', e.target.value)}><option>Sí</option><option>No</option></select></div>
                        <div className="form-group"><label>🚬 Consumo SPA</label><select value={form.prob_spa} onChange={e => handleChange('prob_spa', e.target.value)}><option>Sí</option><option>No</option></select></div>
                        <div className="form-group"><label>🗑️ Mal manejo residuos</label><select value={form.prob_residuos} onChange={e => handleChange('prob_residuos', e.target.value)}><option>Sí</option><option>No</option></select></div>
                        <div className="form-group"><label>🌊 Riesgo Inundación</label><select value={form.det_inundacion} onChange={e => handleChange('det_inundacion', e.target.value)}><option>Sí</option><option>No</option></select></div>
                        <button onClick={() => setPaso(3)} className="btn-save" style={{ gridColumn: '1 / -1' }}>Siguiente ➡️</button>
                    </div>
                )}

                {paso === 3 && (
                    <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                        <p style={{ color: '#64748b', marginBottom: '15px' }}>ℹ️ Evalúe la presencia, probabilidad de ocurrencia (1-5) y el impacto (1-5) de los siguientes riesgos en el microterritorio.</p>

                        <h4 style={{ color: 'var(--inst-blue)' }}>🌍 Vulnerabilidad Socioambiental</h4>
                        {renderMatriz('vul_inunda', 'Inundaciones / Deslizamientos', '🌊')}
                        {renderMatriz('vul_contam', 'Contaminación Ambiental', '🏭')}
                        {renderMatriz('vul_hacina', 'Hacinamiento en viviendas', '👨‍👩‍👧‍👦')}
                        {renderMatriz('vul_vectores', 'Presencia de vectores', '🦟')}

                        <h4 style={{ color: 'var(--inst-orange)', marginTop: '20px' }}>💔 Riesgo Social y Exclusión</h4>
                        {renderMatriz('rs_pobreza', 'Pobreza extrema', '🪙')}
                        {renderMatriz('rs_violencia', 'Violencia intrafamiliar / Género', '🤜')}
                        {renderMatriz('rs_desercion', 'Deserción escolar', '🎒')}
                        {renderMatriz('rs_inseg', 'Zonas de alta inseguridad', '🚨')}

                        <button onClick={() => setPaso(4)} className="btn-save" style={{ width: '100%', marginTop: '20px' }}>Siguiente ➡️</button>
                    </div>
                )}

                {paso === 4 && (
                    <div className="form-grid">
                        <h3 style={{ gridColumn: '1 / -1', borderBottom: '2px solid #eee' }}>✅ Priorización y Conclusiones</h3>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>🎯 Riesgo prioritario a intervenir</label>
                            <input type="text" value={form.riesgo_prioritario} onChange={e => handleChange('riesgo_prioritario', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>🚦 Nivel de Riesgo Global</label>
                            <select value={form.clasificacion_final} onChange={e => handleChange('clasificacion_final', e.target.value)} style={{ fontWeight: 'bold', color: form.clasificacion_final === 'Crítico' ? 'red' : 'inherit' }}>
                                <option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>💪 ¿Supera capacidad del equipo?</label>
                            <select value={form.capacidad_operativa} onChange={e => handleChange('capacidad_operativa', e.target.value)}>
                                <option>Sí</option><option>No</option><option>Parcialmente</option>
                            </select>
                        </div>

                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '30px', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '2px dashed var(--inst-green)' }}>
                            <h2 style={{ margin: 0, color: 'var(--inst-green)' }}>💾 Guardar Cartografía</h2>
                            <p style={{ color: '#166534' }}>Se guardará el mapa conceptual del microterritorio <strong>{usuario.microterritorio}</strong>.</p>
                            <button onClick={guardarCartografia} disabled={guardando} className="btn-save" style={{ padding: '15px 40px', fontSize: '1.2rem', backgroundColor: 'var(--inst-green)' }}>
                                {guardando ? 'Sincronizando...' : 'Firmar y Finalizar Cartografía'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}