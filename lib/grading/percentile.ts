export function buildPercentileLookup(values: (number | null | undefined)[]): (v: number | null | undefined) => number {
  const valid = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (valid.length === 0) return () => 50;
  const sorted = [...valid].sort((a, b) => a - b);
  return (v) => {
    if (v == null || Number.isNaN(v)) return 50;
    // 二分查找：v 在 sorted 中的排位
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    const rank = lo / sorted.length;
    return Math.round(rank * 1000) / 10; // 0..100, 一位小数
  };
}
