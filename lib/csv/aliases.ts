// CSV 列名到标准 Chip 字段的别名字典 — 中英文皆覆盖
// 解析时统一 normalize：小写、去空格/下划线/破折号/括号

export type ChipField =
  | 'chipId'
  | 'lotId'
  | 'waferId'
  | 'dieX'
  | 'dieY'
  | 'productModel'
  | 'testTempC'
  | 'testVoltageV'
  | 'packageType'
  | 'vthV'
  | 'iddUa'
  | 'leakageNa'
  | 'frequencyMhz'
  | 'powerMw'
  | 'passCount'
  | 'failCount'
  | 'binCode'
  | 'testDurationS'
  | 'testTimestamp';

export const FIELD_LABELS: Record<ChipField, string> = {
  chipId: '芯片编号',
  lotId: '晶圆批号',
  waferId: '晶圆号',
  dieX: 'Die X',
  dieY: 'Die Y',
  productModel: '产品型号',
  testTempC: '测试温度 (°C)',
  testVoltageV: '测试电压 (V)',
  packageType: '封装类型',
  vthV: '阈值电压 Vth (V)',
  iddUa: '静态电流 IDD (μA)',
  leakageNa: '漏电流 (nA)',
  frequencyMhz: '最高频率 (MHz)',
  powerMw: '功耗 (mW)',
  passCount: '通过项数',
  failCount: '失败项数',
  binCode: 'BIN',
  testDurationS: '测试耗时 (s)',
  testTimestamp: '测试时间',
};

// 这些别名会经过 normalize 后再匹配
const RAW_ALIASES: Record<ChipField, string[]> = {
  chipId: ['chipid', 'chip_id', 'chip', 'sn', 'serial', 'serialno', 'serialnumber', '芯片编号', '芯片id', '编号', '序列号'],
  lotId: ['lotid', 'lot', 'lotno', 'lot_id', '晶圆批号', '批号'],
  waferId: ['waferid', 'wafer', 'waferno', 'wafer_id', '晶圆号', '晶圆编号'],
  dieX: ['diex', 'die_x', 'x', 'xcoord', 'x坐标'],
  dieY: ['diey', 'die_y', 'y', 'ycoord', 'y坐标'],
  productModel: ['productmodel', 'model', 'product', 'partno', 'partnumber', '产品型号', '型号'],
  testTempC: ['testtempc', 'testtemp', 'tempc', 'temperature', 'temp', '测试温度', '温度'],
  testVoltageV: ['testvoltagev', 'testvoltage', 'vcc', 'vdd', '测试电压', '电压'],
  packageType: ['packagetype', 'package', 'pkg', '封装', '封装类型'],
  vthV: ['vthv', 'vth', 'vthreshold', 'thresholdvoltage', '阈值电压'],
  iddUa: ['iddua', 'idd', 'iccq', 'quiescentcurrent', '静态电流'],
  leakageNa: ['leakagena', 'leakage', 'ileak', '漏电流'],
  frequencyMhz: ['frequencymhz', 'frequency', 'fmax', 'maxfreq', 'maxfrequency', '频率', '最高频率', '工作频率'],
  powerMw: ['powermw', 'power', 'pdiss', '功耗'],
  passCount: ['passcount', 'pass', 'passednum', '通过数', '通过项数'],
  failCount: ['failcount', 'fail', 'failednum', '失败数', '失败项数', '不良数'],
  binCode: ['bincode', 'bin', 'binno', 'softbin', 'hardbin', '分箱', '档位'],
  testDurationS: ['testdurations', 'testduration', 'duration', 'testtime', '测试耗时', '耗时'],
  testTimestamp: ['testtimestamp', 'timestamp', 'testdate', 'testtime', 'date', '测试时间', '时间'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-()（）\[\]/]/g, '');
}

const LOOKUP: Map<string, ChipField> = new Map();
for (const [field, aliases] of Object.entries(RAW_ALIASES) as [ChipField, string[]][]) {
  for (const a of aliases) LOOKUP.set(normalize(a), field);
  LOOKUP.set(normalize(field), field);
}

export function matchField(header: string): ChipField | null {
  return LOOKUP.get(normalize(header)) ?? null;
}

export const NUMERIC_FIELDS: ChipField[] = [
  'dieX', 'dieY', 'testTempC', 'testVoltageV', 'vthV', 'iddUa',
  'leakageNa', 'frequencyMhz', 'powerMw', 'passCount', 'failCount', 'testDurationS',
];

export const INT_FIELDS: ChipField[] = ['dieX', 'dieY', 'passCount', 'failCount'];
