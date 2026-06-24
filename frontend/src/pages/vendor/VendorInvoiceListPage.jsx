import { Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Owner: Kwan Hua (AP Specialist)
// Features: PDF upload, OCR extraction, rebate verification, AP approval, Xero sync
export default function VendorInvoiceListPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Building2 className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Vendor Invoices</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>AP Invoice Queue</CardTitle>
          <CardDescription>Upload vendor PDFs, review OCR-extracted data, verify rebate, approve for Xero</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Implementation placeholder - Kwan Hua to build.</p>
        </CardContent>
      </Card>
    </div>
  )
}
