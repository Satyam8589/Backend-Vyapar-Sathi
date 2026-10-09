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
const getFromAddress = (label = "Vyapar Sakha") => {
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
            <strong>${ownerName}</strong> has invited you to join their store on <strong>Vyapar Sakha</strong>.
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
          © ${new Date().getFullYear()} Vyapar Sakha
        </div>
      </div>
    </body>
    </html>
  `;

  const maxRetries = retryOpts.maxRetries ?? 3;
  const delayMs = retryOpts.delayMs ?? 60000;

  await sendMailWithRetry(
    {
      from: getFromAddress("Vyapar Sakha"),
      to: toEmail,
      subject: `You're invited to join ${storeName} on Vyapar Sakha`,
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
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 35%;">Category:</td>
            <td style="padding: 6px 0; color: #0f172a;"><span style="background: #e2e8f0; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">${p.category || "General"}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Barcode / SKU:</td>
            <td style="padding: 6px 0; color: #2563eb; font-family: 'Courier New', Courier, monospace; font-weight: 700;">${p.barcode || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Selling Price:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 800; font-size: 14px;">₹${Number(p.sellingPrice || 0).toFixed(2)}</td>
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
          <p>Vyapar Sakha Automated Inventory Monitor</p>
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
          © ${new Date().getFullYear()} Vyapar Sakha Inventory Management System
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
        from: getFromAddress("Vyapar Sakha Alert"),
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

// ---------------------------------------------------------------------------
// sendHealthyInventoryNotificationEmail
// ---------------------------------------------------------------------------

/**
 * Send an Inventory Health / All Good Status Email to the Store Owner.
 *
 * @param {string} toEmail - Recipient email (Store Email or Owner Email)
 * @param {object} opts
 * @param {string} opts.storeName           - Name of the store
 * @param {string} opts.storeId             - Store ID for dashboard link
 * @param {number} [opts.totalProductsCount=0] - Total products checked
 * @param {object} [retryOpts]              - Custom retry options { maxRetries, delayMs }
 */
export const sendHealthyInventoryNotificationEmail = async (
  toEmail,
  { storeName, storeId, totalProductsCount = 0 },
  retryOpts = {}
) => {
  if (!toEmail) return;

  const dashboardUrl = `${
    process.env.FRONTEND_URL || "http://localhost:3000"
  }/storeDashboard/${storeId}`;

  const formattedDate = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; }
        .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 28px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; opacity: 0.92; font-size: 13px; font-weight: 500; }
        .body { padding: 28px; }
        .store-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }
        .store-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; }
        .success-banner { background: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; color: #065f46; font-weight: 600; line-height: 1.5; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; background: #f8fafc; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Inventory Healthy Status</h1>
          <p>Vyapar Sakha Automated Inventory Monitor</p>
        </div>
        <div class="body">
          <div class="store-card">
            <h2 class="store-title">🏪 Store: ${storeName}</h2>
            <div style="font-size: 13px; color: #475569; line-height: 1.6;">
              <p style="margin: 4px 0;">📧 <strong>Owner Email:</strong> ${toEmail}</p>
              <p style="margin: 4px 0;">🕒 <strong>Status Check Time:</strong> ${formattedDate}</p>
              <p style="margin: 4px 0;">📦 <strong>Total Products Inspected:</strong> <span style="color: #059669; font-weight: 800;">${totalProductsCount} Product(s)</span></p>
            </div>
          </div>

          <div class="success-banner">
            🎉 Great news! All products in <strong>${storeName}</strong> are currently well-stocked above minimum alert thresholds. No items are low on stock or out of stock.
          </div>

          <div style="text-align:center; margin-top: 24px;">
            <a href="${dashboardUrl}" style="display:inline-block; padding: 12px 28px; background: #059669; color: #fff; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 700;">
              📊 Go to Store Dashboard
            </a>
          </div>
        </div>
        <div class="footer">
          This is an automated inventory health notification for <strong>${storeName}</strong>.<br/>
          © ${new Date().getFullYear()} Vyapar Sakha Inventory Management System
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
        from: getFromAddress("Vyapar Sakha"),
        to: toEmail,
        subject: `✅ All Good: Inventory Healthy Status for ${storeName}`,
        html,
      },
      maxRetries,
      delayMs
    );
  } catch (err) {
    console.error(
      `[MAILER ERROR] Failed to send healthy inventory email to ${toEmail}:`,
      err.message
    );
  }
};

// ---------------------------------------------------------------------------
// sendInvoiceEmail
// ---------------------------------------------------------------------------

/**
 * Send an Official Tax Invoice Email to a Buyer/Customer
 *
 * @param {string} toEmail - Recipient email
 * @param {object} billData - Sale/Invoice object containing items, store, total, customer info
 * @param {object} [retryOpts] - Retry options
 */
