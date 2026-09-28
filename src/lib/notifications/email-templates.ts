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

const DEFAULT_LOCATION = "Lumière Nails Studio, 120 Dizengoff St, Tel Aviv";
const DEFAULT_PHONE = "+972 50-123-4567";

function baseEmailLayout(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lumière Nails</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #fcf9f9;
      color: #2b2325;
      margin: 0;
      padding: 0;
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
      letter-spacing: 2px;
      font-weight: 400;
      font-family: 'Georgia', serif;
      color: #f7dcdb;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #dfb2b0;
    }
    .content {
      padding: 36px 32px;
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
      text-align: right;
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
      <h1>LUMIÈRE NAILS</h1>
      <p>Gel Polish Studio</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Lumière Nails Studio • ${DEFAULT_LOCATION}</p>
      <p>Questions or need to reschedule? Contact us at ${DEFAULT_PHONE}</p>
      <p style="margin-top: 12px; font-size: 11px; color: #b3a4a6;">
        This is an automated notification regarding your appointment reservation.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function getConfirmationEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = "Appointment confirmed";
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">Appointment Confirmed! ✨</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      Hi <strong>${data.customerName}</strong>,<br>
      Your appointment at Lumière Nails has been confirmed. We look forward to pampering your nails!
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">Service</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time</span>
        <span class="detail-value">${data.time}</span>
      </div>
      ${data.duration ? `
      <div class="detail-row">
        <span class="detail-label">Duration</span>
        <span class="detail-value">${data.duration}</span>
      </div>` : ""}
      ${data.price ? `
      <div class="detail-row">
        <span class="detail-label">Price</span>
        <span class="detail-value">${data.price}</span>
      </div>` : ""}
      <div class="detail-row">
        <span class="detail-label">Location</span>
        <span class="detail-value">${data.location || DEFAULT_LOCATION}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Booking Reference</span>
        <span class="detail-value" style="font-family: monospace; font-size: 13px;">${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      <strong>Studio Policy:</strong> Please arrive 5 minutes prior to your scheduled time. If you need to reschedule or cancel, please let us know at least 24 hours in advance.
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `Your appointment for ${data.serviceName} on ${data.date} at ${data.time} is confirmed!`),
  };
}

export function get24hReminderEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = "Reminder: Your appointment is tomorrow";
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">Your appointment is tomorrow! 💅</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      Hi <strong>${data.customerName}</strong>,<br>
      This is a friendly reminder that your nail appointment is scheduled for tomorrow.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">Service</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time</span>
        <span class="detail-value">${data.time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location</span>
        <span class="detail-value">${data.location || DEFAULT_LOCATION}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Booking ID</span>
        <span class="detail-value" style="font-family: monospace;">${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      Please arrive on time so we can provide you with the best personalized service. We can't wait to see you!
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `Reminder: Your appointment for ${data.serviceName} is tomorrow at ${data.time}.`),
  };
}

export function get1hReminderEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = "Reminder: Your appointment is in 1 hour";
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">See you in 1 hour! 🌸</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      Hi <strong>${data.customerName}</strong>,<br>
      Your appointment at Lumière Nails begins in approximately 1 hour at <strong>${data.time}</strong>.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">Service</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time</span>
        <span class="detail-value">${data.time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location</span>
        <span class="detail-value">${data.location || DEFAULT_LOCATION}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #7d6b6e; line-height: 1.6; margin: 16px 0;">
      We're getting everything ready for your arrival. If you're running late, please call us at ${DEFAULT_PHONE}.
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `Reminder: Your appointment for ${data.serviceName} is in 1 hour at ${data.time}.`),
  };
}

export function getCancellationEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const subject = "Appointment cancelled";
  const content = `
    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #2b2325;">Appointment Cancelled</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #524447; line-height: 1.5;">
      Hi <strong>${data.customerName}</strong>,<br>
      Your appointment scheduled for <strong>${data.date} at ${data.time}</strong> has been cancelled.
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">Service</span>
        <span class="detail-value">${data.serviceName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Scheduled Date</span>
        <span class="detail-value">${data.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Scheduled Time</span>
        <span class="detail-value">${data.time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Booking Reference</span>
        <span class="detail-value" style="font-family: monospace;">${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>

    <p style="font-size: 14px; color: #524447; line-height: 1.6; margin: 16px 0;">
      Whenever you're ready to book another session, visit our booking portal or reach out to us directly.
    </p>
  `;

  return {
    subject,
    html: baseEmailLayout(content, `Your appointment for ${data.serviceName} on ${data.date} has been cancelled.`),
  };
}
