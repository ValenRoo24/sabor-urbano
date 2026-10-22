const DIAS_CLAVE = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

export class ScheduleService {
    static evaluateStatus(horariosSemana) {
        if (!horariosSemana) {
            return { isOpen: true, text: '' };
        }

        const now = new Date();
        const currentDayKey = DIAS_CLAVE[now.getDay()];
        const dayData = horariosSemana[currentDayKey];
        const currentMins = now.getHours() * 60 + now.getMinutes();

        let isOpen = false;
        let turnosTxt = [];

        if (dayData && dayData.activo && dayData.turnos && dayData.turnos.length > 0) {
            dayData.turnos.forEach(t => {
                const [sH, sM] = t.inicio.split(':').map(Number);
                const [eH, eM] = t.fin.split(':').map(Number);

                const startMins = sH * 60 + sM;
                let endMins = eH * 60 + eM;

                if (endMins <= startMins) endMins += 24 * 60;

                let testMins = currentMins;
                if (currentMins < startMins && endMins >= 24 * 60) testMins += 24 * 60;

                if (testMins >= startMins && testMins < endMins) {
                    isOpen = true;
                }

                turnosTxt.push(`${t.inicio} hs a ${t.fin} hs`);
            });

            return {
                isOpen,
                text: turnosTxt.join(' / '),
                dayKey: currentDayKey
            };
        }

        return {
            isOpen: false,
            text: 'Hoy el comercio se encuentra cerrado.',
            dayKey: currentDayKey
        };
    }
}