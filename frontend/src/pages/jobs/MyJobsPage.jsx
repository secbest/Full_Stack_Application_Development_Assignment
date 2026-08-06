// Owner: Jasper - Field Ops (Wave 2A; reshaped for client feedback items 1 + 3,
// interim review 17 Jul 2026).
//
// EFAR: "could it be the case that they are going to do at that present moment,
// rather than the whole lot list?" - the page now leads with ONE hero card for the
// job happening now, carrying the live milestone stepper (item 1). Every other job
// still awaiting action (confirmed or in_progress) is demoted below under an
// always-visible "Upcoming jobs" section that keeps the old date tabs, filtered
// client-side from a single unfiltered fetch. Completed/invoiced bookings are
// excluded entirely - their memo is already submitted, so they belong in Memo
// History, not a second list here.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Briefcase, Loader2, MapPin, RefreshCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/StatusBadge'
import { MilestoneStepper } from '@/components/MilestoneStepper'
import { useToast } from '@/context/ToastContext'
import { listMyJobs, recordMilestone } from '@/api/fieldOps'

const DATE_FILTERS = [
  { value: 'all', label: 'All Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
]

const SERVICE_TYPE_LABELS = {
  eas: 'Emergency Ambulance Services (EAS)',
  mts: 'Medical Transport Services (MTS)',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
}

// The call centre posts a case about an hour before its start time (EFAR, 00:18:26),
// so a confirmed job "belongs to now" once it is within this window.
const ACTIVATION_WINDOW_MS = 60 * 60 * 1000
const CURRENT_JOB_REFRESH_MS = 30 * 1000

// "Upcoming jobs" means jobs with something still to do. A completed/invoiced booking
// already has its memo submitted - it belongs in Memo History, not here. Without this
// filter, every booking a crew member has EVER had piles up under a misleading
// "upcoming" label (11 of 13 rows were finished jobs in one real account).
const UPCOMING_STATUSES = ['confirmed', 'in_progress']

function localDateStr(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function jobStartDate(job) {
  return new Date(`${job.scheduled_date}T${job.scheduled_time}:00`)
}

function activatedAt(job) {
  const activated = (job.milestones || []).find((m) => m.milestone_type === 'activated')
  return activated ? new Date(activated.recorded_at).getTime() : 0
}

// A confirmed job "belongs to now" once it's today and within the activation window
// (or already past its start time) - the same rule the hero card uses to decide
// whether a confirmed job is due, reused wherever "can this be started yet" matters.
export function isDueForActivation(job, now = new Date()) {
  return job.scheduled_date === localDateStr(now) && jobStartDate(job).getTime() <= now.getTime() + ACTIVATION_WINDOW_MS
}

// Hero selection (item 3): the live current job is whichever in_progress job the
// crew most recently tapped "Start Job" on - not just the first in_progress job in
// the list. Without this, an older job that's still awaiting its memo (e.g. one the
// crew started earlier and hasn't wrapped up yet) would permanently hog the hero
// slot, and a job the crew starts right now would never surface as "current" until
// the old one is completed. Failing that (nothing in_progress), fall back to the
// earliest confirmed job that is due. Completed/invoiced jobs are never current.
export function selectCurrentJob(jobs, now = new Date()) {
  const inProgress = jobs.filter((j) => j.status === 'in_progress')
  if (inProgress.length > 0) {
    return inProgress.reduce((latest, j) => (activatedAt(j) >= activatedAt(latest) ? j : latest))
  }

  return jobs.find((j) => j.status === 'confirmed' && isDueForActivation(j, now)) || null
}

function matchesDateFilter(job, filter, now = new Date()) {
  if (filter === 'all') return true
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (filter === 'today') return job.scheduled_date === localDateStr(today)
  if (filter === 'tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return job.scheduled_date === localDateStr(tomorrow)
  }
  // this_week - same Sunday-based week window the backend used for its filter
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()))
  return job.scheduled_date >= localDateStr(today) && job.scheduled_date <= localDateStr(endOfWeek)
}

