import Dexie from 'dexie';

// Definimos la base de datos local
export const db = new Dexie('HospitalDB');

// IMPORTANTE: Cambiamos a version(2) para agregar la nueva tabla sin perder datos
db.version(2).stores({
    visitas: '++id, uuid, fecha, modulo, paciente, sincronizado',
    profesionales: 'documento, nombre, cargo' // <-- NUEVA TABLA
});