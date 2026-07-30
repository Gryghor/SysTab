export interface AuditLogEntry {
  acao: string
  entidade: string
  entidadeId: number | null
  detalhes: unknown
}

type Details = Record<string, any>

const ENTITY_LABELS: Record<string, { singular: string; article: string }> = {
  tablet: { singular: "tablet", article: "O" },
  usuario: { singular: "usuário", article: "O" },
  chamado: { singular: "chamado", article: "O" },
  login: { singular: "conta de acesso", article: "A" },
}

const FIELD_LABELS: Record<string, string> = {
  nome: "nome",
  nomeUser: "nome",
  cpf: "CPF",
  telUser: "telefone",
  idUnidade: "unidade",
  idTomb: "tombamento",
  imei: "IMEI",
  idEmp: "empresa",
  idUser: "usuário vinculado",
  nivel: "perfil",
  ativo: "status",
  item: "itens recebidos",
  descricao: "descrição",
  telefone: "telefone",
  resolucao: "resolução",
  dataSaida: "data de saída",
}

export function parseLogDetails(raw: unknown): Details | null {
  if (!raw) return null
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Details
  if (typeof raw !== "string") return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function formatTechnicalDetails(raw: unknown) {
  if (!raw) return null
  if (typeof raw === "string") {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "não informado"
  if (typeof value === "boolean") return value ? "ativo" : "inativo"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function quoted(value: unknown) {
  return `“${displayValue(value)}”`
}

function entityName(log: AuditLogEntry) {
  const config = ENTITY_LABELS[log.entidade] || {
    singular: log.entidade || "registro",
    article: "O",
  }
  const id = log.entidadeId == null ? "" : ` #${log.entidadeId}`
  return { ...config, identified: `${config.singular}${id}` }
}

function tabletIdentification(log: AuditLogEntry, details: Details | null) {
  const id = log.entidadeId == null ? "sem ID" : `#${log.entidadeId}`
  const tombamento = details?.idTomb ? `, tombamento ${details.idTomb}` : ""
  return `tablet ${id}${tombamento}`
}

function describeChanges(before: Details | null, after: Details | null) {
  if (!before || !after) return ""
  const changes = Object.keys(after)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => {
      const label = FIELD_LABELS[key] || key
      return `${label} de ${quoted(before[key])} para ${quoted(after[key])}`
    })
  return changes.length ? changes.join("; ") : "nenhuma diferença de valor foi identificada"
}

export function generateLogSummary(log: AuditLogEntry) {
  const details = parseLogDetails(log.detalhes)
  const entity = entityName(log)

  if (log.acao === "REMANEJAMENTO" && log.entidade === "tablet") {
    const previous = details?.donoAnteriorNome || "sem responsável anterior"
    const next = details?.donoNovoNome || "sem novo responsável"
    const reason = details?.motivo ? ` Motivo informado: ${details.motivo}.` : ""
    return `O ${tabletIdentification(log, details)} foi remanejado de ${previous} para ${next}.${reason}`
  }

  if (log.acao === "DESVINCULACAO" && log.entidade === "tablet") {
    const previous = details?.donoAnteriorNome || "responsável não informado"
    const reason = details?.motivo ? ` Motivo informado: ${details.motivo}.` : ""
    return `O ${tabletIdentification(log, details)} foi desvinculado de ${previous} e ficou sem responsável.${reason}`
  }

  if (log.acao === "CRIACAO") {
    if (log.entidade === "tablet") {
      const owner = details?.nomeUser
        ? ` e vinculado a ${details.nomeUser}`
        : " sem responsável vinculado"
      return `O ${tabletIdentification(log, details)} foi cadastrado${owner}.`
    }
    if (log.entidade === "usuario") {
      return `O usuário ${details?.nomeUser || `#${log.entidadeId ?? "sem ID"}`} foi cadastrado no sistema.`
    }
    if (log.entidade === "chamado") {
      const tablet = details?.idTab ? ` para o tablet #${details.idTab}` : ""
      const item = details?.item ? `, com os itens recebidos: ${details.item}` : ""
      return `O chamado #${log.entidadeId ?? "sem ID"} foi aberto${tablet}${item}.`
    }
    if (log.entidade === "login") {
      const profile = details?.nivel ? ` com o perfil ${details.nivel}` : ""
      return `A conta de acesso ${details?.nome || `#${log.entidadeId ?? "sem ID"}`} foi criada${profile}.`
    }
  }

  if (log.acao === "EDICAO") {
    const changes = describeChanges(details?.antes || null, details?.depois || null)
    if (changes) return `${entity.article} ${entity.identified} teve os seguintes dados alterados: ${changes}.`
    const fields = details ? Object.keys(details).map((key) => FIELD_LABELS[key] || key) : []
    return fields.length
      ? `${entity.article} ${entity.identified} foi editado. Campos informados: ${fields.join(", ")}.`
      : `${entity.article} ${entity.identified} foi editado.`
  }

  if (log.acao === "EXCLUSAO") {
    const name = details?.nomeUser || details?.nome
    const extra = name ? ` (${name})` : details?.idTomb ? `, tombamento ${details.idTomb}` : ""
    return `${entity.article} ${entity.identified}${extra} foi excluído do sistema.`
  }

  if (log.acao === "FECHAMENTO" && log.entidade === "chamado") {
    return `O chamado #${log.entidadeId ?? "sem ID"} foi marcado como fechado.`
  }

  if (log.acao === "REABERTURA" && log.entidade === "chamado") {
    return `O chamado #${log.entidadeId ?? "sem ID"} foi reaberto e voltou ao atendimento.`
  }

  if (log.acao === "ATIVACAO" && log.entidade === "login") {
    return `A conta de acesso ${details?.nome || `#${log.entidadeId ?? "sem ID"}`} foi ativada.`
  }

  if (log.acao === "DESATIVACAO" && log.entidade === "login") {
    return `A conta de acesso ${details?.nome || `#${log.entidadeId ?? "sem ID"}`} foi desativada e suas sessões foram revogadas.`
  }

  if (log.acao === "RESET_SENHA" && log.entidade === "login") {
    return `A senha da conta ${details?.nome || `#${log.entidadeId ?? "sem ID"}`} foi redefinida. Uma nova senha provisória passou a ser obrigatória.`
  }

  if (log.acao === "CONSULTA_SENHA_PROVISORIA" && log.entidade === "login") {
    return `A senha provisória da conta ${details?.nome || `#${log.entidadeId ?? "sem ID"}`} foi consultada por um administrador.`
  }

  if (log.acao === "TROCA_SENHA_PRIMEIRO_ACESSO" && log.entidade === "login") {
    return `A conta ${details?.nome || `#${log.entidadeId ?? "sem ID"}`} concluiu a troca obrigatória da senha de primeiro acesso.`
  }

  if (log.acao === "UPLOAD_TERMO" && log.entidade === "usuario") {
    return `Um termo de responsabilidade foi anexado ao usuário #${log.entidadeId ?? "sem ID"}.`
  }

  if (log.acao === "EXCLUSAO_TERMO" && log.entidade === "usuario") {
    return `O termo de responsabilidade do usuário #${log.entidadeId ?? "sem ID"} foi excluído.`
  }

  return `${entity.article} ${entity.identified} recebeu a ação ${log.acao.toLocaleLowerCase("pt-BR").replaceAll("_", " ")}.`
}
