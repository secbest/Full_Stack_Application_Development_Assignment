import { ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Owner: Liang Yi / Jasper (AR Specialist reviews; Field Crew submits)
// Features: Memo review queue, approve/flag, trigger AR notification
export default function ServiceMemoListPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Memo Review</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Submitted Service Memos</CardTitle>
          <CardDescription>Review field memos submitted by crew, flag issues, pass to billing</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Implementation placeholder - Liang Yi / Jasper to build.</p>
        </CardContent>
      </Card>
    </div>
  )
}
