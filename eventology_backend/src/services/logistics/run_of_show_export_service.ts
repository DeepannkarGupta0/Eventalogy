/**
 * Run of Show Export Service (Milestone 58)
 *
 * Generates industry-standard printable Call Sheets and Cue Sheets:
 * 1. Landscape A4/US-Letter tabular PDF call sheet with official verification hash.
 * 2. RFC 4180 compliant CSV export for spreadsheet software and stage clipboards.
 */

import PDFDocument from "pdfkit";
import { createHash } from "crypto";
import { LiveOperationsSession } from "./live_operations_service";

export interface CallSheetPdfResult {
  buffer: Buffer;
  pageCount: number;
  sha256Hash: string;
  byteSize: number;
}

export class RunOfShowExportService {
  /**
   * Generates an RFC 4180 compliant CSV string of the Run of Show.
   */
  public static generateCallSheetCsv(session: LiveOperationsSession): string {
    const headers = [
      "Cue Number",
      "Act",
      "Scheduled Time",
      "Duration (s)",
      "Title",
      "Action Summary",
      "Audio Cue",
      "Lighting Preset",
      "Video Content",
      "Operator",
      "Contingency Action",
      "Execution Status",
    ];

    const escapeCsv = (str?: string | number | null): string => {
      if (str === undefined || str === null) return '""';
      let s = String(str).replace(/"/g, '""');
      // Neutralize CSV Formula Injection (CWE-1236) across Excel, Numbers, and Google Sheets
      if (/^[=+\-@\t\r]/.test(s)) {
        s = `'${s}`;
      }
      return `"${s}"`;
    };

    const rows = session.cues.map((c) => [
      escapeCsv(c.cueNumber),
      escapeCsv(c.act),
      escapeCsv(c.scheduledTime),
      escapeCsv(c.durationSeconds),
      escapeCsv(c.title),
      escapeCsv(c.actionSummary),
      escapeCsv(c.audioCue ?? "Standard"),
      escapeCsv(c.lightingCue ?? "Standard"),
      escapeCsv(c.videoCue ?? "Standard"),
      escapeCsv(c.operator ?? "Stage Crew"),
      escapeCsv(c.contingencyAction ?? "None"),
      escapeCsv(c.executionStatus),
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  }

  /**
   * Generates a broadcast-grade landscape A4 PDF Call Sheet.
   */
  public static async generateCallSheetPdf(
    session: LiveOperationsSession,
    venueName: string = "Main Stage Ballroom"
  ): Promise<CallSheetPdfResult> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          layout: "landscape",
          margins: { top: 30, bottom: 30, left: 35, right: 35 },
          bufferPages: true,
          info: {
            Title: `Run of Show Call Sheet: ${session.sessionId}`,
            Author: "Eventology Autonomous Engineering System",
            Subject: "Day-of-Event Master Run of Show Call Sheet",
            CreationDate: new Date(),
          },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("error", (err: Error) => reject(err));
        doc.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const sha256Hash = createHash("sha256").update(buffer).digest("hex");
          resolve({
            buffer,
            pageCount: doc.bufferedPageRange().count || 1,
            sha256Hash,
            byteSize: buffer.length,
          });
        });

        const pageWidth = 841.89; // A4 landscape width
        const printableWidth = pageWidth - 70; // 771.89
        const startX = 35;

        // --- Header Block ---------------------------------------------------
        doc.rect(startX, 30, printableWidth, 48).fill("#0F172A");
        doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold");
        doc.text("EVENTOLOGY RUN OF SHOW CALL SHEET", startX + 15, 42);

        doc.fillColor("#94A3B8").fontSize(8).font("Helvetica");
        doc.text(`SESSION ID: ${session.sessionId}`, startX + 15, 60);
        doc.text(`VENUE: ${venueName}`, startX + 260, 60);
        doc.text(`TOTAL CUES: ${session.cues.length}`, startX + 500, 60);
        doc.text(`GENERATED: ${new Date().toISOString().substring(0, 19)}Z`, startX + 620, 60);

        doc.y = 86;

        // --- Table Headers --------------------------------------------------
        const colW = [50, 65, 55, 170, 115, 110, 105, 101.89];
        let tableY = doc.y;

        doc.rect(startX, tableY, printableWidth, 20).fill("#1E293B");
        doc.fillColor("#F8FAFC").fontSize(8).font("Helvetica-Bold");

        doc.text("CUE #", startX + 5, tableY + 6);
        doc.text("PHASE", startX + colW[0] + 5, tableY + 6);
        doc.text("TIME", startX + colW[0] + colW[1] + 5, tableY + 6);
        doc.text("SCENIC ACTION & TITLE", startX + colW[0] + colW[1] + colW[2] + 5, tableY + 6);
        doc.text("AUDIO SCENE", startX + colW[0] + colW[1] + colW[2] + colW[3] + 5, tableY + 6);
        doc.text("LIGHTING LOOK", startX + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + 5, tableY + 6);
        doc.text("VIDEO CONTENT", startX + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] + 5, tableY + 6);
        doc.text("OPERATOR", startX + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] + colW[6] + 5, tableY + 6);

        tableY += 20;

        // --- Rows -----------------------------------------------------------
        session.cues.forEach((cue, index) => {
          // If we reach near the page bottom, start a new page
          if (tableY > 520) {
            doc.addPage();
            tableY = 35;
          }

          const isEven = index % 2 === 0;
          doc.rect(startX, tableY, printableWidth, 22).fill(isEven ? "#F8FAFC" : "#FFFFFF");
          doc.rect(startX, tableY, printableWidth, 22).strokeColor("#E2E8F0").stroke();

          doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#0F172A");
          doc.text(cue.cueNumber, startX + 5, tableY + 6, { width: colW[0] - 8 });

          doc.font("Helvetica").fillColor("#64748B");
          doc.text(cue.act, startX + colW[0] + 5, tableY + 6, { width: colW[1] - 8 });

          doc.font("Helvetica-Bold").fillColor("#0369A1");
          doc.text(cue.scheduledTime, startX + colW[0] + colW[1] + 5, tableY + 6, { width: colW[2] - 8 });

          doc.font("Helvetica").fillColor("#1E293B");
          doc.text(cue.title, startX + colW[0] + colW[1] + colW[2] + 5, tableY + 6, {
            width: colW[3] - 8,
            ellipsis: true,
          });

          doc.fillColor("#475569");
          doc.text(cue.audioCue ?? "Standard", startX + colW[0] + colW[1] + colW[2] + colW[3] + 5, tableY + 6, {
            width: colW[4] - 8,
            ellipsis: true,
          });

          doc.text(cue.lightingCue ?? "Standard", startX + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + 5, tableY + 6, {
            width: colW[5] - 8,
            ellipsis: true,
          });

          doc.text(cue.videoCue ?? "Standard", startX + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] + 5, tableY + 6, {
            width: colW[6] - 8,
            ellipsis: true,
          });

          doc.font("Helvetica-Bold").fillColor("#0F172A");
          doc.text(cue.operator ?? "Stage Crew", startX + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] + colW[6] + 5, tableY + 6, {
            width: colW[7] - 8,
            ellipsis: true,
          });

          tableY += 22;
        });

        // --- Footer ---------------------------------------------------------
        doc.rect(startX, 545, printableWidth, 20).fill("#F1F5F9");
        doc.fontSize(7).font("Helvetica").fillColor("#64748B");
        doc.text("OFFICIAL STAGE PRODUCTION CUE SHEET — AUTHORIZED FOR FIELD STAGE CREW ONLY", startX + 15, 551);
        doc.text("ALL RIGHTS RESERVED • EVENTOLOGY 2.0", startX + 610, 551);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

