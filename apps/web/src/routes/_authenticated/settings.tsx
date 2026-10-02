import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  GalleryHorizontalEnd,
  ImagePlus,
  Info,
  LayoutList,
  Loader2,
  LogOut,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@nail-salon/api';
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "עריכה - ניהול סטודיו אליאל ביוטי" },
      { name: "description", content: "ניהול פרטי הסטודיו, תפריט טיפולים וגלריה." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type SalonSettings = Record<string, string>;

type DBService = {
  id: string;
  name: string;
  price: string;
  duration: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

type GalleryImage = {
  id: string;
  url: string;
  alt_text: string;
  sort_order: number;
};

function SettingsPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !isAdmin) {
      toast.error("גישה עריכה מוגבלת למנהלים בלבד.");
      void navigate({ to: "/my-bookings", replace: true });
    }
  }, [isAdmin, isAuthLoading, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  if (isAuthLoading) return null;

  return (
    <div className="min-h-screen bg-background text-right" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <Settings2 className="size-5 shrink-0 text-primary" />
            <span className="truncate font-display text-xl font-medium tracking-wide">
              עריכה - ניהול סטודיו
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="shrink-0 rounded-full gap-1.5"
              onClick={() => void navigate({ to: "/dashboard" })}>
              <Sparkles className="size-4" /> לוח ניהול
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0 rounded-full gap-1.5" onClick={signOut}>
              <LogOut className="size-4" /> התנתקות
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="rounded-full">
            <TabsTrigger value="info" className="rounded-full gap-1.5">
              <Info className="size-3.5" /> פרטי הסטודיו
            </TabsTrigger>
            <TabsTrigger value="services" className="rounded-full gap-1.5">
              <LayoutList className="size-3.5" /> טיפולים
            </TabsTrigger>
            <TabsTrigger value="gallery" className="rounded-full gap-1.5">
              <GalleryHorizontalEnd className="size-3.5" /> גלריה
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-6"><SalonInfoPanel /></TabsContent>
          <TabsContent value="services" className="mt-6"><ServicesPanel /></TabsContent>
          <TabsContent value="gallery" className="mt-6"><GalleryPanel /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const SETTING_KEYS = [
  { key: "salon_name",    label: "שם הסטודיו",    type: "input" as const },
  { key: "salon_tagline", label: "כותרת משנה",     type: "input" as const },
  { key: "salon_address", label: "כתובת",          type: "input" as const },
  { key: "salon_phone",   label: "טלפון",          type: "input" as const },
  { key: "salon_about",   label: "אודות הסטודיו",  type: "textarea" as const },
];

function SalonInfoPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SalonSettings>({});
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["salon_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salon_settings").select("*");
      if (error) throw error;
      const map: SalonSettings = {};
      (data ?? []).forEach((r) => { map[r.key] = r.value; });
      return map;
    },
  });

  useEffect(() => {
    if (data) { setDraft(data); setDirty(false); }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(draft)) {
        const { error } = await supabase
          .from("salon_settings")
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) {
          console.error("Upsert error:", error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("פרטי הסטודיו נשמרו ✨");
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["salon_settings"] });
    },
    onError: (err) => { console.error("save settings error:", err); toast.error("שגיאה בשמירת הפרטים"); },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="shadow-card rounded-3xl border border-border bg-card p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-medium">פרטי הסטודיו</h2>
        <p className="mt-1 text-sm text-muted-foreground">מידע זה יוצג בעמוד הראשי ובפוטר האתר.</p>
      </div>
      <div className="space-y-5 max-w-lg">
        {SETTING_KEYS.map(({ key, label, type }) => (
          <div key={key}>
            <Label htmlFor={`setting_${key}`}>{label}</Label>
            {type === "textarea" ? (
              <Textarea id={`setting_${key}`} className="mt-2 min-h-[90px] text-right"
                value={draft[key] ?? ""}
                onChange={(e) => { setDraft((p) => ({ ...p, [key]: e.target.value })); setDirty(true); }} />
            ) : (
              <Input id={`setting_${key}`} className="mt-2 text-right"
                value={draft[key] ?? ""}
                onChange={(e) => { setDraft((p) => ({ ...p, [key]: e.target.value })); setDirty(true); }} />
            )}
          </div>
        ))}
      </div>
      <Button className="mt-8 rounded-full px-6 gap-1.5" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        שמירת שינויים
      </Button>
    </div>
  );
}

