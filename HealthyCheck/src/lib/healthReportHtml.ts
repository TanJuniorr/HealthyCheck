import type { TFunction } from 'i18next';
import type { HealthReport, ReportDay, ReportMetric } from '../types/healthReport';
import { parseLocalDate, timestampDateKey } from './dateUtils';
import { reportChartBuckets } from './healthReportCalculations';

export function escapeReportHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function healthReportHtml(report: HealthReport, t: TFunction, language: string): string {
  const locale = language.startsWith('vi') ? 'vi-VN' : 'en-US';
  const e = escapeReportHtml;
  const label = (key: string) => e(t(key));
  const missing = label('report.noData');
  const number = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value) ? missing : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parseLocalDate(value));
  const shortDate = (value: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(parseLocalDate(value));
  const duration = (minutes: number | null) => minutes === null ? missing : e(t('report.duration', { hours: Math.floor(Math.round(minutes) / 60), minutes: Math.round(minutes) % 60 }));
  const value = (n: number | null, unit: string, digits = 0) => n === null ? missing : `${number(n, digits)} ${e(unit)}`;
  const range = `${date(report.start)} - ${date(report.end)}`;
  const stamp = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short', timeZone: report.timeZone }).format(new Date(report.generatedAt));
  const row = (name: string, text: string) => `<tr><th>${name}</th><td>${text}</td></tr>`;
  const table = (rows: string[]) => `<table>${rows.join('')}</table>`;
  const recorded = (metric: ReportMetric) => e(t('report.recordedDenominator', { count: metric.recordedDays, total: report.dayCount }));
  const goals = (metric: ReportMetric) => metric.eligibleDays ? e(t('report.goalRatio', { achieved: metric.achievedDays, eligible: metric.eligibleDays })) : label('report.notEvaluable');
  const goalRange = (metric: ReportMetric, unit: string) => {
    const targets = metric.daily.map(day => day.goal).filter((n): n is number => n !== null);
    if (!targets.length) return label('report.noGoal');
    const min = Math.min(...targets), max = Math.max(...targets);
    return `${number(min)}${min === max ? '' : ` - ${number(max)}`} ${e(unit)}`;
  };
  const dayValue = (day: ReportDay | null, unit: string, sleep = false) => day === null ? missing : `${date(day.date)} · ${sleep ? duration(day.value) : value(day.value, unit)}`;
  const chart = (metric: ReportMetric, unit: string, scale = 1) => {
    const buckets = reportChartBuckets(metric.daily);
    const values = buckets.flatMap(bucket => [bucket.value, bucket.goal]).filter((n): n is number => n !== null).map(n => n / scale);
    const top = Math.max(1, ...values) * 1.08;
    const left = 54, width = 526, bottom = 110, height = 87, slot = width / buckets.length;
    const y = (n: number) => bottom - (n / scale / top) * height;
    let svg = `<text x="${left}" y="12" class="unit">${e(unit)}</text>`;
    for (const fraction of [0, 0.5, 1]) {
      const lineY = bottom - fraction * height;
      svg += `<line x1="${left}" x2="585" y1="${lineY}" y2="${lineY}" stroke="#d8e1e5"/><text x="48" y="${lineY + 4}" text-anchor="end">${number(top * fraction, 1)}</text>`;
    }
    buckets.forEach((bucket, index) => {
      const x = left + slot * (index + 0.5), barWidth = Math.min(25, slot * 0.5);
      if (bucket.value === null) svg += `<text x="${x}" y="${bottom - 3}" text-anchor="middle" fill="#727f86">×</text>`;
      else if (bucket.value === 0) svg += `<circle cx="${x}" cy="${bottom}" r="3" fill="#087f8c"/>`;
      else svg += `<rect x="${x - barWidth / 2}" y="${y(bucket.value)}" width="${barWidth}" height="${bottom - y(bucket.value)}" rx="2" fill="#087f8c"/>`;
      if (bucket.goal !== null) svg += `<line x1="${x - slot * 0.4}" x2="${x + slot * 0.4}" y1="${y(bucket.goal)}" y2="${y(bucket.goal)}" stroke="#765433" stroke-width="2" stroke-dasharray="4 2"/>`;
      svg += `<text x="${x}" y="125" text-anchor="middle">${shortDate(bucket.date)}</text>`;
      if (metric.daily.length > 14) svg += `<text x="${x}" y="138" text-anchor="middle">${bucket.count}/${bucket.days}</text>`;
    });
    return `<div class="chart"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 145" role="img" aria-label="${e(unit)}">${svg}</svg><p class="legend">${label(metric.daily.length > 14 ? 'report.weeklyChart' : 'report.dailyChart')} · ${label('report.chartLegend')}</p></div>`;
  };
  const panel = (title: string, rows: string[], graphic: string) => `<section class="panel"><h2>${title}</h2><div class="analysis"><div class="stats">${table(rows)}</div>${graphic}</div></section>`;
  const unitSteps = t('report.stepsUnit'), unitMinutes = t('report.minutesUnit');
  const sections: string[] = [];
  if (report.steps.recordedDays) sections.push(panel(label('report.stepsAnalysis'), [
    row(label('report.total'), value(report.steps.total, unitSteps)),
    row(label('report.averageRecorded'), value(report.steps.average, unitSteps)),
    row(label('report.coverage'), recorded(report.steps)),
    row(label('report.bestDay'), dayValue(report.steps.best, unitSteps)),
    row(label('report.effectiveGoal'), goalRange(report.steps, unitSteps)),
    row(label('report.achieved'), goals(report.steps)),
  ], chart(report.steps, unitSteps)));
  if (report.sleep.recordedDays) sections.push(panel(label('report.sleepAnalysis'), [
    row(label('report.total'), duration(report.sleep.total)), row(label('report.averageRecorded'), duration(report.sleep.average)),
    row(label('report.coverage'), recorded(report.sleep)),
    row(label('report.longest'), dayValue(report.sleep.best, '', true)), row(label('report.shortest'), dayValue(report.sleep.least, '', true)),
    row(label('report.effectiveGoal'), goalRange(report.sleep, unitMinutes)), row(label('report.achieved'), goals(report.sleep)),
    row(label('report.quality'), report.sleep.quality === null ? missing : `${number(report.sleep.quality, 1)} / 5`),
  ], chart(report.sleep, t('report.hoursUnit'), 60)));
  if (report.water.recordedDays) sections.push(panel(label('report.waterAnalysis'), [
    row(label('report.total'), value(report.water.total, 'ml')), row(label('report.averageRecorded'), value(report.water.average, 'ml')),
    row(label('report.coverage'), recorded(report.water)), row(label('report.effectiveGoal'), goalRange(report.water, 'ml')),
    row(label('report.achieved'), goals(report.water)),
  ], chart(report.water, 'ml')));
  if (report.nutrition.recordedDays) sections.push(panel(label('report.nutritionAnalysis'), [
    row(label('report.energyIntake'), value(report.nutrition.total, 'kcal')),
    row(label('report.averageRecorded'), value(report.nutrition.average, 'kcal')),
    row(label('report.coverage'), recorded(report.nutrition)),
    row(label('report.protein'), value(report.nutrition.macros?.protein ?? null, 'g', 1)),
    row(label('report.carbs'), value(report.nutrition.macros?.carbs ?? null, 'g', 1)),
    row(label('report.fat'), value(report.nutrition.macros?.fat ?? null, 'g', 1)),
    row(label('report.effectiveGoal'), goalRange(report.nutrition, 'kcal')),
  ], chart(report.nutrition, 'kcal')));
  const points = report.weight.points;
  if (points.length) {
    let graphic = `<div class="chart empty">${label('report.singleWeight')}</div>`;
    if (points.length >= 2) {
      // Preserve first/last measurements; sample intervening observations for a readable chart.
      const sampled = points.length <= 15 ? points : Array.from({ length: 15 }, (_, i) => points[Math.round(i * (points.length - 1) / 14)]);
      const min = Math.min(...sampled.map(point => point.value)) - 0.5, max = Math.max(...sampled.map(point => point.value)) + 0.5;
      const firstTime = Date.parse(points[0].timestamp), elapsed = Math.max(1, Date.parse(points.at(-1)!.timestamp) - firstTime);
      const coords = sampled.map(point => ({ x: 55 + (Date.parse(point.timestamp) - firstTime) / elapsed * 515, y: 105 - (point.value - min) / (max - min) * 80 }));
      graphic = `<div class="chart"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 145"><text x="55" y="12">kg</text><text x="48" y="28" text-anchor="end">${number(max, 1)}</text><text x="48" y="109" text-anchor="end">${number(min, 1)}</text><line x1="55" x2="575" y1="105" y2="105" stroke="#b5c3ca"/><polyline points="${coords.map(point => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="#087f8c" stroke-width="2"/>${coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="3" fill="#087f8c"/>`).join('')}<text x="55" y="130">${shortDate(points[0].date)}</text><text x="575" y="130" text-anchor="end">${shortDate(points.at(-1)!.date)}</text></svg><p class="legend">${label('report.weightChartNote')}</p></div>`;
    }
    const weightMoment = (point: typeof points[number]) => `${date(point.date)} · ${new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: report.timeZone }).format(new Date(point.timestamp))} · ${number(point.value, 1)} kg`;
    sections.push(panel(label('report.weightAnalysis'), [row(label('report.firstMeasurement'), weightMoment(points[0])), row(label('report.lastMeasurement'), weightMoment(points.at(-1)!)), row(label('report.change'), value(report.weight.change, 'kg', 1)), row('BMI', number(report.weight.bmi, 1))], graphic));
  }
  const available = [report.steps.recordedDays, report.sleep.recordedDays, report.water.recordedDays, report.nutrition.recordedDays, points.length];
  const types = ['steps', 'sleep', 'water', 'nutrition', 'weight'];
  const absent = types.filter((_, index) => !available[index]).map(key => label(`report.${key}`));
  const profile = report.profile;
  const field = (name: string, text: string) => `<div><span>${name}</span><strong>${text}</strong></div>`;
  const profileBlock = `<section class="profile"><h2>${label('report.personal')}</h2><div class="profile-grid">${[
    field(label('profile.fullName'), profile?.full_name ? e(profile.full_name) : missing),
    field(label('profile.birthDate'), profile?.date_of_birth ? date(profile.date_of_birth) : missing),
    field(label('report.gender'), profile?.gender ? label(`profile.genderOptions.${profile.gender}`) : missing),
    field(label('report.height'), value(profile?.height_cm == null ? null : Number(profile.height_cm), 'cm', 1)),
    field(label('report.latestWeight'), report.weight.latest ? `${number(Number(report.weight.latest.weight_kg), 1)} kg · ${date(timestampDateKey(report.weight.latest.recorded_at))}` : missing),
    field('BMI', number(report.weight.bmi, 1)),
    field(label('onboarding.weightGoal'), profile?.weight_goal ? label(`onboarding.weightGoalOptions.${profile.weight_goal}.label`) : missing),
    field(label('onboarding.activityLevel'), profile?.activity_level ? label(`onboarding.activityLevelOptions.${profile.activity_level}.label`) : missing),
  ].join('')}</div><p class="note">${label('report.profileNote')}</p></section>`;
  const tile = (key: string, text: string, hint: string) => `<div class="tile"><span>${label(`report.${key}`)}</span><strong>${text}</strong><small>${hint}</small></div>`;
  const overview = `<div class="tiles">${[
    tile('steps', value(report.steps.total, unitSteps), recorded(report.steps)), tile('sleep', duration(report.sleep.total), recorded(report.sleep)),
    tile('water', value(report.water.total, 'ml'), recorded(report.water)), tile('nutrition', value(report.nutrition.total, 'kcal'), recorded(report.nutrition)),
    tile('weight', report.weight.latest ? `${number(Number(report.weight.latest.weight_kg), 1)} kg` : missing, `${label('report.change')}: ${value(report.weight.change, 'kg', 1)}`),
    tile('goals', report.goals.eligibleDays ? `${report.goals.achievedDays} / ${report.goals.eligibleDays}` : label('report.notEvaluable'), label('report.eligibleDays')),
  ].join('')}</div><p class="note">${e(t('report.coverageSummary', { count: report.daysWithData, total: report.dayCount }))}${absent.length ? ` · ${label('report.missingTypes')}: ${absent.join(', ')}` : ''}</p>`;
  const insights: string[] = [];
  if (report.steps.eligibleDays) insights.push(e(t('report.stepsInsight', { achieved: report.steps.achievedDays, eligible: report.steps.eligibleDays })));
  if (report.sleep.recordedDays) insights.push(e(t('report.sleepInsight', { duration: duration(report.sleep.average), count: report.sleep.recordedDays })));
  if (report.water.eligibleDays) insights.push(e(t('report.waterInsight', { achieved: report.water.achievedDays, eligible: report.water.eligibleDays })));
  if (report.weight.change !== null) insights.push(e(t('report.weightInsight', { value: number(report.weight.change, 1) })));
  if (insights.length < 3) insights.push(e(t('report.coverageInsight', { count: report.daysWithData, total: report.dayCount })));
  if (insights.length < 3 || absent.length) insights.push(label('report.logInsight'));
  const notes = `<section class="insights"><h2>${label('report.insights')}</h2><ul>${insights.slice(0, 5).map(text => `<li>${text}</li>`).join('')}</ul><p class="note">${label('report.goalNote')} ${label('report.sleepNote')} ${label('report.nutritionNote')}</p></section>`;
  const twoPages = sections.length > 2;
  const header = `<header><div><div class="brand">HealthyCheck<span>●</span></div><h1>${label('report.pdfTitle')}</h1></div><div class="meta">${e(stamp)}<br/>${e(range)}<br/>${e(report.timeZone)}</div></header>`;
  const page = (content: string, index: number) => `<article class="page">${header}<main>${content}</main><footer><div><b>${label('report.createdBy')}</b><p>${label('report.disclaimer')}</p></div><span>${e(stamp)}<br/>${e(t('report.page', { page: index, total: twoPages ? 2 : 1 }))}</span></footer></article>`;
  const body = twoPages ? page(profileBlock + overview + sections.slice(0, 2).join(''), 1) + page(sections.slice(2).join('') + notes, 2) : page(profileBlock + overview + (sections.length ? sections.join('') : `<p class="empty">${label('report.emptyBody')}</p>`) + notes, 1);
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>HealthyCheck_Report_${report.start}_${report.end}</title><style>
    @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#20353e;font-family:Arial,"Helvetica Neue",sans-serif;font-size:9pt;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{width:210mm;min-height:296mm;padding:11mm 12mm 10mm;display:flex;flex-direction:column;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}main{flex:1}header{display:flex;justify-content:space-between;gap:8mm;border-bottom:2px solid #087f8c;padding-bottom:4mm;margin-bottom:4mm}.brand{font-size:23pt;font-weight:800;color:#087f8c;letter-spacing:-1px}.brand span{font-size:12pt;margin-left:5px;color:#39a983}h1{font-size:11pt;letter-spacing:1px;margin:2mm 0 0;color:#20353e}.meta{text-align:right;font-size:8pt;line-height:1.6;padding-top:2mm}h2{font-size:10pt;text-transform:uppercase;letter-spacing:.5px;margin:0 0 2mm;color:#075967}section{break-inside:avoid;page-break-inside:avoid}.profile{margin-bottom:3mm}.profile-grid{display:flex;flex-wrap:wrap;background:#f3f7f8;border:1px solid #dbe5e8;border-radius:5px;padding:2mm}.profile-grid>div{width:25%;padding:1.5mm 2mm;overflow-wrap:anywhere}.profile-grid span,.tile span{display:block;color:#50656f;font-size:8pt}.profile-grid strong{display:block;font-size:8.5pt;margin-top:1mm}.note{font-size:7pt;color:#52656e;margin:2mm 0;line-height:1.45}.tiles{display:flex;flex-wrap:wrap;gap:2mm;margin-top:3mm}.tile{width:calc((100% - 4mm)/3);border:1px solid #cbdcdf;border-top:2px solid #087f8c;border-radius:4px;padding:2mm 3mm;min-height:18mm}.tile strong{display:block;font-size:13pt;color:#075967;margin:1mm 0}.tile small{font-size:7pt;color:#52656e}.panel{margin:4mm 0 0;border:1px solid #dbe5e8;border-radius:5px;padding:3mm}.analysis{display:flex;align-items:center;gap:3mm}.stats{width:47%}.chart{width:53%;min-width:0}svg{width:100%;display:block}svg text{font-family:Arial,sans-serif;font-size:11px;fill:#374f5c}.unit{font-weight:bold}.legend{font-size:6.7pt;color:#52656e;line-height:1.4;margin:1mm 0 0}table{border-collapse:collapse;width:100%;font-size:7.5pt;table-layout:fixed}tr{break-inside:avoid}tr:nth-child(odd){background:#f3f7f8}th,td{text-align:left;padding:1.25mm 1.4mm;vertical-align:top;overflow-wrap:anywhere}th{font-weight:400;color:#52656e;width:49%}td{font-weight:600}.insights{margin-top:4mm;border-left:3px solid #087f8c;padding:2mm 3mm;background:#f3f7f8}.insights ul{padding-left:4mm;margin:0;font-size:8pt}.insights li{margin:1mm 0}.empty{padding:5mm;color:#52656e;text-align:center}footer{display:flex;align-items:flex-end;justify-content:space-between;gap:5mm;margin-top:4mm;padding-top:2mm;border-top:1px solid #cbdcdf;font-size:7pt;color:#52656e}footer div{max-width:143mm}footer p{margin:1mm 0 0}footer>span{text-align:right;white-space:nowrap}@media screen{body{background:#e8eef0}.page{margin:10px auto;background:white;box-shadow:0 1px 10px #bec8cc}}@media print{.page{margin:0;box-shadow:none}}
  </style></head><body>${body}</body></html>`;
}
