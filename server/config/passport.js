import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as GitHubStrategy } from 'passport-github2'
import prisma from '../prisma/client.js'

function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function isGitHubOAuthConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
}

function normalizeProviderUser({ provider, profile }) {
  const emails = Array.isArray(profile.emails) ? profile.emails : []
  const photos = Array.isArray(profile.photos) ? profile.photos : []

  return {
    provider,
    providerId: String(profile.id || '').trim(),
    email: emails[0]?.value ? String(emails[0].value).toLowerCase().trim() : null,
    name: profile.displayName || profile.username || 'IntervueAI Member',
    avatarUrl: photos[0]?.value || null,
  }
}

async function findOrCreateOAuthUser(payload) {
  const { provider, providerId, email, name, avatarUrl } = payload

  if (!providerId) {
    throw new Error('OAuth provider id is missing')
  }

  const existingByProvider = await prisma.user.findFirst({
    where: {
      provider,
      providerId,
    },
  })

  if (existingByProvider) {
    return existingByProvider
  }

  if (email) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
    })

    if (existingByEmail) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          provider,
          providerId,
          avatarUrl: avatarUrl || existingByEmail.avatarUrl,
        },
      })
    }
  }

  const fallbackEmail = email || `${provider}-${providerId}@oauth.intervueai`

  return prisma.user.create({
    data: {
      name: name || 'IntervueAI Member',
      email: fallbackEmail,
      password: null,
      provider,
      providerId,
      avatarUrl,
    },
  })
}

function configurePassport() {
  if (isGoogleOAuthConfigured()) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL:
            process.env.GOOGLE_CALLBACK_URL ||
            `${process.env.SERVER_URL || ''}/api/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const userPayload = normalizeProviderUser({ provider: 'google', profile })
            if (!userPayload.email) {
              throw new Error('Google account did not return an email address')
            }
            const user = await findOrCreateOAuthUser(userPayload)
            done(null, user)
          } catch (error) {
            done(error)
          }
        },
      ),
    )
  }

  if (isGitHubOAuthConfigured()) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL:
            process.env.GITHUB_CALLBACK_URL ||
            `${process.env.SERVER_URL || ''}/api/auth/github/callback`,
          scope: ['user:email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const userPayload = normalizeProviderUser({ provider: 'github', profile })
            const user = await findOrCreateOAuthUser(userPayload)
            done(null, user)
          } catch (error) {
            done(error)
          }
        },
      ),
    )
  }

  return passport
}

export { configurePassport, isGoogleOAuthConfigured, isGitHubOAuthConfigured }
