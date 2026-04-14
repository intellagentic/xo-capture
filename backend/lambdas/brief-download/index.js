/**
 * XO Platform - Brief Download Lambda (Node.js)
 * POST /results/{id}/brief — Generates branded .docx deployment brief
 * Uses docx-js with branded formatting from brief-formatting skill.
 */

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        LevelFormat, BorderStyle, Table, TableRow, TableCell, WidthType,
        ShadingType, TableLayoutType, Header, Footer, PageNumber, PageBreak,
        VerticalAlign } = require('docx');

// ── Brand Constants ──
const B = {
  darkNavy: "0D0D0D", navy: "1A1A2E", teal: "0F969C", tealLight: "6DD5ED",
  xoRed: "CC0000", white: "FFFFFF", headingBlue: "1A1A2E", subheadBlue: "2F5496",
  bodyText: "333333", mutedGray: "666666", lightGray: "808080",
  calloutBg: "F0F7F7", calloutBorder: "0F969C", riskBg: "FFF5F5", riskBorder: "CC0000",
  tableBg: "F1F5F9", tableAlt: "F8FAFC", compareBg: "E8F5E9", borderGray: "BFBFBF",
  navyBar: "0F172A",
};

const PAGE = { width: 11906, height: 16838, margin: 1440, contentWidth: 9026 };

// ── Border Presets ──
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: B.borderGray };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
};
const tealBorders = (() => {
  const b = { style: BorderStyle.SINGLE, size: 12, color: B.teal };
  return { top: b, bottom: b, left: b, right: b };
})();
const redBorders = (() => {
  const b = { style: BorderStyle.SINGLE, size: 12, color: B.xoRed };
  return { top: b, bottom: b, left: b, right: b };
})();
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const calloutMargins = { top: 150, bottom: 150, left: 240, right: 240 };

// ── Core Helper: XO Text Runs ──
function xoTextRuns(text, opts = {}) {
  if (!text) return [new TextRun({ text: '', ...opts })];
  const { fontSize, fontFace, color, bold, italics } = opts;
  const baseColor = color || B.bodyText;
  return text.split(/(XO)/g).filter(p => p.length > 0).map(part => new TextRun({
    text: part, size: fontSize, font: fontFace,
    color: part === "XO" ? B.xoRed : baseColor,
    bold: part === "XO" ? true : bold, italics,
  }));
}

// ── Body Text Helpers ──
function para(text, opts = {}) {
  const children = typeof text === 'string' ? xoTextRuns(text, { fontSize: 22 }) : text;
  return new Paragraph({ spacing: { after: 160, ...opts.spacing }, ...opts, children });
}

function boldPara(boldText, normalText) {
  return new Paragraph({ spacing: { after: 160 },
    children: [new TextRun({ text: boldText, bold: true, size: 22 }), ...xoTextRuns(normalText, { fontSize: 22 })]
  });
}

function bulletItem(boldText, normalText, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level }, spacing: { after: 80 },
    children: [new TextRun({ text: boldText, bold: true, size: 20 }), ...xoTextRuns(normalText, { fontSize: 20 })]
  });
}

function spacer(twips = 200) { return new Paragraph({ spacing: { after: twips }, children: [] }); }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

// ── Cover Page ──
function createCoverMeta(clientContact, meetingDate, colW, labelStyle, valueStyle) {
  function metaCell(label, value) {
    return new TableCell({
      borders: noBorders, width: { size: colW, type: WidthType.DXA },
      shading: { fill: B.darkNavy, type: ShadingType.CLEAR },
      children: [
        new Paragraph({ children: [new TextRun({ text: label, ...labelStyle })] }),
        new Paragraph({ children: [new TextRun({ text: value, ...valueStyle })] }),
      ]
    });
  }
  return new Table({
    width: { size: colW * 3, type: WidthType.DXA },
    columnWidths: [colW, colW, colW],
    rows: [new TableRow({ children: [
      metaCell("Client", clientContact),
      metaCell("Prepared by", "Intellagentic Limited"),
      metaCell("Meeting Date", meetingDate || "TBD"),
    ] })]
  });
}

function buildCoverPage(clientName, clientDesc, headline, valueProp, clientContact, meetingDate) {
  const colW = Math.floor((PAGE.contentWidth - 800) / 3);
  const labelStyle = { font: "Calibri", size: 18, color: B.mutedGray, bold: true };
  const valueStyle = { font: "Calibri", size: 20, color: B.white };

  return [new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [PAGE.contentWidth],
    rows: [new TableRow({ children: [new TableCell({
      borders: noBorders, shading: { fill: B.darkNavy, type: ShadingType.CLEAR },
      margins: { top: 600, bottom: 600, left: 400, right: 400 },
      width: { size: PAGE.contentWidth, type: WidthType.DXA },
      children: [
        new Paragraph({ spacing: { after: 100 }, children: xoTextRuns("INTELLAGENTICXO", { fontSize: 18, fontFace: "Calibri", color: B.mutedGray, bold: true }) }),
        new Paragraph({ spacing: { after: 40 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: B.teal, space: 2 } }, children: [] }),
        new Paragraph({ spacing: { before: 200, after: 200 }, children: [new TextRun({ text: "CONFIDENTIAL \u2014 STRATEGIC DEPLOYMENT BRIEF", font: "Calibri", size: 20, color: B.teal, bold: true })] }),
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: clientName, font: "Trebuchet MS", size: 56, color: B.white, bold: true })] }),
        new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: clientDesc, font: "Calibri", size: 22, color: B.tealLight })] }),
        new Paragraph({ spacing: { after: 80 }, children: xoTextRuns("XO Deployment:", { fontSize: 32, fontFace: "Trebuchet MS", color: B.white, bold: true }) }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: headline, font: "Trebuchet MS", size: 32, color: B.white, bold: true })] }),
        new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: valueProp, font: "Calibri", size: 20, color: B.mutedGray, italics: true })] }),
        // Metadata table
        createCoverMeta(clientContact, meetingDate, colW, labelStyle, valueStyle),
        new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "\u26A0 STRICTLY CONFIDENTIAL \u2014 NOT FOR DISTRIBUTION", font: "Calibri", size: 18, color: B.mutedGray, bold: true })] }),
      ]
    })]})],
  })];
}

