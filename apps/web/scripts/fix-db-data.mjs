import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function run() {
  console.log("Fixing data and policies...");

  // Delete and re-insert salon_settings
  const { error: delSettings } = await supabase.from("salon_settings").delete().neq("key", "NEVER_MATCH_THIS");
  if (delSettings) { console.error("delete settings:", delSettings); } else { console.log("deleted settings"); }

  const { error: insSettings } = await supabase.from("salon_settings").insert([
    { key: "salon_name",    value: "אליאל ביוטי" },
    { key: "salon_address", value: "דיזנגוף 120, תל אביב" },
    { key: "salon_phone",   value: "050-000-0000" },
    { key: "salon_tagline", value: "סטודיו בוטיק לציפורניים וטיפוח" },
    { key: "salon_about",   value: "סטודיו בוטיק לטיפוח ויצירת ציפורניים מושלמות, בריאות ועמידות לאורך זמן." }
  ]);
  if (insSettings) { console.error("insert settings:", insSettings); } else { console.log("salon_settings seeded"); }

  // Delete and re-insert services
  const { error: delSvcs } = await supabase.from("services").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delSvcs) { console.error("delete services:", delSvcs); } else { console.log("deleted services"); }

  const { error: insSvcs } = await supabase.from("services").insert([
    { name: "לק ג'ל",       price: "₪140", duration: "60 דק'", description: "מניקור קלאסי יסודי כולל סידור ועיצוב הציפורן, טיפוח הקוטיקולה ומריחת לק ג'ל מבריק ועמיד.", sort_order: 0, is_active: true },
    { name: "מבנה אנטומי",  price: "₪200", duration: "90 דק'", description: "חיזוק הציפורן הטבעית בראבר/ביילדר ג'ל למבנה מושלם, עמידות מקסימלית וחוזק.", sort_order: 1, is_active: true },
    { name: "בנייה בג'ל",   price: "₪250", duration: "120 דק'", description: "הארכת ציפורניים מלאה במבנה ובצורה המועדפת עלייך בגימור ג'ל יוקרתי.", sort_order: 2, is_active: true },
    { name: "פדיקור",        price: "₪160", duration: "60 דק'", description: "פדיקור ספא מפנק ומרגיע כולל פילינג, טיפוח כף הרגל וציפורניים ומריחת ג'ל.", sort_order: 3, is_active: true },
    { name: "הסרה וטיפוח",  price: "₪70",  duration: "30 דק'", description: "הסרה עדינה ומקצועית של הג'ל עם טיפול שיקום והזנה לציפורניים.", sort_order: 4, is_active: true }
  ]);
  if (insSvcs) { console.error("insert services:", insSvcs); } else { console.log("services seeded"); }

  // Verify
  const { data: settingsData } = await supabase.from("salon_settings").select("*");
  console.log("salon_settings now:", settingsData?.length, "rows");
  settingsData?.forEach(r => console.log(" ", r.key, "=", r.value));

  const { data: svcData } = await supabase.from("services").select("name, price").order("sort_order");
  console.log("services now:", svcData?.length, "rows");
  svcData?.forEach(r => console.log(" ", r.name, r.price));
}

run().catch(console.error);
