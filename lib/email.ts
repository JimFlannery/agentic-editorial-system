/**
 * lib/email.ts
 *
 * Nodemailer-based email transport.
 * Works with any SMTP provider: Resend, AWS SES, Mailgun, or self-hosted.
 *
 * Required env vars (system is silent if omitted — email is skipped):
 *   SMTP_HOST     e.g. smtp.resend.com | email-smtp.us-east-1.amazonaws.com
 *   SMTP_PORT     e.g. 465 (SSL) or 587 (STARTTLS)
 *   SMTP_USER     SMTP username / access key
 *   SMTP_PASS     SMTP password / secret
 *   SMTP_FROM     e.g. "Nature Editorial <editorial@nature.com>"
 */

import nodemailer, { type Transporter } from "nodemailer"

// ---------------------------------------------------------------------------
// Transport singleton
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var _emailTransport: Transporter | null | undefined
}

function getTransport(): Transporter | null {
  if (global._emailTransport !== undefined) return global._emailTransport

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[email] SMTP not configured — outbound email is disabled.")
    global._emailTransport = null
    return null
  }

  global._emailTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? "465"),
    secure: parseInt(SMTP_PORT ?? "465") === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  return global._emailTransport
}

// ---------------------------------------------------------------------------
// sendEmail — fire-and-forget; never throws, logs on failure
// ---------------------------------------------------------------------------

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const transport = getTransport()
  if (!transport) return

  const from = process.env.SMTP_FROM ?? "Editorial System <noreply@localhost>"

  try {
    await transport.sendMail({ from, to, subject, html })
  } catch (err) {
    console.error("[email] Failed to send to", to, err)
  }
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

/** Wrap plain text in a minimal HTML email shell */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto;padding:24px">${escaped}</body></html>`
}

/** Replace {{key}} placeholders in a template string */
export function interpolate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "")
}

// ---------------------------------------------------------------------------
// System email templates (used when no custom template is configured)
// ---------------------------------------------------------------------------

export function reviewerInvitationEmail(vars: {
  reviewer_name: string
  manuscript_title: string
  journal_name: string
  due_date: string
  review_url: string
}): { subject: string; html: string } {
  const subject = `Invitation to review: ${vars.manuscript_title}`
  const body = `Dear ${vars.reviewer_name},

You have been invited to review the following manuscript for ${vars.journal_name}:

${vars.manuscript_title}

Your review is requested by ${vars.due_date}.

Please visit the link below to accept or decline this invitation and, if accepted, to submit your review:

${vars.review_url}

Thank you for supporting the work of ${vars.journal_name}.

Best regards,
${vars.journal_name} Editorial Office`

  return { subject, html: textToHtml(body) }
}

export function decisionEmail(vars: {
  author_name: string
  manuscript_title: string
  journal_name: string
  decision_label: string
  letter: string
}): { subject: string; html: string } {
  const subject = `Decision on your manuscript: ${vars.manuscript_title}`
  const body = `Dear ${vars.author_name},

We have reached a decision regarding your manuscript submitted to ${vars.journal_name}:

${vars.manuscript_title}

Decision: ${vars.decision_label}

${vars.letter}

Best regards,
${vars.journal_name} Editorial Office`

  return { subject, html: textToHtml(body) }
}

export function revisionReceivedEmail(vars: {
  editor_name: string
  manuscript_title: string
  journal_name: string
  manuscript_url: string
}): { subject: string; html: string } {
  const subject = `Revision received: ${vars.manuscript_title}`
  const body = `Dear ${vars.editor_name},

A revised manuscript has been submitted to ${vars.journal_name}:

${vars.manuscript_title}

You can review the revision here:

${vars.manuscript_url}

Best regards,
${vars.journal_name} Editorial System`

  return { subject, html: textToHtml(body) }
}