// ── Section Header ──
function sectionHeader(number, title, startNewPage = false) {
  const elements = [];
  if (startNewPage) {
    elements.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 0 }, children: [] }));
  }
  const colNum = 800, colTitle = PAGE.contentWidth - colNum;
  elements.push(new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA }, columnWidths: [colNum, colTitle],
    rows: [new TableRow({ children: [
      new TableCell({ borders: noBorders, shading: { fill: B.navy, type: ShadingType.CLEAR }, width: { size: colNum, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 }, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: number, font: "Trebuchet MS", size: 28, color: B.teal, bold: true })] })] }),
      new TableCell({ borders: noBorders, width: { size: colTitle, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 200, right: 100 }, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: title, font: "Trebuchet MS", size: 28, color: B.headingBlue, bold: true })] })] }),
    ]})]
  }));
  return elements;
}

// ── Key Metrics Row ──
function keyMetricsRow(metrics) {
  const colW = Math.floor(PAGE.contentWidth / metrics.length);
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA }, columnWidths: metrics.map(() => colW),
    rows: [new TableRow({ children: metrics.map(m => new TableCell({
      borders: noBorders, width: { size: colW, type: WidthType.DXA },
      margins: { top: 120, bottom: 120, left: 100, right: 100 },
      shading: { fill: B.tableBg, type: ShadingType.CLEAR },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: m.value, font: "Trebuchet MS", size: 48, color: B.teal, bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: m.label, font: "Calibri", size: 20, color: B.headingBlue, bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.sublabel || '', font: "Calibri", size: 16, color: B.mutedGray })] }),
      ]
    })) })]
  });
}

// ── Callout Boxes ──
function calloutBox(label, content) {
  const contentRuns = typeof content === 'string' ? xoTextRuns(content, { fontSize: 22 }) : content;
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA }, columnWidths: [PAGE.contentWidth],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      borders: tealBorders, shading: { fill: B.calloutBg, type: ShadingType.CLEAR },
      margins: calloutMargins, width: { size: PAGE.contentWidth, type: WidthType.DXA },
      children: [
        new Paragraph({ spacing: { after: 80 }, keepNext: true, children: [new TextRun({ text: label, font: "Calibri", size: 22, color: B.teal, bold: true })] }),
        new Paragraph({ spacing: { after: 0 }, children: contentRuns }),
      ]
    })]})],
  });
}

function riskCallout(label, content) {
  const contentRuns = typeof content === 'string' ? xoTextRuns(content, { fontSize: 22 }) : content;
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA }, columnWidths: [PAGE.contentWidth],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      borders: redBorders, shading: { fill: B.riskBg, type: ShadingType.CLEAR },
      margins: calloutMargins, width: { size: PAGE.contentWidth, type: WidthType.DXA },
      children: [
        new Paragraph({ spacing: { after: 80 }, keepNext: true, children: [new TextRun({ text: "\u26A0 " + label, font: "Calibri", size: 22, color: B.xoRed, bold: true })] }),
        new Paragraph({ spacing: { after: 0 }, children: contentRuns }),
      ]
    })]})],
  });
}

// ── OODA Phase ──
function oodaPhase(icon, phaseName, tagline, subBullets) {
  return [
    new Paragraph({ spacing: { before: 240, after: 80 }, children: [
      new TextRun({ text: icon + " ", font: "Calibri", size: 28 }),
      new TextRun({ text: phaseName, font: "Trebuchet MS", size: 28, bold: true, color: B.teal }),
    ] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: tagline, font: "Calibri", size: 22, color: B.headingBlue, italics: true })] }),
    ...subBullets.map(b => new Paragraph({
      spacing: { after: 60 }, indent: { left: 360 },
      children: [new TextRun({ text: "\u2013 ", size: 20 }), new TextRun({ text: b.bold || '', bold: true, size: 20 }), ...xoTextRuns(b.text || b, { fontSize: 20, color: B.bodyText })],
    }))
  ];
}

