/**
 * The one outbound-email entry point (E06-T04 / D7).
 *
 * Every email — verification, password reset, workspace invitation — goes
 * through `sendEmail`. It never throws to the caller and never blocks the
 * request that triggered it: a failed send is logged, not propagated, so a
 * flaky provider can't break signup or a test run.
 *
 * Transport selection, no SDKs (same discipline as the AI drivers — talk to the
 * provider's REST API directly):
 *   - `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` set → Resend HTTP API.
 *   - otherwise → console transport: log the message and any actionable link so
 *     local dev and CI can complete the flow without a provider.
 */
export interface EmailMessage {
  to: string
  subject: string
  /** Plain-text body. Always required — the actionable link lives here too. */
  text: string
  html?: string
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || 'Ecobuilder <no-reply@ecobuilder.ai>'
}

async function sendViaResend(message: EmailMessage, apiKey: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 300)}`)
  }
}

function sendViaConsole(message: EmailMessage): void {
  // Deliberately readable: in dev this is how a developer clicks the link.
  console.warn(
    `[email] (console transport — no provider configured)\n` +
      `[email]   to: ${message.to}\n` +
      `[email]   subject: ${message.subject}\n` +
      `[email]   ${message.text.replace(/\n/g, '\n[email]   ')}`,
  )
}

/**
 * Send an email. Resolves once the send has been attempted; a provider failure
 * is caught and logged rather than thrown, because no user-facing flow should
 * fail because email is down. Callers that must know delivery status can await
 * the boolean.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  const resendKey = process.env.RESEND_API_KEY?.trim()
  try {
    if (provider === 'resend' && resendKey) {
      await sendViaResend(message, resendKey)
      return true
    }
    sendViaConsole(message)
    return true
  } catch (err) {
    console.error('[email] send failed (non-blocking):', err)
    // Fall back to the console link so a dev/test flow can still complete.
    sendViaConsole(message)
    return false
  }
}

/**
 * Whether a real transport is configured, i.e. whether mail actually leaves the
 * process. With none, `sendEmail` logs to the console and reports success —
 * fine for a verification link (the user can retry later), unacceptable for a
 * sign-in code, which is the only way into the account.
 *
 * The pre-auth screen reads this (through `/public-site`) so it never offers a
 * sign-in method whose codes would land in a server log the user cannot see.
 * Outside production the console transport is a legitimate way to develop and
 * test the flow, so the method stays available there.
 */
export function emailDeliveryConfigured(): boolean {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (provider === 'resend' && resendKey) return true
  return process.env.NODE_ENV !== 'production'
}

/** The public origin used to build links in emails (first PUBLIC_ORIGIN entry). */
export function publicAppOrigin(): string {
  const configured = process.env.PUBLIC_ORIGIN?.split(',')[0]?.trim()
  return configured || 'http://localhost:3001'
}
