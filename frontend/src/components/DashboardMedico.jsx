import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export default function DashboardMedico({ usuarioActual, onAbrirHistoria }) {
    const [pestana, setPestana] = useState('poblacion'); // 'pendientes' | 'poblacion' | 'atendidos'
    const [busqueda, setBusqueda] = useState('');
    const jornadasOficiales = useLiveQuery(() => db.jornadas.filter(j => j.estado !== 'Desactivado').toArray(), []);

    // 🚀 SÚPER CONSULTA UNIFICADA: Filtrada por Microterritorio y Profesional
    const datosTablero = useLiveQuery(async () => {
        if (!usuarioActual) return { alertas: [], misAtendidos: [], poblacion: [] };

        // 1. 🚨 ALERTAS PENDIENTES (Solo de su Rol Y de su Microterritorio)
        const al = await db.canalizaciones
            .where('rol_destino').equals(usuarioActual.rol)
            .filter(c =>
                c.estado === 'Pendiente' &&
                c.microterritorio === usuarioActual.microterritorio // <-- Filtro estricto de sector
            )
            .reverse().toArray();

        // 2. 🗂️ MIS ATENDIDOS (Solo las atenciones que este profesional ha firmado Y que no han sido borradas por el Admin)
        const docStr = String(usuarioActual.documento);
        const docNum = Number(usuarioActual.documento);
        let hist = [];

        if (['medico', 'nutricionista', 'fisioterapeuta', 'jefe_enfermeria'].includes(usuarioActual.rol)) {
            hist = await db.form_clinico.where('profesional_doc').equals(docStr)
                .filter(a => a.estado_ficha !== 'Desactivado').toArray(); // 🛡️ ESCUDO ANTI-ZOMBIES
            if (!hist.length) hist = await db.form_clinico.where('profesional_doc').equals(docNum)
                .filter(a => a.estado_ficha !== 'Desactivado').toArray();
        } else if (['psicologia', 'psicosocial'].includes(usuarioActual.rol)) {
            hist = await db.form_psicosocial.where('profesional_doc').equals(docStr)
                .filter(a => a.estado_ficha !== 'Desactivado').toArray(); // 🛡️ ESCUDO ANTI-ZOMBIES
            if (!hist.length) hist = await db.form_psicosocial.where('profesional_doc').equals(docNum)
                .filter(a => a.estado_ficha !== 'Desactivado').toArray();
        }

        // Creamos un mapa de cédulas ya atendidas para excluirlas después
        const atendidosIds = new Set(hist.map(h => String(h.paciente_id)));

        // Le pegamos los datos del paciente al historial
        for (let h of hist) {
            h.datosPaciente = await db.pacientes.get(h.paciente_id) || {};
        }

        // 3. 🌍 POBLACIÓN DEL SECTOR (Solo pacientes de SU microterritorio que NO han sido atendidos por él)
        const poblacionDisponible = await db.pacientes
            .filter(p =>
                p.estado_ficha !== 'Desactivado' &&
                p.microterritorio === usuarioActual.microterritorio && // <-- Filtro estricto de sector
                !atendidosIds.has(String(p.numero_documento))          // <-- Excluye los ya atendidos
            )
            .toArray();

        return {
            alertas: al,
            misAtendidos: hist.reverse(),
            poblacion: poblacionDisponible.reverse()
        };
    }, [usuarioActual]) || { alertas: [], misAtendidos: [], poblacion: [] };

    // Filtro de búsqueda para la población general
    const poblacionFiltrada = datosTablero.poblacion.filter(p => {
        if (!busqueda) return true;
        const term = busqueda.toLowerCase();
        return p.numero_documento.includes(term) ||
            p.primer_nombre.toLowerCase().includes(term) ||
            p.primer_apellido.toLowerCase().includes(term);
    });

    // 🚀 REASIGNAR JORNADA RÁPIDAMENTE
    const actualizarJornada = async (tabla, idAtencion, nuevoJornadaId) => {
        try {
            await db[tabla].update(idAtencion, { jornada_id: nuevoJornadaId, sincronizado: 0 });
            alert("✅ Atención reasignada correctamente.");
        } catch (error) {
            console.error(error);
            alert("❌ Error al actualizar la jornada.");
        }
    };

    return (
        <div className="card" style={{ borderTop: '5px solid var(--inst-blue)', backgroundColor: '#ffffff', color: '#1e293b' }}>

            {/* 🎛️ BOTONERA DE NAVEGACIÓN */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => setPestana('pendientes')} style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: pestana === 'pendientes' ? '#ef4444' : '#fee2e2', color: pestana === 'pendientes' ? 'white' : '#991b1b' }}>
                    🚨 Alertas ({datosTablero.alertas.length})
                </button>
                <button onClick={() => setPestana('poblacion')} style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: pestana === 'poblacion' ? '#10b981' : '#d1fae5', color: pestana === 'poblacion' ? 'white' : '#065f46' }}>
                    🌍 Población ({datosTablero.poblacion.length})
                </button>
                <button onClick={() => setPestana('atendidos')} style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: pestana === 'atendidos' ? 'var(--inst-blue)' : '#e0f2fe', color: pestana === 'atendidos' ? 'white' : '#0369a1' }}>
                    🗂️ Mis Atendidos ({datosTablero.misAtendidos.length})
                </button>
                <button onClick={() => setPestana('jornadas')} style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: pestana === 'jornadas' ? '#8b5cf6' : '#ede9fe', color: pestana === 'jornadas' ? 'white' : '#5b21b6' }}>
                    🏷️ Corregir Jornadas
                </button>
            </div>

            {/* 🚨 VISTA 1: ALERTAS */}
            {pestana === 'pendientes' && (
                <div>
                    {datosTablero.alertas.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No hay alertas de canalización pendientes para tu perfil. 🎉</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                            {datosTablero.alertas.map(alerta => (
                                <div key={alerta.id} style={{ border: '1px solid #fca5a5', backgroundColor: '#fef2f2', padding: '15px', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 5px 0', color: '#991b1b' }}>👤 {alerta.nombre_paciente}</h4>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong>CC:</strong> {alerta.paciente_id}</p>
                                    <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#7f1d1d' }}><strong>Motivo:</strong> {alerta.observaciones}</p>
                                    <button onClick={() => onAbrirHistoria({ ...alerta, origen: 'alerta', rol_destino: usuarioActual.rol })} style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        🩺 Iniciar Atención
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 🌍 VISTA 2: POBLACIÓN DEL SECTOR (Los que aún NO atiende) */}
            {pestana === 'poblacion' && (
                <div>
                    <input
                        type="text"
                        placeholder="🔍 Buscar paciente por cédula o nombre..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        style={{ padding: '12px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '20px', boxSizing: 'border-box' }}
                    />

                    {poblacionFiltrada.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No se encontraron pacientes disponibles con esa búsqueda.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                            {poblacionFiltrada.map(pac => (
                                <div key={pac.numero_documento} style={{ border: '1px solid #a7f3d0', backgroundColor: '#ecfdf5', padding: '15px', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 5px 0', color: '#065f46' }}>👤 {pac.primer_nombre} {pac.primer_apellido}</h4>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: '#047857' }}><strong>CC:</strong> {pac.numero_documento}</p>
                                    <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#047857' }}>Microterritorio: {pac.microterritorio}</p>
                                    <button onClick={() => onAbrirHistoria({ paciente_id: pac.numero_documento, origen: 'poblacion', rol_destino: usuarioActual.rol, nombre_paciente: `${pac.primer_nombre} ${pac.primer_apellido}` })} style={{ width: '100%', padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        🩺 Atender Paciente
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 🗂️ VISTA 3: ATENDIDOS (Historial de pacientes ya vistos) */}
            {pestana === 'atendidos' && (
                <div>
                    {datosTablero.misAtendidos.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Aún no tienes registros de atenciones en el sistema.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                            {datosTablero.misAtendidos.map(atencion => (
                                <div key={atencion.id_atencion || atencion.id_intervencion} style={{ border: '1px solid #bae6fd', backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 5px 0', color: '#0369a1' }}>👤 {atencion.datosPaciente?.primer_nombre} {atencion.datosPaciente?.primer_apellido}</h4>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem' }}><strong>CC:</strong> {atencion.paciente_id}</p>
                                    <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#075985' }}>Fecha: {new Date(atencion.fecha_creacion || Date.now()).toLocaleDateString()}</p>
                                    <button onClick={() => onAbrirHistoria({ ...atencion, origen: 'historial', rol_destino: usuarioActual.rol })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--inst-blue)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        ✏️ Editar Atención
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 🏷️ VISTA 4: CORRECCIÓN DE JORNADAS */}
            {pestana === 'jornadas' && (
                <div>
                    <div style={{ backgroundColor: '#f3e8ff', border: '1px dashed #a855f7', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#7e22ce' }}>Auditoría de Jornadas Extramurales</h4>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b21a8' }}>Revise sus atenciones. Si alguna pertenece a una jornada especial y no está marcada, asígnela desde el menú desplegable.</p>
                    </div>

                    {datosTablero.misAtendidos.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b' }}>No tiene atenciones para auditar.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                            {datosTablero.misAtendidos.map(atencion => {
                                const tablaDestino = ['psicologia', 'psicosocial'].includes(usuarioActual.rol) ? 'form_psicosocial' : 'form_clinico';
                                const pk = atencion.id_atencion || atencion.id_intervencion;

                                return (
                                    <div key={pk} style={{ border: '1px solid #d8b4fe', backgroundColor: '#faf5ff', padding: '15px', borderRadius: '8px' }}>
                                        <h4 style={{ margin: '0 0 5px 0', color: '#6b21a8' }}>👤 {atencion.datosPaciente?.primer_nombre} {atencion.datosPaciente?.primer_apellido}</h4>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#7e22ce' }}>Fecha: {new Date(atencion.fecha_creacion || Date.now()).toLocaleDateString()}</p>

                                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#5b21b6' }}>Jornada / Tipo de Atención:</label>
                                        <select
                                            value={atencion.jornada_id || ""}
                                            onChange={(e) => actualizarJornada(tablaDestino, pk, e.target.value)}
                                            style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #c084fc', borderRadius: '4px', backgroundColor: 'white' }}
                                        >
                                            <option value="">🏠 Atención Regular (Ruta / Hospital)</option>
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