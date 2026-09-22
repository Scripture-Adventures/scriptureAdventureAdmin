import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const checkIsAdmin = async (email: string): Promise<boolean> => {
  const em = email.trim()
  if (!em) return false

  const { data: exact } = await supabase
    .from('main_members')
    .select('role, email')
    .eq('email', em)
    .maybeSingle()

  if (exact) return exact.role?.toLowerCase() === 'admin'

  const { data: rows } = await supabase
    .from('main_members')
    .select('role, email')
    .ilike('email', em)

  const member = rows?.find(r => r.email?.toLowerCase() === em.toLowerCase()) || rows?.[0]
  return member?.role?.toLowerCase() === 'admin'
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const applySessionIfAdmin = async (nextSession: Session | null) => {
    if (!nextSession?.user?.email) {
      setSession(null)
      setUser(null)
      setLoading(false)
      return
    }

    const isAdmin = await checkIsAdmin(nextSession.user.email)
    if (!isAdmin) {
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setLoading(false)
      return
    }

    setSession(nextSession)
    setUser(nextSession.user)
    setLoading(false)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySessionIfAdmin(session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Avoid re-checking during intentional sign-out after failed admin check
      if (!session) {
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }
      applySessionIfAdmin(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) return { error }

    const userEmail = data.user?.email
    if (!userEmail) {
      await supabase.auth.signOut()
      return { error: { message: 'Unable to verify admin access.' } }
    }

    const isAdmin = await checkIsAdmin(userEmail)
    if (!isAdmin) {
      await supabase.auth.signOut()
      return { error: { message: 'Access denied. Only admin users can sign in.' } }
    }

    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
