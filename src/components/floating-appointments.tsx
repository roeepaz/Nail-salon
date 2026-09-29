import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toDateKey, SERVICES } from "@/lib/salon";
import { Badge } from "@/components/ui/badge";

function getBadge(status: string) {
  if (status === "confirmed") {
    return { label: "מאושר ✓", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" };
  }
  if (status === "canceled") {
    return {
      label: "מבוטל",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    };
  }
  return { label: "ממתין ⏳", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium" };
}

export function FloatingAppointments() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const bookingsQuery = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", user!.id)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  if (!mounted || !user || !bookingsQuery.data) return null;

  const todayKey = toDateKey(new Date());
  const upcoming = bookingsQuery.data.filter(
    (b) => b.appointment_date >= todayKey && b.status !== "canceled",
  );

  if (upcoming.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all hover:scale-105 active:scale-95 animate-in slide-in-from-bottom-5 fade-in duration-500"
        style={{ backgroundColor: "#ffb6c1", color: "white" }}
        aria-label="התורים שלי"
      >
        <CalendarDays className="size-7" />
        <span className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground border-[3px] border-white dark:border-background shadow-sm">
          {upcoming.length}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-[12px] transition-opacity" 
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="relative w-full max-w-sm rounded-[2rem] bg-white/70 dark:bg-black/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 p-6 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] animate-in zoom-in-95 fade-in duration-300 text-right"
            dir="rtl"
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 left-4 rounded-full p-2.5 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
            >
              <X className="size-4 text-foreground" />
            </button>
            
            <h3 className="text-2xl font-display font-semibold mb-1 pr-1 text-foreground">התורים שלך</h3>
            <p className="text-sm text-muted-foreground mb-6 pr-1">ריכזנו עבורך את התורים הקרובים</p>
            
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1 -mr-1 custom-scrollbar">
              {upcoming.map((item) => {
                const serviceInfo = SERVICES.find(
                  (s) => s.id === item.service_type || s.name === item.service_type,
                );
                const badge = getBadge(item.status);
                
                return (
                  <div key={item.id} className="rounded-2xl bg-white/60 dark:bg-black/40 border border-white/40 dark:border-white/5 p-4 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80 dark:hover:bg-black/60">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{serviceInfo?.name || item.service_type}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="size-3.5" />
                          <span className="font-medium text-foreground/80">
                            {format(
                              new Date(`${item.appointment_date}T00:00:00`),
                              "EEEE, d בMMM",
                              { locale: he },
                            )}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-foreground/80">{item.appointment_time.slice(0, 5)}</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2.5 py-0.5 text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
