import ExcelJS from 'exceljs';
import type { Prisma } from '@prisma/client';
import type { ReportSummary } from './generate';

type AssessmentWithChip = Prisma.ChipAssessmentGetPayload<{ include: { chip: true } }>;

export async function buildExcel(opts: {
  batchName: string;
  reportId: string;
  createdAt: Date;
  summary: ReportSummary;
  assessments: AssessmentWithChip[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SemiData';
  wb.created = opts.createdAt;

  // 汇总页
  const overview = wb.addWorksheet('汇总', { views: [{ showGridLines: false }] });
  overview.columns = [{ width: 28 }, { width: 22 }];
  overview.addRow(['批次', opts.batchName]);
  overview.addRow(['报告 ID', opts.reportId]);
  overview.addRow(['生成时间', opts.createdAt.toLocaleString('zh-CN', { hour12: false })]);
  overview.addRow([]);
  overview.addRow(['芯片总数', opts.summary.total]);
  overview.addRow(['良率', `${(opts.summary.yield * 100).toFixed(2)}%`]);
  overview.addRow(['推荐总价 (¥)', opts.summary.totalRecommendedPriceCny.toFixed(2)]);
  overview.addRow(['平均单价 (¥)', opts.summary.avgPriceCny.toFixed(2)]);
  overview.addRow([
    '单价区间 (¥)',
    `${(opts.summary.minPriceCny ?? 0).toFixed(2)} ~ ${(opts.summary.maxPriceCny ?? 0).toFixed(2)}`,
  ]);
  overview.addRow(['平均综合分', opts.summary.avgScore.toFixed(2)]);
  overview.addRow([]);
  overview.addRow(['等级', '芯片数']);
  for (const g of ['S', 'A', 'B', 'C', 'D', 'FAIL']) {
    overview.addRow([g, opts.summary.gradeDistribution[g] ?? 0]);
  }
  // 标题样式
  overview.getRow(1).font = { bold: true };
  overview.getColumn(1).font = { bold: true };

  // 明细页
  const detail = wb.addWorksheet('芯片评级明细');
  detail.columns = [
    { header: '芯片编号', key: 'chipId', width: 16 },
    { header: 'Lot', key: 'lotId', width: 16 },
    { header: 'Wafer', key: 'waferId', width: 10 },
    { header: '原始 BIN', key: 'binCode', width: 10 },
    { header: '推荐等级', key: 'grade', width: 10 },
    { header: '综合分', key: 'score', width: 10 },
    { header: '推荐价 (¥)', key: 'price', width: 12 },
    { header: '频率 (MHz)', key: 'frequencyMhz', width: 12 },
    { header: '漏电 (nA)', key: 'leakageNa', width: 12 },
    { header: 'Vth (V)', key: 'vthV', width: 10 },
    { header: 'IDD (μA)', key: 'iddUa', width: 12 },
    { header: '评级理由', key: 'rationale', width: 60 },
  ];
  for (const a of opts.assessments) {
    detail.addRow({
      chipId: a.chip.chipId,
      lotId: a.chip.lotId,
      waferId: a.chip.waferId,
      binCode: a.chip.binCode,
      grade: a.grade,
      score: a.score,
      price: a.recommendedPriceCny,
      frequencyMhz: a.chip.frequencyMhz,
      leakageNa: a.chip.leakageNa,
      vthV: a.chip.vthV,
      iddUa: a.chip.iddUa,
      rationale: a.rationale,
    });
  }
  detail.getRow(1).font = { bold: true };
  detail.getRow(1).alignment = { vertical: 'middle' };
  detail.autoFilter = { from: 'A1', to: 'L1' };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
