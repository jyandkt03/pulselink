// ─────────────────────────────────────────────
// P-7 샘플 데이터: 엄마의 지난 14일 (설명용으로 지어낸 값)
// 화면 켜짐(회) · 앱 사용(분) · 이동 반경(km) · 외출 여부
// ─────────────────────────────────────────────
const BASELINE = [
  { day: 1,  screenOn: 46, appMin: 162, radiusKm: 1.8, out: true },
  { day: 2,  screenOn: 41, appMin: 148, radiusKm: 1.5, out: true },
  { day: 3,  screenOn: 52, appMin: 175, radiusKm: 2.3, out: true },
  { day: 4,  screenOn: 38, appMin: 131, radiusKm: 1.2, out: true },
  { day: 5,  screenOn: 44, appMin: 156, radiusKm: 1.9, out: true },
  { day: 6,  screenOn: 49, appMin: 181, radiusKm: 2.6, out: true },
  { day: 7,  screenOn: 36, appMin: 140, radiusKm: 0.3, out: false },
  { day: 8,  screenOn: 45, appMin: 158, radiusKm: 1.7, out: true },
  { day: 9,  screenOn: 43, appMin: 150, radiusKm: 1.6, out: true },
  { day: 10, screenOn: 50, appMin: 169, radiusKm: 2.1, out: true },
  { day: 11, screenOn: 40, appMin: 137, radiusKm: 1.4, out: true },
  { day: 12, screenOn: 47, appMin: 166, radiusKm: 2.0, out: true },
  { day: 13, screenOn: 51, appMin: 178, radiusKm: 2.4, out: true },
  { day: 14, screenOn: 37, appMin: 139, radiusKm: 0.4, out: false },
];

const avg = (key) => BASELINE.reduce((s, r) => s + r[key], 0) / BASELINE.length;
const USUAL = { screenOn: avg('screenOn'), appMin: avg('appMin'), radiusKm: avg('radiusKm') };

// ─────────────────────────────────────────────
// 입력 선택지 → 그날의 값으로 바꾸는 비율
// ─────────────────────────────────────────────
const DAYS = ['그제', '어제', '오늘'];
const OUT_OPTIONS = [
  { value: 'usual', label: '평소처럼', ratio: 1 },
  { value: 'less',  label: '적게',     ratio: 0.3 },
  { value: 'none',  label: '안 나감',  ratio: 0.05 },
];
const PHONE_OPTIONS = [
  { value: 'usual', label: '평소처럼', ratio: 1 },
  { value: 'less',  label: '적게',     ratio: 0.4 },
  { value: 'rare',  label: '거의 안 씀', ratio: 0.1 },
  { value: 'off',   label: '꺼져 있음', ratio: null }, // 데이터 없음
];
const EXCEPTION_OPTIONS = [
  { value: 'none',     label: '없음' },
  { value: 'hospital', label: '입원' },
  { value: 'trip',     label: '여행' },
];

const EXAMPLES = {
  normal:  { out: ['usual', 'usual', 'usual'], phone: ['usual', 'usual', 'usual'], exception: 'none' },
  lessOut: { out: ['less', 'none', 'none'],    phone: ['usual', 'usual', 'less'],  exception: 'none' },
  noData:  { out: ['usual', 'usual', 'usual'], phone: ['usual', 'off', 'off'],     exception: 'none' },
  trip:    { out: ['none', 'none', 'none'],    phone: ['less', 'less', 'less'],    exception: 'trip' },
};

// ─────────────────────────────────────────────
// 화면 전환
// ─────────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== id; });
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-go]');
  if (btn) show(btn.dataset.go);
});

// ─────────────────────────────────────────────
// 화면 2: 입력 폼 만들기
// ─────────────────────────────────────────────
function segGroup(name, options, checked) {
  return options.map((o) => `
    <label class="seg-item">
      <input type="radio" name="${name}" value="${o.value}" ${o.value === checked ? 'checked' : ''}>
      <span>${o.label}</span>
    </label>`).join('');
}

function buildForm() {
  document.getElementById('day-cards').innerHTML = DAYS.map((d, i) => `
    <fieldset class="card">
      <legend>${d}</legend>
      <p class="q">외출</p>
      <div class="seg">${segGroup(`out${i}`, OUT_OPTIONS, 'usual')}</div>
      <p class="q">폰 사용</p>
      <div class="seg">${segGroup(`phone${i}`, PHONE_OPTIONS, 'usual')}</div>
    </fieldset>`).join('');
  document.querySelector('[data-name="exception"]').innerHTML = segGroup('exception', EXCEPTION_OPTIONS, 'none');
}

function applyExample(key) {
  const ex = EXAMPLES[key];
  const form = document.getElementById('recent-form');
  DAYS.forEach((_, i) => {
    form.elements[`out${i}`].value = ex.out[i];
    form.elements[`phone${i}`].value = ex.phone[i];
  });
  form.elements.exception.value = ex.exception;
  document.querySelectorAll('[data-example]').forEach((b) => b.classList.toggle('on', b.dataset.example === key));
}

// ─────────────────────────────────────────────
// P-8 판정 규칙 (AI 대신 규칙, 수치는 시범에서 조정)
//  · 외출(이동 반경)이 평소의 50% 이하인 날 3일 이상
//  · + 다른 신호(화면 켜짐·앱 사용) 50% 이하인 날 1일 이상 → 위험 후보
//  · 예외 사유 기간은 판정 제외 / 데이터 없는 날은 '데이터 끊김'
// ─────────────────────────────────────────────
function readRecent(form) {
  return DAYS.map((label, i) => {
    const out = OUT_OPTIONS.find((o) => o.value === form.elements[`out${i}`].value);
    const phone = PHONE_OPTIONS.find((o) => o.value === form.elements[`phone${i}`].value);
    if (phone.ratio === null) return { label, missing: true };
    return {
      label,
      missing: false,
      radiusKm: USUAL.radiusKm * out.ratio,
      screenOn: USUAL.screenOn * phone.ratio,
      appMin: USUAL.appMin * phone.ratio,
    };
  });
}

