import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import type { HealthReport, ReportPdf } from '../types/healthReport';
import { assertIdentity } from './queryCore';
import { reportTimeout } from './healthReportService';
import { DataAccessError } from '../lib/dataErrors';

let creating = false;
export async function createHealthReportPdf(report: HealthReport, html: string): Promise<ReportPdf> {
  if (creating) throw new DataAccessError('INVALID_INPUT', 'report.busy');
  creating = true;
  let expired = false;
  const state: { output: File | null } = { output: null };
  const operation = (async () => {
    await assertIdentity(report.owner);
    const printed = await Print.printToFileAsync({ html, width: 595.28, height: 841.89,
      margins: { top: 0, right: 0, bottom: 0, left: 0 } });
    state.output = new File(printed.uri);
    if (expired) { state.output.delete(); throw new DataAccessError('NETWORK', 'report.timeout'); }
    await assertIdentity(report.owner);
    const filename = `HealthyCheck_Report_${report.start}_${report.end}.pdf`;
    // Unique cache directory avoids overwriting a PDF still open in another app.
    const directory = new Directory(Paths.cache, 'health-reports', report.owner, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    directory.create({ intermediates: true });
    const destination = new File(directory, filename);
    await state.output.move(destination);
    state.output = destination;
    const [canPreview, canShare] = await Promise.all([
      destination.canPreview({ mimeType: 'application/pdf' }).catch(() => false),
      Sharing.isAvailableAsync().catch(() => false),
    ]);
    await assertIdentity(report.owner);
    if (expired) throw new DataAccessError('NETWORK', 'report.timeout');
    if (!destination.exists || destination.size === 0 || printed.numberOfPages < 1) throw new Error('report.pdfFailed');
    return { owner: report.owner, uri: destination.uri, filename, canPreview, canShare };
  })();
  try { return await reportTimeout(operation, 45000); }
  catch (error) { expired = true; try { if (state.output?.exists) state.output.delete(); } catch { /* Best-effort cache cleanup. */ } throw error; }
  finally {
    // A timed-out native print may still be running. Keep the native operation serialized.
    void operation.finally(() => { creating = false; if (expired) { try { if (state.output?.exists) state.output.delete(); } catch { /* Cache may already be gone. */ } } }).catch(() => {});
  }
}
export async function openReportPdf(pdf: ReportPdf) {
  await assertIdentity(pdf.owner);
  const file = new File(pdf.uri);
  if (!(await file.canPreview({ mimeType: 'application/pdf' }))) throw new Error('report.previewUnavailable');
  await assertIdentity(pdf.owner);
  await file.preview({ mimeType: 'application/pdf', title: pdf.filename });
}
export async function shareReportPdf(pdf: ReportPdf) {
  await assertIdentity(pdf.owner);
  if (!(await Sharing.isAvailableAsync())) throw new Error('report.shareUnavailable');
  await assertIdentity(pdf.owner);
  await Sharing.shareAsync(pdf.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: pdf.filename });
}
export async function printReportPdf(pdf: ReportPdf) {
  await assertIdentity(pdf.owner);
  await Print.printAsync({ uri: pdf.uri });
}
