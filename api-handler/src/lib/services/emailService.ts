import nodemailer from "nodemailer";
import { config } from "../../config";
import { emailVerificationTemplate } from "../templates/emailVerificationTemplate";
import { l } from "../../config/logger";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.sendinblue.com",
  port: 587,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

export const sendEmailVerificationMail = async (
  email: string,
  token: string
) => {
  try {
    const verificationURL = `${config.BASE_URL}/admin/email/verify?token=${token}`;

    const mailOptions = {
      from: "Scholar Sheet <noreply@scholarsheet.com>",
      to: email,
      subject: "Email Verification",
      html: emailVerificationTemplate(verificationURL),
    };

    const info = await transporter.sendMail(mailOptions);

    l.info(`Email sent: ${info.messageId}`);
  } catch (error) {
    console.error(error);
    throw new Error("Error sending email");
  }
};
