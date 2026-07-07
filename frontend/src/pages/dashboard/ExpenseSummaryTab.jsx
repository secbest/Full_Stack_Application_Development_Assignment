import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/context/ToastContext'
import { getVendorExpenses } from '@/api/fieldOps'

function KpiCard({ label, value, valueColor }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1" style={valueColor ? { color: valueColor } : undefined}>${value}</p>
      </CardContent>
    </Card>
  )
}

export default function ExpenseSummaryTab() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', vendor_name: '' })
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const toast = useToast()

  async function load() {
    setStatus('loading')
    try {
      const params = {}
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to
      if (filters.vendor_name) params.vendor_name = filters.vendor_name
      const { data: res } = await getVendorExpenses(params)
      setData(res.data)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      toast.error(err.response?.data?.message || 'Failed to load vendor expenses.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <Label htmlFor="date_from">From</Label>
          <Input id="date_from" type="date" value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="date_to">To</Label>
          <Input id="date_to" type="date" value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="vendor_name">Vendor</Label>
          <Input id="vendor_name" placeholder="Vendor name" value={filters.vendor_name} onChange={(e) => setFilters((f) => ({ ...f, vendor_name: e.target.value }))} />
        </div>
        <Button onClick={load}>Apply Filters</Button>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      )}

      {status === 'error' && (
        <Card><CardContent className="p-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Couldn't load vendor expenses.</p>
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="w-4 h-4 mr-2" /> Retry</Button>
        </CardContent></Card>
      )}

      {status === 'ready' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Total Vendor Expenditure" value={data.summary.total_expenditure} />
            <KpiCard label="Total Rebates Applied" value={data.summary.total_rebates_applied} valueColor="#22C55E" />
            <KpiCard label="Net Payable After Rebates" value={data.summary.net_payable} />
          </div>

          <div className="grid grid-cols-[1.2fr_1fr] gap-4">
            <Card>
              <CardHeader><CardTitle>Vendor Breakdown</CardTitle></CardHeader>
              <CardContent>
                {data.by_vendor.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">No approved vendor invoices for this period.</p>
                ) : (
                  <BarChart
                    xAxis={[{ scaleType: 'band', data: data.by_vendor.map((v) => v.vendor_name) }]}
                    series={[{ data: data.by_vendor.map((v) => Number(v.total_expenditure)), color: '#3B82F6' }]}
                    height={260}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>By Vendor</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Vendor</TableHead><TableHead>Net Payable</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_vendor.map((v) => (
                      <TableRow key={v.vendor_name}>
                        <TableCell>{v.vendor_name}</TableCell>
                        <TableCell>${v.net_payable}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Vendor Spend by Month</CardTitle></CardHeader>
            <CardContent>
              {data.monthly_trend.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">No monthly data for this period.</p>
              ) : (
                <LineChart
                  xAxis={[{ scaleType: 'point', data: data.monthly_trend.map((m) => m.month) }]}
                  series={[{ data: data.monthly_trend.map((m) => Number(m.total_expenditure)), label: 'Expenditure', color: '#3B82F6' }]}
                  height={260}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
