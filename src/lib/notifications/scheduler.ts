/**
 * Appointment Reminder Scheduler Logic
 * Handles timezone conversion, reminder window calculation, and batch processing.
 */

export interface AppointmentSlot {
  id: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:MM:SS or HH:MM
  status: string;
  user_id: string | null;
  client_name: string;
  client_phone: string;
}

export interface ReminderDecision {
  appointmentId: string;
  send24hReminder: boolean;
  send1hReminder: boolean;
  reason?: string;
}

export interface SchedulerOptions {
  windowMinutes24h?: number;
  windowMinutes1h?: number;
  timezone?: string;
  now?: Date;
}

/**
 * Calculates the exact UTC timestamp for an appointment date and time in a specific timezone
 */
export function getAppointmentUtcTimestamp(
  dateStr: string,
  timeStr: string,
  timezone = "Asia/Jerusalem",
): number {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const [hourStr, minStr] = timeStr.slice(0, 5).split(":");

  const year = Number(yearStr) || 2026;
  const month = Number(monthStr) || 1;
  const day = Number(dayStr) || 1;
  const hours = Number(hourStr) || 0;
  const minutes = Number(minStr) || 0;

  // Use Intl to determine the timezone offset for the given date/time
  const targetDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  // Determine actual local time in the specified timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(targetDate);
  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

  const localHour = getPart("hour");
  const localMinute = getPart("minute");

  // Offset between UTC representation and target timezone
  const diffMinutes = (localHour - hours) * 60 + (localMinute - minutes);
  const correctedUtcMs = targetDate.getTime() - diffMinutes * 60 * 1000;

  return correctedUtcMs;
}

/**
 * Evaluates whether an appointment should receive a 24h or 1h reminder right now
 */
export function evaluateAppointmentReminder(
  appointment: AppointmentSlot,
  options: SchedulerOptions = {},
): ReminderDecision {
  if (appointment.status === "canceled") {
    return {
      appointmentId: appointment.id,
      send24hReminder: false,
      send1hReminder: false,
      reason: "Appointment is canceled",
    };
  }

  const windowMinutes24h = options.windowMinutes24h ?? 10;
  const windowMinutes1h = options.windowMinutes1h ?? 10;
  const timezone = options.timezone ?? "Asia/Jerusalem";
  const now = options.now ? options.now.getTime() : Date.now();

  const appointmentUtcMs = getAppointmentUtcTimestamp(
    appointment.appointment_date,
    appointment.appointment_time,
    timezone,
  );

  const diffMs = appointmentUtcMs - now;
  const diffMinutes = diffMs / (60 * 1000);

  // 24 hours = 1440 minutes
  // Reminder window: [1440 - windowMinutes24h, 1440 + windowMinutes24h]
  const target24hMin = 1440;
  const in24hWindow =
    diffMinutes >= target24hMin - windowMinutes24h &&
    diffMinutes <= target24hMin + windowMinutes24h;

  // 1 hour = 60 minutes
  // Reminder window: [60 - windowMinutes1h, 60 + windowMinutes1h]
  const target1hMin = 60;
  const in1hWindow =
    diffMinutes >= target1hMin - windowMinutes1h &&
    diffMinutes <= target1hMin + windowMinutes1h;

  return {
    appointmentId: appointment.id,
    send24hReminder: in24hWindow,
    send1hReminder: in1hWindow,
    reason: `Time difference: ${Math.round(diffMinutes)} minutes to appointment`,
  };
}
