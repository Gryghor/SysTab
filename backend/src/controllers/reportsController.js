const PDFDocument = require("pdfkit");
const db = require("../config/db");

const COLORS = {
    blue: "#0b4db8",
    blueDark: "#08459f",
    cyan: "#2b91d0",
    ink: "#253247",
    muted: "#697990",
    line: "#dce5ef",
    soft: "#f4f7fa",
    softBlue: "#e9f4fc",
    green: "#168c52",
    purple: "#8a45e6",
    orange: "#e25516",
    white: "#ffffff",
};

const MARGIN = 40;
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const FOOTER_Y = PAGE_HEIGHT - 38;

const safeText = (value, fallback = "N\u00e3o informado") => (
    value === null || value === undefined || value === "" ? fallback : String(value)
);

const formatDate = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return safeText(value, "-");
    return parsed.toLocaleDateString("pt-BR");
};

const generatedAt = () => new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
});

const monthKey = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "0000-00";
    return String(parsed.getFullYear()) + "-" + String(parsed.getMonth() + 1).padStart(2, "0");
};

const monthLabel = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Per\u00edodo n\u00e3o informado";
    const months = [
        "Janeiro", "Fevereiro", "Mar\u00e7o", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    return months[parsed.getMonth()] + " " + parsed.getFullYear();
};

function drawBrandHeader(doc, reportLabel, generatedLabel, documentSubtitle = "Relat\u00f3rio de chamados") {
    const y = 35;
    const height = 50;
    const leftWidth = CONTENT_WIDTH * 0.55;

    doc.fillColor(COLORS.blue).rect(MARGIN, y, leftWidth, height).fill();
    doc.fillColor(COLORS.cyan).rect(MARGIN + leftWidth, y, CONTENT_WIDTH - leftWidth, height).fill();

    doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(20).text("SysTAB", MARGIN + 16, y + 11, {
        width: 220,
        lineBreak: false,
    });
    doc.font("Helvetica").fontSize(8.5).text(documentSubtitle, MARGIN + 16, y + 33, {
        width: 220,
        lineBreak: false,
    });

    doc.font("Helvetica-Bold").fontSize(12).text(reportLabel, MARGIN + leftWidth + 15, y + 13, {
        width: CONTENT_WIDTH - leftWidth - 30,
        align: "right",
        lineBreak: false,
    });
    doc.font("Helvetica").fontSize(7.5).text("Gerado em " + generatedLabel, MARGIN + leftWidth + 15, y + 32, {
        width: CONTENT_WIDTH - leftWidth - 30,
        align: "right",
        lineBreak: false,
    });
}

function drawFooter(doc, reportLabel) {
    const range = doc.bufferedPageRange();

    for (let index = 0; index < range.count; index += 1) {
        doc.switchToPage(range.start + index);
        doc.fillColor(COLORS.muted).font("Helvetica").fontSize(6.5);
        doc.text("SysTAB - " + reportLabel, MARGIN, FOOTER_Y, {
            width: 280,
            lineBreak: false,
        });
        doc.text("P\u00e1gina " + (index + 1) + " de " + range.count, PAGE_WIDTH - MARGIN - 150, FOOTER_Y, {
            width: 150,
            align: "right",
            lineBreak: false,
        });
    }
}

function countBy(rows, keySelector, labelSelector) {
    const map = new Map();

    rows.forEach((row) => {
        const key = keySelector(row);
        const label = labelSelector(row);
        const current = map.get(key) || { key, label, count: 0 };
        current.count += 1;
        map.set(key, current);
    });

    return Array.from(map.values());
}

function regionalValue(row) {
    return safeText(row.regional, "Sem regional vinculada");
}

function regionalTitle(value) {
    const normalized = safeText(value, "Sem regional vinculada");
    return /^\d+$/.test(normalized) ? "Regional " + normalized : "Regional " + normalized;
}

