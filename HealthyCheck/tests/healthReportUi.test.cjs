/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { uiFixture, elements } = require('./ui-fixture.cjs');
const createLoader = require('./load-ts.cjs');
const { A, B, source, fullSource } = require('./health-report-fixture.cjs');
const dataLoad = createLoader();
const { toLocalDateKey, getDaysInRange } = dataLoad('src/lib/dateUtils');
const { buildHealthReport } = dataLoad('src/lib/healthReportCalculations');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  let focus, lastFocus, cleanup, owner = A, language = options.language ?? 'vi';
  const calls = [], pdfCalls = [], actions = [];
  const reportService = { loadHealthReport: async (start, end, expected) => {
    calls.push({ start, end, expected });
    if (options.load) return options.load(start, end, expected);
    return buildHealthReport(options.empty ? source({ owner: expected }) : fullSource(getDaysInRange(start, end)), start, end);
  } };
  const f = uiFixture({
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-router': { useFocusEffect: callback => { focus = callback; }, useRouter: () => ({ back() {} }) },
    [path.resolve(__dirname, '../src/contexts/AuthContext.tsx')]: { useAuth: () => ({ user: owner ? { id: owner } : null }) },
    [path.resolve(__dirname, '../src/components/common/AppHeader.tsx')]: { AppHeader: 'AppHeader' },
    [path.resolve(__dirname, '../src/components/common/CalendarDatePicker.tsx')]: { CalendarDatePicker: 'CalendarDatePicker' },
    [path.resolve(__dirname, '../src/services/queryCore.ts')]: { assertIdentity: async expected => { if (owner !== expected) throw Object.assign(new Error('changed'), { code: 'AUTH_CHANGED' }); } },
    [path.resolve(__dirname, '../src/services/healthReportService.ts')]: reportService,
    [path.resolve(__dirname, '../src/services/healthReportPdfService.ts')]: {
      createHealthReportPdf: async (report, html) => { pdfCalls.push({ report, html }); if (options.pdf) return options.pdf(report, html); return { owner: report.owner, uri: 'file:///report.pdf', filename: 'report.pdf', canPreview: true, canShare: true }; },
      openReportPdf: async pdf => { actions.push(['open', pdf]); },
      shareReportPdf: async pdf => { actions.push(['share', pdf]); if (options.cancelShare) throw new Error('User cancelled'); },
      printReportPdf: async pdf => { actions.push(['print', pdf]); },
    },
  });
  const i18n = f.load('src/i18n/index').default;
  const Screen = f.load('app/health/report').default;
  function render() {
    const tree = f.renderDeep(Screen);
    if (focus && focus !== lastFocus) { cleanup?.(); lastFocus = focus; cleanup = focus(); }
    return tree;
  }
  const byText = (tree, text) => elements(tree).find(node => ['PrimaryButton', 'TextButton'].includes(node.type) && node.props.title === text);
  const byRoleText = (tree, role, text) => elements(tree).find(node => node.props?.accessibilityRole === role && elements(node).some(child => child.props?.children === text));
  return { ...f, render, calls, pdfCalls, actions, byText, byRoleText, i18n,
    async initialize() { await f.load('src/i18n/index').initialization; await i18n.changeLanguage(language); render(); await tick(); return render(); },
    setOwner(value) { owner = value; }, async setLanguage(value) { language = value; await i18n.changeLanguage(value); },
    close() { cleanup?.(); f.unmount(); },
  };
}

