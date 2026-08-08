import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export const sendOtpEmail = async (toEmail, name, otp) => {
  await transporter.sendMail({
    from: `"RentEase Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your Admin Signup Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color:#0f766e;">RentEase Admin Verification</h2>
        <p>Hi ${name},</p>
        <p>Use the code below to verify your admin account. This code expires in 10 minutes.</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; background:#f0fdfa; color:#0f766e; padding: 14px 20px; border-radius: 8px; text-align:center; margin: 20px 0;">
          ${otp}
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};