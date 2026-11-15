import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle } from 'lucide-react'
import PasswordInput from '#/components/forms/shared/PasswordInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useAuth } from '#/context/authContext'
import type { AdminUser, AdminUserDetail, UserRole } from '#/lib/adminUser'
import { USER_ROLE_LABELS } from '#/lib/adminUser'
import { apiFetch } from '#/lib/api'
import { MIN_PASSWORD_LENGTH } from '#/lib/password'
import { buttonClassName, hintClassName } from '#/lib/ui-classes'

type UserPatch = {
  password?: string
  isBlocked?: boolean
  role?: UserRole
}

export default function UserDetailForm({ userId }: { userId: string }) {
  const { refreshAuth, user: actor } = useAuth()

  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole>('user')
  const [isBlocked, setIsBlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const run = { cancelled: false }
    setLoading(true)

    void (async () => {
      try {
        const response = await apiFetch<AdminUserDetail>(
          `/admin/users/${userId}`,
        )
        if (run.cancelled) return
        if (!response.success || !response.data) {
          toast.error(response.message || 'Failed to load user')
          return
        }
        setDetail(response.data)
        setRole(response.data.role)
        setIsBlocked(response.data.isBlocked)
      } catch {
        if (!run.cancelled) toast.error('Unable to reach the server')
      } finally {
        if (!run.cancelled) setLoading(false)
      }
    })()

    return () => {
      run.cancelled = true
    }
  }, [userId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!detail) return

    if (password && password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }

    const patch: UserPatch = {}
    if (password) patch.password = password
    if (isBlocked !== detail.isBlocked) patch.isBlocked = isBlocked
    if (role !== detail.role) patch.role = role
    if (Object.keys(patch).length === 0) {
      toast.error('Nothing to save')
      return
    }

    setSaving(true)
    try {
      const response = await apiFetch<AdminUser>(`/admin/users/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to update user')
        return
      }
      setDetail({ ...detail, ...response.data })
      setRole(response.data.role)
      setIsBlocked(response.data.isBlocked)
      setPassword('')
      toast.success('User updated')
      // Changing your own account can change what you are allowed to see.
      if (actor?.email === detail.email) await refreshAuth()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">
          {detail?.email ?? 'User'}
        </h1>
        {detail ? (
          <p className={`mt-2 ${hintClassName}`}>
            Created {new Date(detail.accountCreatedAt).toLocaleDateString()}
            {' · '}
            {USER_ROLE_LABELS[detail.role]}
            {detail.isBlocked ? ' · Blocked' : ''}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className={`flex items-center gap-2 ${hintClassName}`}>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading user…
        </div>
      ) : !detail ? (
        <p className={hintClassName}>This user could not be loaded.</p>
      ) : (
        <form
          className="space-y-8"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div>
            <label
              htmlFor="user-role"
              className="mb-1.5 block text-sm font-medium"
            >
              Role
            </label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
            >
              <SelectTrigger id="user-role" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{USER_ROLE_LABELS.user}</SelectItem>
                <SelectItem value="admin">{USER_ROLE_LABELS.admin}</SelectItem>
              </SelectContent>
            </Select>
            <p className={`mt-1.5 text-xs ${hintClassName}`}>
              Admins can open the admin area.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(event) => setIsBlocked(event.target.checked)}
              />
              Blocked
            </label>
            <p className={`mt-1.5 text-xs ${hintClassName}`}>
              Blocked accounts are signed out and cannot sign in.
            </p>
          </div>

          <div>
            <label
              htmlFor="user-password"
              className="mb-1.5 block text-sm font-medium"
            >
              New password
            </label>
            <PasswordInput
              id="user-password"
              value={password}
              onChange={setPassword}
              placeholder="Leave blank to keep the current password"
              autoComplete="new-password"
            />
            <p className={`mt-1.5 text-xs ${hintClassName}`}>
              At least {MIN_PASSWORD_LENGTH} characters. Setting one signs the
              user out everywhere.
            </p>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className={buttonClassName}>
              {saving ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
