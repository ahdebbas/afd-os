// Returns the current WHOOP cycle's calories burned for the logged-in user.
// { connected:false } if they haven't linked WHOOP yet.
import { userIdFromToken, validAccessToken, fetchTodayCalories, saveSample } from '../../lib/whoop.js'

export default async function handler(req, res) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.t
    const uid = await userIdFromToken(token)
    if (!uid) return res.status(401).json({ error: 'Not authenticated' })

    const access = await validAccessToken(uid)
    if (!access) return res.status(200).json({ connected: false })

    const data = await fetchTodayCalories(access)
    // Opportunistic intraday sample on every app-open (dedupes per hour with cron).
    if (data.kcal != null) saveSample(uid, data).catch(() => {})
    res.status(200).json({ connected: true, ...data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
