import transporter from "../../config/mail.js";

const isValidEmail = (value) =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const sendEmail = async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

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

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    });

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Email Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Email sending failed",
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

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject: "VyaparSathi Test Email",
      text: "Hello! This is a test email from VyaparSathi.",
    });

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Email Error:", error);

    res.status(500).json({
      success: false,
      message: "Email sending failed",
    });
  }
};