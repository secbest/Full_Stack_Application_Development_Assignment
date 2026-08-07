jest.mock('@/context/ToastContext', () => ({ useToast: () => ({ error: jest.fn(), success: jest.fn() }) }))
jest.mock('@/api/fieldOps', () => ({ getCrewPositions: jest.fn() }))
jest.mock('@/components/FleetMap', () => ({
  FleetMap: ({ crew }) => require('react').createElement('div', { 'data-testid': 'fleet-map' }, `${crew.length} pins`),
  STATUS_COLORS: { available: '#22C55E', en_route: '#F59E0B', on_scene: '#3B82F6', off_duty: '#94A3B8' },
  STATUS_LABELS: { available: 'Available', en_route: 'En Route', on_scene: 'On Scene', off_duty: 'Off Duty' },
}))

const React = require('react')
const { render, screen } = require('@testing-library/react')
const userEvent = require('@testing-library/user-event').default
const { getCrewPositions } = require('@/api/fieldOps')
const FleetTrackerPage = require('../../src/pages/dashboard/FleetTrackerPage').default

function crewMember(overrides = {}) {
  return {
    id: 1,
    name: 'Ravi Kumar',
    status: 'available',
    position: { lat: 1.28, lng: 103.85 },
    current_job_reference: null,
    last_updated: '2026-08-07T02:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('renders a stat card per status and passes the full crew list to the map', async () => {
  getCrewPositions.mockResolvedValue({ data: { data: [
    crewMember({ id: 1, name: 'Ravi Kumar', status: 'available' }),
    crewMember({ id: 2, name: 'Ahmad Salleh', status: 'en_route', current_job_reference: 'BKG-1' }),
    crewMember({ id: 3, name: 'Wei Jian', status: 'on_scene', current_job_reference: 'BKG-2' }),
    crewMember({ id: 4, name: 'Farah Ismail', status: 'off_duty' }),
  ] } })

  render(React.createElement(FleetTrackerPage))

  expect(await screen.findByText('Fleet Tracker')).toBeInTheDocument()
  expect(screen.getByText('Available')).toBeInTheDocument()
  expect(screen.getByText('En Route')).toBeInTheDocument()
  expect(screen.getByText('On Scene')).toBeInTheDocument()
  expect(screen.getByText('Off Duty')).toBeInTheDocument()

  // One crew member per status in the fixture above, so every stat card reads "1".
  expect(screen.getAllByText('1')).toHaveLength(4)

  expect(screen.getByTestId('fleet-map')).toHaveTextContent('4 pins')
})

test('defaults to a minimap and opens the expanded map modal only on click', async () => {
  const user = userEvent.setup()
  getCrewPositions.mockResolvedValue({ data: { data: [crewMember()] } })

  render(React.createElement(FleetTrackerPage))
  await screen.findByText('Fleet Tracker')

  // Only the minimap is rendered up front - no dialog.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /expand map/i }))

  const dialog = screen.getByRole('dialog')
  expect(dialog).toBeInTheDocument()
  expect(screen.getAllByTestId('fleet-map')).toHaveLength(2) // minimap + expanded map

  await user.click(screen.getByRole('button', { name: /close/i }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('shows a retry button when the crew-positions request fails', async () => {
  getCrewPositions.mockRejectedValue(new Error('network error'))

  render(React.createElement(FleetTrackerPage))

  expect(await screen.findByText("Couldn't load crew positions.")).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
})