function regionalSort(left, right) {
    const leftNumber = Number(left.key);
    const rightNumber = Number(right.key);
    const leftNumeric = Number.isFinite(leftNumber);
    const rightNumeric = Number.isFinite(rightNumber);

    if (leftNumeric && rightNumeric) return leftNumber - rightNumber;
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return left.label.localeCompare(right.label, "pt-BR");
}

function drawSummaryCard(doc, x, y, width, item) {
    doc.fillColor(COLORS.soft).roundedRect(x, y, width, 39, 7).fill();
    doc.fillColor(item.color).font("Helvetica-Bold").fontSize(14).text(String(item.value), x, y + 8, {
        width,
        align: "center",
        lineBreak: false,
    });
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(6.8).text(item.label, x, y + 25, {
        width,
        align: "center",
        lineBreak: false,
    });
}

function drawBreakdownPanel(doc, x, y, width, height, title, items) {
    doc.fillColor(COLORS.soft).roundedRect(x, y, width, height, 8).fill();
    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(7.5).text(title, x + 11, y + 10, {
        width: width - 22,
        lineBreak: false,
    });

    const columns = 3;
    const gap = 6;
    const innerWidth = width - 22;
    const itemWidth = (innerWidth - (gap * (columns - 1))) / columns;
    const itemHeight = 18;
    const startY = y + 27;

    items.forEach((item, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const itemX = x + 11 + column * (itemWidth + gap);
        const itemY = startY + row * (itemHeight + 4);

        if (itemY + itemHeight > y + height - 8) return;

        doc.fillColor(COLORS.white).roundedRect(itemX, itemY, itemWidth, itemHeight, 5).fill();
        doc.fillColor(COLORS.blue).font("Helvetica-Bold").fontSize(6.5).text(String(item.count), itemX + 6, itemY + 6, {
            width: 25,
            lineBreak: false,
        });
        doc.fillColor(COLORS.ink).font("Helvetica").fontSize(5.8).text(item.label, itemX + 32, itemY + 6, {
            width: itemWidth - 38,
            height: 8,
            ellipsis: true,
            lineBreak: false,
        });
    });
}

function drawSummaryPage(doc, rows, reportLabel, generatedLabel) {
    doc.addPage();
    drawBrandHeader(doc, reportLabel, generatedLabel);

    const regionalCounts = countBy(rows, regionalValue, (row) => regionalValue(row)).sort(regionalSort);
    const periodCounts = countBy(rows, (row) => monthKey(row.dataEntrada), (row) => monthLabel(row.dataEntrada))
        .sort((left, right) => right.key.localeCompare(left.key));

    doc.fillColor(COLORS.blueDark).font("Helvetica-Bold").fontSize(11).text("Resumo do documento", MARGIN + 14, 113);
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(6.8).text("Quantitativo dos chamados presentes neste PDF", MARGIN + 14, 129);

    const summaries = [
        { label: "Total", value: rows.length, color: COLORS.blue },
        { label: "Abertos", value: rows.filter((row) => row.status === "Aberto").length, color: "#0874b8" },
        { label: "Fechados", value: rows.filter((row) => row.status === "Fechado").length, color: COLORS.green },
        { label: "Regionais", value: regionalCounts.length, color: COLORS.purple },
        { label: "Per\u00edodos", value: periodCounts.length, color: COLORS.orange },
    ];

    const gap = 8;
    const cardWidth = (CONTENT_WIDTH - 28 - (gap * 4)) / 5;
    summaries.forEach((item, index) => {
        drawSummaryCard(doc, MARGIN + 14 + index * (cardWidth + gap), 141, cardWidth, item);
    });

    const panelGap = 10;
    const panelX = MARGIN + 14;
    const panelWidth = (CONTENT_WIDTH - 28 - panelGap) / 2;
    const maxRows = Math.max(Math.ceil(regionalCounts.length / 3), Math.ceil(periodCounts.length / 3), 3);
    const panelHeight = Math.min(142, 37 + (maxRows * 22));

    drawBreakdownPanel(
        doc,
        panelX,
        190,
        panelWidth,
        panelHeight,
        "Chamados por regional",
        regionalCounts.map((item) => ({ count: item.count, label: item.label }))
    );
    drawBreakdownPanel(
        doc,
        panelX + panelWidth + panelGap,
        190,
        panelWidth,
        panelHeight,
        "Chamados por m\u00eas/ano",
        periodCounts.map((item) => ({ count: item.count, label: item.label }))
    );
}

