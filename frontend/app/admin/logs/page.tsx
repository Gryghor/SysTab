"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ScrollText, Search, ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import { Navbar } from "../../components/layout/navbar"
import { Footer } from "../../components/layout/footer"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

interface LogEntry {
  idLog: number
  acao: string
  entidade: string
  entidadeId: number | null
  idLoginResponsavel: number | null
  nomeResponsavel: string | null
  detalhes: string | null
  dataHora: string
}

const ACAO_STYLES: Record<string, string> = {
  CRIACAO: "border-emerald-300 bg-emerald-50 text-emerald-700",
  EDICAO: "border-blue-300 bg-blue-50 text-blue-700",
  EXCLUSAO: "border-red-300 bg-red-50 text-red-700",
  REMANEJAMENTO: "border-purple-300 bg-purple-50 text-purple-700",
  DESVINCULACAO: "border-amber-300 bg-amber-50 text-amber-700",
  FECHAMENTO: "border-gray-300 bg-gray-100 text-gray-700",
  REABERTURA: "border-sky-300 bg-sky-50 text-sky-700",
}

const ACAO_LABELS: Record<string, string> = {
  CRIACAO: "Criação",
  EDICAO: "Edição",
  EXCLUSAO: "Exclusão",
  REMANEJAMENTO: "Remanejamento",
  DESVINCULACAO: "Desvinculação",
  FECHAMENTO: "Fechamento",
  REABERTURA: "Reabertura",
}

const ENTIDADE_LABELS: Record<string, string> = {
  tablet: "Tablet",
  usuario: "Usuário",
  chamado: "Chamado",
}

function formatDetalhes(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export default function AdminLogsPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 30

  const [entidade, setEntidade] = useState("")
  const [acao, setAcao] = useState("")
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(false)

  const [detalhesAberto, setDetalhesAberto] = useState<LogEntry | null>(null)

  const carregarLogs = useCallback(() => {
    setLoading(true)
    const params: Record<string, string | number> = { page, limit }
    if (entidade) params.entidade = entidade
    if (acao) params.acao = acao
    if (busca) params.busca = busca

    api.get("/logs", { params })
      .then((res) => {
        setLogs(res.data.logs || [])
        setTotal(res.data.total || 0)
      })
      .catch((err: any) => {
        if (err?.response?.status === 403) {
          toast({
            title: "Acesso restrito",
            description: "Apenas administradores podem ver os logs do sistema.",
            variant: "destructive",
          })
          router.replace("/")
          return
        }
        toast({
          title: "Erro ao carregar logs",
          description: err?.response?.data?.error || "Não foi possível carregar os logs.",
          variant: "destructive",
        })
      })
      .finally(() => setLoading(false))
  }, [page, entidade, acao, busca, router, toast])

  useEffect(() => {
    carregarLogs()
  }, [carregarLogs])

  const totalPages = Math.max(Math.ceil(total / limit), 1)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar currentPath="/admin/logs" />

      <main className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <Image src="/beach-background.jpg" alt="Fundo de praia" fill className="object-cover" priority />
        </div>

        <div className="relative z-10 container mx-auto py-6 px-4 max-w-7xl">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl w-full p-6 shadow-xl border border-gray-100">
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-3xl font-light text-transparent bg-clip-text bg-gradient-to-r from-[#0948a7] to-[#298ed3] inline-block">
                  <span className="font-bold flex items-center gap-2">
                    <ScrollText className="h-7 w-7 text-[#0948a7]" />
                    Logs
                  </span>{" "}
                  <span className="text-gray-400 text-xl">| Auditoria do Sistema</span>
                </h2>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-end">
                <div className="relative">
                  <Input
                    placeholder="Buscar por responsável ou detalhes..."
                    className="pl-10 pr-4 py-2 rounded-full w-72 border-gray-200"
                    value={busca}
                    onChange={(e) => { setPage(1); setBusca(e.target.value) }}
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>

                <div className="w-48">
                  <Select value={entidade || "all"} onValueChange={(v) => { setPage(1); setEntidade(v === "all" ? "" : v) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Entidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as entidades</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="usuario">Usuário</SelectItem>
                      <SelectItem value="chamado">Chamado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-48">
                  <Select value={acao || "all"} onValueChange={(v) => { setPage(1); setAcao(v === "all" ? "" : v) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as ações</SelectItem>
                      {Object.entries(ACAO_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  className="rounded-full text-gray-500 ml-auto"
                  onClick={() => { setEntidade(""); setAcao(""); setBusca(""); setPage(1) }}
                >
                  Limpar filtros
                </Button>
              </div>
            </div>

            <Card className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
              <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white sticky top-0">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium text-sm">DATA/HORA</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">AÇÃO</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">ENTIDADE</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">ID</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">RESPONSÁVEL</th>
                      <th className="py-2 px-3 text-center font-medium text-sm">DETALHES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">Carregando...</td>
                      </tr>
                    ) : logs.length > 0 ? (
                      logs.map((log) => (
                        <tr key={log.idLog} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-3 text-gray-700 text-sm whitespace-nowrap">
                            {new Date(log.dataHora).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className={ACAO_STYLES[log.acao] || "border-gray-300 bg-gray-50 text-gray-700"}>
                              {ACAO_LABELS[log.acao] || log.acao}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-gray-800 text-sm">
                            {ENTIDADE_LABELS[log.entidade] || log.entidade}
                          </td>
                          <td className="py-2 px-3 text-gray-600 text-sm">
                            {log.entidadeId ?? "-"}
                          </td>
                          <td className="py-2 px-3 text-gray-800 text-sm">
                            {log.nomeResponsavel || "-"}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-gray-600 hover:text-[#0948a7] hover:bg-blue-50"
                              title="Ver detalhes"
                              onClick={() => setDetalhesAberto(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          Nenhum log encontrado com os critérios de busca.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>{total} registro(s) encontrado(s)</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>Página {page} de {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <Dialog open={!!detalhesAberto} onOpenChange={(open) => !open && setDetalhesAberto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detalhesAberto ? `${ACAO_LABELS[detalhesAberto.acao] || detalhesAberto.acao} - ${ENTIDADE_LABELS[detalhesAberto.entidade] || detalhesAberto.entidade} #${detalhesAberto.entidadeId ?? "-"}` : ""}
            </DialogTitle>
            <DialogDescription>
              {detalhesAberto && `${detalhesAberto.nomeResponsavel || "Responsável desconhecido"} em ${new Date(detalhesAberto.dataHora).toLocaleString("pt-BR")}`}
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
            {detalhesAberto ? (formatDetalhes(detalhesAberto.detalhes) || "Sem detalhes adicionais.") : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
