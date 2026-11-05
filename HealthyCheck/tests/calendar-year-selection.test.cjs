const { test } = require('node:test');
const assert = require('node:assert/strict');
const { uiFixture, elements } = require('./ui-fixture.cjs');

test('birth calendar jumps to a year and commits only after a day is chosen in both languages', async () => {
  for (const language of ['vi', 'en']) {
    const fixture = uiFixture();
    const i18n = fixture.load('src/i18n/index').default;
    await i18n.changeLanguage(language);
    const Calendar = fixture.load('src/components/common/CalendarDatePicker').CalendarDatePicker;
    const selections = [];
    let closed = false;
    const render = () => fixture.render(() => Calendar({
      visible: true, allowYearSelection: true, date: '2007-11-15', maxDate: '2026-11-05',
      title: 'Birthday', onClose: () => { closed = true; }, onSelect: value => selections.push(value),
    }));
    let tree = render();
    const press = label => {
      const button = elements(tree).find(element => element.props?.accessibilityLabel === label || (element.type === 'TouchableOpacity' && elements(element).some(child => child.props?.children === label)));
      assert.ok(button, `Missing button: ${label}`);
      button.props.onPress();
      tree = render();
    };
    press(i18n.t('calendar.chooseYear'));
    assert.equal(elements(tree).find(element => element.props?.accessibilityLabel === i18n.t('calendar.year', { year: 2007 })).props.accessibilityState.selected, true);
    press(i18n.t('calendar.previousYears'));
    press(i18n.t('calendar.year', { year: 1995 }));
    assert.deepEqual(selections, []);
    assert.equal(closed, false);
    const day = elements(tree).find(element => element.props?.accessibilityLabel === fixture.load('src/i18n/formatting').formatDate('1995-11-15'));
    assert.ok(day);
    day.props.onPress();
    assert.deepEqual(selections, ['1995-11-15']);
    // Browsing another year and returning leaves the date uncommitted.
    press(i18n.t('calendar.chooseYear'));
    press(i18n.t('calendar.nextYears'));
    press(i18n.t('calendar.backToCalendar'));
    assert.deepEqual(selections, ['1995-11-15']);
    press(i18n.t('common.cancel'));
    assert.equal(closed, true);
  }
});

test('year selection blocks future years and clamps the current year to the latest allowed month', async () => {
  const fixture = uiFixture();
  const i18n = fixture.load('src/i18n/index').default;
  await i18n.changeLanguage('en');
  const Calendar = fixture.load('src/components/common/CalendarDatePicker').CalendarDatePicker;
  const selections = [];
  const render = () => fixture.render(() => Calendar({
    visible: true, allowYearSelection: true, date: '2024-12-31', maxDate: '2026-03-05',
    title: 'Birthday', onClose() {}, onSelect: value => selections.push(value),
  }));
  let tree = render();
  elements(tree).find(element => element.props?.accessibilityLabel === 'Choose a year').props.onPress();
  tree = render();
  const future = elements(tree).find(element => element.props?.accessibilityLabel === 'Year 2027');
  assert.equal(future.props.disabled, true);
  future.props.onPress();
  tree = render();
  const next = elements(tree).find(element => element.props?.accessibilityLabel === 'Next years');
  assert.equal(next.props.disabled, true);
  next.props.onPress();
  tree = render();
  elements(tree).find(element => element.props?.accessibilityLabel === 'Year 2026').props.onPress();
  tree = render();
  assert.deepEqual(selections, []);
  const allowed = elements(tree).find(element => element.props?.accessibilityLabel === 'March 5, 2026');
  assert.equal(allowed.props.disabled, false);
  assert.equal(elements(tree).find(element => element.props?.accessibilityLabel === 'March 6, 2026').props.disabled, true);
  allowed.props.onPress();
  assert.deepEqual(selections, ['2026-03-05']);
});

test('changing a leap year keeps February and requires choosing a valid day', async () => {
  const fixture = uiFixture();
  await fixture.load('src/i18n/index').default.changeLanguage('en');
  const Calendar = fixture.load('src/components/common/CalendarDatePicker').CalendarDatePicker;
  let selected;
  const render = () => fixture.render(() => Calendar({
    visible: true, allowYearSelection: true, date: '2004-02-29', maxDate: '2026-11-05',
    title: 'Birthday', onClose() {}, onSelect: value => { selected = value; },
  }));
  let tree = render();
  elements(tree).find(element => element.props?.accessibilityLabel === 'Choose a year').props.onPress();
  tree = render();
  elements(tree).find(element => element.props?.accessibilityLabel === 'Year 2005').props.onPress();
  tree = render();
  assert.equal(selected, undefined);
  assert.ok(!elements(tree).some(element => element.props?.accessibilityLabel === 'February 29, 2005'));
  elements(tree).find(element => element.props?.accessibilityLabel === 'February 28, 2005').props.onPress();
  assert.equal(selected, '2005-02-28');
});
