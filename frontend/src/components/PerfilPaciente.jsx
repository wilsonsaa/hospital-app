import { useState } from 'react';
import { db } from '../db';
import * as XLSX from 'xlsx';

export default function PerfilPaciente({ usuarioActual }) {
    const [documentoBusqueda, setDocumentoBusqueda] = useState('');
    const [cargando, setCargando] = useState(false);
    const [datosTotales, setDatosTotales] = useState(null);
    const [exportando, setExportando] = useState(false);

    // ====================================================================
    // 🚀 LÓGICA DE EXPORTACIÓN MASIVA (INTEGRAL PARA PROFESIONALES)
    // ====================================================================
    const exportarMiTrabajo = async () => {
        setExportando(true);
        try {
            const wb = XLSX.utils.book_new();
            let exportData = [];

            // 🚀 DICCIONARIO TRADUCTOR DE JORNADAS
            const listaJornadas = await db.jornadas.filter(j => j.estado !== 'Desactivado').toArray();
            const mapaJornadas = {};
            listaJornadas.forEach(j => mapaJornadas[j.id] = j.nombre);

            const docStr = String(usuarioActual.documento);
            const docNum = Number(usuarioActual.documento);

            // 🟢 1. SI ES PROMOTOR
            if (usuarioActual.rol === 'promotor') {
                let misHogares = await db.hogares.where('promotor_doc').equals(docStr).toArray();
                if (misHogares.length === 0) {
                    misHogares = await db.hogares.where('promotor_doc').equals(docNum).toArray();
                }

                const idsHogares = misHogares.map(h => h.id);
                const misPacientes = await db.pacientes.filter(p => idsHogares.includes(p.hogar_id)).toArray();

                const pacientesValidos = misPacientes.filter(p =>
                    p.estado_ficha !== 'Pendiente de actualización' &&
                    p.estado_ficha !== 'Borrador'
                );

                if (pacientesValidos.length === 0) {
                    setExportando(false);
                    return alert("⚠️ No se encontraron registros válidos para exportar.");
                }

                exportData = pacientesValidos.map(p => {
                    const hogar = misHogares.find(h => h.id === p.hogar_id) || {};
                    const datosPersona = { ...p.datos };
                    if (Array.isArray(datosPersona.tramites_pendientes)) {
                        datosPersona.tramites_pendientes = datosPersona.tramites_pendientes.join(', ');
                    }

                    return {
                        "Fecha de Cierre": p.fecha_creacion ? new Date(p.fecha_creacion).toLocaleDateString() : 'Dato Histórico',
                        "Estado Ficha": p.estado_ficha || 'Histórico/Migrado',
                        "Microterritorio": p.microterritorio || 'No registrado',
                        "Tipo de Atención": p.jornada_id ? (mapaJornadas[p.jornada_id] || 'Jornada Eliminada/NA') : 'Atención Regular (Ruta/Casa)',
                        "Documento Persona": p.numero_documento,
                        "Nombre Completo Persona": `${p.primer_nombre} ${p.primer_apellido}`,
                        ...hogar.datos,
                        ...datosPersona
                    };
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(wb, ws, "Caracterizaciones");

                // 🔵 2. SI ES UN ROL CLÍNICO O PSICOSOCIAL
            } else if (['medico', 'nutricionista', 'fisioterapeuta', 'psicologia', 'psicosocial', 'jefe_enfermeria'].includes(usuarioActual.rol)) {

                let misAtenciones = [];

                // Determinamos en qué tabla buscar según el rol
                if (['psicologia', 'psicosocial'].includes(usuarioActual.rol)) {
                    misAtenciones = await db.form_psicosocial.where('profesional_doc').equals(docStr).toArray();
                    if (misAtenciones.length === 0) misAtenciones = await db.form_psicosocial.where('profesional_doc').equals(docNum).toArray();
                } else {
                    misAtenciones = await db.form_clinico.where('profesional_doc').equals(docStr).toArray();
                    if (misAtenciones.length === 0) misAtenciones = await db.form_clinico.where('profesional_doc').equals(docNum).toArray();
                }

                // Filtramos borradores
                const atencionesValidas = misAtenciones.filter(a =>
                    a.estado_ficha !== 'Pendiente de actualización' &&
                    a.estado_ficha !== 'Borrador'
                );

                if (atencionesValidas.length === 0) {
                    setExportando(false);
                    return alert("⚠️ No tiene atenciones válidas asociadas a su documento.");
                }

                // Construimos la data fusionando Atención + Paciente + Hogar
                for (let a of atencionesValidas) {
                    // 1. Buscamos al paciente
                    let paciente = await db.pacientes.get(String(a.paciente_id));
                    if (!paciente) paciente = await db.pacientes.get(Number(a.paciente_id));
                    if (!paciente) paciente = {};

                    // 2. Buscamos su hogar para sacar la dirección exacta
                    let hogar = {};
                    if (paciente.hogar_id) {
                        hogar = await db.hogares.get(paciente.hogar_id) || {};
                    }

                    // 3. Limpiamos datos pesados (evita que el Excel se rompa con imágenes o base64)
                    const datosClinicos = { ...a.datos };
                    delete datosClinicos.pruebas_adjuntas;
                    delete datosClinicos.reportes_adjuntos;
                    delete datosClinicos.anexos;

                    const datosPaciente = { ...paciente.datos };
                    if (Array.isArray(datosPaciente.tramites_pendientes)) {
                        datosPaciente.tramites_pendientes = datosPaciente.tramites_pendientes.join(', ');
                    }

                    // 4. Armamos la fila maestra
                    exportData.push({
                        "Fecha Atención": a.fecha_creacion ? new Date(a.fecha_creacion).toLocaleDateString() : 'Dato Histórico',
                        "Especialidad": a.especialidad || usuarioActual.rol.toUpperCase(),
                        "Estado Ficha": a.estado_ficha || 'Histórico',
                        "Tipo de Atención": a.jornada_id ? (mapaJornadas[a.jornada_id] || 'Jornada Eliminada/NA') : 'Atención Regular (Hospital/Ruta)',
                        "Documento Paciente": a.paciente_id,
                        "Nombre Paciente": `${paciente.primer_nombre || 'Paciente'} ${paciente.primer_apellido || 'No Registrado'}`,
                        "Teléfono Contacto": datosPaciente.telefono || datosPaciente.celular || 'No registrado',
                        "Dirección / Ubicación": (hogar.datos && hogar.datos.direccion) ? hogar.datos.direccion : 'No registrada',
                        "Microterritorio": paciente.microterritorio || 'No registrado',
                        ...datosPaciente,   // Inserta todas las variables sociodemográficas del paciente
                        ...datosClinicos    // Inserta todas las respuestas clínicas del profesional
                    });
                }

                const ws = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(wb, ws, "Mis Atenciones Integrales");

            } else {
                setExportando(false);
                return alert("Su perfil no tiene un reporte de atenciones configurado para descarga masiva.");
            }

            XLSX.writeFile(wb, `Data_Integral_${usuarioActual.rol}_${usuarioActual.documento}.xlsx`);
        } catch (error) {
            console.error(error);
            alert("Error generating the Excel file. Por favor verifique la base de datos.");
        }
        setExportando(false);
    };

    // ====================================================================
    // 🔍 LÓGICA DE BÚSQUEDA INDIVIDUAL (VISIÓN 360)
    // ====================================================================
    const buscarPaciente = async (e) => {
        e.preventDefault();
        setCargando(true);
        try {
            const paciente = await db.pacientes.get(String(documentoBusqueda)) || await db.pacientes.get(Number(documentoBusqueda));

            if (!paciente) {
                setDatosTotales(null);
                alert("❌ Paciente no encontrado en la base de datos local.");
                setCargando(false);
                return;
            }

            const hogar = await db.hogares.get(paciente.hogar_id || '') || null;
            const clinico = await db.form_clinico.where('paciente_id').equals(String(documentoBusqueda)).toArray();
            const psicosocial = await db.form_psicosocial.where('paciente_id').equals(String(documentoBusqueda)).toArray();
            const canalizaciones = await db.canalizaciones.where('paciente_id').equals(String(documentoBusqueda)).toArray();

            // 🚀 CREACIÓN DEL DICCIONARIO DE PROFESIONALES
            const listaProfesionales = await db.profesionales.toArray();
            const mapaProfesionales = {};
            listaProfesionales.forEach(prof => {
                mapaProfesionales[String(prof.documento)] = prof.nombre;
            });

            setDatosTotales({ paciente, hogar, clinico, psicosocial, canalizaciones, mapaProfesionales });

        } catch (error) {
            console.error(error);
            alert("Error buscando datos.");
        }
        setCargando(false);
    };

    return (
        <div className="p-6" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>

            {/* 📊 SECCIÓN 1: REPORTE DE PRODUCTIVIDAD (EXPORTADOR MASIVO) */}
            <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '8px', borderTop: '5px solid var(--inst-green)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--inst-green)', margin: '0 0 10px 0' }}>📊 Mis Reportes de Trabajo (RIPS / RIAPS)</h2>
                <p style={{ color: '#64748b', marginBottom: '20px' }}>
                    Descargue el consolidado con <strong>TODA LA DATA</strong> de los ciudadanos que usted ha atendido. <br />
                    <em>Nota: Solo se incluyen fichas finalizadas (Los borradores no suman a la productividad).</em>
                </p>
                <button
                    onClick={exportarMiTrabajo}
                    disabled={exportando}
                    style={{ backgroundColor: 'var(--inst-green)', color: 'white', border: 'none', padding: '15px 35px', borderRadius: '8px', fontWeight: 'bold', cursor: exportando ? 'wait' : 'pointer', fontSize: '1.2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                >
                    {exportando ? 'Generando Archivo Excel...' : '⬇️ DESCARGAR MI DATA CRUDA'}
                </button>
            </div>

            {/* 🔍 SECCIÓN 2: BUSCADOR INDIVIDUAL 360° */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', borderTop: '5px solid var(--inst-blue)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <h2 style={{ color: 'var(--inst-blue)', margin: '0 0 15px 0' }}>🔍 Visión 360° del Paciente</h2>
                <p style={{ color: '#64748b', margin: '0 0 15px 0', fontSize: '0.9rem' }}>Busque un documento para ver el historial clínico y social antes de iniciar su atención.</p>

                <form onSubmit={buscarPaciente} style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="number"
                        placeholder="Ingrese Documento del Paciente..."
                        value={documentoBusqueda}
                        onChange={(e) => setDocumentoBusqueda(e.target.value)}
                        required
                        style={{ flex: 1, padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem' }}
                    />
                    <button type="submit" disabled={cargando} style={{ backgroundColor: 'var(--inst-blue)', color: 'white', border: 'none', padding: '0 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {cargando ? 'Buscando...' : 'Consultar Historial'}
                    </button>
                </form>
            </div>

            {/* RESULTADOS DEL BUSCADOR INDIVIDUAL */}
            {datosTotales && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* 👤 TARJETA DEL PACIENTE (CON TRAZABILIDAD DE PROMOTOR) */}
                    <div style={{ backgroundColor: datosTotales.paciente.estado_ficha === 'Pendiente de actualización' ? '#fef2f2' : '#f0fdf4', border: `2px solid ${datosTotales.paciente.estado_ficha === 'Pendiente de actualización' ? '#ef4444' : '#16a34a'}`, padding: '20px', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>👤 {datosTotales.paciente.primer_nombre} {datosTotales.paciente.primer_apellido}</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.95rem', color: '#475569', marginBottom: '15px' }}>
                            <p style={{ margin: 0 }}><strong>📍 Microterritorio:</strong> {datosTotales.paciente.microterritorio || 'No registrado'}</p>
                            <p style={{ margin: 0 }}>
                                <strong>📋 Caracterizado por (Gestor/Promotor):</strong> {
                                    datosTotales.hogar?.promotor_doc
                                        ? (datosTotales.mapaProfesionales[String(datosTotales.hogar.promotor_doc)] || `CC: ${datosTotales.hogar.promotor_doc}`)
                                        : 'Dato Histórico / No registrado'
                                }</p>
                        </div>

                        <p style={{ margin: 0, color: '#64748b' }}>Estado de Caracterización:
                            <strong style={{ color: datosTotales.paciente.estado_ficha === 'Pendiente de actualización' ? '#ef4444' : '#16a34a', marginLeft: '5px' }}>
                                {datosTotales.paciente.estado_ficha || 'Completa'}
                            </strong>
                        </p>
                    </div>

                    {/* 🩺 TARJETAS DE MÉTRICAS (CON TRAZABILIDAD CLÍNICA) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>🩺 Atenciones Clínicas</h4>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--inst-blue)', margin: '0 0 10px 0' }}>{datosTotales.clinico.length}</p>

                            {datosTotales.clinico.length > 0 && (
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.8rem', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                    {datosTotales.clinico.map(c => (
                                        <li key={c.id || c.id_atencion} style={{ marginBottom: '4px' }}>
                                            <strong>{c.especialidad || 'Atención'}:</strong> {datosTotales.mapaProfesionales[String(c.profesional_doc)] || c.profesional_doc}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>🧠 Intervenciones Psico.</h4>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--inst-green)', margin: '0 0 10px 0' }}>{datosTotales.psicosocial.length}</p>

                            {datosTotales.psicosocial.length > 0 && (
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.8rem', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                    {datosTotales.psicosocial.map(psi => (
                                        <li key={psi.id || psi.id_intervencion} style={{ marginBottom: '4px' }}>
                                            <strong>Sesión:</strong> {datosTotales.mapaProfesionales[String(psi.profesional_doc)] || psi.profesional_doc}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>🚨 Canalizaciones</h4>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--inst-orange)', margin: 0 }}>{datosTotales.canalizaciones.length}</p>

                            {datosTotales.canalizaciones.length > 0 && (
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.8rem', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                    {datosTotales.canalizaciones.map(can => (
                                        <li key={can.id} style={{ marginBottom: '4px' }}>
                                            <strong>A:</strong> {can.rol_destino} ({can.estado})
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}