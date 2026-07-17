const entrada = $input.first().json;
const staticData = $getWorkflowStaticData('global');

if (!staticData.sessoes) staticData.sessoes = {};

const telefone = entrada.telefone || entrada.numero;
const texto = String(entrada.texto || '').trim();
const textoLower = texto.toLowerCase();
const numeros = texto.replace(/\D/g, '');
const aiIntencao = String(entrada.aiIntencao || '').toLowerCase();
const aiConfianca = Number(entrada.aiConfianca || 0);
const iaOk = aiIntencao && aiIntencao !== 'desconhecido' && aiConfianca >= 0.55;

let sessao = staticData.sessoes[telefone] || {
  etapa: 'IDENTIFICACAO'
};

let acao = 'RESPONDER';
let resposta = '';
let documentUrl = '';
let fileName = '';

const primeiroNome = sessao.primeiroNome || '';

const menu = `${primeiroNome ? `Olá, ${primeiroNome}! 👋` : 'Olá! 👋'}

Sou a Luciana AI, a assistente virtual da GGT/SMS.

Escolha uma opção:

1 - Informações funcionais
2 - Solicitações
3 - Outras dúvidas
4 - Licenças
5 - Falar com RH

Você também pode escrever com suas palavras, por exemplo: "quero transferência de lotação", "licença maternidade" ou "vale transporte. Faça o teste agora mesmo!. ^-^`;

const submenuSolicitacoes = `📌 Solicitações

Escolha uma opção:

1 - Transferência de lotação
2 - Solicitação de vale transporte

0 - Voltar ao menu principal`;

const submenuLicencas = `📄 Licenças

Escolha uma opção:

1 - Licença maternidade
2 - Licença paternidade
3 - Licença prêmio
4 - Requerimentos gerais

0 - Voltar ao menu principal`;

// Troque os links abaixo pelos links públicos reais dos PDFs.
// A Evolution precisa conseguir acessar esses arquivos pela internet.
const documentos = {
  transferenciaLotacao: {
    url: 'https://drive.google.com/uc?export=download&id=1ZvEBcFZBFBq85fmJUqFjUseZ04kW0VFr',
    fileName: 'requerimento-transferencia-lotacao.pdf'
  },
  valeTransporte: {
    url: 'https://drive.google.com/uc?export=download&id=1ZvEBcFZBFBq85fmJUqFjUseZ04kW0VFr',
    fileName: 'requerimento-vale-transporte.pdf'
  },
  licencaMaternidade: {
    url: 'https://drive.google.com/uc?export=download&id=1ZvEBcFZBFBq85fmJUqFjUseZ04kW0VFr',
    fileName: 'requerimento-licenca-maternidade.pdf'
  },
  licencaPaternidade: {
    url: 'https://drive.google.com/uc?export=download&id=1ZvEBcFZBFBq85fmJUqFjUseZ04kW0VFr',
    fileName: 'requerimento-licenca-paternidade.pdf'
  },
  licencaPremio: {
    url: 'https://drive.google.com/uc?export=download&id=1ZvEBcFZBFBq85fmJUqFjUseZ04kW0VFr',
    fileName: 'requerimento-licenca-premio.pdf'
  },
  requerimentosGerais: {
    url: 'https://drive.google.com/uc?export=download&id=1ZvEBcFZBFBq85fmJUqFjUseZ04kW0VFr',
    fileName: 'requerimentos-gerais.pdf'
  }
};

function prepararDocumento(doc, mensagem) {
  acao = 'ENVIAR_DOCUMENTO';
  resposta = mensagem;
  documentUrl = doc.url;
  fileName = doc.fileName;
  sessao.etapa = 'MENU';
}

function quer(intencao) {
  return iaOk && aiIntencao === intencao;
}

function contem(...palavras) {
  return palavras.some(p => textoLower.includes(p));
}

function responderFerias() {
  sessao.etapa = 'MENU';
  resposta = `🏖️ Férias

Para orientações sobre férias, programação, alteração ou acompanhamento, confirme com o RH da sua unidade/diretoria quais são os prazos e documentos exigidos.

Posso te ajudar também com:
1 - Informações funcionais
2 - Solicitações
4 - Licenças
5 - Falar com RH

Digite 0 para voltar ao menu principal.`;
}

