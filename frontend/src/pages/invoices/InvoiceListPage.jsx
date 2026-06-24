import { Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Owner: Jasper (AR Specialist)
// Features: Invoice list, surcharge adjustment, batch approval, Xero sync status
export default function InvoiceListPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Receipt className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Invoice Queue</CardTitle>
          <CardDescription>Review matched invoices, adjust surcharges, sync to Xero</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Implementation placeholder - Jasper to build.</p>
        </CardContent>
      </Card>
    </div>
  )
}
