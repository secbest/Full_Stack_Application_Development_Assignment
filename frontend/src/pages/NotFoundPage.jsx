import { FileQuestion } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks'
import { Button } from '@/components/ui/button'
import { getRoleHome } from '@/router/routes'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-5">
      <FileQuestion className="w-16 h-16 text-muted-foreground" />
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">404 - Page Not Found</h1>
        <p className="text-muted-foreground max-w-sm">
          The page you are looking for does not exist.
        </p>
      </div>
      <Button onClick={() => navigate(user ? getRoleHome(user.role) : '/login', { replace: true })}>
        {user ? 'Go to my home page' : 'Go to login'}
      </Button>
    </div>
  )
}
