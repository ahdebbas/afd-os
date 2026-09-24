const starterCommitments = [
  ['parents', 'Parents'],
  ['wife-allowance', 'Wife allowance'],
  ['nursery', 'Nursery'],
  ['qatar-rent', 'Qatar rent'],
  ['car-loan', 'Car loan'],
]

export const DEFAULT_CASH_PULSE = {
  currency: 'QAR',
  currentCash: 0,
  cashAsOf: null,
  commitments: starterCommitments.map(([id, name]) => ({
    id,
    name,
    amount: 0,
    dueDay: 1,
    active: true,
    startMonth: null,
    endMonth: null,
  })),
  oneOffs: [],
  coverage: {},
}

const asAmount = value => Math.max(0, Number(value) || 0)
const asDueDay = value => Math.max(1, Math.min(31, Math.round(Number(value) || 1)))

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

export function monthLabel(key) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export function formatCash(value, currency = 'QAR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function reconcileCashPulse(value) {
  const source = value && typeof value === 'object' ? value : {}
  const commitments = Array.isArray(source.commitments)
    ? source.commitments.filter(item => item && item.id).map(item => ({
        id: String(item.id),
        name: String(item.name || 'Commitment'),
        amount: asAmount(item.amount),
        dueDay: asDueDay(item.dueDay),
        active: item.active !== false,
        startMonth: item.startMonth || null,
        endMonth: item.endMonth || null,
      }))
    : DEFAULT_CASH_PULSE.commitments

  const oneOffs = Array.isArray(source.oneOffs)
    ? source.oneOffs.filter(item => item && item.id && item.dueDate).map(item => ({
        id: String(item.id),
        name: String(item.name || 'Planned payment'),
        amount: asAmount(item.amount),
        dueDate: String(item.dueDate),
        coveredAt: item.coveredAt || null,
      }))
    : []

  return {
    currency: typeof source.currency === 'string' ? source.currency : DEFAULT_CASH_PULSE.currency,
    currentCash: asAmount(source.currentCash),
    cashAsOf: source.cashAsOf || null,
    commitments,
    oneOffs,
    coverage: source.coverage && typeof source.coverage === 'object' ? source.coverage : {},
  }
}

export function isCommitmentCovered(coverage, commitmentId, month) {
  return Boolean(coverage?.[commitmentId]?.[month])
}

export function setCommitmentCoverage(state, commitmentId, month, covered) {
  const commitmentCoverage = { ...(state.coverage?.[commitmentId] || {}) }
  if (covered) commitmentCoverage[month] = new Date().toISOString()
  else delete commitmentCoverage[month]

  const coverage = { ...state.coverage }
  if (Object.keys(commitmentCoverage).length) coverage[commitmentId] = commitmentCoverage
  else delete coverage[commitmentId]
  return { ...state, coverage }
}

const activeInMonth = (commitment, month) => commitment.active
  && (!commitment.startMonth || commitment.startMonth <= month)
  && (!commitment.endMonth || commitment.endMonth >= month)

export function buildCashProjection(input, now = new Date(), monthCount = 3) {
  const state = reconcileCashPulse(input)
  const months = Array.from({ length: monthCount }, (_, index) => monthKey(addMonths(now, index)))
  const monthSet = new Set(months)

  const calendar = months.map(month => {
    const recurring = state.commitments
      .filter(commitment => activeInMonth(commitment, month) && commitment.amount > 0)
      .map(commitment => ({
        type: 'recurring',
        id: commitment.id,
        name: commitment.name,
        amount: commitment.amount,
        dueDay: commitment.dueDay,
        covered: isCommitmentCovered(state.coverage, commitment.id, month),
      }))
    const oneOffs = state.oneOffs
      .filter(item => item.amount > 0 && item.dueDate.slice(0, 7) === month)
      .map(item => ({
        type: 'one-off',
        id: item.id,
        name: item.name,
        amount: item.amount,
        dueDay: Number(item.dueDate.slice(8, 10)),
        covered: Boolean(item.coveredAt),
      }))
    const items = [...recurring, ...oneOffs].sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name))
    return {
      key: month,
      label: monthLabel(month),
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      needed: items.filter(item => !item.covered).reduce((sum, item) => sum + item.amount, 0),
    }
  })

  const currentMonth = monthKey(now)
  const recurringMonthly = state.commitments
    .filter(commitment => activeInMonth(commitment, currentMonth))
    .reduce((sum, commitment) => sum + commitment.amount, 0)
  const nextMonthsNeed = calendar.reduce((sum, month) => sum + month.needed, 0)
  const projectedCash = state.currentCash - nextMonthsNeed

  return {
    state,
    months: calendar,
    recurringMonthly,
    nextMonthsNeed,
    projectedCash,
    shortfall: Math.max(0, -projectedCash),
    runwayMonths: recurringMonthly > 0 ? state.currentCash / recurringMonthly : null,
    scheduledOneOffsOutsideView: state.oneOffs.filter(item => !item.coveredAt && !monthSet.has(item.dueDate.slice(0, 7))).length,
  }
}