import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function syncUserWithDatabase(user: User) {
  try {
    const { data: byAuthId } = await supabase
      .from('staff_database')
      .select('*')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (byAuthId) return

    const normalizedEmail = user.email?.trim().toLowerCase() ?? null
    if (normalizedEmail) {
      const { data: byEmail } = await supabase
        .from('staff_database')
        .select('*')
        .eq('personal_email', normalizedEmail)
        .maybeSingle()

      if (byEmail) {
        if (byEmail.auth_id && byEmail.auth_id !== user.id) return
        if (byEmail.auth_id === user.id) return

        await supabase
          .from('staff_database')
          .update({ auth_id: user.id })
          .eq('personal_email', normalizedEmail)
        return
      }
    }

    const fullName = user.user_metadata?.full_name || ''
    const [firstToken = '', ...rest] = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    await supabase.from('staff_database').insert({
      auth_id: user.id,
      personal_email: normalizedEmail,
      first_name: firstToken || null,
      last_name: rest.length ? rest.join(' ') : null,
      mobile_number: null,
    })
  } catch (err) {
    console.error('syncUserWithDatabase error:', err)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
      if (s?.user) void syncUserWithDatabase(s.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) void syncUserWithDatabase(s.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return error?.message ?? null
    },
    [],
  )

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
