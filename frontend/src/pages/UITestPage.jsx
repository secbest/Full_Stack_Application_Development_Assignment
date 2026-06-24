import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function UITestPage() {
  return (
    <div className="min-h-screen bg-background p-10 space-y-8">
      <h1 className="text-3xl font-bold text-foreground">shadcn/ui - Component Test</h1>

      {/* Button variants */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">Button variants</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* Card */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">Card</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Service Memo #1024</CardTitle>
              <CardDescription>Submitted by Field Crew - 24 Jun 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">
                Patient transport from Changi General Hospital. Overtime charges apply.
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">Review</Button>
              <Button size="sm" variant="outline">Dismiss</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendor Invoice #V-0092</CardTitle>
              <CardDescription>Pending OCR review - confidence 0.72</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">
                Low confidence extraction. Manual review required before AP approval.
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm" variant="destructive">Flag</Button>
              <Button size="sm" variant="outline">View PDF</Button>
            </CardFooter>
          </Card>
        </div>
      </section>
    </div>
  )
}
