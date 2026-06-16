// Current burn + intraday pacing vs prior days, for the logged-in user.
// One call powers both the deficit KPIs (F1) and the pacing line (F2).
import { userIdFromToken, validAccessToken, fetchTodayCalories, saveSample, intradayComparison } from '../../lib/whoop.js'

export default async function handler(req, res) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.t
    const uid = await userIdFromToken(token)
    if (!uid) return res.status(401).json({ error: 'Not authenticated' })

    const access = await validAccessToken(uid)
    if (!access) return res.status(200).json({ connected: false })

    const cur = await fetchTodayCalories(access)
    if (cur.kcal != null) saveSample(uid, cur).catch(() => {}) // opportunistic sample
    const cmp = await intradayComparison(uid)
    res.status(200).json({ connected: true, kcal: cur.kcal, strain: cur.strain, ...cmp })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
