import { useCallback, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { FinancialPlan } from 'shared/types';
import type { ExportOptions } from '../components/export/ExportModal';
import type { MindMapHandle } from '../components/mindmap/MindMap';
import {
  netWorth, totalAssets, totalLiabilities, entityEquity, formatAUD,
  assetAllocationDetailed, personalAssetsForCalc,
} from '../utils/calculations';

// ── Brand colours ──
const BLUE = [59, 130, 246] as const;   // #3b82f6
const PURPLE = [168, 85, 247] as const; // #a855f7
const EMERALD = [16, 185, 129] as const;
const RED = [239, 68, 68] as const;
const SLATE = [100, 116, 139] as const;
const TEAL = [20, 184, 166] as const;   // #14b8a6
const ROSE = [244, 63, 94] as const;    // #f43f5e

const RISK_PROFILE_LABELS: Record<string, string> = {
  conservative: 'Conservative',
  moderately_conservative: 'Moderately Conservative',
  balanced: 'Balanced',
  growth: 'Growth',
  high_growth: 'High Growth',
};

export function usePdfExport() {
  const [exporting, setExporting] = useState(false);

  const exportPdf = useCallback(
    async (
      mapElement: HTMLElement | null,
      mindMap: MindMapHandle | null,
      data: FinancialPlan,
      options: ExportOptions,
    ) => {
      if (!mapElement) return;
      setExporting(true);

      try {
        // 1. Determine tree shape for dynamic orientation
        const bounds = mindMap?.getContentBounds() ?? { width: 800, height: 600 };
        const treeRatio = bounds.width / bounds.height;
        const orientation = options.includeMap && treeRatio >= 1.0 ? 'landscape' as const : 'portrait' as const;

        let dataUrl = '';
        if (options.includeMap) {
          // 2. Switch to light mode
          mapElement.setAttribute('data-pdf-light', '');

          // 3. Clear highlights
          mapElement.querySelectorAll<HTMLElement>('.react-flow__node').forEach((n) => {
            n.style.opacity = '1';
          });
          mapElement.querySelectorAll<SVGPathElement>('.react-flow__edge path').forEach((p) => {
            p.style.stroke = '#94a3b8';
            p.style.strokeWidth = '1.5';
          });

          // 4. Resize container to A4 aspect ratio for proportional capture
          const captureW = orientation === 'landscape' ? 2970 : 2100;
          const captureH = orientation === 'landscape' ? 2100 : 2970;

          const cover = document.createElement('div');
          cover.style.cssText = `
            position: fixed; inset: 0; z-index: 99998;
            background: #0f0f1a; display: flex; align-items: center; justify-content: center;
            color: rgba(255,255,255,0.5); font-size: 14px; font-family: system-ui;
          `;
          cover.textContent = 'Generating PDF...';
          document.body.appendChild(cover);

          const origStyle = mapElement.style.cssText;
          mapElement.style.cssText = `
            position: fixed !important;
            width: ${captureW}px !important;
            height: ${captureH}px !important;
            top: 0px !important;
            left: 0px !important;
            z-index: 99999 !important;
            background: #ffffff;
          `;

          await new Promise((r) => setTimeout(r, 400));
          mindMap?.fitView({ padding: 0.02 });
          await new Promise((r) => setTimeout(r, 600));

          dataUrl = await toJpeg(mapElement, {
            quality: 0.92,
            pixelRatio: 1,
            backgroundColor: '#ffffff',
            width: captureW,
            height: captureH,
          });

          mapElement.style.cssText = origStyle;
          mapElement.removeAttribute('data-pdf-light');
          cover.remove();
          await new Promise((r) => setTimeout(r, 100));
        }

        // Build PDF
        const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        let firstPage = true;

        const addPageIfNeeded = () => {
          if (!firstPage) pdf.addPage();
          firstPage = false;
        };

        // ── Map page ──
        if (options.includeMap) {
          addPageIfNeeded();
          const headerH = drawHeader(pdf, pw, options);
          await drawMap(pdf, dataUrl, pw, ph, headerH);
        }

        // ── Summary page ──
        if (options.includeSummary) {
          addPageIfNeeded();
          drawSummaryPage(pdf, pw, ph, data);
        }

        // ── Asset Allocation page ──
        if (options.includeAllocation) {
          addPageIfNeeded();
          drawAllocationPage(pdf, pw, ph, data);
        }

        // ── Flowable sections: Estate + Family, Goals, Relationships, Gaps ──
        // These share pages and flow continuously with auto page breaks.
        {
          let flowY = 0; // 0 means "need a new page"
          const startFlowSection = () => {
            if (flowY === 0) {
              addPageIfNeeded();
              drawAccentBar(pdf, pw);
              flowY = 14;
            } else {
              // Divider between sections on same page
              flowY += 16;
              pdf.setDrawColor(210);
              pdf.setLineWidth(0.2);
              pdf.line(15, flowY, pw - 15, flowY);
              flowY += 20;
            }
          };
          const newFlowPage = () => {
            pdf.addPage();
            firstPage = false;
            drawAccentBar(pdf, pw);
            flowY = 14;
          };
          const ensureRoom = (needed: number) => {
            if (flowY + needed > ph - 15) newFlowPage();
          };

          // Estate + Family grouped together
          if (options.includeEstate && data.estatePlanning.length > 0) {
            const estH = estimateEstateHeight(data);
            startFlowSection();
            ensureRoom(estH);
            flowY = drawEstateSection(pdf, pw, ph, data, flowY);
          }

          if (options.includeFamily && data.familyMembers.length > 0) {
            const famH = estimateFamilyHeight(data);
            startFlowSection();
            ensureRoom(famH);
            flowY = drawFamilySection(pdf, pw, ph, data, flowY);
          }

          if (options.includeGoals && data.goals.length > 0) {
            const goalsH = 25 + data.goals.length * 8;
            startFlowSection();
            ensureRoom(goalsH);
            flowY = drawGoalsSection(pdf, pw, ph, data, flowY);
          }

          if (options.includeRelationships && data.relationships.length > 0) {
            const relsH = 25 + data.relationships.length * 8;
            startFlowSection();
            ensureRoom(relsH);
            flowY = drawRelationshipsSection(pdf, pw, ph, data, flowY);
          }

          if (options.includeGaps && data.dataGaps.length > 0) {
            const gapsH = 22 + data.dataGaps.length * 9;
            startFlowSection();
            ensureRoom(gapsH);
            flowY = drawGapsSection(pdf, pw, ph, data, flowY);
          }
        }

        // ── Footers ──
        const pages = pdf.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(7.5);
          pdf.setTextColor(180);
          pdf.text(
            `Generated by MindPlan  \u2022  ${new Date().toLocaleDateString('en-AU')}  \u2022  Page ${i} of ${pages}`,
            pw / 2, ph - 5, { align: 'center' },
          );
        }

        const safeName = options.preparedFor
          ? `${options.preparedFor.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}-structure.pdf`
          : 'financial-structure.pdf';
        pdf.save(safeName);
      } finally {
        setExporting(false);
        // Ensure container is always restored even if capture fails
        if (mapElement) {
          mapElement.removeAttribute('data-pdf-light');
          // If styles still show the capture sizing, restore to normal
          if (mapElement.style.zIndex === '99999') {
            mapElement.style.cssText = '';
          }
        }
        // Remove cover overlay if still present
        document.querySelector('[style*="z-index: 99998"]')?.remove();
      }
    },
    [],
  );

  return { exportPdf, exporting };
}

