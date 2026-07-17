const mockDb = {
    query: jest.fn(),
};

jest.mock('../src/config/db', () => mockDb);

const tabletsController = require('../src/controllers/tabletsController');

const criarResposta = () => {
    const res = {
        statusCode: 200,
        body: null,
        status: jest.fn((statusCode) => {
            res.statusCode = statusCode;
            return res;
        }),
        json: jest.fn((body) => {
            res.body = body;
            return res;
        }),
    };

    return res;
};

const criarBancoSimulado = ({ usuarios, tablets, sincronizarVerificacoes = false }) => {
    const estado = {
        usuarios: new Map(usuarios.map((usuario) => [usuario.idUser, { ...usuario }])),
        tablets: new Map(tablets.map((tablet) => [tablet.idTab, { ...tablet }])),
    };

    let verificacoesPendentes = 0;
    let liberarVerificacoes;
    const barreiraVerificacoes = new Promise((resolve) => {
        liberarVerificacoes = resolve;
    });

    mockDb.query.mockImplementation(async (sql, params) => {
        const consulta = sql.replace(/\s+/g, ' ').trim();

        if (consulta.startsWith('SELECT nomeUser FROM usuarios WHERE idUser = ?')) {
            const usuario = estado.usuarios.get(Number(params[0]));
            return [usuario ? [{ nomeUser: usuario.nomeUser }] : []];
        }

        if (consulta.startsWith('SELECT * FROM tablets WHERE idUser = ? AND idTab != ?')) {
            const idUser = Number(params[0]);
            const idTabletIgnorado = Number(params[1]);
            const resultadoAntesDaEspera = [...estado.tablets.values()].filter(
                (tablet) => tablet.idUser === idUser && tablet.idTab !== idTabletIgnorado,
            );

            if (sincronizarVerificacoes) {
                verificacoesPendentes += 1;
                if (verificacoesPendentes === 2) liberarVerificacoes();
                await barreiraVerificacoes;
            }

            return [resultadoAntesDaEspera];
        }

        if (consulta.startsWith('UPDATE tablets SET idTomb = ?, imei = ?, idUser = ?, idEmp = ?')) {
            const [idTomb, imei, idUser, idEmp, idTab] = params;
            const tablet = estado.tablets.get(Number(idTab));

            if (!tablet) return [{ affectedRows: 0 }];

            Object.assign(tablet, {
                idTomb,
                imei,
                idUser: idUser === null ? null : Number(idUser),
                idEmp,
            });
            return [{ affectedRows: 1 }];
        }

        throw new Error(`Consulta não prevista no teste: ${consulta}`);
    });

    return estado;
};

const editarTablet = async (idTab, body) => {
    const req = { params: { id: String(idTab) }, body };
    const res = criarResposta();
    await tabletsController.editarTablet(req, res);
    return res;
};

const casos = Array.from({ length: 20 }, (_, indice) => {
    const caso = indice + 1;
    return {
        caso,
        idUser: 1000 + caso,
        idTabletOrigem: 2000 + caso * 2,
        idTabletDestino: 2001 + caso * 2,
        tombamentoOrigem: 300000 + caso,
        tombamentoDestino: 400000 + caso,
        imeiOriginal: String(100000000000000 + caso),
        imeiAlterado: String(200000000000000 + caso),
    };
});

const dadosDoCaso = ({
    caso,
    idUser,
    idTabletOrigem,
    idTabletDestino,
    tombamentoOrigem,
    tombamentoDestino,
    imeiOriginal,
    imeiAlterado,
}) => ({
    caso,
    idUser,
    idTabletOrigem,
    idTabletDestino,
    tombamentoOrigem,
    tombamentoDestino,
    imeiOriginal,
    imeiAlterado,
    usuario: { idUser, nomeUser: `Usuário de Teste ${caso}` },
    tabletOrigem: {
        idTab: idTabletOrigem,
        idTomb: tombamentoOrigem,
        imei: imeiOriginal,
        idUser,
        idEmp: 1,
    },
    tabletDestino: {
        idTab: idTabletDestino,
        idTomb: tombamentoDestino,
        imei: imeiAlterado,
        idUser: null,
        idEmp: 1,
    },
});

