// WHOOP redirects here after consent. Validates state, exchanges the code for
// tokens, stores them for the user, then bounces back into the app.
import { config, readState, exchangeCode, saveTokens } from '../../lib/whoop.js'

export default async function handler(req, res) {
  const appUrl = config.appUrl
  const back = status => res.redirect(302, `${appUrl}/?whoop=${status}`)
  try {
    if (req.query.error) return back('denied')
    const uid = readState(req.query.state)
    if (!uid) return back('badstate')
    const tok = await exchangeCode(req.query.code)
    await saveTokens(uid, tok)
    back('connected')
  } catch {
    back('error')
  }
}