// ── Helpers ──

/** Compute row height based on the tallest wrapped cell.
 *  Takes an array of { text, fontSize, maxWidth } for each cell that may wrap.
 *  Returns the max row height (at least baseH). */
function dynamicRowH(
  pdf: jsPDF,
  cells: { text: string; fontSize: number; maxWidth: number }[],
  baseH: number,
): number {
  let maxLines = 1;
  for (const cell of cells) {
    if (!cell.text) continue;
    pdf.setFontSize(cell.fontSize);
    const lines = pdf.splitTextToSize(cell.text, cell.maxWidth);
    if (lines.length > maxLines) maxLines = lines.length;
  }
  if (maxLines <= 1) return baseH;
  // ~3.5mm per extra line of text
  return baseH + (maxLines - 1) * 3.5;
}

function drawHeader(pdf: jsPDF, pw: number, options: ExportOptions): number {
  const m = 12;
  let y = 12;

  // Gradient-ish accent bar (blue → purple)
  pdf.setFillColor(...BLUE);
  pdf.rect(0, 0, pw * 0.6, 2.5, 'F');
  pdf.setFillColor(...PURPLE);
  pdf.rect(pw * 0.6, 0, pw * 0.4, 2.5, 'F');

  y = 12;
  pdf.setFontSize(18);
  pdf.setTextColor(30);
  pdf.setFont('helvetica', 'bold');
  pdf.text(options.title || 'Legacy Wealth Blueprint', m, y);
  y += 6;

  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(130);
  const parts: string[] = [];
  if (options.preparedFor) parts.push(`Prepared for ${options.preparedFor}`);
  if (options.preparedBy) parts.push(`By ${options.preparedBy}`);
  parts.push(new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }));
  pdf.text(parts.join('  \u2022  '), m, y);
  y += 3;

  pdf.setDrawColor(230);
  pdf.setLineWidth(0.2);
  pdf.line(m, y, pw - m, y);

  return y + 2;
}

async function drawMap(pdf: jsPDF, dataUrl: string, pw: number, ph: number, startY: number) {
  const img = new Image();
  img.src = dataUrl;
  await new Promise((r) => { img.onload = r; });

  const m = 5; // tight margins
  const availW = pw - m * 2;
  const availH = ph - startY - 10;

  const ratio = img.width / img.height;
  let w = availW;
  let h = w / ratio;
  if (h > availH) { h = availH; w = h * ratio; }

  const x = (pw - w) / 2;
  pdf.addImage(dataUrl, 'JPEG', x, startY, w, h);
}

// ── Summary Page ──

