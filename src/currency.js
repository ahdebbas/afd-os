const formatters = new Map()

export function formatUsd(value, fractionDigits = 0) {
  if (!formatters.has(fractionDigits)) {
    formatters.set(fractionDigits, new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'code',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }))
  }
  return formatters.get(fractionDigits).format(value)
}