test('report screen defaults to 7 inclusive local days, selects 30/custom and validates the calendar range', async () => {
  const f = fixture(); let tree = await f.initialize();
  assert.equal(getDaysInRange(f.calls[0].start, f.calls[0].end).length, 7);
  f.byRoleText(tree, 'radio', '30 ngày gần nhất').props.onPress(); tree = f.render(); await tick(); tree = f.render();
  assert.equal(getDaysInRange(f.calls.at(-1).start, f.calls.at(-1).end).length, 30);
  f.byRoleText(tree, 'radio', 'Tùy chọn').props.onPress(); tree = f.render();
  elements(tree).find(node => node.props?.accessibilityLabel === 'Ngày bắt đầu').props.onPress(); tree = f.render();
  const calendar = elements(tree).find(node => node.type === 'CalendarDatePicker');
  assert.equal(calendar.props.maxDate, toLocalDateKey());
  calendar.props.onSelect('2099-01-01'); tree = f.render();
  assert.ok(f.byText(tree, 'Tạo báo cáo PDF').props.disabled);
  assert.ok(elements(tree).some(node => node.props?.children === f.i18n.t('report.invalidRange')));
  f.close();
});
test('empty report needs explicit consent and resets that consent when the range changes', async () => {
  const f = fixture({ empty: true }); let tree = await f.initialize();
  assert.ok(f.byText(tree, 'Tạo báo cáo PDF').props.disabled);
  elements(tree).find(node => node.props?.accessibilityRole === 'checkbox').props.onPress(); tree = f.render();
  assert.equal(f.byText(tree, 'Tạo báo cáo PDF').props.disabled, false);
  f.byRoleText(tree, 'radio', '30 ngày gần nhất').props.onPress(); tree = f.render(); await tick(); tree = f.render();
  assert.ok(f.byText(tree, 'Tạo báo cáo PDF').props.disabled);
  assert.equal(f.pdfCalls.length, 0); f.close();
});
test('UI reloads data for export, locks duplicate taps and keeps the PDF after share cancellation', async () => {
  let release;
  const f = fixture({ cancelShare: true, pdf: async report => await new Promise(resolve => { release = () => resolve({ owner: report.owner, uri: 'file:///report.pdf', filename: 'report.pdf', canPreview: true, canShare: true }); }) });
  let tree = await f.initialize();
  const button = f.byText(tree, 'Tạo báo cáo PDF');
  const pending = button.props.onPress(), duplicate = button.props.onPress();
  await tick(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.calls.length, 2); assert.equal(f.pdfCalls.length, 1);
  tree = f.render(); assert.ok(f.byText(tree, 'Tạo báo cáo PDF').props.loading);
  release(); await Promise.all([pending, duplicate]); tree = f.render();
  assert.ok(f.byText(tree, 'Chia sẻ / Lưu PDF'));
  await f.byText(tree, 'Chia sẻ / Lưu PDF').props.onPress(); tree = f.render();
  assert.ok(f.byText(tree, 'Chia sẻ / Lưu PDF'));
  assert.equal(elements(tree).filter(node => node.props?.accessibilityRole === 'alert').length, 0);
  await f.byText(tree, 'In / Lưu thành PDF').props.onPress(); assert.equal(f.actions.at(-1)[0], 'open');
  f.close();
});
test('load errors expose retry, unauthenticated users cannot export and language changes invalidate existing output', async () => {
  let failing = true;
  const f = fixture({ language: 'en', load: async (start, end) => { if (failing) throw new Error('network'); return buildHealthReport(fullSource(getDaysInRange(start, end)), start, end); } });
  let tree = await f.initialize();
  assert.ok(elements(tree).some(node => node.props?.children === f.i18n.t('report.loadFailed')));
  failing = false; f.byText(tree, 'Try again').props.onPress(); tree = f.render(); await tick(); tree = f.render();
  await f.byText(tree, 'Create PDF report').props.onPress(); tree = f.render();
  assert.ok(f.byText(tree, 'Print / Save as PDF'));
  await f.setLanguage('vi'); tree = f.render();
  assert.equal(f.byText(tree, 'In / Lưu thành PDF'), undefined);
  assert.ok(f.byText(tree, 'Tạo báo cáo PDF'));
  f.setOwner(null); tree = f.render();
  assert.ok(f.byText(tree, 'Tạo báo cáo PDF').props.disabled); f.close();
});
test('account change during generation discards the old PDF and never exposes its actions', async () => {
  let release;
  const f = fixture({ pdf: async report => await new Promise(resolve => { release = () => resolve({ owner: report.owner, uri: 'file:///old.pdf', canPreview: true }); }) });
  let tree = await f.initialize();
  const pending = f.byText(tree, 'Tạo báo cáo PDF').props.onPress();
  await tick(); await new Promise(resolve => setTimeout(resolve, 5));
  f.setOwner(B); tree = f.render(); release(); await pending; tree = f.render();
  assert.equal(f.byText(tree, 'In / Lưu thành PDF'), undefined); f.close();
});
