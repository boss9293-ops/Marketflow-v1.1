import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { IBM_Plex_Mono, Manrope } from 'next/font/google'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'
import { UI_LANG_COOKIE, normalizeUiLang } from '@/lib/uiLang'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-ui-latin',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-terminal',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MarketFlow - Investment Dashboard',
  description: 'Professional US Market Analysis Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialUiLang = normalizeUiLang(cookies().get(UI_LANG_COOKIE)?.value)

  return (
    <html lang={initialUiLang} data-lang-mode={initialUiLang}>
      <body className={`${manrope.variable} ${ibmPlexMono.variable}`}>
        <ClientLayout initialUiLang={initialUiLang}>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}