export const sendInvoiceEmail = async (toEmail, billData, retryOpts = {}) => {
  if (!toEmail) return;

  const store = billData.storeInfo || billData.store || {};
  const storeName = store.name || store.storeName || billData.storeName || "Vyapar Sakha Store";
  const storeAddress = store.address || store.fullAddress || "";
  const storePhone = store.phone || store.mobile || "";

  const customerName = billData.customerName || billData.buyer?.name || "Valued Customer";
  const invoiceNo = billData.billNumber || billData.invoiceNo || (billData._id ? `INV-${billData._id.slice(-8).toUpperCase()}` : "TAX-INVOICE");
  const dateStr = billData.completedAt || billData.billedAt || billData.createdAt || new Date();
  const formattedDate = new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const paymentMethod = String(billData.paymentMethod || billData.paymentMode || "CASH").toUpperCase();
  const paymentStatus = String(billData.paymentStatus || "PAID").toUpperCase();

  const products = billData.items || billData.products || [];
  let subtotal = 0;
  const itemsHtml = products
    .map((item, idx) => {
      const name = item.nameSnapshot || item.name || item.product?.name || "Product Item";
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(item.unitPrice || item.price || 0);
      const lineTotal = Number(item.lineTotal || item.total || (qty * price));
      subtotal += lineTotal;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <td style="padding: 10px 12px; color: #64748b; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px 12px; color: #0f172a; font-weight: 600;">${name}</td>
          <td style="padding: 10px 12px; color: #334155; text-align: center;">${qty}</td>
          <td style="padding: 10px 12px; color: #334155; text-align: right;">₹${price.toFixed(2)}</td>
          <td style="padding: 10px 12px; color: #0f172a; font-weight: 700; text-align: right;">₹${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  let discAmount = 0;
  if (typeof billData.discount === "object" && billData.discount !== null) {
    if (typeof billData.discount.amount === "number" && billData.discount.amount > 0) {
      discAmount = billData.discount.amount;
    } else if (typeof billData.discount.value === "number" && billData.discount.value > 0) {
      discAmount = billData.discount.type === "percent" ? (subtotal * billData.discount.value) / 100 : billData.discount.value;
    }
  } else if (typeof billData.discount === "number" && billData.discount > 0) {
    discAmount = billData.discount;
  }
  const grandTotal = Math.max(0, subtotal - discAmount);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .invoice-card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a, #1e293b); padding: 28px 32px; color: #ffffff; }
        .header-top { display: flex; justify-content: space-between; align-items: center; }
        .badge { background: #10b981; color: #ffffff; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .body-content { padding: 32px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th { background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; }
        .total-box { background: #0f172a; color: #ffffff; padding: 18px 24px; border-radius: 12px; margin-top: 20px; }
        .footer { text-align: center; padding: 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="header">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">TAX INVOICE RECEIPT</div>
          <h1 style="margin: 4px 0 0 0; font-size: 24px; font-weight: 800; color: #ffffff;">${storeName}</h1>
          ${storeAddress ? `<div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">📍 ${storeAddress}</div>` : ""}
          ${storePhone ? `<div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">📞 ${storePhone}</div>` : ""}
        </div>
        <div class="body-content">
          <p style="font-size: 15px; margin-top: 0; color: #0f172a;">Dear <strong>${customerName}</strong>,</p>
          <p style="font-size: 13px; color: #475569; margin-bottom: 20px; line-height: 1.5;">Thank you for your purchase! Here is your official tax invoice receipt from <strong>${storeName}</strong>.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
            <tr>
              <td style="padding: 12px; background: #f8fafc; border-radius: 8px 0 0 8px; border: 1px solid #e2e8f0;">
                <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Invoice No</div>
                <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${invoiceNo}</div>
              </td>
              <td style="padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 0;">
                <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Date & Time</div>
                <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">${formattedDate}</div>
              </td>
              <td style="padding: 12px; background: #f8fafc; border-radius: 0 8px 8px 0; border: 1px solid #e2e8f0; border-left: 0;">
                <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Payment Method</div>
                <div style="font-size: 13px; font-weight: 700; color: #166534; margin-top: 2px;">${paymentMethod} [${paymentStatus}]</div>
              </td>
            </tr>
          </table>

          <table class="table">
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">#</th>
                <th style="text-align: left;">Item Description</th>
                <th style="text-align: center; width: 50px;">Qty</th>
                <th style="text-align: right; width: 80px;">Rate</th>
                <th style="text-align: right; width: 90px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px;">
            <tr>
              <td style="text-align: right; padding: 4px 12px; color: #64748b;">Subtotal:</td>
              <td style="text-align: right; padding: 4px 12px; font-weight: 600; color: #0f172a; width: 120px;">₹${subtotal.toFixed(2)}</td>
            </tr>
            ${discAmount > 0 ? `
              <tr>
                <td style="text-align: right; padding: 4px 12px; color: #10b981; font-weight: 700;">Discount Applied:</td>
                <td style="text-align: right; padding: 4px 12px; font-weight: 700; color: #10b981;">- ₹${discAmount.toFixed(2)}</td>
              </tr>
            ` : ""}
          </table>

          <div class="total-box">
            <table style="width: 100%; border-collapse: collapse; color: #ffffff;">
              <tr>
                <td>
                  <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Grand Total Paid</span>
                  <div style="font-size: 24px; font-weight: 900; color: #34d399; margin-top: 2px;">₹${grandTotal.toFixed(2)}</div>
                </td>
                <td style="text-align: right; vertical-align: bottom;">
                  <span style="font-size: 12px; color: #94a3b8; font-weight: 700;">For VyparSakha</span>
                  <div style="font-size: 10px; color: #64748b;">Authorized Signatory</div>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #334155;">Thank you for shopping with ${storeName}!</p>
          <p style="margin: 0; color: #94a3b8; font-size: 11px;">Official Electronic Invoice • Powered by Vyapar Sakha System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const maxRetries = retryOpts.maxRetries ?? 3;
  const delayMs = retryOpts.delayMs ?? 60000;

  await sendMailWithRetry(
    {
      from: getFromAddress(storeName),
      to: toEmail,
      subject: `Tax Invoice ${invoiceNo} from ${storeName}`,
      html,
    },
    maxRetries,
    delayMs
  );
};

