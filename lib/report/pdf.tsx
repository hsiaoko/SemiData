/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Prisma } from '@prisma/client';
import type { ReportSummary } from './generate';

type AssessmentWithChip = Prisma.ChipAssessmentGetPayload<{ include: { chip: true } }>;

// 一次性注册中文字体（Source Han Sans CN，Adobe 开源 OTF）
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
const REG = path.join(FONT_DIR, 'SourceHanSansCN-Regular.otf');
const BOLD = path.join(FONT_DIR, 'SourceHanSansCN-Bold.otf');

let fontReady = false;
function ensureFontRegistered() {
  if (fontReady) return;
  if (!existsSync(REG)) {
    throw new Error(
      `中文字体未找到：${REG}\n请运行 npm run setup-fonts 下载字体后再生成 PDF`,
    );
  }
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
  ink: '#15171B',
  ink2: '#3A3D44',
  ink3: '#6B6E76',
  line: '#C9C5BB',
  surface: '#F4F2EC',
  surface2: '#EAE7DF',
  cobalt: '#1B4FE3',
  pink: '#E63780',
};

const GRADE_COLOR: Record<string, string> = {
  S: '#1B4FE3', A: '#3FAE6B', B: '#E8A53C', C: '#C24A4A', D: '#8E5BAB', FAIL: '#5A5A60',
};

