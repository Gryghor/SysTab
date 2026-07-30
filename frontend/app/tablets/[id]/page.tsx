"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft, Edit, Phone, Calendar, Smartphone, Building, MapPin, Plus, Eye, Printer, ArrowLeftRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import UsuariosSelect from "@/components/ui/UsuariosSelect"
import { UnidadeSelect } from "@/components/ui/UnidadeSelect"
import { Navbar } from "../../components/layout/navbar"
import { Footer } from "../../components/layout/footer"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

export default function TabletDetails() {
  const { toast } = useToast()
  const params = useParams()
  const id = params?.id?.toString() || ""

  const [tablet, setTablet] = useState<any>(null)
  const [chamados, setChamados] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])

  const [remanejarOpen, setRemanejarOpen] = useState(false)
  const [destinoUser, setDestinoUser] = useState<string | null>(null)
  const [motivoRemanejo, setMotivoRemanejo] = useState("")
  const [remanejando, setRemanejando] = useState(false)
  const [unidades, setUnidades] = useState<any[]>([])
  const [completarCadastroOpen, setCompletarCadastroOpen] = useState(false)
  const [usuarioParaCompletar, setUsuarioParaCompletar] = useState<any>(null)
  const [cpfComplemento, setCpfComplemento] = useState("")
  const [telefoneComplemento, setTelefoneComplemento] = useState("")
  const [unidadeComplemento, setUnidadeComplemento] = useState("")
  const [completandoCadastro, setCompletandoCadastro] = useState(false)

  const carregarTablet = () => {
    api.get(`/tablets/${id}`)
      .then(res => setTablet(res.data))
      .catch(() => {
        toast({
          title: "Erro",
          description: "Falha ao carregar dados do tablet.",
          variant: "destructive"
        })
      })
  }

  useEffect(() => {
    if (!id) return

    carregarTablet()

    api.get(`/chamados/tablet/${id}`)
      .then(res => setChamados(res.data))
      .catch(() => {
        toast({
          title: "Erro",
          description: "Falha ao carregar chamados relacionados.",
          variant: "destructive"
        })
      })

    api.get("/usuarios")
      .then(res => setUsuarios(Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        toast({
          title: "Erro",
          description: "Falha ao carregar lista de usuários.",
          variant: "destructive"
        })
      })
    api.get("/unidades")
      .then(res => setUnidades(Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        toast({
          title: "Erro",
          description: "Falha ao carregar unidades e regionais.",
          variant: "destructive",
        })
      })
  }, [id])

  const abrirRemanejar = () => {
    setDestinoUser(tablet?.idUser ? String(tablet.idUser) : null)
    setMotivoRemanejo("")
    setRemanejarOpen(true)
  }

  const gerarTermoResponsabilidade = async () => {
    try {
      const resposta = await api.get(`/tablets/${id}/termo-responsabilidade`, {
        responseType: "blob",
      })
      const arquivo = new Blob([resposta.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
      const url = URL.createObjectURL(arquivo)
      const link = document.createElement("a")
      link.href = url
      link.download = `TERMO_RESPONSABILIDADE_${tablet?.idTomb || id}.docx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      const mensagem = error?.response?.data?.erro || "Não foi possível gerar o termo de responsabilidade."
      toast({ title: "Erro ao gerar termo", description: mensagem, variant: "destructive" })
    }
  }

  const camposFaltantesDoUsuario = (usuario: any) => {
    const faltantes: string[] = []
    const unidade = unidades.find((item: any) => String(item.idUnidade) === String(usuario?.idUnidade || ""))
    if (!String(usuario?.cpf || "").trim()) faltantes.push("CPF")
    if (!String(usuario?.telUser || "").trim()) faltantes.push("telefone")
    if (!usuario?.idUnidade) faltantes.push("unidade")
    if (usuario?.idUnidade && (!unidade || unidade.regional == null)) faltantes.push("regional")
    return faltantes
  }

  const abrirComplementoCadastro = (usuario: any) => {
    setUsuarioParaCompletar(usuario)
    setCpfComplemento(String(usuario?.cpf || ""))
    setTelefoneComplemento(String(usuario?.telUser || ""))
    setUnidadeComplemento(usuario?.idUnidade ? String(usuario.idUnidade) : "")
    setCompletarCadastroOpen(true)
  }

  const efetivarRemanejamento = async () => {
    setRemanejando(true)
    try {
      const res = await api.post(`/tablets/${id}/remanejar`, {
        idUserDestino: destinoUser,
        motivo: motivoRemanejo.trim(),
        rowVersion: tablet.rowVersion,
      })
      toast({
        title: "Sucesso",
        description: res.data?.message || "Tablet remanejado com sucesso.",
        variant: "success",
      })
      setRemanejarOpen(false)
      carregarTablet()
      api.get("/usuarios").then(resposta => setUsuarios(Array.isArray(resposta.data) ? resposta.data : []))
    } catch (error: any) {
      if (error?.response?.data?.code === "DESTINATION_USER_INCOMPLETE") {
        const usuarioAtual = usuarios.find((item: any) => String(item.idUser) === String(destinoUser))
        abrirComplementoCadastro({ ...usuarioAtual, ...error.response.data.usuario })
        return
      }
      const errorMsg = error?.response?.data?.error || error?.message || "Não foi possível remanejar o tablet."
      toast({ title: "Erro ao remanejar tablet", description: errorMsg, variant: "destructive" })
    } finally {
      setRemanejando(false)
    }
  }

  const confirmarRemanejar = async () => {
    if (motivoRemanejo.trim().length < 5) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe um motivo com pelo menos 5 caracteres.",
        variant: "destructive",
      })
      return
    }

    if (destinoUser !== null) {
      const usuarioDestino = usuarios.find((item: any) => String(item.idUser) === String(destinoUser))
      if (!usuarioDestino) {
        toast({ title: "Usuário inválido", description: "Selecione novamente o usuário de destino.", variant: "destructive" })
        return
      }
      if (camposFaltantesDoUsuario(usuarioDestino).length > 0) {
        abrirComplementoCadastro(usuarioDestino)
        return
      }
    }

    await efetivarRemanejamento()
  }

  const salvarCadastroEContinuar = async () => {
    if (!usuarioParaCompletar) return
    const cpfNumeros = cpfComplemento.replace(/\D/g, "")
    const telefoneNumeros = telefoneComplemento.replace(/\D/g, "")
    const unidade = unidades.find((item: any) => String(item.idUnidade) === unidadeComplemento)
    if (cpfNumeros.length !== 11) {
      toast({ title: "CPF inválido", description: "Informe os 11 dígitos do CPF.", variant: "destructive" })
      return
    }
    if (telefoneNumeros.length < 10 || telefoneNumeros.length > 11) {
      toast({ title: "Telefone inválido", description: "Informe um telefone com DDD.", variant: "destructive" })
      return
    }
    if (!unidade || unidade.regional == null) {
      toast({ title: "Unidade obrigatória", description: "Selecione uma unidade vinculada a uma regional.", variant: "destructive" })
      return
    }

    setCompletandoCadastro(true)
    try {
      await api.put(`/usuarios/${usuarioParaCompletar.idUser}`, {
        nomeUser: usuarioParaCompletar.nomeUser,
        cpf: cpfNumeros,
        telUser: telefoneNumeros,
        idUnidade: Number(unidadeComplemento),
      })
      const usuarioAtualizado = {
        ...usuarioParaCompletar,
        cpf: cpfNumeros,
        telUser: telefoneNumeros,
        idUnidade: Number(unidadeComplemento),
        unidade: unidade.nomeUnidade,
      }
      setUsuarios((atuais) => atuais.map((item: any) => String(item.idUser) === String(usuarioAtualizado.idUser) ? usuarioAtualizado : item))
      setCompletarCadastroOpen(false)
      toast({ title: "Cadastro atualizado", description: "Os dados foram salvos. Efetivando o remanejamento...", variant: "success" })
      await efetivarRemanejamento()
    } catch (error: any) {
      toast({
        title: "Erro ao completar cadastro",
        description: error?.response?.data?.error || "Não foi possível atualizar os dados do usuário.",
        variant: "destructive",
      })
    } finally {
      setCompletandoCadastro(false)
    }
  }

  const renderStatus = (chamado: any) => {
    let color = chamado.status === "Fechado"
      ? "bg-green-400"
      : chamado.diasAberto >= 7
      ? "bg-amber-400"
      : "bg-sky-400"

    return (
      <div className="flex items-center">
        <div className={`h-2.5 w-2.5 rounded-full ${color} mr-2`}></div>
        <span>{chamado.status}</span>
        {chamado.status === "Aberto" && chamado.diasAberto >= 7 && (
          <span className="text-xs text-red-500 ml-2">{chamado.diasAberto} dias</span>
        )}
      </div>
    )
  }

  if (!tablet) return null

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar currentPath="/" />
      <main className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <Image src="/beach-background.jpg" alt="Fundo de praia" fill className="object-cover" priority />
        </div>
        <div className="relative z-10 container mx-auto py-6 px-4">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl w-full p-6 shadow-xl border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="outline" size="sm" className="rounded-full border-gray-200 hover:bg-gray-100">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                </Link>
                <h2 className="text-3xl font-light text-transparent bg-clip-text bg-gradient-to-r from-[#0948a7] to-[#298ed3] inline-block">
                  <span className="font-bold">Tablet #{id}</span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-full border-gray-200 hover:bg-gray-100"
                  onClick={abrirRemanejar}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Remanejar
                </Button>
                <Link href={`/tablets/${id}/editar`}>
                  <Button className="rounded-full bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white">
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Tablet
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="col-span-2">
                <CardHeader className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white rounded-t-lg">
                  <CardTitle className="text-xl flex items-center">
                    <Smartphone className="h-5 w-5 mr-2" />
                    Informações do Tablet
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Tombamento</p>
                      <p className="font-medium">{tablet.idTomb}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">IMEI</p>
                      <p className="font-medium">{tablet.imei}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Empresa</p>
                      <p className="font-medium">{tablet.nomeEmp}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Unidade</p>
                      <p className="font-medium">{tablet.nomeUnidade}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Regional</p>
                      <p className="font-medium flex items-center">
                        <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                        {tablet.numReg}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white rounded-t-lg">
                  <CardTitle className="text-xl flex items-center">
                    <Building className="h-5 w-5 mr-2" />
                    Usuário Associado
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Nome</p>
                      <p className="font-medium">{tablet.nomeUser ? tablet.nomeUser : "Usuário Não Cadastrado"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Telefone</p>
                      <p className="font-medium flex items-center">
                        <Phone className="h-4 w-4 mr-1 text-gray-400" />
                        {tablet.telUser || "Não informado"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                <h3 className="text-xl font-medium text-gray-800">Chamados Relacionados</h3>
                <Link href={`/chamados/novo?tablet=${id}`}>
                  <Button className="rounded-full bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Abrir Chamado
                  </Button>
                </Link>
                {/* Gerar termo de responsabilidade */}
                <Button
                  className="rounded-full bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white"
                  disabled={!tablet.nomeUser}
                  onClick={gerarTermoResponsabilidade}
                  title={tablet.nomeUser ? "Gerar termo de responsabilidade" : "Vincule um usuário para gerar o termo"}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Gerar Termo de Responsabilidade
                </Button>
              </div>

              <Card className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
                <div className="systab-table-scroll max-h-[300px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white sticky top-0">
                      <tr>
                        <th className="py-3 px-4 text-left">ID</th>
                        <th className="py-3 px-4 text-left">DATA ENTRADA</th>
                        <th className="py-3 px-4 text-left">DATA SAÍDA</th>
                        <th className="py-3 px-4 text-left">DESCRIÇÃO</th>
                        <th className="py-3 px-4 text-left">STATUS</th>
                        <th className="py-3 px-4 text-center">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...chamados].sort((a, b) => {
                        // Prefer sort by dataEntrada (date) if available, else by idChamado
                        if (a.dataEntrada && b.dataEntrada) {
                          return new Date(b.dataEntrada).getTime() - new Date(a.dataEntrada).getTime();
                        }
                        return (b.idChamado || 0) - (a.idChamado || 0);
                      }).map((chamado) => (
                        <tr key={chamado.idChamado} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-blue-600 font-medium">
                            <Link href={`/chamados/${chamado.idChamado}`} className="hover:underline">
                              {chamado.idChamado}
                            </Link>
                          </td>
                          <td className="py-3 px-4">{chamado.dataEntrada}</td>
                          <td className="py-3 px-4">{chamado.dataSaida || "-"}</td>
                          <td className="py-3 px-4 max-w-[200px] truncate" title={chamado.descricao}>
                            {chamado.descricao}
                          </td>
                          <td className="py-3 px-4">{renderStatus(chamado)}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center space-x-2">
                              <Link href={`/chamados/${chamado.idChamado}`}>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={remanejarOpen} onOpenChange={setRemanejarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remanejar Tablet #{tablet.idTomb}</DialogTitle>
            <DialogDescription>
              Transfere o vínculo deste tablet para outro usuário (ou remove o vínculo atual) de forma
              atômica e auditada. O dono anterior fica sem tablet; ele continua no sistema, mas não
              fica mais associado a este aparelho.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <UsuariosSelect
              usuarios={usuarios.map((u: any) => ({
                id: u.idUser,
                nome: u.nomeUser,
                tabletId: u.tablet?.idTab ?? null,
                tabletTombamento: u.tablet?.idTomb ?? null,
              }))}
              value={destinoUser}
              onValueChange={setDestinoUser}
              label="Novo usuário (destino)"
              placeholder="Selecione o usuário de destino"
              excludeTabletId={tablet.idTab}
            />

            <div className="space-y-2">
              <Label htmlFor="motivo-remanejo">Motivo obrigatório</Label>
              <Textarea
                id="motivo-remanejo"
                placeholder="Ex: usuária se aposentou, tablet remanejado para o substituto."
                value={motivoRemanejo}
                onChange={(e) => setMotivoRemanejo(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemanejarOpen(false)} disabled={remanejando}>
              Cancelar
            </Button>
            <Button
              className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white"
              onClick={confirmarRemanejar}
              disabled={remanejando || motivoRemanejo.trim().length < 5}
            >
              {remanejando ? "Remanejando..." : "Confirmar Remanejamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={completarCadastroOpen} onOpenChange={(open) => !completandoCadastro && setCompletarCadastroOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete os dados do usuário</DialogTitle>
            <DialogDescription>
              {usuarioParaCompletar?.nomeUser} possui informações obrigatórias ausentes. Preencha-as antes de efetivar o remanejamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf-complemento">CPF</Label>
              <Input id="cpf-complemento" value={cpfComplemento} onChange={(event) => setCpfComplemento(event.target.value)} maxLength={14} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone-complemento">Telefone com DDD</Label>
              <Input id="telefone-complemento" value={telefoneComplemento} onChange={(event) => setTelefoneComplemento(event.target.value)} maxLength={15} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <UnidadeSelect
                unidades={unidades.map((unidade: any) => ({
                  id: unidade.idUnidade,
                  nome: `${unidade.nomeUnidade} — Regional ${unidade.regional}`,
                }))}
                value={unidadeComplemento}
                onValueChange={setUnidadeComplemento}
                placeholder="Selecione ou busque a unidade"
                label="Unidade"
                selectId="unidade-complemento"
                required
              />
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs text-gray-500">Regional vinculada</p>
              <p className="font-medium text-[#0948a7]">
                {unidades.find((unidade: any) => String(unidade.idUnidade) === unidadeComplemento)?.regional ?? "Selecione uma unidade"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletarCadastroOpen(false)} disabled={completandoCadastro}>Cancelar</Button>
            <Button className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] text-white" onClick={salvarCadastroEContinuar} disabled={completandoCadastro}>
              {completandoCadastro ? "Salvando..." : "Salvar e remanejar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
