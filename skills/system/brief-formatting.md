# System Skill: Brief Formatting

Complete docx-js code patterns for building branded client deployment briefs.
Copy these blocks directly into your build script.

## Setup & Dependencies

```bash
npm install -g docx
```

```javascript
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        LevelFormat, BorderStyle, Table, TableRow, TableCell, WidthType,
        ShadingType, TableLayoutType, Header, Footer, PageNumber, PageBreak,
        VerticalAlign } = require('docx');
const fs = require('fs');
```

## Brand Constants

```javascript
const B = {
  darkNavy:     "0D0D0D",
  navy:         "1A1A2E",
  teal:         "0F969C",
  tealLight:    "6DD5ED",
  xoRed:        "CC0000",
  white:        "FFFFFF",
  headingBlue:  "1A1A2E",
  subheadBlue:  "2F5496",
  bodyText:     "333333",
  mutedGray:    "666666",
  lightGray:    "808080",
  calloutBg:    "F0F7F7",
  calloutBorder:"0F969C",
  riskBg:       "FFF5F5",
  riskBorder:   "CC0000",
  tableBg:      "F1F5F9",
  tableAlt:     "F8FAFC",
  compareBg:    "E8F5E9",
  borderGray:   "BFBFBF",
  navyBar:      "0F172A",
};

// Page dimensions: A4 with 1" margins
const PAGE = {
  width: 11906,
  height: 16838,
  margin: 1440,
  contentWidth: 9026,  // 11906 - 2*1440
};
```

## Core Helper: XO Text Runs

**Every "XO" in the document must be red.** This helper splits any text at "XO" boundaries:

```javascript
function xoTextRuns(text, opts = {}) {
  const { fontSize, fontFace, color, bold, italics } = opts;
  const baseColor = color || B.bodyText;
  const parts = text.split(/(XO)/g);
  return parts.filter(p => p.length > 0).map(part => new TextRun({
    text: part,
    fontSize: fontSize,
    font: fontFace,
    color: part === "XO" ? B.xoRed : baseColor,
    bold: part === "XO" ? true : bold,
    italics: italics,
  }));
}
```

Usage:
```javascript
// "IntellagenticXO" renders as "Intellagentic" in baseColor + "XO" in red
new Paragraph({ children: xoTextRuns("IntellagenticXO · Client Name · CONFIDENTIAL", {
  fontSize: 18, fontFace: "Calibri", color: B.mutedGray
}) });
```

## Borders & Shading Presets

```javascript
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: B.borderGray };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
};

const tealBorderThick = { style: BorderStyle.SINGLE, size: 12, color: B.teal };
const tealBorders = { top: tealBorderThick, bottom: tealBorderThick, left: tealBorderThick, right: tealBorderThick };

const redBorderThick = { style: BorderStyle.SINGLE, size: 12, color: B.xoRed };
const redBorders = { top: redBorderThick, bottom: redBorderThick, left: redBorderThick, right: redBorderThick };

const leftTealBorder = {
  ...noBorders,
  left: { style: BorderStyle.SINGLE, size: 24, color: B.teal }
};

const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const calloutMargins = { top: 150, bottom: 150, left: 240, right: 240 };
```

## Document Configuration

```javascript
function createBriefConfig(coverChildren, bodyChildren) {
  return {
    styles: {
      default: { document: { run: { font: "Calibri", size: 22, color: B.bodyText } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Trebuchet MS", color: B.headingBlue },
          paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Calibri Light", color: B.subheadBlue },
          paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Calibri Light", color: B.navy },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 2 } },
      ]
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ]},
        { reference: "numbers", levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
        ]},
      ]
    },
    sections: [
      // Section 1: Cover page (no header/footer)
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin }
          }
        },
        children: coverChildren
      },
      // Section 2: Body (with header/footer)
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin }
          }
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 200 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: B.teal, space: 4 } },
              children: xoTextRuns("INTELLAGENTICXO \u00B7 CLIENT_NAME \u00B7 XO Deployment Brief \u00B7 CONFIDENTIAL", {
                fontSize: 16, fontFace: "Calibri", color: B.mutedGray
              })
            })]
          })
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { top: { style: BorderStyle.SINGLE, size: 2, color: B.borderGray, space: 4 } },
              children: [
                ...xoTextRuns("IntellagenticXO \u00B7 Strictly Confidential", {
                  fontSize: 16, fontFace: "Calibri", color: B.lightGray
                }),
                new TextRun({ text: "Page ", font: "Calibri", size: 16, color: B.lightGray }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 16, color: B.lightGray }),
              ]
            })]
          })
        },
        children: bodyChildren
      }
    ]
  };
}
```

