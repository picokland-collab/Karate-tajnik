export function printAsPdf(naziv: string, sadrzaj: string): void {
  const escaped = sadrzaj
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8">
  <title>${naziv}</title>
  <style>
    @page { margin: 2.5cm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12pt;
      line-height: 1.7;
      color: #111;
    }
    h1 {
      font-size: 14pt;
      text-align: center;
      margin-bottom: 24pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      font-size: 12pt;
      line-height: 1.7;
      margin: 0;
    }
  </style>
</head>
<body>
  <h1>${naziv}</h1>
  <pre>${escaped}</pre>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) {
    alert('Blokirani su pop-upovi. Dopustite ih za ovu stranicu i pokušajte ponovo.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 250);
}
