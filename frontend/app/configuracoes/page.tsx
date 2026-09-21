"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { Navbar } from "../components/layout/navbar"
import { Footer } from "../components/layout/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import api from "@/lib/api"

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, isLoading: authLoading } = useAuth()
  const [cpfObrigatorio, setCpfObrigatorio] = useState(true)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (user?.role !== "admin") {
      router.replace("/")
      return
    }

    api.get("/configuracoes")
      .then((res) => setCpfObrigatorio(res.data?.cpfObrigatorio !== false))
      .catch((error) => {
        toast({
          title: "Erro ao carregar configurações",
          description: error?.response?.data?.error || "Não foi possível consultar as configurações.",
          variant: "destructive",
        })
      })
      .finally(() => setCarregando(false))
  }, [authLoading, router, toast, user?.role])

  const alterarObrigatoriedadeCpf = async (obrigatorio: boolean) => {
    setSalvando(true)
    try {
      await api.patch("/configuracoes/cpf-obrigatorio", { obrigatorio })
      setCpfObrigatorio(obrigatorio)
      toast({
        title: "Configuração atualizada",
        description: obrigatorio ? "O CPF voltou a ser obrigatório." : "Agora é possível cadastrar usuários sem CPF.",
        variant: "success",
      })
    } catch (error: any) {
      toast({
        title: "Erro ao salvar configuração",
        description: error?.response?.data?.error || "Não foi possível atualizar a configuração.",
        variant: "destructive",
      })
    } finally {
      setSalvando(false)
    }
  }

  if (authLoading || user?.role !== "admin") return null

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar currentPath="/configuracoes" />
      <main className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <Image src="/beach-background.jpg" alt="Fundo de praia" fill className="object-cover" priority />
        </div>
        <div className="relative z-10 container mx-auto py-6 px-4 max-w-[1400px]">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="h-8 w-8 text-[#0948a7]" />
              <div>
                <h1 className="text-3xl font-bold text-[#0948a7]">Configurações</h1>
                <p className="text-gray-600">Defina as regras utilizadas nos cadastros do SysTAB.</p>
              </div>
            </div>

            <Card className="border border-gray-100 shadow-md">
              <CardHeader className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white rounded-t-lg">
                <CardTitle className="text-xl">Cadastros de usuários</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-800">Exigir preenchimento do CPF</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {cpfObrigatorio
                        ? "Novos cadastros e edições devem informar um CPF."
                        : "Novos cadastros e edições podem ficar sem CPF."}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cpfObrigatorio}
                    aria-label="Exigir preenchimento do CPF"
                    onClick={() => alterarObrigatoriedadeCpf(!cpfObrigatorio)}
                    disabled={carregando || salvando}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0948a7] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${cpfObrigatorio ? "bg-[#0948a7]" : "bg-gray-300"}`}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform ${cpfObrigatorio ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                <p className="mt-5 text-xs text-gray-500">
                  Essa alteração vale para todos os usuários do sistema e é restrita a administradores.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
