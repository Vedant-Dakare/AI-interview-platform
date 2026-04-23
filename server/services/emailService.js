import nodemailer from 'nodemailer'

let transporter

function getPositiveNumberEnv(name, fallback) {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getTransporter() {
  if (transporter) {
    return transporter
  }

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const connectionTimeout = getPositiveNumberEnv('SMTP_CONNECTION_TIMEOUT_MS', 10000)
  const greetingTimeout = getPositiveNumberEnv('SMTP_GREETING_TIMEOUT_MS', 10000)
  const socketTimeout = getPositiveNumberEnv('SMTP_SOCKET_TIMEOUT_MS', 15000)

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is missing')
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
  })

  return transporter
}

function buildInterviewInviteEmail({ role, interviewLink, expiresAt, candidateName }) {
  const expiry = new Date(expiresAt).toUTCString()
  const safeName = candidateName && String(candidateName).trim() ? String(candidateName).trim() : 'Candidate'

  return {
    subject: `IntervueAI Interview Link - ${String(role).toUpperCase()} Role`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:620px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">Your IntervueAI Interview Is Ready</h2>
        <p>Hi ${safeName},</p>
        <p>Thank you for applying. Your interview link has been generated for the <strong>${String(role).toUpperCase()}</strong> track.</p>
        <p>This secure link is valid for <strong>24 hours</strong> and will expire on <strong>${expiry}</strong>.</p>
        <p style="margin:28px 0;">
          <a href="${interviewLink}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
            Start Interview
          </a>
        </p>
        <p>If the button does not work, copy and paste this URL into your browser:</p>
        <p style="word-break:break-all;color:#4f46e5;">${interviewLink}</p>
        <p>Best regards,<br />IntervueAI Hiring Team</p>
      </div>
    `,
    text: `Hi ${safeName},\n\nYour IntervueAI interview link for ${String(role).toUpperCase()} is ready.\n\nStart Interview: ${interviewLink}\n\nThis link expires in 24 hours on ${expiry}.`,
  }
}

async function sendInterviewLinkEmail({ to, role, interviewLink, expiresAt, candidateName }) {
  const from = process.env.MAIL_FROM || 'noreply@intervueai.com'
  const transport = getTransporter()
  const email = buildInterviewInviteEmail({ role, interviewLink, expiresAt, candidateName })
  const sendTimeoutMs = getPositiveNumberEnv('SMTP_SEND_TIMEOUT_MS', 15000)

  await Promise.race([
    transport.sendMail({
      from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`SMTP send timeout after ${sendTimeoutMs}ms`))
      }, sendTimeoutMs)
    }),
  ])
}

export {
  sendInterviewLinkEmail,
}