// ── POC Timeline Table ──
function pocTimelineTable(steps) {
  const colStep = 720, colTime = 1350, colAction = PAGE.contentWidth - colStep - colTime;
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA }, layout: TableLayoutType.FIXED,
    columnWidths: [colStep, colTime, colAction],
    rows: [
      new TableRow({ children: [
        new TableCell({ borders, width: { size: colStep, type: WidthType.DXA }, shading: { fill: B.navy, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: "Step", bold: true, color: B.white, size: 20 })] })] }),
        new TableCell({ borders, width: { size: colTime, type: WidthType.DXA }, shading: { fill: B.navy, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: "Timeline", bold: true, color: B.white, size: 20 })] })] }),
        new TableCell({ borders, width: { size: colAction, type: WidthType.DXA }, shading: { fill: B.navy, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: "Action", bold: true, color: B.white, size: 20 })] })] }),
      ]}),
      ...steps.map((s, i) => new TableRow({ children: [
        new TableCell({ borders, width: { size: colStep, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? B.white : B.tableAlt, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.step, bold: true, size: 20, color: B.teal })] })] }),
        new TableCell({ borders, width: { size: colTime, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? B.white : B.tableAlt, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: s.timeline, bold: true, size: 20 })] })] }),
        new TableCell({ borders, width: { size: colAction, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? B.white : B.tableAlt, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ children: xoTextRuns(s.action, { fontSize: 20, color: B.bodyText }) })] }),
      ]}))
    ]
  });
}

// ── Streamline Applications ──
function streamlineHeader() {
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA }, columnWidths: [PAGE.contentWidth],
    rows: [new TableRow({ children: [new TableCell({
      borders: noBorders, shading: { fill: B.navyBar, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      width: { size: PAGE.contentWidth, type: WidthType.DXA },
      children: [new Paragraph({ children: [
        new TextRun({ text: "Intellistack ", font: "Calibri", size: 24, color: B.teal, bold: true }),
        new TextRun({ text: "Potential Streamline Applications", font: "Calibri", size: 24, color: B.white }),
      ] })]
    })]})],
  });
}

function streamlineApplication(num, title, problem, workflow, integrations, outcome) {
  const items = [];
  items.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [
    new TextRun({ text: `${num}. ${title}`, font: "Calibri", size: 22, bold: true, color: B.headingBlue })
  ] }));
  if (problem) items.push(new Paragraph({ spacing: { after: 60 }, children: [
    new TextRun({ text: "Problem: ", size: 20, bold: true, color: B.xoRed }),
    new TextRun({ text: problem, size: 20, color: B.bodyText }),
  ] }));
  if (workflow) items.push(new Paragraph({ spacing: { after: 60 }, children: [
    new TextRun({ text: "Workflow: ", size: 20, bold: true, color: B.subheadBlue }),
    new TextRun({ text: workflow, size: 20, color: B.bodyText }),
  ] }));
  if (integrations) items.push(new Paragraph({ spacing: { after: 60 }, children: [
    new TextRun({ text: "Integrations: ", size: 20, bold: true, color: B.bodyText }),
    new TextRun({ text: integrations, size: 20, color: B.bodyText }),
  ] }));
  if (outcome) items.push(new Paragraph({ spacing: { after: 60 }, children: [
    new TextRun({ text: "Outcome: ", size: 20, bold: true, color: B.bodyText }),
    new TextRun({ text: outcome, size: 20, color: B.bodyText }),
  ] }));
  // Separator
  items.push(new Paragraph({ spacing: { after: 40 }, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: B.borderGray, space: 4 } }, children: [] }));
  return items;
}

function parseStreamlineApplications(text) {
  if (!text) return [];
  // Split on numbered headers
  const parts = text.split(/\*\*(\d+)\.\s+([^*]+)\*\*/g);
  const apps = [];
  for (let i = 1; i < parts.length; i += 3) {
    const num = parts[i];
    const title = (parts[i + 1] || '').trim();
    const body = (parts[i + 2] || '').trim();
    const problem = (body.match(/Problem:\s*(.+?)(?:\n|$)/i) || [])[1] || '';
    const workflow = (body.match(/Workflow:\s*(.+?)(?:\n|$)/i) || [])[1] || '';
    const integrations = (body.match(/Integrations?:\s*(.+?)(?:\n|$)/i) || [])[1] || '';
    const outcome = (body.match(/Outcome:\s*(.+?)(?:\n|$)/i) || [])[1] || '';
    apps.push({ num, title, problem, workflow, integrations, outcome });
  }
  return apps;
}

// ── ASCII Code Block ──
function codeBlock(text) {
  if (!text) return [];
  return [
    new Table({
      width: { size: PAGE.contentWidth, type: WidthType.DXA }, columnWidths: [PAGE.contentWidth],
      rows: [new TableRow({ children: [new TableCell({
        borders, shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        width: { size: PAGE.contentWidth, type: WidthType.DXA },
        children: text.split('\n').map(line => new Paragraph({
          spacing: { after: 0, line: 240 },
          children: [new TextRun({ text: line || ' ', font: "Courier New", size: 14, color: B.bodyText })]
        }))
      })]})],
    })
  ];
}