**IMPORTANT:** Replace `CLIENT_NAME` in the header with the actual client name when building.

## Cover Page

```javascript
function buildCoverPage(clientName, clientLocation, headline, valueProposition, clientContact, preparedBy, meetingDate) {
  return [
    // Dark background simulation: full-width navy table
    new Table({
      width: { size: PAGE.contentWidth, type: WidthType.DXA },
      columnWidths: [PAGE.contentWidth],
      rows: [new TableRow({ children: [new TableCell({
        borders: noBorders,
        shading: { fill: B.darkNavy, type: ShadingType.CLEAR },
        margins: { top: 600, bottom: 600, left: 400, right: 400 },
        width: { size: PAGE.contentWidth, type: WidthType.DXA },
        children: [
          // Top line
          new Paragraph({ spacing: { after: 100 },
            children: xoTextRuns("INTELLAGENTICXO", {
              fontSize: 18, fontFace: "Calibri", color: B.mutedGray, bold: true
            })
          }),
          // Teal accent line
          new Paragraph({
            spacing: { after: 40 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: B.teal, space: 2 } },
            children: []
          }),
          // CONFIDENTIAL tag
          new Paragraph({ spacing: { before: 200, after: 200 },
            children: [new TextRun({
              text: "CONFIDENTIAL \u2014 STRATEGIC DEPLOYMENT BRIEF",
              font: "Calibri", size: 20, color: B.teal, bold: true
            })]
          }),
          // Client name
          new Paragraph({ spacing: { after: 80 },
            children: [new TextRun({
              text: clientName,
              font: "Trebuchet MS", size: 56, color: B.white, bold: true
            })]
          }),
          // Client descriptor + location
          new Paragraph({ spacing: { after: 300 },
            children: [new TextRun({
              text: clientLocation,
              font: "Calibri", size: 22, color: B.tealLight
            })]
          }),
          // XO Deployment headline
          new Paragraph({ spacing: { after: 80 },
            children: xoTextRuns("XO Deployment:", {
              fontSize: 32, fontFace: "Trebuchet MS", color: B.white, bold: true
            })
          }),
          // Headline
          new Paragraph({ spacing: { after: 200 },
            children: [new TextRun({
              text: headline,
              font: "Trebuchet MS", size: 32, color: B.white, bold: true
            })]
          }),
          // Value proposition
          new Paragraph({ spacing: { after: 400 },
            children: [new TextRun({
              text: valueProposition,
              font: "Calibri", size: 20, color: B.mutedGray, italics: true
            })]
          }),
          // Metadata table (Client / Prepared by / Date)
          createCoverMetadataTable(clientContact, preparedBy, meetingDate),
          // Bottom confidential line
          new Paragraph({ spacing: { before: 400 },
            children: [new TextRun({
              text: "\u26A0 STRICTLY CONFIDENTIAL \u2014 NOT FOR DISTRIBUTION",
              font: "Calibri", size: 18, color: B.mutedGray, bold: true
            })]
          }),
        ]
      })]})],
    }),
  ];
}

function createCoverMetadataTable(clientContact, preparedBy, meetingDate) {
  const labelStyle = { font: "Calibri", size: 18, color: B.mutedGray, bold: true };
  const valueStyle = { font: "Calibri", size: 20, color: B.white };
  const colW = Math.floor(PAGE.contentWidth / 3);

  return new Table({
    width: { size: PAGE.contentWidth - 800, type: WidthType.DXA },
    columnWidths: [colW, colW, colW],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: noBorders, width: { size: colW, type: WidthType.DXA },
        shading: { fill: B.darkNavy, type: ShadingType.CLEAR },
        children: [
          new Paragraph({ children: [new TextRun({ text: "Client", ...labelStyle })] }),
          new Paragraph({ children: [new TextRun({ text: clientContact, ...valueStyle })] }),
        ]
      }),
      new TableCell({
        borders: noBorders, width: { size: colW, type: WidthType.DXA },
        shading: { fill: B.darkNavy, type: ShadingType.CLEAR },
        children: [
          new Paragraph({ children: [new TextRun({ text: "Prepared by", ...labelStyle })] }),
          new Paragraph({ children: [new TextRun({ text: preparedBy, ...valueStyle })] }),
        ]
      }),
      new TableCell({
        borders: noBorders, width: { size: colW, type: WidthType.DXA },
        shading: { fill: B.darkNavy, type: ShadingType.CLEAR },
        children: [
          new Paragraph({ children: [new TextRun({ text: "Meeting Date", ...labelStyle })] }),
          new Paragraph({ children: [new TextRun({ text: meetingDate, ...valueStyle })] }),
        ]
      }),
    ]})]
  });
}
```

