import type { Metadata } from 'next'
import { Antonio, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from '@/lib/context/AuthContext'

const antonio = Antonio({ subsets: ['latin'], variable: '--font-antonio' })
const inter = Inter({   subsets: ['latin'],   variable: '--font-inter',})

export const metadata: Metadata = {
  title: 'The Actors Copilot - Self Tape Copilot',
  description: 'Your AI-powered self-tape audition preparation tool. Build your Personal DNA, break down sides, and nail every audition.',
}

/**
 * Root layout component that wraps the entire application.
 * Provides Firebase authentication context and global styling.
 * @param props - Component props including children
 * @param props.children - Child components to render
 * @returns The root layout with auth provider
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${antonio.variable}`} >
        <AuthProvider>
          {children}
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  )
}
