import { useState, useEffect } from 'react';
import { db } from '../db'; // Aún lo necesitamos para cambiar roles de los profesionales locales

export default function DashboardCoordinador() {
    const [pestaña, setPestaña] = useState('GLOBAL');
    const [cargando, setCargando] = useState(true);

    // Estados para la Nube
    const [datosNube, setDatosNube] = useState({ hogares: [], pacientes: [], canalizaciones: [], form_clinico: [], form_psicosocial: [], cartografias: [] });
    // Los profesionales los seguimos manejando localmente para el control de la tablet
    const [profesionales, setProfesionales] = useState([]);

    useEffect(() => {
        const cargarDatosNube = async () => {
            try {
                // 1. Cargar Profesionales Locales
                const profs = await db.profesionales.toArray();
                setProfesionales(profs);

                // 2. Traer la base de datos central de Python (La Nube)
                const response = await fetch('/api/registros');
                if (!response.ok) throw new Error("Sin conexión al servidor");
                const result = await response.json();

                if (result.status === 'ok') {
                    setDatosNube(result.data);
                }
            } catch (error) {
                console.error(error);
                alert("⚠️ Estás en modo Offline. El panel de coordinación necesita internet para ver la base de datos central.");
            } finally {
                setCargando(false);
            }
        };
        cargarDatosNube();
    }, []);

    const cambiarRol = async (doc, nombre, rolActual, nuevoRol) => {
        if (rolActual === nuevoRol) return;
        if (window.confirm(`⚠️ ¿Estás seguro de cambiar el rol de ${nombre} a ${nuevoRol.toUpperCase()}?`)) {
            await db.profesionales.update(doc, { rol: nuevoRol });
            setProfesionales(profesionales.map(p => p.documento === doc ? { ...p, rol: nuevoRol } : p));
            alert(`✅ Rol actualizado.`);
        }
    };

    const exportarCSV = () => {
        if (datosNube.canalizaciones.length === 0) return alert("No hay datos para exportar");
        const encabezados = ["ID_Alerta", "Paciente", "Documento", "Motivo_Triage", "Estado", "Atendido_Por", "Microterritorio", "Fecha_Reporte"];
        const filas = datosNube.canalizaciones.map(c => [c.id, c.nombre_paciente, c.paciente_id, `"${c.motivo}"`, c.estado, c.profesional_atendio || 'N/A', c.microterritorio, new Date(c.fecha_creacion).toLocaleDateString()]);
        let csvContent = "data:text/csv;charset=utf-8," + encabezados.join(",") + "\n" + filas.map(e => e.join(",")).join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `Listado_Maestro_Nube_${new Date().toISOString().slice(0, 10)}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const metricasTerritorios = {};
    datosNube.hogares.forEach(h => { if (!metricasTerritorios[h.microterritorio]) metricasTerritorios[h.microterritorio] = { hogares: 0, pacientes: 0, cartografias: 0, alertas: 0 }; metricasTerritorios[h.microterritorio].hogares += 1; });
    datosNube.pacientes.forEach(p => { if (metricasTerritorios[p.microterritorio]) metricasTerritorios[p.microterritorio].pacientes += 1; });
    datosNube.cartografias.forEach(c => { if (!metricasTerritorios[c.microterritorio]) metricasTerritorios[c.microterritorio] = { hogares: 0, pacientes: 0, cartografias: 0, alertas: 0 }; metricasTerritorios[c.microterritorio].cartografias += 1; });
    datosNube.canalizaciones.forEach(c => { if (metricasTerritorios[c.microterritorio]) metricasTerritorios[c.microterritorio].alertas += 1; });

    const calcularProductividad = (doc) => ({
        familias: datosNube.hogares.filter(h => h.promotor_doc === doc).length,
        cartografias: datosNube.cartografias.filter(c => c.gestor_doc === doc).length,
        clinicas: datosNube.form_clinico.filter(f => f.profesional_doc === doc).length,
        psicosocial: datosNube.form_psicosocial.filter(f => f.profesional_doc === doc).length
    });

    if (cargando) return <h2 style={{ textAlign: 'center', marginTop: '50px' }}>📡 Conectando con el Servidor Central...</h2>;

    return (
        <div className="card" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0' }}>
            <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '20px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h2 style={{ margin: '0 0 5px 0', color: '#fbbf24' }}>☁️ Centro de Mando (Nube)</h2><p style={{ margin: 0, color: '#94a3b8' }}>Viendo datos de todas las tablets sincronizadas</p></div>
                <button onClick={exportarCSV} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>📥 Descargar Listado Maestro</button>
            </div>

            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <button onClick={() => setPestaña('GLOBAL')} style={{ flex: 1, padding: '15px', background: pestaña === 'GLOBAL' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'GLOBAL' ? '3px solid var(--inst-blue)' : 'none', fontWeight: 'bold', color: pestaña === 'GLOBAL' ? 'var(--inst-blue)' : '#64748b' }}>📊 Visión Global</button>
                <button onClick={() => setPestaña('EQUIPO')} style={{ flex: 1, padding: '15px', background: pestaña === 'EQUIPO' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'EQUIPO' ? '3px solid var(--inst-orange)' : 'none', fontWeight: 'bold', color: pestaña === 'EQUIPO' ? 'var(--inst-orange)' : '#64748b' }}>👥 Productividad de Equipo</button>
                <button onClick={() => setPestaña('TERRITORIOS')} style={{ flex: 1, padding: '15px', background: pestaña === 'TERRITORIOS' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'TERRITORIOS' ? '3px solid var(--inst-green)' : 'none', fontWeight: 'bold', color: pestaña === 'TERRITORIOS' ? 'var(--inst-green)' : '#64748b' }}>🗺️ Cobertura</button>
            </div>

            <div style={{ padding: '20px' }}>
                {pestaña === 'GLOBAL' && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                            <div style={{ padding: '20px', backgroundColor: '#eff6ff', borderRadius: '12px', textAlign: 'center', border: '1px solid #bfdbfe' }}><h3 style={{ margin: 0, fontSize: '2rem', color: '#1e40af' }}>{datosNube.hogares.length}</h3><p style={{ margin: 0, color: '#60a5fa', fontWeight: 'bold' }}>Familias Sincronizadas</p></div>
                            <div style={{ padding: '20px', backgroundColor: '#fff7ed', borderRadius: '12px', textAlign: 'center', border: '1px solid #fed7aa' }}><h3 style={{ margin: 0, fontSize: '2rem', color: '#9a3412' }}>{datosNube.pacientes.length}</h3><p style={{ margin: 0, color: '#fb923c', fontWeight: 'bold' }}>Personas Identificadas</p></div>
                            <div style={{ padding: '20px', backgroundColor: '#fef2f2', borderRadius: '12px', textAlign: 'center', border: '1px solid #fecaca' }}><h3 style={{ margin: 0, fontSize: '2rem', color: '#991b1b' }}>{datosNube.canalizaciones.filter(c => c.estado === 'Pendiente').length}</h3><p style={{ margin: 0, color: '#f87171', fontWeight: 'bold' }}>Alertas Clínicas Activas</p></div>
                        </div>
                    </div>
                )}

                {pestaña === 'EQUIPO' && (
                    /* NUEVO CONTENEDOR DESLIZABLE PARA MÓVILES */
                    <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                                    <th style={{ padding: '12px' }}>Documento</th>
                                    <th style={{ padding: '12px' }}>Nombre</th>
                                    <th style={{ padding: '12px' }}>Registros Subidos a la Nube</th>
                                    <th style={{ padding: '12px' }}>Rol Actual / Cambiar Rol</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profesionales.map(prof => {
                                    const prod = calcularProductividad(prof.documento);
                                    return (
                                        <tr key={prof.documento} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{prof.documento}</td>
                                            <td style={{ padding: '12px' }}>{prof.nombre}</td>
                                            <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--inst-blue)', whiteSpace: 'nowrap' }}>🏠 Fam: {prod.familias} | 🗺️ Cart: {prod.cartografias} | 🩺 Clin: {prod.clinicas} | 🧠 Psic: {prod.psicosocial}</span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <select value={prof.rol} onChange={(e) => cambiarRol(prof.documento, prof.nombre, prof.rol, e.target.value)} style={{ padding: '6px', borderRadius: '6px', width: '100%' }}>
                                                    <option value="promotor">Promotor</option>
                                                    <option value="medico">Médico Clínico</option>
                                                    <option value="psicosocial">Psicosocial</option>
                                                    <option value="gestor">Gestor Comunitario</option>
                                                    <option value="soporte">👑 Admin</option>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {pestaña === 'TERRITORIOS' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                        {Object.keys(metricasTerritorios).map(micro => {
                            const metrica = metricasTerritorios[micro];
                            return (
                                <div key={micro} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', backgroundColor: 'white' }}>
                                    <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid var(--inst-blue)', paddingBottom: '5px' }}>📍 {micro}</h4>
                                    <div style={{ fontSize: '0.9rem' }}>Familias: <strong>{metrica.hogares}</strong> | Personas: <strong>{metrica.pacientes}</strong> | Alertas: <strong style={{ color: 'red' }}>{metrica.alertas}</strong></div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}