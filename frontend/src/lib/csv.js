// Minimal CSV utilities. Spreadsheet-safe quoting (RFC 4180): wrap any cell that
// contains a comma, quote, or newline in double quotes, and double-up any embedded quotes.
function escape(cell) {
  if (cell == null) return '';
  const s = String(cell);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows, columns) {
  const header = columns.map(c => escape(c.label)).join(',');
  const body = rows.map(r =>
    columns.map(c => escape(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(',')
  ).join('\n');
  return `${header}\n${body}\n`;
}

// Browser-side download of a string as a file. Cleans up the blob URL after.
export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
