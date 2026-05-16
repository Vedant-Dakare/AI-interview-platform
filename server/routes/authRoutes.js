import express from 'express'
import passport from 'passport'
import {
	loginUser,
	registerUser,
	getCurrentUser,
	logoutUser,
	oauthSuccessRedirect,
} from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'
import { getClientBaseUrl } from '../utils/urlUtils.js'
import { isGoogleOAuthConfigured, isGitHubOAuthConfigured } from '../config/passport.js'

const router = express.Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/logout', logoutUser)
router.get('/me', protect, getCurrentUser)

const oauthFailureRedirect = `${getClientBaseUrl()}/#/login?error=oauth`

router.get('/google', (req, res, next) => {
	if (!isGoogleOAuthConfigured()) {
		res.status(503).json({ success: false, message: 'Google OAuth is not configured' })
		return
	}

	console.log('OAuth start: google', { redirect: req.query.redirect || '' })
	const state = Buffer.from(JSON.stringify({ redirect: req.query.redirect || '' })).toString('base64url')
	passport.authenticate('google', {
		scope: ['profile', 'email'],
		session: false,
		state,
	})(req, res, next)
})

router.get(
	'/google/callback',
	passport.authenticate('google', {
		session: false,
		failureRedirect: oauthFailureRedirect,
	}),
	oauthSuccessRedirect,
)

router.get('/github', (req, res, next) => {
	if (!isGitHubOAuthConfigured()) {
		res.status(503).json({ success: false, message: 'GitHub OAuth is not configured' })
		return
	}

	console.log('OAuth start: github', { redirect: req.query.redirect || '' })
	const state = Buffer.from(JSON.stringify({ redirect: req.query.redirect || '' })).toString('base64url')
	passport.authenticate('github', {
		session: false,
		state,
	})(req, res, next)
})

router.get(
	'/github/callback',
	passport.authenticate('github', {
		session: false,
		failureRedirect: oauthFailureRedirect,
	}),
	oauthSuccessRedirect,
)

export default router
