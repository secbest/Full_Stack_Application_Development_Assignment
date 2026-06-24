import { Plug } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Owner: Kwan Hua (AP Specialist)
// Features: Xero OAuth2 connect/disconnect, connection status, token health
export default function XeroConnectPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Plug className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Xero Connection</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Xero OAuth2 Status</CardTitle>
          <CardDescription>Connect EFAR to Xero to enable AP sync and bank feed ingestion</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Implementation placeholder - Kwan Hua to build.</p>
        </CardContent>
      </Card>
    </div>
  )
}
