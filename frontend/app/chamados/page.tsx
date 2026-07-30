"use client"

import { useEffect, useState, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import Image from "next/image"
import Link from "next/link"
import { Search, Plus, Eye, Filter, Clock, Calendar, Printer, FileText, FileOutput, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Navbar } from "../components/layout/navbar"
import { Footer } from "../components/layout/footer"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import api from "@/lib/api"
import { ReportDownloadButton } from "@/app/components/ReportDownloadButton"

export default function Chamados() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  // Debug: log user and loading state (must be after useAuth)
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[Chamados] user:", user, "isLoading:", isLoading);
    }
  }, [user, isLoading]);
  const [chamados, setChamados] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [showFilters, setShowFilters] = useState(false)
  const [unidadeFilter, setUnidadeFilter] = useState("")
  const [usuarioFilter, setUsuarioFilter] = useState("")
  const [dataInicialFilter, setDataInicialFilter] = useState("")
  const [dataFinalFilter, setDataFinalFilter] = useState("")
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [selectedChamadoId, setSelectedChamadoId] = useState<number | null>(null)
  const [tabletFilter, setTabletFilter] = useState("")
  const [tabletFilterOpen, setTabletFilterOpen] = useState(false)
  const [tabletSearch, setTabletSearch] = useState("")
  const tableRef = useRef<HTMLDivElement>(null)

  // Remove redirect for non-admins, only show access denied message (handled below)
  // This effect is no longer needed, as we want to show a styled message, not redirect

  useEffect(() => {
    if (!isLoading && user) {
      api.get("/chamados")
        .then(res => {
          // Normalize chamados as in backup
          const normalizados = res.data.map((chamado: any) => ({
            ...chamado,
            id: chamado.idChamado,
            usuario: chamado.nomeUser,
            abertoPor: chamado.nomeCriadorSnapshot || "Não informado",
            tabletId: chamado.idTab,
            tombamento: chamado.idTomb,
            unidade: chamado.nomeUnidade,
          }))
          setChamados(normalizados)
        })
        .catch((err) => {
          toast({
            title: "Erro ao carregar chamados",
            description: err?.response?.data?.error || "Não foi possível obter os chamados do servidor.",
            variant: "destructive",
          })
        })
    }
  }, [isLoading, user, toast])

  // Show loading spinner while loading user
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-lg text-gray-500">Carregando...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-lg text-red-500">Token inválido ou usuário não autenticado.<br/>Faça login novamente.</span>
      </div>
    );
  }

  // Use only defined unidades/usuarios/tablets (filter out empty/undefined, always use string for .trim())
  const safeChamados = Array.isArray(chamados) ? chamados : [];
  const unidades = [...new Set(safeChamados.map((c) => c.unidade).filter(u => u !== undefined && u !== null && String(u).trim() !== ""))]
  const usuarios = [...new Set(safeChamados.map((c) => c.usuario).filter(u => u !== undefined && u !== null && String(u).trim() !== ""))]
  const tombamentos = [...new Set(safeChamados.map((c) => c.tombamento).filter(t => t !== undefined && t !== null && String(t).trim() !== ""))]

  const filteredChamados = safeChamados.filter((chamado) => {
    if (statusFilter === "abertos" && chamado.status !== "Aberto") return false
    if (statusFilter === "fechados" && chamado.status !== "Fechado") return false
    if (statusFilter === "atrasados" && (chamado.status !== "Aberto" || (chamado.diasAberto ?? 0) < 7)) return false

    const unidadeMatch = unidadeFilter === "" || chamado.unidade === unidadeFilter
    const usuarioMatch = usuarioFilter === "" || chamado.usuario === usuarioFilter
    const tabletMatch = tabletFilter === "" || chamado.tombamento === tabletFilter

    // Date period filter
    let dateMatch = true
    if (dataInicialFilter) {
      const dataEntrada = new Date(chamado.dataEntrada)
      const dataInicial = new Date(dataInicialFilter)
      if (dataEntrada < dataInicial) dateMatch = false
    }
    if (dataFinalFilter) {
      const dataEntrada = new Date(chamado.dataEntrada)
      const dataFinal = new Date(dataFinalFilter)
      if (dataEntrada > dataFinal) dateMatch = false
    }

    const searchMatch =
      searchTerm === "" ||
      String(chamado.id).includes(searchTerm) ||
      String(chamado.tabletId).includes(searchTerm) ||
      String(chamado.tombamento).includes(searchTerm) ||
      chamado.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chamado.usuario?.toLowerCase().includes(searchTerm.toLowerCase())

    return unidadeMatch && usuarioMatch && tabletMatch && dateMatch && searchMatch
  })

  const clearFilters = () => {
    setUnidadeFilter("")
    setUsuarioFilter("")
    setDataInicialFilter("")
    setDataFinalFilter("")
    setTabletFilter("")
    setShowFilters(false)

    toast({
      title: "Filtros limpos",
      description: "Todos os filtros foram removidos",
      variant: "info",
    })
  }

  // Helper to format date as dd/mm/yyyy
  function formatDate(dateValue: any) {
    if (!dateValue) return "-"
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return "-"
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const handlePrintClick = (id: number) => {
    setSelectedChamadoId(id)
    setPrintDialogOpen(true)
  }

  // Add this helper function to download the OS file for a chamado
  function downloadOS(tipo: "entrega" | "devolucao") {
    if (!selectedChamadoId) return;
    // Use the api helper to get the correct backend URL
    api.get(`/chamados/gerar-os/${selectedChamadoId}/${tipo}`, { responseType: 'blob' })
      .then((res) => {
        const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `OS_${tipo.toUpperCase()}_${selectedChamadoId}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {
        toast({
          title: "Erro ao gerar O.S.",
          description: "Não foi possível gerar a Ordem de Serviço.",
          variant: "destructive",
        });
      });
  }

  const handleNewTicket = () => {
    toast({
      title: "Novo chamado",
      description: "Redirecionando para o formulário de abertura de chamado",
      variant: "info",
    })
  }

  const renderStatus = (chamado: any) => {
    const dias = chamado.diasAberto
    const atrasado = chamado.status === "Aberto" && dias && dias >= 7
    const color = chamado.status === "Fechado" ? "bg-green-400" : atrasado ? "bg-amber-400" : "bg-sky-400"

    return (
      <div className="flex items-center">
        <div className={`h-2.5 w-2.5 rounded-full ${color} mr-2`}></div>
        <span>{chamado.status}</span>
        {atrasado && <span className="text-xs text-red-500 ml-2">{dias} dias</span>}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar currentPath="/chamados" />

      {/* Main Content with Background Image */}
      <main className="flex-1 relative">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image src="/beach-background.jpg" alt="Fundo de praia" fill className="object-cover" priority />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto py-6 px-4 max-w-[1400px]">
          {/* Chamados Container */}
          <div className="bg-white/90 backdrop-blur-sm rounded-xl w-full p-6 shadow-xl border border-gray-100">
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-3xl font-light text-transparent bg-clip-text bg-gradient-to-r from-[#0948a7] to-[#298ed3] inline-block">
                  <span className="font-bold">Chamados</span>{" "}
                  <span className="text-gray-400 text-xl">| Gerenciamento</span>
                </h2>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Buscar chamado..."
                      className="pl-10 pr-4 py-2 rounded-full w-full sm:w-64 border-gray-200 focus-visible:ring-2 focus-visible:ring-[#298ed3]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className={`rounded-full border-gray-200 hover:bg-gray-100 ${showFilters ? "bg-blue-50 text-blue-600" : ""}`}
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filtros {showFilters && <span className="ml-1 text-xs">(Ativos)</span>}
                    </Button>

                    <ReportDownloadButton type="chamados" />

                    <Link href="/chamados/novo">
                      <Button
                        className="rounded-full bg-gradient-to-r from-[#0948a7] to-[#298ed3] hover:from-[#083b8a] hover:to-[#1c7ab8] text-white"
                        onClick={handleNewTicket}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Chamado
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="todos" className="w-full" onValueChange={setStatusFilter}>
                <TabsList className="bg-gray-100 p-1 rounded-full">
                  <TabsTrigger
                    value="todos"
                    className="rounded-full data-[state=active]:bg-gradient-to-r from-[#0948a7] to-[#298ed3] data-[state=active]:text-white"
                  >
                    Todos
                  </TabsTrigger>
                  <TabsTrigger
                    value="abertos"
                    className="rounded-full data-[state=active]:bg-gradient-to-r from-[#0948a7] to-[#298ed3] data-[state=active]:text-white"
                  >
                    Abertos
                  </TabsTrigger>
                  <TabsTrigger
                    value="fechados"
                    className="rounded-full data-[state=active]:bg-gradient-to-r from-[#0948a7] to-[#298ed3] data-[state=active]:text-white"
                  >
                    Fechados
                  </TabsTrigger>
                  <TabsTrigger
                    value="atrasados"
                    className="rounded-full data-[state=active]:bg-gradient-to-r from-[#0948a7] to-[#298ed3] data-[state=active]:text-white"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Atrasados (+7 dias)
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filtros expandidos */}
              {showFilters && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in fade-in duration-200">
                  <div className="mb-4 flex flex-wrap gap-4 items-center">
                    <span className="text-sm text-gray-700 font-medium">
                      Total de chamados: <span className="font-bold">{chamados.length}</span>
                    </span>
                    {filteredChamados.length !== chamados.length && (
                      <span className="text-sm text-blue-700 font-medium">
                        Filtrados: <span className="font-bold">{filteredChamados.length}</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label htmlFor="usuario-filter" className="text-sm text-gray-500 mb-1 block">
                        Usuário
                      </Label>
                      <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
                        <SelectTrigger id="usuario-filter" className="w-full">
                          <SelectValue placeholder="Selecione o usuário" />
                        </SelectTrigger>
                        <SelectContent>
                          {usuarios.map((usuario) => (
                            <SelectItem key={usuario} value={usuario}>{usuario}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="tablet-filter" className="text-sm text-gray-500 mb-1 block">
                        Tablet (Tombamento)
                      </Label>
                      <Popover open={tabletFilterOpen} onOpenChange={(open) => { setTabletFilterOpen(open); if (!open) setTabletSearch("") }}>
                        <PopoverTrigger asChild>
                          <Button
                            id="tablet-filter"
                            variant="outline"
                            role="combobox"
                            aria-expanded={tabletFilterOpen}
                            className="w-full justify-between border-gray-200 font-normal"
                          >
                            {tabletFilter || "Selecione ou busque o tablet"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="p-2">
                            <div className="relative mb-2">
                              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                              <Input
                                autoFocus
                                value={tabletSearch}
                                onChange={(event) => setTabletSearch(event.target.value)}
                                placeholder="Buscar tombamento..."
                                className="pl-9"
                              />
                            </div>
                            <div className="max-h-[260px] overflow-y-auto">
                              <button
                                type="button"
                                className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-gray-100"
                                onClick={() => { setTabletFilter(""); setTabletFilterOpen(false); setTabletSearch("") }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${tabletFilter === "" ? "opacity-100" : "opacity-0"}`} />
                                Todos os tablets
                              </button>
                              {tombamentos
                                .filter((tomb) => String(tomb).toLowerCase().includes(tabletSearch.trim().toLowerCase()))
                                .map((tomb) => (
                                  <button
                                    type="button"
                                    key={tomb}
                                    className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-gray-100"
                                    onClick={() => { setTabletFilter(tomb); setTabletFilterOpen(false); setTabletSearch("") }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${tabletFilter === tomb ? "opacity-100" : "opacity-0"}`} />
                                    {tomb}
                                  </button>
                                ))}
                              {tombamentos.filter((tomb) => String(tomb).toLowerCase().includes(tabletSearch.trim().toLowerCase())).length === 0 && (
                                <p className="py-6 text-center text-sm text-gray-500">Nenhum tombamento encontrado.</p>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="data-inicial" className="text-sm text-gray-500 mb-1 block">
                        Data Inicial
                      </Label>
                      <Input
                        id="data-inicial"
                        type="date"
                        className="border-gray-200"
                        value={dataInicialFilter}
                        onChange={(e) => setDataInicialFilter(e.target.value)}
                      />
                      <Label htmlFor="data-final" className="text-sm text-gray-500 mb-1 block mt-2">
                        Data Final
                      </Label>
                      <Input
                        id="data-final"
                        type="date"
                        className="border-gray-200"
                        value={dataFinalFilter}
                        onChange={(e) => setDataFinalFilter(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto rounded-full text-gray-500"
                      onClick={clearFilters}
                    >
                      Limpar filtros
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Modern Table */}
            <Card className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
              <div ref={tableRef} className="systab-table-scroll systab-table-wide max-h-[calc(100vh-340px)] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white sticky top-0">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium text-sm">ID</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">TABLET</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">USUÁRIO</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">ABERTO POR</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">DATA ENTRADA</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">DATA SAÍDA</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">DESCRIÇÃO</th>
                      <th className="py-2 px-3 text-left font-medium text-sm">STATUS</th>
                      <th className="py-2 px-3 text-center font-medium text-sm">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChamados.length > 0 ? (
                      [...filteredChamados].sort((a, b) => {
                        // Prefer sort by dataEntrada (date) if available, else by id
                        if (a.dataEntrada && b.dataEntrada) {
                          return new Date(b.dataEntrada).getTime() - new Date(a.dataEntrada).getTime();
                        }
                        return (b.id || 0) - (a.id || 0);
                      }).map((chamado) => (
                        <tr key={chamado.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-3 text-blue-600 font-medium">
                            <Link href={`/chamados/${chamado.id}`} className="hover:underline">
                              {chamado.id}
                            </Link>
                          </td>
                          <td className="py-2 px-3">
                            <Link href={`/tablets/${chamado.tabletId}`} className="text-blue-600 hover:underline">
                              {chamado.tombamento}
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-gray-800 text-sm">{chamado.usuario}</td>
                          <td className="py-2 px-3 text-gray-800 text-sm">{chamado.abertoPor}</td>
                          <td className="py-2 px-3 text-gray-800 text-sm">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                              {formatDate(chamado.dataEntrada)}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-gray-800 text-sm">
                            {chamado.dataSaida ? (
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                                {formatDate(chamado.dataSaida)}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-800 text-sm max-w-[200px] truncate" title={chamado.descricao}>
                            {chamado.descricao}
                          </td>
                          <td className="py-2 px-3 text-gray-800 text-sm">{renderStatus(chamado)}</td>
                          <td className="py-2 px-3">
                            <div className="flex justify-center space-x-2">
                              <Link href={`/chamados/${chamado.id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-gray-600 hover:text-[#0948a7] hover:bg-blue-50"
                                  title="Visualizar"
                                  onClick={() =>
                                    toast({
                                      title: "Visualizando chamado",
                                      description: `Detalhes do chamado #${chamado.id}`,
                                      variant: "info",
                                    })
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-600 hover:text-[#0948a7] hover:bg-blue-50"
                                title="Imprimir O.S."
                                onClick={() => handlePrintClick(chamado.id)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-gray-500">
                          Nenhum chamado encontrado com os critérios de busca.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Footer />

      {/* Dialog para impressão de O.S. */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white p-6 rounded-t-lg">
            <DialogTitle className="text-xl">Gerar Ordem de Serviço</DialogTitle>
            <DialogDescription className="text-white/90 mt-1">
              Selecione o tipo de O.S. que deseja gerar para o chamado #{selectedChamadoId}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 py-4">
              <Button
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white h-16 rounded-xl flex items-center justify-start px-6 transition-all hover:scale-[1.02]"
                onClick={() => downloadOS("entrega")}
              >
                <div className="bg-white/20 p-2 rounded-lg mr-4">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="font-medium">O.S. de Entrega</p>
                  <p className="text-xs opacity-80">Gerar documento para entrega do equipamento</p>
                </div>
              </Button>

              <Button
                className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] hover:from-[#083b8a] hover:to-[#1c7ab8] text-white h-16 rounded-xl flex items-center justify-start px-6 transition-all hover:scale-[1.02]"
                onClick={() => downloadOS("devolucao")}
              >
                <div className="bg-white/20 p-2 rounded-lg mr-4">
                  <FileOutput className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="font-medium">O.S. de Devolução</p>
                  <p className="text-xs opacity-80">Gerar documento para devolução do equipamento</p>
                </div>
              </Button>
            </div>
            <DialogFooter className="pt-4 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPrintDialogOpen(false)}
                className="rounded-full border-gray-200"
              >
                Cancelar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
