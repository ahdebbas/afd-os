import { ArrowRight, CalendarClock, Check, Clock, Dumbbell, Flame, Landmark, UtensilsCrossed, Wallet } from 'lucide-react'
import { useClock, usePersistentState } from './hooks'
import { useFood } from './store'
import { useQuotes } from './quotes'
import { FINANCE, FITNESS, TARGETS, ETF_SYMBOL, nextWorkoutIdx, reconcileFinance, sarwaTotal, usd } from './data'
import { DEFAULT_CASH_PULSE, buildCashProjection, formatCash } from './cashPulse'
import { dateKey } from './dates'

export default function TodayPulse({ onNavigate, whoop }) {
  const now = useClock()
  const today = dateKey(now)
  const { totals, entries } = useFood()
  const quotes = useQuotes()
  const [savedFinance] = usePersistentState('afd-finance', FINANCE)
  const finance = reconcileFinance(savedFinance)
  const [cash] = usePersistentState('afd-cash-pulse', DEFAULT_CASH_PULSE)
  const [program] = usePersistentState('afd-program-v2', FITNESS.program, Array.isArray)
  const [sessions] = usePersistentState('afd-sessions', [], Array.isArray)
  const [, setFoodDay] = usePersistentState('afd-food-day', today)
  const [, setFitnessDay] = usePersistentState('afd-fit-day', today)
  const navigate = destination => {
    if (destination === 'food') setFoodDay(today)
    if (destination === 'fitness') setFitnessDay(today)
    onNavigate(destination)
  }
  const nextWorkout = program[nextWorkoutIdx(program, sessions)]
  const trainedToday = sessions.some(session => session.date === today)
  const monday = new Date(now)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const workoutsThisWeek = sessions.filter(session => session.date >= dateKey(monday) && session.date <= today).length
  const projection = buildCashProjection(cash, now)
  const money = amount => formatCash(amount, projection.state.currency)
  const payment = projection.nextPayment
  const hasCash = Boolean(projection.state.cashAsOf)
  const configuredCash = projection.state.commitments.some(item => item.active && item.amount > 0) || projection.state.oneOffs.some(item => !item.coveredAt)
  const remaining = TARGETS.kcal - totals.kcal
  const proteinLeft = Math.max(0, Math.round(TARGETS.protein - totals.protein))
  const stock = quotes?.MSFT
  const msftValue = finance.msft.shares * (stock?.price ?? finance.msft.price)
  const liveFunds = finance.sarwa.holdings.some(holding => quotes?.[ETF_SYMBOL[holding.ticker]])
  const total = msftValue + (liveFunds ? sarwaTotal(finance.sarwa, quotes) : finance.sarwa.total) + finance.property.value
  const actions = []
  if (projection.overdue.length) actions.push({
    id: 'cash', Icon: CalendarClock, title: `${projection.overdue.length} uncovered payment${projection.overdue.length === 1 ? '' : 's'} past due`,
    detail: `${payment.name} · ${money(payment.amount)} · due ${payment.dueDate}`, action: 'Review', tone: 'attention',
  })
  else if (hasCash && projection.snapshotStale) actions.push({
    id: 'cash', Icon: Clock, title: 'Cash snapshot needs an update', detail: `Last updated ${projection.snapshotAgeDays} days ago`, action: 'Update', tone: 'attention',
  })
  else if (payment) actions.push({
    id: 'cash', Icon: CalendarClock, title: payment.name, detail: `${money(payment.amount)} · due ${payment.dueDate}`, action: 'Review',
  })
  if (!trainedToday && nextWorkout) actions.push({
    id: 'fitness', Icon: Dumbbell, title: nextWorkout.name, detail: `${nextWorkout.exercises.length} exercises · ${workoutsThisWeek} sessions this week`, action: 'Open workout',
  })
  actions.push({
    id: 'food', Icon: UtensilsCrossed, title: entries.length ? 'Food log' : 'No meals logged today',
    detail: entries.length ? `${Math.round(totals.kcal).toLocaleString()} kcal logged · ${proteinLeft}g protein to target` : 'Intake unknown',
    action: entries.length ? 'Add meal' : 'Log meal',
  })

  return (
    <div className="today-pulse">
      <section className="pulse-next" aria-labelledby="pulse-next-title">
        <div className="pulse-section-heading"><h2 id="pulse-next-title">Up next</h2><span>{trainedToday ? 'Workout complete' : 'Today'}</span></div>
        {actions.slice(0, 3).map(({ id, Icon, title, detail, action, tone }) => (
          <button key={id} onClick={() => navigate(id)} className={`pulse-action-row ${tone === 'attention' ? 'pulse-attention' : ''}`}>
            <span className={`pulse-icon pulse-icon-${id}`}><Icon size={21} strokeWidth={1.8} /></span>
            <span className="pulse-action-copy"><strong>{title}</strong><span>{detail}</span></span>
            <span className="pulse-action-label">{action}<ArrowRight size={16} /></span>
          </button>
        ))}
      </section>
      <section aria-labelledby="pulse-status-title">
        <div className="pulse-section-heading"><h2 id="pulse-status-title">Daily pulse</h2></div>
        <div className="pulse-status-grid">
          <button className="pulse-status" onClick={() => navigate('food')}>
            <span className="pulse-status-title"><UtensilsCrossed size={17} /> Food</span>
            <strong>{entries.length ? `${Math.round(totals.kcal).toLocaleString()} kcal` : 'Not logged'}</strong>
            <span>{entries.length ? `${Math.abs(Math.round(remaining)).toLocaleString()} ${remaining < 0 ? 'above' : 'to'} target · logged food` : 'No intake estimate yet'}</span>
            <progress value={Math.min(totals.kcal, TARGETS.kcal)} max={TARGETS.kcal} aria-label="Logged calorie target progress" />
          </button>
          <button className="pulse-status" onClick={() => navigate('fitness')}>
            <span className="pulse-status-title"><Dumbbell size={17} /> Training</span>
            <strong>{workoutsThisWeek} <small>/ 4 sessions</small></strong>
            <span>{trainedToday ? <><Check size={14} /> Logged today</> : 'This week'}</span>
            <progress value={Math.min(workoutsThisWeek, 4)} max={4} aria-label="Weekly training progress" />
          </button>
          <button className="pulse-status" onClick={() => onNavigate('cash')}>
            <span className="pulse-status-title"><Landmark size={17} /> Cash</span>
            <strong className={hasCash && configuredCash && projection.shortfall > 0 ? 'pulse-negative' : ''}>{hasCash ? money(projection.state.currentCash) : 'Set balance'}</strong>
            <span>{!hasCash ? 'No cash snapshot yet' : !configuredCash ? 'Commitments not set' : `${money(projection.nextMonthsNeed + projection.carryoverNeed)} reserved incl. overdue`}</span>
            <span className="pulse-cash-age">{hasCash && (projection.snapshotStale ? 'Snapshot needs updating' : 'Manual snapshot')}</span>
          </button>
        </div>
      </section>
      {whoop?.connected && whoop.kcal != null && <div className="pulse-energy">
        <Flame size={17} /><strong>{Math.round(whoop.kcal).toLocaleString()} kcal burned</strong>
        <span>WHOOP{whoop.lastSampleAt ? ` · sampled ${new Date(whoop.lastSampleAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
      </div>}
      <section className="pulse-capital" aria-label="Capital summary">
        <div className="pulse-section-heading"><h2><Wallet size={17} /> Capital</h2><button className="pulse-link" onClick={() => onNavigate('finance')}>View holdings <ArrowRight size={15} /></button></div>
        <strong className="pulse-capital-value">{usd(total)}</strong>
        <span className="pulse-capital-note">Recorded holdings{stock ? ` · MSFT ${stock.changePct >= 0 ? '+' : ''}${stock.changePct.toFixed(2)}% today` : ' · last known prices'}</span>
      </section>
    </div>
  )
}