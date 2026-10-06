import Dexie from 'dexie';

export const db = new Dexie('HospitalAPS');

// Incrementamos a versión 4 para aplicar el nuevo índice
db.version(5).stores({
    profesionales: 'documento, nombre, rol',
    // Se agregan índices para jornada_id y estado_ficha
    hogares: 'id, promotor_doc, territorio, microterritorio, jornada_id, estado_ficha, sincronizado',
    pacientes: 'numero_documento, hogar_id, microterritorio, jornada_id, estado_ficha, sincronizado',

    // 🚀 AQUÍ ESTÁ EL ARREGLO: Agregamos gestor_doc a los índices
    canalizaciones: 'id, paciente_id, rol_destino, microterritorio, estado, gestor_doc, sincronizado',

    form_clinico: 'id_atencion, paciente_id, profesional_doc, especialidad, estado_ficha, sincronizado',
    form_psicosocial: 'id_intervencion, paciente_id, profesional_doc, estado_ficha, sincronizado',
    cartografias: 'id, gestor_doc, territorio, microterritorio, sincronizado',

    // NUEVAS TABLAS FASE 1
    jornadas: 'id, microterritorio, nombre, fecha_creacion, estado, sincronizado',
    config_correos: '++id, eps, cargo, nombre, correo, tipo_copia',
    auditoria: '++id, fecha_hora, usuario_doc, accion, modulo'
});

// EVENTO DE POBLACIÓN: Se ejecuta la primera vez que se crea la BD o la Tabla
db.on('populate', async () => {
    await db.config_correos.bulkAdd([
        { eps: 'SANITAS', cargo: 'ASESOR MEDICO APS', nombre: 'DOCTORA MARIA KARINA SALAZAR', correo: 'mksalazar@epssanitas.com', tipo_copia: 'Principal' },
        { eps: 'SANITAS', cargo: 'ASESOR MEDICO APS', nombre: 'DRA SILVIA MANTILLA CALDERON', correo: 'smmantilla@epssanitas.com', tipo_copia: 'Principal' },
        { eps: 'COMPENSAR', cargo: 'JEFE ENCARGADA SALUD PUBLICA', nombre: 'N/A', correo: 'Saludpublicaeps008@compensarsalud.com', tipo_copia: 'Principal' },
        { eps: 'SALUD TOTAL', cargo: 'ENFERMERA DE POAS', nombre: 'N/A', correo: 'EnfePoas@saludtotal.com.co', tipo_copia: 'Principal' },
        { eps: 'FAMISANAR', cargo: 'JEFE APS', nombre: 'DIANA MARCELA GONZALEZ', correo: 'dgonzaleza@famisanar.com.co', tipo_copia: 'Principal' },
        { eps: 'NUEVA EPS', cargo: 'JEFE', nombre: 'PAULA CASTILLO', correo: 'paula.castillo@nuevaeps.com.co', tipo_copia: 'Principal' },
        { eps: 'TODAS', cargo: 'IPS PRIMARIA', nombre: 'Consulta Externa María Auxiliadora', correo: 'consultaexterna@esemariaauxiliadora.gov.co', tipo_copia: 'Principal' },
        { eps: 'TODAS', cargo: 'SALUD PÚBLICA', nombre: 'Dirección de Salud Pública', correo: 'saludpublica@mosquera-cundinamarca.gov.co', tipo_copia: 'Copia' }
    ]);
});