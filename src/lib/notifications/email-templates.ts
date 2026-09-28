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

const DEFAULT_LOCATION = "סטודיו אליאל ביוטי, רחוב דיזנגוף 120, תל אביב";
const DEFAULT_PHONE = "050-123-4567";

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
        <span class="detail-label">סוג הטיפול</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך</span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה</span>
        <span class="detail-value">${data.time}</span>
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
      <div class="detail-row">
        <span class="detail-label">מספר הזמנה</span>
        <span class="detail-value" style="font-family: monospace; font-size: 13px;">${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      <strong>מדיניות הסטודיו:</strong> מומלץ להגיע כ-5 דקות לפני שעת התור. במידה וברצונך לשנות או לבטל את התור, נודה לעדכון של 24 שעות מראש לפחות.
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `התור שלך לטיפול ${data.serviceName} בתאריך ${data.date} בשעה ${data.time} אושר!`),
  };
}

export function get24hReminderEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `תזכורת: התור שלך מחר ב-${data.time} 💅 | אליאל ביוטי`;
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">התור שלך מחר! 💅</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      שלום <strong>${data.customerName}</strong>,<br>
      תזכורת ידידותית לכך שמחר נקבע לך תור בסטודיו אליאל ביוטי.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">סוג הטיפול</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך</span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה</span>
        <span class="detail-value">${data.time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">כתובת הסטודיו</span>
        <span class="detail-value">${data.location || DEFAULT_LOCATION}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">מספר הזמנה</span>
        <span class="detail-value" style="font-family: monospace;">${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      נא להגיע בזמן כדי שנוכל להעניק לך את הטיפול המושלם והמפנק ביותר. מתרגשים לראותך!
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `תזכורת: התור שלך לטיפול ${data.serviceName} נקבע למחר בשעה ${data.time}.`),
  };
}

export function get1hReminderEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `נתראה בעוד שעה! 🌸 | אליאל ביוטי`;
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">נתראה בעוד שעה! 🌸</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      שלום <strong>${data.customerName}</strong>,<br>
      התור שלך בסטודיו <strong>אליאל ביוטי</strong> יחל בעוד כשעה, בשעה <strong>${data.time}</strong>.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">סוג הטיפול</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה</span>
        <span class="detail-value">${data.time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">כתובת הסטודיו</span>
        <span class="detail-value">${data.location || DEFAULT_LOCATION}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      אנחנו כבר מכינים את העמדה עבורך. אם במקרה יש עיכוב בדרך, נשמח לעדכון בטלפון ${DEFAULT_PHONE}.
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `תזכורת: התור שלך לטיפול ${data.serviceName} יתחיל בעוד שעה בשעה ${data.time}.`),
  };
}

export function getCancellationEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = `התור בוטל | אליאל ביוטי`;
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">התור בוטל</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      שלום <strong>${data.customerName}</strong>,<br>
      התור שנקבע לתאריך <strong>${data.date} בשעה ${data.time}</strong> בוטל.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">סוג הטיפול</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">תאריך שנקבע</span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">שעה שנקבעה</span>
        <span class="detail-value">${data.time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">מספר הזמנה</span>
        <span class="detail-value" style="font-family: monospace;">${data.bookingId.slice(0, 8).toUpperCase()}</span>
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
