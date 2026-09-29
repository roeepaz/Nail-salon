export interface AppointmentEmailData {
  customerName: string;
  serviceName: string;
  date: string;
  time: string;
  price?: string;
  duration?: string;
  bookingId: string;
  notes?: string | null;
  location?: string;
  supportPhone?: string;
}

const DEFAULT_LOCATION = "סטודיו אליאל ביוטי, צהלון, חריש";
const DEFAULT_PHONE = "052-837-1227";

function baseEmailLayout(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>אליאל ביוטי</title>
  <style>
    body {
      font-family: 'Assistant', 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #fcf9f9;
      color: #2b2325;
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 580px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 20px;
      border: 1px solid #f0e6e8;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(225, 112, 133, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #1f1b1d 0%, #2f272a 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      letter-spacing: 1px;
      font-weight: 700;
      color: #f7dcdb;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 13px;
      color: #dfb2b0;
    }
    .content {
      padding: 36px 32px;
      direction: rtl;
      text-align: right;
    }
    .card {
      background: #fff8f8;
      border: 1px solid #fae1e4;
      border-radius: 14px;
      padding: 24px;
      margin: 24px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f6dedf;
      font-size: 14px;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #7d6b6e;
    }
    .detail-value {
      font-weight: 600;
      color: #2b2325;
      text-align: left;
    }
    .cta-button {
      display: inline-block;
      background: #e17085;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 30px;
      font-weight: 600;
      font-size: 14px;
      margin-top: 16px;
      text-align: center;
    }
    .footer {
      padding: 24px 32px;
      background: #fbf6f6;
      border-top: 1px solid #f0e6e8;
      font-size: 12px;
      color: #8c7b7e;
      text-align: center;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${previewText}
  </div>
  <div class="wrapper">
    <div class="header">
      <h1>אליאל ביוטי</h1>
      <p>סטודיו לציפורניים וטיפוח בוטיק</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>סטודיו אליאל ביוטי • ${DEFAULT_LOCATION}</p>
      <p>לשאלות או שינוי מועד, צרו עמנו קשר בטלפון: ${DEFAULT_PHONE}</p>
      <p style="margin-top: 12px; font-size: 11px; color: #b3a4a6;">
        הודעה אוטומטית זו נשלחה בעקבות קביעת תור בסטודיו אליאל ביוטי.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function getConfirmationEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `התור שלך אושר! ✨ | אליאל ביוטי`;
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">התור שלך אושר בהצלחה! ✨</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      שלום <strong>${data.customerName}</strong>,<br>
      שמחים לעדכן שהתור שלך בסטודיו <strong>אליאל ביוטי</strong> אושר. אנחנו מחכים לפנק אותך!
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">סוג הטיפול: </span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך: </span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה: </span>
        <span class="detail-value">${data.time.slice(0, 5)}</span>
      </div>
      ${data.duration ? `
      <div class="detail-row">
        <span class="detail-label">משך הטיפול</span>
        <span class="detail-value">${data.duration}</span>
      </div>` : ""}
      ${data.price ? `
      <div class="detail-row">
        <span class="detail-label">מחיר</span>
        <span class="detail-value">${data.price}</span>
      </div>` : ""}
      <div class="detail-row">
        <span class="detail-label">כתובת הסטודיו</span>
        <span class="detail-value">${data.location || DEFAULT_LOCATION}</span>
      </div>

    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      <strong>מדיניות הסטודיו:</strong> מומלץ להגיע כ-5 דקות לפני שעת התור. במידה וברצונך לשנות או לבטל את התור, נודה לעדכון של 24 שעות מראש לפחות.
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `התור שלך לטיפול ${data.serviceName} בתאריך ${data.date} בשעה ${data.time.slice(0, 5)} אושר!`),
  };
}

export function get24hReminderEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `תזכורת: התור שלך מחר ב-${data.time.slice(0, 5)} 💅 | אליאל ביוטי`;
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">התור שלך מחר! 💅</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      שלום <strong>${data.customerName}</strong>,<br>
      תזכורת ידידותית לכך שמחר נקבע לך תור בסטודיו אליאל ביוטי.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">סוג הטיפול: </span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך: </span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה: </span>
        <span class="detail-value">${data.time.slice(0, 5)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">כתובת הסטודיו</span>
        <span class="detail-value">${data.location || DEFAULT_LOCATION}</span>
      </div>

    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      נא להגיע בזמן כדי שנוכל להעניק לך את הטיפול המושלם והמפנק ביותר. מתרגשים לראותך!
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `תזכורת: התור שלך לטיפול ${data.serviceName} נקבע למחר בשעה ${data.time.slice(0, 5)}.`),
  };
}

export function get1hReminderEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `נתראה בעוד שעה! 🌸 | אליאל ביוטי`;
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">נתראה בעוד שעה! 🌸</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      שלום <strong>${data.customerName}</strong>,<br>
      התור שלך בסטודיו <strong>אליאל ביוטי</strong> יחל בעוד כשעה, בשעה <strong>${data.time.slice(0, 5)}</strong>.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">סוג הטיפול: </span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה: </span>
        <span class="detail-value">${data.time.slice(0, 5)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">כתובת הסטודיו: </span>
        <span class="detail-value">${data.location || DEFAULT_LOCATION}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      אנחנו כבר מכינים את העמדה עבורך. אם במקרה יש עיכוב בדרך, נשמח לעדכון בטלפון ${DEFAULT_PHONE}.
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `תזכורת: התור שלך לטיפול ${data.serviceName} יתחיל בעוד שעה בשעה ${data.time.slice(0, 5)}.`),
  };
}