function JobRoute({ job }) {
  return (
    <div className="flex items-start gap-1 text-sm text-muted-foreground">
      <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span className="break-words">
        {job.pickup_location}
        <ArrowRight className="inline w-3.5 h-3.5 mx-1.5 -mt-0.5 text-foreground" strokeWidth={3} aria-hidden="true" />
        {job.destination}
      </span>
    </div>
  )
}

// The single "what am I doing right now" card (item 3), carrying the milestone
// stepper (item 1). Once job_completed is recorded, creating the memo becomes the
// emphasized next action.
function CurrentJobHero({ job, onRecordMilestone, milestoneBusy, onCreateMemo }) {
  const jobComplete = (job.milestones || []).some((m) => m.milestone_type === 'job_completed')

  return (
    <Card data-testid="current-job-hero" className="overflow-hidden border-[#3B82F6]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Current Job</CardTitle>
          <StatusBadge status={job.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{job.client?.name || 'Unknown client'}</div>
          <div className="text-sm text-muted-foreground">
            {SERVICE_TYPE_LABELS[job.service_type] || job.service_type} - {job.service_tier}
          </div>
          <JobRoute job={job} />
          <div className="text-xs text-muted-foreground">
            {job.scheduled_date} at {job.scheduled_time} - Ref {job.reference_number}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Job Milestones</p>
          <MilestoneStepper milestones={job.milestones || []} onRecord={onRecordMilestone} busy={milestoneBusy} />
        </div>

        {job.status === 'in_progress' && (
          <div className="pt-1 space-y-2">
            {jobComplete && (
              <p className="text-xs text-[#22C55E] font-medium">Job complete - fill in the service memo while the details are fresh.</p>
            )}
            <Button
              variant={jobComplete ? 'default' : 'outline'}
              className="w-full h-11"
              onClick={() => onCreateMemo(job)}
            >
              Create Memo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Only ever rendered for a confirmed or in_progress job - see UPCOMING_STATUSES.
// A completed/invoiced booking's memo is already submitted, so it never reaches here.
function JobCard({ job, onCreateMemo, onStartJob, startBusy, startEligible }) {
  const accentColor = { confirmed: '#3B82F6', in_progress: '#F59E0B' }[job.status] || '#94A3B8'

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        <div className="w-1 flex-shrink-0" style={{ backgroundColor: accentColor }} />
        {/* Details and action sit side by side from `md` up; on a phone the action drops
            below the details and spans the card. min-w-0 lets the long location line
            truncate instead of forcing the card wider than the viewport. */}
        <CardContent className="flex-1 min-w-0 p-4 flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{job.client?.name || 'Unknown client'}</span>
              <StatusBadge status={job.status} />
            </div>
            <div className="text-sm text-muted-foreground">
              {SERVICE_TYPE_LABELS[job.service_type] || job.service_type} - {job.service_tier}
            </div>
            <JobRoute job={job} />
            <div className="text-xs text-muted-foreground">
              {job.scheduled_date} at {job.scheduled_time} - Ref {job.reference_number}
            </div>
          </div>

          <div className="md:shrink-0 flex flex-col items-stretch gap-1 md:items-end">
            {/* A confirmed job is demoted here only because another job already holds
                the single hero slot (client feedback #3) - the backend places no
                restriction on which confirmed booking can be activated, so this card
                gets its own "Start Job" tap target rather than leaving the crew with
                no way to activate it until the hero job is wrapped up. But that action
                only appears once the job is actually due (same window the hero card
                uses) - a job scheduled for tomorrow (or later) shows only its
                scheduled time, same as before this button existed. */}
            {job.status === 'confirmed' && (
              <>
                <span className="block text-sm text-muted-foreground md:text-right">Starts at {job.scheduled_time}</span>
                {startEligible && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={startBusy}
                    onClick={() => onStartJob(job)}
                    className="w-full h-11 md:w-auto md:h-9"
                  >
                    {startBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                    Start Job
                  </Button>
                )}
              </>
            )}
            {job.status === 'in_progress' && (
              <Button size="sm" onClick={() => onCreateMemo(job)} className="w-full h-11 md:w-auto md:h-9">
                Create Memo
              </Button>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

export default function MyJobsPage() {
  const [dateFilter, setDateFilter] = useState('all')
  const [jobs, setJobs] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [milestoneBusy, setMilestoneBusy] = useState(false)
  const [startingJobId, setStartingJobId] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const navigate = useNavigate()
  const toast = useToast()

  async function load() {
    setStatus('loading')
    try {
      const { data } = await listMyJobs()
      setJobs(data.data)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      toast.error(err.response?.data?.message || 'Failed to load your jobs. Please try again.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep an open crew dashboard live. Previously the current-job window was only
  // evaluated when jobs loaded, so a booking could pass its scheduled time while
  // remaining stuck in Upcoming until the crew manually refreshed the whole page.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CURRENT_JOB_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

  const currentJob = useMemo(() => (status === 'ready' ? selectCurrentJob(jobs, now) : null), [status, jobs, now])
  const otherJobs = jobs.filter((j) => j.id !== currentJob?.id && UPCOMING_STATUSES.includes(j.status))
  const filteredJobs = otherJobs.filter((j) => matchesDateFilter(j, dateFilter, now))

  async function handleRecordMilestone(milestoneType) {
    if (!currentJob) return
    setMilestoneBusy(true)
    try {
      const { data } = await recordMilestone(currentJob.id, milestoneType)
      const { status: newStatus, milestones } = data.data
      setJobs((prev) => prev.map((j) => (j.id === currentJob.id ? { ...j, status: newStatus, milestones } : j)))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record the milestone. Please try again.')
    } finally {
      setMilestoneBusy(false)
    }
  }

  function handleCreateMemo(job) {
    navigate(`/jobs/${job.id}/memo`)
  }

  // Activates a confirmed job straight from its Upcoming jobs card - the same
  // 'activated' milestone the hero's stepper records, but not gated on this job
  // holding the single hero slot (see JobCard).
  async function handleStartJob(job) {
    setStartingJobId(job.id)
    try {
      const { data } = await recordMilestone(job.id, 'activated')
      const { status: newStatus, milestones } = data.data
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: newStatus, milestones } : j)))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start the job. Please try again.')
    } finally {
      setStartingJobId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Briefcase className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl md:text-2xl font-semibold text-foreground">My Jobs</h1>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your jobs...
        </div>
      )}

      {status === 'error' && (
        <Card>
          <CardContent className="p-4 md:p-6 flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <p className="text-sm text-muted-foreground">Couldn't load your jobs.</p>
            <Button variant="outline" size="sm" onClick={load} className="w-full h-11 md:w-auto md:h-9">
              <RefreshCcw className="w-4 h-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && (
        <>
          {currentJob ? (
            <CurrentJobHero
              job={currentJob}
              onRecordMilestone={handleRecordMilestone}
              milestoneBusy={milestoneBusy}
              onCreateMemo={handleCreateMemo}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">No active job right now.</p>
                <p>Your next job appears here about an hour before its start time.</p>
              </CardContent>
            </Card>
          )}

          {/* Everything that is not happening now stays out of the way (item 3),
              but stays visible - a previous collapsed "Upcoming jobs" toggle hid the
              tabs and job list behind an extra tap, which defeated their purpose. */}
          <p className="text-sm font-medium text-muted-foreground pt-2">
            Upcoming jobs ({otherJobs.length})
          </p>

          {/* Four filters do not fit one 375px row - a 2x2 grid keeps all of them
              visible and tappable rather than hiding two behind a horizontal
              scroll with no affordance. */}
          <Tabs value={dateFilter} onValueChange={setDateFilter}>
            <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl md:inline-flex md:w-auto md:rounded-full">
              {DATE_FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="py-2.5 md:py-1.5">{f.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 md:p-12 text-center text-sm text-muted-foreground">
                No jobs scheduled for this period.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCreateMemo={handleCreateMemo}
                  onStartJob={handleStartJob}
                  startBusy={startingJobId === job.id}
                  startEligible={isDueForActivation(job, now)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
