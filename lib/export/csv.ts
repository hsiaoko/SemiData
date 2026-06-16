// 极简 CSV 序列化（含 UTF-8 BOM 让 Excel 直接识别中文）
export function rowsToCsv(headers: string[], rows: (string | number | null | undefined | Date)[][]): Buffer {
  const escape = (v: string | number | null | undefined | Date): string => {
    if (v == null) return '';
    let s: string;
    if (v instanceof Date) s = v.toISOString();
    else if (typeof v === 'number') s = Number.isFinite(v) ? String(v) : '';
    else s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const out: string[] = [headers.map(escape).join(',')];
  for (const r of rows) out.push(r.map(escape).join(','));
  const text = out.join('\r\n') + '\r\n';
  // UTF-8 BOM (﻿) — Excel 打开 CSV 时正确识别编码
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);
}

// 给浏览器附件的 Content-Disposition（兼容中文）
export function attachmentHeader(filename: string, ext: string): string {
  const safe = filename.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  const ascii = safe.replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="${ascii}.${ext}"; filename*=UTF-8''${encodeURIComponent(safe)}.${ext}`;
}
