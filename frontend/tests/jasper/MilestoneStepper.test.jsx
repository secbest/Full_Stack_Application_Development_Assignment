// Owner: Jasper - Field Ops (client feedback item 1, interim review 17 Jul 2026).
// The milestone stepper was originally a vertical list (one row per stage), which made
// the My Jobs hero card too tall. Redesigned as a horizontal breadcrumb - the same
// circle+connector pattern already used by memo-wizard/WizardProgressBar.jsx - with a
// single caption line for the timestamp instead of one line per recorded stage.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestoneStepper } from '@/components/MilestoneStepper'

function milestone(type, iso) {
  return { milestone_type: type, recorded_at: iso }
}

// The component formats recorded_at in the runtime's local timezone, so assert
// against the same conversion rather than a hardcoded clock time that would only
// be correct in one specific timezone.
function expectedTime(iso) {
  return new Date(iso).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })
}

describe('MilestoneStepper - breadcrumb layout', () => {
  test('renders one circle per stage, with the next stage as the single action button', () => {
    render(<MilestoneStepper milestones={[milestone('activated', '2026-08-04T00:45:00Z')]} onRecord={() => {}} />)

    expect(screen.getByTestId('milestone-next-action')).toHaveTextContent('Arrived at Location')
    expect(screen.getByTestId('milestone-next-action')).toBeEnabled()
  })

  test('the caption line defaults to the most recently recorded stage', () => {
    render(
      <MilestoneStepper
        milestones={[
          milestone('activated', '2026-08-04T00:45:00Z'),
          milestone('arrived_at_location', '2026-08-04T01:10:00Z'),
        ]}
        onRecord={() => {}}
      />
    )

    const caption = screen.getByTestId('milestone-caption')
    expect(caption).toHaveTextContent('Arrived at Location')
    expect(caption).toHaveTextContent(expectedTime('2026-08-04T01:10:00Z'))
  })

  test('tapping an earlier recorded stage shows its own timestamp in the caption', async () => {
    const user = userEvent.setup()
    render(
      <MilestoneStepper
        milestones={[
          milestone('activated', '2026-08-04T00:45:00Z'),
          milestone('arrived_at_location', '2026-08-04T01:10:00Z'),
        ]}
        onRecord={() => {}}
      />
    )

    await user.click(screen.getByRole('button', { name: /Start Job - recorded/i }))

    expect(screen.getByTestId('milestone-caption')).toHaveTextContent(expectedTime('2026-08-04T00:45:00Z'))
  })

  test('with no milestones recorded yet, "Start Job" is the action button and there is no caption', () => {
    render(<MilestoneStepper milestones={[]} onRecord={() => {}} />)

    expect(screen.getByTestId('milestone-next-action')).toHaveTextContent('Start Job')
    expect(screen.queryByTestId('milestone-caption')).not.toBeInTheDocument()
  })

  test('once every stage is recorded there is no action button left', () => {
    const all = ['activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed']
      .map((t, i) => milestone(t, `2026-08-04T0${i}:00:00Z`))
    render(<MilestoneStepper milestones={all} onRecord={() => {}} />)

    expect(screen.queryByTestId('milestone-next-action')).not.toBeInTheDocument()
  })

  test('clicking the enabled action button calls onRecord with the next milestone type', async () => {
    const user = userEvent.setup()
    const onRecord = jest.fn()
    render(<MilestoneStepper milestones={[milestone('activated', '2026-08-04T00:45:00Z')]} onRecord={onRecord} />)

    await user.click(screen.getByTestId('milestone-next-action'))

    expect(onRecord).toHaveBeenCalledWith('arrived_at_location')
  })

  test('busy disables the action button and shows a spinner without blocking the tap target name', () => {
    render(<MilestoneStepper milestones={[]} onRecord={() => {}} busy />)

    expect(screen.getByTestId('milestone-next-action')).toBeDisabled()
  })
})