const GRADE_LABEL: Record<string, string> = {
  S: 'S 特级', A: 'A 一级', B: 'B 二级', C: 'C 三级', D: 'D 次品', FAIL: 'FAIL 失效',
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'SemiSans',
    color: COLOR.ink,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    paddingBottom: 16,
    borderBottom: `1pt solid ${COLOR.ink}`,
    marginBottom: 20,
  },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  brand: { fontSize: 9, fontWeight: 'bold', letterSpacing: 2, color: COLOR.ink },
  reportTag: { fontSize: 7, letterSpacing: 1.5, color: COLOR.ink3 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 6, color: COLOR.ink, lineHeight: 1.15 },
  meta: { fontSize: 8, color: COLOR.ink3, lineHeight: 1.4 },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  metaItem: { fontSize: 8, color: COLOR.ink3 },
  metaItemLabel: { fontSize: 7, color: COLOR.ink3, letterSpacing: 1.2, marginRight: 4 },

  // Stats grid
  statsGrid: { flexDirection: 'row', marginBottom: 24, gap: 1, backgroundColor: COLOR.line },
  statBox: { flex: 1, padding: 12, backgroundColor: '#FFFFFF' },
  statLabel: { fontSize: 7, letterSpacing: 1.6, color: COLOR.ink3, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: COLOR.ink },
  statHint: { fontSize: 7, color: COLOR.ink3, marginTop: 3 },

  // Section
  sectionTitle: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: COLOR.ink3,
    marginTop: 22,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${COLOR.line}`,
  },

  // BIN bar
  binBar: { flexDirection: 'row', height: 18, marginBottom: 10 },
  binSeg: { height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  binSegText: { fontSize: 7, color: '#FFFFFF', fontWeight: 'bold' },
  binLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  binLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  binSwatch: { width: 9, height: 9 },
  binLabel: { fontSize: 8, color: COLOR.ink2 },
  binCount: { fontSize: 8, fontWeight: 'bold', color: COLOR.ink },

  // Table
  table: { borderTop: `0.5pt solid ${COLOR.line}` },
  tr: { flexDirection: 'row', borderBottom: `0.25pt solid ${COLOR.line}`, alignItems: 'center', minHeight: 18 },
  trHead: { backgroundColor: COLOR.surface2 },
  th: { paddingHorizontal: 5, paddingVertical: 5, fontSize: 7, color: COLOR.ink3, fontWeight: 'bold', letterSpacing: 0.5 },
  td: { paddingHorizontal: 5, paddingVertical: 4, fontSize: 8, color: COLOR.ink },
  tdMono: { paddingHorizontal: 5, paddingVertical: 4, fontSize: 8, color: COLOR.ink },
  tdHint: { paddingHorizontal: 5, paddingVertical: 4, fontSize: 7, color: COLOR.ink3 },

  // Grade tag in table
  gradeTag: { paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, color: '#FFFFFF', fontWeight: 'bold', textAlign: 'center', borderRadius: 1 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    paddingTop: 6,
    borderTop: `0.5pt solid ${COLOR.line}`,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: COLOR.ink3,
  },
});

function BinBar({ dist }: { dist: Record<string, number> }) {
  const order = ['S', 'A', 'B', 'C', 'D', 'FAIL'];
  const total = order.reduce((s, k) => s + (dist[k] ?? 0), 0);
  if (total === 0) return null;
  return (
    <View style={styles.binBar}>
      {order.map((k) => {
        const v = dist[k] ?? 0;
        if (!v) return null;
        const pct = (v / total) * 100;
        return (
          <View
            key={k}
            style={{
              ...styles.binSeg,
              width: `${pct}%`,
              backgroundColor: GRADE_COLOR[k],
            }}
          >
            {pct > 6 && <Text style={styles.binSegText}>{k}</Text>}
          </View>
        );
      })}
    </View>
  );
}

export async function buildPdf(opts: {
  batchName: string;
  reportId: string;
  createdAt: Date;
  summary: ReportSummary & { minPriceCny?: number; maxPriceCny?: number; avgScore?: number };
  assessments: AssessmentWithChip[];
}): Promise<Buffer> {
  ensureFontRegistered();

  const detailRows = opts.assessments.slice(0, 200);
  const s = opts.summary;
  const orderedGrades = ['S', 'A', 'B', 'C', 'D', 'FAIL'];

  const doc = (
    <Document
      title={`YieldEx 芯测报告 · ${opts.batchName}`}
      author="YieldEx"
      subject="芯片封测分级与定价报告"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>YIELDEX BENCH · 芯测台</Text>
            <Text style={styles.reportTag}>TEST REPORT · {opts.reportId.slice(-8).toUpperCase()}</Text>
          </View>
          <Text style={styles.title}>{opts.batchName}</Text>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaItemLabel}>生成时间</Text>
              <Text style={styles.metaItem}>
                {opts.createdAt.toLocaleString('zh-CN', { hour12: false })}
              </Text>
            </View>
            <View style={{ marginLeft: 28 }}>
              <Text style={styles.metaItemLabel}>算法</Text>
              <Text style={styles.metaItem}>规则 + 批内分位</Text>
            </View>
            <View style={{ marginLeft: 28 }}>
              <Text style={styles.metaItemLabel}>明细记录</Text>
              <Text style={styles.metaItem}>{opts.assessments.length.toLocaleString()} 颗芯片</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>芯片总数</Text>
            <Text style={styles.statValue}>{s.total.toLocaleString()}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>良率</Text>
            <Text style={[styles.statValue, { color: s.yield > 0.9 ? COLOR.cobalt : COLOR.pink }]}>
              {(s.yield * 100).toFixed(1)}%
            </Text>
            <Text style={styles.statHint}>非 FAIL · {Math.round(s.yield * s.total)} 颗</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>推荐总价</Text>
            <Text style={[styles.statValue, { color: COLOR.cobalt }]}>
              ¥{Math.round(s.totalRecommendedPriceCny).toLocaleString()}
            </Text>
            <Text style={styles.statHint}>
              均价 ¥{s.avgPriceCny.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>单价区间</Text>
            <Text style={styles.statValue}>
              ¥{(s.minPriceCny ?? 0).toFixed(2)}–{(s.maxPriceCny ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.statHint}>
              平均分 {(s.avgScore ?? 0).toFixed(1)}
            </Text>
          </View>
        </View>

        {/* BIN distribution */}
        <Text style={styles.sectionTitle}>等级分布 · GRADE DISTRIBUTION</Text>
        <BinBar dist={s.gradeDistribution} />
        <View style={styles.binLegend}>
          {orderedGrades.map((g) => (
            <View key={g} style={styles.binLegendItem}>
              <View style={[styles.binSwatch, { backgroundColor: GRADE_COLOR[g] }]} />
              <Text style={styles.binLabel}>{GRADE_LABEL[g]}</Text>
              <Text style={styles.binCount}>{s.gradeDistribution[g] ?? 0}</Text>
            </View>
          ))}
        </View>

        {/* Detail */}
        <Text style={styles.sectionTitle}>明细 · 前 {detailRows.length} 颗芯片评级</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.trHead]} fixed>
            <Text style={[styles.th, { width: '14%' }]}>芯片编号</Text>
            <Text style={[styles.th, { width: '12%' }]}>Lot</Text>
            <Text style={[styles.th, { width: '8%' }]}>等级</Text>
            <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>综合分</Text>
            <Text style={[styles.th, { width: '10%', textAlign: 'right' }]}>推荐价</Text>
            <Text style={[styles.th, { width: '10%', textAlign: 'right' }]}>频率 MHz</Text>
            <Text style={[styles.th, { width: '9%', textAlign: 'right' }]}>漏电 nA</Text>
            <Text style={[styles.th, { width: '29%' }]}>评级理由</Text>
          </View>
          {detailRows.map((a, i) => {
            const stripe = i % 2 === 1 ? COLOR.surface : '#FFFFFF';
            return (
              <View key={a.id} style={[styles.tr, { backgroundColor: stripe }]} wrap={false}>
                <Text style={[styles.tdMono, { width: '14%' }]}>{a.chip.chipId}</Text>
                <Text style={[styles.tdMono, { width: '12%' }]}>{a.chip.lotId ?? '—'}</Text>
                <View style={{ width: '8%', paddingHorizontal: 5, paddingVertical: 3 }}>
                  <Text style={[styles.gradeTag, { backgroundColor: GRADE_COLOR[a.grade] }]}>
                    {a.grade}
                  </Text>
                </View>
                <Text style={[styles.tdMono, { width: '8%', textAlign: 'right' }]}>{a.score.toFixed(1)}</Text>
                <Text style={[styles.tdMono, { width: '10%', textAlign: 'right' }]}>
                  ¥{a.recommendedPriceCny.toFixed(2)}
                </Text>
                <Text style={[styles.tdMono, { width: '10%', textAlign: 'right' }]}>
                  {a.chip.frequencyMhz?.toFixed(1) ?? '—'}
                </Text>
                <Text style={[styles.tdMono, { width: '9%', textAlign: 'right' }]}>
                  {a.chip.leakageNa?.toFixed(1) ?? '—'}
                </Text>
                <Text style={[styles.tdHint, { width: '29%' }]}>{a.rationale}</Text>
              </View>
            );
          })}
        </View>

        {opts.assessments.length > detailRows.length && (
          <Text style={{ marginTop: 10, fontSize: 7, color: COLOR.ink3 }}>
            （PDF 仅展示前 {detailRows.length} 条，完整明细请使用 Excel 导出）
          </Text>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>YieldEx Bench · 芯测台 · 报告 {opts.reportId.slice(-8).toUpperCase()}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
