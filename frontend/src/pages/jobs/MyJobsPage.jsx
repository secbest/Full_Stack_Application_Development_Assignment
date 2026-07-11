import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Loader2, MapPin, RefreshCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { listMyJobs } from '@/api/fieldOps'

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'all', label: 'All Upcoming' },
]

const SERVICE_TYPE_LABELS = {
  eas: 'Emergency Ambulance Services (EAS)',
  mts: 'Medical Transport Services (MTS)',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
}

function JobCard({ job, onCreateMemo }) {
  const accentColor = { confirmed: '#3B82F6', in_progress: '#F59E0B', completed: '#22C55E', invoiced: '#94A3B8' }[job.status] || '#94A3B8'

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        <div className="w-1" style={{ backgroundColor: accentColor }} />
        <CardContent className="flex-1 p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{job.client?.name || 'Unknown client'}</span>
              <StatusBadge status={job.status} />
            </div>
            <div className="text-sm text-muted-foreground">
              {SERVICE_TYPE_LABELS[job.service_type] || job.service_type} - {job.service_tier}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              {job.pickup_location} &rarr; {job.destination}
            </div>
            <div className="text-xs text-muted-foreground">
              {job.scheduled_date} at {job.scheduled_time} - Ref {job.reference_number}
            </div>
          </div>

          <div className="shrink-0">
            {job.status === 'confirmed' && (
              <Button size="sm" variant="outline" disabled title="Booking start-job endpoint is not built yet (Zheng Bao's scope) - see README">
                Start Job
              </Button>
            )}
            {job.status === 'in_progress' && (
              <Button size="sm" onClick={() => onCreateMemo(job)}>
                Start Job &amp; Create Memo
              </Button>
            )}
            {(job.status === 'completed' || job.status === 'invoiced') && (
              <span className="text-sm text-[#22C55E] font-medium">Memo Submitted</span>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

export default function MyJobsPage() {
  const [dateFilter, setDateFilter] = useState('today')
  const [jobs, setJobs] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const navigate = useNavigate()
  const toast = useToast()

  async function load() {
    setStatus('loading')
    try {
      const { data } = await listMyJobs(dateFilter === 'all' ? undefined : dateFilter)
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
  }, [dateFilter])

  function handleCreateMemo(job) {
    navigate(`/jobs/${job.id}/memo`)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Briefcase className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">My Jobs</h1>
      </div>

      <Tabs value={dateFilter} onValueChange={setDateFilter}>
        <TabsList>
          {DATE_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your jobs...
        </div>
      )}

      {status === 'error' && (
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Couldn't load your jobs.</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCcw className="w-4 h-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && jobs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            No jobs scheduled for this period.
          </CardContent>
        </Card>
      )}

      {status === 'ready' && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onCreateMemo={handleCreateMemo} />
          ))}
        </div>
      )}
    </div>
  )
}
