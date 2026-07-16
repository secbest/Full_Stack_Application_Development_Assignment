// Owner: Kwan Hua (Wave 3 - AR stream). Reusable amount/quantity field used across the
// pricing-contract and invoice-adjustment screens.
//
// Why not a plain <input type="number">: the native spinner arrows step by whatever
// `step` is set to, and there is no built-in "hold to go faster" behaviour. AR staff
// enter money and quantities that are almost always whole-number adjustments, so the
// requested behaviour is:
//   - a single click on an arrow changes the value by ONES (step, default 1)
//   - HOLDING the arrow down keeps repeating, and after a short while it accelerates
//     to changing by TENS (bigStep, default 10)
// Typing is still free-form (decimals allowed, e.g. cents) - the arrows are only a
// coarse nudge. We render our own arrow buttons and use a text input with a decimal
// input mode so no native spinner is shown alongside ours.
import { useCallback, useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

// Only allow a well-formed money/quantity string as the user types: optional digits,
// at most one decimal point, at most two decimal places. Empty is allowed so the field
// can be cleared. Anything else (letters, extra dots, 3+ decimals) is simply ignored.
const VALID_INPUT = /^\d*\.?\d{0,2}$/

const round2 = (n) => Math.round(n * 100) / 100

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  bigStep = 10,
  decimals,
  placeholder,
  className = '',
  disabled = false,
  autoFocus = false,
  ariaLabel,
}) {
  // Timers/flags live in refs so re-renders (each onChange) don't reset an in-progress
  // hold. holdDelay waits before auto-repeat starts (so a quick click is just +1);
  // repeat fires the ongoing steps; repeats counts how many auto-steps have fired so we
  // can escalate from ones to tens after the arrow has been held a moment.
  const holdDelay = useRef(null)
  const repeat = useRef(null)
  const repeats = useRef(0)

  // The repeat interval closes over applyDelta once (at press time), so reading `value`
  // directly would make every tick step from the same stale base. This ref always holds
  // the latest committed value, so each tick accumulates on top of the previous one.
  const valueRef = useRef(value)
  valueRef.current = value

  const clamp = useCallback((n) => {
    let v = n
    if (max != null && v > max) v = max
    if (min != null && v < min) v = min
    return v
  }, [min, max])

  const applyDelta = useCallback((dir, big) => {
    const s = big ? bigStep : step
    const current = Number(valueRef.current)
    const base = Number.isFinite(current) && valueRef.current !== '' ? current : 0
    const next = clamp(round2(base + dir * s))
    // Keep money fields (decimals set) formatted while stepping so the arrows don't
    // momentarily strip "50.00" down to "51" between steps.
    onChange(decimals != null ? next.toFixed(decimals) : String(next))
  }, [onChange, step, bigStep, clamp, decimals])

  const stop = useCallback(() => {
    clearTimeout(holdDelay.current)
    clearInterval(repeat.current)
    holdDelay.current = null
    repeat.current = null
    repeats.current = 0
  }, [])

  // Clean up any live timer if the component unmounts mid-hold (e.g. the row leaves
  // edit mode) so an interval never fires against an unmounted component.
  useEffect(() => stop, [stop])

  const start = useCallback((dir) => {
    if (disabled) return
    applyDelta(dir, false) // one immediate step on press, so a plain click = +1/-1
    holdDelay.current = setTimeout(() => {
      repeats.current = 0
      repeat.current = setInterval(() => {
        repeats.current += 1
        // After ~6 repeated ones (roughly 0.7s of holding), switch to tens so a long
        // hold covers large ranges quickly without overshooting on a short hold.
        applyDelta(dir, repeats.current > 6)
      }, 110)
    }, 400)
  }, [disabled, applyDelta])

  function handleType(e) {
    const raw = e.target.value
    if (raw === '' || VALID_INPUT.test(raw)) onChange(raw)
  }

  // On blur: re-clamp a typed value above the cap (or below min) to the limit rather
  // than leaving it for the submit-time validator, and - when `decimals` is set (money
  // fields like unit price) - normalize the display to a fixed number of decimal places
  // so e.g. "50" reads back as "50.00" and cents are never visually dropped.
  function handleBlur() {
    if (value === '') return
    const n = Number(value)
    if (!Number.isFinite(n)) return
    const c = clamp(n)
    if (decimals != null) onChange(c.toFixed(decimals))
    else if (c !== n) onChange(String(round2(c)))
  }

  return (
    <div className={`relative inline-flex items-stretch ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={handleType}
        onBlur={handleBlur}
        className="w-full rounded-md border border-slate-200 pl-2 pr-7 text-sm text-right outline-none focus:border-blue-500 disabled:opacity-50"
      />
      <div className="absolute right-0 top-0 bottom-0 flex flex-col border-l border-slate-200 rounded-r-md overflow-hidden select-none">
        {[
          { dir: 1, Icon: ChevronUp, label: 'Increase' },
          { dir: -1, Icon: ChevronDown, label: 'Decrease' },
        ].map(({ dir, Icon, label }) => (
          <button
            key={dir}
            type="button"
            tabIndex={-1}
            aria-label={label}
            disabled={disabled}
            // preventDefault keeps the press from stealing focus/selecting text mid-hold.
            onMouseDown={(e) => { e.preventDefault(); start(dir) }}
            onMouseUp={stop}
            onMouseLeave={stop}
            onTouchStart={(e) => { e.preventDefault(); start(dir) }}
            onTouchEnd={stop}
            onTouchCancel={stop}
            className="flex-1 w-6 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <Icon size={12} />
          </button>
        ))}
      </div>
    </div>
  )
}