const EMPTY_FORM = { name: "", price: "", duration: "", description: "" };

function ServicesPanel() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DBService | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = useState<DBService | null>(null);

  const services = useQuery({
    queryKey: ["db_services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as DBService[];
    },
  });

  const saveService = useMutation({
    mutationFn: async (svc: Partial<DBService> & { id?: string }) => {
      if (svc.id) {
        const { error } = await supabase.from("services")
          .update({ ...svc, updated_at: new Date().toISOString() }).eq("id", svc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert({
          name: svc.name ?? "",
          price: svc.price ?? "",
          duration: svc.duration ?? "",
          description: svc.description ?? "",
          sort_order: services.data?.length ?? 0,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("הטיפול נשמר ✨");
      void queryClient.invalidateQueries({ queryKey: ["db_services"] });
      setEditing(null); setCreating(false); setForm(EMPTY_FORM);
    },
    onError: (err) => {
      console.error("saveService error:", err);
      toast.error("שגיאה בשמירת הטיפול - בדקי את ה-console");
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הטיפול נמחק");
      void queryClient.invalidateQueries({ queryKey: ["db_services"] });
      setPendingDelete(null);
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("services").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["db_services"] }),
    onError: () => toast.error("שגיאה בעדכון הסטטוס"),
  });

  const moveService = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const list = services.data ?? [];
      const idx = list.findIndex((s) => s.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= list.length) return;
      const a = list[idx]!; const b = list[swapIdx]!;
      await Promise.all([
        supabase.from("services").update({ sort_order: b.sort_order }).eq("id", a.id),
        supabase.from("services").update({ sort_order: a.sort_order }).eq("id", b.id),
      ]);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["db_services"] }),
    onError: () => toast.error("שגיאה בסידור"),
  });

  function handleSubmit() {
    if (!form.name || !form.price || !form.duration) { toast.error("שם, מחיר ומשך הם שדות חובה"); return; }
    if (editing) saveService.mutate({ ...form, id: editing.id });
    else saveService.mutate({ ...form });
  }

  const list = services.data ?? [];

  return (
    <div className="space-y-6">
      {(creating || editing) && (
        <div className="shadow-card rounded-3xl border border-primary/30 bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-medium">{editing ? "עריכת טיפול" : "הוספת טיפול חדש"}</h2>
            <Button variant="ghost" size="icon" className="rounded-full"
              onClick={() => { setEditing(null); setCreating(false); setForm(EMPTY_FORM); }}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="svc_name">שם הטיפול *</Label>
              <Input id="svc_name" className="mt-2 text-right" placeholder="לק ג'ל"
                value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="svc_price">מחיר *</Label>
              <Input id="svc_price" className="mt-2 text-right" placeholder="₪140"
                value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="svc_duration">משך הטיפול *</Label>
              <Input id="svc_duration" className="mt-2 text-right" placeholder="60 דק'"
                value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="svc_desc">תיאור</Label>
              <Textarea id="svc_desc" className="mt-2 min-h-[80px] text-right" placeholder="תיאור קצר..."
                value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button className="rounded-full gap-1.5" disabled={saveService.isPending} onClick={handleSubmit}>
              {saveService.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {editing ? "שמירת שינויים" : "הוספת טיפול"}
            </Button>
            <Button variant="outline" className="rounded-full"
              onClick={() => { setEditing(null); setCreating(false); setForm(EMPTY_FORM); }}>ביטול</Button>
          </div>
        </div>
      )}

      <div className="shadow-card rounded-3xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-medium">תפריט הטיפולים</h2>
            <p className="mt-1 text-sm text-muted-foreground">ניהול כל הטיפולים המוצגים בעמוד הראשי ובטופס קביעת התור.</p>
          </div>
          {!creating && !editing && (
            <Button className="rounded-full gap-1.5"
              onClick={() => { setCreating(true); setEditing(null); setForm(EMPTY_FORM); }}>
              <Plus className="size-4" /> טיפול חדש
            </Button>
          )}
        </div>
        {services.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground text-center">אין טיפולים עדיין.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((s, idx) => (
              <li key={s.id}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-4 transition-colors ${s.is_active ? "border-border bg-background" : "border-border/40 bg-secondary/40 opacity-60"}`}>
                <div className="flex flex-col gap-0.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg"
                    disabled={idx === 0 || moveService.isPending}
                    onClick={() => moveService.mutate({ id: s.id, direction: "up" })} aria-label="מעלה">
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg"
                    disabled={idx === list.length - 1 || moveService.isPending}
                    onClick={() => moveService.mutate({ id: s.id, direction: "down" })} aria-label="מטה">
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{s.name}</p>
                    <span className="text-primary font-semibold text-sm">{s.price}</span>
                    <span className="text-xs text-muted-foreground">{s.duration}</span>
                    {!s.is_active && <Badge variant="secondary" className="text-xs">מוסתר</Badge>}
                  </div>
                  {s.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={s.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: s.id, is_active: v })}
                    aria-label={s.is_active ? "הסתרה" : "הצגה"} />
                  <Button variant="ghost" size="icon" className="rounded-full"
                    onClick={() => { setEditing(s); setCreating(false); setForm({ name: s.name, price: s.price, duration: s.duration, description: s.description }); }}
                    aria-label="עריכה"><Edit2 className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="rounded-full"
                    onClick={() => setPendingDelete(s)} aria-label="מחיקה">
                    <Trash2 className="size-4 text-destructive" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="rounded-3xl text-right" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את הטיפול?</AlertDialogTitle>
            <AlertDialogDescription>"{pendingDelete?.name}" יימחק לצמיתות מהתפריט.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
            <AlertDialogCancel className="rounded-full">ביטול</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && deleteService.mutate(pendingDelete.id)}>מחיקה</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GalleryPanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GalleryImage | null>(null);
  const [urlForm, setUrlForm] = useState({ url: "", alt_text: "" });
  const [showUrlForm, setShowUrlForm] = useState(false);

  const images = useQuery({
    queryKey: ["gallery_images"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery_images").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as GalleryImage[];
    },
  });

  const addImage = useMutation({
    mutationFn: async (payload: { url: string; alt_text: string }) => {
      const { error } = await supabase.from("gallery_images")
        .insert({ ...payload, sort_order: images.data?.length ?? 0 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("תמונה נוספה לגלריה ✨");
      void queryClient.invalidateQueries({ queryKey: ["gallery_images"] });
      setUrlForm({ url: "", alt_text: "" }); setShowUrlForm(false);
    },
    onError: (err: any) => {
      console.error("Add image error:", err);
      toast.error(`שגיאה בהוספת התמונה: ${err?.message || ""}`);
    },
  });

  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gallery_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("התמונה נמחקה");
      void queryClient.invalidateQueries({ queryKey: ["gallery_images"] });
      setPendingDelete(null);
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  const moveImage = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const list = images.data ?? [];
      const idx = list.findIndex((img) => img.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= list.length) return;
      const a = list[idx]!; const b = list[swapIdx]!;
      await Promise.all([
        supabase.from("gallery_images").update({ sort_order: b.sort_order }).eq("id", a.id),
        supabase.from("gallery_images").update({ sort_order: a.sort_order }).eq("id", b.id),
      ]);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["gallery_images"] }),
    onError: () => toast.error("שגיאה בסידור"),
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext || "jpg"}`;
      const uploadOptions: { upsert: boolean; contentType?: string } = { upsert: true };
      if (file.type) uploadOptions.contentType = file.type;
      const { error: uploadError } = await supabase.storage.from("gallery").upload(fileName, file, uploadOptions);
      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        toast.error(`שגיאה בהעלאה: ${uploadError.message}`);
        return;
      }
      const { data: urlData } = supabase.storage.from("gallery").getPublicUrl(fileName);
      await addImage.mutateAsync({ url: urlData.publicUrl, alt_text: file.name.replace(/\.[^.]+$/, "") });
    } catch (err: any) {
      console.error("Upload handler error:", err);
      toast.error(`שגיאה בהעלאת הקובץ: ${err?.message || ""}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const list = images.data ?? [];

  return (
    <div className="space-y-6">
      <div className="shadow-card rounded-3xl border border-border bg-card p-6">
        <h2 className="text-2xl font-medium">גלריית הסטודיו</h2>
        <p className="mt-1 text-sm text-muted-foreground">תמונות המוצגות בעמוד הראשי. ניתן להוסיף, למחוק ולסדר מחדש.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="rounded-full gap-1.5" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            העלאת תמונה
          </Button>
          <Button variant="outline" className="rounded-full gap-1.5" onClick={() => setShowUrlForm((p) => !p)}>
            <Plus className="size-4" /> הוספה בקישור
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
        {showUrlForm && (
          <div className="mt-5 rounded-2xl border border-border/70 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="img_url">קישור לתמונה *</Label>
                <Input id="img_url" className="mt-2 text-left" placeholder="https://..." dir="ltr"
                  value={urlForm.url} onChange={(e) => setUrlForm((p) => ({ ...p, url: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="img_alt">טקסט חלופי (alt)</Label>
                <Input id="img_alt" className="mt-2 text-right" placeholder="תיאור התמונה..."
                  value={urlForm.alt_text} onChange={(e) => setUrlForm((p) => ({ ...p, alt_text: e.target.value }))} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button className="rounded-full gap-1.5" disabled={!urlForm.url || addImage.isPending}
                onClick={() => addImage.mutate(urlForm)}>
                {addImage.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                הוספה
              </Button>
              <Button variant="outline" className="rounded-full"
                onClick={() => { setShowUrlForm(false); setUrlForm({ url: "", alt_text: "" }); }}>ביטול</Button>
            </div>
          </div>
        )}
      </div>

      <div className="shadow-card rounded-3xl border border-border bg-card p-6">
        {images.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground text-center">אין תמונות בגלריה עדיין.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((img, idx) => (
              <div key={img.id} className="group relative overflow-hidden rounded-2xl border border-border bg-secondary/30">
                <img src={img.url} alt={img.alt_text}
                  className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3C/svg%3E";
                  }} />
                <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-black/20 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex justify-between">
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded-lg"
                      disabled={idx === 0 || moveImage.isPending}
                      onClick={() => moveImage.mutate({ id: img.id, direction: "up" })} aria-label="הזזה">
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded-lg"
                      disabled={idx === list.length - 1 || moveImage.isPending}
                      onClick={() => moveImage.mutate({ id: img.id, direction: "down" })} aria-label="הזזה">
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    {img.alt_text && <p className="truncate text-xs text-white/80">{img.alt_text}</p>}
                    <Button variant="destructive" size="icon" className="h-7 w-7 shrink-0 rounded-lg"
                      onClick={() => setPendingDelete(img)} aria-label="מחיקה">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="rounded-3xl text-right" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את התמונה?</AlertDialogTitle>
            <AlertDialogDescription>התמונה תוסר מהגלריה לצמיתות.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
            <AlertDialogCancel className="rounded-full">ביטול</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && deleteImage.mutate(pendingDelete.id)}>מחיקה</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
