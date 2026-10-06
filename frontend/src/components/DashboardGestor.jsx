import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import * as XLSX from 'xlsx';

export default function DashboardGestor({ usuarioActual, onNuevaCartografia }) {
    const [vista, setVista] = useState('menu');
    const [guardando, setGuardando] = useState(false);
    const [exportando, setExportando] = useState(false);

    // ============================================================================
    // 🚀 LÓGICA DE EXPORTACIÓN MASIVA (EXCEL PARA GESTOR)
    // ============================================================================
    const exportarTrabajoGestor = async () => {
        setExportando(true);
        try {
            const wb = XLSX.utils.book_new();

            // 1. Recopilar y formatear Canalizaciones
            const misCanalizaciones = await db.canalizaciones.where('gestor_doc').equals(String(usuarioActual.documento)).toArray();
            if (misCanalizaciones.length > 0) {
                const dataCanalizaciones = misCanalizaciones.map(c => ({
                    "Fecha Creación": new Date(c.fecha_creacion).toLocaleDateString(),
                    "Documento Paciente": c.paciente_id,
                    "Nombre Paciente": c.nombre_paciente,
                    "EPS / Aseguradora": c.eps_paciente || 'No registrada',
                    "Microterritorio": c.microterritorio,
                    "Entidad Destino": c.rol_destino,
                    "Servicio Solicitado": c.servicio_solicitado,
                    "Estado de la Ruta": c.estado,
                    "Observaciones": c.observaciones
                }));
                const wsCanal = XLSX.utils.json_to_sheet(dataCanalizaciones);
                XLSX.utils.book_append_sheet(wb, wsCanal, "Rutas de Canalización");
            }

            // 2. Recopilar y formatear Cartografías Sociales
            const misCartografias = await db.cartografias.where('gestor_doc').equals(String(usuarioActual.documento)).toArray();
            if (misCartografias.length > 0) {
                const dataCartografias = misCartografias.map(c => ({
                    "Fecha Cartografía": new Date(c.fecha).toLocaleDateString(),
                    "Microterritorio": c.microterritorio,
                    "Lugar de Reunión": c.datos.lugar_reunion,
                    "Líder Comunitario / JAC": c.datos.nombre_jac,
                    "Contacto JAC": c.datos.contacto_jac,
                    "Participación Activa": c.datos.participacion_activa,
                    "Preocupación Principal": c.datos.preocupacion_principal,
                    "Población Predominante": c.datos.pob_predominante,
                    "Riesgo Prioritario": c.datos.riesgo_prioritario,
                    "Clasificación Final": c.datos.clasificacion_final
                }));
                const wsCarto = XLSX.utils.json_to_sheet(dataCartografias);
                XLSX.utils.book_append_sheet(wb, wsCarto, "Cartografías Sociales");
            }

            if (misCanalizaciones.length === 0 && misCartografias.length === 0) {
                alert("⚠️ No tienes registros de canalizaciones ni cartografías para exportar.");
                setExportando(false);
                return;
            }

            XLSX.writeFile(wb, `Productividad_Gestor_${usuarioActual.documento}.xlsx`);
        } catch (error) {
            console.error(error);
            alert("❌ Error generando el archivo Excel. Por favor verifique la base de datos.");
        }
        setExportando(false);
    };

    // ============================================================================
    // 🗺️ ESTADOS: CARTOGRAFÍA SOCIAL
    // ============================================================================
    const [formCarto, setFormCarto] = useState({
        tipologia_territorio: 'Urbano', lugar_reunion: '', disciplinas_participantes: '', nombre_jac: '', contacto_jac: '', correo_jac: '', direccion_jac: '',
        participacion_activa: 'Sí', preocupacion_principal: '', num_familias: '', num_casas: '', num_habitantes: '', pob_predominante: '',
        dif_migrante: 'No', dif_adulto_solo: 'No', dif_discapacidad: 'No', dif_indigena: 'NA',
        tipo_vivienda: 'Casa', tenencia_vivienda: 'Propia', estrato: '2', ocupacion_predom: 'Empleo informal',
        locales_comerciales: 'NA', industrias: 'NA', serv_salud_pub: 'NA', serv_colegios: 'NA', prob_inseguridad: 'No', prob_residuos: 'No', prob_spa: 'No', det_inundacion: 'No',
        capacidad_operativa: 'Sí', articulacion_intersectorial: 'No', riesgo_prioritario: '', clasificacion_final: 'Medio'
    });

    const getEstiloAlerta = (condicion) => condicion ? { border: '2px solid #ef4444', backgroundColor: '#fef2f2', outline: 'none', color: '#1e293b' } : { backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' };
    const handleCartoChange = (name, value) => setFormCarto({ ...formCarto, [name]: value });

    const guardarCartografia = async () => {
        setGuardando(true);
        try {
            await db.cartografias.add({ id: crypto.randomUUID(), fecha: new Date().toISOString(), gestor_doc: String(usuarioActual.documento), territorio: usuarioActual.territorio, microterritorio: usuarioActual.microterritorio, datos: formCarto, sincronizado: 0 });
            alert("✅ Cartografía guardada y firmada.");
            setVista('menu');
        } catch (error) { alert("❌ Error guardando la cartografía."); }
        setGuardando(false);
    };

    // ============================================================================
    // 🚨 ESTADOS Y LÓGICA: MINI-CARACTERIZACIÓN Y CANALIZACIÓN
    // ============================================================================
    const [docBusqueda, setDocBusqueda] = useState('');
    const [pacienteExiste, setPacienteExiste] = useState(false);
    const [correosDestino, setCorreosDestino] = useState([]);
    const [archivosCanal, setArchivosCanal] = useState([]);

    const [formCanal, setFormCanal] = useState({
        primer_nombre: '', primer_apellido: '', telefono1: '', telefono2: '', correo: '', direccion: '',
        eps: 'No aplica', ips_primaria_hospital: 'No', servicio_canalizado: '', observaciones: ''
    });

    const buscarParaCanalizar = async (e) => {
        e.preventDefault();
        const p = await db.pacientes.get(String(docBusqueda)) || await db.pacientes.get(Number(docBusqueda));
        if (p) {
            setPacienteExiste(true);
            setFormCanal({
                ...formCanal,
                primer_nombre: p.primer_nombre,
                primer_apellido: p.primer_apellido,
                telefono1: p.datos?.telefono || '',
                direccion: p.datos?.direccion || '',
                eps: p.datos?.nombre_eps || 'No aplica',
                ips_primaria_hospital: p.datos?.ips_primaria_hospital || 'No'
            });
            alert("✅ Paciente encontrado. Se han autocompletado sus datos.");
        } else {
            setPacienteExiste(false);
            setFormCanal({ primer_nombre: '', primer_apellido: '', telefono1: '', telefono2: '', correo: '', direccion: '', eps: 'No aplica', ips_primaria_hospital: 'No', servicio_canalizado: '', observaciones: '' });
            alert("⚠️ Paciente no encontrado. Puede realizar la caracterización rápida a continuación para activar la ruta.");
        }
    };

    // 🚀 MOTOR LÓGICO DE CORREOS INTELIGENTE
    useEffect(() => {
        const calcularDestinatarios = async () => {
            const correosArray = await db.config_correos.toArray();
            let destinatarios = [];

            // 1. Siempre incluir la copia a Salud Pública
            const saludPublica = correosArray.find(c => c.cargo === 'SALUD PÚBLICA');
            if (saludPublica) destinatarios.push(saludPublica);

            // 2. Verificar si es Población No Asegurada (Sin EPS)
            const epsLimpia = (formCanal.eps || '').toUpperCase().trim();
            const esNoAsegurado = ["NO APLICA", "NINGUNA", "SIN EPS", "NO TIENE", "NO REGISTRADA", "NO TIENE EPS"].includes(epsLimpia);

            if (esNoAsegurado) {
                // Inyectar visualmente Aseguramiento
                destinatarios.push({
                    eps: 'SECRETARÍA DE SALUD',
                    cargo: 'ÁREA DE ASEGURAMIENTO',
                    correo: 'areadeaseguramiento@mosquera-cundinamarca.gov.co',
                    tipo_copia: 'Principal'
                });
            } else if (formCanal.ips_primaria_hospital === 'Sí') {
                // Va para el Hospital María Auxiliadora
                const hospital = correosArray.find(c => c.cargo === 'IPS PRIMARIA');
                if (hospital) destinatarios.push(hospital);
            } else {
                // Va para la EPS correspondiente
                const correosEps = correosArray.filter(c => c.eps.toUpperCase() === epsLimpia);
                destinatarios = [...destinatarios, ...correosEps];
            }

            setCorreosDestino(destinatarios);
        };
        calcularDestinatarios();
    }, [formCanal.ips_primaria_hospital, formCanal.eps]);

    const procesarArchivosCanal = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) return alert(`El archivo supera los 5MB.`);
            const reader = new FileReader();
            reader.onloadend = () => setArchivosCanal(prev => [...prev, { id: crypto.randomUUID(), nombre: file.name, tipo: file.type, datosBase64: reader.result }]);
            reader.readAsDataURL(file);
        });
    };

    const guardarCanalizacion = async (e) => {
        e.preventDefault();
        setGuardando(true);
        const id_canalizacion = crypto.randomUUID();
        const fecha_actual = new Date().toISOString();

        const epsLimpia = (formCanal.eps || '').toUpperCase().trim();
        const esNoAsegurado = ["NO APLICA", "NINGUNA", "SIN EPS", "NO TIENE", "NO REGISTRADA", "NO TIENE EPS"].includes(epsLimpia);

        try {
            if (!pacienteExiste) {
                await db.pacientes.add({
                    numero_documento: docBusqueda,
                    microterritorio: usuarioActual.microterritorio,
                    jornada_id: usuarioActual.jornada_id || null,
                    primer_nombre: formCanal.primer_nombre,
                    primer_apellido: formCanal.primer_apellido,
                    estado_ficha: 'Caracterización Gestor',
                    fecha_creacion: fecha_actual,
                    datos: {
                        telefono: formCanal.telefono1,
                        telefono2: formCanal.telefono2,
                        correo: formCanal.correo,
                        direccion: formCanal.direccion,
                        nombre_eps: formCanal.eps,
                        ips_primaria_hospital: esNoAsegurado ? 'No aplica' : formCanal.ips_primaria_hospital
                    },
                    sincronizado: 0
                });
            }

            const listaCorreos = correosDestino.map(c => c.correo);

            // Definir rol de destino dinámico
            let destinoFinal = 'EPS';
            if (esNoAsegurado) destinoFinal = 'Aseguramiento';
            else if (formCanal.ips_primaria_hospital === 'Sí') destinoFinal = 'Hospital';

            // 1. Guardar localmente
            await db.canalizaciones.add({
                id: id_canalizacion,
                fecha_creacion: fecha_actual,
                gestor_doc: String(usuarioActual.documento),
                paciente_id: docBusqueda,
                nombre_paciente: `${formCanal.primer_nombre} ${formCanal.primer_apellido}`,
                eps_paciente: formCanal.eps,
                microterritorio: usuarioActual.microterritorio,
                rol_destino: destinoFinal,
                servicio_solicitado: esNoAsegurado ? 'Afiliación / Aseguramiento' : formCanal.servicio_canalizado,
                estado: 'Pendiente',
                observaciones: formCanal.observaciones,
                correos_notificados: listaCorreos.join(', '),
                anexos: archivosCanal,
                sincronizado: 0
            });

            // 2. Disparar al Backend
            const response = await fetch('/api/enviar-canalizacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paciente_id: docBusqueda,
                    nombre_paciente: `${formCanal.primer_nombre} ${formCanal.primer_apellido}`,
                    telefono1: formCanal.telefono1,
                    telefono2: formCanal.telefono2,
                    direccion: formCanal.direccion,
                    microterritorio: usuarioActual.microterritorio,
                    eps: formCanal.eps,
                    ips_primaria_hospital: esNoAsegurado ? 'No' : formCanal.ips_primaria_hospital,
                    servicio_canalizado: esNoAsegurado ? 'Afiliación / Aseguramiento' : formCanal.servicio_canalizado,
                    observaciones: formCanal.observaciones,
                    correos_destinatarios: listaCorreos,
                    anexos: archivosCanal,
                    nombre_gestor: usuarioActual.nombre
                })
            });

            if (response.ok) {
                alert("✅ Ruta registrada y correo despachado exitosamente.");
            } else {
                alert("⚠️ Ruta guardada localmente, pero hubo fallo al disparar el correo.");
            }

            setVista('menu');
            setDocBusqueda('');
            setFormCanal({ primer_nombre: '', primer_apellido: '', telefono1: '', telefono2: '', correo: '', direccion: '', eps: '', ips_primaria_hospital: 'No', servicio_canalizado: '', observaciones: '' });
            setArchivosCanal([]);
        } catch (error) {
            console.error(error);
            alert("❌ Error registrando la canalización.");
        }
        setGuardando(false);
    };

    // ============================================================================
    // 📊 LÓGICA: REPORTES Y SEGUIMIENTO
    // ============================================================================
    const misCanalizaciones = useLiveQuery(() => db.canalizaciones.where('gestor_doc').equals(String(usuarioActual.documento)).reverse().toArray(), [usuarioActual]);
    const actualizarEstadoCanalizacion = async (id, nuevoEstado) => {
        try { await db.canalizaciones.update(id, { estado: nuevoEstado, sincronizado: 0 }); alert(`Estado actualizado a: ${nuevoEstado}`); }
        catch (error) { alert("Error al actualizar el estado."); }
    };

    return (
        <div className="p-6" style={{ maxWidth: '1000px', margin: '0 auto', color: '#1e293b' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div>
                    <h2 style={{ color: 'var(--inst-blue)', margin: '0 0 5px 0' }}>👋 Hola Gestor, {usuarioActual?.nombre}</h2>
                    <p style={{ margin: 0, color: '#64748b' }}>📍 {usuarioActual?.territorio} | {usuarioActual?.microterritorio}</p>
                </div>
                {vista !== 'menu' && (
                    <button onClick={() => setVista('menu')} className="btn-back" style={{ margin: 0 }}>⬅ Menú Principal</button>
                )}
            </div>

            {vista === 'menu' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <div onClick={() => { if (onNuevaCartografia) onNuevaCartografia(); setVista('cartografia'); }} style={{ backgroundColor: '#ffffff', borderTop: '6px solid var(--inst-blue)', padding: '30px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}>
                        <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0' }}>🗺️</h1>
                        <h2 style={{ color: 'var(--inst-blue)', margin: 0 }}>CARTOGRAFÍA</h2>
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Registro de líderes, vulnerabilidades y priorización.</p>
                    </div>

                    <div style={{ backgroundColor: '#f0fdf4', borderTop: '6px solid var(--inst-green)', padding: '30px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0' }}>🤝</h1>
                        <h2 style={{ color: 'var(--inst-green)', margin: '0 0 15px 0' }}>MÓDULO GESTORES</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={() => setVista('canalizacion')} style={{ backgroundColor: 'var(--inst-green)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}>
                                🚨 Activar Canalización EPS / IPS
                            </button>
                            <button onClick={() => setVista('reportes')} style={{ backgroundColor: '#166534', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}>
                                📊 Seguimiento y Reportes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VISTA 1: CARTOGRAFÍA SOCIAL */}
            {vista === 'cartografia' && (
                <div className="card" style={{ borderTop: '5px solid var(--inst-blue)', backgroundColor: '#ffffff' }}>
                    <h2 style={{ color: 'var(--inst-blue)', marginBottom: '15px' }}>📍 Nueva Cartografía Social</h2>

                    <div className="form-grid">
                        <div className="form-group"><label>Lugar de Reunión</label><input type="text" value={formCarto.lugar_reunion} onChange={e => handleCartoChange('lugar_reunion', e.target.value)} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                        <div className="form-group"><label>Nombre Pte. JAC / Líder</label><input type="text" value={formCarto.nombre_jac} onChange={e => handleCartoChange('nombre_jac', e.target.value)} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                        <div className="form-group"><label>Contacto JAC</label><input type="number" value={formCarto.contacto_jac} onChange={e => handleCartoChange('contacto_jac', e.target.value)} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Preocupación Principal Comunidad</label><textarea value={formCarto.preocupacion_principal} onChange={e => handleCartoChange('preocupacion_principal', e.target.value)} rows="3" required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }}></textarea></div>
                    </div>

                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '30px' }}>
                        <button onClick={guardarCartografia} disabled={guardando} className="btn-save" style={{ padding: '15px 40px', fontSize: '1.2rem', backgroundColor: 'var(--inst-blue)' }}>{guardando ? 'Guardando...' : '💾 Firmar y Finalizar Cartografía'}</button>
                    </div>
                </div>
            )}

            {/* 🖥️ VISTA 2: MINI-CARACTERIZACIÓN Y CANALIZACIÓN CON LISTA LIMPIA */}
            {vista === 'canalizacion' && (
                <div className="card" style={{ borderTop: '5px solid var(--inst-orange)', backgroundColor: '#ffffff' }}>
                    <h2 style={{ color: 'var(--inst-orange)', marginBottom: '15px' }}>🚨 Activar Ruta de Canalización y Correo</h2>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>Busque al ciudadano. Si no existe, complete los datos básicos para activar la ruta y disparar el correo automático.</p>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <input type="number" placeholder="Número de Documento" value={docBusqueda} onChange={(e) => setDocBusqueda(e.target.value)} required style={{ flex: 1, padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                        <button type="button" onClick={buscarParaCanalizar} className="btn-save" style={{ backgroundColor: 'var(--inst-orange)', margin: 0 }}>🔍 Buscar Paciente</button>
                    </div>

                    {docBusqueda !== '' && (
                        <form onSubmit={guardarCanalizacion} style={{ backgroundColor: '#fff7ed', padding: '20px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                            <h3 style={{ color: '#9a3412', borderBottom: '1px solid #fdba74', paddingBottom: '5px', marginTop: 0 }}>👤 Datos del Ciudadano</h3>
                            <div className="form-grid">
                                <div className="form-group"><label>Nombres</label><input type="text" value={formCanal.primer_nombre} onChange={e => setFormCanal({ ...formCanal, primer_nombre: e.target.value })} readOnly={pacienteExiste} required style={{ backgroundColor: pacienteExiste ? '#e2e8f0' : '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                                <div className="form-group"><label>Apellidos</label><input type="text" value={formCanal.primer_apellido} onChange={e => setFormCanal({ ...formCanal, primer_apellido: e.target.value })} readOnly={pacienteExiste} required style={{ backgroundColor: pacienteExiste ? '#e2e8f0' : '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                                <div className="form-group"><label>Teléfono Principal</label><input type="number" value={formCanal.telefono1} onChange={e => setFormCanal({ ...formCanal, telefono1: e.target.value })} required style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                                <div className="form-group"><label>Teléfono Secundario (Opcional)</label><input type="number" value={formCanal.telefono2} onChange={e => setFormCanal({ ...formCanal, telefono2: e.target.value })} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                                <div className="form-group"><label>Correo Electrónico (Opcional)</label><input type="email" value={formCanal.correo} onChange={e => setFormCanal({ ...formCanal, correo: e.target.value })} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                                <div className="form-group"><label>Dirección de Residencia</label><input type="text" value={formCanal.direccion} onChange={e => setFormCanal({ ...formCanal, direccion: e.target.value })} required style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} /></div>
                            </div>

                            <h3 style={{ color: '#9a3412', borderBottom: '1px solid #fdba74', paddingBottom: '5px', marginTop: '20px' }}>🏥 Direccionamiento de Ruta</h3>

                            {/* Variable para condicionar la vista */}
                            {(() => {
                                const epsLimpia = (formCanal.eps || '').toUpperCase().trim();
                                const esNoAsegurado = ["NO APLICA", "NINGUNA", "SIN EPS", "NO TIENE", "NO REGISTRADA", "NO TIENE EPS"].includes(epsLimpia);

                                return (
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>EPS del Paciente</label>
                                            <select value={formCanal.eps} onChange={e => setFormCanal({ ...formCanal, eps: e.target.value })} required style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }}>
                                                <option value="">-- Seleccione EPS --</option>
                                                <option value="NO TIENE EPS">⚠️ NO TIENE EPS (Población No Asegurada)</option>
                                                <option value="SANITAS">SANITAS</option>
                                                <option value="COMPENSAR">COMPENSAR</option>
                                                <option value="SALUD TOTAL">SALUD TOTAL</option>
                                                <option value="FAMISANAR">FAMISANAR</option>
                                                <option value="NUEVA EPS">NUEVA EPS</option>
                                            </select>
                                        </div>

                                        {/* Solo mostramos la pregunta de IPS y servicio si SÍ tiene EPS */}
                                        {!esNoAsegurado ? (
                                            <>
                                                <div className="form-group">
                                                    <label>¿IPS Primaria es el Hospital de Mosquera?</label>
                                                    <select value={formCanal.ips_primaria_hospital} onChange={e => setFormCanal({ ...formCanal, ips_primaria_hospital: e.target.value })} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }}>
                                                        <option value="No">No (Gestiona EPS)</option>
                                                        <option value="Sí">Sí (E.S.E. María Auxiliadora)</option>
                                                    </select>
                                                </div>
                                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                                    <label>Servicio al que va canalizado</label>
                                                    <input type="text" value={formCanal.servicio_canalizado} onChange={e => setFormCanal({ ...formCanal, servicio_canalizado: e.target.value })} placeholder="Ej: Medicina General, Psicología, Citología..." required style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} />
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ gridColumn: '1/-1', backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe', padding: '15px', borderRadius: '8px' }}>
                                                <p style={{ margin: 0, color: '#6b21a8', fontWeight: 'bold' }}>🛡️ Ruta de Aseguramiento Activada</p>
                                                <p style={{ margin: '5px 0 0 0', color: '#7e22ce', fontSize: '0.9rem' }}>El caso será escalado automáticamente a la Secretaría de Salud para gestión de cobertura.</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '6px', border: '1px dashed #fdba74', marginTop: '15px' }}>
                                <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#431407' }}><strong>📧 Destinatarios automáticos detectados:</strong></p>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#ea580c' }}>
                                    {correosDestino.length > 0 ? correosDestino.map((c, i) => <li key={i}><strong>{c.eps}</strong> - {c.cargo} ({c.correo})</li>) : <li>Seleccione los parámetros...</li>}
                                </ul>
                            </div>

                            <div className="form-group" style={{ marginTop: '15px' }}>
                                <label>📝 Observaciones y Justificación de la Alerta</label>
                                <textarea value={formCanal.observaciones} onChange={e => setFormCanal({ ...formCanal, observaciones: e.target.value })} rows="3" required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}></textarea>
                            </div>

                            <div className="form-group" style={{ marginTop: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>📎 Anexos (Historia Clínica, RIPS, Consentimiento)</label>
                                <input type="file" multiple onChange={procesarArchivosCanal} style={{ display: 'block', marginBottom: '10px' }} />
                                {archivosCanal.map((a, i) => <span key={i} style={{ display: 'block', fontSize: '0.8rem', color: 'var(--inst-blue)' }}>✅ {a.nombre}</span>)}
                            </div>

                            <button type="submit" disabled={guardando} className="btn-save" style={{ width: '100%', marginTop: '20px', backgroundColor: '#ea580c', padding: '15px', fontSize: '1.1rem' }}>
                                {guardando ? 'Enviando Alerta...' : '🚀 Registrar Canalización y Enviar Correo'}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* VISTA 3: REPORTES Y SEGUIMIENTO */}
            {vista === 'reportes' && (
                <div className="card" style={{ borderTop: '5px solid var(--inst-green)', backgroundColor: '#ffffff' }}>

                    {/* 🚀 BOTÓN DE EXPORTACIÓN */}
                    <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '25px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#166534' }}>📥 Descargar Productividad</h3>
                        <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#15803d' }}>
                            Exporte a Excel todas sus Cartografías Sociales y Rutas de Canalización activadas.
                        </p>
                        <button
                            onClick={exportarTrabajoGestor}
                            disabled={exportando}
                            style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: exportando ? 'wait' : 'pointer', fontSize: '1rem' }}
                        >
                            {exportando ? 'Generando Archivo Excel...' : '📊 Descargar Mis Reportes'}
                        </button>
                    </div>

                    <h2 style={{ color: 'var(--inst-green)', marginBottom: '15px' }}>📋 Seguimiento de Canalizaciones</h2>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 15px' }}>Fecha</th>
                                    <th style={{ padding: '12px 15px' }}>Paciente</th>
                                    <th style={{ padding: '12px 15px' }}>Eps/IPS</th>
                                    <th style={{ padding: '12px 15px' }}>Servicio</th>
                                    <th style={{ padding: '12px 15px' }}>Estado</th>
                                    <th style={{ padding: '12px 15px' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {misCanalizaciones?.map(c => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '12px 15px' }}>{new Date(c.fecha_creacion).toLocaleDateString()}</td>
                                        <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>{c.nombre_paciente}</td>
                                        <td style={{ padding: '12px 15px' }}>{c.rol_destino === 'Hospital' ? 'Hosp. Mosquera' : c.eps_paciente}</td>
                                        <td style={{ padding: '12px 15px' }}>{c.servicio_solicitado}</td>
                                        <td style={{ padding: '12px 15px' }}>
                                            <span style={{
                                                backgroundColor: c.estado === 'Pendiente' ? '#fee2e2' : c.estado === 'En Trámite' ? '#fef3c7' : '#dcfce3',
                                                color: c.estado === 'Pendiente' ? '#991b1b' : c.estado === 'En Trámite' ? '#9a3412' : '#166534',
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold'
                                            }}>
                                                {c.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 15px' }}>
                                            <select value={c.estado} onChange={(e) => actualizarEstadoCanalizacion(c.id, e.target.value)} style={{ padding: '5px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                                                <option>Pendiente</option>
                                                <option>En Trámite</option>
                                                <option>Atendido/Resuelto</option>
                                                <option>No Contactado</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!misCanalizaciones?.length && <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No tienes canalizaciones registradas aún.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}