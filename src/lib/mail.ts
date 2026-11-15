import nodemailer, { type Transporter } from "nodemailer";
import { getAllSettings } from "@/settings/store";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export function getSmtpConfig(): SmtpConfig | null {
  const s = getAllSettings();
  if (!s["smtp_host"] || !s["smtp_from"]) return null;
  return {
    host: s["smtp_host"],
    port: Number(s["smtp_port"] ?? "587") || 587,
    user: s["smtp_user"] ?? "",
    password: s["smtp_password"] ?? "",
    from: s["smtp_from"],
  };
}

function makeTransport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user
      ? { user: config.user, pass: config.password }
      : undefined,
  });
}

export type MailResult = { ok: true } | { ok: false; error: string };

/** Verifies the stored SMTP config connects and authenticates. */
export async function verifySmtp(): Promise<MailResult> {
  const config = getSmtpConfig();
  if (!config) {
    return { ok: false, error: "SMTP host and from address are not configured" };
  }
  try {
    await makeTransport(config).verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "SMTP connection failed" };
  }
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}): Promise<MailResult> {
  const config = getSmtpConfig();
  if (!config) {
    return { ok: false, error: "SMTP is not configured — add it in Settings" };
  }
  try {
    await makeTransport(config).sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      attachments: options.attachments,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
