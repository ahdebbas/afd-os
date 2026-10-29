import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Beef, ChevronLeft, ChevronRight, CircleHelp, Crosshair, Dumbbell, Landmark, MapPin, Moon, Settings, SlidersHorizontal, Sun, Wallet } from 'lucide-react'
import { FINANCE, FITNESS, reconcileFinance } from './data'
import { DEFAULT_CASH_PULSE } from './cashPulse'
import { formatUsd } from './currency'
import { dateKey, isDateKey } from './dates'
import { useClock, usePersistentState } from './hooks'
import { HOME_GOALS, parseHomeGoals } from './homeGoals'
import { bodyFatGoal, cashBufferGoal, homeNextAction, liquidCapital, portfolioSignal, proteinGoal, weeklyTrainingGoal } from './homeInsights'
import { useHomeGoals } from './useHomeGoals'
import { useFood } from './store'
import { WhoopEnergyPanel } from './whoopInsights'
import { useQuotes, useQuotesMeta } from './quotes'
import { useWorkoutPrograms } from './useWorkoutPrograms'
import { nextProgramWorkoutIdx, WORKOUT_GYMS } from './workoutPrograms'
import WorkoutGymSelector from './WorkoutGymSelector'
import { Sheet } from './ui'
import './trajectoryHome.css'

const EMPTY_SESSIONS = []
const dash = '\u2014'
const shortDate = value => {
  if (!value) return 'Date unavailable'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable'
}
const percent = value => `${value.toFixed(1)}%`
const cashAmount = value => formatUsd(value, Number.isInteger(value) ? 0 : 2)

function GoalEditor({ goals, onSave }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(Object.entries(goals).map(([key, value]) => [key, value ?? ''])))
  const [error, setError] = useState(null)
  const submit = event => {
    event.preventDefault()
    const result = parseHomeGoals(draft)
    if (result.error) { setError(result.error); return }
    onSave(result.goals)
  }
  return (
    <form className="trajectory-form" onSubmit={submit}>
      <p className="trajectory-copy">These targets are shared with Food and Fitness. Your main goal stays pinned until you change it.</p>
      {[
        { key: 'fatPct', label: 'Body fat target (%)', min: 5, max: 40, step: .1 },
        { key: 'weeklyWorkouts', label: 'Workouts per week', min: 1, max: 7, step: 1 },
        { key: 'protein', label: 'Daily protein (g)', min: 1, max: 500, step: 1 },
        { key: 'cashBuffer', label: 'Cash buffer (USD, optional)', min: 1, max: 10_000_000, step: 1 },
      ].map(field => (
        <label className="trajectory-field" key={field.key}>
          <span>{field.label}</span>
          <input type="number" inputMode={field.step === 1 ? 'numeric' : 'decimal'} min={field.min} max={field.max} step={field.step}
            required={field.key !== 'cashBuffer'} value={draft[field.key]}
            onChange={event => { setError(null); setDraft(previous => ({ ...previous, [field.key]: event.target.value })) }} />
        </label>
      ))}
      <p className="trajectory-copy">Cash uses the last balance you saved in Cash, before planned payments. Leave its target blank to keep it unset.</p>
      {error && <p className="trajectory-error" role="alert">{error}</p>}
      <button className="trajectory-primary" type="submit">Save targets <ArrowRight size={17} aria-hidden="true" /></button>
    </form>
  )
}

function ProgressBar({ progress }) {
  return <div className={`trajectory-bar ${progress == null ? 'trajectory-bar-unknown' : ''}`} aria-hidden="true">
    {progress != null && <span style={{ transform: `scaleX(${progress})` }} />}
  </div>
}

