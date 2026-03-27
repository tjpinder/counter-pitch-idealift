import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Counter Pitch -- IdeaLift',
  description: 'They pitch you. Tom pitches back harder. Powered by IdeaLift.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
