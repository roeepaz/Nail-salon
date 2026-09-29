import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Phone } from "lucide-react";
import { useSalonInfo } from "@/hooks/use-salon-data";


export function SiteFooter() {
  const { data: info } = useSalonInfo();
  const address = info?.salon_address ?? "דיזנגוף 120, תל אביב";
  const phone   = info?.salon_phone   ?? "050-000-0000";
  const name    = info?.salon_name    ?? "אליאל ביוטי";
  const about   = info?.salon_about   ?? "סטודיו בוטיק לטיפוח ויצירת ציפורניים מושלמות, בריאות ועמידות לאורך זמן.";

  return (
    <footer className="border-t border-border/60 bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3">
        <div>
          <h3 className="font-display text-2xl font-medium">{name}</h3>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{about}</p>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-primary" /> {address}
          </p>
          <p className="flex items-center gap-2">
            <Phone className="size-4 shrink-0 text-primary" /> {phone}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-primary" /> ימים א׳–ה׳, 09:00–18:00
          </p>
        </div>
        <div className="text-sm">
          <Link to="/book" className="text-primary font-medium hover:underline">
            קביעת תור אונליין
          </Link>
          <br />
          <Link to="/auth" className="mt-2 inline-block text-muted-foreground hover:underline">
            כניסת מנהלת סטודיו
          </Link>
        </div>
      </div>
      <p className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} אליאל ביוטי - כל הזכויות שמורות.
      </p>
    </footer>
  );
}
