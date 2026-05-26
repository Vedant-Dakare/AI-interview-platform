import nodemailer from 'nodemailer'

let transporter

function parseBooleanEnv(value, fallback = false) {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

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
  const secure = parseBooleanEnv(process.env.SMTP_SECURE, port === 465)
  const ignoreTls = parseBooleanEnv(process.env.SMTP_IGNORE_TLS, false)
  const connectionTimeout = getPositiveNumberEnv('SMTP_CONNECTION_TIMEOUT_MS', 10000)
  const greetingTimeout = getPositiveNumberEnv('SMTP_GREETING_TIMEOUT_MS', 10000)
  const socketTimeout = getPositiveNumberEnv('SMTP_SOCKET_TIMEOUT_MS', 15000)

  if (!host) {
    throw new Error('SMTP configuration is missing')
  }

  const auth = user && pass
    ? {
      user,
      pass,
    }
    : undefined

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
    ignoreTLS: ignoreTls,
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

function buildShortlistEmail({ candidateName, role, recruiterName }) {
  const safeName = candidateName && String(candidateName).trim() ? String(candidateName).trim() : 'Candidate'
  const safeRole = role ? String(role).toUpperCase() : 'ROLE'
  const safeRecruiter = recruiterName && String(recruiterName).trim() ? String(recruiterName).trim() : 'IntervueAI'

  return {
    subject: `IntervueAI Update: You have been shortlisted for ${safeRole}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:640px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">Great news from IntervueAI</h2>
        <p>Hi ${safeName},</p>
        <p>Thank you for completing the AI interview. After reviewing your performance for the <strong>${safeRole}</strong> track, we are excited to move you forward.</p>
        <p>Our team will reach out shortly with the next steps. If you have any questions, reply to this email and we will be happy to help.</p>
        <p style="margin-top:24px;">Best regards,<br />${safeRecruiter}</p>
      </div>
    `,
    text: `Hi ${safeName},\n\nGreat news! You have been shortlisted for the ${safeRole} role. Our team will reach out soon with next steps.\n\nBest regards,\n${safeRecruiter}`,
  }
}

function buildRejectionEmail({ candidateName, role, recruiterName }) {
  const safeName = candidateName && String(candidateName).trim() ? String(candidateName).trim() : 'Candidate'
  const safeRole = role ? String(role).toUpperCase() : 'ROLE'
  const safeRecruiter = recruiterName && String(recruiterName).trim() ? String(recruiterName).trim() : 'IntervueAI'

  return {
    subject: `IntervueAI Update: ${safeRole} application status`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:640px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">Thank you for interviewing with IntervueAI</h2>
        <p>Hi ${safeName},</p>
        <p>We appreciate the time you invested in the <strong>${safeRole}</strong> interview. After careful review, we are unable to move forward at this time.</p>
        <p>Please keep an eye on future openings. We would be glad to reconnect if another opportunity aligns with your background.</p>
        <p style="margin-top:24px;">Best regards,<br />${safeRecruiter}</p>
      </div>
    `,
    text: `Hi ${safeName},\n\nThank you for interviewing for the ${safeRole} role. After review, we will not be moving forward at this time.\n\nBest regards,\n${safeRecruiter}`,
  }
}

function buildInterviewProgressEmail({ candidateName, role, stageLabel, recruiterName }) {
  const safeName = candidateName && String(candidateName).trim() ? String(candidateName).trim() : 'Candidate'
  const safeRole = role ? String(role).toUpperCase() : 'ROLE'
  const safeStage = stageLabel && String(stageLabel).trim() ? String(stageLabel).trim() : 'Next Stage'
  const safeRecruiter = recruiterName && String(recruiterName).trim() ? String(recruiterName).trim() : 'IntervueAI'

  return {
    subject: `IntervueAI Update: ${safeRole} interview progress`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:640px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">Your ${safeRole} interview progress</h2>
        <p>Hi ${safeName},</p>
        <p>Your application has advanced to <strong>${safeStage}</strong>. We will reach out shortly with details.</p>
        <p style="margin-top:24px;">Best regards,<br />${safeRecruiter}</p>
      </div>
    `,
    text: `Hi ${safeName},\n\nYour ${safeRole} application has advanced to ${safeStage}. We will reach out with details.\n\nBest regards,\n${safeRecruiter}`,
  }
}

async function sendShortlistEmail({ to, candidateName, role, recruiterName }) {
  const from = process.env.MAIL_FROM || 'noreply@intervueai.com'
  const transport = getTransporter()
  const email = buildShortlistEmail({ candidateName, role, recruiterName })

  await transport.sendMail({
    from,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
}

async function sendRejectionEmail({ to, candidateName, role, recruiterName }) {
  const from = process.env.MAIL_FROM || 'noreply@intervueai.com'
  const transport = getTransporter()
  const email = buildRejectionEmail({ candidateName, role, recruiterName })

  await transport.sendMail({
    from,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
}

async function sendInterviewProgressEmail({ to, candidateName, role, stageLabel, recruiterName }) {
  const from = process.env.MAIL_FROM || 'noreply@intervueai.com'
  const transport = getTransporter()
  const email = buildInterviewProgressEmail({ candidateName, role, stageLabel, recruiterName })

  await transport.sendMail({
    from,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
}

export {
  sendInterviewLinkEmail,
  sendShortlistEmail,
  sendRejectionEmail,
  sendInterviewProgressEmail,
}