function judge(days, exception) {
  if (exception !== 'none') {
    return { type: 'paused', exceptionLabel: EXCEPTION_OPTIONS.find((o) => o.value === exception).label };
  }

  // 오늘부터 거꾸로 이어진 데이터 없는 날 수
  let missingStreak = 0;
  for (let i = days.length - 1; i >= 0 && days[i].missing; i--) missingStreak++;
  if (days.some((d) => d.missing)) return { type: 'noData', missingStreak: Math.max(missingStreak, 1) };

  const half = (v, key) => v <= USUAL[key] * 0.5;
  const lowOutDays = days.filter((d) => half(d.radiusKm, 'radiusKm')).length;
  const lowOtherDays = days.filter((d) => half(d.screenOn, 'screenOn') || half(d.appMin, 'appMin')).length;

  if (lowOutDays >= 3 && lowOtherDays >= 1) return { type: 'alert', lowOutDays, lowOtherDays };
  return { type: 'normal', lowOutDays };
}

// ─────────────────────────────────────────────
// 화면 3: 결과 그리기
// ─────────────────────────────────────────────
const fmt = {
  radiusKm: (v) => `${v.toFixed(1)}km`,
  screenOn: (v) => `${Math.round(v)}회`,
  appMin: (v) => `${Math.round(v)}분`,
};

function resultHtml(r) {
  switch (r.type) {
    case 'alert':
      return `
        <p class="badge">알림</p>
        <p class="headline">외출이 평소보다 ${r.lowOutDays}일째 적어요</p>
        <p class="detail">폰 사용도 평소보다 줄어든 날이 있어요. 엄마께 전화로 안부를 확인해 보세요.</p>`;
    case 'noData':
      return `
        <p class="badge">데이터 끊김</p>
        <p class="headline">엄마 폰 데이터가 ${r.missingStreak}일째 들어오지 않아요</p>
        <p class="detail">폰 전원이 꺼져 있거나 앱이 멈췄을 수 있어요. 엄마께 전화로 폰 상태를 확인해 보세요.</p>`;
    case 'paused':
      return `
        <p class="badge muted">비교 쉬는 중</p>
        <p class="headline">${r.exceptionLabel} 기간이라 비교를 쉬고 있어요</p>
        <p class="detail">등록한 예외 기간에는 알림을 보내지 않아요. 기간이 끝나면 자동으로 다시 비교해요.</p>`;
    default:
      return `
        <p class="badge muted">알림 없음</p>
        <p class="headline">오늘도 평소대로예요</p>
        <p class="detail">${r.lowOutDays > 0
          ? `외출이 적은 날이 ${r.lowOutDays}일 있었지만, 알림 기준(3일 이상 + 다른 신호)에는 닿지 않았어요.`
          : '확인할 알림이 없어요. 평소와 비슷하게 지내고 계세요.'}</p>`;
  }
}

function compareHtml(days) {
  const rows = [
    ['radiusKm', '이동 반경'],
    ['screenOn', '화면 켜짐'],
    ['appMin', '앱 사용'],
  ];
  const head = `<tr><th></th><th>평소</th>${days.map((d) => `<th>${d.label}</th>`).join('')}</tr>`;
  const body = rows.map(([key, name]) => `
    <tr>
      <th>${name}</th>
      <td>${fmt[key](USUAL[key])}</td>
      ${days.map((d) => {
        if (d.missing) return '<td class="low">없음</td>';
        const low = d[key] <= USUAL[key] * 0.5;
        return `<td class="${low ? 'low' : ''}">${fmt[key](d[key])}</td>`;
      }).join('')}
    </tr>`).join('');
  return head + body;
}

function baselineHtml() {
  const head = '<tr><th>일차</th><th>화면</th><th>앱</th><th>반경</th><th>외출</th></tr>';
  const body = BASELINE.map((r) => `
    <tr><th>${r.day}</th><td>${r.screenOn}회</td><td>${r.appMin}분</td><td>${r.radiusKm}km</td><td>${r.out ? '예' : '아니오'}</td></tr>`).join('');
  return head + body;
}

function render(days, result) {
  const card = document.getElementById('result-card');
  card.className = `result ${result.type}`;
  card.innerHTML = resultHtml(result);
  document.getElementById('compare-table').innerHTML = compareHtml(days);
  document.getElementById('rule-text').textContent = result.type === 'paused'
    ? '예외 기간의 값은 판정과 기준선 계산에서 빠져요.'
    : '알림 기준: 외출(이동 반경)이 평소의 절반 이하인 날이 3일 이상이고, 화면 켜짐·앱 사용 중 하나도 절반 이하인 날이 있을 때. 진하게 표시된 칸이 평소의 절반 이하예요.';
}

// ─────────────────────────────────────────────
// 시작
// ─────────────────────────────────────────────
buildForm();
document.getElementById('baseline-table').innerHTML = baselineHtml();

document.querySelectorAll('[data-example]').forEach((b) => {
  b.addEventListener('click', () => applyExample(b.dataset.example));
});

document.getElementById('recent-form').addEventListener('change', () => {
  document.querySelectorAll('[data-example]').forEach((b) => b.classList.remove('on'));
});

document.getElementById('recent-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const days = readRecent(form);
  render(days, judge(days, form.elements.exception.value));
  show('screen-result');
});
