import { FilePlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Owner: Liang Yi (Field Crew)
// Features: Digital service memo form, signature capture, hospital stamp upload, draft in localStorage
export default function ServiceMemoFormPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <FilePlus className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">New Service Memo</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Field Service Record</CardTitle>
          <CardDescription>Record job details, overtime, and evacuation charges for billing</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Implementation placeholder - Liang Yi to build.</p>
        </CardContent>
      </Card>
    </div>
  )
}
