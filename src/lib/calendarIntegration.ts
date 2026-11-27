/**
 * Utilitários para integração com Google Agenda e calendários padrão (iCal / .ics)
 */

export type CalendarEventData = {
  title: string;
  description?: string;
  location?: string;
  startDate: Date | string;
  endDate?: Date | string;
  allDay?: boolean;
};

/**
 * Converte com segurança string (ISO, YYYY-MM-DD, DD/MM/YYYY) ou Date em um objeto Date válido.
 */
export function ensureDate(val: Date | string | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'string') {
    // Caso venha em formato DD/MM/YYYY
    const brMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (brMatch) {
      const [, d, m, y, hr, min] = brMatch;
      return new Date(Number(y), Number(m) - 1, Number(d), hr ? Number(hr) : 9, min ? Number(min) : 0);
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function formatGoogleDate(dateInput: Date | string, allDay = false): string {
  const date = ensureDate(dateInput);
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Gera URL direta para criar evento no Google Agenda web / mobile
 */
export function buildGoogleCalendarUrl(event: CalendarEventData): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const startObj = ensureDate(event.startDate);
  const start = formatGoogleDate(startObj, event.allDay);
  
  // Se allDay, o Google espera a data final como o dia seguinte ou a mesma data
  const end = event.endDate
    ? formatGoogleDate(event.endDate, event.allDay)
    : event.allDay
    ? formatGoogleDate(new Date(startObj.getTime() + 24 * 60 * 60 * 1000), true)
    : formatGoogleDate(new Date(startObj.getTime() + 60 * 60 * 1000), false);

  const dates = `${start}/${end}`;

  const params = new URLSearchParams({
    text: event.title,
    dates,
    details: event.description ?? '',
    location: event.location ?? '',
  });

  return `${base}&${params.toString()}`;
}

/**
 * Gera e baixa arquivo padrão iCalendar (.ics) para Outlook, Apple Calendar e Google Calendar
 */
export function downloadIcsFile(event: CalendarEventData, fileName = 'evento.ics'): void {
  const startObj = ensureDate(event.startDate);
  const start = formatGoogleDate(startObj, event.allDay);
  const end = event.endDate
    ? formatGoogleDate(event.endDate, event.allDay)
    : event.allDay
    ? formatGoogleDate(new Date(startObj.getTime() + 24 * 60 * 60 * 1000), true)
    : formatGoogleDate(new Date(startObj.getTime() + 60 * 60 * 1000), false);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JurisCore//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@juriscore.app`,
    `DTSTAMP:${formatGoogleDate(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${(event.description ?? '').replace(/\n/g, '\\n')}`,
    `LOCATION:${(event.location ?? '').replace(/\n/g, ' ')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName.endsWith('.ics') ? fileName : `${fileName}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
