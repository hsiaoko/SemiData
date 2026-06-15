/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer';
import type { Prisma } from '@prisma/client';
import type { ReportSummary } from './generate';

type AssessmentWithChip = Prisma.ChipAssessmentGetPayload<{ include: { chip: true } }>;

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#15171B' },
  header: { borderBottom: '1pt solid #15171B', paddingBottom: 12, marginBottom: 18 },
  eyebrow: { fontSize: 8, letterSpacing: 2, color: '#6B6E76', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 8, color: '#6B6E76' },
  statsRow: { flexDirection: 'row', marginBottom: 18, gap: 18 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 7, letterSpacing: 1.5, color: '#6B6E76', marginBottom: 3 },
  statValue: { fontSize: 22, fontWeight: 600, fontFamily: 'Helvetica' },
  binBar: { flexDirection: 'row', height: 14, marginBottom: 8, border: '0.5pt solid #C9C5BB' },
  binCell: { height: 14 },
  sectionTitle: {
    fontSize: 8, letterSpacing: 2, color: '#6B6E76',
    marginTop: 18, marginBottom: 8, borderBottom: '0.5pt solid #C9C5BB', paddingBottom: 4,
  },
  table: { width: '100%' },
  tr: { flexDirection: 'row', borderBottom: '0.25pt solid #C9C5BB' },
  th: { padding: 4, fontSize: 7, color: '#6B6E76', fontWeight: 700, letterSpacing: 0.6 },
  td: { padding: 4, fontSize: 8 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 7, color: '#6B6E76', borderTop: '0.5pt solid #C9C5BB', paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
});

const GRADE_COLOR: Record<string, string> = {
  S: '#1B4FE3', A: '#3FAE6B', B: '#E8A53C', C: '#C24A4A', D: '#8E5BAB', FAIL: '#5A5A60',
};

function BinBar({ dist }: { dist: Record<string, number> }) {
  const order = ['S', 'A', 'B', 'C', 'D', 'FAIL'];
  const total = order.reduce((s, k) => s + (dist[k] ?? 0), 0);
  if (total === 0) return null;
  return (
    <View style={styles.binBar}>
      {order.map((k) => {
        const v = dist[k] ?? 0;
        if (!v) return null;
        return <View key={k} style={{ ...styles.binCell, width: `${(v / total) * 100}%`, backgroundColor: GRADE_COLOR[k] }} />;
      })}
    </View>
  );
}

export async function buildPdf(opts: {
  batchName: string;
  reportId: string;
  createdAt: Date;
  summary: ReportSummary;
  assessments: AssessmentWithChip[];
}): Promise<Buffer> {
  // 明细只在 PDF 中放前 200 行，避免 PDF 体积过大
  const detailRows = opts.assessments.slice(0, 200);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SEMIDATA · TEST REPORT</Text>
          <Text style={styles.title}>{opts.batchName}</Text>
          <Text style={styles.meta}>
            报告 ID: {opts.reportId} · 生成时间: {opts.createdAt.toLocaleString('zh-CN', { hour12: false })}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL CHIPS</Text>
            <Text style={styles.statValue}>{opts.summary.total.toLocaleString()}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>YIELD</Text>
            <Text style={styles.statValue}>{(opts.summary.yield * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL CNY</Text>
            <Text style={styles.statValue}>¥{Math.round(opts.summary.totalRecommendedPriceCny).toLocaleString()}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>AVG / CHIP</Text>
            <Text style={styles.statValue}>¥{opts.summary.avgPriceCny.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>GRADE DISTRIBUTION</Text>
        <BinBar dist={opts.summary.gradeDistribution} />
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 10 }}>
          {['S', 'A', 'B', 'C', 'D', 'FAIL'].map((g) => (
            <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 7, height: 7, backgroundColor: GRADE_COLOR[g] }} />
              <Text style={{ fontSize: 8, color: '#6B6E76' }}>{g}</Text>
              <Text style={{ fontSize: 8 }}>{opts.summary.gradeDistribution[g] ?? 0}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>SAMPLE · 前 {detailRows.length} 条芯片评级</Text>
        <View style={styles.table}>
          <View style={[styles.tr, { backgroundColor: '#EAE7DF' }]}>
            <Text style={[styles.th, { width: '14%' }]}>芯片</Text>
            <Text style={[styles.th, { width: '12%' }]}>Lot</Text>
            <Text style={[styles.th, { width: '7%' }]}>等级</Text>
            <Text style={[styles.th, { width: '8%' }]}>综合分</Text>
            <Text style={[styles.th, { width: '10%' }]}>推荐价</Text>
            <Text style={[styles.th, { width: '10%' }]}>频率</Text>
            <Text style={[styles.th, { width: '9%' }]}>漏电</Text>
            <Text style={[styles.th, { width: '30%' }]}>评级理由</Text>
          </View>
          {detailRows.map((a) => (
            <View key={a.id} style={styles.tr} wrap={false}>
              <Text style={[styles.td, { width: '14%' }]}>{a.chip.chipId}</Text>
              <Text style={[styles.td, { width: '12%' }]}>{a.chip.lotId ?? '-'}</Text>
              <Text style={[styles.td, { width: '7%', color: GRADE_COLOR[a.grade] }]}>{a.grade}</Text>
              <Text style={[styles.td, { width: '8%' }]}>{a.score.toFixed(1)}</Text>
              <Text style={[styles.td, { width: '10%' }]}>¥{a.recommendedPriceCny.toFixed(2)}</Text>
              <Text style={[styles.td, { width: '10%' }]}>{a.chip.frequencyMhz?.toFixed(1) ?? '-'}</Text>
              <Text style={[styles.td, { width: '9%' }]}>{a.chip.leakageNa?.toFixed(1) ?? '-'}</Text>
              <Text style={[styles.td, { width: '30%', fontSize: 7, color: '#3A3D44' }]}>{a.rationale}</Text>
            </View>
          ))}
        </View>

        {opts.assessments.length > detailRows.length && (
          <Text style={{ marginTop: 8, fontSize: 7, color: '#6B6E76' }}>
            （仅展示前 {detailRows.length} 条，完整明细请使用 Excel 导出）
          </Text>
        )}

        <View style={styles.footer} fixed>
          <Text>SemiData · 封测数据中枢</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
