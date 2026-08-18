import { useState, type FormEvent } from 'react'
import { EyeIcon } from './EyeIcon'

interface PasswordGateProps {
  onUnlock: (password: string) => boolean
}

export function PasswordGate({ onUnlock }: PasswordGateProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const ok = onUnlock(password)
    if (!ok) {
      setError('Incorrect password')
      return
    }
    setError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
      >
        <h1 className="text-lg font-semibold text-slate-100">Schedule Maker Pro</h1>
        <p className="mt-1 text-sm text-slate-400">Enter a password to view the schedule.</p>

        <label className="mt-5 block">
          <span className="text-xs font-medium text-slate-400">Password</span>
          <div className="relative mt-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              autoFocus
              autoComplete="current-password"
              onChange={(event) => {
                setPassword(event.target.value)
                if (error) setError('')
              }}
              className="w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-3 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              title={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-200"
            >
              <EyeIcon visible={!showPassword} />
            </button>
          </div>
        </label>

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          className="mt-5 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Continue
        </button>
      </form>
    </div>
  )
}
