import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

/**
 * Shared Resend client instance.
 * Replaces the old nodemailer transporter.
 * Use `resend.emails.send(...)` wherever you previously called `transporter.sendMail(...)`.
 */
const resend = new Resend(process.env.RESEND_API_KEY);

export default resend;