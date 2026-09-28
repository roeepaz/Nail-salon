import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SERVICES as STATIC_SERVICES } from "@/lib/salon";
import type { Service } from "@/lib/salon";

// ── Salon settings ─────────────────────────────────────
export type SalonInfo = {
  salon_name: string;
  salon_address: string;
  salon_phone: string;
  salon_tagline: string;
  salon_about: string;
};

const DEFAULTS: SalonInfo = {
  salon_name: "אליאל ביוטי",
  salon_address: "דיזנגוף 120, תל אביב",
  salon_phone: "050-000-0000",
  salon_tagline: "סטודיו בוטיק לציפורניים וטיפוח",
  salon_about: "סטודיו בוטיק לטיפוח ויצירת ציפורניים מושלמות, בריאות ועמידות לאורך זמן.",
};

export function useSalonInfo() {
  return useQuery({
    queryKey: ["salon_settings"],
    staleTime: 1000 * 60 * 5, // 5 min cache
    queryFn: async (): Promise<SalonInfo> => {
      const { data, error } = await supabase.from("salon_settings").select("*");
      if (error || !data?.length) return DEFAULTS;
      const map: Record<string, string> = {};
      data.forEach((r) => { map[r.key] = r.value; });
      return { ...DEFAULTS, ...map };
    },
  });
}

// ── Services ────────────────────────────────────────────
export type DBService = {
  id: string;
  name: string;
  price: string;
  duration: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

/** Maps DB service to the legacy Service shape used throughout the app */
function toService(s: DBService): Service {
  return {
    id: s.id,
    name: s.name,
    price: s.price,
    duration: s.duration,
    description: s.description,
  };
}

export function useServices(opts?: { activeOnly?: boolean }) {
  const activeOnly = opts?.activeOnly ?? true;
  return useQuery({
    queryKey: ["db_services", activeOnly],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error || !data?.length) return STATIC_SERVICES; // fallback to static
      const rows = data as DBService[];
      const filtered = activeOnly ? rows.filter((s) => s.is_active) : rows;
      return filtered.map(toService);
    },
  });
}

// ── Gallery images ──────────────────────────────────────
export type GalleryImage = {
  id: string;
  url: string;
  alt_text: string;
  sort_order: number;
};

export function useGalleryImages() {
  return useQuery({
    queryKey: ["gallery_images"],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<GalleryImage[]> => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) return [];
      return (data ?? []) as GalleryImage[];
    },
  });
}
