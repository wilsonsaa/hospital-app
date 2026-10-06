import { useState, useEffect } from 'react';

export function useEstadoFicha(fechaCreacion, estadoActual) {
    const [bloqueado, setBloqueado] = useState(false);
    const [tiempoRestante, setTiempoRestante] = useState('');

    useEffect(() => {
        // Si es una ficha nueva (aún no guardada), obviamente no está bloqueada
        if (!fechaCreacion) {
            setBloqueado(false);
            setTiempoRestante('Ficha nueva - Tendrá 7 días para completarla tras guardar.');
            return;
        }

        const calcularEstado = () => {
            const creacion = new Date(fechaCreacion).getTime();
            const limite = creacion + (7 * 24 * 60 * 60 * 1000); // 7 días exactos
            const ahora = Date.now();

            if (estadoActual === 'Bloqueada' || ahora > limite) {
                setBloqueado(true);
                setTiempoRestante('🔒 Ficha bloqueada: el período de actualización ha finalizado.');
            } else {
                setBloqueado(false);
                const dias = Math.ceil((limite - ahora) / (1000 * 60 * 60 * 24));
                setTiempoRestante(`⏳ Quedan ${dias} día(s) permitidos para editar o completar esta ficha.`);
            }
        };

        calcularEstado();
        // Recalcular cada hora automáticamente por si el usuario deja la tablet encendida
        const intervalo = setInterval(calcularEstado, 3600000);
        return () => clearInterval(intervalo);
    }, [fechaCreacion, estadoActual]);

    return { bloqueado, tiempoRestante };
}