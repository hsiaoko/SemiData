import ExcelJS from 'exceljs';
import type { Prisma } from '@prisma/client';
import type { ReportSummary } from './generate';

type AssessmentWithChip = Prisma.ChipAssessmentGetPayload<{ include: { chip: true } }>;

const COBALT = 'FF1B4FE3';
const INK = 'FF15171B';
const INK3 = 'FF6B6E76';
const SURFACE2 = 'FFEAE7DF';
const HAIRLINE = 'FFC9C5BB';

const GRADE_FILL: Record<string, string> = {
  S: 'FF1B4FE3', A: 'FF3FAE6B', B: 'FFE8A53C', C: 'FFC24A4A', D: 'FF8E5BAB', FAIL: 'FF5A5A60',
};

function setBorder(cell: ExcelJS.Cell, color = HAIRLINE) {
  cell.border = {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

export async function buildExcel(opts: {
  batchName: string;
  reportId: string;
  createdAt: Date;
  summary: ReportSummary & { minPriceCny?: number; maxPriceCny?: number; avgScore?: number };
  assessments: AssessmentWithChip[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'YieldEx';
  wb.created = opts.createdAt;
  wb.modified = opts.createdAt;

  // ============================================================
  // Sheet 1 · 汇总
  // ============================================================
  const ov = wb.addWorksheet('汇总', {
    views: [{ showGridLines: false }],
  });
  ov.columns = [
    { width: 22 },
    { width: 32 },
    { width: 6 },
    { width: 16 },
    { width: 12 },
  ];

  // 标题大行
  ov.mergeCells('A1:E1');
  ov.getCell('A1').value = `YieldEx · 芯测分级报告`;
  ov.getCell('A1').font = { name: '微软雅黑', size: 18, bold: true, color: { argb: INK } };
  ov.getCell('A1').alignment = { vertical: 'middle' };
  ov.getRow(1).height = 32;

  ov.mergeCells('A2:E2');
  ov.getCell('A2').value = opts.batchName;
  ov.getCell('A2').font = { name: '微软雅黑', size: 12, color: { argb: INK3 } };
  ov.getRow(2).height = 20;

  // 元信息
  const metaRows = [
    ['报告 ID', opts.reportId],
    ['生成时间', opts.createdAt.toLocaleString('zh-CN', { hour12: false })],
    ['算法版本', '规则 + 批内分位 (rules+percentile)'],
  ];
  metaRows.forEach(([k, v], i) => {
    const row = ov.getRow(4 + i);
    row.getCell(1).value = k;
    row.getCell(1).font = { color: { argb: INK3 }, size: 10 };
    row.getCell(2).value = v;
    row.getCell(2).font = { size: 10, color: { argb: INK } };
  });

  // 核心指标卡（4 项）
  const startRow = 8;
  const s = opts.summary;
  const cards = [
    { label: '芯片总数', value: s.total, format: '#,##0' },
    { label: '良率', value: s.yield, format: '0.00%' },
    { label: '推荐总价 (¥)', value: s.totalRecommendedPriceCny, format: '"¥"#,##0.00' },
    { label: '平均单价 (¥)', value: s.avgPriceCny, format: '"¥"#,##0.00' },
  ];
  cards.forEach((c, i) => {
    const r = startRow + i;
    const labelCell = ov.getCell(`A${r}`);
    const valueCell = ov.getCell(`B${r}`);
    labelCell.value = c.label;
    labelCell.font = { size: 9, color: { argb: INK3 }, bold: true };
    labelCell.alignment = { vertical: 'middle' };
    valueCell.value = c.value;
    valueCell.font = { name: 'JetBrains Mono', size: 16, color: { argb: INK }, bold: true };
    valueCell.numFmt = c.format;
    valueCell.alignment = { vertical: 'middle' };
    ov.getRow(r).height = 22;
  });

  ov.getCell(`A${startRow + 4}`).value = '单价区间';
  ov.getCell(`A${startRow + 4}`).font = { size: 9, color: { argb: INK3 }, bold: true };
  ov.getCell(`B${startRow + 4}`).value = `¥${(s.minPriceCny ?? 0).toFixed(2)} ~ ¥${(s.maxPriceCny ?? 0).toFixed(2)}`;
  ov.getCell(`B${startRow + 4}`).font = { size: 12, color: { argb: INK } };

  ov.getCell(`A${startRow + 5}`).value = '平均综合分';
  ov.getCell(`A${startRow + 5}`).font = { size: 9, color: { argb: INK3 }, bold: true };
  ov.getCell(`B${startRow + 5}`).value = s.avgScore ?? 0;
  ov.getCell(`B${startRow + 5}`).numFmt = '0.00';
  ov.getCell(`B${startRow + 5}`).font = { size: 12, color: { argb: INK } };

  // 等级分布
  const distStart = startRow + 8;
  ov.getCell(`A${distStart}`).value = '等级分布 · GRADE DISTRIBUTION';
  ov.getCell(`A${distStart}`).font = { size: 9, color: { argb: INK3 }, bold: true };
  ov.mergeCells(`A${distStart}:E${distStart}`);

  const distHeader = ov.getRow(distStart + 1);
  ['等级', '名称', '数量', '占比', ''].forEach((h, i) => {
    distHeader.getCell(i + 1).value = h;
    distHeader.getCell(i + 1).font = { size: 9, color: { argb: 'FFFFFFFF' }, bold: true };
    distHeader.getCell(i + 1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: INK },
    };
    distHeader.getCell(i + 1).alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
  });
  distHeader.height = 20;

  const gradeNames: Record<string, string> = {
    S: '特级 S', A: '一级 A', B: '二级 B', C: '三级 C', D: '次品 D', FAIL: '失效 FAIL',
  };
  ['S', 'A', 'B', 'C', 'D', 'FAIL'].forEach((g, i) => {
    const r = distStart + 2 + i;
    const cnt = (s.gradeDistribution as any)[g] ?? 0;
    const pct = s.total > 0 ? cnt / s.total : 0;
    const row = ov.getRow(r);
    row.getCell(1).value = g;
    row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRADE_FILL[g] } };
    row.getCell(2).value = gradeNames[g];
    row.getCell(2).font = { size: 10 };
    row.getCell(3).value = cnt;
    row.getCell(3).numFmt = '#,##0';
    row.getCell(3).alignment = { horizontal: 'right' };
    row.getCell(4).value = pct;
    row.getCell(4).numFmt = '0.00%';
    row.getCell(4).alignment = { horizontal: 'right' };
  });

  // ============================================================
  // Sheet 2 · 芯片评级明细
  // ============================================================
  const dt = wb.addWorksheet('芯片评级明细', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  });

  const cols: { header: string; key: string; width: number; numFmt?: string; align?: 'left' | 'right' | 'center' }[] = [
    { header: '芯片编号', key: 'chipId', width: 16 },
    { header: 'Lot 批号', key: 'lotId', width: 18 },
    { header: 'Wafer', key: 'waferId', width: 10, align: 'center' },
    { header: '原始 BIN', key: 'binCode', width: 12, align: 'center' },
    { header: '推荐等级', key: 'grade', width: 10, align: 'center' },
    { header: '综合分', key: 'score', width: 10, align: 'right', numFmt: '0.00' },
    { header: '推荐价 (¥)', key: 'price', width: 14, align: 'right', numFmt: '"¥"#,##0.00' },
    { header: '频率 (MHz)', key: 'frequencyMhz', width: 13, align: 'right', numFmt: '0.0' },
    { header: '漏电 (nA)', key: 'leakageNa', width: 12, align: 'right', numFmt: '0.0' },
    { header: 'Vth (V)', key: 'vthV', width: 10, align: 'right', numFmt: '0.000' },
    { header: 'IDD (μA)', key: 'iddUa', width: 12, align: 'right', numFmt: '0.0' },
    { header: '评级理由', key: 'rationale', width: 70 },
  ];
  dt.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // 表头样式
  const headerRow = dt.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: '微软雅黑', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    setBorder(cell, INK);
  });

  // 数据行
  opts.assessments.forEach((a) => {
    const row = dt.addRow({
      chipId: a.chip.chipId,
      lotId: a.chip.lotId ?? '',
      waferId: a.chip.waferId ?? '',
      binCode: a.chip.binCode ?? '',
      grade: a.grade,
      score: a.score,
      price: a.recommendedPriceCny,
      frequencyMhz: a.chip.frequencyMhz,
      leakageNa: a.chip.leakageNa,
      vthV: a.chip.vthV,
      iddUa: a.chip.iddUa,
      rationale: a.rationale,
    });

    cols.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      if (c.numFmt) cell.numFmt = c.numFmt;
      if (c.align) cell.alignment = { vertical: 'middle', horizontal: c.align };
      else cell.alignment = { vertical: 'middle' };
      cell.font = { name: c.key === 'rationale' ? '微软雅黑' : 'JetBrains Mono', size: 10 };
    });

    // 等级单元格上色
    const gradeCell = row.getCell(5);
    gradeCell.fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: GRADE_FILL[a.grade] ?? INK3 },
    };
    gradeCell.font = { name: '微软雅黑', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    gradeCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // FAIL 行整行淡灰
    if (a.grade === 'FAIL') {
      row.eachCell((cell, colNumber) => {
        if (colNumber === 5) return;
        cell.font = { ...(cell.font ?? {}), color: { argb: INK3 } };
      });
    }
  });

  // 自动过滤
  dt.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: cols.length },
  };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
