import { ShieldX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks'
import { Button } from '@/components/ui/button'
import { getRoleHome } from '@/router/routes'

export default function ForbiddenPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-5">
      <ShieldX className="w-16 h-16 text-destructive" />
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">403 - Forbidden</h1>
        <p className="text-muted-foreground max-w-sm">
          Your account does not have permission to view this page.
        </p>
      </div>
      <Button onClick={() => navigate(user ? getRoleHome(user.role) : '/login', { replace: true })}>
        Go to my home page
      </Button>
    </div>
  )
}