function GoalOrbit({ mainGoal, label, goal }) {
  const progress = goal.progress
  const angle = -Math.PI / 2 + (progress ?? 0) * 2 * Math.PI
  const value = mainGoal === 'body' ? goal.available ? goal.current.toFixed(1) : dash
    : mainGoal === 'training' ? String(goal.current)
      : !goal.configured ? 'Set target' : goal.available ? cashAmount(goal.current).replace(/^USD\s*/, '') : dash
  const target = mainGoal === 'body' ? percent(goal.target)
    : mainGoal === 'training' ? `${goal.target} sessions / week`
      : goal.configured ? formatUsd(goal.target) : 'Not set'
  const description = mainGoal === 'body'
    ? goal.available ? `${percent(goal.current)} body fat, target ${target}, as of ${shortDate(goal.latestDate)}.` : `No body-fat reading. Target ${target}.`
    : mainGoal === 'training' ? `${goal.current} of ${goal.target} sessions logged this week.`
      : `${goal.available ? formatUsd(goal.current) : 'Cash balance unavailable'}. Target ${target}.`
  return (
    <div className="trajectory-orbit-wrap" role="img" aria-label={description}>
      <svg className="trajectory-orbit" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="133" fill="none" stroke="var(--cp-border)" strokeWidth="1" strokeDasharray="1 10" />
        <path d="M9 150h10m262 0h10M150 9v10m0 262v10" fill="none" stroke="var(--cp-border-strong)" strokeWidth="1" />
        <circle cx="150" cy="150" r="112" fill="none" stroke="var(--cp-border)" strokeWidth="1" />
        <circle cx="150" cy="150" r="104" fill="none" stroke="var(--cp-border)" strokeWidth="3" />
        {progress != null && <>
          <circle className="trajectory-orbit-progress" cx="150" cy="150" r="104" fill="none" stroke="var(--cp-accent)" strokeWidth="3"
            pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} transform="rotate(-90 150 150)" />
          <circle cx={150 + Math.cos(angle) * 104} cy={150 + Math.sin(angle) * 104} r="5" fill="var(--cp-accent)" stroke="var(--cp-surface)" strokeWidth="3" />
        </>}
      </svg>
      <div className="trajectory-orbit-copy" aria-hidden="true">
        <div className="trajectory-eyebrow">{label}</div>
        {mainGoal === 'cash' && goal.configured && <div className="trajectory-currency">USD</div>}
        <div className={`trajectory-orbit-value ${mainGoal === 'cash' ? 'trajectory-cash-value' : ''} ${value.length > 8 ? 'trajectory-long-value' : ''}`}>
          {value}{mainGoal === 'body' && goal.available && <small>%</small>}
          {mainGoal === 'training' && <small>/{goal.target}</small>}
        </div>
        <div className="trajectory-orbit-target">Target <strong>{target}</strong></div>
      </div>
    </div>
  )
}

