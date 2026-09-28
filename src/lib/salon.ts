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
    name: "לק ג'ל",
    price: "₪140",
    duration: "60 דק'",
    description:
      "מניקור קלאסי יסודי כולל סידור ועיצוב הציפורן, טיפוח הקוטיקולה ומריחת לק ג'ל מבריק ועמיד.",
  },
  {
    id: "Structure Gel",
    name: "מבנה אנטומי",
    price: "₪200",
    duration: "90 דק'",
    description: "חיזוק הציפורן הטבעית בראבר/ביילדר ג'ל למבנה מושלם, עמידות מקסימלית וחוזק.",
  },
  {
    id: "Gel Extensions",
    name: "בנייה בג'ל",
    price: "₪250",
    duration: "120 דק'",
    description: "הארכת ציפורניים מלאה במבנה ובצורה המועדפת עלייך בגימור ג'ל יוקרתי.",
  },
  {
    id: "Pedicure",
    name: "פדיקור",
    price: "₪160",
    duration: "60 דק'",
    description: "פדיקור ספא מפנק ומרגיע כולל פילינג, טיפוח כף הרגל וציפורניים ומריחת ג'ל.",
  },
  {
    id: "Soak Off & Care",
    name: "הסרה וטיפוח",
    price: "₪70",
    duration: "30 דק'",
    description: "הסרה עדינה ומקצועית של הג'ל עם טיפול שיקום והזנה לציפורניים.",
  },
];

export const SLOT_MINUTES = 45;

export const DAY_NAMES = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
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
