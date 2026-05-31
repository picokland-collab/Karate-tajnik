import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export async function downloadAsWord(naziv: string, sadrzaj: string): Promise<void> {
  const lines = sadrzaj.split('\n');

  const children = lines.map(line => {
    const trimmed = line.trim();

    // Detect heading-like lines (ALL CAPS, short, or ends with colon)
    const isHeading =
      (trimmed.length > 0 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-ZŠĐŽČĆ]/.test(trimmed)) ||
      (trimmed.endsWith(':') && trimmed.length < 60);

    if (trimmed === '') {
      return new Paragraph({ text: '' });
    }

    if (isHeading) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed, bold: true })],
      });
    }

    return new Paragraph({
      children: [new TextRun({ text: line, size: 24 })],
    });
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 24 },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: naziv, bold: true, size: 32 })],
          }),
          new Paragraph({ text: '' }),
          ...children,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${naziv.replace(/[/\\?%*:|"<>]/g, '-')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