// ── Markdown Text to Paragraphs ──
function mdToParagraphs(text) {
  if (!text) return [spacer(80)];
  // Strip backslash escapes
  text = text.replace(/\\\*/g, '*').replace(/\\-/g, '-').replace(/\\\|/g, '|');
  const results = [];
  // Split on code blocks first
  const segments = text.split(/(```[\s\S]*?```)/g);
  for (const segment of segments) {
    if (segment.startsWith('```') && segment.endsWith('```')) {
      let code = segment.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      results.push(pageBreak());
      results.push(...codeBlock(code));
    } else {
      for (const para of segment.split('\n\n')) {
        const trimmed = para.trim();
        if (!trimmed) continue;
        // Bold markers → split and create runs
        const clean = trimmed.replace(/\*\*(.*?)\*\*/g, '|||BOLD:$1|||').split('|||').filter(p => p);
        const children = [];
        for (const part of clean) {
          if (part.startsWith('BOLD:')) {
            children.push(new TextRun({ text: part.slice(5), bold: true, size: 22 }));
          } else {
            children.push(...xoTextRuns(part, { fontSize: 22 }));
          }
        }
        results.push(new Paragraph({ spacing: { after: 160 }, children }));
      }
    }
  }
  return results.length > 0 ? results : [spacer(80)];
}

// ── Document Config ──
function createBriefConfig(clientName, coverChildren, bodyChildren, isDraft) {
  return {
    styles: {
      default: { document: { run: { font: "Calibri", size: 22, color: B.bodyText } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Trebuchet MS", color: B.headingBlue },
          paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      ]
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ]},
      ]
    },
    sections: [
      { properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin } } },
        children: coverChildren },
      { properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin } } },
        headers: { default: new Header({ children: [
          ...(isDraft ? [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "DRAFT", size: 72, color: "D0D0D0", bold: true, font: "Arial" })],
          })] : []),
          new Paragraph({
          alignment: AlignmentType.LEFT, spacing: { after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: B.teal, space: 4 } },
          children: xoTextRuns(`INTELLAGENTICXO \u00B7 ${clientName} \u00B7 XO Deployment Brief \u00B7 CONFIDENTIAL`, { fontSize: 16, fontFace: "Calibri", color: B.mutedGray })
        })] }) },
        footers: { default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: B.borderGray, space: 4 } },
          children: [
            ...xoTextRuns("IntellagenticXO \u00B7 Strictly Confidential  ", { fontSize: 16, fontFace: "Calibri", color: B.lightGray }),
            new TextRun({ text: "Page ", font: "Calibri", size: 16, color: B.lightGray }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 16, color: B.lightGray }),
          ]
        })] }) },
        children: bodyChildren },
    ]
  };
}

// ── Formatting Skill Parser ──
function parseFormattingSkill(markdown) {
  const config = { components: {} };
  const blockPattern = /```component:\s*(\w+)\n([\s\S]*?)```/g;
  let match;
  while ((match = blockPattern.exec(markdown)) !== null) {
    const name = match[1];
    const body = match[2];
    const component = {};
    let currentMap = null;
    let currentMapKey = null;
    for (const line of body.split('\n')) {
      // Indented map entry (e.g., "  high: #CC0000")
      if (currentMap && /^\s{2,}\w/.test(line)) {
        const kv = line.trim().match(/^(\w+)\s*:\s*"?([^"]+)"?$/);
        if (kv) currentMap[kv[1]] = kv[2].trim();
        continue;
      }
      currentMap = null;
      const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
      if (!kv) continue;
      const key = kv[1];
      let val = kv[2].trim();
      // JSON object: { key: val, ... }
      if (val.startsWith('{') && val.endsWith('}')) {
        try { val = JSON.parse(val.replace(/(\w[\w_]*)\s*:/g, '"$1":')); } catch(e) { /* keep as string */ }
        component[key] = val;
      } else if (val.endsWith(':') || val === '') {
        // Start of a YAML-style map (no value on this line)
        currentMap = {};
        currentMapKey = key;
        component[key] = currentMap;
      } else {
        // Strip surrounding quotes
        component[key] = val.replace(/^"(.*)"$/, '$1');
      }
    }
    config.components[name] = component;
  }
  return config;
}

// ── Config-Driven Component: OODA Phase Table (4-column row) ──
function oodaPhaseTable(phases, fmtConfig) {
  const comp = (fmtConfig && fmtConfig.components && fmtConfig.components.oodaPhaseCard) || {};
  const cellBorderColor = (comp.cell_border && comp.cell_border.color || 'CCCCCC').replace('#', '');
  const cellBorderWidth = parseInt((comp.cell_border && comp.cell_border.width) || 4);
  const cellBg = (comp.cell_background || 'FFFFFF').replace('#', '');
  const phaseFont = (comp.phase_name && comp.phase_name.font) || 'Trebuchet MS';
  const phaseSize = parseInt((comp.phase_name && comp.phase_name.size) || 24);
  const phaseColor = ((comp.phase_name && comp.phase_name.color) || B.teal).replace('#', '');
  const subtitleFont = (comp.subtitle && comp.subtitle.font) || 'Calibri';
  const subtitleSize = parseInt((comp.subtitle && comp.subtitle.size) || 20);
  const subtitleColor = ((comp.subtitle && comp.subtitle.color) || B.headingBlue).replace('#', '');
  const itemSize = parseInt((comp.items && comp.items.size) || 20);

  const border = { style: BorderStyle.SINGLE, size: cellBorderWidth, color: cellBorderColor };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const colW = Math.floor(PAGE.contentWidth / 2);

  function makeCell(p) {
    return new TableCell({
      borders: cellBorders,
      shading: { fill: cellBg, type: ShadingType.CLEAR },
      width: { size: colW, type: WidthType.DXA },
      margins: { top: 160, bottom: 160, left: 200, right: 200 },
      children: [
        new Paragraph({ spacing: { after: 60 }, children: [
          new TextRun({ text: p.phase, font: phaseFont, size: phaseSize, bold: true, color: phaseColor })
        ]}),
        new Paragraph({ spacing: { after: 80 }, children: [
          new TextRun({ text: p.subtitle, font: subtitleFont, size: subtitleSize, bold: true, color: subtitleColor })
        ]}),
        ...p.items.map(item => new Paragraph({
          numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: item, size: itemSize })]
        }))
      ]
    });
  }

  const row1 = new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [colW, colW],
    rows: [new TableRow({ cantSplit: true, children: [makeCell(phases[0]), makeCell(phases[1])] })]
  });
  const row2 = new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [colW, colW],
    rows: [new TableRow({ cantSplit: true, children: [makeCell(phases[2]), makeCell(phases[3])] })]
  });

  return [row1, spacer(120), row2];
}