describe('Diagnóstico da vinculação entre usuários e tablets', () => {
    beforeEach(() => {
        mockDb.query.mockReset();
    });

    test.each(casos)(
        'limpar e salvar desvincula silenciosamente - caso $caso',
        async (entrada) => {
            const cenario = dadosDoCaso(entrada);
            const estado = criarBancoSimulado({
                usuarios: [cenario.usuario],
                tablets: [cenario.tabletOrigem],
            });

            const resposta = await editarTablet(cenario.idTabletOrigem, {
                idTomb: cenario.tombamentoOrigem,
                imei: cenario.imeiAlterado,
                idUser: null,
                idEmp: 1,
            });

            expect(resposta.statusCode).toBe(200);
            expect(estado.tablets.get(cenario.idTabletOrigem)).toMatchObject({
                imei: cenario.imeiAlterado,
                idUser: null,
            });
        },
    );

    test.each(casos)(
        'alterar somente o IMEI com usuário selecionado preserva o vínculo - caso $caso',
        async (entrada) => {
            const cenario = dadosDoCaso(entrada);
            const estado = criarBancoSimulado({
                usuarios: [cenario.usuario],
                tablets: [cenario.tabletOrigem],
            });

            const resposta = await editarTablet(cenario.idTabletOrigem, {
                idTomb: cenario.tombamentoOrigem,
                imei: cenario.imeiAlterado,
                idUser: cenario.idUser,
                idEmp: 1,
            });

            expect(resposta.statusCode).toBe(200);
            expect(estado.tablets.get(cenario.idTabletOrigem)).toMatchObject({
                imei: cenario.imeiAlterado,
                idUser: cenario.idUser,
            });
        },
    );

    test.each(casos)(
        'transferência interrompida deixa os dois tablets sem vínculo - caso $caso',
        async (entrada) => {
            const cenario = dadosDoCaso(entrada);
            const estado = criarBancoSimulado({
                usuarios: [cenario.usuario],
                tablets: [cenario.tabletOrigem, cenario.tabletDestino],
            });

            const tentativaAntesDeDesvincular = await editarTablet(cenario.idTabletDestino, {
                idTomb: cenario.tombamentoDestino,
                imei: cenario.imeiAlterado,
                idUser: cenario.idUser,
                idEmp: 1,
            });

            expect(tentativaAntesDeDesvincular.statusCode).toBe(400);

            const primeiraEtapa = await editarTablet(cenario.idTabletOrigem, {
                idTomb: cenario.tombamentoOrigem,
                imei: cenario.imeiOriginal,
                idUser: null,
                idEmp: 1,
            });

            expect(primeiraEtapa.statusCode).toBe(200);
            expect(estado.tablets.get(cenario.idTabletOrigem).idUser).toBeNull();
            expect(estado.tablets.get(cenario.idTabletDestino).idUser).toBeNull();
        },
    );

    test.each(casos)(
        'dois salvamentos movem o usuário e apagam o vínculo de origem - caso $caso',
        async (entrada) => {
            const cenario = dadosDoCaso(entrada);
            const estado = criarBancoSimulado({
                usuarios: [cenario.usuario],
                tablets: [cenario.tabletOrigem, cenario.tabletDestino],
            });

            await editarTablet(cenario.idTabletOrigem, {
                idTomb: cenario.tombamentoOrigem,
                imei: cenario.imeiOriginal,
                idUser: null,
                idEmp: 1,
            });
            await editarTablet(cenario.idTabletDestino, {
                idTomb: cenario.tombamentoDestino,
                imei: cenario.imeiAlterado,
                idUser: cenario.idUser,
                idEmp: 1,
            });

            expect(estado.tablets.get(cenario.idTabletOrigem).idUser).toBeNull();
            expect(estado.tablets.get(cenario.idTabletDestino).idUser).toBe(cenario.idUser);
        },
    );

    test.each(casos)(
        'requisições concorrentes duplicam o usuário - caso $caso',
        async (entrada) => {
            const cenario = dadosDoCaso(entrada);
            const tabletOrigemLivre = { ...cenario.tabletOrigem, idUser: null };
            const estado = criarBancoSimulado({
                usuarios: [cenario.usuario],
                tablets: [tabletOrigemLivre, cenario.tabletDestino],
                sincronizarVerificacoes: true,
            });

            const [respostaA, respostaB] = await Promise.all([
                editarTablet(cenario.idTabletOrigem, {
                    idTomb: cenario.tombamentoOrigem,
                    imei: cenario.imeiOriginal,
                    idUser: cenario.idUser,
                    idEmp: 1,
                }),
                editarTablet(cenario.idTabletDestino, {
                    idTomb: cenario.tombamentoDestino,
                    imei: cenario.imeiAlterado,
                    idUser: cenario.idUser,
                    idEmp: 1,
                }),
            ]);

            expect(respostaA.statusCode).toBe(200);
            expect(respostaB.statusCode).toBe(200);
            expect(estado.tablets.get(cenario.idTabletOrigem).idUser).toBe(cenario.idUser);
            expect(estado.tablets.get(cenario.idTabletDestino).idUser).toBe(cenario.idUser);
        },
    );
});