function drawSummaryPage(pdf: jsPDF, pw: number, ph: number, data: FinancialPlan) {
  const m = 15;
  let y = 10;

  // Accent bar
  pdf.setFillColor(...BLUE);
  pdf.rect(0, 0, pw * 0.6, 2, 'F');
  pdf.setFillColor(...PURPLE);
  pdf.rect(pw * 0.6, 0, pw * 0.4, 2, 'F');

  y = 14;
  pdf.setFontSize(15);
  pdf.setTextColor(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Financial Summary', m, y);
  y += 10;

  const nw = netWorth(data);
  const ta = totalAssets(data);
  const tl = totalLiabilities(data);

  // ── Three metric cards ──
  const cardW = (pw - m * 2 - 8) / 3;
  const cardH = 28;
  const nwColor = nw >= 0 ? EMERALD : RED;
  const cards: { label: string; value: string; color: readonly [number, number, number]; accent: string }[] = [
    { label: 'Net Worth', value: formatAUD(nw), color: nwColor, accent: nw >= 0 ? '#10b981' : '#ef4444' },
    { label: 'Total Assets', value: formatAUD(ta), color: BLUE, accent: '#3b82f6' },
    { label: 'Total Liabilities', value: formatAUD(tl), color: RED, accent: '#ef4444' },
  ];

  cards.forEach((card, i) => {
    const cx = m + i * (cardW + 4);

    // Card bg
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');

    // Left accent bar
    pdf.setFillColor(...card.color);
    pdf.rect(cx, y + 3, 1, cardH - 6, 'F');

    // Label
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.setFont('helvetica', 'normal');
    pdf.text(card.label.toUpperCase(), cx + 6, y + 9);

    // Value
    pdf.setFontSize(16);
    pdf.setTextColor(30);
    pdf.setFont('helvetica', 'bold');
    pdf.text(card.value, cx + 6, y + 20);
  });

  y += cardH + 8;

  // ── Client info ──
  if (data.clients.length > 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(50);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Clients', m, y);
    y += 5;

    data.clients.forEach((client) => {
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(m, y, pw - m * 2, 10, 1.5, 1.5, 'F');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(40);
      pdf.text(client.name, m + 4, y + 6.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(110);
      const info: string[] = [];
      if (client.age) info.push(`Age ${client.age}`);
      if (client.occupation) info.push(client.occupation);
      if (client.income) info.push(`Income ${formatAUD(client.income)}`);
      pdf.text(info.join('  \u2022  '), m + Math.min(60, pw * 0.2), y + 6.5);
      y += 12;
    });

    y += 8;
  }

  // ── Entity Breakdown Table ──
  if (data.entities.length > 0 || data.personalAssets.length > 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(50);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Entity Breakdown', m, y);
    y += 6;

    // Table header — columns scale to page width
    const tableW = pw - m * 2;
    const colX = {
      name: m + 4,
      type: m + tableW * 0.32,
      assets: m + tableW * 0.48,
      liab: m + tableW * 0.65,
      equity: m + tableW * 0.82,
    };

    pdf.setFillColor(241, 245, 249); // slate-100
    pdf.roundedRect(m, y - 3, pw - m * 2, 8, 1.5, 1.5, 'F');

    pdf.setFontSize(7);
    pdf.setTextColor(100);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ENTITY', colX.name, y + 2);
    pdf.text('TYPE', colX.type, y + 2);
    pdf.text('ASSETS', colX.assets, y + 2);
    pdf.text('LIABILITIES', colX.liab, y + 2);
    pdf.text('NET EQUITY', colX.equity, y + 2);
    y += 9;

    // Rows
    const rows: { name: string; type: string; assets: number; liab: number }[] = [];
    for (const entity of data.entities) {
      rows.push({
        name: entity.name,
        type: entity.type.toUpperCase(),
        assets: entity.assets.reduce((s, a) => s + (a.value ?? 0), 0),
        liab: entity.liabilities.reduce((s, l) => s + (l.amount ?? 0), 0),
      });
    }
    if (data.personalAssets.length > 0 || data.personalLiabilities.length > 0) {
      rows.push({
        name: 'Personal',
        type: '\u2014',
        assets: personalAssetsForCalc(data).reduce((s, a) => s + (a.value ?? 0), 0),
        liab: data.personalLiabilities.reduce((s, l) => s + (l.amount ?? 0), 0),
      });
    }

    rows.forEach((row, i) => {
      const rowH = dynamicRowH(pdf, [
        { text: row.name, fontSize: 8.5, maxWidth: tableW * 0.27 },
      ], 8);

      if (i % 2 === 0) {
        pdf.setFillColor(252, 252, 253);
        pdf.rect(m, y - 3.5, pw - m * 2, rowH, 'F');
      }

      const equity = row.assets - row.liab;

      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(40);
      pdf.text(row.name, colX.name, y + 1, { maxWidth: tableW * 0.27 });

      pdf.setTextColor(120);
      pdf.setFontSize(7.5);
      pdf.text(row.type, colX.type, y + 1);

      pdf.setFontSize(8.5);
      pdf.setTextColor(40);
      pdf.text(formatAUD(row.assets), colX.assets, y + 1);

      pdf.setTextColor(row.liab > 0 ? 100 : 180);
      pdf.text(formatAUD(row.liab), colX.liab, y + 1);

      // Equity with color
      pdf.setFont('helvetica', 'bold');
      if (equity >= 0) {
        pdf.setTextColor(16, 185, 129); // emerald
      } else {
        pdf.setTextColor(239, 68, 68); // red
      }
      pdf.text(formatAUD(equity), colX.equity, y + 1);
      pdf.setFont('helvetica', 'normal');

      y += rowH;
    });

    // Total row
    y += 1;
    pdf.setDrawColor(200);
    pdf.setLineWidth(0.3);
    pdf.line(m + 4, y - 3, pw - m - 4, y - 3);
    y += 2;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30);
    pdf.text('Total', colX.name, y);
    pdf.text(formatAUD(ta), colX.assets, y);
    pdf.setTextColor(100);
    pdf.text(formatAUD(tl), colX.liab, y);
    if (nw >= 0) {
      pdf.setTextColor(16, 185, 129);
    } else {
      pdf.setTextColor(239, 68, 68);
    }
    pdf.text(formatAUD(nw), colX.equity, y);
  }
}

// ── Gaps Page ──

function drawGapsSection(pdf: jsPDF, pw: number, ph: number, data: FinancialPlan, startY: number): number {
  const m = 15;
  let y = startY;

  pdf.setFontSize(13);
  pdf.setTextColor(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Information Needed', m, y);
  y += 4;

  pdf.setFontSize(8);
  pdf.setTextColor(130);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${data.dataGaps.length} items require attention`, m, y);
  y += 6;

  data.dataGaps.forEach((gap, i) => {
    const rowH = dynamicRowH(pdf, [
      { text: gap.description, fontSize: 8.5, maxWidth: pw - m * 2 - 14 },
    ], 9);

    if (y + rowH > ph - 20) {
      pdf.addPage();
      drawAccentBar(pdf, pw);
      y = 14;
    }

    if (i % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(m, y - 3, pw - m * 2, rowH, 1, 1, 'F');
    }

    pdf.setFillColor(...BLUE);
    pdf.circle(m + 3, y + 1, 2.5, 'F');
    pdf.setFontSize(6);
    pdf.setTextColor(255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(i + 1), m + 3, y + 2, { align: 'center' });

    pdf.setFontSize(8.5);
    pdf.setTextColor(50);
    pdf.setFont('helvetica', 'normal');
    pdf.text(gap.description, m + 10, y + 1.5, { maxWidth: pw - m * 2 - 14 });

    y += rowH;
  });

  return y + 2;
}

// ── Asset Allocation Page ──

const PIE_COLORS: readonly (readonly [number, number, number])[] = [
  [16, 185, 129],  // emerald — Property
  [59, 130, 246],  // blue — Shares
  [245, 158, 11],  // amber — Cash / Super
  [168, 85, 247],  // purple
  [239, 68, 68],   // red
  [6, 182, 212],   // cyan
  [100, 116, 139], // slate
];

function drawAllocationPage(pdf: jsPDF, pw: number, _ph: number, data: FinancialPlan) {
  const m = 15;
  let y = 10;

  // Accent bar
  pdf.setFillColor(...BLUE);
  pdf.rect(0, 0, pw * 0.6, 2, 'F');
  pdf.setFillColor(...PURPLE);
  pdf.rect(pw * 0.6, 0, pw * 0.4, 2, 'F');

  y = 14;
  pdf.setFontSize(15);
  pdf.setTextColor(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Asset Allocation', m, y);
  y += 10;

  const items = assetAllocationDetailed(data);
  if (items.length === 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(130);
    pdf.setFont('helvetica', 'normal');
    pdf.text('No asset data available.', m, y);
    return;
  }

  const total = items.reduce((s, a) => s + a.value, 0);

  // Draw pie chart
  const cx = pw * 0.3;
  const cy = y + 40;
  const radius = 30;

  let startAngle = -Math.PI / 2;
  items.forEach((item, i) => {
    const sliceAngle = (item.pct / 100) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const color = PIE_COLORS[i % PIE_COLORS.length];

    // Draw filled wedge as a triangle fan
    pdf.setFillColor(...color);
    const steps = Math.max(20, Math.ceil(sliceAngle / 0.1));
    for (let s = 0; s < steps; s++) {
      const a1 = startAngle + (s / steps) * sliceAngle;
      const a2 = startAngle + ((s + 1) / steps) * sliceAngle;
      pdf.triangle(
        cx, cy,
        cx + radius * Math.cos(a1), cy + radius * Math.sin(a1),
        cx + radius * Math.cos(a2), cy + radius * Math.sin(a2),
        'F',
      );
    }

    startAngle = endAngle;
  });

  // Legend — to the right of pie
  const legendX = pw * 0.55;
  let legendY = y + 15;

  items.forEach((item, i) => {
    const color = PIE_COLORS[i % PIE_COLORS.length];

    // Color square
    pdf.setFillColor(...color);
    pdf.rect(legendX, legendY - 2.5, 4, 4, 'F');

    // Group name
    pdf.setFontSize(9);
    pdf.setTextColor(40);
    pdf.setFont('helvetica', 'bold');
    pdf.text(item.group, legendX + 7, legendY + 0.5);

    // Value + percentage
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100);
    pdf.text(`${formatAUD(item.value)}  (${item.pct}%)`, legendX + 7, legendY + 5);

    legendY += 12;
  });

  // Stacked bar below pie
  y = cy + radius + 15;
  pdf.setFontSize(9);
  pdf.setTextColor(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Distribution', m, y);
  y += 5;

  const barW = pw - m * 2;
  const barH = 8;
  let barX = m;

  items.forEach((item, i) => {
    const w = (item.pct / 100) * barW;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    pdf.setFillColor(...color);
    pdf.rect(barX, y, Math.max(w, 0.5), barH, 'F');
    barX += w;
  });

  // Total
  y += barH + 6;
  pdf.setFontSize(8.5);
  pdf.setTextColor(100);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Total assets: ${formatAUD(total)}`, m, y);
}

// ── Accent bar helper for flowing pages ──

function drawAccentBar(pdf: jsPDF, pw: number) {
  pdf.setFillColor(...BLUE);
  pdf.rect(0, 0, pw * 0.6, 2, 'F');
  pdf.setFillColor(...PURPLE);
  pdf.rect(pw * 0.6, 0, pw * 0.4, 2, 'F');
}

// ── Estate Planning Section ──

const ESTATE_TYPE_LABELS: Record<string, string> = {
  will: 'Will',
  poa: 'POA',
  guardianship: 'Guardianship',
  super_nomination: 'Super Nom.',
};

const STATUS_COLORS: Record<string, readonly [number, number, number]> = {
  current: [16, 185, 129],       // emerald
  expired: [239, 68, 68],         // red
  not_established: [100, 116, 139], // slate
};

function estimateEstateHeight(data: FinancialPlan): number {
  return 22 + data.clients.length * 20 + 8;
}

function drawEstateSection(pdf: jsPDF, pw: number, _ph: number, data: FinancialPlan, startY: number): number {
  const m = 15;
  let y = startY;

  pdf.setFontSize(13);
  pdf.setTextColor(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Estate Planning', m, y);
  y += 8;

  const types = ['will', 'poa', 'guardianship', 'super_nomination'] as const;
  const colW = (pw - m * 2 - 50) / types.length;
  const nameColW = 50;

  // Table header
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(m, y - 3, pw - m * 2, 8, 1.5, 1.5, 'F');

  pdf.setFontSize(7);
  pdf.setTextColor(100);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CLIENT', m + 4, y + 2);
  types.forEach((type, i) => {
    pdf.text(ESTATE_TYPE_LABELS[type].toUpperCase(), m + nameColW + i * colW + 2, y + 2);
  });
  y += 9;

  // One row per client
  const rowH = 18;
  data.clients.forEach((client) => {
    pdf.setFillColor(252, 252, 253);
    pdf.roundedRect(m, y - 4, pw - m * 2, rowH, 1, 1, 'F');

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(40);
    pdf.text(client.name, m + 4, y + 2);

    types.forEach((type, i) => {
      // For super nominations there may be multiple — collect all
      const items = data.estatePlanning.filter(
        (e) => e.clientId === client.id && e.type === type,
      );
      const item = items[0];
      const cellX = m + nameColW + i * colW;
      const cellW = colW - 2;

      if (item) {
        const status = item.status ?? 'not_established';
        const color = STATUS_COLORS[status] ?? SLATE;
        const cellBg = lighten(color, 0.85);
        pdf.setFillColor(...cellBg);
        pdf.roundedRect(cellX, y - 3, cellW, rowH - 2, 1, 1, 'F');

        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...color);
        const statusLabel = status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        pdf.text(statusLabel, cellX + 2, y + 1);

        // Build detail text from people or details
        pdf.setFontSize(5.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120);

        if (type === 'super_nomination' && items.length > 0) {
          // Collect unique beneficiaries across all fund nominations
          const beneficiaries = new Set<string>();
          for (const it of items) {
            if (it.primaryPerson) beneficiaries.add(it.primaryPerson);
            if (it.alternatePeople) it.alternatePeople.forEach((p) => beneficiaries.add(p));
          }
          if (beneficiaries.size > 0) {
            pdf.text(`${beneficiaries.size} nominations`, cellX + 2, y + 5, { maxWidth: cellW - 4 });
          }
          const isBinding = items.some((it) => it.details?.toLowerCase().includes('binding'));
          const nomType = isBinding ? 'Binding' : 'Non-binding';
          pdf.text(nomType, cellX + 2, y + (beneficiaries.size > 0 ? 8.5 : 5), { maxWidth: cellW - 4 });
        } else {
          // Show all people (primaryPerson + alternatePeople)
          const people: string[] = [];
          if (item.primaryPerson) people.push(item.primaryPerson);
          if (item.alternatePeople) people.push(...item.alternatePeople);
          if (people.length > 0) {
            pdf.text(people.join(', '), cellX + 2, y + 5, { maxWidth: cellW - 4 });
          }
        }
      } else {
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(cellX, y - 3, cellW, rowH - 2, 1, 1, 'F');
        pdf.setFontSize(7);
        pdf.setTextColor(180);
        pdf.setFont('helvetica', 'normal');
        pdf.text('N/A', cellX + 2, y + 2);
      }
    });

    y += rowH + 2;
  });

  y += 2;
  const issues = data.estatePlanning.filter((e) => e.hasIssue).length;
  const current = data.estatePlanning.filter((e) => e.status === 'current').length;

  pdf.setFontSize(8);
  pdf.setTextColor(130);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${current} current  \u2022  ${issues} requiring attention  \u2022  ${data.estatePlanning.length} total documents`, m, y);

  return y + 4;
}

// ── Family Tree Page ──

/** Lighten a colour toward white: mix = 0 is full colour, 1 is white */
function lighten(c: readonly [number, number, number], mix: number): [number, number, number] {
  return [
    Math.round(c[0] + (255 - c[0]) * mix),
    Math.round(c[1] + (255 - c[1]) * mix),
    Math.round(c[2] + (255 - c[2]) * mix),
  ];
}

const AMBER = [245, 158, 11] as const;

function estimateFamilyHeight(data: FinancialPlan): number {
  const hasGrandchildren = data.familyMembers.some((m) => m.children.length > 0);
  const levels = 1 + (data.familyMembers.length > 0 ? 1 : 0) + (hasGrandchildren ? 1 : 0);
  return 12 + levels * 38; // title + levels * (box + gap + connecting lines)
}

function drawFamilySection(pdf: jsPDF, pw: number, _ph: number, data: FinancialPlan, startY: number): number {
  const m = 15;
  let y = startY;

  pdf.setFontSize(13);
  pdf.setTextColor(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Family', m, y);
  y += 10;

  // Base dimensions (before scaling)
  const BASE_BOX_W = 55;
  const BASE_BOX_H = 20;
  const BASE_GAP_X = 10;
  const BASE_GAP_Y = 18;
  const BASE_GC_BOX_W = 48;
  const BASE_GC_BOX_H = 16;
  const BASE_GC_GAP_X = 6;

  // Pre-compute total width needed at full size to determine scale factor
  const availW = pw - m * 2;
  const childCount = data.familyMembers.length;

  let scale = 1;
  if (childCount > 0) {
    const fullFootprints = data.familyMembers.map((member) => {
      const gcCount = member.children.length;
      if (gcCount === 0) return BASE_BOX_W;
      const gcSpread = gcCount * BASE_GC_BOX_W + (gcCount - 1) * BASE_GC_GAP_X;
      return Math.max(BASE_BOX_W, gcSpread);
    });
    const fullW = fullFootprints.reduce((s, f) => s + f, 0) + (childCount - 1) * BASE_GAP_X;
    if (fullW > availW) {
      scale = availW / fullW;
    }
  }

  // Scaled dimensions
  const boxW = BASE_BOX_W * scale;
  const boxH = BASE_BOX_H * scale;
  const gapX = BASE_GAP_X * scale;
  const gapY = BASE_GAP_Y * scale;
  const gcBoxW = BASE_GC_BOX_W * scale;
  const gcBoxH = BASE_GC_BOX_H * scale;
  const gcGapX = BASE_GC_GAP_X * scale;

  // Scale font sizes (clamp to minimum readability)
  const nameFontSize = Math.max(5.5, 8 * scale);
  const subtitleFontSize = Math.max(4.5, 6.5 * scale);
  const partnerFontSize = Math.max(4.5, 6.5 * scale);

  // ── Level 1: Clients ──
  const clientCount = data.clients.length;
  const clientsTotalW = clientCount * boxW + (clientCount - 1) * gapX;
  const clientsStartX = (pw - clientsTotalW) / 2;

  data.clients.forEach((client, i) => {
    const x = clientsStartX + i * (boxW + gapX);
    drawPersonBox(pdf, x, y, boxW, boxH, client.name, client.age, client.occupation, BLUE, nameFontSize, subtitleFontSize);
  });

  const clientCenterY = y + boxH;
  y += boxH + gapY;

  // ── Level 2: Children ──
  if (data.familyMembers.length === 0) return y;

  // Pre-compute each child's "footprint" — the wider of the child box or its grandchildren spread
  const footprints = data.familyMembers.map((member) => {
    const gcCount = member.children.length;
    if (gcCount === 0) return boxW;
    const gcSpread = gcCount * gcBoxW + (gcCount - 1) * gcGapX;
    return Math.max(boxW, gcSpread);
  });
  const childTotalW = footprints.reduce((s, f) => s + f, 0) + (childCount - 1) * gapX;
  const childStartX = (pw - childTotalW) / 2;

  // Cumulative offsets: each child's center X is at the middle of its footprint
  const childCenters: number[] = [];
  let cumX = childStartX;
  footprints.forEach((fp) => {
    childCenters.push(cumX + fp / 2);
    cumX += fp + gapX;
  });

  // Connecting line from clients center down to T-junction
  const parentCenterX = pw / 2;
  const junctionY = y - gapY / 2;
  pdf.setDrawColor(190);
  pdf.setLineWidth(0.4);
  pdf.line(parentCenterX, clientCenterY, parentCenterX, junctionY);

  // Horizontal line across children
  if (childCount > 1) {
    pdf.line(childCenters[0], junctionY, childCenters[childCount - 1], junctionY);
  }

  let maxY = y + boxH; // Track bottom-most element for return value

  data.familyMembers.forEach((member, i) => {
    const cx = childCenters[i];
    const x = cx - boxW / 2;
    maxY = Math.max(maxY, y + boxH);

    // Vertical line down to child box
    pdf.setDrawColor(190);
    pdf.setLineWidth(0.4);
    pdf.line(cx, junctionY, cx, y);

    const relationship = member.relationship === 'son' ? 'Son' : member.relationship === 'daughter' ? 'Daughter' : member.relationship;
    const subtitle = [member.age ? `Age ${member.age}` : null, relationship].filter(Boolean).join(' \u2022 ');
    const color = member.isDependant ? AMBER : EMERALD;
    drawPersonBox(pdf, x, y, boxW, boxH, member.name, null, subtitle, color, nameFontSize, subtitleFontSize);

    // Partner name below box
    if (member.partner) {
      pdf.setFontSize(partnerFontSize);
      pdf.setTextColor(130);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Partner: ${member.partner}`, x + 3 * scale, y + boxH + 4 * scale);
    }

    // ── Level 3: Grandchildren ──
    if (member.children.length > 0) {
      const gcY = y + boxH + (member.partner ? 10 * scale : 6 * scale) + gapY;
      const gcCount = member.children.length;
      const gcTotalW = gcCount * gcBoxW + (gcCount - 1) * gcGapX;
      const gcStartX = cx - gcTotalW / 2;
      const gcJunctionY = gcY - 4 * scale;

      // Line down from parent
      pdf.setDrawColor(190);
      pdf.setLineWidth(0.4);
      pdf.line(cx, y + boxH, cx, gcJunctionY);

      // Horizontal line across grandchildren
      if (gcCount > 1) {
        const firstGcCx = gcStartX + gcBoxW / 2;
        const lastGcCx = gcStartX + (gcCount - 1) * (gcBoxW + gcGapX) + gcBoxW / 2;
        pdf.line(firstGcCx, gcJunctionY, lastGcCx, gcJunctionY);
      }

      member.children.forEach((gc, j) => {
        const gcX = gcStartX + j * (gcBoxW + gcGapX);
        const gcCx = gcX + gcBoxW / 2;

        // Drop line to grandchild
        pdf.line(gcCx, gcJunctionY, gcCx, gcY);

        const gcRelation = gc.relationship === 'grandson' ? 'Grandson' : 'Granddaughter';
        const gcSub = [gc.age ? `Age ${gc.age}` : null, gcRelation].filter(Boolean).join(' \u2022 ');
        drawPersonBox(pdf, gcX, gcY, gcBoxW, gcBoxH, gc.name, null, gcSub, SLATE, nameFontSize, subtitleFontSize);
        maxY = Math.max(maxY, gcY + gcBoxH);
      });
    }
  });

  return maxY + 4;
}

