import Dexie from 'dexie';

export const db = new Dexie('HospitalAPS_Mosquera');

// Versión 4: Estructura completa para los 5 perfiles
db.version(4).stores({
    profesionales: 'documento, nombre, rol, territorio_asignado',
    viviendas: 'id, microterritorio, direccion, gps, sincronizado',
    hogares: 'id, vivienda_id, microterritorio, tipo_familia, sincronizado',
    pacientes: 'numero_documento, hogar_id, microterritorio, primer_nombre, primer_apellido, sincronizado',
    canalizaciones: 'id, paciente_id, rol_destino, microterritorio, estado, motivo, fecha_creacion, sincronizado',
    form_clinico: 'id_atencion, paciente_id, profesional_doc, fecha, sincronizado',
    form_psicosocial: 'id_intervencion, paciente_id, profesional_doc, fecha, sincronizado',
    form_seguimiento: 'id_seguimiento, canalizacion_id, paciente_id, fecha, sincronizado',
    cartografias: 'id, microterritorio, gestor_doc, fecha, sincronizado'
});