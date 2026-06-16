// Recent WHOOP workouts for the logged-in user (last 7 days).
import { userIdFromToken, validAccessToken, fetchWorkouts } from '../../lib/whoop.js'

export default async function handler(req, res) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.t
    const uid = await userIdFromToken(token)
    if (!uid) return res.status(401).json({ error: 'Not authenticated' })

    const access = await validAccessToken(uid)
    if (!access) return res.status(200).json({ connected: false })

    const workouts = await fetchWorkouts(access, 7)
    res.status(200).json({ connected: true, workouts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