const TABLE_COLUMNS = [
    { key: "idChamado", label: "ID", width: 38, format: (value) => "#" + value },
    { key: "idTomb", label: "TABLET", width: 70 },
    { key: "usuario", label: "USU\u00c1RIO", width: 130 },
    { key: "unidade", label: "UNIDADE", width: 155 },
    { key: "dataEntrada", label: "ENTRADA", width: 60, format: formatDate },
    { key: "dataSaida", label: "SA\u00cdDA", width: 55, format: formatDate },
    { key: "status", label: "STATUS", width: 62 },
    { key: "descricao", label: "DESCRI\u00c7\u00c3O", width: 192 },
];

function drawRegionalBand(doc, y, title, count, continuation, entityLabel = "chamado") {
    doc.fillColor(COLORS.softBlue).roundedRect(MARGIN, y, CONTENT_WIDTH, 26, 6).fill();
    doc.fillColor(COLORS.blueDark).font("Helvetica-Bold").fontSize(10).text(
        title + (continuation ? " (continua\u00e7\u00e3o)" : ""),
        MARGIN + 10,
        y + 8,
        { width: 480, lineBreak: false }
    );
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.5).text(count + " " + entityLabel + (count === 1 ? "" : "s"), PAGE_WIDTH - MARGIN - 160, y + 9, {
        width: 150,
        align: "right",
        lineBreak: false,
    });
}

function drawMonthBand(doc, y, title, count, continuation) {
    doc.fillColor(COLORS.soft).roundedRect(MARGIN + 10, y, CONTENT_WIDTH - 20, 25, 5).fill();
    doc.fillColor(COLORS.cyan).rect(MARGIN + 10, y, 6, 25).fill();
    doc.fillColor(COLORS.blueDark).font("Helvetica-Bold").fontSize(8.5).text(
        title + (continuation ? " (continua\u00e7\u00e3o)" : ""),
        MARGIN + 25,
        y + 8,
        { width: 420, lineBreak: false }
    );
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7).text(count + " chamado" + (count === 1 ? "" : "s"), PAGE_WIDTH - MARGIN - 170, y + 9, {
        width: 150,
        align: "right",
        lineBreak: false,
    });
}

function drawTableHeader(doc, y) {
    doc.fillColor(COLORS.blue).rect(MARGIN, y, CONTENT_WIDTH, 21).fill();

    let x = MARGIN;
    doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(6.3);
    TABLE_COLUMNS.forEach((column) => {
        doc.text(column.label, x + 4, y + 7, {
            width: column.width - 8,
            lineBreak: false,
        });
        x += column.width;
    });

    return y + 21;
}

function drawTableRow(doc, row, y, rowIndex) {
    const values = TABLE_COLUMNS.map((column) => safeText(
        column.format ? column.format(row[column.key]) : row[column.key],
        column.key === "dataSaida" ? "-" : ""
    ));

    const textHeights = values.map((value, index) => doc.heightOfString(value, {
        width: TABLE_COLUMNS[index].width - 8,
        lineGap: 0.7,
    }));
    const rowHeight = Math.max(28, Math.min(43, Math.max(...textHeights) + 10));

    if (rowIndex % 2 === 0) {
        doc.fillColor(COLORS.soft).rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill();
    }

    let x = MARGIN;
    values.forEach((value, index) => {
        const column = TABLE_COLUMNS[index];
        const isStatus = column.key === "status";
        doc.fillColor(isStatus ? "#0874b8" : COLORS.ink)
            .font(column.key === "idChamado" ? "Helvetica-Bold" : "Helvetica")
            .fontSize(6.2)
            .text(value, x + 4, y + 8, {
                width: column.width - 8,
                height: rowHeight - 11,
                ellipsis: true,
                lineGap: 0.7,
            });
        x += column.width;
    });

    doc.moveTo(MARGIN, y + rowHeight).lineTo(PAGE_WIDTH - MARGIN, y + rowHeight).strokeColor(COLORS.line).lineWidth(0.5).stroke();
    return rowHeight;
}

