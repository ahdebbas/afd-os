import { ETF_SYMBOL, holdingPerf, holdingValue } from './data'
import { todayKey } from './dates'

const round = (value, digits = 1) => Number.isFinite(value) ? +value.toFixed(digits) : null
const share = (value, total) => total > 0 ? round((value / total) * 100) : 0

export function buildFinanceSnapshot({ finance, quotes, quoteStatus, syncedAt }) {
  const { msft, sarwa, property } = finance
  const positionsKey = JSON.stringify([
    +msft.shares || 0,
    ...(sarwa.holdings || []).map(holding => [holding.ticker, holding.units ?? null, holding.ticker === 'USD' ? holding.value : null]),
  ])
  const msftQuote = quotes?.MSFT
  const msftPrice = msftQuote?.price ?? msft.price
  const msftDayChange = msftQuote?.changePct ?? msft.dayChangePct
  const msftValue = Math.max(0, (+msft.shares || 0) * (+msftPrice || 0))

  const holdings = (sarwa.holdings || []).map(holding => {
    const value = Math.max(0, holdingValue(holding, quotes) || 0)
    const quote = quotes?.[ETF_SYMBOL[holding.ticker]]
    const cost = Number.isFinite(+holding.cost) && +holding.cost > 0 ? +holding.cost : null
    const totalReturn = cost == null ? null : round(holdingPerf(holding, quotes))
    return {
      ticker: String(holding.ticker || '').slice(0, 12),
      name: String(holding.name || '').slice(0, 80),
      value: Math.round(value),
      cost: cost == null ? null : Math.round(cost),
      totalReturn,
      dayChange: quote?.changePct == null ? null : round(quote.changePct),
    }
  })
  const sarwaValue = holdings.reduce((sum, holding) => sum + holding.value, 0) || Math.max(0, +sarwa.total || 0)
  const sarwaCost = holdings.reduce((sum, holding) => sum + (holding.cost || 0), 0)
  const propertyValue = Math.max(0, +property.value || 0)
  const total = msftValue + sarwaValue + propertyValue
  const range = (+msft.high52 || 0) - (+msft.low52 || 0)
  const msftRangePercentile = range > 0 ? round(Math.min(100, Math.max(0, ((msftPrice - msft.low52) / range) * 100))) : null

  holdings.forEach(holding => { holding.sarwaShare = share(holding.value, sarwaValue) })
  const returnHoldings = holdings.filter(holding => holding.totalReturn != null)
  const best = [...returnHoldings].sort((a, b) => b.totalReturn - a.totalReturn)[0] || null
  const worst = [...returnHoldings].sort((a, b) => a.totalReturn - b.totalReturn)[0] || null
  const allocations = {
    msft: share(msftValue, total),
    sarwa: share(sarwaValue, total),
    property: share(propertyValue, total),
  }
  const flags = []
  if (allocations.msft >= 15) flags.push({ kind: 'concentration', label: `MSFT is ${allocations.msft}% of net worth.` })
  for (const holding of returnHoldings) {
    if (Math.abs(holding.totalReturn) >= 15) flags.push({
      kind: holding.totalReturn >= 0 ? 'gain_outlier' : 'loss_outlier',
      label: `${holding.ticker} is ${holding.totalReturn >= 0 ? 'up' : 'down'} ${Math.abs(holding.totalReturn)}% versus cost.`,
    })
  }
  if (quoteStatus !== 'live') flags.push({ kind: 'stale_quotes', label: 'Market prices are stale or unavailable.' })

  return {
    marketDate: todayKey(),
    quoteStatus: ['live', 'stale', 'error', 'idle'].includes(quoteStatus) ? quoteStatus : 'idle',
    syncedAt: syncedAt || null,
    positionsKey,
    totalValue: Math.round(total),
    allocations,
    msft: {
      value: Math.round(msftValue),
      share: allocations.msft,
      dayChange: round(msftDayChange),
      rangePercentile: msftRangePercentile,
      totalReturn: null,
    },
    sarwa: {
      value: Math.round(sarwaValue),
      share: allocations.sarwa,
      cost: sarwaCost > 0 ? Math.round(sarwaCost) : null,
      totalReturn: sarwaCost > 0 ? round(((sarwaValue / sarwaCost) - 1) * 100) : null,
      cashShare: holdings.find(holding => holding.ticker === 'USD')?.sarwaShare ?? 0,
      best: best ? { ticker: best.ticker, totalReturn: best.totalReturn } : null,
      worst: worst ? { ticker: worst.ticker, totalReturn: worst.totalReturn } : null,
      holdings,
    },
    property: {
      value: Math.round(propertyValue),
      share: allocations.property,
      totalReturn: null,
    },
    flags,
    missingData: ['MSFT cost basis', 'property valuation history', 'portfolio cash-flow history'],
  }
}

