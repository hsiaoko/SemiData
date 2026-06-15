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
          <span className="eyebrow">HOW IT WORKS · 规则语义与编写</span>
        </div>
        <span className="num text-xs text-ink-3">{open ? '收起 ▴' : '展开 ▾'}</span>
      </button>

      {open && (
        <div className="card p-7 space-y-7 mt-0 border-t-0 animate-fade-up">
          {/* 整体公式 */}
          <Block title="评分公式">
            <p className="text-sm leading-relaxed text-ink-2">
              一颗芯片的综合分 = <span className="num text-cobalt">规则分</span> ×
              <code className="num"> (1 - percentileWeight)</code> +{' '}
              <span className="num text-cobalt">批内分位分</span> ×
              <code className="num"> percentileWeight</code>。两项均为 0–100。
            </p>
            <ul className="text-xs text-ink-3 list-disc pl-5 mt-2 space-y-1 leading-relaxed">
              <li>规则分 = 所有 <code className="num">fields</code> 的子分按 <code className="num">weight</code> 加权平均（绝对评分）</li>
              <li>批内分位分 = 该芯片在本批 <code className="num">percentileField</code> 中的排名百分位（相对评分）</li>
            </ul>
          </Block>

          {/* 字段与硬否决的关系 */}
          <Block title="规则间的关系">
            <div className="grid grid-cols-2 gap-4">
              <div className="border-l-2 border-cobalt pl-4">
                <div className="num text-sm text-cobalt mb-1">fields · 字段评分（AND 叠加）</div>
                <div className="text-xs text-ink-2 leading-relaxed">
                  每个字段都参与综合分加权求和。某字段越界子分为 0，但其它字段仍贡献分数 — 表现为<strong>「全员体检」</strong>。
                </div>
              </div>
              <div className="border-l-2 border-bin-c pl-4">
                <div className="num text-sm text-bin-c mb-1">hardReject · 硬否决（OR 触发）</div>
                <div className="text-xs text-ink-2 leading-relaxed">
                  任一硬否决条件命中即判 FAIL，价格 = 0，不参与综合分计算 — 表现为<strong>「一票否决」</strong>。
                </div>
              </div>
            </div>
          </Block>

          {/* 字段语义表 */}
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
                  <Row k="fields" t="array" desc="字段评分规则列表。每条针对一个芯片字段（如 frequencyMhz、leakageNa）定义评分方式与权重。" />
                  <Row k="fields[].field" t="string" desc="芯片字段名（必填）。可选：chipId / lotId / waferId / vthV / iddUa / leakageNa / frequencyMhz / powerMw / passCount / failCount / testTempC / testVoltageV …" />
                  <Row k="fields[].weight" t="number" desc="该字段在综合分中的权重（0–1）。所有字段权重之和不必为 1，最终会按总和归一。" />
                  <Row k="fields[].min" t="number" desc="区间评分模式 — 下限。值低于此判 0 分（仍参与综合，不直接 FAIL）。" />
                  <Row k="fields[].max" t="number" desc="区间评分模式 — 上限。" />
                  <Row k="fields[].ideal" t="number" desc="理想值评分模式 — 期望值。距理想越近分越高（高斯衰减）。" />
                  <Row k="fields[].tolerance" t="number" desc="理想值模式 — 容差。tolerance 内得分 ≥ 37 分。" />
                  <Row k="hardReject" t="array" desc="硬否决条件列表。任一命中即判 FAIL。" />
                  <Row k="hardReject[].field" t="string" desc="否决条件作用字段。" />
                  <Row k="hardReject[].greaterThan" t="number" desc={'字段值 > 此值时 FAIL。'} />
                  <Row k="hardReject[].lessThan" t="number" desc={'字段值 < 此值时 FAIL。'} />
                  <Row k="hardReject[].equals" t="any" desc="字段值等于此值时 FAIL。" />
                  <Row k="percentileField" t="string" desc="批内分位评分参考字段。通常用主要性能指标（如 frequencyMhz）。" />
                  <Row k="percentileWeight" t="number" desc="批内分位分在综合分中的权重（0–1，默认 0.3）。" />
                  <Row k="priceTable" t="object" desc="每个等级对应的基础单价（人民币）。S/A/B/C/D/FAIL 每键一个数字。同等级内会按综合分微调 ±10%。" />
                </tbody>
              </table>
            </div>
          </Block>

          {/* 等级映射 */}
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
            <p className="text-xs text-ink-3 mt-2">硬否决直接判为 FAIL，不走综合分。</p>
          </Block>

          {/* 写一条新规则 */}
          <Block title="写一条新规则 · 范例">
            <p className="text-sm text-ink-2 mb-3 leading-relaxed">
              假设增加一条「<strong>功耗</strong>越低越好」的规则：powerMw 上限 6 mW，权重 0.1。
            </p>
            <pre className="bg-surface-2 p-4 text-xs font-mono leading-relaxed overflow-x-auto border border-line">
{`{
  "fields": [
    { "field": "frequencyMhz", "min": 380, "ideal": 480, "max": 540, "weight": 0.4 },
    { "field": "leakageNa",    "max": 60,                          "weight": 0.25 },
    { "field": "vthV",         "ideal": 0.70, "tolerance": 0.06,    "weight": 0.2 },
    { "field": "iddUa",        "max": 120,                         "weight": 0.15 },
    { "field": "powerMw",      "max": 6,                           "weight": 0.1 }      // ← 新增
  ],
  "hardReject": [
    { "field": "failCount",  "greaterThan": 0 },
    { "field": "leakageNa",  "greaterThan": 200 }                                       // ← 新增：漏电 > 200 nA 直接 FAIL
  ],
  "percentileField": "frequencyMhz",
  "percentileWeight": 0.3,
  "priceTable": { "S": 18, "A": 14, "B": 10, "C": 6, "D": 3, "FAIL": 0 }
}`}
            </pre>
            <ul className="text-xs text-ink-3 list-disc pl-5 mt-3 space-y-1 leading-relaxed">
              <li>添加新字段评分：往 <code className="num">fields</code> 数组里加一项即可，无需别处改动</li>
              <li>添加新硬否决：往 <code className="num">hardReject</code> 数组里加一项，命中即 FAIL</li>
              <li>权重相对值即可（系统自动归一化），即 <code className="num">0.4 / 0.25 / 0.2 / 0.15 / 0.1</code> 与 <code className="num">40 / 25 / 20 / 15 / 10</code> 等价</li>
              <li>编辑器右下保存时会校验 JSON 合法性，不合法时会拒绝保存</li>
            </ul>
          </Block>

          {/* 在报告中的体现 */}
          <Block title="如何在报告中解释结果">
            <p className="text-sm text-ink-2 leading-relaxed">
              报告里的「评级理由」会用自然语言描述该芯片为什么得到这个分数。例如：
            </p>
            <div className="bg-surface-2 p-4 mt-3 border-l-2 border-cobalt text-xs text-ink-2 leading-relaxed">
              频率 470.5 MHz（位于规格中段，表现良好）；漏电流 32.1 nA（位于规格中段，表现良好）；阈值电压 Vth 0.702 V（贴近理想 0.7 V）。综合 78.5 分（规则项 88/100，批内 最高频率 分位 56），列为 一级 (A)，建议单价 ¥14.32。
            </div>
            <p className="text-xs text-ink-3 mt-3 leading-relaxed">
              FAIL 芯片的理由会直接说明命中的硬否决条件，例如：「通过项数 = 0，命中硬否决条件 &gt; 0。该芯片不参与综合评分，直接判为 失效 (FAIL)，不建议出货。」
            </p>
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
