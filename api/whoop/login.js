// Kicks off the WHOOP OAuth flow: verifies the Supabase user, then redirects
// the browser to WHOOP's consent page with a signed state carrying the user id.
import { config, userIdFromToken, makeState, authorizeUrl } from '../../lib/whoop.js'

export default async function handler(req, res) {
  try {
    if (!config.clientId || !config.redirectUri) {
      return res.status(500).json({ error: 'WHOOP env vars not configured' })
    }
    const uid = await userIdFromToken(req.query.t)
    if (!uid) return res.status(401).json({ error: 'Not authenticated' })
    res.redirect(302, authorizeUrl(makeState(uid, req.query.returnTo)))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
