import { LayoutDashboard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Owner: Managing Director
// Features: Executive KPI tiles, overhead cost summary, vendor expense chart
export default function DashboardPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Executive Dashboard</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>Macro expense analytics and revenue summary - Managing Director view</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Implementation placeholder - Liang Yi to build.</p>
        </CardContent>
      </Card>
    </div>
  )
}
