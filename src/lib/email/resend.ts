import "server-only";

import { Resend } from "resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  from?: string;
};

export type SendEmailResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; email was not sent.");
    return { ok: false, error: "Le service d'email n'est pas configure." };
  }

  const from = (input.from ?? process.env.RESEND_FROM_EMAIL?.trim() ?? "").trim();
  if (!from) {
    console.warn("RESEND_FROM_EMAIL is not configured; email was not sent.");
    return { ok: false, error: "L'adresse d'expedition n'est pas configuree." };
  }

  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  if (recipients.length === 0 || recipients.some((value) => !isValidEmail(value))) {
    return { ok: false, error: "Au moins un destinataire est invalide." };
  }

  if (!input.subject.trim()) {
    return { ok: false, error: "L'objet de l'email est obligatoire." };
  }
  if (!input.text?.trim() && !input.html?.trim()) {
    return { ok: false, error: "Le contenu de l'email est obligatoire." };
  }

  try {
    const resend = new Resend(apiKey);
    const payload = {
      from,
      to: recipients,
      subject: input.subject.trim(),
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    } as Parameters<typeof resend.emails.send>[0];
    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error("Resend send failed:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Erreur inconnue lors de l'envoi.";
    console.error("Resend send threw:", message);
    return { ok: false, error: message };
  }
}