## Section Headers with Number Badge

```javascript
function sectionHeader(number, title) {
  // Creates "01 CLIENT PROFILE: SUBTITLE" style header
  // Number in teal, title in dark navy
  const colNum = 800;
  const colTitle = PAGE.contentWidth - colNum;

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [colNum, colTitle],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: noBorders,
        shading: { fill: B.navy, type: ShadingType.CLEAR },
        width: { size: colNum, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: number, font: "Trebuchet MS", size: 28, color: B.teal, bold: true
          })]
        })]
      }),
      new TableCell({
        borders: noBorders,
        width: { size: colTitle, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 200, right: 100 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({
            text: title, font: "Trebuchet MS", size: 28, color: B.headingBlue, bold: true
          })]
        })]
      }),
    ]})]
  });
}
```

## Key Metrics Row (Executive Summary)

```javascript
function keyMetricsRow(metrics) {
  // metrics = [{ value: "$4.5bn", label: "Peak Daily Volume", sublabel: "Execution scale requiring zero tolerance" }, ...]
  const colW = Math.floor(PAGE.contentWidth / metrics.length);

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: metrics.map(() => colW),
    rows: [new TableRow({
      children: metrics.map(m => new TableCell({
        borders: noBorders,
        width: { size: colW, type: WidthType.DXA },
        margins: { top: 120, bottom: 120, left: 100, right: 100 },
        shading: { fill: B.tableBg, type: ShadingType.CLEAR },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
            children: [new TextRun({
              text: m.value, font: "Trebuchet MS", size: 48, color: B.teal, bold: true
            })]
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 },
            children: [new TextRun({
              text: m.label, font: "Calibri", size: 20, color: B.headingBlue, bold: true
            })]
          }),
          new Paragraph({ alignment: AlignmentType.CENTER,
            children: [new TextRun({
              text: m.sublabel, font: "Calibri", size: 16, color: B.mutedGray
            })]
          }),
        ]
      }))
    })]
  });
}
```

## Callout Boxes

### Standard Callout (teal border -- THE PRINCIPLE, THE EDGE, SUCCESS METRIC)

```javascript
function calloutBox(label, content) {
  // label: e.g., "THE PRINCIPLE", "THE MINERVA EDGE"
  // content: string or array of TextRun
  const contentRuns = typeof content === 'string' ? xoTextRuns(content, { fontSize: 22 }) : content;

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [PAGE.contentWidth],
    rows: [new TableRow({ children: [new TableCell({
      borders: tealBorders,
      shading: { fill: B.calloutBg, type: ShadingType.CLEAR },
      margins: calloutMargins,
      width: { size: PAGE.contentWidth, type: WidthType.DXA },
      children: [
        new Paragraph({ spacing: { after: 80 },
          children: [new TextRun({
            text: label, font: "Calibri", size: 22, color: B.teal, bold: true
          })]
        }),
        new Paragraph({ spacing: { after: 0 }, children: contentRuns }),
      ]
    })]})],
  });
}
```

### Risk/Warning Callout (red border)

