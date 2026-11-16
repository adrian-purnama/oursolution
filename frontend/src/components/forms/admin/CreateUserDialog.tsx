import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import PasswordInput from '#/components/forms/shared/PasswordInput'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { USER_ROLE_LABELS } from '#/lib/adminUser'
import type { AdminUser, UserRole } from '#/lib/adminUser'
import { apiFetch } from '#/lib/api'
import { MIN_PASSWORD_LENGTH } from '#/lib/password'
import { hintClassName } from '#/lib/ui-classes'

/**
 * Admin: make an account directly, without the sign-up email code. Works
 * even when registration is closed. The user signs in with this password.
 */
export default function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (user: AdminUser) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail('')
    setPassword('')
    setRole('user')
  }, [open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim()) {
      toast.error('Enter an email')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    setSaving(true)
    try {
      const response = await apiFetch<AdminUser>('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password, role }),
      })
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to create user')
        return
      }
      toast.success(`Created ${response.data.email}`)
      onCreated(response.data)
      onOpenChange(false)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Create an account without the sign-up email code. Share the password
            with the user yourself.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">Password</Label>
            <PasswordInput
              id="new-user-password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <p className={`text-xs ${hintClassName}`}>
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
            >
              <SelectTrigger id="new-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{USER_ROLE_LABELS.user}</SelectItem>
                <SelectItem value="admin">{USER_ROLE_LABELS.admin}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
