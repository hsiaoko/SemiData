import ExcelJS from 'exceljs';
import type { ReportSummary } from './generate';

export type CustomReportRow = {
  displayId: string;
  grade: string;
  score: number;
  recommendedPriceCny: number;
  rationale: string;
  extras: Record<string, any>;
};

const INK = 'FF15171B';
const INK3 = 'FF6B6E76';
const GRADE_FILL: Record<string, string> = {
  S: 'FF1B4FE3', A: 'FF3FAE6B', B: 'FFE8A53C', C: 'FFC24A4A', D: 'FF8E5BAB', FAIL: 'FF5A5A60',
};

export async function buildCustomExcel(opts: {
  batchName: string;
  datasetName: string;
  reportId: string;
  createdAt: Date;
  summary: ReportSummary & { minPriceCny?: number; maxPriceCny?: number; avgScore?: number };
  rows: CustomReportRow[];
  idLabel: string;
  extraFields: { name: string; label: string }[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'YieldEx';
  wb.created = opts.createdAt;

  // ===== Sheet 1 · 汇总 =====
  const ov = wb.addWorksheet('汇总', { views: [{ showGridLines: false }] });
  ov.columns = [{ width: 22 }, { width: 36 }, { width: 6 }, { width: 16 }, { width: 12 }];

  ov.mergeCells('A1:E1');
  ov.getCell('A1').value = `YieldEx · ${opts.datasetName} 报告`;
  ov.getCell('A1').font = { name: '微软雅黑', size: 18, bold: true, color: { argb: INK } };
  ov.getRow(1).height = 32;

  ov.mergeCells('A2:E2');
  ov.getCell('A2').value = opts.batchName;
  ov.getCell('A2').font = { name: '微软雅黑', size: 12, color: { argb: INK3 } };
  ov.getRow(2).height = 20;

  const meta = [
    ['报告 ID', opts.reportId],
    ['生成时间', opts.createdAt.toLocaleString('zh-CN', { hour12: false })],
    ['算法版本', '规则 + 批内分位 (rules+percentile)'],
  ];
  meta.forEach(([k, v], i) => {
    ov.getCell(`A${4 + i}`).value = k;
    ov.getCell(`A${4 + i}`).font = { color: { argb: INK3 }, size: 10 };
    ov.getCell(`B${4 + i}`).value = v;
    ov.getCell(`B${4 + i}`).font = { size: 10 };
  });

  const s = opts.summary;
  const cards = [
    { label: '记录总数', value: s.total, fmt: '#,##0' },
    { label: '良率', value: s.yield, fmt: '0.00%' },
    { label: '推荐总价 (¥)', value: s.totalRecommendedPriceCny, fmt: '"¥"#,##0.00' },
    { label: '平均单价 (¥)', value: s.avgPriceCny, fmt: '"¥"#,##0.00' },
  ];
  cards.forEach((c, i) => {
    const r = 8 + i;
    ov.getCell(`A${r}`).value = c.label;
    ov.getCell(`A${r}`).font = { size: 9, color: { argb: INK3 }, bold: true };
    ov.getCell(`B${r}`).value = c.value;
    ov.getCell(`B${r}`).numFmt = c.fmt;
    ov.getCell(`B${r}`).font = { name: 'JetBrains Mono', size: 16, color: { argb: INK }, bold: true };
    ov.getRow(r).height = 22;
  });

  // 等级分布
  const distStart = 14;
  ov.getCell(`A${distStart}`).value = '等级分布 · GRADE DISTRIBUTION';
  ov.getCell(`A${distStart}`).font = { size: 9, color: { argb: INK3 }, bold: true };

  const distHeader = ov.getRow(distStart + 1);
  ['等级', '数量', '占比'].forEach((h, i) => {
    distHeader.getCell(i + 1).value = h;
    distHeader.getCell(i + 1).font = { size: 9, color: { argb: 'FFFFFFFF' }, bold: true };
    distHeader.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
  });
  distHeader.height = 18;

  ['S', 'A', 'B', 'C', 'D', 'FAIL'].forEach((g, i) => {
    const r = distStart + 2 + i;
    const cnt = (s.gradeDistribution as any)[g] ?? 0;
    const pct = s.total > 0 ? cnt / s.total : 0;
    const row = ov.getRow(r);
    row.getCell(1).value = g;
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRADE_FILL[g] } };
    row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).value = cnt;
    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).value = pct;
    row.getCell(3).numFmt = '0.00%';
  });

  // ===== Sheet 2 · 评级明细 =====
  const dt = wb.addWorksheet('评级明细', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  });
  type Col = { header: string; key: string; width: number; numFmt?: string; align?: 'left' | 'right' | 'center' };
  const cols: Col[] = [
    { header: opts.idLabel, key: 'displayId', width: 18 },
    { header: '推荐等级', key: 'grade', width: 10, align: 'center' },
    { header: '综合分', key: 'score', width: 10, align: 'right', numFmt: '0.00' },
    { header: '推荐价 (¥)', key: 'price', width: 14, align: 'right', numFmt: '"¥"#,##0.00' },
    ...opts.extraFields.map((f) => ({
      header: f.label, key: `extra_${f.name}`, width: 14, align: 'right' as const, numFmt: '0.###',
    })),
    { header: '评级理由', key: 'rationale', width: 80 },
  ];
  dt.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const headerRow = dt.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: '微软雅黑', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
  });

  opts.rows.forEach((r) => {
    const data: any = {
      displayId: r.displayId,
      grade: r.grade,
      score: r.score,
      price: r.recommendedPriceCny,
      rationale: r.rationale,
    };
    for (const f of opts.extraFields) {
      data[`extra_${f.name}`] = r.extras[f.name] ?? null;
    }
    const row = dt.addRow(data);
    cols.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      if (c.numFmt) cell.numFmt = c.numFmt;
      if (c.align) cell.alignment = { vertical: 'middle', horizontal: c.align };
      cell.font = { name: c.key === 'rationale' ? '微软雅黑' : 'JetBrains Mono', size: 10 };
    });
    const gradeCell = row.getCell(2);
    gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRADE_FILL[r.grade] ?? INK3 } };
    gradeCell.font = { name: '微软雅黑', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    gradeCell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  dt.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
