"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, ChevronRight, Copy, Eye, KeyRound, Pencil, Plus, Power, PowerOff,
  RotateCcw, Search, Shield,
} from "lucide-react"
import { Navbar } from "../../components/layout/navbar"
import { Footer } from "../../components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import api from "@/lib/api"

interface ContaAcesso {
  idLogin: number
  nome: string
  nivel: "admin" | "padrao"
  ativo: boolean
  trocaSenhaObrigatoria: boolean
  senhaProvisoriaDisponivel: boolean
  criado_em: string
}

interface CredencialProvisoria {
  nome: string
  senha: string
}

const POR_PAGINA = 10
const ACAO_ICONE = "h-7 w-7 p-0 text-gray-600 hover:text-[#0948a7] hover:bg-blue-50"

export default function AccountsManager() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, isLoading: authLoading } = useAuth()
  const [contas, setContas] = useState<ContaAcesso[]>([])
  const [busca, setBusca] = useState("")
  const [perfil, setPerfil] = useState<"all" | "admin" | "padrao">("all")
  const [pagina, setPagina] = useState(1)
  const [loadingContas, setLoadingContas] = useState(true)
  const [erroContas, setErroContas] = useState<string | null>(null)
  const [nome, setNome] = useState("")
  const [nivel, setNivel] = useState<"admin" | "padrao">("padrao")
  const [loading, setLoading] = useState(false)
  const [contaEdicao, setContaEdicao] = useState<ContaAcesso | null>(null)
  const [nomeEdicao, setNomeEdicao] = useState("")
  const [nivelEdicao, setNivelEdicao] = useState<"admin" | "padrao">("padrao")
  const [contaSenha, setContaSenha] = useState<ContaAcesso | null>(null)
  const [contaStatus, setContaStatus] = useState<ContaAcesso | null>(null)
  const [credencial, setCredencial] = useState<CredencialProvisoria | null>(null)
  const [processandoAcao, setProcessandoAcao] = useState(false)

  const carregarContas = useCallback(async () => {
    setLoadingContas(true)
    setErroContas(null)
    try {
      const resposta = await api.get("/admin/contas")
      setContas(resposta.data)
    } catch (error: any) {
      const mensagem = error?.response?.data?.error || "Não foi possível consultar as contas de acesso."
      setErroContas(mensagem)
      toast({ title: "Erro ao carregar contas", description: mensagem, variant: "destructive" })
    } finally {
      setLoadingContas(false)
    }
  }, [toast])

  useEffect(() => {
    if (authLoading) return
    if (user?.role !== "admin") {
      router.replace("/")
      return
    }
    carregarContas()
  }, [authLoading, user, router, carregarContas])

  const contasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    return contas.filter((conta) =>
      (!termo || conta.nome.toLocaleLowerCase("pt-BR").includes(termo)) &&
      (perfil === "all" || conta.nivel === perfil)
    )
  }, [contas, busca, perfil])

  const totalPaginas = Math.max(Math.ceil(contasFiltradas.length / POR_PAGINA), 1)
  const paginaAtual = Math.min(pagina, totalPaginas)
  const contasDaPagina = contasFiltradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  const criarConta = async (event: FormEvent) => {
    event.preventDefault()
    if (nome.trim().length < 3) {
      toast({ title: "Nome inválido", description: "Informe pelo menos 3 caracteres.", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const resposta = await api.post("/admin/contas", { nome: nome.trim(), nivel })
      setCredencial({ nome: resposta.data.conta.nome, senha: resposta.data.senhaProvisoria })
      setNome("")
      setNivel("padrao")
      await carregarContas()
      toast({ title: "Conta criada", description: "A senha provisória foi gerada.", variant: "success" })
    } catch (error: any) {
      toast({ title: "Erro ao criar conta", description: error?.response?.data?.error || "Não foi possível criar a conta.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const abrirEdicao = (conta: ContaAcesso) => {
    setContaEdicao(conta)
    setNomeEdicao(conta.nome)
    setNivelEdicao(conta.nivel)
  }

  const salvarEdicao = async () => {
    if (!contaEdicao || nomeEdicao.trim().length < 3) {
      toast({ title: "Nome inválido", description: "Informe pelo menos 3 caracteres.", variant: "destructive" })
      return
    }
    setProcessandoAcao(true)
    try {
      const resposta = await api.put(`/admin/contas/${contaEdicao.idLogin}`, { nome: nomeEdicao.trim(), nivel: nivelEdicao })
      toast({ title: "Conta atualizada", description: resposta.data?.message, variant: "success" })
      setContaEdicao(null)
      await carregarContas()
    } catch (error: any) {
      toast({ title: "Erro ao editar conta", description: error?.response?.data?.error || "Não foi possível atualizar a conta.", variant: "destructive" })
    } finally {
      setProcessandoAcao(false)
    }
  }

  const resetarSenha = async () => {
    if (!contaSenha) return
    setProcessandoAcao(true)
    try {
      const resposta = await api.patch(`/admin/contas/${contaSenha.idLogin}/senha`)
      setCredencial({ nome: resposta.data.conta.nome, senha: resposta.data.senhaProvisoria })
      setContaSenha(null)
      await carregarContas()
      toast({ title: "Senha provisória gerada", variant: "success" })
    } catch (error: any) {
      toast({ title: "Erro ao redefinir senha", description: error?.response?.data?.error || "Não foi possível redefinir a senha.", variant: "destructive" })
    } finally {
      setProcessandoAcao(false)
    }
  }

  const mostrarSenhaProvisoria = async (conta: ContaAcesso) => {
    setProcessandoAcao(true)
    try {
      const resposta = await api.get(`/admin/contas/${conta.idLogin}/senha-provisoria`)
      setCredencial({ nome: resposta.data.conta.nome, senha: resposta.data.senhaProvisoria })
    } catch (error: any) {
      toast({ title: "Senha indisponível", description: error?.response?.data?.error || "Não foi possível consultar a senha provisória.", variant: "destructive" })
      await carregarContas()
    } finally {
      setProcessandoAcao(false)
    }
  }

  const alterarStatus = async () => {
    if (!contaStatus) return
    setProcessandoAcao(true)
    try {
      const resposta = await api.patch(`/admin/contas/${contaStatus.idLogin}/status`, { ativo: !contaStatus.ativo })
      toast({ title: contaStatus.ativo ? "Conta desativada" : "Conta ativada", description: resposta.data?.message, variant: "success" })
      setContaStatus(null)
      await carregarContas()
    } catch (error: any) {
      toast({ title: "Erro ao alterar status", description: error?.response?.data?.error || "Não foi possível alterar o status.", variant: "destructive" })
    } finally {
      setProcessandoAcao(false)
    }
  }

  const copiarCredencial = async () => {
    if (!credencial) return
    await navigator.clipboard.writeText(credencial.senha)
    toast({ title: "Senha copiada", variant: "success" })
  }

  if (authLoading || user?.role !== "admin") return null

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar currentPath="/admin/contas" />
      <main className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <Image src="/beach-background.jpg" alt="Fundo de praia" fill className="object-cover" priority />
        </div>
        <div className="relative z-10 container mx-auto py-6 px-4 max-w-[1400px]">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl w-full overflow-hidden p-6 shadow-xl border border-gray-100">
            <div className="flex flex-col space-y-2 mb-6">
              <h2 className="text-3xl font-light text-transparent bg-clip-text bg-gradient-to-r from-[#0948a7] to-[#298ed3] inline-block">
                <span className="font-bold">Contas de Acesso</span>{" "}
                <span className="text-gray-400 text-xl">| Gerenciamento</span>
              </h2>
              <p className="text-gray-600">Crie e gerencie credenciais de operadores do sistema.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
                <CardHeader className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white">
                  <CardTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5" /> Nova conta</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form className="space-y-4" onSubmit={criarConta}>
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome de acesso</Label>
                      <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} autoComplete="off" />
                      <p className="text-xs text-gray-500">Deve ser único. A senha provisória será baseada neste nome.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Nível de acesso</Label>
                      <Select value={nivel} onValueChange={(value) => setNivel(value as "admin" | "padrao")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="padrao">Padrão — operação diária</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full rounded-full bg-gradient-to-r from-[#0948a7] to-[#298ed3] hover:from-[#083b8a] hover:to-[#1c7ab8] text-white" type="submit" disabled={loading}>
                      <KeyRound className="h-4 w-4 mr-2" />{loading ? "Criando..." : "Criar conta"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="min-w-0">
                <h3 className="text-xl font-medium text-[#0948a7] mb-3">Contas cadastradas</h3>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Input placeholder="Buscar conta..." className="pl-10 pr-4 rounded-full border-gray-200 focus-visible:ring-[#298ed3]" value={busca} onChange={(e) => { setPagina(1); setBusca(e.target.value) }} />
                      <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                    <div className="w-full sm:w-48">
                      <Select value={perfil} onValueChange={(value) => { setPagina(1); setPerfil(value as typeof perfil) }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os perfis</SelectItem>
                          <SelectItem value="admin">Administradores</SelectItem>
                          <SelectItem value="padrao">Padrão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div data-systab-pagination className="flex items-center justify-between mt-3 text-sm text-gray-600">
                    <span>{contasFiltradas.length} de {contas.length} conta(s)</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-full h-8 w-8 p-0 text-gray-600 hover:text-[#0948a7]" disabled={paginaAtual <= 1 || loadingContas} onClick={() => setPagina((p) => Math.max(p - 1, 1))} title="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
                      <span>Página {paginaAtual} de {totalPaginas}</span>
                      <Button variant="outline" size="sm" className="rounded-full h-8 w-8 p-0 text-gray-600 hover:text-[#0948a7]" disabled={paginaAtual >= totalPaginas || loadingContas} onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))} title="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>

                <Card className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
                  <div className="systab-table-scroll systab-table-wide max-h-[calc(100vh-390px)] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white sticky top-0">
                        <tr>
                          <th className="py-2 px-3 text-left font-medium text-sm">NOME</th>
                          <th className="py-2 px-3 text-left font-medium text-sm">NÍVEL</th>
                          <th className="py-2 px-3 text-left font-medium text-sm">STATUS</th>
                          <th className="py-2 px-3 text-left font-medium text-sm">CRIADA EM</th>
                          <th className="py-2 px-3 text-center font-medium text-sm">AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contasDaPagina.map((conta) => {
                          const propriaConta = Number(user?.idLogin) === conta.idLogin
                          return (
                            <tr key={conta.idLogin} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3 text-gray-800 font-medium">{conta.nome}</td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${conta.nivel === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                  <Shield className="h-3.5 w-3.5" />{conta.nivel === "admin" ? "Administrador" : "Padrão"}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-col items-start gap-1">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${conta.ativo ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{conta.ativo ? "Ativa" : "Inativa"}</span>
                                  {conta.trocaSenhaObrigatoria && <span className="text-xs text-amber-700">Troca de senha pendente</span>}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-gray-600 text-sm">{conta.criado_em ? new Date(conta.criado_em).toLocaleString("pt-BR") : "—"}</td>
                              <td className="py-2 px-3">
                                <div className="flex justify-center space-x-2">
                                  {conta.trocaSenhaObrigatoria && conta.senhaProvisoriaDisponivel && (
                                    <Button variant="ghost" size="sm" className={ACAO_ICONE} disabled={processandoAcao} title="Mostrar senha do primeiro acesso" onClick={() => mostrarSenhaProvisoria(conta)}><Eye className="h-4 w-4" /></Button>
                                  )}
                                  <Button variant="ghost" size="sm" className={ACAO_ICONE} disabled={propriaConta} title={propriaConta ? "Sua própria conta não pode ser editada aqui" : "Editar conta"} onClick={() => abrirEdicao(conta)}><Pencil className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="sm" className={ACAO_ICONE} disabled={propriaConta} title={propriaConta ? "Sua própria senha não pode ser redefinida aqui" : "Gerar nova senha provisória"} onClick={() => setContaSenha(conta)}><RotateCcw className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 text-gray-600 ${conta.ativo ? "hover:text-red-600 hover:bg-red-50" : "hover:text-green-600 hover:bg-green-50"}`} title={propriaConta && conta.ativo ? "Você não pode desativar sua própria conta" : conta.ativo ? "Desativar conta" : "Ativar conta"} disabled={propriaConta && conta.ativo} onClick={() => setContaStatus(conta)}>
                                    {conta.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {loadingContas && <p className="py-8 text-center text-gray-500">Carregando contas...</p>}
                    {!loadingContas && erroContas && <div className="py-8 text-center"><p className="text-red-600">{erroContas}</p><Button variant="outline" className="mt-4 rounded-full" onClick={carregarContas}>Tentar novamente</Button></div>}
                    {!loadingContas && !erroContas && contasFiltradas.length === 0 && <p className="py-8 text-center text-gray-500">Nenhuma conta encontrada.</p>}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={!!contaEdicao} onOpenChange={(open) => !open && setContaEdicao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar conta</DialogTitle><DialogDescription>O nome será validado antes da alteração e não poderá estar em uso.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="nome-edicao">Nome de acesso</Label><Input id="nome-edicao" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} maxLength={100} /></div>
            <div className="space-y-2">
              <Label>Nível de acesso</Label>
              <Select value={nivelEdicao} onValueChange={(value) => setNivelEdicao(value as "admin" | "padrao")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="padrao">Padrão — operação diária</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setContaEdicao(null)} disabled={processandoAcao}>Cancelar</Button><Button className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white" onClick={salvarEdicao} disabled={processandoAcao}>{processandoAcao ? "Salvando..." : "Salvar alterações"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!contaSenha} onOpenChange={(open) => !open && setContaSenha(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Gerar nova senha provisória?</AlertDialogTitle><AlertDialogDescription>As sessões de {contaSenha?.nome} serão encerradas. No próximo login, a troca da senha será obrigatória.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={processandoAcao}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); resetarSenha() }} disabled={processandoAcao} className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white">{processandoAcao ? "Gerando..." : "Gerar senha"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!credencial} onOpenChange={(open) => !open && setCredencial(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Credencial provisória</DialogTitle><DialogDescription>Entregue estes dados ao usuário. A senha ficará disponível aos administradores somente até a troca obrigatória.</DialogDescription></DialogHeader>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
            <div><p className="text-xs text-gray-500">Usuário</p><p className="font-medium text-[#0948a7] break-all">{credencial?.nome}</p></div>
            <div><p className="text-xs text-gray-500">Senha provisória</p><p className="font-mono font-semibold text-[#0948a7] break-all">{credencial?.senha}</p></div>
          </div>
          <p className="text-sm text-amber-700">No primeiro acesso, o sistema exigirá a criação de uma nova senha.</p>
          <DialogFooter><Button variant="outline" onClick={copiarCredencial}><Copy className="h-4 w-4 mr-2" />Copiar senha</Button><Button className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white" onClick={() => setCredencial(null)}>Concluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!contaStatus} onOpenChange={(open) => !open && setContaStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{contaStatus?.ativo ? "Desativar conta?" : "Ativar conta?"}</AlertDialogTitle><AlertDialogDescription>{contaStatus?.ativo ? `A conta ${contaStatus?.nome} perderá o acesso imediatamente.` : `A conta ${contaStatus?.nome} poderá entrar novamente no sistema.`}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={processandoAcao}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); alterarStatus() }} disabled={processandoAcao} className={contaStatus?.ativo ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}>{processandoAcao ? "Processando..." : contaStatus?.ativo ? "Desativar" : "Ativar"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
