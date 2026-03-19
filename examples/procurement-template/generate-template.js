/**
 * Procurement Supplier Management Excel Template Generator
 *
 * Purpose:
 *   - Collect HR procurement supplier directory
 *   - Collect procurement contract performance records
 *   - Understand current procurement processes
 *
 * Goal:
 *   - Unified procurement window (unit price negotiation) and process standardization
 *   - Procurement data visualization
 *   - Reduce overall procurement costs
 *
 * Format: One supplier per sheet
 *
 * Usage:
 *   node generate-template.js
 *
 * Output:
 *   procurement-supplier-template.xlsx
 */

'use strict';

const ExcelJS = require('exceljs');
const path = require('path');

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  // Section header backgrounds
  SECTION_PERF: 'FF4472C4',    // Blue  - 実績情報 (Performance)
  SECTION_SURVEY: 'FF70AD47',  // Green - 調査情報 (Survey)
  SECTION_AUX: 'FFED7D31',     // Orange- 補助情報 (Auxiliary)
  SECTION_GUIDE: 'FF7030A0',   // Purple- Guide sheet

  // Sub-section backgrounds
  SUB_PERF: 'FFD9E1F2',        // Light blue
  SUB_SURVEY: 'FFE2EFDA',      // Light green
  SUB_AUX: 'FFFCE4D6',         // Light orange

  // Label backgrounds
  LABEL_BG: 'FFEFF2F7',        // Very light gray-blue

  // Header text
  WHITE: 'FFFFFFFF',
  DARK: 'FF1F1F1F',

  // Border
  BORDER: 'FFB8C4D8',
};

const FONT_NAME = 'Arial';

// ─── Helper: apply thin border to a cell ─────────────────────────────────────
function applyBorder(cell, color = COLORS.BORDER) {
  const s = { style: 'thin', color: { argb: color } };
  cell.border = { top: s, bottom: s, left: s, right: s };
}

// ─── Helper: merge cells and set shared value/style ──────────────────────────
function mergeAndSet(ws, startRow, startCol, endRow, endCol, value, style = {}) {
  ws.mergeCells(startRow, startCol, endRow, endCol);
  const cell = ws.getCell(startRow, startCol);
  cell.value = value;
  if (style.font)      cell.font      = style.font;
  if (style.fill)      cell.fill      = style.fill;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border !== false) applyBorder(cell);
  return cell;
}

// ─── Helper: set a label cell ─────────────────────────────────────────────────
function setLabel(ws, row, col, text, bgColor = COLORS.LABEL_BG) {
  const cell = ws.getCell(row, col);
  cell.value = text;
  cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLORS.DARK } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  applyBorder(cell);
  return cell;
}

// ─── Helper: set an input cell ────────────────────────────────────────────────
function setInput(ws, row, col, placeholder = '') {
  const cell = ws.getCell(row, col);
  cell.value = placeholder;
  cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF666666' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  applyBorder(cell);
  return cell;
}

// ─── Helper: section header spanning full width ───────────────────────────────
function sectionHeader(ws, row, label, color, totalCols = 8) {
  ws.mergeCells(row, 1, row, totalCols);
  const cell = ws.getCell(row, 1);
  cell.value = label;
  cell.font  = { name: FONT_NAME, size: 12, bold: true, color: { argb: COLORS.WHITE } };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(row).height = 28;
  applyBorder(cell);
}

// ─── Helper: sub-section header ───────────────────────────────────────────────
function subSectionHeader(ws, row, label, color, totalCols = 8) {
  ws.mergeCells(row, 1, row, totalCols);
  const cell = ws.getCell(row, 1);
  cell.value = `  ${label}`;
  cell.font  = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLORS.DARK } };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(row).height = 22;
  applyBorder(cell);
}