```javascript
function riskCallout(label, content) {
  const contentRuns = typeof content === 'string' ? xoTextRuns(content, { fontSize: 22 }) : content;

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [PAGE.contentWidth],
    rows: [new TableRow({ children: [new TableCell({
      borders: redBorders,
      shading: { fill: B.riskBg, type: ShadingType.CLEAR },
      margins: calloutMargins,
      width: { size: PAGE.contentWidth, type: WidthType.DXA },
      children: [
        new Paragraph({ spacing: { after: 80 },
          children: [new TextRun({
            text: "\u26A0 " + label, font: "Calibri", size: 22, color: B.xoRed, bold: true
          })]
        }),
        new Paragraph({ spacing: { after: 0 }, children: contentRuns }),
      ]
    })]})],
  });
}
```

## Comparison Table (Current State vs Target State)

```javascript
function comparisonTable(leftHeader, rightHeader, rows) {
  // rows = [{ left: "Current state text", right: "Target state text" }, ...]
  const colW = Math.floor(PAGE.contentWidth / 2);
  const headerBorder = { style: BorderStyle.SINGLE, size: 4, color: B.borderGray };
  const hBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [colW, colW],
    rows: [
      // Header row
      new TableRow({ children: [
        new TableCell({
          borders: hBorders, width: { size: colW, type: WidthType.DXA },
          shading: { fill: B.tableBg, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({
            text: leftHeader, font: "Calibri", bold: true, size: 22
          })] })]
        }),
        new TableCell({
          borders: hBorders, width: { size: colW, type: WidthType.DXA },
          shading: { fill: B.compareBg, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({
            children: xoTextRuns(rightHeader, { fontSize: 22, bold: true })
          })]
        }),
      ]}),
      // Data rows
      ...rows.map(row => new TableRow({ children: [
        new TableCell({
          borders: hBorders, width: { size: colW, type: WidthType.DXA },
          margins: cellMargins,
          children: [new Paragraph({
            children: xoTextRuns(row.left, { fontSize: 20, color: B.bodyText })
          })]
        }),
        new TableCell({
          borders: hBorders, width: { size: colW, type: WidthType.DXA },
          shading: { fill: B.compareBg, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({
            children: xoTextRuns(row.right, { fontSize: 20, color: B.bodyText })
          })]
        }),
      ]}))
    ]
  });
}
```

## Two-Column Layout (for Section 01 and 03)

```javascript
function twoColumnLayout(leftTitle, leftItems, rightTitle, rightItems) {
  // leftItems / rightItems = [{ bold: "Label:", text: " description" }, ...]
  const colW = Math.floor(PAGE.contentWidth / 2);

  function columnChildren(title, items) {
    return [
      new Paragraph({ spacing: { after: 120 },
        children: [new TextRun({ text: title, font: "Calibri", size: 24, bold: true, color: B.headingBlue })]
      }),
      ...items.map(item => new Paragraph({
        spacing: { after: 80 },
        numbering: { reference: "bullets", level: 0 },
        children: [
          new TextRun({ text: item.bold, bold: true, size: 20 }),
          ...xoTextRuns(item.text, { fontSize: 20, color: B.bodyText }),
        ]
      }))
    ];
  }

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [colW, colW],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: noBorders, width: { size: colW, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 0, right: 200 },
        children: columnChildren(leftTitle, leftItems)
      }),
      new TableCell({
        borders: noBorders, width: { size: colW, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 200, right: 0 },
        children: columnChildren(rightTitle, rightItems)
      }),
    ]})]
  });
}
```

## OODA Loop Phases

```javascript
function oodaPhase(icon, phaseName, tagline, subBullets) {
  // icon: emoji string, e.g., "\uD83D\uDC41" (eye)
  // subBullets = [{ bold: "Sub-label:", text: " description" }, ...]
  return [
    new Paragraph({ spacing: { before: 240, after: 80 },
      children: [
        new TextRun({ text: icon + " ", font: "Calibri", size: 28 }),
        new TextRun({ text: phaseName, font: "Trebuchet MS", size: 28, bold: true, color: B.teal }),
      ]
    }),
    new Paragraph({ spacing: { after: 120 },
      children: [new TextRun({
        text: tagline, font: "Calibri", size: 22, color: B.headingBlue, italics: true
      })]
    }),
    ...subBullets.map(b => new Paragraph({
      spacing: { after: 60 },
      indent: { left: 360 },
      children: [
        new TextRun({ text: "\u2013 ", size: 20 }),
        new TextRun({ text: b.bold, bold: true, size: 20 }),
        ...xoTextRuns(b.text, { fontSize: 20, color: B.bodyText }),
      ]
    }))
  ];
}
```

