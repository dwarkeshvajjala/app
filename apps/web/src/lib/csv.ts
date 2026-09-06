// Prefix spreadsheet formula markers before escaping so user content cannot execute on open.
export function downloadCsv(rows: (string | number | null | undefined)[][], filename: string) {
  const csv = rows.map((row) => row.map((value) => {
    let cell = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = "'" + cell;
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
