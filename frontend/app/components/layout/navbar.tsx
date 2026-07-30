"use client"

import Link from "next/link"
import { Bell, Tablet, FileText, Building2, Users, ExternalLink, ScrollText, UserCog, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import { ThemeToggle } from "../ThemeToggle"

interface NavbarProps {
  currentPath: string
}

export function Navbar({ currentPath }: NavbarProps) {
  const [user, setUser] = useState<{ nome: string; nivel: string } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("usuario")
    if (stored) setUser(JSON.parse(stored))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("usuario")
    window.location.href = "/login"
  }

  const navItems = [
    { path: "/", icon: Tablet, label: "Tablets" },
    { path: "/chamados", icon: FileText, label: "Chamados" },
    { path: "/unidades", icon: Building2, label: "Unidades" },
    { path: "/usuarios", icon: Users, label: "Usuários" },
    ...(user?.nivel === "admin" ? [{ path: "/admin/contas", icon: UserCog, label: "Acessos" }] : []),
    ...(user?.nivel === "admin" ? [{ path: "/admin/logs", icon: ScrollText, label: "Logs" }] : []),
    { path: "/outros-sistemas", icon: ExternalLink, label: "Outros Sistemas" },
  ]

  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between bg-gradient-to-r from-[#0948a7] to-[#1c7ab8] px-3 py-3 text-white shadow-md md:px-4 xl:px-6">
      <div className="flex min-w-0 items-center gap-3 md:gap-4 2xl:gap-8">
        <Link href="/" className="shrink-0 text-xl font-bold transition-opacity hover:opacity-90 sm:text-2xl">
          SysTAB
        </Link>

        <nav className="hidden items-center gap-1 md:flex 2xl:gap-3" aria-label="Navegação principal">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              title={item.label}
              aria-label={item.label}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 font-medium transition-colors 2xl:px-3 ${
                currentPath === item.path
                  ? "bg-white/20 text-white"
                  : "text-white/90 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="hidden 2xl:inline">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-3">
        <ThemeToggle />
        {user && <span className="hidden text-sm font-medium 2xl:inline">{user.nome}</span>}
        {user && (
          <button onClick={handleLogout} className="rounded bg-sky-500 px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-sky-600 sm:px-3">
            Sair
          </button>
        )}
        <button className="relative p-1" aria-label="Notificações" title="Notificações">
          <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            3
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="systab-mobile-navigation"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <nav id="systab-mobile-navigation" className="mt-3 grid w-full grid-cols-2 gap-1 border-t border-white/20 pt-3 md:hidden" aria-label="Navegação móvel">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                currentPath === item.path
                  ? "bg-white/20 text-white"
                  : "text-white/90 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
