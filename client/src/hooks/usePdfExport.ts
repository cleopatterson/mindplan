import { useCallback, useState } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { FinancialPlan } from 'shared/types';
import { netWorth, totalAssets, totalLiabilities, formatAUD } from '../utils/calculations';

export function usePdfExport() {
  const [exporting, setExporting] = useState(false);

  const exportPdf = useCallback(
    async (mapElement: HTMLElement | null, data: FinancialPlan) => {
      if (!mapElement) return;
      setExporting(true);

      try {
        // Capture the map at 2x resolution
        const dataUrl = await toPng(mapElement, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });

        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Title page
        pdf.setFontSize(28);
        pdf.text('Financial Structure Map', pageWidth / 2, 40, { align: 'center' });
        pdf.setFontSize(14);
        pdf.setTextColor(100);
        pdf.text(`Generated ${new Date().toLocaleDateString('en-AU')}`, pageWidth / 2, 52, {
          align: 'center',
        });

        // Summary
        pdf.setFontSize(12);
        pdf.setTextColor(0);
        const summaryY = 75;
        pdf.text(`Net Worth: ${formatAUD(netWorth(data))}`, 20, summaryY);
        pdf.text(`Total Assets: ${formatAUD(totalAssets(data))}`, 20, summaryY + 8);
        pdf.text(`Total Liabilities: ${formatAUD(totalLiabilities(data))}`, 20, summaryY + 16);
        pdf.text(`Entities: ${data.entities.length}`, 20, summaryY + 24);
        pdf.text(`Data Gaps: ${data.dataGaps.length}`, 20, summaryY + 32);

        // Map page
        pdf.addPage();
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const imgRatio = img.width / img.height;
        const margin = 10;
        let imgWidth = pageWidth - margin * 2;
        let imgHeight = imgWidth / imgRatio;

        if (imgHeight > pageHeight - margin * 2) {
          imgHeight = pageHeight - margin * 2;
          imgWidth = imgHeight * imgRatio;
        }

        pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, imgHeight);

        // Data gaps page (if any)
        if (data.dataGaps.length > 0) {
          pdf.addPage();
          pdf.setFontSize(18);
          pdf.text('Information Needed', 20, 25);
          pdf.setFontSize(10);
          let y = 40;
          for (const gap of data.dataGaps) {
            if (y > pageHeight - 20) {
              pdf.addPage();
              y = 25;
            }
            pdf.text(`• ${gap.description}`, 25, y);
            y += 7;
          }
        }

        pdf.save('financial-structure.pdf');
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  return { exportPdf, exporting };
}
