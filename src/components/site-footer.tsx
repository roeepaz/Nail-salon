import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3">
        <div>
          <h3 className="font-display text-2xl font-medium">אליאל ביוטי</h3>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            סטודיו בוטיק לטיפוח ויצירת ציפורניים מושלמות, בריאות ועמידות לאורך זמן.
          </p>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-primary" /> דיזנגוף 120, תל אביב
          </p>
          <p className="flex items-center gap-2">
            <Phone className="size-4 shrink-0 text-primary" /> 050-000-0000
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
        © {new Date().getFullYear()} אליאל ביוטי — כל הזכויות שמורות.
      </p>
    </footer>
  );
}