// ── Config-Driven Component: Problem Card (left-border severity card) ──
function problemCard(problem, fmtConfig) {
  const comp = (fmtConfig && fmtConfig.components && fmtConfig.components.problemCard) || {};
  const borderWidth = parseInt(comp.border_width || 18);
  const bg = (comp.background || 'F7FAFA').replace('#', '');
  const sevColors = comp.severity_colors || {};
  const defaultSevColors = { high: 'CC0000', medium: 'E67E22', low: '27AE60' };
  const severity = (problem.severity || 'medium').toLowerCase();
  const sevColor = ((sevColors[severity] || defaultSevColors[severity] || defaultSevColors.medium)).replace('#', '');
  const titleSize = parseInt((comp.title && comp.title.size) || 22);
  const evidenceSize = parseInt((comp.evidence && comp.evidence.size) || 20);
  const boldFirst = comp.evidence && comp.evidence.bold_first_sentence === 'true';

  const sevBorder = { style: BorderStyle.SINGLE, size: borderWidth, color: sevColor };
  const thinGray = { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' };
  const cardBorders = { left: sevBorder, top: thinGray, bottom: thinGray, right: thinGray };

  // Strip source citations from evidence
  let evidence = problem.evidence || '';

  // Build evidence runs -- optionally bold first sentence
  const evidenceChildren = [];
  if (boldFirst && evidence.includes('.')) {
    const firstDot = evidence.indexOf('.');
    evidenceChildren.push(new TextRun({ text: evidence.substring(0, firstDot + 1), bold: true, size: evidenceSize }));
    const rest = evidence.substring(firstDot + 1).trim();
    if (rest) evidenceChildren.push(...xoTextRuns(' ' + rest, { fontSize: evidenceSize }));
  } else {
    evidenceChildren.push(...xoTextRuns(evidence, { fontSize: evidenceSize }));
  }

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [PAGE.contentWidth],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      borders: cardBorders,
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 180, right: 180 },
      width: { size: PAGE.contentWidth, type: WidthType.DXA },
      children: [
        new Paragraph({ spacing: { after: 80 }, children: [
          new TextRun({ text: problem.title || '', bold: true, size: titleSize, color: B.headingBlue }),
          new TextRun({ text: `  (${severity} severity)`, size: titleSize - 4, color: sevColor, italics: true }),
        ]}),
        new Paragraph({ spacing: { after: 0 }, children: evidenceChildren }),
      ]
    })]})],
  });
}

// ── Config-Driven Component: Solution Card (left-border teal, XO/Streamline/Outcome labels) ──
function solutionCard(problem) {
  const tealBorder = { style: BorderStyle.SINGLE, size: 18, color: B.teal };
  const noneBorder = { style: BorderStyle.NONE };
  const cardBorders = { left: tealBorder, top: noneBorder, bottom: noneBorder, right: noneBorder };
  const text = (problem.recommendation || '').replace(/^FLAG FOR HUMAN REVIEW:\s*/i, '');

  const children = [];
  // Title
  children.push(new Paragraph({ spacing: { after: 100 }, children: [
    new TextRun({ text: problem.title || '', bold: true, size: 22, color: B.headingBlue })
  ]}));

  // Try to parse XO / Streamline / Expected outcome sections
  const streamlineIdx = text.search(/\bStreamline\b/i);
  const outcomeIdx = text.search(/Expected [Oo]utcome:/i);

  if (streamlineIdx > 0 && outcomeIdx > streamlineIdx) {
    const xoText = text.substring(0, streamlineIdx).trim();
    const streamlineText = text.substring(streamlineIdx, outcomeIdx).trim();
    const outcomeText = text.substring(outcomeIdx).replace(/^Expected [Oo]utcome:\s*/i, '').trim();

    if (xoText) children.push(new Paragraph({ spacing: { after: 80 }, children: [
      new TextRun({ text: 'XO: ', bold: true, size: 20, color: B.xoRed }),
      ...xoTextRuns(xoText, { fontSize: 20 })
    ]}));
    if (streamlineText) children.push(new Paragraph({ spacing: { after: 80 }, children: [
      new TextRun({ text: 'Streamline: ', bold: true, size: 20, color: B.teal }),
      new TextRun({ text: streamlineText, size: 20, color: B.bodyText })
    ]}));
    if (outcomeText) children.push(new Paragraph({ spacing: { after: 0 }, children: [
      new TextRun({ text: 'Outcome: ', bold: true, size: 20, color: '27AE60' }),
      new TextRun({ text: outcomeText, size: 20, color: B.bodyText })
    ]}));
  } else {
    // Fallback: render as single paragraph
    children.push(new Paragraph({ spacing: { after: 0 }, children: xoTextRuns(text, { fontSize: 20 }) }));
  }

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [PAGE.contentWidth],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      borders: cardBorders,
      shading: { fill: 'F7FAFA', type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      width: { size: PAGE.contentWidth, type: WidthType.DXA },
      children
    })]})],
  });
}

