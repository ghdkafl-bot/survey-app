import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '내원환자 만족도 조사',
  description: '내원환자용 만족도 설문 조사 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

