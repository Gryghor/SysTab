"use client"

import { useState } from "react"
import { CheckCircle2, Download, FileText, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

type ReportType = "chamados" | "usuarios" | "tablets" | "unidades"
type ChamadoStatus = "todos" | "abertos" | "fechados"

interface ReportDownloadButtonProps {
  type: ReportType
  status?: "todos" | "abertos" | "fechados" | "atrasados"
}

const statusOptions: Array<{
  value: ChamadoStatus
  title: string
  description: string
  icon: typeof FileText
  className: string
}> = [
  {
    value: "todos",
    title: "Todos os chamados",
    description: "Inclui chamados abertos e fechados.",
    icon: FileText,
    className: "from-[#0948a7] to-[#247fbd] hover:from-[#083b8a] hover:to-[#1c6d9f]",
  },
  {
    value: "abertos",
    title: "Somente abertos",
    description: "Lista apenas os chamados em atendimento.",
    icon: FolderOpen,
    className: "from-[#0b5db5] to-[#298ed3] hover:from-[#094d98] hover:to-[#207db9]",
  },
  {
    value: "fechados",
    title: "Somente fechados",
    description: "Lista apenas os chamados conclu?dos.",
    icon: CheckCircle2,
    className: "from-[#185493] to-[#277bb0] hover:from-[#124579] hover:to-[#206b99]",
  },
]

export function ReportDownloadButton({ type, status }: ReportDownloadButtonProps) {
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const downloadReport = async (selectedStatus?: ChamadoStatus) => {
    const reportStatus = type === "chamados" ? selectedStatus || "todos" : status
    setDownloading(true)

    try {
      const response = await api.get("/relatorios/" + type, {
        params: reportStatus ? { status: reportStatus } : undefined,
        responseType: "blob",
      })
      const suffix = reportStatus && reportStatus !== "todos" ? "-" + reportStatus : ""
      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }))
      const link = document.createElement("a")
      link.href = url
      link.download = "relatorio-" + type + suffix + ".pdf"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setDialogOpen(false)
    } catch {
      toast({
        title: "Erro ao gerar relat\u00f3rio",
        description: "N\u00e3o foi poss\u00edvel gerar o PDF. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  const handleClick = () => {
    if (type === "chamados") {
      setDialogOpen(true)
      return
    }
    void downloadReport()
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="rounded-full border-gray-200 hover:bg-gray-100"
        onClick={handleClick}
        disabled={downloading}
        title="Baixar relat?rio em PDF"
      >
        <Download className="h-4 w-4 mr-2" />
        {downloading ? "Gerando..." : "Relat?rio"}
      </Button>

      {type === "chamados" && (
        <Dialog open={dialogOpen} onOpenChange={(open) => !downloading && setDialogOpen(open)}>
          <DialogContent className="overflow-hidden border-blue-200/70 bg-card p-0 shadow-2xl dark:border-slate-600/80 sm:max-w-md">
            <DialogHeader className="bg-gradient-to-r from-[#0948a7] to-[#298ed3] p-6 text-white">
              <DialogTitle className="text-xl">Baixar relat?rio de chamados</DialogTitle>
              <DialogDescription className="text-white/90">
                Escolha quais chamados devem aparecer no documento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 p-6">
              {statusOptions.map((option) => {
                const Icon = option.icon
                return (
                  <Button
                    key={option.value}
                    type="button"
                    className={"report-status-option h-auto w-full justify-start rounded-xl border border-white/10 bg-gradient-to-r px-5 py-4 text-white shadow-sm transition-all hover:scale-[1.01] hover:border-sky-200/40 " + option.className}
                    onClick={() => void downloadReport(option.value)}
                    disabled={downloading}
                  >
                    <span className="mr-4 rounded-lg bg-white/20 p-2">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-left">
                      <span className="block font-semibold">{option.title}</span>
                      <span className="block text-xs font-normal text-white/85">{option.description}</span>
                    </span>
                  </Button>
                )
              })}
              {downloading && (
                <p className="pt-1 text-center text-sm text-muted-foreground">Gerando o documento...</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}