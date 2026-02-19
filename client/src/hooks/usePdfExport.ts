import { useCallback, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { FinancialPlan } from 'shared/types';
import type { ExportOptions } from '../components/export/ExportModal';
import type { MindMapHandle } from '../components/mindmap/MindMap';
import {
  netWorth, totalAssets, totalLiabilities, entityEquity, formatAUD,
  assetAllocationDetailed,
} from '../utils/calculations';

// ── Brand colours ──
const BLUE = [59, 130, 246] as const;   // #3b82f6
const PURPLE = [168, 85, 247] as const; // #a855f7
const EMERALD = [16, 185, 129] as const;
const RED = [239, 68, 68] as const;
const SLATE = [100, 116, 139] as const;

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

        // ── Estate Planning page ──
        if (options.includeEstate && data.estatePlanning.length > 0) {
          addPageIfNeeded();
          drawEstatePage(pdf, pw, ph, data);
        }

        // ── Family Tree page ──
        if (options.includeFamily && data.familyMembers.length > 0) {
          addPageIfNeeded();
          drawFamilyPage(pdf, pw, ph, data);
        }

        // ── Gaps page ──
        if (options.includeGaps && data.dataGaps.length > 0) {
          addPageIfNeeded();
          drawGapsPage(pdf, pw, ph, data);
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
  pdf.text(options.title || 'Financial Structure Map', m, y);
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
      if (client.superBalance) info.push(`Super ${formatAUD(client.superBalance)}`);
      pdf.text(info.join('  \u2022  '), m + Math.min(60, pw * 0.2), y + 6.5);
      y += 12;
    });

    y += 4;
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
        assets: data.personalAssets.reduce((s, a) => s + (a.value ?? 0), 0),
        liab: data.personalLiabilities.reduce((s, l) => s + (l.amount ?? 0), 0),
      });
    }

    rows.forEach((row, i) => {
      if (i % 2 === 0) {
        pdf.setFillColor(252, 252, 253);
        pdf.rect(m, y - 3.5, pw - m * 2, 8, 'F');
      }

      const equity = row.assets - row.liab;

      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(40);
      pdf.text(row.name, colX.name, y + 1);

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

      y += 8;
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

function drawGapsPage(pdf: jsPDF, pw: number, ph: number, data: FinancialPlan) {
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
  pdf.text('Information Needed', m, y);
  y += 5;

  pdf.setFontSize(8.5);
  pdf.setTextColor(130);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${data.dataGaps.length} items require attention to complete the financial picture`, m, y);
  y += 8;

  data.dataGaps.forEach((gap, i) => {
    if (y > ph - 20) {
      pdf.addPage();
      y = 15;
    }

    // Alternating row background
    if (i % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(m, y - 3, pw - m * 2, 8, 1, 1, 'F');
    }

    // Number badge
    pdf.setFillColor(...BLUE);
    pdf.circle(m + 3, y + 1, 2.5, 'F');
    pdf.setFontSize(6);
    pdf.setTextColor(255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(i + 1), m + 3, y + 2, { align: 'center' });

    // Description
    pdf.setFontSize(8.5);
    pdf.setTextColor(50);
    pdf.setFont('helvetica', 'normal');
    pdf.text(gap.description, m + 10, y + 1.5);

    y += 9;
  });
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

// ── Estate Planning Page ──

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

function drawEstatePage(pdf: jsPDF, pw: number, _ph: number, data: FinancialPlan) {
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
  pdf.text('Estate Planning', m, y);
  y += 10;

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
  data.clients.forEach((client) => {
    // Row background
    pdf.setFillColor(252, 252, 253);
    pdf.roundedRect(m, y - 4, pw - m * 2, 14, 1, 1, 'F');

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(40);
    pdf.text(client.name, m + 4, y + 2);

    types.forEach((type, i) => {
      const item = data.estatePlanning.find(
        (e) => e.clientId === client.id && e.type === type,
      );
      const cellX = m + nameColW + i * colW;
      const cellW = colW - 2;

      if (item) {
        const status = item.status ?? 'not_established';
        const color = STATUS_COLORS[status] ?? SLATE;

        // Cell background (light tint, no opacity)
        const cellBg = lighten(color, 0.85);
        pdf.setFillColor(...cellBg);
        pdf.roundedRect(cellX, y - 3, cellW, 12, 1, 1, 'F');

        // Status text
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...color);
        const statusLabel = status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        pdf.text(statusLabel, cellX + 2, y + 1);

        // Primary person
        if (item.primaryPerson) {
          pdf.setFontSize(6);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(120);
          pdf.text(item.primaryPerson, cellX + 2, y + 5.5);
        }
      } else {
        // Not found — gray
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(cellX, y - 3, cellW, 12, 1, 1, 'F');
        pdf.setFontSize(7);
        pdf.setTextColor(180);
        pdf.setFont('helvetica', 'normal');
        pdf.text('N/A', cellX + 2, y + 2);
      }
    });

    y += 16;
  });

  // Summary count
  y += 4;
  const issues = data.estatePlanning.filter((e) => e.hasIssue).length;
  const current = data.estatePlanning.filter((e) => e.status === 'current').length;

  pdf.setFontSize(8.5);
  pdf.setTextColor(100);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${current} current  •  ${issues} requiring attention  •  ${data.estatePlanning.length} total documents`, m, y);
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

function drawFamilyPage(pdf: jsPDF, pw: number, _ph: number, data: FinancialPlan) {
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
  pdf.text('Family', m, y);
  y += 12;

  const boxW = 55;
  const boxH = 20;
  const gapX = 10;
  const gapY = 18;

  // ── Level 1: Clients ──
  const clientCount = data.clients.length;
  const clientsTotalW = clientCount * boxW + (clientCount - 1) * gapX;
  const clientsStartX = (pw - clientsTotalW) / 2;

  data.clients.forEach((client, i) => {
    const x = clientsStartX + i * (boxW + gapX);
    drawPersonBox(pdf, x, y, boxW, boxH, client.name, client.age, client.occupation, BLUE);
  });

  const clientCenterY = y + boxH;
  y += boxH + gapY;

  // ── Level 2: Children ──
  if (data.familyMembers.length === 0) return;

  const childCount = data.familyMembers.length;
  const childTotalW = childCount * boxW + (childCount - 1) * gapX;
  const childStartX = (pw - childTotalW) / 2;

  // Connecting line from clients center down to T-junction
  const parentCenterX = pw / 2;
  const junctionY = y - gapY / 2;
  pdf.setDrawColor(190);
  pdf.setLineWidth(0.4);
  pdf.line(parentCenterX, clientCenterY, parentCenterX, junctionY);

  // Horizontal line across children
  if (childCount > 1) {
    const firstChildCx = childStartX + boxW / 2;
    const lastChildCx = childStartX + (childCount - 1) * (boxW + gapX) + boxW / 2;
    pdf.line(firstChildCx, junctionY, lastChildCx, junctionY);
  }

  data.familyMembers.forEach((member, i) => {
    const x = childStartX + i * (boxW + gapX);
    const cx = x + boxW / 2;

    // Vertical line down to child box
    pdf.setDrawColor(190);
    pdf.setLineWidth(0.4);
    pdf.line(cx, junctionY, cx, y);

    const relationship = member.relationship === 'son' ? 'Son' : member.relationship === 'daughter' ? 'Daughter' : member.relationship;
    const subtitle = [member.age ? `Age ${member.age}` : null, relationship].filter(Boolean).join(' \u2022 ');
    const color = member.isDependant ? AMBER : EMERALD;
    drawPersonBox(pdf, x, y, boxW, boxH, member.name, null, subtitle, color);

    // Partner name below box
    if (member.partner) {
      pdf.setFontSize(6.5);
      pdf.setTextColor(130);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Partner: ${member.partner}`, x + 3, y + boxH + 4);
    }

    // ── Level 3: Grandchildren ──
    if (member.children.length > 0) {
      const gcY = y + boxH + (member.partner ? 10 : 6) + gapY;
      const gcCount = member.children.length;
      const gcBoxW = 48;
      const gcBoxH = 16;
      const gcGapX = 6;
      const gcTotalW = gcCount * gcBoxW + (gcCount - 1) * gcGapX;
      const gcStartX = cx - gcTotalW / 2;
      const gcJunctionY = gcY - 4;

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
        drawPersonBox(pdf, gcX, gcY, gcBoxW, gcBoxH, gc.name, null, gcSub, SLATE);
      });
    }
  });
}

function drawPersonBox(
  pdf: jsPDF, x: number, y: number, w: number, h: number,
  name: string, age: number | null, subtitle: string | null,
  color: readonly [number, number, number],
) {
  // Light tinted background (no opacity — much more reliable)
  const bg = lighten(color, 0.88);
  pdf.setFillColor(...bg);
  pdf.roundedRect(x, y, w, h, 2, 2, 'F');

  // Border in full colour
  pdf.setDrawColor(color[0], color[1], color[2]);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(x, y, w, h, 2, 2, 'S');

  // Name
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(40);
  const nameStr = age ? `${name}, ${age}` : name;
  pdf.text(nameStr, x + 3, y + 7, { maxWidth: w - 6 });

  // Subtitle
  if (subtitle) {
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120);
    pdf.text(subtitle, x + 3, y + 12, { maxWidth: w - 6 });
  }
}