// Segurança
if (!telefone || entrada.fromMe) {
  acao = 'IGNORAR';
  resposta = '';

// Comandos globais
} else if (['menu', 'voltar', 'início', 'inicio', '0'].includes(textoLower) || quer('menu_principal')) {
  sessao.etapa = sessao.nomeServidor ? 'MENU' : 'IDENTIFICACAO';
  resposta = sessao.nomeServidor
    ? menu
    : 'Olá! 👋 Para começar, envie sua matrícula, apenas os números conforme consta na frequência.';

// Trocar servidor/matrícula
} else if (['trocar', 'trocar matrícula', 'trocar matricula', 'nova matrícula', 'nova matricula'].includes(textoLower)) {
  sessao = { etapa: 'IDENTIFICACAO' };
  resposta = 'Certo. Envie a matrícula do servidor, apenas os números conforme consta na frequência.';

// Se ainda não identificou o servidor
} else if (!sessao.nomeServidor) {
  if (numeros.length > 0 || quer('identificacao_matricula')) {
    acao = 'CONSULTAR_SERVIDOR';
    sessao.etapa = 'AGUARDANDO_CONSULTA_SERVIDOR';
    resposta = '';
  } else {
    sessao.etapa = 'IDENTIFICACAO';
    resposta = 'Olá! 👋 Para começar, envie sua matrícula, apenas os números conforme consta na frequência.';
  }

// Atalhos inteligentes por texto livre/IA, independentemente do submenu atual
} else if (quer('transferencia_lotacao') || contem('transferência', 'transferencia', 'lotação', 'lotacao', 'mudar de unidade', 'mudar unidade')) {
  prepararDocumento(documentos.transferenciaLotacao, `📌 Transferência de lotação

Segue o requerimento em PDF para transferência de lotação.

Orientações:
1. Baixe e preencha o requerimento.
2. Informe a lotação atual, a lotação desejada e a justificativa.
3. Assine o documento.
4. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.
Digite 0 para voltar ao menu principal.`);

} else if (quer('vale_transporte') || contem('vale transporte', 'vale-transporte', 'transporte', 'ônibus', 'onibus')) {
  prepararDocumento(documentos.valeTransporte, `🚌 Solicitação de vale transporte

Segue o requerimento em PDF para solicitação de vale transporte.

Orientações:
1. Baixe e preencha o requerimento.
2. Informe endereço atualizado e linhas utilizadas.
3. Anexe comprovante de residência, se solicitado pelo RH.
4. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

} else if (quer('licenca_maternidade') || contem('licença maternidade', 'licenca maternidade', 'maternidade')) {
  prepararDocumento(documentos.licencaMaternidade, `🤱 Licença maternidade

Segue o requerimento em PDF para licença maternidade.

Orientações:
1. Baixe e preencha o requerimento.
2. Anexe a documentação comprobatória exigida pelo RH.
3. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

} else if (quer('licenca_paternidade') || contem('licença paternidade', 'licenca paternidade', 'paternidade')) {
  prepararDocumento(documentos.licencaPaternidade, `👨‍🍼 Licença paternidade

Segue o requerimento em PDF para licença paternidade.

Orientações:
1. Baixe e preencha o requerimento.
2. Anexe a documentação comprobatória exigida pelo RH.
3. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

} else if (quer('licenca_premio') || contem('licença prêmio', 'licenca premio', 'prêmio', 'premio')) {
  prepararDocumento(documentos.licencaPremio, `🏅 Licença prêmio

Segue o requerimento em PDF para licença prêmio.

Orientações:
1. Baixe e preencha o requerimento.
2. Consulte o RH sobre critérios, disponibilidade e documentação necessária.
3. Entregue ao RH responsável ou envie pelo canal indicado pela gestão.

Digite 0 para voltar ao menu principal.`);

} else if (quer('requerimentos_gerais') || contem('requerimento geral', 'requerimentos gerais', 'formulário geral', 'formulario geral')) {
  prepararDocumento(documentos.requerimentosGerais, `📑 Requerimentos gerais

Segue o PDF de requerimentos gerais.

Orientações:
1. Baixe o arquivo.
2. Imprima e preencha o requerimento conforme o tipo de solicitação.
3. Assine e anexe os documentos necessários, caso se aplique.
4. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

} else if (quer('ferias') || contem('férias', 'ferias')) {
  responderFerias();

} else if (quer('licencas')) {
  sessao.etapa = 'SUBMENU_LICENCAS';
  resposta = submenuLicencas;

} else if (quer('solicitacoes')) {
  sessao.etapa = 'SUBMENU_SOLICITACOES';
  resposta = submenuSolicitacoes;

} else if (quer('falar_com_rh') || contem('humano', 'atendente', 'falar com rh', 'servidor do rh')) {
  sessao.etapa = 'HUMANO';
  resposta = `Certo, ${primeiroNome}. Descreva brevemente o que você precisa. Sua mensagem será encaminhada a GGT/SMS.`;

// Menu principal por número
} else if (sessao.etapa === 'MENU' || sessao.etapa === 'IDENTIFICACAO') {
  if (texto === '1' || quer('info_funcionais')) {
    resposta = `Certo, ${primeiroNome}. Seguem suas informações funcionais já identificadas:

Nome: ${sessao.nomeServidor}
Matrícula: ${String(sessao.matricula || '').slice(0, 3)}***
Cargo: ${sessao.cargo || 'Não informado'}
Lotação: ${sessao.lotacao || 'Não informado'}
Vínculo: ${sessao.vinculo || 'Não informado'}
Situação: ${sessao.situacao || 'Não informado'}

Digite 0 para voltar ao menu.`;

  } else if (texto === '2') {
    sessao.etapa = 'SUBMENU_SOLICITACOES';
    resposta = submenuSolicitacoes;

  } else if (texto === '3' || quer('outras_duvidas')) {
    sessao.etapa = 'OUTRAS_DUVIDAS';
    resposta = `Tudo bem, ${primeiroNome}. Descreva sua dúvida em uma mensagem curta. Se preferir atendimento humano, digite 5.`;

  } else if (texto === '4') {
    sessao.etapa = 'SUBMENU_LICENCAS';
    resposta = submenuLicencas;

  } else if (texto === '5') {
    sessao.etapa = 'HUMANO';
    resposta = `Certo, ${primeiroNome}. Descreva brevemente o que você precisa. Sua mensagem será encaminhada ao RH.`;

  } else {
    resposta = menu;
  }

// Submenu Solicitações por número
} else if (sessao.etapa === 'SUBMENU_SOLICITACOES') {
  if (texto === '1') {
    prepararDocumento(documentos.transferenciaLotacao, `📌 Transferência de lotação

Segue o requerimento em PDF para transferência de lotação.

Orientações:
1. Baixe e preencha o requerimento.
2. Informe a lotação atual, a lotação desejada e a justificativa.
3. Assine o documento.
4. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

  } else if (texto === '2') {
    prepararDocumento(documentos.valeTransporte, `🚌 Solicitação de vale transporte

Segue o requerimento em PDF para solicitação de vale transporte.

Orientações:
1. Baixe e preencha o requerimento.
2. Informe endereço atualizado e linhas utilizadas.
3. Anexe comprovante de residência, se solicitado pelo RH.
4. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

  } else {
    resposta = submenuSolicitacoes;
  }

// Submenu Licenças por número
} else if (sessao.etapa === 'SUBMENU_LICENCAS') {
  if (texto === '1') {
    prepararDocumento(documentos.licencaMaternidade, `🤱 Licença maternidade

Segue o requerimento em PDF para licença maternidade.

Orientações:
1. Baixe e preencha o requerimento.
2. Anexe a documentação comprobatória exigida pelo RH.
3. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

  } else if (texto === '2') {
    prepararDocumento(documentos.licencaPaternidade, `👨‍🍼 Licença paternidade

Segue o requerimento em PDF para licença paternidade.

Orientações:
1. Baixe e preencha o requerimento.
2. Anexe a documentação comprobatória exigida pelo RH.
3. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

  } else if (texto === '3') {
    prepararDocumento(documentos.licencaPremio, `🏅 Licença prêmio

Segue o requerimento em PDF para licença prêmio.

Orientações:
1. Baixe e preencha o requerimento.
2. Consulte o RH sobre critérios, disponibilidade e documentação necessária.
3. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

  } else if (texto === '4') {
    prepararDocumento(documentos.requerimentosGerais, `📑 Requerimentos gerais

Segue o PDF de requerimentos gerais.

Orientações:
1. Baixe o arquivo.
2. Preencha o requerimento conforme o tipo de solicitação.
3. Assine e anexe os documentos necessários, se houver.
4. Entregue ao setor de RH da sua unidade/regional ou envie pelo canal indicado pelo seu chefe imediato.

Digite 0 para voltar ao menu principal.`);

  } else {
    resposta = submenuLicencas;
  }

// Outras dúvidas
} else if (sessao.etapa === 'OUTRAS_DUVIDAS') {
  resposta = `Entendi, ${primeiroNome}. Para evitar informação incorreta, vou registrar sua dúvida para o RH verificar. Qaundo tiver uma resposta para você, entraremos em contato.

Resumo enviado: "${texto}"

Digite 0 para voltar ao menu ou 5 para falar com o RH.`;
  sessao.etapa = 'MENU';

// Atendimento humano
} else if (sessao.etapa === 'HUMANO') {
  acao = 'AVISAR_HUMANO';
  resposta = `Mensagem registrada, ${primeiroNome}. Um atendente do RH irá verificar sua solicitação. Digite 0 para voltar ao menu.`;
} else {
  sessao.etapa = 'MENU';
  resposta = menu;
}

staticData.sessoes[telefone] = {
  ...sessao,
  atualizadoEm: new Date().toISOString()
};

return [{
  json: {
    ...entrada,
    acao,
    matricula: numeros || sessao.matricula || '',
    identificador: numeros || sessao.matricula || '',
    resposta,
    documentUrl,
    fileName,
    etapa: sessao.etapa,
    nomeServidor: sessao.nomeServidor || '',
    primeiroNome: sessao.primeiroNome || '',
    aiIntencao,
    aiConfianca
  }
}];