function buildRegionalGroups(rows) {
    const regions = new Map();

    rows.forEach((row) => {
        const key = regionalValue(row);
        if (!regions.has(key)) regions.set(key, { key, title: regionalTitle(key), rows: [], months: new Map() });
        const region = regions.get(key);
        region.rows.push(row);

        const keyMonth = monthKey(row.dataEntrada);
        if (!region.months.has(keyMonth)) {
            region.months.set(keyMonth, { key: keyMonth, title: monthLabel(row.dataEntrada), rows: [] });
        }
        region.months.get(keyMonth).rows.push(row);
    });

    return Array.from(regions.values())
        .sort(regionalSort)
        .map((region) => ({
            ...region,
            months: Array.from(region.months.values()).sort((left, right) => right.key.localeCompare(left.key)),
        }));
}

function drawChamadosPages(doc, rows, reportLabel, generatedLabel) {
    const groups = buildRegionalGroups(rows);
    const bottom = FOOTER_Y - 12;
    let y = 0;
    let currentRegion = null;

    const startPage = (region, continuation) => {
        doc.addPage();
        drawBrandHeader(doc, reportLabel, generatedLabel);
        drawRegionalBand(doc, 102, region.title, region.rows.length, continuation);
        y = 138;
        currentRegion = region;
    };

    if (groups.length === 0) {
        doc.addPage();
        drawBrandHeader(doc, reportLabel, generatedLabel);
        doc.fillColor(COLORS.softBlue).roundedRect(MARGIN, 105, CONTENT_WIDTH, 55, 7).fill();
        doc.fillColor(COLORS.blueDark).font("Helvetica-Bold").fontSize(11).text("Nenhum chamado encontrado", MARGIN, 125, {
            width: CONTENT_WIDTH,
            align: "center",
        });
        return;
    }

    groups.forEach((region) => {
        startPage(region, false);

        region.months.forEach((month) => {
            if (y + 100 > bottom) startPage(region, true);
            drawMonthBand(doc, y, month.title, month.rows.length, false);
            y = drawTableHeader(doc, y + 31);

            month.rows.forEach((row, rowIndex) => {
                const estimatedHeight = 43;
                if (y + estimatedHeight > bottom) {
                    startPage(currentRegion, true);
                    drawMonthBand(doc, y, month.title, month.rows.length, true);
                    y = drawTableHeader(doc, y + 31);
                }
                y += drawTableRow(doc, row, y, rowIndex);
            });

            y += 7;
        });
    });
}

function createChamadosPdf(res, rows, status) {
    const labels = {
        todos: "Todos os chamados",
        abertos: "Chamados abertos",
        fechados: "Chamados fechados",
        atrasados: "Chamados atrasados",
    };
    const reportLabel = labels[status] || labels.todos;
    const generatedLabel = generatedAt();
    const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 0,
        bufferPages: true,
        autoFirstPage: false,
        info: { Title: "SysTAB - " + reportLabel, Author: "SysTAB" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"relatorio-chamados-" + status + ".pdf\"");
    doc.pipe(res);

    drawSummaryPage(doc, rows, reportLabel, generatedLabel);
    drawChamadosPages(doc, rows, reportLabel, generatedLabel);
    drawFooter(doc, reportLabel);
    doc.end();
}

