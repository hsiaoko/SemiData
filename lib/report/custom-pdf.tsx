/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { ReportSummary } from './generate';
import type { CustomReportRow } from './custom-excel';

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
const REG = path.join(FONT_DIR, 'SourceHanSansCN-Regular.otf');
const BOLD = path.join(FONT_DIR, 'SourceHanSansCN-Bold.otf');

let fontReady = false;
function ensureFontRegistered() {
  if (fontReady) return;
  if (!existsSync(REG)) throw new Error(`中文字体未找到：${REG}`);
  Font.register({
    family: 'SemiSans',
    fonts: [
      { src: REG, fontWeight: 'normal' },
      { src: existsSync(BOLD) ? BOLD : REG, fontWeight: 'bold' },
    ],
  });
  fontReady = true;
}

const COLOR = {
  ink: '#15171B', ink2: '#3A3D44', ink3: '#6B6E76',
  line: '#C9C5BB', surface: '#F4F2EC', surface2: '#EAE7DF',
  cobalt: '#1B4FE3', pink: '#E63780',
};
const GRADE_COLOR: Record<string, string> = {
  S: '#1B4FE3', A: '#3FAE6B', B: '#E8A53C', C: '#C24A4A', D: '#8E5BAB', FAIL: '#5A5A60',
};
const GRADE_LABEL: Record<string, string> = {
  S: 'S 特级', A: 'A 一级', B: 'B 二级', C: 'C 三级', D: 'D 次品', FAIL: 'FAIL 失效',
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'SemiSans', color: COLOR.ink, backgroundColor: '#FFFFFF' },
  header: { paddingBottom: 16, borderBottom: `1pt solid ${COLOR.ink}`, marginBottom: 20 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  brand: { fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
  reportTag: { fontSize: 7, letterSpacing: 1.5, color: COLOR.ink3 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 6, lineHeight: 1.15 },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  metaItem: { fontSize: 8, color: COLOR.ink3 },
  metaItemLabel: { fontSize: 7, color: COLOR.ink3, letterSpacing: 1.2 },
  statsGrid: { flexDirection: 'row', marginBottom: 22, gap: 1, backgroundColor: COLOR.line },
  statBox: { flex: 1, padding: 12, backgroundColor: '#FFFFFF' },
  statLabel: { fontSize: 7, letterSpacing: 1.6, color: COLOR.ink3, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: COLOR.ink },
  statHint: { fontSize: 7, color: COLOR.ink3, marginTop: 3 },
  sectionTitle: {
    fontSize: 8, letterSpacing: 1.6, color: COLOR.ink3,
    marginTop: 18, marginBottom: 10, paddingBottom: 4,
    borderBottom: `0.5pt solid ${COLOR.line}`,
  },
  binBar: { flexDirection: 'row', height: 18, marginBottom: 10 },
  binSeg: { height: 18, justifyContent: 'center', alignItems: 'center' },
  binSegText: { fontSize: 7, color: '#FFFFFF', fontWeight: 'bold' },
  binLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  binLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  binSwatch: { width: 9, height: 9 },
  binLabel: { fontSize: 8 },
  binCount: { fontSize: 8, fontWeight: 'bold' },
  table: { borderTop: `0.5pt solid ${COLOR.line}` },
  tr: { flexDirection: 'row', borderBottom: `0.25pt solid ${COLOR.line}`, minHeight: 18 },
  trHead: { backgroundColor: COLOR.surface2 },
  th: { paddingHorizontal: 5, paddingVertical: 5, fontSize: 7, color: COLOR.ink3, fontWeight: 'bold' },
  td: { paddingHorizontal: 5, paddingVertical: 4, fontSize: 8 },
  tdHint: { paddingHorizontal: 5, paddingVertical: 4, fontSize: 7, color: COLOR.ink3 },
  gradeTag: { paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, color: '#FFFFFF', fontWeight: 'bold', textAlign: 'center' },
  footer: {
    position: 'absolute', bottom: 24, left: 40, right: 40,
    paddingTop: 6, borderTop: `0.5pt solid ${COLOR.line}`,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7, color: COLOR.ink3,
  },
});

