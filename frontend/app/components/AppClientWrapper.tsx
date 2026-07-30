"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"

function lerUsuarioArmazenado() {
    try {
        return JSON.parse(localStorage.getItem("usuario") || "null")
    } catch {
        localStorage.removeItem("usuario")
        return null
    }
}

export default function AppClientWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    useEffect(() => {
        const token = localStorage.getItem("token")
        const usuario = lerUsuarioArmazenado()

        if (!token && pathname !== "/login") {
            router.replace("/login")
            return
        }

        if (token && usuario?.trocaSenhaObrigatoria && pathname !== "/primeiro-acesso") {
            router.replace("/primeiro-acesso")
            return
        }

        if (token && !usuario?.trocaSenhaObrigatoria && pathname === "/primeiro-acesso") {
            router.replace("/")
            return
        }

        if (token && pathname === "/login") {
            router.replace(usuario?.trocaSenhaObrigatoria ? "/primeiro-acesso" : "/")
        }
    }, [pathname, router])

    useEffect(() => {
        if (!localStorage.getItem("token")) return

        let timeout: ReturnType<typeof setTimeout>
        function logout() {
            localStorage.removeItem("token")
            localStorage.removeItem("usuario")
            window.location.href = "/login"
        }
        function iniciarTimeoutInatividade() {
            clearTimeout(timeout)
            timeout = setTimeout(() => {
                logout()
                alert("Você foi desconectado por inatividade.")
            }, 15 * 60 * 1000)
        }

        window.addEventListener("mousemove", iniciarTimeoutInatividade)
        window.addEventListener("keydown", iniciarTimeoutInatividade)
        window.addEventListener("click", iniciarTimeoutInatividade)
        iniciarTimeoutInatividade()

        return () => {
            clearTimeout(timeout)
            window.removeEventListener("mousemove", iniciarTimeoutInatividade)
            window.removeEventListener("keydown", iniciarTimeoutInatividade)
            window.removeEventListener("click", iniciarTimeoutInatividade)
        }
    }, [])

    return (
        <ThemeProvider>
            {children}
            <Toaster />
        </ThemeProvider>
    )
}