## POC Timeline Table

```javascript
function pocTimelineTable(steps) {
  // steps = [{ step: "1", timeline: "Immediate", action: "Description..." }, ...]
  const colStep = 600;
  const colTime = 1400;
  const colAction = PAGE.contentWidth - colStep - colTime;

  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [colStep, colTime, colAction],
    rows: [
      // Header
      new TableRow({ children: [
        new TableCell({ borders, width: { size: colStep, type: WidthType.DXA },
          shading: { fill: B.navy, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: "Step", bold: true, color: B.white, size: 20 })] })]
        }),
        new TableCell({ borders, width: { size: colTime, type: WidthType.DXA },
          shading: { fill: B.navy, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: "Timeline", bold: true, color: B.white, size: 20 })] })]
        }),
        new TableCell({ borders, width: { size: colAction, type: WidthType.DXA },
          shading: { fill: B.navy, type: ShadingType.CLEAR }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: "Action", bold: true, color: B.white, size: 20 })] })]
        }),
      ]}),
      // Data rows
      ...steps.map((s, i) => new TableRow({ children: [
        new TableCell({ borders, width: { size: colStep, type: WidthType.DXA },
          shading: { fill: i % 2 === 0 ? B.white : B.tableAlt, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({ alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: s.step, bold: true, size: 20, color: B.teal })] })]
        }),
        new TableCell({ borders, width: { size: colTime, type: WidthType.DXA },
          shading: { fill: i % 2 === 0 ? B.white : B.tableAlt, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: s.timeline, bold: true, size: 20 })] })]
        }),
        new TableCell({ borders, width: { size: colAction, type: WidthType.DXA },
          shading: { fill: i % 2 === 0 ? B.white : B.tableAlt, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({
            children: xoTextRuns(s.action, { fontSize: 20, color: B.bodyText })
          })]
        }),
      ]}))
    ]
  });
}
```

## Body Text Helpers

```javascript
function para(text, opts = {}) {
  const children = typeof text === 'string' ? xoTextRuns(text, { fontSize: 22 }) : text;
  return new Paragraph({ spacing: { after: 160, ...opts.spacing }, ...opts, children });
}

function boldPara(boldText, normalText) {
  return new Paragraph({ spacing: { after: 160 },
    children: [
      new TextRun({ text: boldText, bold: true, size: 22 }),
      ...xoTextRuns(normalText, { fontSize: 22 }),
    ]
  });
}

function bulletItem(boldText, normalText, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80 },
    children: [
      new TextRun({ text: boldText, bold: true, size: 20 }),
      ...xoTextRuns(normalText, { fontSize: 20 }),
    ]
  });
}

function spacer(twips = 200) {
  return new Paragraph({ spacing: { after: twips }, children: [] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
```

## Data Table (Generic)

```javascript
function dataTable(headers, rows, columnWidths) {
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths,
    rows: [
      new TableRow({ children: headers.map((h, i) => new TableCell({
        borders, width: { size: columnWidths[i], type: WidthType.DXA },
        shading: { fill: B.tableBg, type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] })]
      }))}),
      ...rows.map(row => new TableRow({ children: row.map((cell, i) => new TableCell({
        borders, width: { size: columnWidths[i], type: WidthType.DXA },
        margins: cellMargins,
        children: [new Paragraph({
          children: typeof cell === 'string' ? xoTextRuns(cell, { fontSize: 20 }) : [cell]
        })]
      }))}))
    ]
  });
}
```

## Assembly Pattern

The build script follows this pattern:

