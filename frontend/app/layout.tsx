import type React from "react"
import "./globals.css"
import "./dark-mode.css"
import "./responsive.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import AppClientWrapper from "./components/AppClientWrapper"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SysTAB",
  description: "Sistema de Gerenciamento de Tablets da Secretaria de Saúde",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("systab-theme");document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})();',
          }}
        />
      </head>
      <body className={inter.className}>
        <AppClientWrapper>{children}</AppClientWrapper>
      </body>
    </html>
  )
}
