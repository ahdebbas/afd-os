// WHOOP redirects here after consent. Validates state, exchanges the code for
// tokens, stores them for the user, then bounces back into the app.
import { config, readState, exchangeCode, saveTokens } from '../../lib/whoop.js'

export default async function handler(req, res) {
  let appUrl = config.appUrl
  const back = status => res.redirect(302, `${appUrl}/?whoop=${status}`)
  try {
    if (req.query.error) return back('denied')
    const state = readState(req.query.state)
    if (!state?.uid) return back('badstate')
    appUrl = state.returnTo || config.appUrl
    const tok = await exchangeCode(req.query.code)
    await saveTokens(state.uid, tok)
    back('connected')
  } catch {
    back('error')
  }
}
