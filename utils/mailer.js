import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Resend client — created lazily so env vars are always read AFTER dotenv.config()
// ---------------------------------------------------------------------------

/**
 * Return a configured Resend client.
 * Logs a clear error if RESEND_API_KEY is missing.
 */
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "[MAILER CONFIG ERROR] Missing RESEND_API_KEY! Add it to your environment variables (e.g. Render Environment Settings)."
    );
  }
  return new Resend(apiKey);
};

/**
 * The "from" address used for all outgoing emails.
 * Reads MAIL_FROM_ADDRESS from env; defaults to the Resend sandbox address.
 */
const getFromAddress = (label = "Vyapar Sathi") => {
  const address =
    process.env.MAIL_FROM_ADDRESS?.trim() || "onboarding@resend.dev";
  return `"${label}" <${address}>`;
};

// ---------------------------------------------------------------------------
// Core retry helper
// ---------------------------------------------------------------------------

/**
 * Send an email via Resend with automatic retry on failure.
 *
 * @param {object} mailOptions         - { from, to, subject, html, [replyTo] }
 * @param {number} [maxRetries=3]      - Number of retries after the first failure
 * @param {number} [delayMs=3000]      - Pause between retries (ms)
 */
export const sendMailWithRetry = async (
  mailOptions,
  maxRetries = 3,
  delayMs = 3000
) => {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const resend = getResendClient();

      const from = mailOptions.from || getFromAddress();

      const { data, error } = await resend.emails.send({
        from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
        ...(mailOptions.replyTo ? { reply_to: mailOptions.replyTo } : {}),
      });

      if (error) {
        // Resend returns errors in-band rather than throwing
        throw new Error(error.message || JSON.stringify(error));
      }

      if (attempt > 0) {
        console.log(
          `[MAILER] Email successfully sent to ${mailOptions.to} on retry attempt #${attempt} (id: ${data?.id})`
        );
      }

      return data;
    } catch (err) {
      attempt++;
      if (attempt <= maxRetries) {
        console.warn(
          `[MAILER WARNING] Failed to send email to ${mailOptions.to} (Attempt ${attempt}/${
            maxRetries + 1
          }): ${err.message}. Retrying in ${delayMs / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error(
          `[MAILER ERROR] Max retries (${maxRetries}) reached. Could not send email to ${mailOptions.to}:`,
          err.message
        );
        throw err;
      }
    }
  }
};

// ---------------------------------------------------------------------------
// sendInviteEmail
// ---------------------------------------------------------------------------

/**
 * Send a store employee invitation email with the accept link.
 *
 * @param {string} toEmail - Recipient's email address
 * @param {object} opts
 * @param {string} opts.storeName   - Name of the store
 * @param {string} opts.roleName    - Role being assigned
 * @param {string} opts.ownerName   - Owner's name
 * @param {string} opts.inviteToken - The unique token
 * @param {object} [retryOpts]      - Custom retry options { maxRetries, delayMs }
 */
export const sendInviteEmail = async (
  toEmail,
  { storeName, roleName, ownerName, inviteToken },
  retryOpts = {}
) => {
  const inviteUrl = `${process.env.FRONTEND_URL}/invite/${inviteToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 24px; }
        .body { padding: 32px; }
        .info-box { background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .info-box p { margin: 6px 0; font-size: 14px; color: #374151; }
        .info-box strong { color: #111; }
        .btn { display: block; width: fit-content; margin: 24px auto; padding: 14px 32px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 700; }
        .decline { display: block; text-align: center; font-size: 13px; color: #9ca3af; margin-top: 8px; }
        .decline a { color: #ef4444; }
        .footer { padding: 20px 32px; border-top: 1px solid #f1f1f1; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛡️ You're Invited!</h1>
        </div>
        <div class="body">
          <p style="color:#374151;font-size:15px;">Hi there,</p>
          <p style="color:#374151;font-size:15px;">
            <strong>${ownerName}</strong> has invited you to join their store on <strong>Vyapar Sathi</strong>.
          </p>
          <div class="info-box">
            <p>🏪 <strong>Store:</strong> ${storeName}</p>
            <p>🎭 <strong>Your Role:</strong> ${roleName}</p>
          </div>
          <p style="color:#6b7280;font-size:13px;">This invitation expires in <strong>48 hours</strong>.</p>
          <a href="${inviteUrl}" class="btn">✅ Accept Invitation</a>
          <p class="decline">Don't want to join? <a href="${inviteUrl}?action=decline">Decline this invite</a></p>
        </div>
        <div class="footer">
          If you didn't expect this, you can safely ignore this email.<br/>
          © ${new Date().getFullYear()} Vyapar Sathi
        </div>
      </div>
    </body>
    </html>
  `;

  const maxRetries = retryOpts.maxRetries ?? 3;
  const delayMs = retryOpts.delayMs ?? 60000;

  await sendMailWithRetry(
    {
      from: getFromAddress("Vyapar Sathi"),
      to: toEmail,
      subject: `You're invited to join ${storeName} on Vyapar Sathi`,
      html,
    },
    maxRetries,
    delayMs
  );
};

// ---------------------------------------------------------------------------
// sendLowStockNotificationEmail
// ---------------------------------------------------------------------------

/**
 * Send a Low Stock Warning Email to the Store Owner when products fall below threshold.
 *
 * @param {string} toEmail - Recipient email (Store Email or Owner Email)
 * @param {object} opts
 * @param {string} opts.storeName           - Name of the store
 * @param {string} opts.storeId             - Store ID for dashboard link
 * @param {number} [opts.lowStockThreshold=10] - Threshold set during store creation
 * @param {Array}  opts.lowStockProducts    - List of low stock product objects
 * @param {object} [retryOpts]              - Custom retry options { maxRetries, delayMs }
 */
export const sendLowStockNotificationEmail = async (
  toEmail,
  { storeName, storeId, lowStockThreshold = 10, lowStockProducts = [] },
  retryOpts = {}
) => {
  if (!toEmail || !lowStockProducts || lowStockProducts.length === 0) return;

  const dashboardUrl = `${
    process.env.FRONTEND_URL || "http://localhost:3000"
  }/storeDashboard/${storeId}`;

  const formattedDate = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const productCards = lowStockProducts
    .map(
      (p, index) => `
    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 15px; font-weight: 800; color: #0f172a;">📦 Product #${index + 1}: ${p.name}</span>
        <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; ${
          p.currentStock === 0
            ? "background: #fee2e2; color: #dc2626;"
            : "background: #fef3c7; color: #d97706;"
        }">
          ${p.currentStock} ${p.unit || "pcs"} ${p.currentStock === 0 ? "❌ OUT OF STOCK" : "⚠️ LOW STOCK"}
        </span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tbody>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 35%;">Brand:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${p.brand || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Barcode / SKU:</td>
            <td style="padding: 6px 0; color: #2563eb; font-family: 'Courier New', Courier, monospace; font-weight: 700;">${p.barcode || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Category:</td>
            <td style="padding: 6px 0; color: #0f172a;"><span style="background: #e2e8f0; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">${p.category || "General"}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Selling Price:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 800; font-size: 14px;">₹${Number(p.price || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%); padding: 28px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; opacity: 0.92; font-size: 13px; font-weight: 500; }
        .body { padding: 28px; }
        .store-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }
        .store-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; }
        .alert-banner { background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; color: #991b1b; font-weight: 600; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; background: #f8fafc; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Low Stock Alert Notification</h1>
          <p>Vyapar Sathi Automated Inventory Monitor</p>
        </div>
        <div class="body">
          <!-- Store Details Card -->
          <div class="store-card">
            <h2 class="store-title">🏪 Store: ${storeName}</h2>
            <div style="font-size: 13px; color: #475569; line-height: 1.6;">
              <p style="margin: 4px 0;">📧 <strong>Owner Email:</strong> ${toEmail}</p>
              <p style="margin: 4px 0;">🕒 <strong>Alert Time:</strong> ${formattedDate}</p>
              <p style="margin: 4px 0;">🎯 <strong>Low Stock Threshold Set:</strong> ${lowStockThreshold} units</p>
              <p style="margin: 4px 0;">📦 <strong>Affected Products Count:</strong> <span style="color: #dc2626; font-weight: 800;">${lowStockProducts.length} Product(s)</span></p>
            </div>
          </div>

          <div class="alert-banner">
            Attention Shop Owner! The following product(s) in <strong>${storeName}</strong> have fallen below your threshold of <strong>${lowStockThreshold} units</strong> after a recent purchase. Please review and restock as soon as possible.
          </div>

          <!-- Product Details Column Cards -->
          ${productCards}

          <div style="text-align:center; margin-top: 24px;">
            <a href="${dashboardUrl}" style="display:inline-block; padding: 12px 28px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 700;">
              📊 Go to Store Dashboard
            </a>
          </div>
        </div>
        <div class="footer">
          This is an automated low stock alert generated for <strong>${storeName}</strong>.<br/>
          © ${new Date().getFullYear()} Vyapar Sathi Inventory Management System
        </div>
      </div>
    </body>
    </html>
  `;

  const maxRetries = retryOpts.maxRetries ?? 3;
  const delayMs = retryOpts.delayMs ?? 60000;

  try {
    await sendMailWithRetry(
      {
        from: getFromAddress("Vyapar Sathi Alert"),
        to: toEmail,
        subject: `⚠️ Low Stock Alert: ${lowStockProducts.length} Product(s) Need Restocking in ${storeName}`,
        html,
      },
      maxRetries,
      delayMs
    );
  } catch (err) {
    console.error(
      `[MAILER ERROR] Failed to send low stock alert email to ${toEmail}:`,
      err.message
    );
  }
};
