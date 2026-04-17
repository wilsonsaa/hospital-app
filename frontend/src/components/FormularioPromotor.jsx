import { useState, useEffect } from 'react'
import { db } from '../db'

export default function FormularioPromotor({ usuario, volver }) {
    const [pasoForm, setPasoForm] = useState(1);
    const [guardando, setGuardando] = useState(false);

    // 1. ESTADO DE LA VIVIENDA (Alineado al 100% con el Documento Word)
    const estadoInicialHogar = {
        departamento: 'Cundinamarca', municipio: 'Mosquera', territorio_zona: '', barrio_vereda: '', direccion: '', estrato: '2', telefono_hogar: '', gps: '',
        tipo_vivienda: 'Casa', material_paredes: 'Bloque/Ladrillo', material_pisos: 'Cemento', cuartos_dormir: '1',
        fuente_agua: 'Acueducto', disp_excretas: 'Sanitario conectado al alcantarillado', aguas_residuales: 'Alcantarillado',
        disp_basuras: 'Recolección', energia_cocina: 'Gas natural', riesgos_vivienda: 'Ninguno',
        tipo_familia: 'Nuclear', apgar_familiar: 'Normal', cuidador_prin: 'No', escala_zarit: 'Ausencia', seg_alimentaria: 'Compra', vic_conflicto: 'No'
    };

    const [hogar, setHogar] = useState(() => { const b = localStorage.getItem('draft_hogar'); return b ? JSON.parse(b) : estadoInicialHogar; });
    const [integrantes, setIntegrantes] = useState(() => { const b = localStorage.getItem('draft_integrantes'); return b ? JSON.parse(b) : []; });

    // 2. ESTADO DEL INTEGRANTE (Alineado al Word + AIEPI)
    const [integ, setInteg] = useState({
        primer_nombre: '', primer_apellido: '', tipo_doc: 'CC', num_doc: '', fecha_nacim: '', sexo: 'Mujer', regimen_salud: 'Subsidiado',
        peso_kg: '', talla_cm: '', perim_braquial: '', esquema_vacunas: 'Sí', vacunas_covid: '0', gestante: 'No',
        enfermedad_cronica: '', tratamiento_actual: 'No', asiste_mantenimiento: 'Sí', motivo_no_atencion: 'NA',
        // MÓDULO LABORAL
        ocupacion_actual: '', clase_riesgo: 'I', accidente_trabajo: 'No',
        // MÓDULO AIEPI (< 5 AÑOS)
        aiepi_prematuro: 'No', aiepi_beber: 'Sí', aiepi_vomita: 'No', aiepi_convulsiones: 'No', aiepi_letargico: 'No',
        aiepi_tos: 'No', aiepi_tirajes: 'No', aiepi_diarrea: 'No', aiepi_sangre_heces: 'No', aiepi_deshidratacion: 'No',
        aiepi_fiebre: 'No', aiepi_dengue: 'No', aiepi_palidez: 'No', aiepi_lactancia: 'Sí', aiepi_maltrato: 'No',
        aiepi_riesgo_hogar: 'No', aiepi_cyd: 'Sí', aiepi_salud_oral: 'Sí'
    });

    useEffect(() => { localStorage.setItem('draft_hogar', JSON.stringify(hogar)); }, [hogar]);
    useEffect(() => { localStorage.setItem('draft_integrantes', JSON.stringify(integrantes)); }, [integrantes]);

    const [edadCalc, setEdadCalc] = useState(0);
    useEffect(() => {
        if (integ.fecha_nacim) {
            const diff = new Date() - new Date(integ.fecha_nacim);
            setEdadCalc(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
        } else { setEdadCalc(0); }
    }, [integ.fecha_nacim]);

    const capturarGPS = () => {
        if (!navigator.geolocation) return alert("Dispositivo sin GPS.");
        setHogar({ ...hogar, gps: "Obteniendo..." });
        navigator.geolocation.getCurrentPosition(
            (pos) => setHogar({ ...hogar, gps: `${pos.coords.latitude}, ${pos.coords.longitude}` }),
            () => { alert("Error GPS. Active permisos."); setHogar({ ...hogar, gps: "Fallo" }); }, { enableHighAccuracy: true }
        );
    };

    const limpiarBorrador = () => {
        if (window.confirm("⚠️ ¿Eliminar todo el progreso de esta familia?")) {
            setHogar(estadoInicialHogar); setIntegrantes([]);
            localStorage.removeItem('draft_hogar'); localStorage.removeItem('draft_integrantes');
            setPasoForm(1);
        }
    };

    const agregarIntegrante = (e) => {
        e.preventDefault();
        if (integrantes.find(i => i.num_doc === integ.num_doc)) return alert("El documento ya fue agregado.");
        setIntegrantes([...integrantes, { ...integ, edad_calc: edadCalc, id_interno: crypto.randomUUID() }]);
        // Limpiar campos para el siguiente, dejando los selectores por defecto
        setInteg({ ...integ, num_doc: '', primer_nombre: '', primer_apellido: '', fecha_nacim: '', enfermedad_cronica: '' });
        alert("✅ Familiar agregado. Puede añadir otro o ir a Finalizar.");
    };

    const eliminarIntegrante = (id) => setIntegrantes(integrantes.filter(i => i.id_interno !== id));

    // 3. EL MOTOR DE TRIAGE (Con inteligencia AIEPI)
    const procesarFormularioCompleto = async () => {
        if (!hogar.direccion || integrantes.length === 0) return alert("Falta la dirección o añadir familiares.");
        setGuardando(true);
        const ficha_id = crypto.randomUUID();
        const fecha_hora = new Date().toISOString();

        try {
            await db.hogares.add({ id: ficha_id, fecha: fecha_hora, promotor_doc: usuario.documento, territorio: usuario.territorio, microterritorio: usuario.microterritorio, datos: hogar, sincronizado: 0 });

            for (const persona of integrantes) {
                await db.pacientes.add({ numero_documento: persona.num_doc, hogar_id: ficha_id, microterritorio: usuario.microterritorio, primer_nombre: persona.primer_nombre, primer_apellido: persona.primer_apellido, datos: persona, sincronizado: 0 });

                let requiereMedico = false, requierePsico = false;
                let motivosMedico = [], motivosPsico = [];

                // REGLAS GENERALES MÉDICAS
                if (persona.gestante === 'Sí') { requiereMedico = true; motivosMedico.push("Gestante"); }
                if (persona.esquema_vacunas === 'No') { requiereMedico = true; motivosMedico.push("Faltan Vacunas"); }
                if (persona.enfermedad_cronica && persona.enfermedad_cronica !== 'Ninguna') { requiereMedico = true; motivosMedico.push(`Crónico (${persona.tratamiento_actual === 'No' ? 'Sin Tratam.' : 'En Tratam.'})`); }
                if (persona.asiste_mantenimiento === 'No') { requiereMedico = true; motivosMedico.push("Inasistencia Promoción/Mantenimiento"); }

                // REGLAS AIEPI (< 5 AÑOS) - PRIORIDAD ALTA
                if (persona.edad_calc < 5) {
                    if (persona.aiepi_beber === 'No' || persona.aiepi_vomita === 'Sí' || persona.aiepi_convulsiones === 'Sí' || persona.aiepi_letargico === 'Sí' || persona.aiepi_tirajes === 'Sí' || persona.aiepi_deshidratacion === 'Sí' || parseFloat(persona.perim_braquial) < 11.5) {
                        requiereMedico = true; motivosMedico.push("🚨 AIEPI: RIESGO INMINENTE / DESNUTRICIÓN");
                    } else if (persona.aiepi_fiebre === 'Sí' || persona.aiepi_diarrea === 'Sí' || persona.aiepi_tos === 'Sí' || persona.aiepi_cyd === 'No') {
                        requiereMedico = true; motivosMedico.push("AIEPI: Prevalente Activa / Sin C&D");
                    }
                    if (persona.aiepi_maltrato === 'Sí' || persona.aiepi_riesgo_hogar === 'Sí') {
                        requierePsico = true; motivosPsico.push("🚨 AIEPI: RIESGO ENTORNO / MALTRATO INFANTIL");
                    }
                }

                // REGLAS PSICOSOCIALES GLOBALES
                if (hogar.apgar_familiar === 'Disfunción severa' || hogar.apgar_familiar === 'Disfunción leve') { requierePsico = true; motivosPsico.push(`APGAR: ${hogar.apgar_familiar}`); }
                if (hogar.vic_conflicto === 'Sí') { requierePsico = true; motivosPsico.push("Víctima Conflicto"); }

                // GENERAR CANALIZACIONES
                if (requiereMedico) await db.canalizaciones.add({ id: crypto.randomUUID(), paciente_id: persona.num_doc, nombre_paciente: `${persona.primer_nombre} ${persona.primer_apellido}`, rol_destino: 'medico', microterritorio: usuario.microterritorio, estado: 'Pendiente', motivo: motivosMedico.join(", "), fecha_creacion: fecha_hora, sincronizado: 0 });
                if (requierePsico) await db.canalizaciones.add({ id: crypto.randomUUID(), paciente_id: persona.num_doc, nombre_paciente: `${persona.primer_nombre} ${persona.primer_apellido}`, rol_destino: 'psicosocial', microterritorio: usuario.microterritorio, estado: 'Pendiente', motivo: motivosPsico.join(", "), fecha_creacion: fecha_hora, sincronizado: 0 });
            }

            localStorage.removeItem('draft_hogar'); localStorage.removeItem('draft_integrantes');
            alert(`✅ Familia guardada. El Triage AIEPI evaluó a los niños automáticamente.`);
            volver();
        } catch (error) { console.error(error); alert("❌ Error guardando en la tablet."); }
        setGuardando(false);
    };

    return (
        <div className="card" style={{ maxWidth: '950px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ color: 'var(--inst-blue)', margin: 0 }}>📋 Ficha de Caracterización APS y AIEPI</h2>
                <div>
                    <button onClick={limpiarBorrador} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginRight: '10px' }}>🗑️ Borrar</button>
                    <button onClick={volver} className="btn-back" style={{ margin: 0 }}>❌ Cerrar</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '5px' }}>
                <button onClick={() => setPasoForm(1)} style={{ flex: 1, padding: '10px', backgroundColor: pasoForm === 1 ? 'var(--inst-orange)' : '#e2e8f0', color: pasoForm === 1 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🏠 1. Entorno</button>
                <button onClick={() => setPasoForm(2)} style={{ flex: 1, padding: '10px', backgroundColor: pasoForm === 2 ? 'var(--inst-blue)' : '#e2e8f0', color: pasoForm === 2 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🫂 2. Familia</button>
                <button onClick={() => setPasoForm(3)} style={{ flex: 1, padding: '10px', backgroundColor: pasoForm === 3 ? 'var(--inst-green)' : '#e2e8f0', color: pasoForm === 3 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>👥 3. Personas ({integrantes.length})</button>
                <button onClick={() => setPasoForm(4)} style={{ flex: 1, padding: '10px', backgroundColor: pasoForm === 4 ? '#334155' : '#e2e8f0', color: pasoForm === 4 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✅ 4. Finalizar</button>
            </div>

            {pasoForm === 1 && (
                <div className="form-grid">
                    <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>📍 B1. Ubicación y Georreferenciación</h3>
                    <div className="form-group"><label>🗺️ Zona</label><select value={hogar.territorio_zona} onChange={e => setHogar({ ...hogar, territorio_zona: e.target.value })}><option value="">Sel...</option><option value="Urbana">Urbana</option><option value="Rural">Rural</option></select></div>
                    <div className="form-group"><label>🏘️ Barrio/Vereda</label><input type="text" value={hogar.barrio_vereda} onChange={e => setHogar({ ...hogar, barrio_vereda: e.target.value })} /></div>
                    <div className="form-group"><label>📍 Dirección</label><input type="text" value={hogar.direccion} onChange={e => setHogar({ ...hogar, direccion: e.target.value })} /></div>
                    <div className="form-group"><label>📊 Estrato</label><select value={hogar.estrato} onChange={e => setHogar({ ...hogar, estrato: e.target.value })}><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
                    <div className="form-group"><label>📱 Teléfono Hogar</label><input type="number" value={hogar.telefono_hogar} onChange={e => setHogar({ ...hogar, telefono_hogar: e.target.value })} /></div>
                    <div className="form-group"><label>🛰️ GPS</label><div style={{ display: 'flex', gap: '5px' }}><input type="text" value={hogar.gps} readOnly style={{ flex: 1, backgroundColor: '#f1f5f9' }} /><button type="button" onClick={capturarGPS} style={{ background: 'var(--inst-blue)', color: 'white', border: 'none', borderRadius: '6px' }}>📍</button></div></div>

                    <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>🏚️ B2. Entorno y Saneamiento</h3>
                    <div className="form-group"><label>🏠 Tipo Vivienda</label><select value={hogar.tipo_vivienda} onChange={e => setHogar({ ...hogar, tipo_vivienda: e.target.value })}><option>Casa</option><option>Apartamento</option><option>Inquilinato</option><option>Otro</option></select></div>
                    <div className="form-group"><label>🧱 Material Paredes</label><input type="text" value={hogar.material_paredes} onChange={e => setHogar({ ...hogar, material_paredes: e.target.value })} /></div>
                    <div className="form-group"><label>🦶 Material Pisos</label><input type="text" value={hogar.material_pisos} onChange={e => setHogar({ ...hogar, material_pisos: e.target.value })} /></div>
                    <div className="form-group"><label>🛏️ Cuartos Dormir</label><input type="number" value={hogar.cuartos_dormir} onChange={e => setHogar({ ...hogar, cuartos_dormir: e.target.value })} /></div>
                    <div className="form-group"><label>🔥 Energía Cocina</label><select value={hogar.energia_cocina} onChange={e => setHogar({ ...hogar, energia_cocina: e.target.value })}><option>Electricidad</option><option>Gas natural</option><option>Leña/Otro</option></select></div>
                    <div className="form-group"><label>⚠️ Riesgos de accidentes (Hogar)</label><select value={hogar.riesgos_vivienda} onChange={e => setHogar({ ...hogar, riesgos_vivienda: e.target.value })}><option>Ninguno</option><option>Sí, presentes</option></select></div>

                    <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>💧 B3. Agua y Saneamiento</h3>
                    <div className="form-group"><label>🚰 Fuente Agua</label><select value={hogar.fuente_agua} onChange={e => setHogar({ ...hogar, fuente_agua: e.target.value })}><option>Acueducto</option><option>Pozo</option><option>Otro</option></select></div>
                    <div className="form-group"><label>🚽 Disp. Excretas</label><select value={hogar.disp_excretas} onChange={e => setHogar({ ...hogar, disp_excretas: e.target.value })}><option>Sanitario conectado al alcantarillado</option><option>Letrina / Otro</option></select></div>
                    <div className="form-group"><label>☢️ Aguas Residuales</label><select value={hogar.aguas_residuales} onChange={e => setHogar({ ...hogar, aguas_residuales: e.target.value })}><option>Alcantarillado</option><option>Otro</option></select></div>
                    <div className="form-group"><label>🗑️ Disp. Basuras</label><select value={hogar.disp_basuras} onChange={e => setHogar({ ...hogar, disp_basuras: e.target.value })}><option>Recolección</option><option>Quema / Entierro</option></select></div>

                    <button type="button" onClick={() => setPasoForm(2)} className="btn-save" style={{ gridColumn: '1 / -1', marginTop: '15px' }}>Siguiente ➡️</button>
                </div>
            )}

            {pasoForm === 2 && (
                <div className="form-grid">
                    <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>👨‍👩‍👧‍👦 B4. Dinámica Familiar</h3>
                    <div className="form-group"><label>🧩 Tipo Familia</label><select value={hogar.tipo_familia} onChange={e => setHogar({ ...hogar, tipo_familia: e.target.value })}><option>Nuclear biparental</option><option>Nuclear monoparental</option><option>Extenso biparental</option><option>Extenso monoparental</option><option>Unipersonal</option></select></div>
                    <div className="form-group"><label>⚖️ APGAR Familiar</label><select value={hogar.apgar_familiar} onChange={e => setHogar({ ...hogar, apgar_familiar: e.target.value })}><option>Normal</option><option>Disfunción leve</option><option>Disfunción severa</option></select></div>
                    <div className="form-group"><label>🫂 ¿Hay Cuidador Principal?</label><select value={hogar.cuidador_prin} onChange={e => setHogar({ ...hogar, cuidador_prin: e.target.value })}><option>No</option><option>Sí</option></select></div>
                    {hogar.cuidador_prin === 'Sí' && <div className="form-group"><label>🔋 ZARIT (Sobrecarga Cuidador)</label><select value={hogar.escala_zarit} onChange={e => setHogar({ ...hogar, escala_zarit: e.target.value })}><option>Ausencia</option><option>Leve</option><option>Intensa</option></select></div>}
                    <div className="form-group"><label>🕊️ ¿Familia Víctima Conflicto?</label><select value={hogar.vic_conflicto} onChange={e => setHogar({ ...hogar, vic_conflicto: e.target.value })}><option>No</option><option>Sí</option></select></div>
                    <div className="form-group"><label>🍲 ¿Cómo obtienen alimentos?</label><select value={hogar.seg_alimentaria} onChange={e => setHogar({ ...hogar, seg_alimentaria: e.target.value })}><option>Compra</option><option>Cultiva</option><option>Otro</option></select></div>

                    <button type="button" onClick={() => setPasoForm(3)} className="btn-save" style={{ gridColumn: '1 / -1', marginTop: '15px' }}>Siguiente ➡️</button>
                </div>
            )}

            {pasoForm === 3 && (
                <div>
                    {integrantes.length > 0 && (
                        <div style={{ marginBottom: '20px', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: 'var(--inst-green)' }}>✅ Familiares Añadidos ({integrantes.length}):</h4>
                            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                                {integrantes.map(i => (
                                    <li key={i.id_interno} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', padding: '5px 0' }}>
                                        <span>👤 {i.primer_nombre} {i.primer_apellido} | 🪪 {i.num_doc} | 🎂 {i.edad_calc} años</span>
                                        <button type="button" onClick={() => eliminarIntegrante(i.id_interno)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>❌ Quitar</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <form onSubmit={agregarIntegrante} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '2px solid var(--inst-blue)' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--inst-blue)', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px' }}>➕ Identificación del Integrante</h3>
                        <div className="form-grid">
                            <div className="form-group"><label>🪪 Tipo Doc.</label><select value={integ.tipo_doc} onChange={e => setInteg({ ...integ, tipo_doc: e.target.value })} required><option>CC</option><option>TI</option><option>RC</option><option>PPT</option></select></div>
                            <div className="form-group"><label>🔢 Núm. Doc</label><input type="number" value={integ.num_doc} onChange={e => setInteg({ ...integ, num_doc: e.target.value })} required /></div>
                            <div className="form-group"><label>👤 Primer Nombre</label><input type="text" value={integ.primer_nombre} onChange={e => setInteg({ ...integ, primer_nombre: e.target.value })} required /></div>
                            <div className="form-group"><label>👤 Primer Apellido</label><input type="text" value={integ.primer_apellido} onChange={e => setInteg({ ...integ, primer_apellido: e.target.value })} required /></div>
                            <div className="form-group"><label>📅 Fecha Nacim.</label><input type="date" value={integ.fecha_nacim} onChange={e => setInteg({ ...integ, fecha_nacim: e.target.value })} required /></div>
                            <div className="form-group"><label>🎂 Edad Calculada</label><input type="text" value={integ.fecha_nacim ? `${edadCalc} años` : ''} readOnly style={{ backgroundColor: '#e2e8f0', fontWeight: 'bold', color: '#334155' }} /></div>
                            <div className="form-group"><label>🚻 Sexo</label><select value={integ.sexo} onChange={e => setInteg({ ...integ, sexo: e.target.value })} required><option>Hombre</option><option>Mujer</option></select></div>
                            <div className="form-group"><label>🏥 Régimen Salud</label><select value={integ.regimen_salud} onChange={e => setInteg({ ...integ, regimen_salud: e.target.value })}><option>Subsidiado</option><option>Contributivo</option></select></div>

                            <h4 style={{ gridColumn: '1 / -1', borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '15px' }}>🩺 B5. Salud Pública y Necesidades</h4>
                            <div className="form-group"><label>⚖️ Peso (Kg)</label><input type="number" step="0.1" value={integ.peso_kg} onChange={e => setInteg({ ...integ, peso_kg: e.target.value })} /></div>
                            <div className="form-group"><label>📏 Talla (cm)</label><input type="number" step="0.1" value={integ.talla_cm} onChange={e => setInteg({ ...integ, talla_cm: e.target.value })} /></div>
                            <div className="form-group"><label>💉 Esquema Vacunas Edad</label><select value={integ.esquema_vacunas} onChange={e => setInteg({ ...integ, esquema_vacunas: e.target.value })}><option>Sí</option><option>No</option></select></div>
                            <div className="form-group"><label>🦠 Dosis COVID</label><input type="number" value={integ.vacunas_covid} onChange={e => setInteg({ ...integ, vacunas_covid: e.target.value })} placeholder="Ej: 3" /></div>
                            {integ.sexo === 'Mujer' && edadCalc > 10 && <div className="form-group"><label>🤰 ¿Es Gestante?</label><select value={integ.gestante} onChange={e => setInteg({ ...integ, gestante: e.target.value })}><option>No</option><option>Sí</option></select></div>}
                            <div className="form-group"><label>🏃 ¿Asiste a Promo. y Mantenimiento?</label><select value={integ.asiste_mantenimiento} onChange={e => setInteg({ ...integ, asiste_mantenimiento: e.target.value })}><option>Sí</option><option>No</option></select></div>

                            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>🤒 ¿Sufre alguna enfermedad actual?</label><input type="text" value={integ.enfermedad_cronica} onChange={e => setInteg({ ...integ, enfermedad_cronica: e.target.value })} placeholder="Ej: Diabetes, Asma (Deje en blanco si ninguna)" /></div>
                            {integ.enfermedad_cronica && (
                                <>
                                    <div className="form-group"><label>💊 ¿Recibe tratamiento?</label><select value={integ.tratamiento_actual} onChange={e => setInteg({ ...integ, tratamiento_actual: e.target.value })}><option>Sí</option><option>No</option></select></div>
                                    <div className="form-group"><label>🚫 Si NO recibe atención, motivo:</label><select value={integ.motivo_no_atencion} onChange={e => setInteg({ ...integ, motivo_no_atencion: e.target.value })}><option>NA</option><option>Lugar lejano</option><option>Horarios restringidos</option><option>Otro</option></select></div>
                                </>
                            )}

                            {/* ========================================================= */}
                            {/* 🌟 MÓDULO INTELIGENTE AIEPI (Solo aparece en < 5 años) 🌟 */}
                            {/* ========================================================= */}
                            {integ.fecha_nacim && edadCalc < 5 && (
                                <div style={{ gridColumn: '1 / -1', backgroundColor: '#fff7ed', padding: '15px', borderRadius: '8px', border: '2px solid #fdba74', marginTop: '10px' }}>
                                    <h3 style={{ margin: '0 0 15px 0', color: '#c2410c' }}>🧸 MÓDULO AIEPI OBLIGATORIO (Menores de 5 años)</h3>
                                    <div className="form-grid">

                                        {/* 1. Antecedentes y Nutrición */}
                                        <div className="form-group"><label>📏 Perímetro Braquial (cm)</label><input type="number" step="0.1" value={integ.perim_braquial} onChange={e => setInteg({ ...integ, perim_braquial: e.target.value })} required placeholder="Ej: 12.5" /></div>
                                        <div className="form-group"><label>🍼 ¿Fue prematuro / Bajo peso?</label><select value={integ.aiepi_prematuro} onChange={e => setInteg({ ...integ, aiepi_prematuro: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        {edadCalc === 0 && <div className="form-group"><label>🤱 ¿Lactancia exclusiva?</label><select value={integ.aiepi_lactancia} onChange={e => setInteg({ ...integ, aiepi_lactancia: e.target.value })}><option>Sí</option><option>No</option></select></div>}
                                        <div className="form-group"><label>🦷 ¿Valoración C&D / Salud Oral?</label><select value={integ.aiepi_cyd} onChange={e => setInteg({ ...integ, aiepi_cyd: e.target.value })}><option>Sí</option><option>No</option></select></div>

                                        {/* 2. Signos Generales de Peligro (Rojos) */}
                                        <h4 style={{ gridColumn: '1 / -1', color: '#991b1b', margin: '10px 0 5px 0', borderBottom: '1px solid #fca5a5' }}>🚨 Signos de Peligro Inminente</h4>
                                        <div className="form-group"><label>🛑 ¿Puede beber o tomar pecho?</label><select value={integ.aiepi_beber} onChange={e => setInteg({ ...integ, aiepi_beber: e.target.value })}><option>Sí</option><option>No</option></select></div>
                                        <div className="form-group"><label>🛑 ¿Vomita todo lo que ingiere?</label><select value={integ.aiepi_vomita} onChange={e => setInteg({ ...integ, aiepi_vomita: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>🛑 ¿Ha tenido convulsiones?</label><select value={integ.aiepi_convulsiones} onChange={e => setInteg({ ...integ, aiepi_convulsiones: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>🛑 ¿Está letárgico o inconsciente?</label><select value={integ.aiepi_letargico} onChange={e => setInteg({ ...integ, aiepi_letargico: e.target.value })}><option>No</option><option>Sí</option></select></div>

                                        {/* 3. Enfermedades Prevalentes */}
                                        <h4 style={{ gridColumn: '1 / -1', color: '#c2410c', margin: '10px 0 5px 0', borderBottom: '1px solid #fdba74' }}>🤒 Enfermedades Prevalentes</h4>
                                        <div className="form-group"><label>🫁 ¿Dificultad respirar / Tos?</label><select value={integ.aiepi_tos} onChange={e => setInteg({ ...integ, aiepi_tos: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>⚠️ ¿Se hunden costillas (Tiraje)?</label><select value={integ.aiepi_tirajes} onChange={e => setInteg({ ...integ, aiepi_tirajes: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>🚽 ¿Diarrea / Deshidratación?</label><select value={integ.aiepi_diarrea} onChange={e => setInteg({ ...integ, aiepi_diarrea: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>🩸 ¿Sangre en heces?</label><select value={integ.aiepi_sangre_heces} onChange={e => setInteg({ ...integ, aiepi_sangre_heces: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>🌡️ ¿Fiebre alta ({'>'} 38°C)?</label><select value={integ.aiepi_fiebre} onChange={e => setInteg({ ...integ, aiepi_fiebre: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>🦟 ¿Agua sin tapa (Riesgo Dengue)?</label><select value={integ.aiepi_dengue} onChange={e => setInteg({ ...integ, aiepi_dengue: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>🦵 ¿Palidez palmas o edema (pies)?</label><select value={integ.aiepi_palidez} onChange={e => setInteg({ ...integ, aiepi_palidez: e.target.value })}><option>No</option><option>Sí</option></select></div>

                                        {/* 4. Entorno Seguro */}
                                        <h4 style={{ gridColumn: '1 / -1', color: '#c2410c', margin: '10px 0 5px 0', borderBottom: '1px solid #fdba74' }}>🛡️ Salud Mental y Entorno</h4>
                                        <div className="form-group"><label>⚠️ ¿Cicatrices o quemaduras raras?</label><select value={integ.aiepi_maltrato} onChange={e => setInteg({ ...integ, aiepi_maltrato: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        <div className="form-group"><label>🧪 ¿Riesgo intoxicación en casa?</label><select value={integ.aiepi_riesgo_hogar} onChange={e => setInteg({ ...integ, aiepi_riesgo_hogar: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                    </div>
                                </div>
                            )}
                            {/* ==================== FIN AIEPI ====================== */}

                            {edadCalc >= 15 && (
                                <>
                                    <h4 style={{ gridColumn: '1 / -1', borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '15px' }}>💼 B6. Perfil Laboral (Mayores de 15 años)</h4>
                                    <div className="form-group"><label>👷 Ocupación</label><input type="text" value={integ.ocupacion_actual} onChange={e => setInteg({ ...integ, ocupacion_actual: e.target.value })} placeholder="Si no aplica escriba 'Ninguna'" /></div>
                                    {integ.ocupacion_actual.toLowerCase() !== 'ninguna' && integ.ocupacion_actual !== '' && (
                                        <>
                                            <div className="form-group"><label>🛡️ Riesgo ARL</label><select value={integ.clase_riesgo} onChange={e => setInteg({ ...integ, clase_riesgo: e.target.value })}><option>I</option><option>II</option><option>III</option><option>IV</option><option>V</option></select></div>
                                            <div className="form-group"><label>🤕 Accidentes (SST)</label><select value={integ.accidente_trabajo} onChange={e => setInteg({ ...integ, accidente_trabajo: e.target.value })}><option>No</option><option>Sí</option></select></div>
                                        </>
                                    )}
                                </>
                            )}

                            <button type="submit" className="btn-save" style={{ gridColumn: '1 / -1', marginTop: '20px', backgroundColor: 'var(--inst-blue)' }}>💾 AÑADIR A LA FAMILIA</button>
                        </div>
                    </form>
                    <div style={{ textAlign: 'right', marginTop: '15px' }}><button type="button" onClick={() => setPasoForm(4)} className="btn-save" style={{ backgroundColor: '#334155' }}>Ir a Finalizar ➡️</button></div>
                </div>
            )}

            {pasoForm === 4 && (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                    <h2 style={{ color: 'var(--inst-green)' }}>✅ Resumen de Caracterización</h2>
                    <p style={{ fontSize: '1.2rem' }}>Has recopilado el borrador para <strong>{integrantes.length} Integrantes</strong>.</p>
                    <p style={{ color: '#64748b' }}><em>Al guardar, el Triage Clínico y AIEPI evaluará a los integrantes para generar alertas.</em></p>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
                        <button type="button" onClick={() => setPasoForm(3)} className="btn-back" style={{ margin: 0 }}>⬅ Volver</button>
                        <button type="button" onClick={procesarFormularioCompleto} disabled={guardando || integrantes.length === 0} className="btn-save" style={{ margin: 0, padding: '15px 30px', fontSize: '1.1rem' }}>
                            {guardando ? 'Ejecutando Triage...' : '💾 GUARDAR FICHA DEFINITIVA'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}