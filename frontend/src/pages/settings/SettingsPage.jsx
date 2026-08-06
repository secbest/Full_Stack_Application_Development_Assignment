// Owner: Jasper - Account Settings (docs/superpowers/specs/2026-07-11-account-settings-page-design.md).
// Shared /settings page for every role: profile edit (name/email) + password change.
// The only entry point is the sidebar user footer in AppLayout.jsx - there is
// intentionally no NAV_ROUTES item for this page.
import { useState } from 'react'
import { useFormik } from 'formik'
import { Settings, Loader2, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredLabel } from '@/components/RequiredLabel'
import { FieldError } from '@/components/FieldError'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks'
import { updateProfile, updatePassword } from '@/api/users'
import { updateProfileSchema, changePasswordSchema } from '@/validation/userValidation'

const ROLE_LABELS = {
  managing_director: 'Managing Director',
  ar_specialist: 'AR Specialist',
  ap_specialist: 'AP Specialist',
  quotations_specialist: 'Quotations Specialist',
  field_crew: 'Field Crew',
}

export default function SettingsPage() {
  const toast = useToast()
  const { user, updateUser } = useAuth()

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const profileForm = useFormik({
    initialValues: { name: user?.name || '', email: user?.email || '' },
    validationSchema: updateProfileSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, setFieldError }) => {
      try {
        const { token } = await updateProfile(values)
        updateUser(token)
        toast.success('Profile updated successfully.')
      } catch (err) {
        if (err.response?.data?.code === 'EMAIL_IN_USE') {
          setFieldError('email', err.response.data.message)
        } else {
          toast.error(err.response?.data?.message || 'Failed to update profile. Please try again.')
        }
      } finally {
        setSubmitting(false)
      }
    },
  })

  const passwordForm = useFormik({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validationSchema: changePasswordSchema,
    onSubmit: async (values, { setSubmitting, setFieldError, resetForm }) => {
      try {
        const { token } = await updatePassword(values)
        // Changing your password bumps token_version server-side (revokes other
        // sessions), which would also invalidate the token this tab is holding -
        // store the freshly re-signed one so this session stays logged in too.
        updateUser(token)
        resetForm()
        toast.success('Password updated successfully.')
      } catch (err) {
        if (err.response?.data?.code === 'INVALID_CREDENTIALS') {
          setFieldError('currentPassword', 'Incorrect password.')
        } else {
          toast.error(err.response?.data?.message || 'Failed to update password. Please try again.')
        }
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      </div>

      <div className="max-w-2xl space-y-4">
        <form onSubmit={profileForm.handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your name and email address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <RequiredLabel htmlFor="name">Name</RequiredLabel>
                <Input id="name" name="name" value={profileForm.values.name} onChange={profileForm.handleChange} onBlur={profileForm.handleBlur} />
                <FieldError formik={profileForm} name="name" />
              </div>
              <div>
                <RequiredLabel htmlFor="email">Email</RequiredLabel>
                <Input id="email" name="email" type="email" value={profileForm.values.email} onChange={profileForm.handleChange} onBlur={profileForm.handleBlur} />
                <FieldError formik={profileForm} name="email" />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" value={ROLE_LABELS[user?.role] || user?.role || ''} disabled />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={profileForm.isSubmitting}>
                  {profileForm.isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <form onSubmit={passwordForm.handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Enter your current password and choose a new one.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <RequiredLabel htmlFor="currentPassword">Current Password</RequiredLabel>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="pr-10"
                    value={passwordForm.values.currentPassword}
                    onChange={passwordForm.handleChange}
                    onBlur={passwordForm.handleBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <FieldError formik={passwordForm} name="currentPassword" />
              </div>
              <div>
                <RequiredLabel htmlFor="newPassword">New Password</RequiredLabel>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    className="pr-10"
                    value={passwordForm.values.newPassword}
                    onChange={passwordForm.handleChange}
                    onBlur={passwordForm.handleBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <FieldError formik={passwordForm} name="newPassword" />
              </div>
              <div>
                <RequiredLabel htmlFor="confirmPassword">Confirm New Password</RequiredLabel>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="pr-10"
                    value={passwordForm.values.confirmPassword}
                    onChange={passwordForm.handleChange}
                    onBlur={passwordForm.handleBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <FieldError formik={passwordForm} name="confirmPassword" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordForm.isSubmitting}>
                  {passwordForm.isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
