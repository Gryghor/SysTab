"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { KeyRound } from "lucide-react"
import { Navbar } from "../components/layout/navbar"
import { Footer } from "../components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

export default function PrimeiroAcesso() {
  const [senha, setSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const alterarSenha = async (event: FormEvent) => {
    event.preventDefault()
    if (senha.length < 8) {
      toast({ title: "Senha inválida", description: "Informe pelo menos 8 caracteres.", variant: "destructive" })
      return
    }
    if (senha !== confirmacao) {
      toast({ title: "Senhas diferentes", description: "A confirmação deve ser igual à nova senha.", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      await api.patch("/auth/primeiro-acesso/senha", { novaSenha: senha })
      localStorage.removeItem("token")
      localStorage.removeItem("usuario")
      toast({ title: "Senha alterada", description: "Entre novamente com sua nova senha.", variant: "success" })
      router.replace("/login")
    } catch (error: any) {
      toast({ title: "Não foi possível alterar a senha", description: error?.response?.data?.error, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar currentPath="/primeiro-acesso" />
      <main className="flex-1 relative flex items-center justify-center p-4">
        <div className="absolute inset-0 z-0"><Image src="/beach-background.jpg" alt="Fundo de praia" fill className="object-cover" priority /></div>
        <Card className="relative z-10 w-full max-w-md p-8 shadow-xl border border-gray-100 bg-white/95">
          <div className="flex justify-center mb-4"><div className="rounded-full bg-blue-50 p-3 text-[#0948a7]"><KeyRound className="h-7 w-7" /></div></div>
          <h1 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-[#0948a7] to-[#298ed3]">Defina sua nova senha</h1>
          <p className="text-sm text-gray-600 text-center mt-2 mb-6">Por segurança, a senha provisória precisa ser substituída antes de acessar o sistema.</p>
          <form className="space-y-4" onSubmit={alterarSenha}>
            <div className="space-y-2"><Label htmlFor="nova-senha">Nova senha</Label><Input id="nova-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required /></div>
            <div className="space-y-2"><Label htmlFor="confirmar-senha">Confirmar nova senha</Label><Input id="confirmar-senha" type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required /></div>
            <Button type="submit" disabled={loading} className="w-full rounded-full bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white">{loading ? "Alterando..." : "Salvar nova senha"}</Button>
          </form>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
