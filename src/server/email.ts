import nodemailer from "nodemailer";

type SendVerificationCodeEmailInput = {
  to: string;
  username: string;
  code: string;
};

export function isSmtpConfigured() {
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  const from = process.env.SMTP_FROM?.trim() || user;
  return Boolean(user && pass && from);
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  const from = process.env.SMTP_FROM?.trim() || user;

  if (!user || !pass || !from) {
    throw new Error("Konfigurasi SMTP belum lengkap.");
  }

  return {
    host,
    port,
    user,
    pass,
    from,
  };
}

export async function sendVerificationCodeEmail(input: SendVerificationCodeEmailInput) {
  const smtp = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from: smtp.from,
    to: input.to,
    subject: "Kode Verifikasi Tokko",
    text: `Halo ${input.username}, kode verifikasi kamu: ${input.code}. Kode berlaku 10 menit.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
        <p>Halo <strong>${input.username}</strong>,</p>
        <p>Kode verifikasi akun Tokko kamu adalah:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:6px;margin:10px 0;">${input.code}</p>
        <p>Kode berlaku selama <strong>10 menit</strong>.</p>
      </div>
    `,
  });
}

export async function sendPasswordChangeOtpEmail(input: SendVerificationCodeEmailInput) {
  const smtp = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from: smtp.from,
    to: input.to,
    subject: "OTP Ganti Password Tokko",
    text: `Halo ${input.username}, OTP ganti password kamu: ${input.code}. Kode berlaku 10 menit.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
        <p>Halo <strong>${input.username}</strong>,</p>
        <p>OTP untuk ganti password akun kamu:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:6px;margin:10px 0;">${input.code}</p>
        <p>Kode berlaku selama <strong>10 menit</strong>.</p>
      </div>
    `,
  });
}
