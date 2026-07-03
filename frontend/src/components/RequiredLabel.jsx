import { Label } from '@/components/ui/label'

export function RequiredLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-[#EF4444]">*</span>
    </Label>
  )
}
