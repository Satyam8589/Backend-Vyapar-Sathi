import transporter from "../../config/mail.js";

const isValidEmail = (value) =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const sendEmail = async (req, res) => {
  try {
    const { to, subject, text, html, attachments, replyTo } = req.body;

    if (!isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        message: "A valid recipient email is required",
      });
    }

    if (!subject || (!text && !html)) {
      return res.status(400).json({
        success: false,
        message: "Subject and text or html content are required",
      });
    }

    const rawFrom = process.env.MAIL_FROM_ADDRESS || process.env.EMAIL_FROM || process.env.GMAIL_USER || "noreply@api.vyaparsathi.udittiwari.in";
    const fromAddress = rawFrom.includes("<") ? rawFrom : `Vyapar Sakha <${rawFrom}>`;

    let emailId = null;

    if (transporter && typeof transporter.sendMail === "function") {
      const result = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        ...(replyTo ? { replyTo } : {}),
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
        ...(attachments ? { attachments } : {}),
      });
      emailId = result?.messageId || null;
    } else if (transporter && transporter.emails && typeof transporter.emails.send === "function") {
      const response = await transporter.emails.send({
        from: fromAddress,
        to,
        subject,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
        ...(attachments ? { attachments } : {}),
      });

      if (response && response.error) {
        console.error("[EMAIL ERROR] Resend API Error:", response.error);
        return res.status(500).json({
          success: false,
          message: `Resend delivery failed: ${response.error.message || JSON.stringify(response.error)}`,
        });
      }

      emailId = response?.data?.id || null;
      console.log(`[EMAIL SUCCESS] Email dispatched to ${to}, Resend ID: ${emailId}`);
    } else {
      throw new Error("No configured mail transporter or Resend client available");
    }

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
      emailId,
    });
  } catch (error) {
    console.error("Email Error:", error.message);

    return res.status(500).json({
      success: false,
      message: `Email sending failed: ${error.message}`,
    });
  }
};

export const sendTestEmail = async (req, res) => {
  try {
    const { to } = req.body;

    if (!isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        message: "A valid recipient email is required",
      });
    }

    const rawFrom = process.env.MAIL_FROM_ADDRESS || process.env.EMAIL_FROM || process.env.GMAIL_USER || "noreply@api.vyaparsathi.udittiwari.in";
    const fromAddress = rawFrom.includes("<") ? rawFrom : `Vyapar Sakha <${rawFrom}>`;

    if (transporter && typeof transporter.sendMail === "function") {
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject: "VyaparSakha Test Email",
        text: "Hello! This is a test email from VyaparSathi.",
      });
    } else if (transporter && transporter.emails && typeof transporter.emails.send === "function") {
      const response = await transporter.emails.send({
        from: fromAddress,
        to,
        subject: "VyaparSathi Test Email",
        text: "Hello! This is a test email from VyaparSathi.",
      });

      if (response && response.error) {
        console.error("[EMAIL ERROR] Resend Test Email Error:", response.error);
        return res.status(500).json({
          success: false,
          message: `Resend delivery failed: ${response.error.message || JSON.stringify(response.error)}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Email Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Email sending failed",
    });
  }
};