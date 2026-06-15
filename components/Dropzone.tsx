'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

type Props = {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: Record<string, string[]>;
  hint?: string;
  compact?: boolean;
};

export function Dropzone({
  onFiles,
  multiple = false,
  accept = { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
  hint = '支持 CSV，单文件最大 50 MB',
  compact = false,
}: Props) {
  const onDrop = useCallback((files: File[]) => onFiles(files), [onFiles]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept, multiple });

  return (
    <div
      {...getRootProps()}
      className={`relative ${compact ? 'p-6' : 'p-14'} cursor-pointer border-2 border-dashed transition-colors duration-150 ${
        isDragActive ? 'border-cobalt bg-cobalt/[0.04]' : 'border-line hover:border-ink-2 bg-surface'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="eyebrow">DROP · CSV</div>
        <div className="display-zh text-2xl text-ink">
          {isDragActive ? '松开以加载文件' : '把 CSV 文件拖到这里'}
        </div>
        <div className="text-xs text-ink-3">
          或 <span className="text-cobalt underline underline-offset-4">点击选择文件</span>
        </div>
        {hint && <div className="serial mt-2">{hint}</div>}
      </div>
    </div>
  );
}