export function getCancellationEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `התור בוטל | אליאל ביוטי`;
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">התור בוטל</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      שלום <strong>${data.customerName}</strong>,<br>
      התור שנקבע לתאריך <strong>${data.date} בשעה ${data.time.slice(0, 5)}</strong> בוטל.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">סוג הטיפול: </span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך שנקבע: </span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה שנקבעה: </span>
        <span class="detail-value">${data.time.slice(0, 5)}</span>
      </div>

    </div>

    <p style="font-size: 14px; color: #524447; line-height: 1.6; margin: 16px 0;">
      נשמח לעמוד לרשותך לקביעת תור חדש בכל עת דרך האתר או ישירות מולנו בוואטסאפ.
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `התור שלך לטיפול ${data.serviceName} בתאריך ${data.date} בוטל.`),
  };
}

export interface AdminNotificationEmailData {
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  serviceName: string;
  date: string;
  time: string;
  notes?: string | null;
  bookingId: string;
  dashboardUrl?: string;
}

export function getAdminNewBookingEmail(data: AdminNotificationEmailData): { subject: string; html: string } {
  const subject = `🔔 תור חדש ממתין לאישורך: ${data.customerName} (${data.serviceName}) | אליאל ביוטי`;
  const dashboardLink = data.dashboardUrl || "https://elielbeauty.co.il/dashboard";
  const content = `
    <div style="background: #fff0f3; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; border-right: 4px solid #e17085;">
      <h3 style="margin: 0; color: #b83350; font-size: 16px;">תור חדש נקבע וממתין לאישורך! 💅</h3>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b3341;">
        לקוחה הגישה בקשה לקביעת תור בסטודיו. התור נקלט בסטטוס "ממתין לאישור" ויש לאשרו בלוח הניהול כדי לשלוח ללקוחה הודעת אישור.
      </p>
    </div>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">שם הלקוחה</span>
        <span class="detail-value">${data.customerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">מספר טלפון</span>
        <span class="detail-value" dir="ltr"><a href="tel:${data.customerPhone}" style="color: #e17085; text-decoration: none; font-weight: 600;">${data.customerPhone}</a></span>
      </div>
      ${data.customerEmail ? `
      <div class="detail-row">
        <span class="detail-label">אימייל לקוחה</span>
        <span class="detail-value" dir="ltr"><a href="mailto:${data.customerEmail}" style="color: #e17085; text-decoration: none;">${data.customerEmail}</a></span>
      </div>` : ""}
      <div class="detail-row">
        <span class="detail-label">סוג הטיפול: </span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך מבוקש: </span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה מבוקשת: </span>
        <span class="detail-value">${data.time.slice(0, 5)}</span>
      </div>
      ${data.notes ? `
      <div class="detail-row">
        <span class="detail-label">הערות לקוחה</span>
        <span class="detail-value">${data.notes}</span>
      </div>` : ""}
      <div class="detail-row">
        <span class="detail-label">מזהה תור</span>
        <span class="detail-value" style="font-family: monospace;">${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>

    <div style="text-align: center; margin: 28px 0 10px 0;">
      <a href="${dashboardLink}" class="cta-button" style="display: inline-block; padding: 14px 32px; font-size: 15px;">
        כניסה ללוח הניהול לאישור התור ←
      </a>
    </div>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `תור חדש מ-${data.customerName} לטיפול ${data.serviceName} ב-${data.date} בשעה ${data.time.slice(0, 5)} ממתין לאישורך.`),
  };
}

export function getAdminBookingCanceledEmail(data: AdminNotificationEmailData): { subject: string; html: string } {
  const subject = `❌ עדכון: לקוחה ביטלה תור (${data.customerName} - ${data.date}) | אליאל ביוטי`;
  const dashboardLink = data.dashboardUrl || "https://elielbeauty.co.il/dashboard";
  const content = `
    <div style="background: #fbf0f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; border-right: 4px solid #d94f4f;">
      <h3 style="margin: 0; color: #a12b2b; font-size: 16px;">תור בוטל על ידי הלקוחה</h3>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #702828;">
        המשבצת התפנתה ביומן וזמינה להזמנות חדשות.
      </p>
    </div>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">שם הלקוחה</span>
        <span class="detail-value">${data.customerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">מספר טלפון</span>
        <span class="detail-value" dir="ltr">${data.customerPhone}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">טיפול שבוטל</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך שהיה קבוע</span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה</span>
        <span class="detail-value">${data.time.slice(0, 5)}</span>
      </div>
    </div>

    <div style="text-align: center; margin: 28px 0 10px 0;">
      <a href="${dashboardLink}" class="cta-button" style="display: inline-block; padding: 14px 32px; font-size: 15px; background: #6b6062;">
        לצפייה בלוח הזמנים המעודכן ←
      </a>
    </div>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `התור של ${data.customerName} לטיפול ${data.serviceName} ב-${data.date} בשעה ${data.time.slice(0, 5)} בוטל.`),
  };
}
