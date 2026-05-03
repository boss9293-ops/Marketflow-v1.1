import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { getUserByEmail, createUser, getUserById } from '@/lib/db/userDb'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
        mode:     { label: 'Mode',     type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = credentials.email.toLowerCase().trim()
        const { password, mode } = credentials

        if (mode === 'signup') {
          const existing = await getUserByEmail(email)
          if (existing) throw new Error('EMAIL_EXISTS')
          const hash = await bcrypt.hash(password, 10)
          const id = randomUUID()
          const user = await createUser(id, email, hash)
          return { id: user.id, email: user.email, plan: user.plan }
        } else {
          const user = await getUserByEmail(email)
          if (!user) throw new Error('USER_NOT_FOUND')
          const valid = await bcrypt.compare(password, user.password_hash)
          if (!valid) throw new Error('WRONG_PASSWORD')
          return { id: user.id, email: user.email, plan: user.plan }
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id   = user.id
        token.plan = ((user as { plan?: string }).plan ?? 'FREE') as 'FREE' | 'PREMIUM'
      }
      if (trigger === 'update' && session?.plan) {
        token.plan = session.plan
      }
      if (token.id) {
        const dbUser = await getUserById(token.id as string)
        if (dbUser) token.plan = dbUser.plan
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; plan?: string }).id   = token.id as string
        ;(session.user as { id?: string; plan?: string }).plan = (token.plan as string) ?? 'FREE'
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'marketflow-fallback-secret-key-for-development-32-chars',
}