export async function buildCustomPdf(opts: {
  batchName: string;
  datasetName: string;
  reportId: string;
  createdAt: Date;
  summary: ReportSummary & { minPriceCny?: number; maxPriceCny?: number; avgScore?: number };
  rows: CustomReportRow[];
  idLabel: string;
  extraFields: { name: string; label: string }[];
}): Promise<Buffer> {
  ensureFontRegistered();
  const detail = opts.rows.slice(0, 200);
  const s = opts.summary;
  const orderedGrades = ['S', 'A', 'B', 'C', 'D', 'FAIL'];

  // 列宽分配
  const reservedCols = 4; // displayId / grade / score / price
  const extraCount = opts.extraFields.length;
  const idW = 18, gradeW = 8, scoreW = 9, priceW = 12;
  const usedW = idW + gradeW + scoreW + priceW;
  const remaining = 100 - usedW;
  const rationaleW = Math.max(20, remaining - extraCount * 10);
  const extraW = extraCount > 0 ? (remaining - rationaleW) / extraCount : 0;

  const doc = (
    <Document title={`YieldEx 报告 · ${opts.batchName}`} author="YieldEx">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>YIELDEX BENCH · {opts.datasetName}</Text>
            <Text style={styles.reportTag}>REPORT · {opts.reportId.slice(-8).toUpperCase()}</Text>
          </View>
          <Text style={styles.title}>{opts.batchName}</Text>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaItemLabel}>生成时间</Text>
              <Text style={styles.metaItem}>{opts.createdAt.toLocaleString('zh-CN', { hour12: false })}</Text>
            </View>
            <View style={{ marginLeft: 28 }}>
              <Text style={styles.metaItemLabel}>算法</Text>
              <Text style={styles.metaItem}>规则 + 批内分位</Text>
            </View>
            <View style={{ marginLeft: 28 }}>
              <Text style={styles.metaItemLabel}>记录数</Text>
              <Text style={styles.metaItem}>{opts.rows.length.toLocaleString()} 条</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>记录总数</Text>
            <Text style={styles.statValue}>{s.total.toLocaleString()}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>良率</Text>
            <Text style={[styles.statValue, { color: s.yield > 0.9 ? COLOR.cobalt : COLOR.pink }]}>
              {(s.yield * 100).toFixed(1)}%
            </Text>
            <Text style={styles.statHint}>非 FAIL · {Math.round(s.yield * s.total)} 条</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>推荐总价</Text>
            <Text style={[styles.statValue, { color: COLOR.cobalt }]}>
              ¥{Math.round(s.totalRecommendedPriceCny).toLocaleString()}
            </Text>
            <Text style={styles.statHint}>均价 ¥{s.avgPriceCny.toFixed(2)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>单价区间</Text>
            <Text style={styles.statValue}>
              ¥{(s.minPriceCny ?? 0).toFixed(2)}–{(s.maxPriceCny ?? 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>等级分布 · GRADE DISTRIBUTION</Text>
        <View style={styles.binBar}>
          {orderedGrades.map((g) => {
            const v = s.gradeDistribution[g] ?? 0;
            if (!v || s.total === 0) return null;
            const pct = (v / s.total) * 100;
            return (
              <View key={g} style={{ ...styles.binSeg, width: `${pct}%`, backgroundColor: GRADE_COLOR[g] }}>
                {pct > 6 && <Text style={styles.binSegText}>{g}</Text>}
              </View>
            );
          })}
        </View>
        <View style={styles.binLegend}>
          {orderedGrades.map((g) => (
            <View key={g} style={styles.binLegendItem}>
              <View style={[styles.binSwatch, { backgroundColor: GRADE_COLOR[g] }]} />
              <Text style={styles.binLabel}>{GRADE_LABEL[g]}</Text>
              <Text style={styles.binCount}>{s.gradeDistribution[g] ?? 0}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>明细 · 前 {detail.length} 条记录评级</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.trHead]} fixed>
            <Text style={[styles.th, { width: `${idW}%` }]}>{opts.idLabel}</Text>
            <Text style={[styles.th, { width: `${gradeW}%` }]}>等级</Text>
            <Text style={[styles.th, { width: `${scoreW}%`, textAlign: 'right' }]}>综合分</Text>
            <Text style={[styles.th, { width: `${priceW}%`, textAlign: 'right' }]}>推荐价</Text>
            {opts.extraFields.map((f) => (
              <Text key={f.name} style={[styles.th, { width: `${extraW}%`, textAlign: 'right' }]}>{f.label}</Text>
            ))}
            <Text style={[styles.th, { width: `${rationaleW}%` }]}>评级理由</Text>
          </View>
          {detail.map((r, i) => {
            const stripe = i % 2 === 1 ? COLOR.surface : '#FFFFFF';
            return (
              <View key={i} style={[styles.tr, { backgroundColor: stripe }]} wrap={false}>
                <Text style={[styles.td, { width: `${idW}%` }]}>{r.displayId}</Text>
                <View style={{ width: `${gradeW}%`, paddingHorizontal: 5, paddingVertical: 3 }}>
                  <Text style={[styles.gradeTag, { backgroundColor: GRADE_COLOR[r.grade] }]}>{r.grade}</Text>
                </View>
                <Text style={[styles.td, { width: `${scoreW}%`, textAlign: 'right' }]}>{r.score.toFixed(1)}</Text>
                <Text style={[styles.td, { width: `${priceW}%`, textAlign: 'right' }]}>
                  ¥{r.recommendedPriceCny.toFixed(2)}
                </Text>
                {opts.extraFields.map((f) => {
                  const v = r.extras[f.name];
                  const text = v == null ? '—' : typeof v === 'number' ? v.toString() : String(v);
                  return (
                    <Text key={f.name} style={[styles.td, { width: `${extraW}%`, textAlign: 'right' }]}>{text}</Text>
                  );
                })}
                <Text style={[styles.tdHint, { width: `${rationaleW}%` }]}>{r.rationale}</Text>
              </View>
            );
          })}
        </View>

        {opts.rows.length > detail.length && (
          <Text style={{ marginTop: 8, fontSize: 7, color: COLOR.ink3 }}>
            （仅展示前 {detail.length} 条，完整明细请使用 Excel 导出）
          </Text>
        )}

        <View style={styles.footer} fixed>
          <Text>YieldEx Bench · 芯测台 · 报告 {opts.reportId.slice(-8).toUpperCase()}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
