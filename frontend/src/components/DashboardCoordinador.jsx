import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { db } from '../db';

export default function DashboardCoordinador({ usuarioActual, onAbrirHistoria }) {
    const [pestaña, setPestaña] = useState('GLOBAL'); // 'GLOBAL' | 'EQUIPO' | 'TERRITORIOS' | 'CONTROL_DATOS' | 'PERFILES' | 'JORNADAS' | 'CARGA_HISTORICO'
    const [cargando, setCargando] = useState(true);

    const [datosNube, setDatosNube] = useState({ hogares: [], pacientes: [], canalizaciones: [], form_clinico: [], form_psicosocial: [], cartografias: [] });

    // ESTADOS PARA BÚSQUEDA GLOBAL
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState({ pacientes: [], clinico: [], psicosocial: [] });

    // ESTADOS PARA CREACIÓN (PERFILES Y JORNADAS)
    const [nuevoProf, setNuevoProf] = useState({ documento: '', nombre: '', rol: '', territorio: '', microterritorio: '' });
    const [nuevaJornada, setNuevaJornada] = useState('');

    // 1. OBTENER DATOS EN TIEMPO REAL (Dexie)
    const profesionales = useLiveQuery(() => db.profesionales.toArray(), []) || [];
    // 🚀 BLINDAJE: Solo traer jornadas activas
    const jornadas = useLiveQuery(() => db.jornadas.filter(j => j.estado !== 'Desactivado').toArray(), []) || [];

    useEffect(() => {
        const cargarDatosNube = async () => {
            try {
                const response = await fetch('/api/registros');
                if (!response.ok) throw new Error("Sin conexión al servidor");
                const result = await response.json();
                if (result.status === 'ok') { setDatosNube(result.data); }
            } catch (error) {
                console.warn("⚠️ Modo Offline. El panel requiere internet.");
            } finally {
                setCargando(false);
            }
        };
        cargarDatosNube();
    }, []);

    // 2. BUSCADOR GLOBAL EN TIEMPO REAL (Omnisciente)
    useEffect(() => {
        const buscarEnTodaLaBase = async () => {
            if (busqueda.length < 3) {
                setResultados({ pacientes: [], clinico: [], psicosocial: [] });
                return;
            }
            const term = busqueda.toLowerCase();

            const pacs = await db.pacientes.filter(p =>
                p.estado_ficha !== 'Desactivado' &&
                (String(p.numero_documento).includes(term) || `${p.primer_nombre} ${p.primer_apellido}`.toLowerCase().includes(term))
            ).toArray();

            const clin = await db.form_clinico.filter(c =>
                c.estado_ficha !== 'Desactivado' && String(c.paciente_id).includes(term)
            ).toArray();

            const psico = await db.form_psicosocial.filter(c =>
                c.estado_ficha !== 'Desactivado' && String(c.paciente_id).includes(term)
            ).toArray();

            setResultados({ pacientes: pacs, clinico: clin, psicosocial: psico });
        };
        buscarEnTodaLaBase();
    }, [busqueda]);

    // 🚀 FUNCIÓN NUCLEAR: ELIMINAR CUALQUIER COSA
    const eliminarRegistroGlobal = async (tabla, registro) => {
        const pk = registro.id || registro.id_atencion || registro.id_intervencion || registro.numero_documento;

        if (window.confirm("⚠️ ADVERTENCIA CRÍTICA:\n\n¿Está absolutamente seguro de ELIMINAR este registro? Desaparecerá de todos los tableros y reportes de productividad del municipio.")) {
            try {
                await db[tabla].update(pk, { estado_ficha: 'Desactivado', sincronizado: 0 });
                alert("✅ Registro eliminado y puesto en cola para borrar del servidor.");
                setBusqueda('');
            } catch (error) {
                console.error("Error eliminando:", error);
                alert("❌ Error al intentar eliminar el registro.");
            }
        }
    };

    // 👥 FUNCIONES: GESTIÓN DE PERFILES
    const guardarProfesional = async (e) => {
        e.preventDefault();
        try {
            await db.profesionales.put({
                id: nuevoProf.documento, // Usamos el documento como ID principal
                documento: nuevoProf.documento,
                nombre: nuevoProf.nombre.toUpperCase(),
                rol: nuevoProf.rol,
                territorio: nuevoProf.territorio,
                microterritorio: nuevoProf.microterritorio,
                sincronizado: 0
            });
            alert("✅ Profesional registrado con éxito.");
            setNuevoProf({ documento: '', nombre: '', rol: '', territorio: '', microterritorio: '' });
        } catch (error) {
            alert("❌ Error guardando el profesional.");
        }
    };

    // ✏️ FUNCIÓN BLINDADA: EDITAR NOMBRE EN CASCADA
    const editarNombreProfesional = async (prof) => {
        const pk = prof.id || prof.documento;
        const nuevoNombre = window.prompt(`Cambiar el nombre del perfil (${prof.rol}):`, prof.nombre);

        if (nuevoNombre && nuevoNombre.trim() !== "" && nuevoNombre !== prof.nombre) {
            try {
                const nombreMayus = nuevoNombre.trim().toUpperCase();
                await db.profesionales.update(pk, { nombre: nombreMayus, sincronizado: 0 });

                // 🔥 EFECTO CASCADA: Si el usuario editado es el mismo que está usando la tablet ahora mismo
                const sesionActual = JSON.parse(localStorage.getItem('sesionActual'));
                if (sesionActual && String(sesionActual.documento) === String(prof.documento)) {
                    sesionActual.nombre = nombreMayus;
                    localStorage.setItem('sesionActual', JSON.stringify(sesionActual));
                    window.location.reload(); // Recargamos para que el menú de arriba cambie inmediatamente
                } else {
                    alert("✅ Perfil actualizado correctamente. El profesional verá su nuevo nombre cuando sincronice o vuelva a iniciar sesión.");
                }
            } catch (error) {
                console.error("Error editando perfil:", error);
                alert("❌ Error al actualizar el perfil.");
            }
        }
    };

    // 🚫 FUNCIÓN NUEVA: DAR DE BAJA A UN PROFESIONAL
    const desactivarProfesional = async (prof) => {
        const pk = prof.id || prof.documento;
        if (window.confirm(`⚠️ ¿Está seguro de DESACTIVAR a ${prof.nombre}?\n\nYa no podrá iniciar sesión en el sistema, pero sus registros históricos se conservarán.`)) {
            try {
                await db.profesionales.update(pk, { estado: 'Desactivado', sincronizado: 0 });
                alert("✅ Profesional dado de baja exitosamente.");
            } catch (error) {
                alert("❌ Error al intentar desactivar al profesional.");
            }
        }
    };

    const cambiarRol = async (doc, nombre, rolActual, nuevoRol) => {
        if (rolActual === nuevoRol) return;
        if (window.confirm(`⚠️ ¿Cambiar rol de ${nombre} a ${nuevoRol.toUpperCase()}?`)) {
            await db.profesionales.update(doc, { rol: nuevoRol });
            alert(`✅ Rol actualizado.`);
        }
    };

    // 🕒 FUNCIONES: GESTIÓN DE JORNADAS
    const guardarJornada = async (e) => {
        e.preventDefault();
        if (!nuevaJornada.trim()) return;
        try {
            await db.jornadas.add({
                id: crypto.randomUUID(),
                nombre: nuevaJornada.trim().toUpperCase(),
                sincronizado: 0
            });
            alert("✅ Jornada creada exitosamente.");
            setNuevaJornada('');
        } catch (error) {
            alert("❌ Error creando la jornada.");
        }
    };

    // 🚀 BLINDAJE: Borrado lógico de Jornadas (Soft Delete)
    const eliminarJornada = async (jornada) => {
        if (window.confirm(`⚠️ ¿Está seguro de eliminar la jornada "${jornada.nombre}"?\nDesaparecerá de las opciones para todo el equipo.`)) {
            try {
                // En lugar de db.jornadas.delete(), lo actualizamos:
                await db.jornadas.update(jornada.id, { estado: 'Desactivado', sincronizado: 0 });
                alert("✅ Jornada eliminada y en cola para informar al servidor.");
            } catch (error) {
                alert("❌ Error al intentar eliminar la jornada.");
            }
        }
    };

    const exportarCSV = () => {
        if (datosNube.canalizaciones.length === 0) return alert("No hay datos para exportar");
        const encabezados = ["ID_Alerta", "Paciente", "Documento", "Motivo_Triage", "Estado", "Atendido_Por", "Microterritorio", "Fecha_Reporte"];
        const filas = datosNube.canalizaciones.map(c => [c.id, c.nombre_paciente, c.paciente_id, `"${c.motivo}"`, c.estado, c.profesional_atendio || 'N/A', c.microterritorio, new Date(c.fecha_creacion).toLocaleDateString()]);
        let csvContent = "data:text/csv;charset=utf-8," + encabezados.join(",") + "\n" + filas.map(e => e.join(",")).join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `Listado_Maestro_${new Date().toISOString().slice(0, 10)}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
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

    // 📂 FUNCIÓN: CARGAR HISTÓRICO MASIVO (FORMATO VOLCADO DUMP: uid | tabla_origen | datos)
    const cargarHistorico = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (window.confirm("⚠️ ¿Está seguro de cargar este archivo histórico? El sistema descomprimirá los datos y los preparará para subir a la nube.")) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    let totalCargados = 0;

                    // Leemos la primera hoja del Excel
                    const primeraHoja = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[primeraHoja];
                    const filasExcel = XLSX.utils.sheet_to_json(worksheet);

                    if (filasExcel.length === 0) {
                        return alert("El archivo Excel está vacío.");
                    }

                    // Diccionario para agrupar los registros por tabla antes de guardarlos
                    const registrosPorTabla = {};

                    for (const fila of filasExcel) {
                        // Verificamos que tenga la estructura de tu archivo
                        if (fila.tabla_origen && fila.datos) {
                            const nombreTabla = String(fila.tabla_origen).trim().toLowerCase();

                            // Extraemos el JSON comprimido en la columna "datos"
                            let registroParseado;
                            try {
                                registroParseado = JSON.parse(fila.datos);
                            } catch (parseError) {
                                console.warn(`⚠️ Error leyendo el JSON en el uid: ${fila.uid}`);
                                continue; // Si una fila está rota, la saltamos y seguimos con las demás
                            }

                            // 🛡️ REGLA DE ORO: Forzamos la sincronización para que suba a la nube
                            registroParseado.sincronizado = 0;

                            // 🛡️ BLINDAJE DE TIPOS: Aseguramos que las cédulas sean texto para que Dexie no falle
                            if (registroParseado.numero_documento) registroParseado.numero_documento = String(registroParseado.numero_documento);
                            if (registroParseado.paciente_id) registroParseado.paciente_id = String(registroParseado.paciente_id);
                            if (registroParseado.profesional_doc) registroParseado.profesional_doc = String(registroParseado.profesional_doc);
                            if (registroParseado.promotor_doc) registroParseado.promotor_doc = String(registroParseado.promotor_doc);
                            if (registroParseado.gestor_doc) registroParseado.gestor_doc = String(registroParseado.gestor_doc);

                            // Agrupamos en el diccionario
                            if (!registrosPorTabla[nombreTabla]) {
                                registrosPorTabla[nombreTabla] = [];
                            }
                            registrosPorTabla[nombreTabla].push(registroParseado);
                        }
                    }

                    // Insertamos masivamente en la base de datos local (Dexie)
                    for (const tabla in registrosPorTabla) {
                        if (db[tabla]) {
                            await db[tabla].bulkPut(registrosPorTabla[tabla]);
                            totalCargados += registrosPorTabla[tabla].length;
                        } else {
                            console.warn(`⚠️ La tabla "${tabla}" mencionada en el Excel no existe en la base local.`);
                        }
                    }

                    alert(`✅ RESTAURACIÓN EXITOSA: Se inyectaron ${totalCargados} registros históricos desde el Excel.\n\n¡Por favor, presione el botón de Sincronizar (🔄) en la cabecera superior para subirlos permanentemente a la nube!`);
                    e.target.value = null; // Limpiar el input
                } catch (err) {
                    console.error("Error procesando Excel:", err);
                    alert("❌ Error: No se pudo procesar el archivo. Verifique que sea un Excel válido con las columnas 'uid', 'tabla_origen' y 'datos'.");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            e.target.value = null;
        }
    };

    if (cargando) return <h2 style={{ textAlign: 'center', marginTop: '50px', color: '#1e293b' }}>📡 Conectando con Servidor...</h2>;

    return (
        <div className="card" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0', backgroundColor: '#ffffff', colorScheme: 'light', color: '#1e293b', borderTop: '5px solid #0f172a' }}>
            <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '20px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div><h2 style={{ margin: '0 0 5px 0', color: '#fbbf24' }}>👑 Centro de Mando</h2><p style={{ margin: 0, color: '#94a3b8' }}>Panel de Control APS</p></div>
                <button onClick={exportarCSV} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>📥 Descargar Maestro</button>
            </div>

            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', overflowX: 'auto' }}>
                <button onClick={() => setPestaña('GLOBAL')} style={{ flex: 1, padding: '15px', background: pestaña === 'GLOBAL' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'GLOBAL' ? '3px solid var(--inst-blue)' : 'none', fontWeight: 'bold', color: pestaña === 'GLOBAL' ? 'var(--inst-blue)' : '#64748b' }}>📊 Global</button>
                <button onClick={() => setPestaña('EQUIPO')} style={{ flex: 1, padding: '15px', background: pestaña === 'EQUIPO' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'EQUIPO' ? '3px solid var(--inst-orange)' : 'none', fontWeight: 'bold', color: pestaña === 'EQUIPO' ? 'var(--inst-orange)' : '#64748b' }}>👥 Equipo</button>
                <button onClick={() => setPestaña('TERRITORIOS')} style={{ flex: 1, padding: '15px', background: pestaña === 'TERRITORIOS' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'TERRITORIOS' ? '3px solid var(--inst-green)' : 'none', fontWeight: 'bold', color: pestaña === 'TERRITORIOS' ? 'var(--inst-green)' : '#64748b' }}>🗺️ Cobertura</button>
                <button onClick={() => setPestaña('CONTROL_DATOS')} style={{ flex: 1, padding: '15px', background: pestaña === 'CONTROL_DATOS' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'CONTROL_DATOS' ? '3px solid #be123c' : 'none', fontWeight: 'bold', color: pestaña === 'CONTROL_DATOS' ? '#be123c' : '#64748b' }}>🗑️ Control Datos</button>
                <button onClick={() => setPestaña('PERFILES')} style={{ flex: 1, padding: '15px', background: pestaña === 'PERFILES' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'PERFILES' ? '3px solid #4338ca' : 'none', fontWeight: 'bold', color: pestaña === 'PERFILES' ? '#4338ca' : '#64748b' }}>⚙️ Perfiles</button>
                <button onClick={() => setPestaña('JORNADAS')} style={{ flex: 1, padding: '15px', background: pestaña === 'JORNADAS' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'JORNADAS' ? '3px solid #059669' : 'none', fontWeight: 'bold', color: pestaña === 'JORNADAS' ? '#059669' : '#64748b' }}>🕒 Jornadas</button>
                <button onClick={() => setPestaña('CARGA_HISTORICO')} style={{ flex: 1, padding: '15px', background: pestaña === 'CARGA_HISTORICO' ? 'white' : 'transparent', border: 'none', borderBottom: pestaña === 'CARGA_HISTORICO' ? '3px solid #ea580c' : 'none', fontWeight: 'bold', color: pestaña === 'CARGA_HISTORICO' ? '#ea580c' : '#64748b' }}>📂 Históricos</button>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#ffffff' }}>
                {/* 📊 VISTA 1: GLOBAL */}
                {pestaña === 'GLOBAL' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                        <div style={{ padding: '20px', backgroundColor: '#eff6ff', borderRadius: '12px', textAlign: 'center', border: '1px solid #bfdbfe' }}><h3 style={{ margin: 0, fontSize: '2rem', color: '#1e40af' }}>{datosNube.hogares.length}</h3><p style={{ margin: 0, color: '#60a5fa', fontWeight: 'bold' }}>Familias Sincronizadas</p></div>
                        <div style={{ padding: '20px', backgroundColor: '#fff7ed', borderRadius: '12px', textAlign: 'center', border: '1px solid #fed7aa' }}><h3 style={{ margin: '0', fontSize: '2rem', color: '#9a3412' }}>{datosNube.pacientes.length}</h3><p style={{ margin: 0, color: '#fb923c', fontWeight: 'bold' }}>Personas Identificadas</p></div>
                        <div style={{ padding: '20px', backgroundColor: '#fef2f2', borderRadius: '12px', textAlign: 'center', border: '1px solid #fecaca' }}><h3 style={{ margin: '0', fontSize: '2rem', color: '#991b1b' }}>{datosNube.canalizaciones.filter(c => c.estado === 'Pendiente').length}</h3><p style={{ margin: 0, color: '#f87171', fontWeight: 'bold' }}>Alertas Clínicas Activas</p></div>
                    </div>
                )}

                {/* 👥 VISTA 2: EQUIPO */}
                {pestaña === 'EQUIPO' && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#ffffff' }}>
                            <thead><tr style={{ backgroundColor: '#f1f5f9', color: '#334155' }}><th style={{ padding: '12px' }}>Documento</th><th style={{ padding: '12px' }}>Nombre</th><th style={{ padding: '12px' }}>Registros</th><th style={{ padding: '12px' }}>Rol</th></tr></thead>
                            <tbody>
                                {profesionales.map(prof => {
                                    const prod = calcularProductividad(prof.documento);
                                    return (
                                        <tr key={prof.documento} style={{ borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{prof.documento}</td>
                                            <td style={{ padding: '12px' }}>{prof.nombre}</td>
                                            <td style={{ padding: '12px', fontSize: '0.85rem' }}><span style={{ color: 'var(--inst-blue)' }}>🏠 {prod.familias} | 🗺️ {prod.cartografias} | 🩺 {prod.clinicas} | 🧠 {prod.psicosocial}</span></td>
                                            <td style={{ padding: '12px' }}>
                                                <select value={prof.rol} onChange={(e) => cambiarRol(prof.documento, prof.nombre, prof.rol, e.target.value)} style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                                                    <option value="promotor">Promotor</option><option value="medico">Médico Clínico</option><option value="jefe_enfermeria">Enfermería</option><option value="psicologia">Psicología</option><option value="nutricionista">Nutrición</option><option value="fisioterapeuta">Fisioterapia</option><option value="gestor">Gestor Comunitario</option><option value="soporte">👑 Admin</option>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 🗺️ VISTA 3: TERRITORIOS */}
                {pestaña === 'TERRITORIOS' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                        {Object.keys(metricasTerritorios).map(micro => (
                            <div key={micro} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', backgroundColor: '#ffffff', color: '#1e293b' }}>
                                <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid var(--inst-blue)', paddingBottom: '5px', color: '#334155' }}>📍 {micro}</h4>
                                <div style={{ fontSize: '0.9rem' }}>Familias: <strong>{metricasTerritorios[micro].hogares}</strong> | Personas: <strong>{metricasTerritorios[micro].pacientes}</strong> | Alertas: <strong style={{ color: '#ef4444' }}>{metricasTerritorios[micro].alertas}</strong></div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 🗑️ VISTA 4: CONTROL Y BORRADO DE DATOS */}
                {pestaña === 'CONTROL_DATOS' && (
                    <div>
                        <div style={{ backgroundColor: '#fff1f2', padding: '15px', borderRadius: '8px', border: '1px dashed #f43f5e', marginBottom: '20px' }}>
                            <h3 style={{ margin: '0 0 10px 0', color: '#be123c' }}>Omnibus de Borrado Master</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#9f1239' }}>Busque por nombre o cédula. Podrá eliminar caracterizaciones de promotores o planes de cuidado clínicos de cualquier especialidad.</p>
                        </div>

                        <input
                            type="text"
                            placeholder="🔍 Escriba la cédula o nombre del paciente a auditar..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            style={{ padding: '15px', width: '100%', border: '2px solid #cbd5e1', borderRadius: '8px', marginBottom: '20px', boxSizing: 'border-box', fontSize: '1.1rem' }}
                        />

                        {busqueda.length > 0 && busqueda.length < 3 && (
                            <p style={{ textAlign: 'center', color: '#64748b' }}>Escriba al menos 3 caracteres para buscar...</p>
                        )}

                        {busqueda.length >= 3 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* RESULTADOS: PACIENTES / CARACTERIZACIONES */}
                                {resultados.pacientes.length > 0 && (
                                    <div>
                                        <h4 style={{ color: '#0369a1', borderBottom: '2px solid #bae6fd', paddingBottom: '5px' }}>📋 Caracterizaciones Base ({resultados.pacientes.length})</h4>
                                        {resultados.pacientes.map(pac => (
                                            <div key={pac.id || pac.numero_documento} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                                                <div>
                                                    <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>👤 {pac.primer_nombre} {pac.primer_apellido}</p>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Cédula: {pac.numero_documento} | Creado: {new Date(pac.fecha_creacion).toLocaleDateString()}</p>
                                                </div>
                                                <button onClick={() => eliminarRegistroGlobal('pacientes', pac)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                    🗑️ Eliminar Ficha
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* RESULTADOS: ATENCIONES CLÍNICAS */}
                                {resultados.clinico.length > 0 && (
                                    <div>
                                        <h4 style={{ color: '#047857', borderBottom: '2px solid #a7f3d0', paddingBottom: '5px' }}>🩺 Planes de Cuidado Clínicos ({resultados.clinico.length})</h4>
                                        {resultados.clinico.map(clin => (
                                            <div key={clin.id || clin.id_atencion} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '6px', border: '1px solid #6ee7b7', marginBottom: '10px' }}>
                                                <div>
                                                    <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#065f46' }}>Atención de {clin.especialidad || 'Médico/Nutrición'}</p>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#047857' }}>Paciente CC: {clin.paciente_id} | Profesional CC: {clin.profesional_doc}</p>
                                                </div>
                                                <button onClick={() => eliminarRegistroGlobal('form_clinico', clin)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                    🗑️ Eliminar Plan
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* RESULTADOS: INTERVENCIONES PSICOSOCIALES */}
                                {resultados.psicosocial.length > 0 && (
                                    <div>
                                        <h4 style={{ color: '#7e22ce', borderBottom: '2px solid #e9d5ff', paddingBottom: '5px' }}>🧠 Intervenciones Psicosociales ({resultados.psicosocial.length})</h4>
                                        {resultados.psicosocial.map(psi => (
                                            <div key={psi.id || psi.id_intervencion} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#faf5ff', padding: '12px', borderRadius: '6px', border: '1px solid #d8b4fe', marginBottom: '10px' }}>
                                                <div>
                                                    <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#6b21a8' }}>Atención Psicológica</p>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#7e22ce' }}>Paciente CC: {psi.paciente_id} | Profesional CC: {psi.profesional_doc}</p>
                                                </div>
                                                <button onClick={() => eliminarRegistroGlobal('form_psicosocial', psi)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                    🗑️ Eliminar Plan
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* MENSAJE DE VACÍO */}
                                {resultados.pacientes.length === 0 && resultados.clinico.length === 0 && resultados.psicosocial.length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No se encontró ningún registro asociado a esa cédula o nombre en ninguna tabla.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ⚙️ VISTA 5: GESTIÓN DE PERFILES */}
                {pestaña === 'PERFILES' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
                        {/* Formulario de Creación */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 15px 0', color: '#4338ca' }}>➕ Nuevo Profesional</h4>
                            <form onSubmit={guardarProfesional} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input type="number" placeholder="Documento (CC)" required value={nuevoProf.documento} onChange={e => setNuevoProf({ ...nuevoProf, documento: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                <input type="text" placeholder="Nombre Completo" required value={nuevoProf.nombre} onChange={e => setNuevoProf({ ...nuevoProf, nombre: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                <select required value={nuevoProf.rol} onChange={e => setNuevoProf({ ...nuevoProf, rol: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                    <option value="">-- Seleccione Rol --</option>
                                    <option value="promotor">Promotor</option>
                                    <option value="gestor">Gestor Comunitario</option>
                                    <option value="medico">Médico</option>
                                    <option value="jefe_enfermeria">Jefe de Enfermería</option>
                                    <option value="psicologia">Psicología</option>
                                    <option value="nutricionista">Nutricionista</option>
                                    <option value="fisioterapeuta">Fisioterapeuta</option>
                                    <option value="soporte">Coordinador / Soporte</option>
                                </select>
                                <input type="text" placeholder="Territorio (Ej: Centro)" required value={nuevoProf.territorio} onChange={e => setNuevoProf({ ...nuevoProf, territorio: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                <input type="text" placeholder="Microterritorio (Ej: Porvenir)" required value={nuevoProf.microterritorio} onChange={e => setNuevoProf({ ...nuevoProf, microterritorio: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                <button type="submit" style={{ backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Perfil</button>
                            </form>
                        </div>

                        {/* Lista de Profesionales Activos */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                            {profesionales?.filter(p => p.estado !== 'Desactivado').map(prof => (
                                <div key={prof.documento} style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 5px 0' }}>{prof.nombre}</h4>
                                        <span style={{ backgroundColor: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>{String(prof.rol).toUpperCase()}</span>
                                        <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem' }}>CC: {prof.documento}</p>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <button onClick={() => editarNombreProfesional(prof)} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' }} title="Editar Nombre">✏️</button>
                                        <button onClick={() => desactivarProfesional(prof)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' }} title="Dar de baja">🚫</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🕒 VISTA 6: GESTIÓN DE JORNADAS */}
                {pestaña === 'JORNADAS' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
                        {/* Formulario de Creación de Jornada */}
                        <div style={{ backgroundColor: '#ecfdf5', padding: '20px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                            <h4 style={{ margin: '0 0 15px 0', color: '#047857' }}>➕ Nueva Jornada</h4>
                            <form onSubmit={guardarJornada} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input type="text" placeholder="Ej: CAMPAÑA VACUNACIÓN MAYO" required value={nuevaJornada} onChange={e => setNuevaJornada(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                <button type="submit" style={{ backgroundColor: '#059669', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Jornada</button>
                            </form>
                        </div>

                        {/* Lista de Jornadas Oficiales */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h4 style={{ color: '#047857', margin: 0 }}>Jornadas Activas en el Sistema:</h4>
                            {jornadas?.map(jor => (
                                <div key={jor.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                    <strong>{jor.nombre}</strong>
                                    <button onClick={() => eliminarJornada(jor)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        🗑️ Eliminar
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 📂 VISTA 7: CARGA DE HISTÓRICOS MASIVOS DESDE EXCEL */}
                {pestaña === 'CARGA_HISTORICO' && (
                    <div style={{ backgroundColor: '#f0fdfa', padding: '20px', borderRadius: '8px', border: '1px solid #5eead4' }}>
                        <h3 style={{ color: '#0f766e', margin: '0 0 15px 0' }}>📥 Restauración de Backup (Excel Dump)</h3>
                        <p style={{ color: '#115e59', marginBottom: '20px' }}>
                            Seleccione su archivo <strong>Excel (.xlsx)</strong> de respaldo.
                            El sistema descomprimirá automáticamente los objetos JSON y los enrutará a las tablas correspondientes.
                        </p>

                        <div style={{ border: '2px dashed #14b8a6', padding: '30px', textAlign: 'center', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={cargarHistorico}
                                style={{ display: 'block', margin: '0 auto', padding: '10px', fontSize: '1rem', cursor: 'pointer' }}
                            />
                        </div>

                        <div style={{ marginTop: '20px', fontSize: '0.85rem', color: '#134e4a', backgroundColor: '#ccfbf1', padding: '15px', borderRadius: '6px' }}>
                            <strong>📝 Requisitos estructurales del archivo:</strong>
                            <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
                                <li>La primera fila debe contener exactamente 3 columnas: <strong>uid</strong>, <strong>tabla_origen</strong>, y <strong>datos</strong>.</li>
                                <li>La columna <strong>datos</strong> debe contener la cadena de texto con formato JSON.</li>
                                <li>Asegúrese de que no haya saltos de línea rotos dentro de las celdas del Excel.</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}