// ── Goals Section ──

const GOAL_CATEGORY_LABELS: Record<string, string> = {
  retirement: 'Retirement',
  wealth: 'Wealth',
  protection: 'Protection',
  estate: 'Estate',
  lifestyle: 'Lifestyle',
  education: 'Education',
  other: 'Other',
};

function drawGoalsSection(pdf: jsPDF, pw: number, ph: number, data: FinancialPlan, startY: number): number {
  const m = 15;
  let y = startY;

  pdf.setFontSize(13);
  pdf.setTextColor(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Goals & Objectives', m, y);
  y += 4;

  pdf.setFontSize(8);
  pdf.setTextColor(130);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${data.goals.length} goals identified`, m, y);
  y += 6;

  const tableW = pw - m * 2;
  const colX = {
    name: m + 4,
    category: m + tableW * 0.40,
    timeframe: m + tableW * 0.58,
    value: m + tableW * 0.78,
  };

  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(m, y - 3, tableW, 8, 1.5, 1.5, 'F');

  pdf.setFontSize(7);
  pdf.setTextColor(100);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GOAL', colX.name, y + 2);
  pdf.text('CATEGORY', colX.category, y + 2);
  pdf.text('TIMEFRAME', colX.timeframe, y + 2);
  pdf.text('TARGET VALUE', colX.value, y + 2);
  y += 9;

  data.goals.forEach((goal, i) => {
    const rowH = dynamicRowH(pdf, [
      { text: goal.name, fontSize: 8.5, maxWidth: tableW * 0.34 },
    ], 8);

    if (y + rowH > ph - 20) {
      pdf.addPage();
      drawAccentBar(pdf, pw);
      y = 14;
    }

    if (i % 2 === 0) {
      pdf.setFillColor(252, 252, 253);
      pdf.rect(m, y - 3.5, tableW, rowH, 'F');
    }

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(40);
    pdf.text(goal.name, colX.name, y + 1, { maxWidth: tableW * 0.34 });

    const catLabel = GOAL_CATEGORY_LABELS[goal.category] ?? goal.category;
    const catBg = lighten(TEAL, 0.85);
    const catW = pdf.getTextWidth(catLabel) + 4;
    pdf.setFillColor(...catBg);
    pdf.roundedRect(colX.category, y - 2.5, catW, 6, 1, 1, 'F');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...TEAL);
    pdf.setFont('helvetica', 'bold');
    pdf.text(catLabel, colX.category + 2, y + 1.5);

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100);
    pdf.text(goal.timeframe ?? '\u2014', colX.timeframe, y + 1);

    pdf.setTextColor(40);
    pdf.text(goal.value ? formatAUD(goal.value) : '\u2014', colX.value, y + 1);

    y += rowH;
  });

  return y + 2;
}

// ── Relationships Section ──

const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  accountant: 'Accountant',
  financial_adviser: 'Financial Adviser',
  stockbroker: 'Stockbroker',
  solicitor: 'Solicitor',
  insurance_adviser: 'Insurance Adviser',
  mortgage_broker: 'Mortgage Broker',
  other: 'Other',
};

function drawRelationshipsSection(pdf: jsPDF, pw: number, ph: number, data: FinancialPlan, startY: number): number {
  const m = 15;
  let y = startY;

  pdf.setFontSize(13);
  pdf.setTextColor(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Professional Advisers', m, y);
  y += 4;

  pdf.setFontSize(8);
  pdf.setTextColor(130);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${data.relationships.length} professional relationships`, m, y);
  y += 6;

  const tableW = pw - m * 2;
  const colX = {
    type: m + 4,
    contact: m + tableW * 0.25,
    firm: m + tableW * 0.50,
    notes: m + tableW * 0.75,
  };

  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(m, y - 3, tableW, 8, 1.5, 1.5, 'F');

  pdf.setFontSize(7);
  pdf.setTextColor(100);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TYPE', colX.type, y + 2);
  pdf.text('CONTACT', colX.contact, y + 2);
  pdf.text('FIRM', colX.firm, y + 2);
  pdf.text('NOTES', colX.notes, y + 2);
  y += 9;

  data.relationships.forEach((rel, i) => {
    const rowH = dynamicRowH(pdf, [
      { text: rel.firmName ?? '', fontSize: 8.5, maxWidth: tableW * 0.22 },
      { text: rel.notes ?? '', fontSize: 7.5, maxWidth: tableW * 0.22 },
    ], 8);

    if (y + rowH > ph - 20) {
      pdf.addPage();
      drawAccentBar(pdf, pw);
      y = 14;
    }

    if (i % 2 === 0) {
      pdf.setFillColor(252, 252, 253);
      pdf.rect(m, y - 3.5, tableW, rowH, 'F');
    }

    const typeLabel = RELATIONSHIP_TYPE_LABELS[rel.type] ?? rel.type;
    const typeBg = lighten(ROSE, 0.85);
    const typeW = pdf.getTextWidth(typeLabel) + 4;
    pdf.setFillColor(...typeBg);
    pdf.roundedRect(colX.type, y - 2.5, typeW, 6, 1, 1, 'F');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...ROSE);
    pdf.setFont('helvetica', 'bold');
    pdf.text(typeLabel, colX.type + 2, y + 1.5);

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(40);
    pdf.text(rel.contactName ?? '\u2014', colX.contact, y + 1);

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(40);
    pdf.text(rel.firmName ?? '\u2014', colX.firm, y + 1, { maxWidth: tableW * 0.22 });

    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100);
    pdf.text(rel.notes ?? '\u2014', colX.notes, y + 1, { maxWidth: tableW * 0.22 });

    y += rowH;
  });

  return y + 2;
}

function drawPersonBox(
  pdf: jsPDF, x: number, y: number, w: number, h: number,
  name: string, age: number | null, subtitle: string | null,
  color: readonly [number, number, number],
  nameFs = 8, subtitleFs = 6.5,
) {
  const pad = Math.max(2, w * 0.05);
  const r = Math.min(2, w * 0.04);

  // Light tinted background (no opacity — much more reliable)
  const bg = lighten(color, 0.88);
  pdf.setFillColor(...bg);
  pdf.roundedRect(x, y, w, h, r, r, 'F');

  // Border in full colour
  pdf.setDrawColor(color[0], color[1], color[2]);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(x, y, w, h, r, r, 'S');

  // Name
  pdf.setFontSize(nameFs);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(40);
  const nameStr = age ? `${name}, ${age}` : name;
  pdf.text(nameStr, x + pad, y + h * 0.35, { maxWidth: w - pad * 2 });

  // Subtitle
  if (subtitle) {
    pdf.setFontSize(subtitleFs);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120);
    pdf.text(subtitle, x + pad, y + h * 0.6, { maxWidth: w - pad * 2 });
  }
}
