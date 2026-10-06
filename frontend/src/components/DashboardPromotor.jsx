import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import FormularioPromotor from './FormularioPromotor';

export default function DashboardPromotor({ usuarioActual }) {
    const [fichaAbierta, setFichaAbierta] = useState(null);
    const [creandoNueva, setCreandoNueva] = useState(false);

    // CONTROLADOR DE VISTAS 
    const [vista, setVista] = useState('inicio'); // 'inicio' | 'pendientes' | 'directorio' | 'duplicados' | 'jornadas'
    const [busqueda, setBusqueda] = useState('');

    const jornadasOficiales = useLiveQuery(() => db.jornadas.filter(j => j.estado !== 'Desactivado').toArray(), []);

    // MIS ATENDIDOS (Para Auditoría de Jornadas por Aux. Enfermería)
    const misAtendidos = useLiveQuery(async () => {
        if (!usuarioActual) return [];
        const docStr = String(usuarioActual.documento);
        const docNum = Number(usuarioActual.documento);
        let hist = await db.form_clinico.where('profesional_doc').equals(docStr).filter(a => a.estado_ficha !== 'Desactivado').toArray();
        if (!hist.length) hist = await db.form_clinico.where('profesional_doc').equals(docNum).filter(a => a.estado_ficha !== 'Desactivado').toArray();

        for (let h of hist) {
            h.datosPaciente = await db.pacientes.get(h.paciente_id) || {};
        }
        return hist.reverse();
    }, [usuarioActual]) || [];

    const actualizarJornadaEnfermeria = async (idAtencion, nuevoJornadaId) => {
        try {
            await db.form_clinico.update(idAtencion, { jornada_id: nuevoJornadaId, sincronizado: 0 });
            alert("✅ Registro de enfermería reasignado a la jornada correctamente.");
        } catch (error) {
            console.error(error);
            alert("❌ Error al actualizar la jornada.");
        }
    };

    // 1. CONSULTA: Fichas Pendientes
    const fichasPendientes = useLiveQuery(async () => {
        if (!usuarioActual) return [];
        return await db.hogares
            .where('promotor_doc').equals(usuarioActual.documento)
            .filter(h => h.estado_ficha === 'Pendiente de actualización')
            .reverse().toArray();
    }, [usuarioActual]);

    // 2. CONSULTA: Directorio Total
    const directorioTotal = useLiveQuery(async () => {
        if (!usuarioActual) return [];
        const hogares = await db.hogares.where('promotor_doc').equals(usuarioActual.documento).reverse().toArray();
        for (let h of hogares) {
            h.pacientes = await db.pacientes.where('hogar_id').equals(h.id).filter(p => p.estado_ficha !== 'Desactivado').toArray();
        }
        return hogares;
    }, [usuarioActual]);

    // 🚀 3. CONSULTA NUEVA: Detectar Duplicados Exactos
    const pacientesDuplicados = useLiveQuery(async () => {
        const todosPacientes = await db.pacientes.toArray();
        const conteo = {};

        todosPacientes.forEach(p => {
            // Solo analizamos los que están activos
            if (p.estado_ficha !== 'Desactivado') {
                if (!conteo[p.numero_documento]) conteo[p.numero_documento] = [];
                conteo[p.numero_documento].push(p);
            }
        });

        // Retornamos solo los grupos que tengan más de 1 registro con el mismo documento
        return Object.values(conteo).filter(grupo => grupo.length > 1);
    }, []);

    // Motor de búsqueda
    const hogaresFiltrados = (directorioTotal || []).filter(h => {
        if (!busqueda) return true;
        const term = busqueda.toLowerCase();
        const coincideDireccion = h.datos?.direccion?.toLowerCase().includes(term);
        const coincidePaciente = h.pacientes?.some(p =>
            p.numero_documento.includes(term) || p.primer_nombre.toLowerCase().includes(term) || p.primer_apellido.toLowerCase().includes(term)
        );
        return coincideDireccion || coincidePaciente;
    });

    // Abrir formulario
    const retomarFicha = async (hogar, forzarEdicion = false) => {
        const pacientes = await db.pacientes.where('hogar_id').equals(hogar.id).filter(p => p.estado_ficha !== 'Desactivado').toArray();
        setFichaAbierta({ hogarExistente: hogar, pacientesExistentes: pacientes, forzarEdicion });
        setCreandoNueva(false);
    };

    const cerrarFormulario = () => {
        setFichaAbierta(null);
        setCreandoNueva(false);
        setBusqueda('');
    };

    // 🚀 FUNCIÓN PARA ELIMINAR LOS CLONES
    const unificarRegistros = async (idAConservar, idsADesactivar) => {
        if (window.confirm("¿Está seguro de conservar este registro? Los demás clones serán marcados como 'Desactivado' y ya no aparecerán en las búsquedas ni reportes.")) {
            try {
                for (let id of idsADesactivar) {
                    await db.pacientes.update(id, { estado_ficha: 'Desactivado', sincronizado: 0 });
                }
                alert("✅ Registro unificado correctamente. La base de datos ha sido limpiada.");
            } catch (error) {
                alert("❌ Error unificando los registros.");
            }
        }
    };

    if (creandoNueva || fichaAbierta) {
        return (
            <div className="p-6">
                <FormularioPromotor usuario={usuarioActual} volver={cerrarFormulario} hogarExistente={fichaAbierta?.hogarExistente} pacientesExistentes={fichaAbierta?.pacientesExistentes} forzarEdicion={fichaAbierta?.forzarEdicion} />
            </div>
        );
    }

    return (
        <div className="p-6" style={{ maxWidth: '1100px', margin: '0 auto', color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ color: 'var(--inst-blue)', margin: '0 0 5px 0' }}>👋 Hola, {usuarioActual?.nombre}</h2>
                    <p style={{ margin: 0, color: '#64748b' }}>📍 {usuarioActual?.territorio} | {usuarioActual?.microterritorio}</p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setCreandoNueva(true)} style={{ backgroundColor: 'var(--inst-green)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>📝 Crear Nueva Ficha</button>
                    {/* Botón condicional que se pone rojo si hay duplicados */}
                    {pacientesDuplicados && pacientesDuplicados.length > 0 && (
                        <button onClick={() => { setVista('duplicados'); setBusqueda(''); }} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', animation: 'pulse 2s infinite' }}>
                            🚨 Duplicados ({pacientesDuplicados.length})
                        </button>
                    )}
                    <button
                        onClick={() => { setVista(vista === 'jornadas' ? 'inicio' : 'jornadas'); setBusqueda(''); }}
                        style={{
                            backgroundColor: vista === 'jornadas' ? '#0284c7' : '#e0f2fe',
                            color: vista === 'jornadas' ? 'white' : '#0369a1',
                            border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
                        }}>
                        🏷️ Asignar Jornadas
                    </button>
                </div>
            </div>

            {/* BUSCADOR PRINCIPAL */}
            {vista !== 'duplicados' && vista !== 'jornadas' && (
                <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#0369a1' }}>🔍 Buscar Paciente o Ficha Histórica</h3>
                    <input type="text" placeholder="Escriba la cédula, nombre o dirección para buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ padding: '15px', width: '100%', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '1.1rem', boxSizing: 'border-box' }} />
                </div>
            )}

            {/* VISTA 1: DUPLICADOS (NUEVO MÓDULO) */}
            {vista === 'duplicados' && (
                <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fda4af', padding: '20px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #fecdd3', paddingBottom: '10px', marginBottom: '20px' }}>
                        <h3 style={{ color: '#9f1239', margin: 0 }}>🚨 Limpieza de Registros Duplicados</h3>
                        <button onClick={() => setVista('inicio')} style={{ backgroundColor: '#e11d48', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer' }}>Volver al Inicio</button>
                    </div>

                    <p style={{ color: '#881337', marginBottom: '20px' }}>El sistema ha detectado pacientes ingresados más de una vez. Seleccione el registro correcto para conservarlo; los demás serán desactivados y ya no estorbarán.</p>

                    {pacientesDuplicados.map((grupo, idx) => (
                        <div key={idx} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>📄 Cédula: {grupo[0].numero_documento}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {grupo.map(paciente => (
                                    <div key={paciente.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 'bold', color: '#334155' }}>👤 {paciente.primer_nombre} {paciente.primer_apellido}</p>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Creado el: {new Date(paciente.fecha_creacion).toLocaleDateString()} | Estado: {paciente.estado_ficha}</p>
                                        </div>
                                        <button onClick={() => unificarRegistros(paciente.id, grupo.map(p => p.id).filter(id => id !== paciente.id))} style={{ backgroundColor: '#059669', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            ✅ Conservar este
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* VISTA 2: FICHAS PENDIENTES */}
            {!busqueda && vista !== 'duplicados' && vista !== 'jornadas' && fichasPendientes && fichasPendientes.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#92400e', borderBottom: '2px solid #fde68a', paddingBottom: '10px' }}>⏳ Fichas Pendientes por Actualizar</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px', marginTop: '15px' }}>
                        {fichasPendientes.map(ficha => (
                            <div key={ficha.id} style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', padding: '20px', borderRadius: '8px', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '1.5rem', background: 'white', borderRadius: '50%' }}>⚠️</div>
                                <h4 style={{ margin: '0 0 5px 0', color: '#92400e' }}>🏠 Dir: {ficha.datos?.direccion || 'Sin dirección'}</h4>
                                <button onClick={() => retomarFicha(ficha, false)} style={{ width: '100%', backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>✏️ Entrar a Completar</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VISTA 3: DIRECTORIO MAESTRO (Resultados de Búsqueda) */}
            {vista !== 'duplicados' && vista !== 'jornadas' && (
                <div>
                    <h3 style={{ color: '#0369a1', borderBottom: '2px solid #bae6fd', paddingBottom: '10px' }}>
                        {busqueda ? '🔎 Resultados de la Búsqueda' : '🗂️ Últimas Fichas Registradas'}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                        {hogaresFiltrados.map(hogar => (
                            <div key={hogar.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>🏠 {hogar.datos?.direccion} ({hogar.datos?.barrio_vereda})</h4>
                                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: hogar.estado_ficha === 'Pendiente de actualización' ? '#fef08a' : '#bbf7d0', color: hogar.estado_ficha === 'Pendiente de actualización' ? '#854d0e' : '#166534' }}>{hogar.estado_ficha || 'Completa'}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                        <strong>Integrantes:</strong> {hogar.pacientes?.map(p => `${p.primer_nombre} ${p.primer_apellido} (${p.numero_documento})`).join(' - ')}
                                    </p>
                                </div>
                                <button onClick={() => retomarFicha(hogar, true)} style={{ backgroundColor: 'var(--inst-blue)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '15px' }}>✏️ Editar</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VISTA 4: CORRECCIÓN DE JORNADAS */}
            {vista === 'jornadas' && (
                <div>
                    <div style={{ backgroundColor: '#e0f2fe', border: '1px dashed #38bdf8', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#0369a1' }}>Corrección de Jornadas - Enfermería</h4>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#075985' }}>Seleccione la jornada institucional correspondiente para cada paciente atendido en brigada o extramural.</p>
                    </div>

                    {misAtendidos.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b' }}>No hay registros disponibles para auditar.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                            {misAtendidos.map(atencion => {
                                const pk = atencion.id_atencion || atencion.id;
                                return (
                                    <div key={pk} style={{ border: '1px solid #bae6fd', backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px' }}>
                                        <h4 style={{ margin: '0 0 5px 0', color: '#0369a1' }}>👤 {atencion.datosPaciente?.primer_nombre} {atencion.datosPaciente?.primer_apellido}</h4>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#075985' }}>Fecha: {new Date(atencion.fecha_creacion || Date.now()).toLocaleDateString()}</p>

                                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0369a1' }}>Jornada Asignada:</label>
                                        <select
                                            value={atencion.jornada_id || ""}
                                            onChange={(e) => actualizarJornadaEnfermeria(pk, e.target.value)}
                                            style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #7dd3fc', borderRadius: '4px', backgroundColor: 'white' }}
                                        >
                                            <option value="">🏠 Atención Regular (Institucional)</option>
                                            {jornadasOficiales?.map(jor => (
                                                <option key={jor.id} value={jor.id}>🏕️ {jor.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}