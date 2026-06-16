// Unlinks WHOOP by deleting the user's stored tokens.
import { userIdFromToken, clearTokens } from '../../lib/whoop.js'

export default async function handler(req, res) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.t
    const uid = await userIdFromToken(token)
    if (!uid) return res.status(401).json({ error: 'Not authenticated' })
    await clearTokens(uid)
    res.status(200).json({ connected: false })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