function sortByLabel(items) {
    return [...items].sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function limitedPanelItems(items, limit = 15) {
    if (items.length <= limit) return items;
    const visible = items.slice(0, limit - 1);
    const hidden = items.slice(limit - 1);
    return [...visible, {
        count: hidden.reduce((total, item) => total + item.count, 0),
        label: `+ ${hidden.length} demais`,
    }];
}

function genericConfig(type) {
    const configs = {
        usuarios: {
            title: "Relat\u00f3rio de usu\u00e1rios",
            subtitle: "Relat\u00f3rio de usu\u00e1rios",
            filename: "relatorio-usuarios.pdf",
            entityLabel: "usu\u00e1rio",
            sql: "SELECT u.idUser, u.nomeUser, u.cpf, u.telUser, un.nomeUnidade AS unidade, COALESCE(r.numReg, 'Sem regional vinculada') AS regional, t.idTomb FROM usuarios u LEFT JOIN unidades un ON u.idUnidade = un.idUnidade LEFT JOIN regionais r ON un.idReg = r.idReg LEFT JOIN tablets t ON t.idUser = u.idUser ORDER BY r.numReg, un.nomeUnidade, u.nomeUser",
            columns: [
                { label: "ID", key: "idUser", width: 44 },
                { label: "USU\u00c1RIO", key: "nomeUser", width: 180 },
                { label: "CPF", key: "cpf", width: 95 },
                { label: "TELEFONE", key: "telUser", width: 95 },
                { label: "UNIDADE", key: "unidade", width: 175 },
                { label: "REGIONAL", key: "regional", width: 76 },
                { label: "TABLET", key: "idTomb", width: 82 },
            ],
            summaries: (rows, regionalCounts) => [
                { label: "Total", value: rows.length, color: COLORS.blue },
                { label: "Com tablet", value: rows.filter((row) => row.idTomb !== null && row.idTomb !== undefined).length, color: "#0874b8" },
                { label: "Sem tablet", value: rows.filter((row) => row.idTomb === null || row.idTomb === undefined).length, color: COLORS.orange },
                { label: "Unidades", value: new Set(rows.map((row) => safeText(row.unidade, "Sem unidade vinculada"))).size, color: COLORS.green },
                { label: "Regionais", value: regionalCounts.length, color: COLORS.purple },
            ],
            panels: (rows, regionalCounts) => ([
                { title: "Usu\u00e1rios por regional", items: regionalCounts },
                { title: "Usu\u00e1rios por unidade", items: sortByLabel(countBy(rows, (row) => safeText(row.unidade, "Sem unidade vinculada"), (row) => safeText(row.unidade, "Sem unidade vinculada"))) },
            ]),
        },
        tablets: {
            title: "Relat\u00f3rio de tablets",
            subtitle: "Relat\u00f3rio de tablets",
            filename: "relatorio-tablets.pdf",
            entityLabel: "tablet",
            sql: "SELECT t.idTab, t.idTomb, t.imei, u.nomeUser AS usuario, un.nomeUnidade AS unidade, COALESCE(r.numReg, 'Sem regional vinculada') AS regional, e.nomeEmp AS empresa FROM tablets t LEFT JOIN usuarios u ON t.idUser = u.idUser LEFT JOIN unidades un ON u.idUnidade = un.idUnidade LEFT JOIN regionais r ON un.idReg = r.idReg LEFT JOIN empresas e ON t.idEmp = e.idEmp ORDER BY r.numReg, un.nomeUnidade, t.idTomb",
            columns: [
                { label: "ID", key: "idTab", width: 42 },
                { label: "TOMBAMENTO", key: "idTomb", width: 84 },
                { label: "IMEI", key: "imei", width: 126 },
                { label: "USU\u00c1RIO", key: "usuario", width: 145 },
                { label: "UNIDADE", key: "unidade", width: 155 },
                { label: "REGIONAL", key: "regional", width: 72 },
                { label: "EMPRESA", key: "empresa", width: 96 },
            ],
            summaries: (rows, regionalCounts) => [
                { label: "Total", value: rows.length, color: COLORS.blue },
                { label: "Vinculados", value: rows.filter((row) => row.usuario !== null && row.usuario !== undefined).length, color: "#0874b8" },
                { label: "Sem usu\u00e1rio", value: rows.filter((row) => row.usuario === null || row.usuario === undefined).length, color: COLORS.orange },
                { label: "Empresas", value: new Set(rows.map((row) => safeText(row.empresa, "N\u00e3o informada"))).size, color: COLORS.green },
                { label: "Regionais", value: regionalCounts.length, color: COLORS.purple },
            ],
            panels: (rows, regionalCounts) => ([
                { title: "Tablets por regional", items: regionalCounts },
                { title: "Tablets por empresa", items: sortByLabel(countBy(rows, (row) => safeText(row.empresa, "Empresa n\u00e3o informada"), (row) => safeText(row.empresa, "Empresa n\u00e3o informada"))) },
            ]),
        },
        unidades: {
            title: "Relat\u00f3rio de unidades",
            subtitle: "Relat\u00f3rio de unidades",
            filename: "relatorio-unidades.pdf",
            entityLabel: "unidade",
            sql: "SELECT un.idUnidade, un.nomeUnidade, COALESCE(r.numReg, 'Sem regional vinculada') AS regional, COUNT(DISTINCT u.idUser) AS totalUsuarios, COUNT(DISTINCT t.idTab) AS totalTablets FROM unidades un LEFT JOIN regionais r ON un.idReg = r.idReg LEFT JOIN usuarios u ON u.idUnidade = un.idUnidade LEFT JOIN tablets t ON t.idUser = u.idUser GROUP BY un.idUnidade, un.nomeUnidade, r.numReg ORDER BY r.numReg, un.nomeUnidade",
            columns: [
                { label: "ID", key: "idUnidade", width: 58 },
                { label: "UNIDADE", key: "nomeUnidade", width: 350 },
                { label: "REGIONAL", key: "regional", width: 130 },
                { label: "USU\u00c1RIOS", key: "totalUsuarios", width: 105 },
                { label: "TABLETS", key: "totalTablets", width: 105 },
            ],
            summaries: (rows, regionalCounts) => [
                { label: "Total", value: rows.length, color: COLORS.blue },
                { label: "Com tablets", value: rows.filter((row) => Number(row.totalTablets) > 0).length, color: "#0874b8" },
                { label: "Sem tablets", value: rows.filter((row) => Number(row.totalTablets) === 0).length, color: COLORS.orange },
                { label: "Tablets", value: rows.reduce((total, row) => total + Number(row.totalTablets || 0), 0), color: COLORS.green },
                { label: "Regionais", value: regionalCounts.length, color: COLORS.purple },
            ],
            panels: (rows, regionalCounts) => ([
                { title: "Unidades por regional", items: regionalCounts },
                { title: "Tablets por regional", items: regionalCounts.map((item) => ({
                    label: item.label,
                    count: rows.filter((row) => regionalValue(row) === item.key).reduce((total, row) => total + Number(row.totalTablets || 0), 0),
                })) },
            ]),
        },
    };
    return configs[type];
}

function genericGroups(rows) {
    const groups = new Map();
    rows.forEach((row) => {
        const key = regionalValue(row);
        if (!groups.has(key)) groups.set(key, { key, title: regionalTitle(key), rows: [] });
        groups.get(key).rows.push(row);
    });
    return Array.from(groups.values()).sort(regionalSort);
}

function drawGenericSummaryPage(doc, rows, config, reportLabel, generatedLabel) {
    doc.addPage();
    drawBrandHeader(doc, reportLabel, generatedLabel, config.subtitle);
    const regionalCounts = countBy(rows, regionalValue, (row) => regionalValue(row)).sort(regionalSort);
    const summaries = config.summaries(rows, regionalCounts);
    const panels = config.panels(rows, regionalCounts);

    doc.fillColor(COLORS.blueDark).font("Helvetica-Bold").fontSize(11).text("Resumo do documento", MARGIN + 14, 113);
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(6.8).text(`Quantitativo de ${config.entityLabel}s presentes neste PDF`, MARGIN + 14, 129);

    const gap = 8;
    const cardWidth = (CONTENT_WIDTH - 28 - (gap * 4)) / 5;
    summaries.forEach((item, index) => drawSummaryCard(doc, MARGIN + 14 + index * (cardWidth + gap), 141, cardWidth, item));

    const panelGap = 10;
    const panelX = MARGIN + 14;
    const panelWidth = (CONTENT_WIDTH - 28 - panelGap) / 2;
    const firstPanel = limitedPanelItems(panels[0].items);
    const secondPanel = limitedPanelItems(panels[1].items);
    const maxRows = Math.max(Math.ceil(firstPanel.length / 3), Math.ceil(secondPanel.length / 3), 3);
    const panelHeight = Math.min(142, 37 + (maxRows * 22));
    drawBreakdownPanel(doc, panelX, 190, panelWidth, panelHeight, panels[0].title, firstPanel);
    drawBreakdownPanel(doc, panelX + panelWidth + panelGap, 190, panelWidth, panelHeight, panels[1].title, secondPanel);
}

function drawGenericTableHeader(doc, y, columns) {
    doc.fillColor(COLORS.blue).rect(MARGIN, y, CONTENT_WIDTH, 21).fill();
    let x = MARGIN;
    doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(6.3);
    columns.forEach((column) => {
        doc.text(column.label, x + 4, y + 7, { width: column.width - 8, lineBreak: false });
        x += column.width;
    });
    return y + 21;
}

function drawGenericTableRow(doc, row, y, rowIndex, columns) {
    const values = columns.map((column) => safeText(column.format ? column.format(row[column.key]) : row[column.key], "-"));
    const textHeights = values.map((value, index) => doc.heightOfString(value, { width: columns[index].width - 8, lineGap: 0.7 }));
    const rowHeight = Math.max(28, Math.min(43, Math.max(...textHeights) + 10));
    if (rowIndex % 2 === 0) doc.fillColor(COLORS.soft).rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill();
    let x = MARGIN;
    values.forEach((value, index) => {
        const column = columns[index];
        doc.fillColor(COLORS.ink).font(column.key === "idUser" || column.key === "idTab" || column.key === "idUnidade" ? "Helvetica-Bold" : "Helvetica").fontSize(6.2)
            .text(value, x + 4, y + 8, { width: column.width - 8, height: rowHeight - 11, ellipsis: true, lineGap: 0.7 });
        x += column.width;
    });
    doc.moveTo(MARGIN, y + rowHeight).lineTo(PAGE_WIDTH - MARGIN, y + rowHeight).strokeColor(COLORS.line).lineWidth(0.5).stroke();
    return rowHeight;
}

function drawGenericPages(doc, rows, config, reportLabel, generatedLabel) {
    const groups = genericGroups(rows);
    const bottom = FOOTER_Y - 12;
    if (groups.length === 0) {
        doc.addPage();
        drawBrandHeader(doc, reportLabel, generatedLabel, config.subtitle);
        doc.fillColor(COLORS.softBlue).roundedRect(MARGIN, 105, CONTENT_WIDTH, 55, 7).fill();
        doc.fillColor(COLORS.blueDark).font("Helvetica-Bold").fontSize(11).text(`Nenhum ${config.entityLabel} encontrado`, MARGIN, 125, { width: CONTENT_WIDTH, align: "center" });
        return;
    }

    groups.forEach((group) => {
        const startPage = (continuation) => {
            doc.addPage();
            drawBrandHeader(doc, reportLabel, generatedLabel, config.subtitle);
            drawRegionalBand(doc, 102, group.title, group.rows.length, continuation, config.entityLabel);
            return drawGenericTableHeader(doc, 138, config.columns);
        };
        let y = startPage(false);
        group.rows.forEach((row, rowIndex) => {
            if (y + 43 > bottom) y = startPage(true);
            y += drawGenericTableRow(doc, row, y, rowIndex, config.columns);
        });
    });
}

function createGenericPdf(res, config, rows) {
    const reportLabel = config.title.replace(/^Relat\u00f3rio de /, "");
    const formattedReportLabel = reportLabel.charAt(0).toUpperCase() + reportLabel.slice(1);
    const generatedLabel = generatedAt();
    const doc = new PDFDocument({
        size: "A4", layout: "landscape", margin: 0, bufferPages: true, autoFirstPage: false,
        info: { Title: "SysTAB - " + config.title, Author: "SysTAB" },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${config.filename}"`);
    doc.pipe(res);
    drawGenericSummaryPage(doc, rows, config, formattedReportLabel, generatedLabel);
    drawGenericPages(doc, rows, config, formattedReportLabel, generatedLabel);
    drawFooter(doc, config.title);
    doc.end();
}
function chamadosQuery(status) {
    const filters = {
        todos: "",
        abertos: "WHERE c.status = 'Aberto'",
        fechados: "WHERE c.status = 'Fechado'",
        atrasados: "WHERE c.status = 'Aberto' AND c.dataEntrada < DATE_SUB(NOW(), INTERVAL 7 DAY)",
    };
    const where = filters[status] ?? filters.todos;

    return [
        "SELECT c.idChamado, c.status, c.dataEntrada, c.dataSaida, c.descricao, t.idTomb,",
        "COALESCE(c.nomeUserSnapshot, usuarioAtual.nomeUser, 'N\u00e3o informado') AS usuario,",
        "COALESCE(c.nomeUnidadeSnapshot, unidadeAtual.nomeUnidade, 'N\u00e3o informada') AS unidade,",
        "COALESCE(c.regionalSnapshot, regionalAtual.numReg, 'Sem regional vinculada') AS regional",
        "FROM chamados c",
        "JOIN tablets t ON c.idTab = t.idTab",
        "LEFT JOIN usuarios usuarioAtual ON t.idUser = usuarioAtual.idUser",
        "LEFT JOIN unidades unidadeAtual ON usuarioAtual.idUnidade = unidadeAtual.idUnidade",
        "LEFT JOIN regionais regionalAtual ON unidadeAtual.idReg = regionalAtual.idReg",
        where,
        "ORDER BY c.dataEntrada DESC, c.idChamado DESC",
    ].join(" ");
}

exports.gerarRelatorio = async (req, res) => {
    const type = String(req.params.tipo || "").toLowerCase();

    try {
        if (type === "chamados") {
            const requestedStatus = String(req.query.status || "todos").toLowerCase();
            const allowedStatuses = new Set(["todos", "abertos", "fechados", "atrasados"]);
            const status = allowedStatuses.has(requestedStatus) ? requestedStatus : "todos";
            const [rows] = await db.query(chamadosQuery(status));
            createChamadosPdf(res, rows, status);
            return;
        }

        const config = genericConfig(type);
        if (!config) {
            res.status(404).json({ error: "Tipo de relat\u00f3rio n\u00e3o encontrado." });
            return;
        }

        const [rows] = await db.query(config.sql);
        createGenericPdf(res, config, rows);
    } catch (error) {
        console.error("Erro ao gerar relat\u00f3rio PDF:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "N\u00e3o foi poss\u00edvel gerar o relat\u00f3rio PDF." });
        }
    }
};

exports.__test = {
    createChamadosPdf,
    buildRegionalGroups,
    monthLabel,
    regionalTitle,
};