function CapitalDetails({ capital, cash, portfolio, onNavigate }) {
  return (
    <div className="trajectory-details">
      <p className="trajectory-copy">Your saved cash balance plus direct stocks and ETFs, excluding property. Include any brokerage cash in your Cash snapshot; USD holdings are not added separately.</p>
      <div className="trajectory-fact">
        <span>Liquid capital</span>
        <strong>{capital.available ? cashAmount(capital.total) : 'Unavailable'}</strong>
      </div>
      <div className="trajectory-fact"><span>Saved cash</span><strong>{cash.available ? cashAmount(cash.current) : 'Not recorded'}</strong></div>
      <p className="trajectory-copy">{cash.available
        ? `Saved ${shortDate(cash.asOf)}${cash.stale ? ' \u00b7 needs updating' : ''}. This is a manual balance before planned payments, not a bank feed.`
        : 'Save or correct your dated balance in Cash to calculate the total.'}</p>
      <div className="trajectory-fact">
        <span>{portfolio.missingCount ? 'Valued investments (partial)' : 'Stocks / ETFs'}</span>
        <strong>{cashAmount(portfolio.total)}</strong>
      </div>
      {portfolio.missingCount > 0 && <p className="trajectory-error" role="alert">{portfolio.missingCount} holding(s) cannot be valued. The capital total and concentration are unavailable until their values are updated in Finance.</p>}
      {portfolio.available && <p className="trajectory-copy">{portfolio.headline}</p>}
      <div className="trajectory-holdings">
        {portfolio.positions.map(position => (
          <div key={position.ticker}>
            <div className="trajectory-holding-heading"><strong>{position.ticker}</strong><span>{formatUsd(position.value)}</span></div>
            <p className="trajectory-copy">{position.name}</p>
            <ProgressBar progress={portfolio.available ? position.value / portfolio.total : null} />
            <p className="trajectory-source">
              {portfolio.available && `${(position.value / portfolio.total * 100).toFixed(1)}% \u00b7 `}
              {position.source === 'quotes' ? portfolio.quotesFresh ? 'Price synced' : 'Cached price synced' : 'Recorded value'}
              {' \u00b7 '}{shortDate(position.asOf)}
            </p>
          </div>
        ))}
      </div>
      {!portfolio.positions.length && <p className="trajectory-copy">No valued securities to compare.</p>}
      <p className="trajectory-copy">Allocation compares stocks and ETFs only, without looking through ETF holdings. Values may have different source dates. Calculated locally, not an AI insight or performance forecast.</p>
      <button type="button" className="trajectory-primary" onClick={() => onNavigate('finance')}>Open Finance <ArrowRight size={17} aria-hidden="true" /></button>
      <button type="button" className="trajectory-secondary" onClick={() => onNavigate('cash')}>{!cash.available || cash.stale ? 'Update cash balance' : 'Open Cash'}</button>
    </div>
  )
}

