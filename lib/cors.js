const NATIVE_IOS_ORIGIN = 'capacitor://localhost'

export function handleNativeCors(req, res, methods) {
  if (req.headers?.origin === NATIVE_IOS_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', NATIVE_IOS_ORIGIN)
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`)
    res.setHeader('Vary', 'Origin')
  }
  if (req.method !== 'OPTIONS') return false
  res.statusCode = 204
  res.end()
  return true
}