// ── Source Citation Stripping ──
function stripCitations(text) {
  if (!text) return '';
  return text
    .replace(/\s*\(Source:[^)]*\)/g, '')
    .replace(/[;\s]+[A-Za-z0-9_][A-Za-z0-9_ ]*\.(pdf|docx|xlsx|csv|txt)\s*\)?\s*/gi, '')
    .replace(/\s*;?\s*\)\s*$/g, '')
    .trim();
}

// ── Text Helpers for Brief Assembly ──
function truncateToSentences(text, maxSentences) {
  if (!text) return '';
  const sentences = text.split(/\.\s+/).slice(0, maxSentences);
  let result = sentences.join('. ');
  if (!result.endsWith('.')) result += '.';
  return result;
}

// ── Assemble Brief from Analysis Results ──
function assembleBrief(results) {
  const rawProblems = results.problems || results.problems_identified || [];
  // Strip citations and truncate evidence to 3 sentences
  let problems = rawProblems.map(p => ({
    ...p,
    title: stripCitations(p.title),
    evidence: truncateToSentences(stripCitations(p.evidence), 3),
    recommendation: stripCitations(p.recommendation),
    description: stripCitations(p.description),
  }));

  // Merge D-priority pairs: if two items have "D(i)" and "D(ii)" in their titles, combine them
  const dItems = problems.filter(p => /\bD\([iv]+\)/i.test(p.title || ''));
  if (dItems.length === 2) {
    // Parse each recommendation into XO/Streamline/Outcome parts, then merge
    function parseRecParts(text) {
      const t = text || '';
      const sIdx = t.search(/\bStreamline\b/i);
      const oIdx = t.search(/Expected [Oo]utcome:/i);
      if (sIdx > 0 && oIdx > sIdx) {
        return {
          xo: t.substring(0, sIdx).trim(),
          streamline: t.substring(sIdx, oIdx).trim(),
          outcome: t.substring(oIdx).replace(/^Expected [Oo]utcome:\s*/i, '').trim(),
        };
      }
      return { xo: t, streamline: '', outcome: '' };
    }
    const parts = dItems.map(d => parseRecParts(d.recommendation));
    const mergedRec = [
      parts.map(p => p.xo).filter(Boolean).join(' '),
      parts.map(p => p.streamline).filter(Boolean).join(' '),
      parts.map(p => p.outcome).filter(Boolean).join(' '),
    ];
    const combinedRec = mergedRec[0]
      + (mergedRec[1] ? ' ' + mergedRec[1] : '')
      + (mergedRec[2] ? ' Expected outcome: ' + mergedRec[2] : '');

    const merged = {
      ...dItems[0],
      title: 'Priority D: Same Day Tracking & Warehouse Billing',
      evidence: truncateToSentences(dItems.map(d => d.evidence).join(' '), 3),
      recommendation: combinedRec,
      severity: dItems[0].severity,
    };
    problems = problems.filter(p => !/\bD\([iv]+\)/i.test(p.title || ''));
    problems.push(merged);
  }

  const primary = problems[0] || {};
  const plan = results.plan || results.action_plan || {};
  let planPhases = [];
  if (Array.isArray(plan)) planPhases = plan;
  else if (typeof plan === 'object') planPhases = Object.entries(plan).map(([phase, actions]) => ({ phase, actions }));

  const clientName = results.company_name || 'Client';
  const industry = results.industry || results.client_industry || 'this domain';
  const description = stripCitations(results.description || results.client_description || '');

  // Meeting date from enrichment completion
  let meetingDate = 'TBD';
  if (results.analyzed_at) {
    try { meetingDate = new Date(results.analyzed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch(e) {}
  }

  return { clientName, industry, description, problems, primary, planPhases,
    summary: stripCitations(results.summary || results.executive_summary || ''),
    bottomLine: stripCitations(results.bottom_line || ''),
    architecture: results.architecture_diagram || '',
    streamline: results.streamline_applications || '',
    contactName: results.client_contact || '',
    contactTitle: results.client_contact_title || '',
    meetingDate,
    engagementName: results.engagement_name || '',
  };
}

// ── Build Document ──
function buildDocument(brief, isDraft, fmtConfig) {
  const { clientName, industry, description, problems, primary, planPhases, summary, bottomLine, architecture, streamline, contactName, meetingDate, engagementName } = brief;
  const stripNum = t => (t || '').replace(/^\d+\.\s*/, '');

  // Cover — include engagement name if scoped
  const coverDesc = engagementName ? `${engagementName} — ${description || industry}` : (description || industry);
  const cover = buildCoverPage(
    clientName, coverDesc,
    primary.title || 'Operational Transformation',
    bottomLine ? bottomLine.split('.').slice(0, 2).join('.') + '.' : '',
    contactName || clientName, meetingDate
  );

  // Body
  const body = [];

  // Executive Summary
  body.push(para("EXECUTIVE SUMMARY", { heading: HeadingLevel.HEADING_1 }));
  if (engagementName) {
    body.push(boldPara("Engagement: ", engagementName));
  }
  body.push(...mdToParagraphs(summary));
  body.push(spacer());

  const metrics = [
    { value: String(problems.length), label: 'Issues Found', sublabel: `${problems.filter(p => p.severity === 'high').length} high severity` },
    ...(problems.slice(0, 3).map(p => {
      const title = p.title || '';
      const label = title.includes(':') ? title.split(':')[0].trim() : (title.length > 20 ? title.substring(0, 20) + '...' : title);
      return { value: (p.severity || 'N/A').toUpperCase(), label, sublabel: p.severity + ' priority' };
    }))
  ];
  body.push(keyMetricsRow(metrics));

  // Section 01 — Client Profile
  body.push(...sectionHeader("01", `CLIENT PROFILE: ${clientName.toUpperCase()}`, true));
  body.push(spacer(120));
  body.push(boldPara("Industry: ", industry));
  if (description) body.push(calloutBox(`THE ${industry.toUpperCase()} CONTEXT`, description));

  // Section 02 — Operational Crisis (config-driven problem cards)
  body.push(...sectionHeader("02", "THE OPERATIONAL CRISIS", true));
  body.push(spacer(120));
  problems.forEach((p, i) => {
    body.push(problemCard(p, fmtConfig));
    if (i < problems.length - 1) body.push(spacer(80));
  });

  // Section 03 — Why Standard AI
  body.push(...sectionHeader("03", "WHY STANDARD AI CANNOT BE USED HERE", true));
  body.push(spacer(120));
  const primaryProblem = (primary.title || 'operational processes').toLowerCase().replace(/^priority\s+\w+\([iv]+\)\s*:\s*/i, '');
  body.push(para(`Generic AI tools like ChatGPT or off-the-shelf automation platforms cannot safely operate in ${industry} because they lack domain-specific guardrails. In ${clientName}'s environment, a single error in ${primaryProblem} could result in cascading compliance failures, financial exposure, and reputational damage.`));
  body.push(para(`Standard AI has no concept of ${industry} compliance hierarchies, cannot cross-reference domain-specific standards and regulations, and provides no audit trail for regulatory accountability.`));
  body.push(calloutBox("THE PRINCIPLE", `The IntellagenticXO is not a language model applied to ${industry}. It is a domain-specific runtime that happens to use AI for pattern recognition, bounded by Constitutional Safety rules that the operator defines and controls.`));

  // Section 04 — Architecture & OODA (header + diagram on same page)
  body.push(...sectionHeader("04", "THE XO DEPLOYMENT: ARCHITECTURE & OODA WORKFLOW", true));
  // ASCII architecture diagram -- preformatted code block preserving exact character alignment
  if (architecture) {
    body.push(new Table({
      width: { size: PAGE.contentWidth, type: WidthType.DXA }, columnWidths: [PAGE.contentWidth],
      rows: [new TableRow({ cantSplit: false, children: [new TableCell({
        borders: { top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' } },
        shading: { fill: 'F5F5F5', type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        width: { size: PAGE.contentWidth, type: WidthType.DXA },
        children: architecture.split('\n').map(line => new Paragraph({
          spacing: { after: 0, line: 200, lineRule: 'exact' },
          children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 12, color: B.bodyText })]
        }))
      })]})],
    }));
    body.push(spacer(120));
  }
  body.push(para(`The XO deployment for ${clientName} operates on a continuous Observe-Orient-Decide-Act loop, processing ${industry} data through domain-specific rules before any output reaches the operator.`));
  body.push(spacer(120));
  body.push(...oodaPhaseTable([
    { phase: 'OBSERVE', subtitle: `Ingests ${clientName}'s operational data`, items: [
      'Upload and extraction of all source materials',
      'Integration with existing systems and data sources',
      'Pattern recognition from past operations' ]},
    { phase: 'ORIENT', subtitle: `Contextualises against ${industry} rules`, items: [
      `Cross-reference against ${industry} standards and regulations`,
      'Severity scoring based on domain-specific criteria',
      'Automated verification against regulatory requirements' ]},
    { phase: 'DECIDE', subtitle: 'Generates bounded recommendations', items: [
      'All outputs bounded by Constitutional Safety rules',
      'Items requiring judgment escalated to operator',
      'Transparency on certainty of each recommendation' ]},
    { phase: 'ACT', subtitle: 'Delivers through Streamline workflows', items: [
      'Report generation, notifications, escalation',
      'Full provenance logging for every action',
      'Operator corrections improve future cycles' ]},
  ], fmtConfig));

  // Targeted Recommendations (config-driven solution cards)
  if (problems.some(p => p.recommendation)) {
    body.push(spacer(200));
    body.push(para("TARGETED RECOMMENDATIONS", { heading: HeadingLevel.HEADING_2 }));
    body.push(spacer(80));
    const recsWithContent = problems.filter(p => p.recommendation);
    recsWithContent.forEach((p, i) => {
      body.push(solutionCard(p));
      if (i < recsWithContent.length - 1) body.push(spacer(100));
    });
  }

  // Section 05 — Constitutional Safety
  body.push(...sectionHeader("05", "CONSTITUTIONAL SAFETY", true));
  body.push(spacer(120));
  body.push(para(`XO enforces a Constitutional Layer \u2014 a set of immutable domain rules that the AI cannot override. For ${clientName}, this means:`));
  body.push(bulletItem("Compliance Validation: ", `Every output is validated against ${industry} standards before delivery`));
  body.push(bulletItem("Human Authority: ", "The operator retains final authority on all decisions flagged as requiring human judgment"));
  body.push(bulletItem("Audit Trail: ", "All AI actions are logged with full provenance for regulatory audit"));
  body.push(bulletItem("Domain Boundaries: ", "Boundaries are encoded as rules, not suggestions \u2014 the system cannot generate outputs that violate them"));
  body.push(spacer(120));
  body.push(calloutBox("THE GUARANTEE", `The XO does not make ${clientName}'s operation infallible. It makes it traceable, auditable, and bounded by the rules that ${clientName}'s domain requires.`));

  // Section 06 — Streamline Applications
  if (streamline) {
    body.push(...sectionHeader("06", "INTELLISTACK STREAMLINE APPLICATIONS", true));
    body.push(spacer(120));
    body.push(streamlineHeader());
    body.push(spacer(80));
    const apps = parseStreamlineApplications(streamline);
    if (apps.length > 0) {
      apps.forEach((app, i) => {
        const items = streamlineApplication(app.num, app.title, app.problem, app.workflow, app.integrations, app.outcome);
        if (i === apps.length - 1) items.pop(); // remove trailing separator before page break
        body.push(...items);
      });
    } else {
      body.push(...mdToParagraphs(streamline));
    }
  }

  // Section 07 — POC & Next Steps
  body.push(...sectionHeader(streamline ? "07" : "06", "PROOF OF CONCEPT & NEXT STEPS", true));
  body.push(spacer(120));
  const pocSteps = [
    { step: "1", timeline: "Week 1", action: stripNum((planPhases[0] || {}).actions?.[0] || 'Configure DX Cartridge with domain rules') },
    { step: "2", timeline: "Week 1-2", action: stripNum((planPhases[0] || {}).actions?.[1] || 'Ingest sample data and validate extraction') },
    { step: "3", timeline: "Week 2", action: stripNum((planPhases[1] || {}).actions?.[0] || 'Run analysis against live data') },
    { step: "4", timeline: "Week 3", action: stripNum((planPhases[2] || {}).actions?.[0] || 'Review results and make deploy/iterate decision') },
  ];
  body.push(pocTimelineTable(pocSteps));
  body.push(spacer(200));
  const successMetric = primary.title
    ? `The pilot is successful when ${primary.title.toLowerCase()} is resolved without manual intervention in the current workflow.`
    : 'The pilot is successful when the primary operational bottleneck is resolved through automated XO processing.';
  body.push(calloutBox("SUCCESS METRIC", successMetric));

  return new Document(createBriefConfig(clientName, cover, body, isDraft));
}

// ── Lambda Handler ──
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Extract client_id from path
    const pathParams = event.pathParameters || {};
    const clientId = pathParams.id || '';
    if (!clientId) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'client_id is required' }) };
    }

    // Read engagement_id from request body or query params
    let engagementId = null;
    try { engagementId = JSON.parse(event.body || '{}').engagement_id || null; } catch(e) {}
    if (!engagementId) engagementId = (event.queryStringParameters || {}).engagement_id || null;

    // Get results from the results API (self-call via Lambda invoke or HTTP)
    const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
    const lambdaClient = new LambdaClient({ region: 'eu-west-2' });

    const queryParams = engagementId ? { engagement_id: engagementId } : null;
    const resultsResp = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'xo-results',
      Payload: JSON.stringify({
        httpMethod: 'GET',
        path: `/results/${clientId}`,
        pathParameters: { id: clientId },
        queryStringParameters: queryParams,
        headers: event.headers,
      }),
    }));

    const resultsBody = JSON.parse(Buffer.from(resultsResp.Payload).toString());
    const results = JSON.parse(resultsBody.body);

    if (results.status !== 'complete') {
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Analysis not complete' }) };
    }

    // Load formatting skill from S3
    let fmtConfig = { components: {} };
    try {
      const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({ region: 'eu-west-2' });
      const skillResp = await s3.send(new GetObjectCommand({
        Bucket: 'xo-client-data-mv',
        Key: '_system/skills/brief-formatting.md',
      }));
      const skillContent = await skillResp.Body.transformToString();
      fmtConfig = parseFormattingSkill(skillContent);
      console.log(`Loaded formatting skill: ${Object.keys(fmtConfig.components).length} components`);
    } catch (e) {
      console.warn('Failed to load formatting skill, using defaults:', e.message);
    }

    // Assemble and build (draft watermark if not yet approved)
    const isDraft = !results.approved_at;
    const brief = assembleBrief(results);
    const doc = buildDocument(brief, isDraft, fmtConfig);
    const buffer = await Packer.toBuffer(doc);

    const engName = results.engagement_name ? `_${results.engagement_name.replace(/\s+/g, '_')}` : '';
    const filename = `${(brief.clientName || 'Client').replace(/\s+/g, '_')}${engName}_XO_Deployment_Brief.docx`;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        filename,
        content_base64: buffer.toString('base64'),
        content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    };
  } catch (err) {
    console.error('Brief generation failed:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Brief generation failed', message: err.message }) };
  }
};
