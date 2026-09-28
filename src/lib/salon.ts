export type Service = {
  id: string;
  name: string;
  price: string;
  duration: string;
  description: string;
};

export const SERVICES: Service[] = [
  {
    id: "Gel Polish",
    name: "Gel Polish",
    price: "₪140",
    duration: "60 min",
    description:
      "Classic gel manicure with shaping, cuticle care and a long-lasting glossy finish.",
  },
  {
    id: "Structure Gel",
    name: "Structure Gel",
    price: "₪200",
    duration: "90 min",
    description: "Reinforced natural nail with builder gel for strength, shape and durability.",
  },
  {
    id: "Gel Extensions",
    name: "Gel Extensions",
    price: "₪250",
    duration: "120 min",
    description: "Full length extensions sculpted to your preferred shape and finished in gel.",
  },
  {
    id: "Pedicure",
    name: "Pedicure",
    price: "₪160",
    duration: "60 min",
    description: "Relaxing spa pedicure with exfoliation, nail care and gel colour.",
  },
  {
    id: "Soak Off & Care",
    name: "Soak Off & Care",
    price: "₪70",
    duration: "30 min",
    description: "Gentle gel removal with nourishing treatment for tired nails.",
  },
];

export const SLOT_MINUTES = 45;

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "09:00:00" | "09:00" -> "09:00" */
export function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minutesOf(time: string): number {
  const parts = normalizeTime(time).split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function fromMinutes(total: number): string {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function buildDaySlots(open: string, close: string): string[] {
  const slots: string[] = [];
  const end = minutesOf(close);
  for (let t = minutesOf(open); t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
    slots.push(fromMinutes(t));
  }
  return slots;
}

export function isPastSlot(dateKey: string, time: string, now = new Date()): boolean {
  if (dateKey > toDateKey(now)) return false;
  if (dateKey < toDateKey(now)) return true;
  return minutesOf(time) <= now.getHours() * 60 + now.getMinutes();
}

export function formatTimeLabel(time: string): string {
  return normalizeTime(time);
}