// ─── Build one supplier sheet ─────────────────────────────────────────────────
function buildSupplierSheet(workbook, supplierName, isTemplate = false) {
  const ws = workbook.addWorksheet(supplierName);

  // Column widths  (A=1 … H=8)
  // A: Category label, B: Sub-category, C-D: Field label, E-H: Input area
  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 20;
  ws.getColumn(6).width = 20;
  ws.getColumn(7).width = 20;
  ws.getColumn(8).width = 20;

  let r = 1; // current row pointer

  // ── Supplier title row ────────────────────────────────────────────────────
  ws.mergeCells(r, 1, r, 8);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = isTemplate
    ? '【サプライヤー名を入力してください】 採購供應商管理シート'
    : `【${supplierName}】 採購供應商管理シート`;
  titleCell.font  = { name: FONT_NAME, size: 14, bold: true, color: { argb: COLORS.WHITE } };
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(r).height = 36;
  applyBorder(titleCell);
  r++;

  // blank separator
  ws.getRow(r).height = 6;
  r++;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: 実績情報 (Performance Information)
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader(ws, r, '① 実績情報  /  Performance Information', COLORS.SECTION_PERF);
  r++;

  // ── 1-A: Column headers for performance table ──────────────────────────
  const perfHeaders = [
    '年月\n(Year/Month)',
    '金額\n(Amount)',
    '人数\n(Headcount)',
    '期間\n(Period)',
    'BU',
    '项目内容\n(Project)',
    '対象客戶\n(Client)',
    '単価区分\n(Unit Price)',
  ];
  perfHeaders.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font  = { name: FONT_NAME, size: 9, bold: true, color: { argb: COLORS.DARK } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SUB_PERF } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyBorder(cell);
  });
  ws.getRow(r).height = 36;
  r++;

  // ── 1-B: Performance data rows (5 sample rows) ─────────────────────────
  const perfPlaceholders = isTemplate
    ? ['YYYY/MM', '¥0', '0名', '〇ヶ月', 'BU名', 'プロジェクト内容', '客戶名', '単価区分']
    : ['2024/04', '', '', '', '', '', '', ''];
  for (let i = 0; i < 5; i++) {
    perfPlaceholders.forEach((ph, col) => {
      const cell = ws.getCell(r, col + 1);
      cell.value = i === 0 && isTemplate ? ph : '';
      cell.font  = { name: FONT_NAME, size: 10, color: { argb: 'FF444444' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      applyBorder(cell);
    });
    ws.getRow(r).height = 20;
    r++;
  }

  // blank separator
  ws.getRow(r).height = 8;
  r++;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: 調査情報 (Survey Information)
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader(ws, r, '② 調査情報  /  Survey Information', COLORS.SECTION_SURVEY);
  r++;

  // ── 2-1: 需要発信方式 (Demand Release Method) ──────────────────────────
  subSectionHeader(ws, r, '2-1  需要発信方式 / Demand Release Method', COLORS.SUB_SURVEY);
  r++;

  const demandRows = [
    ['時効要求 / Timeliness Requirement', '（例: 〇〇日前に連絡）'],
    ['前倒し量 / Lead Time',              '（例: X週間前）'],
  ];
  demandRows.forEach(([label, ph]) => {
    setLabel(ws,  r, 1, label, COLORS.SUB_SURVEY);
    ws.mergeCells(r, 2, r, 4);
    setInput(ws, r, 2, isTemplate ? ph : '');
    ws.mergeCells(r, 5, r, 8);
    setInput(ws, r, 5, '');
    ws.getRow(r).height = 22;
    r++;
  });

  // ── 2-2: 議価プロセス (Negotiation Process) ────────────────────────────
  subSectionHeader(ws, r, '2-2  議価プロセス / Negotiation Process', COLORS.SUB_SURVEY);
  r++;

  const negotiationRows = [
    ['判断要素 / Decision Factors',       '（例: 品質・実績・価格…）'],
    ['競争入札の有無 / Bidding',           '（有 / 無 / 部分的）'],
    ['比較・見積もり / Comparison',        '（複数社比較 有 / 無）'],
    ['価格交渉 / Price Negotiation',       '（交渉方式・頻度…）'],
    ['近年の価格上昇 / Recent Price Hike', '（有 / 無 / 〇%上昇）'],
  ];
  negotiationRows.forEach(([label, ph]) => {
    setLabel(ws, r, 1, label, COLORS.SUB_SURVEY);
    ws.mergeCells(r, 2, r, 4);
    setInput(ws, r, 2, isTemplate ? ph : '');
    ws.mergeCells(r, 5, r, 8);
    setInput(ws, r, 5, '');
    ws.getRow(r).height = 22;
    r++;
  });

  // ── 2-3: 窓口統一化への懸念 (Concerns on Window Unification) ───────────
  subSectionHeader(ws, r, '2-3  窓口統一化への懸念・意見 / Concerns on Unified Window', COLORS.SUB_SURVEY);
  r++;
  ws.mergeCells(r, 1, r + 3, 8);
  const concernCell = ws.getCell(r, 1);
  concernCell.value = isTemplate ? '（懸念事項・ご意見をご記入ください）' : '';
  concernCell.font  = { name: FONT_NAME, size: 10, color: { argb: 'FF999999' } };
  concernCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  applyBorder(concernCell);
  ws.getRow(r).height = 20;
  r += 4;

  // blank separator
  ws.getRow(r).height = 8;
  r++;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: 補助情報 (Auxiliary Information)
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader(ws, r, '③ 補助情報  /  Auxiliary Information', COLORS.SECTION_AUX);
  r++;

  const auxRows = [
    ['会社背景 / Company Background',    '（設立年・資本金・従業員数…）'],
    ['連絡窓口 / Contact Person',        '（担当者名・メール・TEL）'],
    ['取引年数 / Years of Cooperation',  '（〇〇年 / 〇〇年〇月〜）'],
    ['BU長評価 / BU Head Evaluation',    '（◎ / 〇 / △ / × + コメント）'],
    ['その他補足事項 / Other Remarks',   '（特記事項があればご記入ください）'],
  ];
  auxRows.forEach(([label, ph]) => {
    setLabel(ws, r, 1, label, COLORS.SUB_AUX);
    ws.mergeCells(r, 2, r, 8);
    setInput(ws, r, 2, isTemplate ? ph : '');
    ws.getRow(r).height = 22;
    r++;
  });

  // ── Remarks multi-line area ────────────────────────────────────────────
  ws.getRow(r).height = 8;
  r++;
  setLabel(ws, r, 1, 'その他コメント / Additional Comments', COLORS.SUB_AUX);
  ws.mergeCells(r, 2, r + 3, 8);
  const remarkCell = ws.getCell(r, 2);
  remarkCell.value = '';
  remarkCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  applyBorder(remarkCell);
  ws.getRow(r).height = 20;
  r += 4;

  // ── Footer ────────────────────────────────────────────────────────────────
  ws.getRow(r).height = 8;
  r++;
  ws.mergeCells(r, 1, r, 8);
  const footer = ws.getCell(r, 1);
  footer.value = `記入日: ________________  記入者: ________________  確認者: ________________`;
  footer.font  = { name: FONT_NAME, size: 9, color: { argb: 'FF888888' } };
  footer.alignment = { vertical: 'middle', horizontal: 'center' };
  applyBorder(footer);
  ws.getRow(r).height = 20;

  // ── Freeze top title row ──────────────────────────────────────────────────
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

  return ws;
}

// ─── Build "Guide" / Index sheet ──────────────────────────────────────────────
function buildGuideSheet(workbook) {
  const ws = workbook.addWorksheet('📋 使用ガイド');

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 60;

  let r = 1;

  ws.mergeCells(r, 1, r, 2);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = '採購供應商管理 Excel テンプレート  —  使用ガイド';
  titleCell.font  = { name: FONT_NAME, size: 14, bold: true, color: { argb: COLORS.WHITE } };
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SECTION_GUIDE } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(r).height = 36;
  applyBorder(titleCell);
  r++;

  ws.getRow(r).height = 8;
  r++;

  const guideItems = [
    // [label, description]
    ['【目的】', ''],
    ['収集目的 1', '人力採購供應商名録を収集する'],
    ['収集目的 2', '採購契約実績を収集する'],
    ['調査目的',  '現行の採購プロセスを把握する'],
    ['最終目的',  '採購窓口の統一（単価交渉）・プロセスの標準化\n採購データの可視化・総コスト削減'],
    ['', ''],
    ['【シート構成】', ''],
    ['📋 使用ガイド (本シート)', 'テンプレートの使い方と記入方法を説明します'],
    ['📝 新規テンプレート',      '新規サプライヤー追加用の空白テンプレート'],
    ['🏢 サプライヤー A (例)',   '記入例: 既存サプライヤーのサンプルシート'],
    ['', ''],
    ['【記入方法】', ''],
    ['新規サプライヤー追加',    '「📝 新規テンプレート」シートをコピーし、シート名をサプライヤー名に変更してください'],
    ['① 実績情報',             '過去の取引実績を年月ごとに記録します\n行を追加する場合は最終行の下に追加してください'],
    ['② 調査情報',             '需要発信方式・議価プロセス・窓口統一化の意見をヒアリングして記入します'],
    ['③ 補助情報',             '会社情報・評価など管理に役立つ情報を入力します'],
    ['', ''],
    ['【フィールド説明 — 実績情報】', ''],
    ['年月 (Year/Month)',        '取引が発生した年月 (例: 2024/04)'],
    ['金額 (Amount)',            '取引金額 (税抜き、円単位)'],
    ['人数 (Headcount)',         '当該案件に従事した人員数'],
    ['期間 (Period)',            '作業期間 (例: 3ヶ月)'],
    ['BU',                       '発注元のビジネスユニット名'],
    ['项目内容 (Project)',        'プロジェクト・作業の概要'],
    ['対象客戶 (Client)',         '最終エンドクライアント名'],
    ['単価区分 (Unit Price)',     '適用単価の区分 (例: A区分・B区分)'],
    ['', ''],
    ['【フィールド説明 — 調査情報】', ''],
    ['時効要求 / 前倒し量',       '発注から納品までに必要なリードタイム'],
    ['判断要素',                  '取引先選定時の評価軸 (品質・価格・実績 等)'],
    ['競争入札の有無',            '見積もり競合・入札の実施有無'],
    ['価格交渉',                  '価格交渉の方法・頻度・担当者'],
    ['近年の価格上昇',            '直近 2〜3 年における単価変動の有無と内容'],
    ['窓口統一化への懸念',        '採購窓口を一本化した場合の懸念・要望'],
    ['', ''],
    ['【フィールド説明 — 補助情報】', ''],
    ['会社背景',                  '設立年・資本金・主要サービス・親会社等'],
    ['連絡窓口',                  '担当者名・部署・メールアドレス・電話番号'],
    ['取引年数',                  '初回取引開始からの年数'],
    ['BU長評価',                  'BU責任者による総合評価 (◎/○/△/×) とコメント'],
    ['その他補足事項',            '管理上重要な特記事項など'],
  ];

  guideItems.forEach(([label, desc]) => {
    if (label === '' && desc === '') {
      ws.getRow(r).height = 8;
      r++;
      return;
    }
    const isCategory = label.startsWith('【');
    const labelCell = ws.getCell(r, 1);
    const descCell  = ws.getCell(r, 2);

    labelCell.value = label;
    descCell.value  = desc;

    if (isCategory) {
      labelCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: COLORS.WHITE } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SECTION_GUIDE } };
      descCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SECTION_GUIDE } };
      ws.getRow(r).height = 24;
    } else {
      labelCell.font = { name: FONT_NAME, size: 10, bold: true };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9F5' } };
      descCell.font  = { name: FONT_NAME, size: 10 };
      descCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
      ws.getRow(r).height = 20;
    }

    labelCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    descCell.alignment  = { vertical: 'middle', horizontal: 'left', wrapText: true };
    applyBorder(labelCell);
    applyBorder(descCell);
    r++;
  });

  return ws;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const workbook = new ExcelJS.Workbook();

  workbook.creator  = 'NocoBase Procurement Template';
  workbook.created  = new Date();
  workbook.modified = new Date();
  workbook.subject  = '採購供應商管理テンプレート';
  workbook.description =
    '人力採購供應商の名録収集・実績管理・採購プロセス調査のための統合Excelテンプレートです。';

  // 1. Guide sheet (index)
  buildGuideSheet(workbook);

  // 2. Blank template sheet for new suppliers
  buildSupplierSheet(workbook, '📝 新規テンプレート', true);

  // 3. Sample supplier sheet (filled example)
  buildSupplierSheet(workbook, '🏢 サプライヤー A (例)', false);

  const outputPath = path.join(__dirname, 'procurement-supplier-template.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log(`✅ Template generated: ${outputPath}`);
  console.log('');
  console.log('Sheets created:');
  workbook.worksheets.forEach((ws) => console.log(`  • ${ws.name}`));
}

main().catch((err) => {
  console.error('❌ Error generating template:', err);
  process.exit(1);
});