export function toMarketSnapshot(snapshot) {
  return {
    date: snapshot.marketDate,
    recordedAt: snapshot.syncedAt || new Date().toISOString(),
    msft: snapshot.msft.value,
    sarwa: snapshot.sarwa.value,
    marketTotal: snapshot.msft.value + snapshot.sarwa.value,
    msftNetWorthShare: snapshot.msft.share,
    positionsKey: snapshot.positionsKey,
  }
}

const dateDistance = (later, earlier) => Math.round(
  (new Date(`${later}T00:00:00`) - new Date(`${earlier}T00:00:00`)) / 86400000,
)

const comparisonFor = (history, current, targetDays) => {
  const candidates = history
    .filter(item => item.date < current.date && dateDistance(current.date, item.date) >= targetDays)
    .sort((a, b) => b.date.localeCompare(a.date))
  const baseline = candidates[0]
  if (!baseline) return null
  const msftChange = current.msft - baseline.msft
  const sarwaChange = current.sarwa - baseline.sarwa
  const totalChange = current.marketTotal - baseline.marketTotal
  return {
    label: targetDays === 1 ? '1D' : `${targetDays}D`,
    days: dateDistance(current.date, baseline.date),
    baselineDate: baseline.date,
    totalChange: Math.round(totalChange),
    changePct: baseline.marketTotal > 0 ? round((totalChange / baseline.marketTotal) * 100) : null,
    msftChange: Math.round(msftChange),
    sarwaChange: Math.round(sarwaChange),
    concentrationChange: round(current.msftNetWorthShare - baseline.msftNetWorthShare),
    positionsChanged: Boolean(baseline.positionsKey && current.positionsKey && baseline.positionsKey !== current.positionsKey),
  }
}

export function buildCapitalPulse(history, current) {
  const ordered = [...(history || [])]
    .filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  const comparisons = [1, 7, 30]
    .map(days => comparisonFor(ordered, current, days))
    .filter(Boolean)
  const primary = comparisons.find(item => item.label === '7D') || comparisons[0] || null

  if (!primary) {
    return {
      state: 'building',
      headline: 'Building your market baseline',
      summary: 'Today’s MSFT and Sarwa values are saved. Changes will appear after the next market-day snapshot.',
      comparisons: [],
      recordedDays: new Set([...ordered.map(item => item.date), current.date]).size,
    }
  }

  const leading = Math.abs(primary.msftChange) >= Math.abs(primary.sarwaChange)
    ? { ticker: 'MSFT', value: primary.msftChange }
    : { ticker: 'Sarwa', value: primary.sarwaChange }
  return {
    state: 'ready',
    headline: `${primary.totalChange >= 0 ? 'Up' : 'Down'} $${Math.abs(primary.totalChange).toLocaleString('en-US')} over ${primary.days} day${primary.days === 1 ? '' : 's'}`,
    summary: primary.positionsChanged
      ? `Holdings changed during this period, so the $${Math.abs(primary.totalChange).toLocaleString('en-US')} move includes both position updates and market movement. Property is excluded.`
      : `${leading.ticker} was the larger contributor at ${leading.value >= 0 ? '+' : '-'}$${Math.abs(leading.value).toLocaleString('en-US')}. Property is unchanged and excluded.`,
    primary,
    comparisons,
    recordedDays: new Set([...ordered.map(item => item.date), current.date]).size,
  }
}