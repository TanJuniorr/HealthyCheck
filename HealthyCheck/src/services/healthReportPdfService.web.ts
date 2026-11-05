import type { HealthReport, ReportPdf } from '../types/healthReport';
import { assertIdentity } from './queryCore';

/** Browser printing cannot return a local PDF URI or confirm that a file was saved. */
export async function createHealthReportPdf(report: HealthReport, html: string): Promise<ReportPdf> {
  await assertIdentity(report.owner);
  return { owner: report.owner, uri: '', html, filename: `HealthyCheck_Report_${report.start}_${report.end}.pdf`, canPreview: true, canShare: false };
}
export async function openReportPdf(pdf: ReportPdf) {
  // Reserve the window synchronously during the user's click, before awaiting auth.
  const preview = window.open('', '_blank');
  if (!preview) throw new Error('report.popupBlocked');
  try {
    await assertIdentity(pdf.owner);
    if (!pdf.html || preview.closed) throw new Error('report.previewUnavailable');
    preview.opener = null;
    preview.document.open();
    preview.document.write(pdf.html);
    preview.document.close();
    await preview.document.fonts.ready;
    await assertIdentity(pdf.owner);
    preview.focus();
    preview.print();
  } catch (error) { preview.close(); throw error; }
}
export const printReportPdf = openReportPdf;
export async function shareReportPdf(_pdf: ReportPdf) { throw new Error('report.shareUnavailable'); }
