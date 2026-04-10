import nodemailer from "nodemailer";

/**
 * Create a fresh Nodemailer transporter on-demand so that
 * env vars are always read AFTER dotenv.config() has run.
 * Supports Gmail, Sendgrid, or any SMTP provider.
 */
const createTransporter = () =>
  nodemailer.createTransport({
    service: process.env.MAIL_SERVICE || "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

/**
 * Send a store employee invitation email with the accept link.
 *
 * @param {string} toEmail - Recipient's email address
 * @param {object} opts
 * @param {string} opts.storeName  - Name of the store
 * @param {string} opts.roleName   - Role being assigned
 * @param {string} opts.ownerName  - Owner's name
 * @param {string} opts.inviteToken - The unique token
 */
export const sendInviteEmail = async (toEmail, { storeName, roleName, ownerName, inviteToken }) => {
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

  await createTransporter().sendMail({
    from: `"Vyapar Sathi" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: `You're invited to join ${storeName} on Vyapar Sathi`,
    html,
  });
};
