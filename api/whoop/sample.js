// Hourly intraday sampler — called by cron-job.org (NOT a user).
// Protected by a shared secret. Iterates connected users, pulls current
// cumulative burn, and writes one whoop_samples row per clock-hour.
import { listConnectedUsers, validAccessToken, fetchTodayCalories, saveSample } from '../../lib/whoop.js'

export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (!process.env.WHOOP_CRON_SECRET || secret !== process.env.WHOOP_CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const users = await listConnectedUsers()
    let saved = 0
    for (const uid of users) {
      try {
        const access = await validAccessToken(uid)
        if (!access) continue
        const { kcal, cycleId } = await fetchTodayCalories(access)
        if (kcal == null) continue
        await saveSample(uid, { kcal, cycleId })
        saved++
      } catch { /* skip this user, keep going */ }
    }
    res.status(200).json({ ok: true, users: users.length, saved })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
