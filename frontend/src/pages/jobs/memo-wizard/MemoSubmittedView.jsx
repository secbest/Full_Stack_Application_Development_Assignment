import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function MemoSubmittedView({ memo }) {
  const navigate = useNavigate()
  return (
    <Card className="max-w-md mx-auto mt-8 md:mt-12">
      <CardContent className="p-6 md:p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#22C55E]/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Memo Submitted!</h2>
        <p className="text-sm text-muted-foreground">Reference: Memo #{memo.id}</p>
        {/* Already stacked - the buttons only need a taller touch target on a phone. */}
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={() => navigate('/jobs')} className="h-11 md:h-10">Back to My Jobs</Button>
          <Button variant="outline" onClick={() => navigate('/memos/history')} className="h-11 md:h-10">View My Memos</Button>
        </div>
      </CardContent>
    </Card>
  )
}
