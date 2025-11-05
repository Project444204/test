import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Test Preview App',
  description: 'Simple test preview application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

