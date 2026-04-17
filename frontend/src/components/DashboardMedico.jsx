import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export default function DashboardMedico({ usuario, onAbrirHistoria }) {
    const [filtroEstado, setFiltroEstado] = useState('Pendiente');
    const tareas = useLiveQuery(() => db.canalizaciones.where('rol_destino').equals(usuario.rol === 'medico' ? 'medico' : 'psicosocial').filter(tarea => tarea.microterritorio === usuario.microterritorio && tarea.estado === filtroEstado).reverse().toArray(), [usuario, filtroEstado]);

    return (
        <div className="card" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
                <div><h2 style={{ color: 'var(--inst-blue)', margin: '0 0 5px 0' }}>🩺 Listado Maestro de Canalizaciones</h2><p style={{ color: '#64748b', margin: 0 }}>Microterritorio: <strong>{usuario.microterritorio}</strong></p></div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setFiltroEstado('Pendiente')} style={{ backgroundColor: filtroEstado === 'Pendiente' ? 'var(--inst-orange)' : '#e2e8f0', color: filtroEstado === 'Pendiente' ? 'white' : '#64748b', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>🔴 Pendientes</button>
                    <button onClick={() => setFiltroEstado('Atendido')} style={{ backgroundColor: filtroEstado === 'Atendido' ? 'var(--inst-green)' : '#e2e8f0', color: filtroEstado === 'Atendido' ? 'white' : '#64748b', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>✅ Atendidos</button>
                </div>
            </div>

            {!tareas ? (<p style={{ textAlign: 'center' }}>Cargando...</p>) : tareas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '2px dashed #cbd5e1' }}><h3 style={{ color: 'var(--inst-green)' }}>¡Todo al día! 🎉</h3><p>No hay pacientes pendientes.</p></div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead><tr style={{ backgroundColor: 'var(--inst-blue)', color: 'white' }}><th>Fecha</th><th>Documento</th><th>Paciente</th><th>Motivo</th><th>Acción</th></tr></thead>
                    <tbody>
                        {tareas.map((tarea) => (
                            <tr key={tarea.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px' }}>{new Date(tarea.fecha_creacion).toLocaleDateString()}</td>
                                <td style={{ padding: '12px' }}>{tarea.paciente_id}</td>
                                <td style={{ padding: '12px' }}>{tarea.nombre_paciente}</td>
                                <td style={{ padding: '12px' }}><span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '4px' }}>{tarea.motivo}</span></td>
                                <td style={{ padding: '12px' }}>{filtroEstado === 'Pendiente' ? (<button onClick={() => onAbrirHistoria(tarea)} style={{ backgroundColor: 'var(--inst-green)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>📝 Abrir Historia</button>) : (<span>✅ Atendido</span>)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}