export default function TrajectoryHome({ goTo, onOpenSettings, dark, onToggleTheme, whoop }) {
  const now = useClock()
  const today = dateKey(now)
  const [home, setHome] = useHomeGoals()
  const { goals, mainGoal } = home
  const { entries, totals } = useFood()
  const [sessions] = usePersistentState('afd-sessions', EMPTY_SESSIONS, Array.isArray)
  const [inbody] = usePersistentState('afd-inbody', FITNESS.inbody, Array.isArray)
  const [savedCash] = usePersistentState('afd-cash-pulse', DEFAULT_CASH_PULSE)
  const [savedFinance] = usePersistentState('afd-finance', FINANCE)
  const [, setFoodDay] = usePersistentState('afd-food-day', today, isDateKey)
  const { program, programId, activeProgramId, setActiveProgramId } = useWorkoutPrograms()
  const quotes = useQuotes()
  const quoteMeta = useQuotesMeta()
  const [sheet, setSheet] = useState(null)
  const [notice, setNotice] = useState('')

  const body = bodyFatGoal(inbody, goals.fatPct, now)
  const training = weeklyTrainingGoal(sessions, goals.weeklyWorkouts, now)
  const protein = proteinGoal(entries, goals.protein)
  const cash = cashBufferGoal(savedCash, goals.cashBuffer, now)
  const portfolio = portfolioSignal(reconcileFinance(savedFinance), quotes, quoteMeta)
  const capital = liquidCapital(cash, portfolio)
  const nextWorkout = program[nextProgramWorkoutIdx(program, sessions.filter(session => session.date <= today), programId)]
  const goal = mainGoal === 'body' ? body : mainGoal === 'training' ? training : cash
  const label = HOME_GOALS.find(item => item.id === mainGoal).label
  const gym = WORKOUT_GYMS.find(item => item.id === activeProgramId)
  const action = homeNextAction({ mainGoal, body, training, protein, cash, nextWorkout })
  const changeGoal = direction => setHome(previous => {
    const index = HOME_GOALS.findIndex(item => item.id === previous.mainGoal)
    return { ...previous, mainGoal: HOME_GOALS[(index + direction + HOME_GOALS.length) % HOME_GOALS.length].id }
  })

  const navigate = (destination, section) => {
    setSheet(null)
    if (destination === 'food') setFoodDay(today)
    if (destination === 'fitness') window.dispatchEvent(new CustomEvent('afd-open-fitness', { detail: { date: today, section } }))
    goTo(destination)
  }
  const next = () => {
    if (action.kind === 'navigate') navigate(action.destination, action.section)
    else setSheet(action.kind)
  }
  const gap = mainGoal === 'body'
    ? !body.available ? 'No body-fat reading yet' : body.complete ? 'Target reached at last check-in' : body.remaining === 0 ? 'Less than 0.1 pts to go' : `${body.remaining.toFixed(1)} pts to go`
    : mainGoal === 'training' ? training.complete ? 'Weekly target reached' : `${training.remaining} ${training.remaining === 1 ? 'session' : 'sessions'} left this week`
      : !cash.configured ? 'Choose a buffer target' : !cash.available ? 'No cash snapshot yet' : cash.complete ? 'Target covered by saved balance' : cash.remaining < .01 ? 'Less than USD 0.01 to go' : `${cashAmount(cash.remaining)} to go`
  const insight = mainGoal === 'cash'
    ? cash.overdueCount > 0 ? `${cash.overdueCount} uncovered ${cash.overdueCount === 1 ? 'payment is' : 'payments are'} overdue.`
      : cash.stale ? 'Cash needs an up-to-date snapshot.' : 'Based on your saved balance, before planned payments.'
    : mainGoal === 'body' && !body.available ? 'A check-in establishes your starting point.'
      : mainGoal === 'body' && body.complete ? 'Your last check-in reached the pinned target.'
        : training.complete ? `${training.current} sessions logged. Weekly target reached.`
          : `${training.current} of ${training.target} sessions logged this week.`
  const sheetTitle = sheet === 'settings' ? 'Your targets'
    : sheet === 'capital' ? 'Liquid capital' : sheet === 'gym' ? 'Workout gym' : 'About this goal'

  return (
    <div className="trajectory-home">
      <header className="trajectory-header">
        <h1 className="trajectory-wordmark"><Crosshair size={20} strokeWidth={1.4} aria-hidden="true" />Baseline</h1>
        <div className="trajectory-header-actions">
          <button type="button" className="trajectory-icon-button" onClick={() => setSheet('settings')} aria-label="Edit goals" title="Edit goals"><SlidersHorizontal size={17} /></button>
          <button type="button" className="trajectory-icon-button" onClick={onToggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button type="button" className="trajectory-icon-button" onClick={onOpenSettings} aria-label="Settings"><Settings size={17} /></button>
        </div>
      </header>
      <div className="trajectory-date">{now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
      <section className="trajectory-portfolio" aria-label="Liquid capital">
        <div className="trajectory-portfolio-kicker"><h2 className="trajectory-eyebrow">Liquid capital</h2><span className="trajectory-source">Cash + stocks / ETFs</span></div>
        <button type="button" onClick={() => setSheet('capital')} aria-label="View liquid capital breakdown" aria-haspopup="dialog" aria-expanded={sheet === 'capital'} className="trajectory-capital-link">
          <span className="trajectory-capital-total">{capital.available ? cashAmount(capital.total) : dash}</span><ArrowRight size={17} aria-hidden="true" />
        </button>
        <p className="trajectory-source trajectory-capital-source">
          {cash.available ? `Cash ${shortDate(cash.asOf)}${cash.stale ? ' (stale)' : ''}` : 'Add a cash snapshot'}
          {' \u00b7 '}{portfolio.missingCount ? 'Update investment values' : portfolio.source}
        </p>
      </section>
      <section aria-label="Pinned goal">
        <div className="trajectory-goal-row">
          <h2 id="home-main-kpi" className="trajectory-eyebrow trajectory-goal-title" aria-live="polite">{label}</h2>
          {mainGoal !== 'cash' && <button type="button" className="trajectory-location" onClick={() => setSheet('gym')} aria-label={`Change workout gym, ${gym.label}`} aria-haspopup="dialog">
            <MapPin size={12} aria-hidden="true" />{gym.label}
          </button>}
        </div>
        <div className="trajectory-goal-navigation">
          <button type="button" className="trajectory-goal-arrow" onClick={() => changeGoal(-1)} aria-label="Previous KPI" aria-controls="home-main-kpi"><ChevronLeft size={22} aria-hidden="true" /></button>
          <GoalOrbit mainGoal={mainGoal} label={label} goal={goal} />
          <button type="button" className="trajectory-goal-arrow" onClick={() => changeGoal(1)} aria-label="Next KPI" aria-controls="home-main-kpi"><ChevronRight size={22} aria-hidden="true" /></button>
        </div>
        <p className="trajectory-gap">{gap}</p>
        {mainGoal === 'body' && <button type="button" className="trajectory-goal-source" onClick={() => navigate('fitness', 'inbody')}>
          {body.available ? `InBody ${shortDate(body.latestDate)} \u00b7 ${body.ageDays === 0 ? 'today' : `${body.ageDays}d ago`}` : 'Add an InBody result'} <ArrowRight size={12} aria-hidden="true" />
        </button>}
        {mainGoal === 'training' && <p className="trajectory-goal-source">Since Mon {shortDate(training.weekStart)} &middot; both gyms</p>}
        {mainGoal === 'cash' && <p className="trajectory-goal-source">{cash.available ? `Saved ${shortDate(cash.asOf)}${cash.stale ? ' \u00b7 needs updating' : ''}` : 'Manual balance \u00b7 no snapshot saved'}</p>}
      </section>
      <div className="trajectory-mini-goals">
        {mainGoal === 'training' ? (
          <button type="button" className="trajectory-mini-goal" onClick={() => navigate('fitness', 'inbody')}>
            <span className="trajectory-mini-heading"><span>Body fat</span><Crosshair size={14} aria-hidden="true" /></span>
            <span className="trajectory-mini-number">{body.available ? body.current.toFixed(1) : dash}<small>{body.available ? '%' : ''}</small></span>
            <span className="trajectory-mini-caption">{body.available ? shortDate(body.latestDate) : 'No body-fat reading'}</span>
            <ProgressBar progress={body.progress} />
          </button>
        ) : (
          <button type="button" className="trajectory-mini-goal" onClick={() => navigate('fitness')}>
            <span className="trajectory-mini-heading"><span>Training</span><Dumbbell size={14} aria-hidden="true" /></span>
            <span className="trajectory-mini-number">{training.current}<small> / {training.target}</small></span>
            <span className="trajectory-mini-caption">sessions this week</span>
            <span className="trajectory-segments" aria-hidden="true">{Array.from({ length: training.target }, (_, index) => <span key={index} className={index < training.current ? 'done' : ''} />)}</span>
          </button>
        )}
        <button type="button" className="trajectory-mini-goal" onClick={() => navigate('food')}>
          <span className="trajectory-mini-heading"><span>Protein</span><Beef size={14} aria-hidden="true" /></span>
          <span className="trajectory-mini-number">{protein.available ? protein.remaining : dash}<small>{protein.available ? 'g' : ''}</small></span>
          <span className="trajectory-mini-caption">{protein.invalid ? 'Review food values' : !protein.available ? 'No food logged today' : protein.complete ? 'target met in logged food' : 'left in logged food today'}</span>
          <ProgressBar progress={protein.progress} />
        </button>
        <button type="button" className="trajectory-mini-goal" onClick={() => navigate('cash')}>
          <span className="trajectory-mini-heading"><span>Cash</span><Wallet size={14} aria-hidden="true" /></span>
          <span className="trajectory-mini-number trajectory-financial-number">{capital.cash != null ? cashAmount(capital.cash) : dash}</span>
          <span className="trajectory-mini-caption">{cash.available ? `Saved ${shortDate(cash.asOf)}${cash.stale ? ' \u00b7 update needed' : ''}` : 'Add a dated cash balance'}</span>
        </button>
        <button type="button" className="trajectory-mini-goal" onClick={() => navigate('finance')}>
          <span className="trajectory-mini-heading"><span>Invested assets</span><Landmark size={14} aria-hidden="true" /></span>
          <span className="trajectory-mini-number trajectory-financial-number">{capital.invested != null ? cashAmount(capital.invested) : dash}</span>
          <span className="trajectory-mini-caption">{portfolio.missingCount ? 'Update unpriced holdings' : 'Stocks / ETFs, excluding property'}</span>
        </button>
      </div>
      <div className="trajectory-energy"><WhoopEnergyPanel whoop={whoop} eaten={totals.kcal} protein={totals.protein} compact /></div>
      <button type="button" className="trajectory-insight" onClick={() => setSheet('why')} aria-haspopup="dialog">
        <CircleHelp size={15} aria-hidden="true" /><span>{insight}</span>
      </button>
      <button type="button" className="trajectory-primary" onClick={next}><span>{action.label}</span><ArrowRight size={17} aria-hidden="true" /></button>
      <span className="sr-only" role="status">{notice}</span>
      {sheet && createPortal(
        <div className="trajectory-theme trajectory-dialog">
          <Sheet key={sheet} open onClose={() => setSheet(null)} title={sheetTitle}>
            {sheet === 'settings' && <GoalEditor goals={goals} onSave={nextGoals => { setHome(previous => ({ ...previous, goals: nextGoals })); setNotice('Targets saved'); setSheet(null) }} />}
            {sheet === 'capital' && <CapitalDetails capital={capital} cash={cash} portfolio={portfolio} onNavigate={navigate} />}
            {sheet === 'gym' && <WorkoutGymSelector value={activeProgramId} onChange={id => { setActiveProgramId(id); setSheet(null) }} />}
            {sheet === 'why' && <div className="trajectory-details">
              <p className="trajectory-copy">Calculated locally from your saved data. No AI-generated claims or external AI requests.</p>
              <div className="trajectory-fact"><span>Main goal</span><strong>{label}</strong></div>
              {mainGoal === 'body' && <>
                <div className="trajectory-fact"><span>Last body-fat reading</span><strong>{body.available ? `${percent(body.current)} \u00b7 ${shortDate(body.latestDate)}` : 'Not recorded'}</strong></div>
                <div className="trajectory-fact"><span>Target</span><strong>{percent(body.target)}</strong></div>
                {body.available && <p className="trajectory-copy">The ring shows distance closed from {percent(body.baseline)} on {shortDate(body.baselineDate)} toward {percent(body.target)}.
                  {' '}{Math.abs(body.change).toFixed(1)} percentage points {body.change >= 0 ? 'lower' : 'higher'} since that reading. It is not an estimate of today&apos;s body fat.</p>}
              </>}
              <div className="trajectory-fact"><span>Training this week</span><strong>{training.current} / {training.target}</strong></div>
              <p className="trajectory-copy">Logged workout days from Monday {shortDate(training.weekStart)} through today, across both gyms. {training.loggedToday ? 'A workout is already logged today.' : 'Opening a workout does not log it.'}</p>
              <div className="trajectory-fact"><span>Protein logged today</span><strong>{protein.available ? `${Math.round(protein.current)} / ${protein.target}g` : protein.invalid ? 'Check Food values' : 'No food logged'}</strong></div>
              {mainGoal === 'cash' && <>
                <div className="trajectory-fact"><span>Cash snapshot</span><strong>{cash.available ? `${cashAmount(cash.current)} \u00b7 ${shortDate(cash.asOf)}` : 'Not recorded'}</strong></div>
                <div className="trajectory-fact"><span>Cash target</span><strong>{cash.configured ? formatUsd(cash.target) : 'Not set'}</strong></div>
                <p className="trajectory-copy">This is your last manually saved balance, not a bank feed or spendable cash after commitments. Review planned payments in Cash. {cash.stale ? 'The snapshot is missing, invalid, or at least seven days old.' : ''}</p>
              </>}
              <button type="button" className="trajectory-secondary" onClick={() => setSheet('settings')}>Edit targets</button>
            </div>}
          </Sheet>
        </div>, document.body)}
    </div>
  )
}
