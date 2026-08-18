/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_ACCESS_PASSWORD_COACHES: string
  readonly VITE_ACCESS_PASSWORD_TEAM: string
  readonly VITE_ACCESS_PASSWORD_ADMIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