```javascript
// 1. Build cover page
const cover = buildCoverPage(
  "MFP Trading Ltd.",
  "Institutional FX Execution \u00B7 Becket House, Old Jewry, London",
  "Eliminating the 24/5 Escalation Crisis",
  "Protocol-grade exception management for an environment where mismanaged exposure costs $50,000\u2013$100,000 in seconds",
  "Francois Nembrini\nFounder & Director, MFP Trading",
  "Alan Moore, Richie Saville\n& Ken Scott\nIntellagenticXO",
  "24 February 2026\nFollow-up: March 2026"
);

// 2. Build body sections
const body = [
  // EXECUTIVE SUMMARY
  para("EXECUTIVE SUMMARY", { heading: HeadingLevel.HEADING_1 }),
  para("MFP Trading processes thousands of trades daily..."),
  spacer(),
  keyMetricsRow([
    { value: "$4.5bn", label: "Peak Daily Volume", sublabel: "Execution scale requiring zero tolerance" },
    // ... more metrics
  ]),
  spacer(),

  // SECTION 01
  pageBreak(),
  sectionHeader("01", "CLIENT PROFILE: MFP TRADING LTD."),
  para("MFP Trading Ltd. was established in 2017..."),
  twoColumnLayout("Technology Infrastructure", [...], "Leadership", [...]),
  calloutBox("THE MINERVA EDGE", "The Minerva platform represents..."),

  // SECTION 02
  pageBreak(),
  sectionHeader("02", "THE OPERATIONAL CRISIS: ANATOMY OF THE BOTTLENECK"),
  // ... content ...
  comparisonTable("The Current Reality", "The Target State (XO)", [...]),
  riskCallout("RISK CONTEXT", "In institutional FX, exception resolution speed..."),

  // SECTION 03
  pageBreak(),
  sectionHeader("03", "WHY STANDARD AI CANNOT BE USED HERE"),
  twoColumnLayout("The Problem with Probabilistic AI", [...], "What Protocol-Grade Exception Handling Requires", [...]),
  calloutBox("THE PRINCIPLE", "The IntellagenticXO is not a language model..."),

  // SECTION 04
  pageBreak(),
  sectionHeader("04", "THE XO DEPLOYMENT: ARCHITECTURE & OODA WORKFLOW"),
  // DX Cartridge subsection
  // OODA phases
  ...oodaPhase("\uD83D\uDC41", "OBSERVE", "Exception Detection & State Capture", [...]),
  ...oodaPhase("\u2699", "ORIENT", "Historical Matching & Risk Classification", [...]),
  ...oodaPhase("\uD83E\uDDE0", "DECIDE", "Procedure Selection & Evidence Assembly", [...]),
  ...oodaPhase("\u26A1", "ACT", "Guided Resolution & Traceable Escalation", [...]),

  // SECTION 05
  pageBreak(),
  sectionHeader("05", "CONSTITUTIONAL SAFETY: THE NON-NEGOTIABLE GUARDRAILS"),
  twoColumnLayout("What the Safety Layer Prevents", [...], "What the Safety Layer Guarantees", [...]),
  calloutBox("THE GUARANTEE", "The XO does not make MFP's operation infallible..."),

  // SECTION 06
  pageBreak(),
  sectionHeader("06", "PROOF OF CONCEPT & NEXT STEPS"),
  pocTimelineTable([...]),
  calloutBox("SUCCESS METRIC", "The pilot is successful when Francois sleeps..."),
];

// 3. Create document
const doc = new Document(createBriefConfig(cover, body));

// 4. Save
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("deployment-brief.docx", buffer);
});
```

## Adapting to New Clients

When creating a brief for a new client, adapt:

1. **Cover page:** Client name, location, headline, value proposition
2. **Key metrics:** 4 domain-specific stats (dollar amounts, volumes, time periods, headcount)
3. **Section 01:** Company background, technology stack (their systems, not ours), leadership bios
4. **Section 02:** Domain-specific bottlenecks (not FX -- whatever the client's operational domain is)
5. **Section 03:** Why LLMs fail specifically in THEIR domain (not generic -- tied to their risk profile)
6. **Section 04:** DX Cartridge contents and OODA examples adapted to their exception/event types
7. **Section 05:** Safety guardrails specific to their regulatory and risk environment
8. **Section 06:** Their deliverables in the POC timeline, their success metric

The structure is fixed. The content is entirely domain-adapted.