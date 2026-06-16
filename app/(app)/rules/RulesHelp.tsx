'use client';
import { useState } from 'react';

export function RulesHelp() {
  const [open, setOpen] = useState(true);

  return (
    <section className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-3 bg-surface-2 border border-line hover:border-ink-2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="eyebrow">HOW IT WORKS · 如何写一条规则</span>
        </div>
        <span className="num text-xs text-ink-3">{open ? '收起 ▴' : '展开 ▾'}</span>
      </button>

      {open && (
        <div className="card p-7 space-y-7 mt-0 border-t-0 animate-fade-up">
          {/* 规则本质 */}
          <Block title="规则的本质">
            <p className="text-sm leading-relaxed text-ink-2">
              一条规则就是一个判断式{' '}
              <span className="num text-cobalt">X₁ ∧ X₂ ∧ … ∧ Xₙ → Y</span>。
            </p>
            <ul className="text-xs text-ink-3 list-disc pl-5 mt-2 space-y-1 leading-relaxed">
              <li><strong>X 是前提条件</strong>：来自数据集已有列的值（如某个测量值、状态、计数）</li>
              <li><strong>Y 是结论</strong>：由规则推导出来的新列，本系统里 Y 包含三件事 — 等级、推荐价、自然语言理由</li>
              <li>同一规则集里所有字段评分项 <strong>叠加成综合分</strong>；所有硬否决项之间是 <strong>OR 关系</strong>（任一命中即 FAIL）</li>
              <li>把规则集绑定到数据集，生成报告时该数据集的每一行都会自动得到 Y 值</li>
            </ul>
          </Block>

          {/* 评分公式 */}
          <Block title="评分公式">
            <pre className="bg-surface-2 p-3 text-xs font-mono leading-relaxed border border-line">
{`综合分 = 规则分 × (1 - percentileWeight)
        + 批内分位分 × percentileWeight`}
            </pre>
            <ul className="text-xs text-ink-3 list-disc pl-5 mt-2 space-y-1 leading-relaxed">
              <li>规则分 = 所有 <code className="num">fields</code> 的子分按 <code className="num">weight</code> 加权平均（绝对评分）</li>
              <li>批内分位分 = 该行在本批 <code className="num">percentileField</code> 排名百分位（相对评分）</li>
              <li>分级映射：综合分 ≥ 90 → S，≥ 75 → A，≥ 60 → B，≥ 45 → C，&lt; 45 → D；硬否决命中 → FAIL</li>
            </ul>
          </Block>

          {/* JSON 字段语义 */}
          <Block title="JSON 字段语义">
            <div className="border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-ink-2">
                    <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">键</th>
                    <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">类型</th>
                    <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">语义</th>
                  </tr>
                </thead>
                <tbody>
                  <Row k="fields" t="array" desc="字段评分规则列表。每条针对数据集的一个列定义评分方式与权重。" />
                  <Row k="fields[].field" t="string" desc="列名（必填）— 即数据集 schema 中某个字段的 name。例：bad_address、temp_celsius、test_score、duration_s。" />
                  <Row k="fields[].weight" t="number" desc="该列对综合分的权重（0–1）。权重之和不必为 1，最终会自动归一。" />
                  <Row k="fields[].min" t="number" desc="区间评分模式 — 下限。低于此值得 0 分（但仍参与综合，不直接 FAIL）。" />
                  <Row k="fields[].max" t="number" desc="区间评分模式 — 上限。" />
                  <Row k="fields[].ideal" t="number" desc="理想值评分模式 — 期望值。距理想越近分越高（高斯衰减）。" />
                  <Row k="fields[].tolerance" t="number" desc="理想值模式 — 容差。tolerance 内得分 ≥ 37 分。" />
                  <Row k="hardReject" t="array" desc="硬否决条件列表。任一命中即判 FAIL，价格 = 0。" />
                  <Row k="hardReject[].field" t="string" desc="否决条件作用字段。" />
                  <Row k="hardReject[].greaterThan" t="number" desc="字段值 > 此值时 FAIL。" />
                  <Row k="hardReject[].lessThan" t="number" desc="字段值 < 此值时 FAIL。" />
                  <Row k="hardReject[].equals" t="any" desc='字段值等于此值时 FAIL（可用于字符串匹配，如 "SIZE OVER LIMIT"）。' />
                  <Row k="percentileField" t="string" desc="批内分位评分参考字段。通常用主要性能指标。" />
                  <Row k="percentileWeight" t="number" desc="批内分位分在综合分中的权重（0–1，默认 0.3）。" />
                  <Row k="priceTable" t="object" desc="每个等级对应的基础单价。S/A/B/C/D/FAIL 每键一个数字。同等级内会按综合分微调 ±10%。" />
                </tbody>
              </table>
            </div>
          </Block>

          {/* 字段评分 vs 硬否决 */}
          <Block title="字段评分 vs 硬否决">
            <div className="grid grid-cols-2 gap-4">
              <div className="border-l-2 border-cobalt pl-4">
                <div className="num text-sm text-cobalt mb-1">fields · 软评分（加权叠加）</div>
                <div className="text-xs text-ink-2 leading-relaxed">
                  某字段越界子分为 0，但其它字段仍贡献分数 — 表现为<strong>「全员体检」</strong>。
                </div>
              </div>
              <div className="border-l-2 border-bin-c pl-4">
                <div className="num text-sm text-bin-c mb-1">hardReject · 硬否决（一票否决）</div>
                <div className="text-xs text-ink-2 leading-relaxed">
                  任一硬否决条件命中即判 FAIL，价格 = 0，不参与综合分计算 — 表现为<strong>「一票否决」</strong>。
                </div>
              </div>
            </div>
          </Block>

          {/* 完整范例（通用） */}
          <Block title="完整范例（通用模板）">
            <p className="text-sm text-ink-2 mb-3 leading-relaxed">
              想象数据集有 4 列：<code className="num">metric_a</code>（越接近理想 80 越好，容差 5）、
              <code className="num">metric_b</code>（小于上限 50 即可）、
              <code className="num">defect_count</code>（缺陷数，越少越好）、
              <code className="num">status</code>（必须不是 "REJECTED"）。
            </p>
            <pre className="bg-surface-2 p-4 text-xs font-mono leading-relaxed overflow-x-auto border border-line">
{`{
  "fields": [
    { "field": "metric_a",     "ideal": 80, "tolerance": 5, "weight": 0.4 },
    { "field": "metric_b",     "max": 50,                   "weight": 0.3 },
    { "field": "defect_count", "min": 0, "max": 100,        "weight": 0.3 }
  ],
  "hardReject": [
    { "field": "status",       "equals": "REJECTED" },
    { "field": "defect_count", "greaterThan": 1000 }
  ],
  "percentileField": "metric_a",
  "percentileWeight": 0.3,
  "priceTable": { "S": 18, "A": 14, "B": 10, "C": 6, "D": 3, "FAIL": 0 }
}`}
            </pre>
            <ul className="text-xs text-ink-3 list-disc pl-5 mt-3 space-y-1 leading-relaxed">
              <li>字段名必须与数据集 schema 中的 <code className="num">name</code> 完全一致（区分大小写）</li>
              <li>添加新评分项：往 <code className="num">fields</code> 加一项</li>
              <li>添加新硬否决：往 <code className="num">hardReject</code> 加一项</li>
              <li>编辑器右下「保存」时会做 JSON 合法性校验</li>
            </ul>
          </Block>

          {/* 报告里如何呈现 Y */}
          <Block title="报告里 Y 如何呈现">
            <p className="text-sm text-ink-2 leading-relaxed">
              规则把每行的 X 推导成 Y（等级 + 推荐价 + 自然语言理由）。报告页明细表里每行都会显示 Y 列：
            </p>
            <div className="bg-surface-2 p-4 mt-3 border-l-2 border-cobalt text-xs text-ink-2 leading-relaxed">
              metric_a 78.5（贴近理想 80）；metric_b 32（位于规格中段，表现良好）；defect_count 12（在规格内）。综合 81.2 分（规则项 88/100，批内 metric_a 分位 56），列为 <strong>一级 (A)</strong>，<strong>建议单价 ¥13.76</strong>。
            </div>
            <p className="text-xs text-ink-3 mt-3 leading-relaxed">
              FAIL 的理由会直接说明命中的硬否决：「status = "REJECTED"（命中硬否决条件 = REJECTED）。该记录不参与综合评分，直接判为 <strong>失效 (FAIL)</strong>，不建议出货。」
            </p>
          </Block>

          {/* 等级阈值 */}
          <Block title="等级阈值">
            <div className="grid grid-cols-5 gap-2 text-xs">
              {[
                { g: 'S', min: '≥ 90', color: '#1B4FE3' },
                { g: 'A', min: '≥ 75', color: '#3FAE6B' },
                { g: 'B', min: '≥ 60', color: '#E8A53C' },
                { g: 'C', min: '≥ 45', color: '#C24A4A' },
                { g: 'D', min: '< 45', color: '#8E5BAB' },
              ].map((x) => (
                <div key={x.g} className="p-3 border border-line">
                  <span className="tag mr-2" style={{ color: x.color, borderColor: x.color }}>{x.g}</span>
                  <span className="num text-ink-3">综合分 {x.min}</span>
                </div>
              ))}
            </div>
          </Block>
        </div>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ k, t, desc }: { k: string; t: string; desc: string }) {
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2 font-mono text-xs text-cobalt whitespace-nowrap">{k}</td>
      <td className="px-3 py-2 font-mono text-2xs text-ink-3">{t}</td>
      <td className="px-3 py-2 text-xs text-ink-2 leading-relaxed">{desc}</td>
    </tr>
  );
}
