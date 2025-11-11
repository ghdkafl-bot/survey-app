import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '퇴원환자 친절도 설문',
  description: '퇴원환자용 친절도 설문 조사 시스템',
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

