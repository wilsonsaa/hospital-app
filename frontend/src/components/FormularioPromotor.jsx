import { useState, useEffect } from 'react';
import { db } from '../db';
import { useEstadoFicha } from '../hooks/useEstadoFicha'; // 🚀 Importamos el motor de tiempos

// 1. AÑADIMOS forzarEdicion A LOS PROPS
export default function FormularioPromotor({ usuario, volver, hogarExistente, pacientesExistentes, forzarEdicion }) {
    const [pasoForm, setPasoForm] = useState(1);
    const [guardando, setGuardando] = useState(false);

    // 🚀 ESTADOS PARA CANALIZACIÓN MANUAL
    const [rutasCanalizacion, setRutasCanalizacion] = useState([]);
    const [nuevaRuta, setNuevaRuta] = useState({
        paciente_doc: '', rol_destino: '', motivo: ''
    });

    // 🚀 LÓGICA DE ESTADOS Y TIEMPOS
    const fechaCreacion = hogarExistente ? hogarExistente.fecha : null;
    const estadoActual = hogarExistente ? hogarExistente.estado_ficha : 'Borrador';

    // 2. EXTRAEMOS EL ESTADO MATEMÁTICO
    const { bloqueado: bloqueadoHook, tiempoRestante } = useEstadoFicha(fechaCreacion, estadoActual);

    // 🚀 3. LA LLAVE MAESTRA: Si forzarEdicion es true, apagamos el bloqueo matemático
    const bloqueado = forzarEdicion ? false : bloqueadoHook;
    const bannerTiempo = forzarEdicion
        ? "🔓 MODO DIRECTORIO: Edición libre habilitada. Guarde como 'Definitiva' al terminar."
        : tiempoRestante;

    // Si la ficha ya es un borrador guardado o estamos forzando edición, los campos se vuelven obligatorios
    const esActualizacion = estadoActual === 'Pendiente de actualización' || forzarEdicion;

    // 🚨 FUNCIONES DE ALERTA 🚨
    const getEstiloAlerta = (condicion) => condicion ? { border: '2px solid #ef4444', backgroundColor: '#fef2f2', outline: 'none', color: '#1e293b' } : { backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' };

    const AlertaHelper = ({ condicion, mensaje }) => {
        if (!condicion) return null;
        return <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '4px 0 0 0', fontWeight: 'bold' }}>⚠️ {mensaje}</p>;
    };

    const estadoInicialHogar = {
        departamento: 'Cundinamarca', municipio: 'Mosquera', territorio_zona: '', barrio_vereda: '', direccion: '', estrato: '2', telefono_hogar: '', gps: '',
        tipo_vivienda: 'Casa', material_paredes: 'Bloque / Ladrillo / Concreto', material_pisos: 'Baldosa / Vinilo / Mármol', cuartos_dormir: '1',
        fuente_agua: 'Acueducto', disp_excretas: 'Sanitario conectado al alcantarillado', aguas_residuales: 'Alcantarillado',
        disp_basuras: 'Recolección municipal', disp_basuras_otro: '', energia_cocina: 'Gas natural', riesgos_vivienda: 'Ninguno',
        tipo_familia: 'Nuclear', cuidador_prin: 'No', seg_alimentaria: 'Compra', vic_conflicto: 'No'
    };

    // Cargamos desde Props (si estamos editando) o desde LocalStorage (si se le apagó la tablet)
    const [hogar, setHogar] = useState(() => {
        if (hogarExistente) return hogarExistente.datos;
        const b = localStorage.getItem('draft_hogar');
        return b ? JSON.parse(b) : estadoInicialHogar;
    });

    const [integrantes, setIntegrantes] = useState(() => {
        if (pacientesExistentes) return pacientesExistentes.map(p => p.datos);
        const b = localStorage.getItem('draft_integrantes');
        return b ? JSON.parse(b) : [];
    });

    const [integ, setInteg] = useState({
        primer_nombre: '', primer_apellido: '', tipo_doc: 'CC', num_doc: '', fecha_nacim: '', curso_vida: '',
        sexo_asignado: 'Femenino', identidad_genero: 'Mujer', orientacion_sexual: 'Heterosexual',
        cabeza_hogar: 'No', nivel_escolaridad: 'Básica Secundaria', ocupacion_actual: '',
        actividad_fisica: 'Sí', comidas_diarias: '3', red_apoyo: 'Sí', consumo_spa: 'No', tipo_spa: '',
        discapacidad: 'No', tipo_discapacidad: 'Física', certificado_discapacidad: 'No', estado_abandono: 'No',
        violencia_acoso: 'No', tramites_pendientes: [], otra_necesidad: '',
        regimen_salud: 'Subsidiado', nombre_eps: '', ips_primaria_hospital: 'Sí',
        peso_kg: '', talla_cm: '', imc_calc: '', perim_abdominal: '', perim_abdominal_alerta: '',
        perim_braquial: '', ta_sistolica: '', ta_diastolica: '',
        esquema_vacunas: 'Completo', vacuna_covid: false, vacuna_influenza: false, vacuna_fiebre_amarilla: false,
        fecha_ultima_regla: '', no_aplica_fur: false, fecha_ultima_citologia: '', examen_mama: 'No', vacuna_tetanos: 'No',
        embarazos_previos: '0', num_partos: '0', num_cesareas: '0', num_partos_vaginales: '0',
        gestante: 'No', fecha_control_prenatal: '', sin_controles_prenatales: false, vacuna_vsr: 'No', vacuna_dpt: 'No',
        enfermedad_cronica: 'Ninguna', tratamiento_actual: 'No', asiste_mantenimiento: 'Sí', motivo_no_atencion: 'NA',
        observaciones_generales: '', clase_riesgo: 'I', accidente_trabajo: 'No',
        aiepi_beber: 'Sí', aiepi_vomita: 'No', aiepi_convulsiones: 'No', aiepi_letargico: 'No',
        aiepi_tirajes: 'No', aiepi_deshidratacion: 'No', aiepi_maltrato: 'No'
    });

    useEffect(() => { if (!hogarExistente) localStorage.setItem('draft_hogar', JSON.stringify(hogar)); }, [hogar, hogarExistente]);
    useEffect(() => { if (!pacientesExistentes) localStorage.setItem('draft_integrantes', JSON.stringify(integrantes)); }, [integrantes, pacientesExistentes]);

    const [edadCalc, setEdadCalc] = useState(0);
    useEffect(() => {
        if (integ.fecha_nacim) {
            const diff = new Date() - new Date(integ.fecha_nacim);
            const edad = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
            setEdadCalc(edad);
            let curso = '';
            if (edad <= 5) curso = 'Primera infancia';
            else if (edad <= 11) curso = 'Infancia';
            else if (edad <= 17) curso = 'Adolescencia';
            else if (edad <= 28) curso = 'Juventud';
            else if (edad <= 59) curso = 'Adultez';
            else curso = 'Vejez';
            setInteg(prev => ({ ...prev, curso_vida: curso }));
        } else {
            setEdadCalc(0); setInteg(prev => ({ ...prev, curso_vida: '' }));
        }
    }, [integ.fecha_nacim]);

    useEffect(() => {
        const peso = parseFloat(integ.peso_kg);
        const tallaM = parseFloat(integ.talla_cm) / 100;
        if (peso > 0 && tallaM > 0) {
            const imc = (peso / (tallaM * tallaM)).toFixed(1);
            let estado = '';
            if (imc < 18.5) estado = 'Bajo peso';
            else if (imc < 25) estado = 'Normal';
            else if (imc < 30) estado = 'Sobrepeso';
            else estado = 'Obesidad';
            setInteg(prev => ({ ...prev, imc_calc: `${imc} (${estado})` }));
        } else { setInteg(prev => ({ ...prev, imc_calc: '' })); }
    }, [integ.peso_kg, integ.talla_cm]);

    useEffect(() => {
        const perim = parseFloat(integ.perim_abdominal);
        if (perim > 0) {
            let alerta = 'Sin obesidad abdominal';
            if (integ.sexo_asignado === 'Masculino' && perim >= 90) alerta = 'Obesidad abdominal';
            if (integ.sexo_asignado === 'Femenino' && perim >= 80) alerta = 'Obesidad abdominal';
            setInteg(prev => ({ ...prev, perim_abdominal_alerta: alerta }));
        } else { setInteg(prev => ({ ...prev, perim_abdominal_alerta: 'No aplica' })); }
    }, [integ.perim_abdominal, integ.sexo_asignado]);

    const manejarTramites = (e) => {
        const { value, checked } = e.target;
        if (checked) {
            if (value === 'Ninguna') setInteg({ ...integ, tramites_pendientes: ['Ninguna'] });
            else setInteg({ ...integ, tramites_pendientes: [...integ.tramites_pendientes.filter(t => t !== 'Ninguna'), value] });
        } else {
            setInteg({ ...integ, tramites_pendientes: integ.tramites_pendientes.filter(t => t !== value) });
        }
    };

    const agregarIntegrante = (e) => {
        e.preventDefault();
        // Validar duplicados excepto si estamos editando el mismo
        const duplicado = integrantes.find(i => i.num_doc === integ.num_doc && i.id_interno !== integ.id_interno);
        if (duplicado) return alert("Ese número de documento ya está en la lista.");

        const idGenerado = integ.id_interno || crypto.randomUUID();
        const nuevaLista = integrantes.filter(i => i.id_interno !== idGenerado);

        setIntegrantes([...nuevaLista, { ...integ, edad_calc: edadCalc, id_interno: idGenerado }]);

        // Limpiar subformulario
        setInteg({ ...integ, num_doc: '', primer_nombre: '', primer_apellido: '', fecha_nacim: '', enfermedad_cronica: 'Ninguna', tramites_pendientes: [], observaciones_generales: '', peso_kg: '', talla_cm: '', imc_calc: '', perim_abdominal: '', perim_abdominal_alerta: '', perim_braquial: '', ta_sistolica: '', ta_diastolica: '', aiepi_beber: 'Sí', aiepi_vomita: 'No', aiepi_convulsiones: 'No', aiepi_letargico: 'No', aiepi_tirajes: 'No', aiepi_deshidratacion: 'No', aiepi_maltrato: 'No', id_interno: null });
        alert("✅ Familiar actualizado/agregado a la lista.");
    };

    const editarIntegrante = (id) => {
        const persona = integrantes.find(i => i.id_interno === id);
        setInteg(persona);
        setPasoForm(3);
    };

    const eliminarIntegrante = (id) => setIntegrantes(integrantes.filter(i => i.id_interno !== id));

    // 🛑 VALIDAR QUE NO DEJEN PERSONAS SIN AGREGAR (ESCUDO ANTI-OLVIDOS)
    const avanzarAlPasoFinal = () => {
        // Verificamos si hay texto en los campos de la persona pero no la ha guardado en la lista
        if (integ.num_doc !== '' || integ.primer_nombre !== '') {
            alert("🛑 ¡ESPERA! Tienes datos de una persona escritos, pero olvidaste presionar el botón '💾 AÑADIR/ACTUALIZAR INTEGRANTE'. Agrégalo a la lista antes de continuar.");
            return;
        }

        if (integrantes.length === 0 && !pacientesExistentes?.length) {
            alert("⚠️ Debes agregar al menos un integrante al hogar antes de continuar.");
            return;
        }

        setPasoForm(4); // Si todo está limpio, avanza a la pestaña final
    };

    // 🚀 LÓGICA DE GUARDADO (TIPO: 'borrador' o 'definitiva')
    const procesarGuardado = async (tipoGuardado) => {

        // 🛡️ ESCÁNER ESTRICTO PARA FICHA DEFINITIVA
        if (tipoGuardado === 'definitiva') {
            // 1. Validar Paso 1: Entorno
            if (!hogar.territorio_zona || !hogar.barrio_vereda || !hogar.direccion || !hogar.estrato || !hogar.telefono_hogar || !hogar.cuartos_dormir) {
                setPasoForm(1);
                return alert("⚠️ Faltan datos básicos en el Paso 1 (Entorno). Complete todos los campos antes de firmar definitivamente.");
            }

            // 2. Validar Paso 2: Familia
            if (!hogar.tipo_familia || !hogar.cuidador_prin || !hogar.seg_alimentaria || !hogar.vic_conflicto) {
                setPasoForm(2);
                return alert("⚠️ Faltan datos en el Paso 2 (Dinámica Familiar). Complete todos los campos antes de firmar definitivamente.");
            }

            // 3. Validar que exista al menos 1 integrante
            if (integrantes.length === 0) {
                setPasoForm(3);
                return alert("⚠️ Debe agregar al menos 1 integrante a la familia para poder firmar la ficha.");
            }

            // 4. Validar CADA integrante agregado
            for (let persona of integrantes) {
                // Verificamos campos que un Promotor sí o sí debe llenar al completar
                const faltanDatosBasicos = !persona.ocupacion_actual || !persona.peso_kg || !persona.talla_cm || !persona.ta_sistolica || !persona.ta_diastolica || !persona.comidas_diarias;

                if (faltanDatosBasicos) {
                    setPasoForm(3);
                    return alert(`⚠️ El integrante ${persona.primer_nombre} ${persona.primer_apellido} tiene datos de salud o sociodemográficos en blanco. Haga clic en "✏️ Editar" junto a su nombre y complete toda la información requerida.`);
                }

                // Validación extra para mujeres adultas
                if (persona.sexo_asignado === 'Femenino' && persona.curso_vida !== 'Primera infancia' && persona.curso_vida !== 'Infancia') {
                    if (!persona.gestante || (!persona.no_aplica_fur && !persona.fecha_ultima_regla)) {
                        setPasoForm(3);
                        return alert(`⚠️ Faltan datos de Salud Femenina para ${persona.primer_nombre} ${persona.primer_apellido}. Haga clic en "✏️ Editar" para completarlos.`);
                    }
                }
            }
        } else {
            // 🔓 VALIDACIÓN RELAJADA PARA BORRADOR
            if (!hogar.direccion && integrantes.length === 0) {
                return alert("⚠️ Para guardar un borrador, debe ingresar al menos la Dirección en el Paso 1 o agregar un integrante.");
            }
        }

        // Si pasa las validaciones, procedemos a guardar
        setGuardando(true);
        const ficha_id = hogarExistente ? hogarExistente.id : crypto.randomUUID();
        const f_creacion = hogarExistente ? hogarExistente.fecha : new Date().toISOString();
        const f_actualizacion = new Date().toISOString();
        const estadoFinal = tipoGuardado === 'borrador' ? 'Pendiente de actualización' : 'Completa/actualizada';

        try {
            await db.hogares.put({
                id: ficha_id,
                fecha: f_creacion,
                fecha_actualizacion: f_actualizacion,
                promotor_doc: usuario.documento,
                territorio: usuario.territorio,
                microterritorio: usuario.microterritorio,
                jornada_id: usuario.jornada_id || null,
                estado_ficha: estadoFinal,
                datos: hogar,
                sincronizado: 0
            });

            if (hogarExistente) {
                const viejos = await db.pacientes.where('hogar_id').equals(ficha_id).primaryKeys();
                await db.pacientes.bulkDelete(viejos);
            }

            for (const persona of integrantes) {
                await db.pacientes.put({
                    numero_documento: persona.num_doc,
                    hogar_id: ficha_id,
                    microterritorio: usuario.microterritorio,
                    jornada_id: usuario.jornada_id || null,
                    estado_ficha: estadoFinal,
                    fecha_creacion: f_creacion,
                    primer_nombre: persona.primer_nombre,
                    primer_apellido: persona.primer_apellido,
                    datos: persona,
                    sincronizado: 0
                });

                // TRIAGE AUTOMÁTICO SOLO SI ES DEFINITIVA
                if (tipoGuardado === 'definitiva') {
                    let requiereMedico = false, requierePsico = false, requiereGestor = false, requiereNutri = false;
                    let motivosMedico = [], motivosPsico = [], motivosGestor = [], motivosNutri = [];

                    if (persona.regimen_salud === 'No afiliado') { requiereGestor = true; motivosGestor.push("NO AFILIADO"); }
                    if (persona.tramites_pendientes.length > 0 && !persona.tramites_pendientes.includes('Ninguna')) { requiereGestor = true; motivosGestor.push("Trámites pendientes"); }
                    if (persona.actividad_fisica === 'No') { requiereMedico = true; motivosMedico.push("Alerta: Sedentarismo"); }
                    if (persona.gestante === 'Sí') { requiereMedico = true; motivosMedico.push("Control Gestante"); }
                    if (persona.enfermedad_cronica && persona.enfermedad_cronica !== 'Ninguna' && persona.enfermedad_cronica !== 'Ninguno') { requiereMedico = true; motivosMedico.push("Enfermedad Crónica"); }
                    if (persona.ta_sistolica >= 140 || persona.ta_diastolica >= 90) { requiereMedico = true; motivosMedico.push("Alerta Tensión Arterial"); }
                    if (persona.imc_calc.includes('Bajo peso') || persona.imc_calc.includes('Obesidad') || persona.perim_abdominal_alerta === 'Obesidad abdominal') { requiereNutri = true; motivosNutri.push(`Riesgo Nutricional/Abdominal`); }
                    if (persona.estado_abandono === 'Sí' || persona.violencia_acoso === 'Sí' || hogar.vic_conflicto === 'Sí' || persona.consumo_spa === 'Sí') { requierePsico = true; motivosPsico.push("ALERTA: VIF/SPA/Abandono"); }

                    if (persona.edad_calc < 5) {
                        if (persona.aiepi_beber === 'No' || persona.aiepi_vomita === 'Sí' || persona.aiepi_convulsiones === 'Sí' || persona.aiepi_letargico === 'Sí' || persona.aiepi_tirajes === 'Sí' || persona.aiepi_deshidratacion === 'Sí' || parseFloat(persona.perim_braquial) < 11.5) {
                            requiereMedico = true; motivosMedico.push("🚨 AIEPI: RIESGO INMINENTE");
                        }
                        if (persona.aiepi_maltrato === 'Sí') { requierePsico = true; motivosPsico.push("🚨 AIEPI: RIESGO ENTORNO / MALTRATO"); }
                    }

                    if (requiereMedico) await db.canalizaciones.add({ id: crypto.randomUUID(), paciente_id: persona.num_doc, nombre_paciente: `${persona.primer_nombre} ${persona.primer_apellido}`, rol_destino: 'medico', microterritorio: usuario.microterritorio, estado: 'Pendiente', motivo: motivosMedico.join(", "), fecha_creacion: f_actualizacion, sincronizado: 0 });
                    if (requierePsico) await db.canalizaciones.add({ id: crypto.randomUUID(), paciente_id: persona.num_doc, nombre_paciente: `${persona.primer_nombre} ${persona.primer_apellido}`, rol_destino: 'psicologia', microterritorio: usuario.microterritorio, estado: 'Pendiente', motivo: motivosPsico.join(", "), fecha_creacion: f_actualizacion, sincronizado: 0 });
                    if (requiereGestor) await db.canalizaciones.add({ id: crypto.randomUUID(), paciente_id: persona.num_doc, nombre_paciente: `${persona.primer_nombre} ${persona.primer_apellido}`, rol_destino: 'gestor', microterritorio: usuario.microterritorio, estado: 'Pendiente', motivo: motivosGestor.join(", "), fecha_creacion: f_actualizacion, sincronizado: 0 });
                    if (requiereNutri) await db.canalizaciones.add({ id: crypto.randomUUID(), paciente_id: persona.num_doc, nombre_paciente: `${persona.primer_nombre} ${persona.primer_apellido}`, rol_destino: 'nutricionista', microterritorio: usuario.microterritorio, estado: 'Pendiente', motivo: motivosNutri.join(", "), fecha_creacion: f_actualizacion, sincronizado: 0 });
                }
            }

            // 🚀 INYECTAR LAS CANALIZACIONES MANUALES EXTRAS CREADAS POR EL PROMOTOR
            if (rutasCanalizacion.length > 0) {
                const canalizacionesAGuardar = rutasCanalizacion.map(ruta => {
                    const pac = integrantes.find(p => p.num_doc === ruta.paciente_doc);
                    return {
                        id: crypto.randomUUID(),
                        fecha_creacion: new Date().toISOString(),
                        gestor_doc: usuario.documento, // El promotor firma la alerta
                        paciente_id: ruta.paciente_doc,
                        nombre_paciente: `${pac?.primer_nombre} ${pac?.primer_apellido}`,
                        microterritorio: usuario.microterritorio,
                        rol_destino: ruta.rol_destino,
                        estado: 'Pendiente',
                        motivo: ruta.motivo, // Usamos motivo para mantener consistencia con las automáticas
                        sincronizado: 0
                    };
                });

                await db.canalizaciones.bulkAdd(canalizacionesAGuardar);
            }

            localStorage.removeItem('draft_hogar');
            localStorage.removeItem('draft_integrantes');

            if (tipoGuardado === 'borrador') {
                alert(`💾 Borrador guardado correctamente. Lo encontrará en la sección de "Fichas Pendientes".`);
            } else {
                alert(`✅ Ficha Finalizada con éxito. Triage ejecutado y rutas activadas.`);
            }
            volver();
        } catch (error) {
            console.error(error); alert("❌ Error guardando.");
        }
        setGuardando(false);
    };

    // 🚀 BLINDAJE: Verificar que el documento no exista ya en la base de datos
    const verificarDocumentoDuplicado = async (documentoStr) => {
        if (!documentoStr) return;

        const repetidos = await db.pacientes.where('numero_documento').equals(documentoStr).toArray();
        const activos = repetidos.filter(p => p.estado_ficha !== 'Desactivado'); // Ignorar los que ya fueron dados de baja

        if (activos.length > 0) {
            const pac = activos[0];
            // Si el documento pertenece a la ficha que estamos editando actualmente, no lanzar la alerta.
            if (pacientesExistentes && pacientesExistentes.some(p => p.numero_documento === documentoStr)) {
                return;
            }
            alert(`🛑 ALERTA DE DUPLICIDAD:\n\nEl documento ${documentoStr} ya está registrado en el sistema a nombre de:\n👤 ${pac.primer_nombre} ${pac.primer_apellido}\n\nPor favor, cierre este formulario, vaya a "Mi Directorio", busque a este paciente y presione "Editar" para actualizar su información en lugar de crear un duplicado.`);
        }
    };

    return (
        <div className="card" style={{ maxWidth: '950px', margin: '0 auto', backgroundColor: '#ffffff', colorScheme: 'light', color: '#1e293b' }}>
            <h2 style={{ color: 'var(--inst-blue)', marginBottom: '5px' }}>📋 Caracterización APS - Aux. de Enfermería</h2>

            {/* 🚀 BANNER INTELIGENTE DE ESTADO Y TIEMPO */}
            <div style={{ backgroundColor: bloqueado ? '#fee2e2' : (forzarEdicion ? '#e0e7ff' : (estadoActual === 'Pendiente de actualización' ? '#fffbeb' : '#f0fdf4')), border: `2px solid ${bloqueado ? '#ef4444' : (forzarEdicion ? '#4f46e5' : (estadoActual === 'Pendiente de actualización' ? '#f59e0b' : '#22c55e'))}`, padding: '10px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: bloqueado ? '#991b1b' : (forzarEdicion ? '#3730a3' : (estadoActual === 'Pendiente de actualización' ? '#92400e' : '#166534')), fontSize: '1.1rem' }}>
                    {bannerTiempo}
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#475569' }}>
                    Estado de la Ficha: <strong>{estadoActual}</strong>
                </p>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto' }}>
                <button onClick={() => setPasoForm(1)} style={{ flex: 1, padding: '10px', backgroundColor: pasoForm === 1 ? 'var(--inst-orange)' : '#e2e8f0', color: pasoForm === 1 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>🏠 1. Entorno</button>
                <button onClick={() => setPasoForm(2)} style={{ flex: 1, padding: '10px', backgroundColor: pasoForm === 2 ? 'var(--inst-blue)' : '#e2e8f0', color: pasoForm === 2 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>🫂 2. Familia</button>
                <button onClick={() => setPasoForm(3)} style={{ flex: 1, padding: '10px', backgroundColor: pasoForm === 3 ? 'var(--inst-green)' : '#e2e8f0', color: pasoForm === 3 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>👥 3. Personas ({integrantes.length})</button>
                <button onClick={() => setPasoForm(4)} style={{ flex: 1, padding: '10px', backgroundColor: pasoForm === 4 ? '#334155' : '#e2e8f0', color: pasoForm === 4 ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>✅ 4. Guardar</button>
            </div>

            <fieldset disabled={bloqueado} style={{ border: 'none', padding: 0, margin: 0, display: 'contents' }}>
                {pasoForm === 1 && (
                    <div className="form-grid">
                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>📍 B1. Ubicación y Georreferenciación</h3>
                        <div className="form-group"><label>🗺️ Zona</label><select value={hogar.territorio_zona} onChange={e => setHogar({ ...hogar, territorio_zona: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option value="">Sel...</option><option value="Urbana">Urbana</option><option value="Rural">Rural</option></select></div>
                        <div className="form-group"><label>🏘️ Barrio/Vereda</label><input type="text" value={hogar.barrio_vereda} onChange={e => setHogar({ ...hogar, barrio_vereda: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required /></div>
                        <div className="form-group"><label>📍 Dirección</label><input type="text" value={hogar.direccion} onChange={e => setHogar({ ...hogar, direccion: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required /></div>
                        <div className="form-group"><label>📊 Estrato</label><select value={hogar.estrato} onChange={e => setHogar({ ...hogar, estrato: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
                        <div className="form-group"><label>📱 Teléfono Hogar</label><input type="number" value={hogar.telefono_hogar} onChange={e => setHogar({ ...hogar, telefono_hogar: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>

                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>🏚️ B2. Entorno y Materiales</h3>
                        <div className="form-group"><label>🏠 Tipo Vivienda</label><select value={hogar.tipo_vivienda} onChange={e => setHogar({ ...hogar, tipo_vivienda: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Casa</option><option>Apartamento</option><option>Inquilinato</option><option>Otro</option></select></div>
                        <div className="form-group"><label>🧱 Material Paredes</label><select value={hogar.material_paredes} onChange={e => setHogar({ ...hogar, material_paredes: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Bloque / Ladrillo / Concreto</option><option>Bahareque / Tapia pisada</option><option>Madera pulida / Tablas</option><option>Madera burda / Esterilla</option><option>Lámina / Cartón / Desecho</option><option>Sin paredes / Otro</option></select></div>
                        <div className="form-group"><label>🦶 Material Pisos</label><select value={hogar.material_pisos} onChange={e => setHogar({ ...hogar, material_pisos: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Baldosa / Vinilo / Mármol</option><option>Madera pulida / Parquet</option><option>Cemento / Ladrillo</option><option>Madera burda / Tabla</option><option>Tierra / Arena</option><option>Otro</option></select></div>
                        <div className="form-group"><label>🛏️ Cuartos Dormir</label><input type="number" value={hogar.cuartos_dormir} onChange={e => setHogar({ ...hogar, cuartos_dormir: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                        <div className="form-group"><label>🔥 Energía Cocina</label><select value={hogar.energia_cocina} onChange={e => setHogar({ ...hogar, energia_cocina: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Gas natural</option><option>Gas propano (Pipeta)</option><option>Electricidad</option><option>Leña / Carbón</option><option>Otro</option></select></div>

                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', marginTop: '15px', borderBottom: '1px solid #e2e8f0' }}>💧 B3. Agua y Saneamiento</h3>
                        <div className="form-group"><label>🚰 Fuente Agua</label><select value={hogar.fuente_agua} onChange={e => setHogar({ ...hogar, fuente_agua: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Acueducto</option><option>Pozo</option><option>Otro</option></select></div>
                        <div className="form-group"><label>🚽 Disp. Excretas</label><select value={hogar.disp_excretas} onChange={e => setHogar({ ...hogar, disp_excretas: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Sanitario conectado al alcantarillado</option><option>Letrina / Pozo Séptico</option><option>Otro</option></select></div>
                        <div className="form-group"><label>🗑️ Disposición Basuras</label><select value={hogar.disp_basuras} onChange={e => setHogar({ ...hogar, disp_basuras: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option value="Recolección municipal">Recolección municipal</option><option value="Quema">Quema</option><option value="Entierro">Entierro</option><option value="Otro">Otro</option></select></div>
                        {hogar.disp_basuras === 'Otro' && <div className="form-group"><label>✏️ Especifique Basura</label><input type="text" value={hogar.disp_basuras_otro} onChange={e => setHogar({ ...hogar, disp_basuras_otro: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>}

                        <button type="button" onClick={() => setPasoForm(2)} className="btn-save" style={{ gridColumn: '1 / -1', marginTop: '15px' }}>Siguiente ➡️</button>
                    </div>
                )}

                {pasoForm === 2 && (
                    <div className="form-grid">
                        <h3 style={{ gridColumn: '1 / -1', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>👨‍👩‍👧‍👦 B4. Dinámica Familiar</h3>
                        <div className="form-group"><label>🧩 Tipo Familia</label><select value={hogar.tipo_familia} onChange={e => setHogar({ ...hogar, tipo_familia: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Nuclear biparental</option><option>Nuclear monoparental</option><option>Extenso biparental</option><option>Extenso monoparental</option><option>Unipersonal</option></select></div>
                        <div className="form-group"><label>🫂 ¿Hay Cuidador Principal?</label><select value={hogar.cuidador_prin} onChange={e => setHogar({ ...hogar, cuidador_prin: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>No</option><option>Sí</option></select></div>

                        {/* ALERTA DE CONFLICTO */}
                        <div className="form-group">
                            <label>🕊️ ¿Familia Víctima Conflicto?</label>
                            <select value={hogar.vic_conflicto} onChange={e => setHogar({ ...hogar, vic_conflicto: e.target.value })} style={getEstiloAlerta(hogar.vic_conflicto === 'Sí')}>
                                <option>No</option><option>Sí</option>
                            </select>
                            <AlertaHelper condicion={hogar.vic_conflicto === 'Sí'} mensaje="Genera alerta en Psicosocial" />
                        </div>

                        <div className="form-group"><label>🍲 ¿Cómo obtienen alimentos?</label><select value={hogar.seg_alimentaria} onChange={e => setHogar({ ...hogar, seg_alimentaria: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>Compra</option><option>Cultiva</option><option>Otro</option></select></div>
                        <button type="button" onClick={() => setPasoForm(3)} className="btn-save" style={{ gridColumn: '1 / -1', marginTop: '15px' }}>Siguiente ➡️</button>
                    </div>
                )}

                {pasoForm === 3 && (
                    <div>
                        {integrantes.length > 0 && (
                            <div style={{ marginBottom: '20px', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: 'var(--inst-green)' }}>✅ Familiares en esta Ficha ({integrantes.length}):</h4>
                                <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                                    {integrantes.map(i => (
                                        <li key={i.id_interno} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', padding: '10px 0', alignItems: 'center' }}>
                                            <span style={{ color: '#1e293b', fontWeight: '500' }}>👤 {i.primer_nombre} {i.primer_apellido} | 🪪 {i.num_doc}</span>

                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button type="button" onClick={() => editarIntegrante(i.id_interno)} style={{ color: 'var(--inst-blue)', background: '#e0f2fe', padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✏️ Editar</button>
                                                <button type="button" onClick={() => eliminarIntegrante(i.id_interno)} style={{ color: '#ef4444', background: '#fee2e2', padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>❌ Quitar</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <form onSubmit={agregarIntegrante} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '2px solid var(--inst-blue)' }}>
                            <h3 style={{ marginTop: 0, color: 'var(--inst-blue)' }}>➕ Identificación del Integrante</h3>
                            <div className="form-grid">
                                {/* DATOS BÁSICOS (Siempre requeridos) */}
                                <div className="form-group"><label>🪪 Tipo Doc.</label><select value={integ.tipo_doc} onChange={e => setInteg({ ...integ, tipo_doc: e.target.value })} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option value="CC">Cédula Ciudadanía</option><option value="TI">Tarjeta Identidad</option><option value="RC">Registro Civil</option><option value="CE">Cédula Extranjería</option><option value="PA">Pasaporte</option><option value="OT">Otro</option></select></div>

                                <div className="form-group">
                                    <label>🔢 Núm. Doc</label>
                                    <input
                                        type="number"
                                        value={integ.num_doc}
                                        onChange={e => setInteg({ ...integ, num_doc: e.target.value })}
                                        onBlur={(e) => verificarDocumentoDuplicado(e.target.value)}
                                        required
                                        style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}
                                    />
                                </div>

                                <div className="form-group"><label>👤 Nombres</label><input type="text" value={integ.primer_nombre} onChange={e => setInteg({ ...integ, primer_nombre: e.target.value })} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                                <div className="form-group"><label>👤 Apellidos</label><input type="text" value={integ.primer_apellido} onChange={e => setInteg({ ...integ, primer_apellido: e.target.value })} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                                <div className="form-group"><label>📅 Fecha Nacim.</label><input type="date" value={integ.fecha_nacim} onChange={e => setInteg({ ...integ, fecha_nacim: e.target.value })} required style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} /></div>
                                <div className="form-group"><label>🎂 Curso de Vida</label><input type="text" value={integ.fecha_nacim ? `${edadCalc} años - ${integ.curso_vida}` : ''} readOnly style={{ backgroundColor: '#e2e8f0', fontWeight: 'bold', color: '#334155', border: '1px solid #cbd5e1' }} /></div>

                                {/* CAMPOS DE ACTUALIZACIÓN (Requeridos SOLO al actualizar una ficha pendiente) */}
                                <h4 style={{ gridColumn: '1 / -1', borderBottom: '1px solid #ccc', marginTop: '10px', color: '#475569' }}>🏳️‍🌈 Diversidad Sexual y de Género</h4>
                                <div className="form-group"><label>Sexo asignado al nacer</label><select value={integ.sexo_asignado} onChange={e => setInteg({ ...integ, sexo_asignado: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion}><option>Femenino</option><option>Masculino</option><option>Intersexual</option><option>No sabe/no responde</option></select></div>
                                <div className="form-group"><label>Identidad de género</label><select value={integ.identidad_genero} onChange={e => setInteg({ ...integ, identidad_genero: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion}><option>Mujer</option><option>Hombre</option><option>Mujer trans</option><option>Hombre trans</option><option>No binaria</option><option>Otra</option><option>No sabe/no responde</option><option>Prefiere no responder</option></select></div>
                                <div className="form-group"><label>Orientación sexual</label><select value={integ.orientacion_sexual} onChange={e => setInteg({ ...integ, orientacion_sexual: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion}><option>Heterosexual</option><option>Gay</option><option>Lesbiana</option><option>Bisexual</option><option>Pansexual</option><option>Asexual</option><option>Otra</option><option>No sabe/no responde</option><option>Prefiere no responder</option></select></div>

                                <h4 style={{ gridColumn: '1 / -1', borderBottom: '1px solid #ccc', marginTop: '10px', color: '#475569' }}>🎓 Sociodemográficos</h4>
                                <div className="form-group"><label>👑 ¿Cabeza de Hogar?</label><select value={integ.cabeza_hogar} onChange={e => setInteg({ ...integ, cabeza_hogar: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion}><option>No</option><option>Sí</option></select></div>
                                <div className="form-group"><label>🎓 Nivel de Escolaridad</label><select value={integ.nivel_escolaridad} onChange={e => setInteg({ ...integ, nivel_escolaridad: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion}><option>Ninguno</option><option>Preescolar</option><option>Básica Primaria</option><option>Básica Secundaria</option><option>Media Académica</option><option>Técnico / Tecnólogo</option><option>Profesional</option><option>Especialización / Maestría</option></select></div>
                                <div className="form-group"><label>💼 Ocupación</label><input type="text" value={integ.ocupacion_actual} onChange={e => setInteg({ ...integ, ocupacion_actual: e.target.value })} placeholder="Escriba ocupación..." style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>

                                <h4 style={{ gridColumn: '1 / -1', borderBottom: '1px solid #ccc', marginTop: '10px', color: '#475569' }}>♿ Discapacidad y Vulnerabilidad</h4>
                                <div className="form-group"><label>Persona con Discapacidad</label><select value={integ.discapacidad} onChange={e => setInteg({ ...integ, discapacidad: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>No</option><option>Sí</option></select></div>
                                {integ.discapacidad === 'Sí' && (
                                    <>
                                        <div className="form-group"><label>Tipo de Discapacidad</label><select value={integ.tipo_discapacidad} onChange={e => setInteg({ ...integ, tipo_discapacidad: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required><option>Física</option><option>Visual</option><option>Auditiva</option><option>Sordoceguera</option><option>Intelectual</option><option>Psicosocial</option><option>Múltiple</option></select></div>
                                        <div className="form-group"><label>¿Tiene certificado?</label><select value={integ.certificado_discapacidad} onChange={e => setInteg({ ...integ, certificado_discapacidad: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}><option>No</option><option>Sí</option></select></div>
                                    </>
                                )}
                                {(integ.curso_vida === 'Adultez' || integ.curso_vida === 'Vejez' || integ.discapacidad === 'Sí') && (
                                    <div className="form-group">
                                        <label>⚠️ ¿Estado de abandono?</label>
                                        <select value={integ.estado_abandono} onChange={e => setInteg({ ...integ, estado_abandono: e.target.value })} style={getEstiloAlerta(integ.estado_abandono === 'Sí')}>
                                            <option>No</option><option>Sí</option>
                                        </select>
                                        <AlertaHelper condicion={integ.estado_abandono === 'Sí'} mensaje="Genera alerta en Psicosocial" />
                                    </div>
                                )}

                                <h4 style={{ gridColumn: '1 / -1', borderBottom: '1px solid #ccc', marginTop: '10px', color: '#475569' }}>🏃 Hábitos y Aseguramiento</h4>

                                <div className="form-group">
                                    <label>🏃 Realiza actividad física</label>
                                    <select value={integ.actividad_fisica} onChange={e => setInteg({ ...integ, actividad_fisica: e.target.value })} style={getEstiloAlerta(integ.actividad_fisica === 'No')}>
                                        <option>Sí</option><option>No</option>
                                    </select>
                                    <AlertaHelper condicion={integ.actividad_fisica === 'No'} mensaje="Genera alerta en Médico (Sedentarismo)" />
                                </div>

                                <div className="form-group"><label>🍽️ Comidas al día</label><input type="number" value={integ.comidas_diarias} onChange={e => setInteg({ ...integ, comidas_diarias: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                <div className="form-group"><label>🤝 Cuenta con red de apoyo</label><select value={integ.red_apoyo} onChange={e => setInteg({ ...integ, red_apoyo: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion}><option>Sí</option><option>No</option></select></div>

                                <div className="form-group">
                                    <label>🚬 Consumo de SPA</label>
                                    <select value={integ.consumo_spa} onChange={e => setInteg({ ...integ, consumo_spa: e.target.value })} style={getEstiloAlerta(integ.consumo_spa === 'Sí')} required={esActualizacion}>
                                        <option>No</option><option>Sí</option>
                                    </select>
                                    <AlertaHelper condicion={integ.consumo_spa === 'Sí'} mensaje="Genera alerta en Psicosocial" />
                                </div>
                                {integ.consumo_spa === 'Sí' && <div className="form-group"><label>Especifique sustancia(s)</label><input type="text" value={integ.tipo_spa} onChange={e => setInteg({ ...integ, tipo_spa: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required /></div>}

                                <div className="form-group">
                                    <label>🛑 ¿Víctima de violencia/acoso sexual?</label>
                                    <select value={integ.violencia_acoso} onChange={e => setInteg({ ...integ, violencia_acoso: e.target.value })} style={getEstiloAlerta(integ.violencia_acoso === 'Sí')} required={esActualizacion}>
                                        <option>No</option><option>Sí</option><option>No sabe / no responde</option><option>Prefiere no responder</option>
                                    </select>
                                    <AlertaHelper condicion={integ.violencia_acoso === 'Sí'} mensaje="Genera alerta en Psicosocial" />
                                </div>

                                <div className="form-group">
                                    <label>📋 Régimen Salud</label>
                                    <select value={integ.regimen_salud} onChange={e => setInteg({ ...integ, regimen_salud: e.target.value })} style={getEstiloAlerta(integ.regimen_salud === 'No afiliado')} required={esActualizacion}>
                                        <option>Subsidiado</option><option>Contributivo</option><option>Régimen especial</option><option>No afiliado</option>
                                    </select>
                                    <AlertaHelper condicion={integ.regimen_salud === 'No afiliado'} mensaje="Genera alerta al Gestor Comunitario" />
                                </div>

                                <div className="form-group"><label>🏥 EPS Actual</label><input list="lista-eps" value={integ.nombre_eps} onChange={e => setInteg({ ...integ, nombre_eps: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} />
                                    <datalist id="lista-eps"><option value="Nueva EPS" /><option value="Sanitas" /><option value="Salud Total" /><option value="Compensar" /><option value="Famisanar" /><option value="Capital Salud" /></datalist>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>📄 Trámites pendientes en salud/social</label>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: '#334155' }}>
                                        <label><input type="checkbox" value="Autorizaciones de servicios de salud" onChange={manejarTramites} checked={integ.tramites_pendientes.includes("Autorizaciones de servicios de salud")} /> Autorizaciones</label>
                                        <label><input type="checkbox" value="Asignación de citas médicas o de otras especialidades" onChange={manejarTramites} checked={integ.tramites_pendientes.includes("Asignación de citas médicas o de otras especialidades")} /> Citas</label>
                                        <label><input type="checkbox" value="Entrega de medicamentos" onChange={manejarTramites} checked={integ.tramites_pendientes.includes("Entrega de medicamentos")} /> Medicamentos</label>
                                        <label><input type="checkbox" value="Realización o entrega de resultados de exámenes y procedimientos" onChange={manejarTramites} checked={integ.tramites_pendientes.includes("Realización o entrega de resultados de exámenes y procedimientos")} /> Exámenes</label>
                                        <label><input type="checkbox" value="Visita o encuesta del SISBÉN" onChange={manejarTramites} checked={integ.tramites_pendientes.includes("Visita o encuesta del SISBÉN")} /> SISBÉN</label>
                                        <label><input type="checkbox" value="Afiliación o actualización en el sistema de salud" onChange={manejarTramites} checked={integ.tramites_pendientes.includes("Afiliación o actualización en el sistema de salud")} /> Afiliación</label>
                                        <label><input type="checkbox" value="Otra" onChange={manejarTramites} checked={integ.tramites_pendientes.includes("Otra")} /> Otra</label>
                                        <label><input type="checkbox" value="Ninguna" onChange={manejarTramites} checked={integ.tramites_pendientes.includes("Ninguna")} /> Ninguna</label>
                                    </div>
                                    {integ.tramites_pendientes.includes("Otra") && <input type="text" placeholder="Especifique trámite..." value={integ.otra_necesidad} onChange={e => setInteg({ ...integ, otra_necesidad: e.target.value })} style={{ marginTop: '8px', backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }} />}
                                    <AlertaHelper condicion={integ.tramites_pendientes.length > 0 && !integ.tramites_pendientes.includes('Ninguna')} mensaje="Genera alerta al Gestor Comunitario" />
                                </div>

                                <h4 style={{ gridColumn: '1 / -1', borderBottom: '1px solid #ccc', marginTop: '10px', color: '#475569' }}>🩺 Antropometría y Signos Vitales</h4>
                                <div className="form-group"><label>⚖️ Peso (Kg)</label><input type="number" step="0.1" value={integ.peso_kg} onChange={e => setInteg({ ...integ, peso_kg: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                <div className="form-group"><label>📏 Talla (cm)</label><input type="number" step="0.1" value={integ.talla_cm} onChange={e => setInteg({ ...integ, talla_cm: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                <div className="form-group">
                                    <label>📊 IMC (Auto)</label>
                                    <input type="text" value={integ.imc_calc} readOnly style={getEstiloAlerta(integ.imc_calc.includes('Bajo peso') || integ.imc_calc.includes('Obesidad'))} />
                                    <AlertaHelper condicion={integ.imc_calc.includes('Bajo peso') || integ.imc_calc.includes('Obesidad')} mensaje="Genera alerta en Nutrición" />
                                </div>

                                <div className="form-group"><label>📏 Perím. Abdominal (cm)</label><input type="number" step="0.1" value={integ.perim_abdominal} onChange={e => setInteg({ ...integ, perim_abdominal: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                <div className="form-group">
                                    <label>⚠️ Riesgo Abdominal</label>
                                    <input type="text" value={integ.perim_abdominal_alerta} readOnly style={getEstiloAlerta(integ.perim_abdominal_alerta.includes('Obesidad'))} />
                                    <AlertaHelper condicion={integ.perim_abdominal_alerta.includes('Obesidad')} mensaje="Genera alerta en Nutrición" />
                                </div>

                                {integ.curso_vida === 'Primera infancia' && <div className="form-group"><label>📏 Perím. Braquial (cm)</label><input type="number" step="0.1" value={integ.perim_braquial} onChange={e => setInteg({ ...integ, perim_braquial: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>}

                                <div className="form-group"><label>💓 TA Sistólica (mmHg)</label><input type="number" value={integ.ta_sistolica} onChange={e => setInteg({ ...integ, ta_sistolica: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                <div className="form-group"><label>💓 TA Diastólica (mmHg)</label><input type="number" value={integ.ta_diastolica} onChange={e => setInteg({ ...integ, ta_diastolica: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>

                                {/* SALUD FEMENINA */}
                                {integ.sexo_asignado === 'Femenino' && (
                                    <div style={{ gridColumn: '1 / -1', backgroundColor: '#fdf4ff', padding: '15px', borderRadius: '8px', border: '1px solid #fbcfe8', color: '#334155' }}>
                                        <h4 style={{ color: '#be185d', marginTop: 0 }}>🚺 Salud Femenina y Materna</h4>
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>📅 FUR (Último Período)</label>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <input type="date" disabled={integ.no_aplica_fur} value={integ.fecha_ultima_regla} onChange={e => setInteg({ ...integ, fecha_ultima_regla: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion && !integ.no_aplica_fur} />
                                                    <label style={{ display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={integ.no_aplica_fur} onChange={e => setInteg({ ...integ, no_aplica_fur: e.target.checked })} /> N/A</label>
                                                </div>
                                            </div>
                                            <div className="form-group"><label>🩺 Última Citología</label><input type="date" value={integ.fecha_ultima_citologia} onChange={e => setInteg({ ...integ, fecha_ultima_citologia: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                            <div className="form-group"><label>👐 ¿Realiza examen de mama?</label><select value={integ.examen_mama} onChange={e => setInteg({ ...integ, examen_mama: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} ><option>No</option><option>Sí</option></select></div>

                                            <div className="form-group"><label>🤰 Embarazos previos (G)</label><input type="number" value={integ.embarazos_previos} onChange={e => setInteg({ ...integ, embarazos_previos: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                            {parseInt(integ.embarazos_previos) > 0 && (
                                                <>
                                                    <div className="form-group"><label>Partos Totales (P)</label><input type="number" value={integ.num_partos} onChange={e => setInteg({ ...integ, num_partos: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                                    <div className="form-group"><label>Partos Vaginales</label><input type="number" value={integ.num_partos_vaginales} onChange={e => setInteg({ ...integ, num_partos_vaginales: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                                    <div className="form-group"><label>Cesáreas (C)</label><input type="number" value={integ.num_cesareas} onChange={e => setInteg({ ...integ, num_cesareas: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion} /></div>
                                                </>
                                            )}

                                            {integ.curso_vida !== 'Primera infancia' && integ.curso_vida !== 'Infancia' && (
                                                <div className="form-group">
                                                    <label>🤰 ¿Gestante actualmente?</label>
                                                    <select value={integ.gestante} onChange={e => setInteg({ ...integ, gestante: e.target.value })} style={getEstiloAlerta(integ.gestante === 'Sí')} required={esActualizacion} >
                                                        <option>No</option><option>Sí</option>
                                                    </select>
                                                    <AlertaHelper condicion={integ.gestante === 'Sí'} mensaje="Genera alerta en Médico (Control)" />
                                                </div>
                                            )}
                                            {integ.gestante === 'Sí' && (
                                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                                    <label>🏥 Fecha Último Control Prenatal</label>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <input type="date" disabled={integ.sin_controles_prenatales} value={integ.fecha_control_prenatal} onChange={e => setInteg({ ...integ, fecha_control_prenatal: e.target.value })} style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} required={esActualizacion && !integ.sin_controles_prenatales} />
                                                        <label style={{ display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={integ.sin_controles_prenatales} onChange={e => setInteg({ ...integ, sin_controles_prenatales: e.target.checked })} /> Sin controles</label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 👶 AIEPI (MENORES DE 5 AÑOS) */}
                                {integ.curso_vida === 'Primera infancia' && (
                                    <div style={{ gridColumn: '1 / -1', backgroundColor: '#fff1f2', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                        <h4 style={{ color: '#be123c', margin: '0 0 10px 0' }}>👶 Módulo AIEPI (Menores de 5 años)</h4>
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>¿No puede beber o tomar el pecho?</label>
                                                <select value={integ.aiepi_beber} onChange={e => setInteg({ ...integ, aiepi_beber: e.target.value })} style={getEstiloAlerta(integ.aiepi_beber === 'No')} required={esActualizacion} >
                                                    <option>Sí</option><option>No</option>
                                                </select>
                                                <AlertaHelper condicion={integ.aiepi_beber === 'No'} mensaje="Riesgo Inminente (Médico)" />
                                            </div>
                                            <div className="form-group">
                                                <label>¿Vomita todo?</label>
                                                <select value={integ.aiepi_vomita} onChange={e => setInteg({ ...integ, aiepi_vomita: e.target.value })} style={getEstiloAlerta(integ.aiepi_vomita === 'Sí')} required={esActualizacion} >
                                                    <option>No</option><option>Sí</option>
                                                </select>
                                                <AlertaHelper condicion={integ.aiepi_vomita === 'Sí'} mensaje="Riesgo Inminente (Médico)" />
                                            </div>
                                            <div className="form-group">
                                                <label>¿Ha tenido convulsiones?</label>
                                                <select value={integ.aiepi_convulsiones} onChange={e => setInteg({ ...integ, aiepi_convulsiones: e.target.value })} style={getEstiloAlerta(integ.aiepi_convulsiones === 'Sí')} required={esActualizacion} >
                                                    <option>No</option><option>Sí</option>
                                                </select>
                                                <AlertaHelper condicion={integ.aiepi_convulsiones === 'Sí'} mensaje="Riesgo Inminente (Médico)" />
                                            </div>
                                            <div className="form-group">
                                                <label>¿Letárgico o inconsciente?</label>
                                                <select value={integ.aiepi_letargico} onChange={e => setInteg({ ...integ, aiepi_letargico: e.target.value })} style={getEstiloAlerta(integ.aiepi_letargico === 'Sí')} required={esActualizacion} >
                                                    <option>No</option><option>Sí</option>
                                                </select>
                                                <AlertaHelper condicion={integ.aiepi_letargico === 'Sí'} mensaje="Riesgo Inminente (Médico)" />
                                            </div>
                                            <div className="form-group">
                                                <label>¿Tiraje subcostal?</label>
                                                <select value={integ.aiepi_tirajes} onChange={e => setInteg({ ...integ, aiepi_tirajes: e.target.value })} style={getEstiloAlerta(integ.aiepi_tirajes === 'Sí')} required={esActualizacion} >
                                                    <option>No</option><option>Sí</option>
                                                </select>
                                                <AlertaHelper condicion={integ.aiepi_tirajes === 'Sí'} mensaje="Riesgo Inminente (Médico)" />
                                            </div>
                                            <div className="form-group">
                                                <label>¿Signos de Deshidratación?</label>
                                                <select value={integ.aiepi_deshidratacion} onChange={e => setInteg({ ...integ, aiepi_deshidratacion: e.target.value })} style={getEstiloAlerta(integ.aiepi_deshidratacion === 'Sí')} required={esActualizacion} >
                                                    <option>No</option><option>Sí</option>
                                                </select>
                                                <AlertaHelper condicion={integ.aiepi_deshidratacion === 'Sí'} mensaje="Riesgo Inminente (Médico)" />
                                            </div>
                                            <div className="form-group">
                                                <label>¿Sospecha de maltrato físico/psicológico?</label>
                                                <select value={integ.aiepi_maltrato} onChange={e => setInteg({ ...integ, aiepi_maltrato: e.target.value })} style={getEstiloAlerta(integ.aiepi_maltrato === 'Sí')} required={esActualizacion} >
                                                    <option>No</option><option>Sí</option>
                                                </select>
                                                <AlertaHelper condicion={integ.aiepi_maltrato === 'Sí'} mensaje="Riesgo Entorno / Maltrato (Psicosocial)" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="form-group" style={{ gridColumn: '1/-1', marginTop: '15px' }}>
                                    <label>🤒 Enfermedad Crónica (Seleccione o escriba)</label>
                                    <input list="lista-enfermedades" value={integ.enfermedad_cronica} onChange={e => setInteg({ ...integ, enfermedad_cronica: e.target.value })} placeholder="Ej: Hipertensión, Diabetes..." style={getEstiloAlerta(integ.enfermedad_cronica !== '' && integ.enfermedad_cronica !== 'Ninguno' && integ.enfermedad_cronica !== 'Ninguna')} required={esActualizacion} />
                                    <AlertaHelper condicion={integ.enfermedad_cronica !== '' && integ.enfermedad_cronica !== 'Ninguno' && integ.enfermedad_cronica !== 'Ninguna'} mensaje="Genera alerta en Médico (Patología Crónica)" />
                                    <datalist id="lista-enfermedades">
                                        <option value="Ninguna" />
                                        <option value="Hipertensión arterial" /><option value="Enfermedad coronaria" /><option value="Insuficiencia cardíaca" /><option value="Accidente cerebrovascular (ACV)" />
                                        <option value="Diabetes mellitus" /><option value="Hipotiroidismo" /><option value="Hipertiroidismo" /><option value="Dislipidemia" /><option value="Obesidad" />
                                        <option value="Asma" /><option value="EPOC" /><option value="Enfermedades respiratorias crónicas" /><option value="Tuberculosis" />
                                        <option value="Artrosis" /><option value="Artritis" /><option value="Osteoporosis" /><option value="Dolor lumbar crónico" /><option value="Cervicalgia" /><option value="Alteraciones de columna" /><option value="Otras alteraciones musculoesqueléticas" />
                                        <option value="Depresión" /><option value="Ansiedad" /><option value="Trastorno bipolar" /><option value="Demencia" /><option value="Enfermedad de Alzheimer" /><option value="Epilepsia" /><option value="Enfermedad de Parkinson" />
                                        <option value="Cáncer de mama" /><option value="Cáncer de cuello uterino" /><option value="Cáncer de próstata" /><option value="Cáncer gástrico" /><option value="Otro cáncer" />
                                    </datalist>
                                </div>

                                <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '15px' }}>
                                    <label>📝 Observaciones Generales (Hallazgos en campo)</label>
                                    <textarea value={integ.observaciones_generales} onChange={e => setInteg({ ...integ, observaciones_generales: e.target.value })} rows="4" placeholder="Redacte cualquier hallazgo relevante del paciente, su entorno o sus respuestas..." style={{ backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}></textarea>
                                </div>

                                <button type="submit" className="btn-save" style={{ gridColumn: '1 / -1', marginTop: '20px' }}>💾 AÑADIR/ACTUALIZAR INTEGRANTE</button>
                            </div>
                        </form>
                        <div style={{ textAlign: 'right', marginTop: '15px' }}><button type="button" onClick={avanzarAlPasoFinal} className="btn-save" style={{ backgroundColor: '#334155' }}>Ir a Finalizar ➡️</button></div>
                    </div>
                )}
            </fieldset>

            {pasoForm === 4 && (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                    <h2 style={{ color: 'var(--inst-green)' }}>✅ Resumen de Caracterización</h2>
                    <p style={{ fontSize: '1.2rem', color: '#1e293b' }}>Has recopilado información para <strong>{integrantes.length} Integrantes</strong>.</p>

                    {/* 🚨 SECCIÓN DE CANALIZACIONES INMEDIATAS */}
                    <div style={{ gridColumn: '1 / -1', marginTop: '30px', marginBottom: '30px', padding: '20px', backgroundColor: '#fff7ed', border: '2px dashed #fdba74', borderRadius: '8px', textAlign: 'left' }}>
                        <h3 style={{ color: '#9a3412', marginTop: 0 }}>🚨 Activar Ruta de Atención Primaria</h3>
                        <p style={{ fontSize: '0.85rem', color: '#ea580c', marginBottom: '15px' }}>Si detectó una necesidad urgente, asigne el paciente directamente al profesional.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            <div className="form-group">
                                <label style={{ color: '#9a3412', fontWeight: 'bold' }}>Seleccionar Paciente</label>
                                <select value={nuevaRuta.paciente_doc} onChange={e => setNuevaRuta({ ...nuevaRuta, paciente_doc: e.target.value })} style={{ padding: '8px', border: '1px solid #cbd5e1', width: '100%', backgroundColor: '#fff' }}>
                                    <option value="">-- Elija un integrante --</option>
                                    {integrantes.map((p, i) => (
                                        <option key={i} value={p.num_doc}>{p.primer_nombre} {p.primer_apellido} ({p.num_doc})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label style={{ color: '#9a3412', fontWeight: 'bold' }}>Perfil Profesional</label>
                                <select value={nuevaRuta.rol_destino} onChange={e => setNuevaRuta({ ...nuevaRuta, rol_destino: e.target.value })} style={{ padding: '8px', border: '1px solid #cbd5e1', width: '100%', backgroundColor: '#fff' }}>
                                    <option value="">-- Seleccione el perfil --</option>
                                    <option value="medico">Médico General</option>
                                    <option value="psicologia">Psicología / Salud Mental</option>
                                    <option value="nutricionista">Nutrición</option>
                                    <option value="jefe_enfermeria">Enfermería</option>
                                    <option value="fisioterapeuta">Fisioterapia</option>
                                    <option value="gestor">Gestor Comunitario</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label style={{ color: '#9a3412', fontWeight: 'bold' }}>Motivo y Observación Clínica</label>
                                <input type="text" placeholder="Ej: Adulto mayor con presión elevada sin control..." value={nuevaRuta.motivo} onChange={e => setNuevaRuta({ ...nuevaRuta, motivo: e.target.value })} style={{ padding: '8px', border: '1px solid #cbd5e1', width: '100%', backgroundColor: '#fff' }} />
                            </div>
                        </div>

                        <button type="button" onClick={() => {
                            if (!nuevaRuta.paciente_doc || !nuevaRuta.rol_destino || !nuevaRuta.motivo) return alert('Llene todos los campos para asignar la canalización.');
                            setRutasCanalizacion([...rutasCanalizacion, nuevaRuta]);
                            setNuevaRuta({ paciente_doc: '', rol_destino: '', motivo: '' });
                        }}
                            style={{ backgroundColor: '#ea580c', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' }}>
                            ➕ Añadir Alerta al Sistema
                        </button>

                        {rutasCanalizacion.length > 0 && (
                            <ul style={{ marginTop: '15px', paddingLeft: '20px', color: '#9a3412', fontSize: '0.9rem' }}>
                                {rutasCanalizacion.map((ruta, i) => {
                                    const pac = integrantes.find(p => p.num_doc === ruta.paciente_doc);
                                    return <li key={i} style={{ marginBottom: '5px' }}>
                                        <strong>{pac?.primer_nombre} {pac?.primer_apellido}</strong> ➡️ {ruta.rol_destino.toUpperCase()} (<em>{ruta.motivo}</em>)
                                        <button type="button" onClick={() => setRutasCanalizacion(rutasCanalizacion.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', marginLeft: '10px' }}>❌ Quitar</button>
                                    </li>
                                })}
                            </ul>
                        )}
                    </div>

                    {!bloqueado && (
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => setPasoForm(3)} className="btn-back" style={{ margin: 0 }}>⬅ Volver</button>

                            {/* 🚀 BOTÓN: BORRADOR (Incompleto) */}
                            <button
                                type="button"
                                onClick={() => procesarGuardado('borrador')}
                                disabled={guardando}
                                className="btn-save"
                                style={{ margin: 0, padding: '15px 30px', fontSize: '1.1rem', backgroundColor: '#f59e0b' }}>
                                💾 GUARDAR INCOMPLETO (Borrador)
                            </button>

                            {/* 🚀 BOTÓN: DEFINITIVO (Dispara Triage) */}
                            <button
                                type="button"
                                onClick={() => procesarGuardado('definitiva')}
                                disabled={guardando || integrantes.length === 0}
                                className="btn-save"
                                style={{ margin: 0, padding: '15px 30px', fontSize: '1.1rem', backgroundColor: 'var(--inst-green)' }}>
                                {guardando ? 'Ejecutando Triage...' : '✅ GUARDAR FICHA DEFINITIVA'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}