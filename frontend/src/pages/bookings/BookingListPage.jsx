import { CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Owner: Zheng Bao (Quotations Specialist)
// Features: Structured intake queue, booking confirmation/rejection, crew assignment, service tier
export default function BookingListPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Intake Queue</CardTitle>
          <CardDescription>Review incoming service requests, confirm bookings, assign crews</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Implementation placeholder - Zheng Bao to build.</p>
        </CardContent>
      </Card>
    </div>
  )
}
