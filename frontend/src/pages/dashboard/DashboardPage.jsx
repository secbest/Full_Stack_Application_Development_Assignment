import { LayoutDashboard } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import FleetOverviewTab from './FleetOverviewTab'
import ExpenseSummaryTab from './ExpenseSummaryTab'

// Owner: Managing Director. Implemented by Jasper as part of Liang Yi's Wave 2A scope - see README.
export default function DashboardPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Executive Dashboard</h1>
      </div>

      <Tabs defaultValue="fleet">
        <TabsList>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="expense">Expense</TabsTrigger>
        </TabsList>
        <TabsContent value="fleet" className="mt-4">
          <FleetOverviewTab />
        </TabsContent>
        <TabsContent value="expense" className="mt-4">
          <ExpenseSummaryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
