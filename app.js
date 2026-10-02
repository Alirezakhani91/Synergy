const C = window.SYNERGY_CONFIG || {};
const API = C.API_URL;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  page: "today",
  dashboard: {},
  leads: [],
  courses: [],
  students: [],
  payments: [],
  expenses: [],
  followups: [],
  invoices: [],
  todos: [],
  products: [],
  purchases: [],
  purchaseItems: [],
  purchaseCosts: [],
  consumptions: [],
  inventoryMovements: [],
  selectedLead: null,
  selectedCourse: null,
  loading: false
};

const statusMap = {
  new: "جدید",
  contacted: "تماس گرفته شد",
  interested: "علاقه‌مند",
  payment_info_sent: "شرایط ارسال شد",
  awaiting_payment: "منتظر پرداخت",
  paid: "پرداخت شد",
  registered: "ثبت‌نام قطعی",
  lost: "از دست رفته"
};

const statusClass = {
  new: "blue",
  contacted: "cyan",
  interested: "violet",
  payment_info_sent: "amber",
  awaiting_payment: "orange",
  paid: "green",
  registered: "emerald",
  lost: "red"
};

const navItems = [
  ["today", "⌂", "امروز"],
  ["leads", "◎", "مشتریان"],
  ["courses", "▣", "دوره‌ها"],
  ["finance", "◈", "مالی"],
  ["inventory", "◫", "انبار"],
  ["invoices", "▧", "فاکتورها"],
  ["todos", "✓", "یادداشت‌ها"],
  ["reports", "▤", "گزارش"]
];


/* =========================================================
   HELPERS
========================================================= */

function esc(v = "") {
  return String(v).replace(
    /[&<>'"]/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[c])
  );
}

function faNum(v) {
  return new Intl.NumberFormat("fa-IR")
    .format(Number(v || 0));
}

function money(v) {
  return (
    new Intl.NumberFormat("fa-IR")
      .format(Number(v || 0)) +
    " " +
    (C.CURRENCY || "تومان")
  );
}


function rawNumber(v) {
  return String(v ?? "")
    .replace(/[,\u066C\u060C\s]/g, "")
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

function formattedNumber(v) {
  const raw = rawNumber(v);
  if (!raw) return "";
  const sign = raw.startsWith("-") ? "-" : "";
  const digits = raw.replace(/[^\d]/g, "");
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function bindNumberInputs(root = document) {
  root.querySelectorAll("[data-number='true']").forEach(input => {
    input.value = formattedNumber(input.value);

    input.addEventListener("input", () => {
      const pos = input.selectionStart || 0;
      const before = input.value;
      input.value = formattedNumber(input.value);
      const diff = input.value.length - before.length;
      try {
        input.setSelectionRange(pos + diff, pos + diff);
      } catch (_) {}
    });
  });
}


function div(a, b) {
  return ~~(a / b);
}

function mod(a, b) {
  return a - ~~(a / b) * b;
}

function jalCal(jy) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756,
    818, 1111, 1181, 1210, 1635,
    2060, 2097, 2192, 2262, 2324,
    2394, 2456, 3178
  ];

  const bl = breaks.length;
  const gy = jy + 621;

  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;

  if (
    jy < jp ||
    jy >= breaks[bl - 1]
  ) {
    throw new Error(
      "Invalid Jalali year " + jy
    );
  }

  for (
    let i = 1;
    i < bl;
    i += 1
  ) {
    jm = breaks[i];
    jump = jm - jp;

    if (jy < jm) break;

    leapJ =
      leapJ +
      div(jump, 33) * 8 +
      div(mod(jump, 33), 4);

    jp = jm;
  }

  let n = jy - jp;

  leapJ =
    leapJ +
    div(n, 33) * 8 +
    div(
      mod(n, 33) + 3,
      4
    );

  if (
    mod(jump, 33) === 4 &&
    jump - n === 4
  ) {
    leapJ += 1;
  }

  const leapG =
    div(gy, 4) -
    div(
      (div(gy, 100) + 1) * 3,
      4
    ) -
    150;

  const march =
    20 +
    leapJ -
    leapG;

  if (
    jump - n < 6
  ) {
    n =
      n -
      jump +
      div(
        jump + 4,
        33
      ) *
      33;
  }

  let leap =
    mod(
      mod(n + 1, 33) - 1,
      4
    );

  if (leap === -1) {
    leap = 4;
  }

  return {
    leap,
    gy,
    march
  };
}

function g2d(gy, gm, gd) {
  let d =
    div(
      (gy + div(gm - 8, 6) + 100100) *
      1461,
      4
    ) +
    div(
      153 *
      mod(gm + 9, 12) +
      2,
      5
    ) +
    gd -
    34840408;

  d =
    d -
    div(
      div(
        gy +
        100100 +
        div(gm - 8, 6),
        100
      ) *
      3,
      4
    ) +
    752;

  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;

  j =
    j +
    div(
      div(4 * jdn + 183187720, 146097) *
      3,
      4
    ) *
    4 -
    3908;

  const i =
    div(
      mod(j, 1461),
      4
    ) *
    5 +
    308;

  const gd =
    div(
      mod(i, 153),
      5
    ) +
    1;

  const gm =
    mod(
      div(i, 153),
      12
    ) +
    1;

  const gy =
    div(j, 1461) -
    100100 +
    div(8 - gm, 6);

  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);

  return (
    g2d(
      r.gy,
      3,
      r.march
    ) +
    (jm - 1) * 31 -
    div(jm, 7) *
    (jm - 7) +
    jd -
    1
  );
}

function d2j(jdn) {
  const g = d2g(jdn);
  let jy = g.gy - 621;

  const r = jalCal(jy);

  const jdn1f =
    g2d(
      g.gy,
      3,
      r.march
    );

  let k =
    jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return {
        jy,
        jm:
          1 +
          div(k, 31),
        jd:
          mod(k, 31) +
          1
      };
    }

    k -= 186;
  } else {
    jy -= 1;
    k += 179;

    if (
      jalCal(jy).leap === 1
    ) {
      k += 1;
    }
  }

  return {
    jy,
    jm:
      7 +
      div(k, 30),
    jd:
      mod(k, 30) +
      1
  };
}

function toJalali(
  gy,
  gm,
  gd
) {
  return d2j(
    g2d(
      gy,
      gm,
      gd
    )
  );
}

function toGregorian(
  jy,
  jm,
  jd
) {
  return d2g(
    j2d(
      jy,
      jm,
      jd
    )
  );
}

function jalaliMonthLength(
  jy,
  jm
) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;

  return (
    jalCal(jy).leap === 0
      ? 30
      : 29
  );
}

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند"
];

const JALALI_WEEKDAYS = [
  "ش",
  "ی",
  "د",
  "س",
  "چ",
  "پ",
  "ج"
];

function pad2(v) {
  return String(v)
    .padStart(
      2,
      "0"
    );
}

function jalaliPartsFromValue(
  value
) {

  if (!value) {

    const now =
      new Date();

    return toJalali(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );
  }

  const datePart =
    String(value)
      .slice(0, 10);

  const [
    gy,
    gm,
    gd
  ] =
    datePart
      .split("-")
      .map(Number);

  if (
    !gy ||
    !gm ||
    !gd
  ) {

    const now =
      new Date();

    return toJalali(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );
  }

  return toJalali(
    gy,
    gm,
    gd
  );
}

function jalaliDate(v) {

  if (!v) return "—";

  try {

    const raw =
      String(v)
        .slice(0,10);

    const [
      gy,
      gm,
      gd
    ] =
      raw
        .split("-")
        .map(Number);

    if (
      !gy ||
      !gm ||
      !gd
    ) {
      return String(v);
    }

    const j =
      toJalali(
        gy,
        gm,
        gd
      );

    return (
      `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`
    );

  } catch {

    return String(v);
  }
}

function jalaliDateLong(v) {

  if (!v) return "—";

  try {

    const raw =
      String(v)
        .slice(0,10);

    const [
      gy,
      gm,
      gd
    ] =
      raw
        .split("-")
        .map(Number);

    const j =
      toJalali(
        gy,
        gm,
        gd
      );

    const d =
      new Date(
        gy,
        gm - 1,
        gd
      );

    const weekday =
      new Intl.DateTimeFormat(
        "fa-IR",
        {
          weekday:
            "long"
        }
      ).format(d);

    return (
      `${weekday}، ` +
      `${j.jd} ` +
      `${JALALI_MONTHS[j.jm - 1]} ` +
      `${j.jy}`
    );

  } catch {

    return jalaliDate(v);
  }
}

function jalaliDateTime(v) {

  if (!v) return "—";

  const base =
    jalaliDateLong(v);

  const time =
    String(v)
      .includes("T")
      ? String(v)
          .split("T")[1]
          .slice(0,5)
      : "";

  return time
    ? `${base} - ${time}`
    : base;
}

function dateFa(v) {
  return jalaliDate(v);
}


function openJalaliPicker(
  displayInput
) {

  const targetId =
    displayInput.dataset
      .targetId;

  const target =
    document.getElementById(
      targetId
    );

  if (!target) return;

  document
    .getElementById(
      "jalaliPickerOverlay"
    )
    ?.remove();

  const current =
    jalaliPartsFromValue(
      target.value
    );

  let viewYear =
    current.jy;

  let viewMonth =
    current.jm;

  const isDateTime =
    target.dataset
      .dateKind ===
    "datetime-local";

  const currentTime =
    isDateTime &&
    String(target.value)
      .includes("T")
      ? String(
          target.value
        )
        .split("T")[1]
        .slice(0,5)
      : "12:00";


  const overlay =
    document.createElement(
      "div"
    );

  overlay.id =
    "jalaliPickerOverlay";

  overlay.className =
    "jalali-picker-overlay";

  overlay.innerHTML = `
    <div
      class="jalali-picker"
      role="dialog"
      aria-modal="true"
    >

      <div
        class="jalali-picker-head"
      >

        <button
          type="button"
          id="jalaliPrevMonth"
        >
          ‹
        </button>

        <div>
          <strong
            id="jalaliPickerMonthTitle"
          ></strong>

          <small
            id="jalaliPickerFullTitle"
          ></small>
        </div>

        <button
          type="button"
          id="jalaliNextMonth"
        >
          ›
        </button>

      </div>


      <div
        class="jalali-weekdays"
      >
        ${
          JALALI_WEEKDAYS
            .map(
              d =>
                `<span>${d}</span>`
            )
            .join("")
        }
      </div>


      <div
        id="jalaliCalendarGrid"
        class="jalali-calendar-grid"
      ></div>


      ${
        isDateTime
          ? `
            <label
              class="jalali-time-field"
            >

              <span>
                ساعت
              </span>

              <input
                id="jalaliTimeValue"
                type="time"
                value="${currentTime}"
              >

            </label>
          `
          : ""
      }


      <div
        class="jalali-picker-footer"
      >

        <button
          type="button"
          id="jalaliTodayBtn"
          class="secondary glass-button"
        >
          امروز
        </button>

        <button
          type="button"
          id="jalaliClearBtn"
          class="secondary glass-button"
        >
          پاک کردن
        </button>

        <button
          type="button"
          id="jalaliCloseBtn"
          class="primary"
        >
          بستن
        </button>

      </div>

    </div>
  `;

  document.body
    .appendChild(
      overlay
    );


  function selectDay(
    jy,
    jm,
    jd
  ) {

    const g =
      toGregorian(
        jy,
        jm,
        jd
      );

    const gregorian =
      `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;

    let finalValue =
      gregorian;

    if (isDateTime) {

      const time =
        $("#jalaliTimeValue")
          ?.value ||
        "12:00";

      finalValue =
        `${gregorian}T${time}`;
    }

    target.value =
      finalValue;

    displayInput.value =
      `${jy}/${pad2(jm)}/${pad2(jd)}`;

    const longTarget =
      document.getElementById(
        displayInput.dataset
          .longTargetId
      );

    if (longTarget) {
      longTarget.textContent =
        jalaliDateLong(
          gregorian
        );
    }

    displayInput
      .dispatchEvent(
        new Event(
          "change",
          {
            bubbles:true
          }
        )
      );

    overlay.remove();
  }


  function renderCalendar() {

    $("#jalaliPickerMonthTitle")
      .textContent =
        `${JALALI_MONTHS[viewMonth - 1]} ${viewYear}`;

    const todayDate =
      new Date();

    const todayJ =
      toJalali(
        todayDate.getFullYear(),
        todayDate.getMonth() + 1,
        todayDate.getDate()
      );

    $("#jalaliPickerFullTitle")
      .textContent =
        `امروز: ${todayJ.jy}/${pad2(todayJ.jm)}/${pad2(todayJ.jd)}`;

    const firstG =
      toGregorian(
        viewYear,
        viewMonth,
        1
      );

    const firstDate =
      new Date(
        firstG.gy,
        firstG.gm - 1,
        firstG.gd
      );

    const offset =
      (firstDate.getDay() + 1) %
      7;

    const days =
      jalaliMonthLength(
        viewYear,
        viewMonth
      );

    let html = "";

    for (
      let i = 0;
      i < offset;
      i++
    ) {
      html +=
        `<span class="jalali-empty"></span>`;
    }

    for (
      let day = 1;
      day <= days;
      day++
    ) {

      const isToday =
        viewYear ===
          todayJ.jy &&
        viewMonth ===
          todayJ.jm &&
        day ===
          todayJ.jd;

      const isSelected =
        viewYear ===
          current.jy &&
        viewMonth ===
          current.jm &&
        day ===
          current.jd;

      html += `
        <button
          type="button"
          class="
            jalali-day
            ${isToday ? "today" : ""}
            ${isSelected ? "selected" : ""}
          "
          data-jy="${viewYear}"
          data-jm="${viewMonth}"
          data-jd="${day}"
        >
          ${day}
        </button>
      `;
    }

    $("#jalaliCalendarGrid")
      .innerHTML =
        html;

    $$(
      "#jalaliCalendarGrid .jalali-day"
    ).forEach(
      button => {

        button.onclick =
          () =>
            selectDay(
              Number(
                button.dataset.jy
              ),
              Number(
                button.dataset.jm
              ),
              Number(
                button.dataset.jd
              )
            );
      }
    );
  }


  $("#jalaliPrevMonth")
    .onclick =
      () => {

        viewMonth--;

        if (
          viewMonth < 1
        ) {
          viewMonth = 12;
          viewYear--;
        }

        renderCalendar();
      };


  $("#jalaliNextMonth")
    .onclick =
      () => {

        viewMonth++;

        if (
          viewMonth > 12
        ) {
          viewMonth = 1;
          viewYear++;
        }

        renderCalendar();
      };


  $("#jalaliTodayBtn")
    .onclick =
      () => {

        const now =
          new Date();

        const j =
          toJalali(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate()
          );

        selectDay(
          j.jy,
          j.jm,
          j.jd
        );
      };


  $("#jalaliClearBtn")
    .onclick =
      () => {

        target.value = "";
        displayInput.value = "";

        const longTarget =
          document.getElementById(
            displayInput.dataset
              .longTargetId
          );

        if (longTarget) {
          longTarget.textContent =
            "تاریخ شمسی انتخاب نشده";
        }

        overlay.remove();
      };


  $("#jalaliCloseBtn")
    .onclick =
      () =>
        overlay.remove();


  overlay.onclick =
    e => {

      if (
        e.target ===
        overlay
      ) {
        overlay.remove();
      }
    };


  renderCalendar();
}


function bindJalaliDateInputs(
  root = document
) {

  root
    .querySelectorAll(
      "[data-jalali-display='true']"
    )
    .forEach(
      input => {

        if (
          input.dataset.bound ===
          "true"
        ) return;

        input.dataset.bound =
          "true";

        input.onclick =
          () =>
            openJalaliPicker(
              input
            );

        input.onkeydown =
          e => {

            e.preventDefault();

            if (
              e.key ===
              "Enter" ||
              e.key ===
              " "
            ) {
              openJalaliPicker(
                input
              );
            }
          };
      }
    );
}


function formDataObject(form) {
  const data = Object.fromEntries(new FormData(form));

  form.querySelectorAll("[data-number='true']").forEach(input => {
    data[input.name] = rawNumber(input.value);
  });

  return data;
}



function toast(msg, bad = false) {

  const t = $("#toast");

  if (!t) return;

  t.textContent = msg;

  t.className =
    bad ? "show bad" : "show";

  setTimeout(
    () => t.className = "",
    2800
  );
}

function loading(v) {

  state.loading = v;

  const el = $("#loading");

  if (!el) return;

  el.classList.toggle(
    "hidden",
    !v
  );
}

function setConnected(ok) {

  const dot =
    $("#connectionDot");

  const text =
    $("#connectionText");

  if (dot)
    dot.className =
      ok ? "ok" : "bad";

  if (text)
    text.textContent =
      ok
        ? "Google Sheets متصل"
        : "اتصال قطع است";
}


/* =========================================================
   LIVE THEME CONTROLS
========================================================= */

const THEME_STORAGE_KEY = "synergy_theme_v10";

function themeDefaults() {
  return {
    light: 58,
    pink: 66,
    hue: 322
  };
}

function loadThemeSettings() {
  try {
    return {
      ...themeDefaults(),
      ...JSON.parse(
        localStorage.getItem(
          THEME_STORAGE_KEY
        ) || "{}"
      )
    };
  } catch (_) {
    return themeDefaults();
  }
}

function saveThemeSettings(settings) {
  localStorage.setItem(
    THEME_STORAGE_KEY,
    JSON.stringify(settings)
  );
}

function applyTheme(settings) {

  const light =
    Math.max(
      35,
      Math.min(
        78,
        Number(settings.light || 58)
      )
    );

  const pink =
    Math.max(
      0,
      Math.min(
        100,
        Number(settings.pink || 66)
      )
    );

  const hue =
    Number(settings.hue || 322);

  const pinkAlpha =
    0.18 +
    (pink / 100) * 0.36;

  const blueAlpha =
    0.22 +
    ((100 - pink) / 100) * 0.24;

  const baseL =
    Math.max(
      18,
      Math.round(light * 0.56)
    );

  const secondL =
    Math.max(
      20,
      Math.round(light * 0.63)
    );

  document.documentElement
    .style
    .setProperty(
      "--live-hue",
      hue
    );

  document.documentElement
    .style
    .setProperty(
      "--live-light",
      `${light}%`
    );

  document.documentElement
    .style
    .setProperty(
      "--live-panel-alpha",
      String(
        0.10 +
        (light - 35) / 43 * 0.10
      )
    );

  document.documentElement
    .style
    .setProperty(
      "--pink",
      `hsl(${hue} 92% 66%)`
    );

  document.documentElement
    .style
    .setProperty(
      "--pink2",
      `hsl(${hue} 88% 57%)`
    );

  document.documentElement
    .style
    .setProperty(
      "--purple",
      `hsl(${(hue + 54) % 360} 78% 70%)`
    );

  document.body.style.background = `
    radial-gradient(
      circle at 8% 8%,
      hsla(220, 88%, ${Math.min(78, light + 8)}%, ${blueAlpha}),
      transparent 34%
    ),
    radial-gradient(
      circle at 88% 13%,
      hsla(182, 78%, ${Math.min(76, light + 5)}%, .34),
      transparent 31%
    ),
    radial-gradient(
      circle at 82% 78%,
      hsla(${hue}, 91%, ${Math.min(78, light + 9)}%, ${pinkAlpha}),
      transparent 38%
    ),
    radial-gradient(
      circle at 18% 92%,
      hsla(${(hue + 58) % 360}, 78%, ${Math.min(76, light + 8)}%, .42),
      transparent 35%
    ),
    linear-gradient(
      135deg,
      hsl(225 42% ${baseL}%),
      hsl(${(hue + 32) % 360} 31% ${secondL}%)
    )
  `;
}

function initThemeControls() {

  if ($("#themeControlFab"))
    return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <button
        id="themeControlFab"
        class="theme-control-fab"
        aria-label="تنظیم کامل رنگ‌ها"
        title="تنظیم کامل رنگ‌ها"
        type="button"
      >
        🎨
      </button>
    `
  );

  $("#themeControlFab").onclick =
    () =>
      openUniversalThemePanel();
}


/* =========================================================
   SAFE API
========================================================= */

function fetchTimeout(
  url,
  options = {},
  timeout = 10000
) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  return fetch(
    url,
    {
      ...options,
      signal: controller.signal
    }
  )
    .catch(error => {

      if (
        error?.name === "AbortError" ||
        String(error?.message || "")
          .toLowerCase()
          .includes("aborted")
      ) {
        throw new Error(
          "پاسخ سرور طولانی شد. دوباره تلاش کنید."
        );
      }

      throw error;
    })
    .finally(
      () => clearTimeout(timer)
    );
}


async function get(action) {

  if (!API)
    throw new Error(
      "API URL تنظیم نشده است."
    );

  const url =
    `${API}?action=${encodeURIComponent(action)}&t=${Date.now()}`;

  const response =
    await fetchTimeout(
      url,
      {
        method: "GET",
        cache: "no-store"
      },
      20000
    );

  if (!response.ok)
    throw new Error(
      `API ${response.status}`
    );

  const data =
    await response.json();

  if (
    data &&
    data.success === false
  ) {
    throw new Error(
      data.message ||
      "خطای دیتابیس"
    );
  }

  return data;
}


async function post(
  action,
  data
) {

  if (!API)
    throw new Error(
      "API URL تنظیم نشده است."
    );

  const response =
    await fetchTimeout(
      API,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body:
          JSON.stringify({
            action,
            data
          })
      },
      35000
    );

  if (!response.ok)
    throw new Error(
      `API ${response.status}`
    );

  return response.json();
}


/* =========================================================
   DATA LOADING
========================================================= */

async function safeLoad(
  action,
  fallback = []
) {

  try {

    const result =
      await get(action);

    return {
      ok: true,
      data:
        result?.data ??
        fallback
    };

  } catch (error) {

    console.warn(
      "Load failed:",
      action,
      error
    );

    return {
      ok: false,
      data: fallback,
      error
    };
  }
}


async function loadAll(
  showLoading = false
) {

  loading(false);
  setConnected(false);
  render();

  let anySuccess = false;

  try {

    const results =
      await Promise.allSettled([
        safeLoad("dashboard", {}),
        safeLoad("leads", []),
        safeLoad("courses", []),
        safeLoad("students", []),
        safeLoad("payments", []),
        safeLoad("expenses", []),
        safeLoad("followups", []),
        safeLoad("todos", []),
        safeLoad("products", []),
        safeLoad("purchases", []),
        safeLoad("purchaseItems", []),
        safeLoad("purchaseCosts", []),
        safeLoad("consumptions", []),
        safeLoad("inventoryMovements", [])
      ]);

    const values =
      results.map(
        item =>
          item.status === "fulfilled"
            ? item.value
            : {
                ok: false,
                data: []
              }
      );

    const [
      dashboard,
      leads,
      courses,
      students,
      payments,
      expenses,
      followups,
      todos,
      products,
      purchases,
      purchaseItems,
      purchaseCosts,
      consumptions,
      inventoryMovements
    ] = values;

    const assign = (
      result,
      key,
      fallback
    ) => {

      if (!result?.ok) return;

      state[key] =
        result.data ??
        fallback;

      anySuccess = true;
    };

    assign(
      dashboard,
      "dashboard",
      {}
    );

    assign(
      leads,
      "leads",
      []
    );

    assign(
      courses,
      "courses",
      []
    );

    assign(
      students,
      "students",
      []
    );

    assign(
      payments,
      "payments",
      []
    );

    assign(
      expenses,
      "expenses",
      []
    );

    assign(
      followups,
      "followups",
      []
    );

    assign(
      todos,
      "todos",
      []
    );

    assign(
      products,
      "products",
      []
    );

    assign(
      purchases,
      "purchases",
      []
    );

    assign(
      purchaseItems,
      "purchaseItems",
      []
    );

    assign(
      purchaseCosts,
      "purchaseCosts",
      []
    );

    assign(
      consumptions,
      "consumptions",
      []
    );

    assign(
      inventoryMovements,
      "inventoryMovements",
      []
    );

    /*
      Inventory fallback:
      if one of the individual inventory GET requests fails,
      fetch the inventory dataset in one bundled request.
    */
    if (!activeProducts().length) {

      try {

        const bundle =
          await get("inventoryBundle");

        if (
          bundle?.success &&
          bundle?.data
        ) {

          state.products =
            bundle.data.products || [];

          state.purchases =
            bundle.data.purchases ||
            state.purchases ||
            [];

          state.purchaseItems =
            bundle.data.purchaseItems ||
            state.purchaseItems ||
            [];

          state.purchaseCosts =
            bundle.data.purchaseCosts ||
            state.purchaseCosts ||
            [];

          state.consumptions =
            bundle.data.consumptions ||
            state.consumptions ||
            [];

          state.inventoryMovements =
            bundle.data.inventoryMovements ||
            state.inventoryMovements ||
            [];

          anySuccess = true;
        }

      } catch (inventoryError) {

        console.warn(
          "Inventory bundle fallback failed:",
          inventoryError
        );
      }
    }

    setConnected(anySuccess);

    render();

    if (!anySuccess) {
      toast(
        "ارتباط با دیتابیس برقرار نشد",
        true
      );
    }

  } catch (error) {

    console.error(error);

    setConnected(false);

    toast(
      "خطا در دریافت اطلاعات",
      true
    );

    render();

  } finally {

    loading(false);
  }
}


/* =========================================================
   FINAL CUSTOMERS
   Only paid/final customers are shown in the Customers page.
========================================================= */

function finalCustomers() {

  const groups =
    new Map();

  approvedPayments()
    .forEach(payment => {

      const lead =
        state.leads.find(
          l =>
            String(l.lead_id) ===
            String(payment.lead_id)
        );

      const student =
        state.students.find(
          s =>
            String(s.student_id) ===
            String(payment.student_id) ||
            (
              payment.lead_id &&
              String(s.lead_id) ===
              String(payment.lead_id)
            )
        );

      const key =
        payment.student_id
          ? `student:${payment.student_id}`
          : payment.lead_id
            ? `lead:${payment.lead_id}`
            : `payment:${payment.payment_id}`;

      if (!groups.has(key)) {

        groups.set(
          key,
          {
            key,
            lead_id:
              lead?.lead_id ||
              payment.lead_id ||
              "",
            student_id:
              student?.student_id ||
              payment.student_id ||
              "",
            full_name:
              lead?.full_name ||
              student?.full_name ||
              payment.full_name ||
              "مشتری",
            mobile:
              lead?.mobile ||
              student?.mobile ||
              payment.mobile ||
              "",
            course_id:
              payment.course_id ||
              lead?.course_id ||
              student?.course_id ||
              "",
            source:
              lead?.source ||
              "",
            notes:
              lead?.notes ||
              student?.notes ||
              "",
            university:
              student?.university ||
              "",
            field_of_study:
              student?.field_of_study ||
              "",
            semester:
              student?.semester ||
              "",
            total_paid:0,
            payment_count:0,
            latest_payment:"",
            first_payment:"",
            payments:[]
          }
        );
      }

      const item =
        groups.get(key);

      item.total_paid +=
        Number(payment.amount || 0);

      item.payment_count += 1;

      item.payments.push(payment);

      const pd =
        payment.payment_date ||
        payment.created_at ||
        "";

      if (
        !item.latest_payment ||
        String(pd) >
        String(item.latest_payment)
      ) {
        item.latest_payment = pd;
        item.course_id =
          payment.course_id ||
          item.course_id;
      }

      if (
        !item.first_payment ||
        String(pd) <
        String(item.first_payment)
      ) {
        item.first_payment = pd;
      }
    });

  return [
    ...groups.values()
  ].sort(
    (a,b) =>
      String(
        b.latest_payment || ""
      ).localeCompare(
        String(
          a.latest_payment || ""
        )
      )
  );
}


function customerByKey(key) {
  return finalCustomers()
    .find(
      c =>
        String(c.key) ===
        String(key)
    );
}


function finalCustomerRevenue() {
  return approvedPayments()
    .reduce(
      (sum,p) =>
        sum +
        Number(p.amount || 0),
      0
    );
}


/* =========================================================
   NAVIGATION
========================================================= */

function initNav() {

  const nav = $("#nav");
  const bottom = $("#bottomNav");

  if (nav) {

    nav.innerHTML =
      navItems
        .map(
          ([id, icon, text]) => `
            <button
              class="nav-btn ${
                state.page === id
                  ? "active"
                  : ""
              }"
              data-page="${id}"
            >
              <span>${icon}</span>
              ${text}
            </button>
          `
        )
        .join("");
  }


  if (bottom) {

    bottom.innerHTML =
      navItems
        .slice(0, 4)
        .map(
          ([id, icon, text]) => `
            <button
              class="${
                state.page === id
                  ? "active"
                  : ""
              }"
              data-page="${id}"
            >
              <b>${icon}</b>
              <span>${text}</span>
            </button>
          `
        )
        .join("");
  }


  $$("[data-page]")
    .forEach(button => {

      button.onclick = () => {

        state.page =
          button.dataset.page;

        closeSide();

        initNav();

        render();
      };
    });
}


function title(
  main,
  sub
) {

  $("#pageTitle").textContent =
    main;

  $("#pageSub").textContent =
    sub;
}


function render() {

  initNav();

  const pages = {
    today: renderToday,
    leads: renderLeads,
    courses: renderCourses,
    finance: renderFinance,
    inventory: renderInventory,
    invoices: renderInvoices,
    todos: renderTodos,
    reports: renderReports
  };

  const fn =
    pages[state.page] ||
    renderToday;

  fn();
}


/* =========================================================
   TODAY / OPERATIONS
========================================================= */

function renderToday() {

  title(
    "امروز",
    "نمای سریع عملیات آکادمی"
  );

  const customers =
    finalCustomers();

  const revenue =
    finalCustomerRevenue();

  const activeCourses =
    state.courses.filter(
      c =>
        c.status === "active"
    ).length;

  const lowStock =
    inventoryTotals()
      .lowStock;

  const recent =
    customers.slice(0,6);

  $("#content").innerHTML = `

    <section class="hero">

      <div>

        <span class="eyebrow">
          SYNERGY ACADEMY
        </span>

        <h1>
          مدیریت ساده آکادمی،
          بدون پیچیدگی CRM
        </h1>

        <p>
          فقط مشتری نهایی،
          دوره، پرداخت،
          هزینه و انبار.
        </p>

      </div>

      <button
        data-action="newLead"
        class="hero-add"
      >
        ＋ ثبت مشتری نهایی
      </button>

    </section>


    <div class="kpi-grid">

      <div class="kpi">
        <span>مشتریان نهایی</span>
        <strong>
          ${faNum(customers.length)}
        </strong>
        <small>دارای ثبت پرداخت</small>
      </div>

      <div class="kpi success">
        <span>درآمد وصول‌شده</span>
        <strong>
          ${money(revenue)}
        </strong>
        <small>
          ${faNum(
            approvedPayments().length
          )}
          پرداخت
        </small>
      </div>

      <div class="kpi">
        <span>دوره‌های فعال</span>
        <strong>
          ${faNum(activeCourses)}
        </strong>
        <small>در حال مدیریت</small>
      </div>

      <div class="kpi ${
        lowStock
          ? "danger"
          : "success"
      }">
        <span>هشدار موجودی</span>
        <strong>
          ${faNum(lowStock)}
        </strong>
        <small>
          کالا در نقطه سفارش
        </small>
      </div>

    </div>


    <div class="two-col">

      <section class="panel">

        <div class="panel-head">

          <div>
            <h3>
              آخرین مشتریان ثبت‌شده
            </h3>

            <p>
              مشتریانی که پرداخت دارند
            </p>
          </div>

          <span class="count">
            ${faNum(recent.length)}
          </span>

        </div>

        ${
          recent.length
            ? `
              <div class="lead-list">

                ${
                  recent.map(c => `
                    <button
                      class="lead-row"
                      data-customer="${esc(c.key)}"
                    >

                      <div class="avatar">
                        ${esc(
                          String(
                            c.full_name || "?"
                          ).trim()[0] || "?"
                        )}
                      </div>

                      <div class="lead-main">

                        <b>
                          ${esc(c.full_name)}
                        </b>

                        <span>
                          ${esc(
                            courseName(
                              c.course_id
                            ) || "بدون دوره"
                          )}
                          ·
                          ${esc(c.mobile)}
                        </span>

                      </div>

                      <div class="lead-end">

                        <b>
                          ${money(
                            c.total_paid
                          )}
                        </b>

                        <small>
                          ${dateFa(
                            c.latest_payment
                          )}
                        </small>

                      </div>

                    </button>
                  `).join("")
                }

              </div>
            `
            : `
              <div class="empty">
                <b>
                  هنوز مشتری نهایی ثبت نشده
                </b>
                <span>
                  با ثبت اولین مشتری و پرداخت،
                  این بخش پر می‌شود.
                </span>
              </div>
            `
        }

      </section>


      <section class="panel">

        <div class="panel-head">

          <div>
            <h3>میانبرها</h3>
            <p>
              عملیات پرتکرار آکادمی
            </p>
          </div>

        </div>

        <div class="quick-ops-grid">

          <button
            class="quick-op"
            data-action="newLead"
          >
            <b>＋</b>
            <span>مشتری نهایی</span>
          </button>

          <button
            class="quick-op"
            data-action="newCourse"
          >
            <b>▣</b>
            <span>دوره جدید</span>
          </button>

          <button
            class="quick-op"
            data-action="newExpense"
          >
            <b>−</b>
            <span>ثبت هزینه</span>
          </button>

          <button
            class="quick-op"
            data-action="newPurchase"
          >
            <b>◫</b>
            <span>خرید انبار</span>
          </button>

        </div>

      </section>

    </div>
  `;

  bindActions();
  bindCustomerClicks();
}


/* =========================================================
   LEAD COMPONENTS
========================================================= */

function leadList(
  arr,
  follow
) {

  if (!arr || !arr.length) {

    return `
      <div class="empty">
        <b>همه‌چیز مرتب است</b>
        <span>
          موردی برای نمایش وجود ندارد.
        </span>
      </div>
    `;
  }


  return `
    <div class="lead-list">

      ${
        arr.map(
          x => `
            <button
              class="lead-row"
              data-lead="${esc(x.lead_id)}"
            >

              <div class="avatar">
                ${
                  esc(
                    (
                      x.full_name ||
                      "?"
                    )
                    .trim()[0]
                  )
                }
              </div>


              <div class="lead-main">

                <b>
                  ${esc(x.full_name)}
                </b>

                <span>
                  ${esc(x.mobile)}

                  ${
                    x.course_id
                      ? " · " +
                        esc(
                          courseName(
                            x.course_id
                          )
                        )
                      : ""
                  }
                </span>

              </div>


              <div class="lead-end">

                <em
                  class="badge ${
                    statusClass[
                      x.status
                    ] || "gray"
                  }"
                >
                  ${
                    statusMap[
                      x.status
                    ] ||
                    esc(x.status)
                  }
                </em>

                ${
                  follow
                    ? `
                      <small>
                        ${dateFa(
                          x.next_followup
                        )}
                      </small>
                    `
                    : ""
                }

              </div>

            </button>
          `
        ).join("")
      }

    </div>
  `;
}


function leadCard(x) {

  return `
    <button
      class="lead-card"
      data-lead="${esc(x.lead_id)}"
    >

      <div>
        <b>${esc(x.full_name)}</b>
        <span>${esc(x.mobile)}</span>
      </div>

      <p>
        ${
          esc(
            courseName(
              x.course_id
            ) ||
            "دوره مشخص نشده"
          )
        }
      </p>

      <footer>

        <small>
          ${esc(x.source || "—")}
        </small>

        <small>
          ${
            x.next_followup
              ? dateFa(
                  x.next_followup
                )
              : "بدون پیگیری"
          }
        </small>

      </footer>

    </button>
  `;
}


function courseName(id) {

  const course =
    state.courses.find(
      x =>
        String(x.course_id) ===
        String(id)
    );

  return (
    course?.course_name ||
    id ||
    ""
  );
}


/* =========================================================
   CUSTOMERS — FINAL / PAID ONLY
========================================================= */

function renderLeads() {

  title(
    "مشتریان",
    "فقط مشتریان نهایی که ثبت پرداخت دارند"
  );

  const customers =
    finalCustomers();

  const totalPaid =
    customers.reduce(
      (sum,c) =>
        sum +
        Number(c.total_paid || 0),
      0
    );

  const avgPaid =
    customers.length
      ? Math.round(
          totalPaid /
          customers.length
        )
      : 0;

  $("#content").innerHTML = `

    <div class="kpi-grid" style="margin-top:0;margin-bottom:14px">

      <div class="kpi">
        <span>مشتریان نهایی</span>
        <strong>
          ${faNum(customers.length)}
        </strong>
        <small>
          فقط پرداخت‌شده‌ها
        </small>
      </div>

      <div class="kpi success">
        <span>جمع دریافتی</span>
        <strong>
          ${money(totalPaid)}
        </strong>
        <small>از این مشتریان</small>
      </div>

      <div class="kpi">
        <span>میانگین پرداخت مشتری</span>
        <strong>
          ${money(avgPaid)}
        </strong>
        <small>Average Customer Value</small>
      </div>

      <div class="kpi">
        <span>تعداد پرداخت‌ها</span>
        <strong>
          ${faNum(
            approvedPayments().length
          )}
        </strong>
        <small>تراکنش ثبت‌شده</small>
      </div>

    </div>


    <div class="toolbar">

      <div class="search">

        <span>⌕</span>

        <input
          id="customerSearch"
          placeholder="جستجو نام، موبایل یا دوره..."
        >

      </div>

      <button
        class="primary"
        data-action="newLead"
      >
        ＋ ثبت مشتری نهایی
      </button>

    </div>


    <section class="panel">

      <div id="customerList">

        ${
          renderCustomerList(
            customers
          )
        }

      </div>

    </section>
  `;


  $("#customerSearch")
    .oninput = e => {

      const q =
        String(
          e.target.value || ""
        )
          .trim()
          .toLowerCase();

      const filtered =
        customers.filter(c => {

          const haystack =
            [
              c.full_name,
              c.mobile,
              courseName(
                c.course_id
              )
            ]
              .join(" ")
              .toLowerCase();

          return haystack.includes(q);
        });

      $("#customerList")
        .innerHTML =
          renderCustomerList(
            filtered
          );

      bindCustomerClicks();
    };


  bindActions();
  bindCustomerClicks();
}


function renderCustomerList(customers) {

  if (!customers.length) {

    return `
      <div class="empty">
        <b>
          هنوز مشتری نهایی ثبت نشده
        </b>
        <span>
          فقط مشتریانی که پرداخت دارند
          در این صفحه نمایش داده می‌شوند.
        </span>
      </div>
    `;
  }

  return `
    <div class="lead-list">

      ${
        customers.map(c => `

          <button
            class="lead-row customer-final-row"
            data-customer="${esc(c.key)}"
          >

            <div class="avatar">
              ${esc(
                String(
                  c.full_name || "?"
                ).trim()[0] || "?"
              )}
            </div>

            <div class="lead-main">

              <b>
                ${esc(c.full_name)}
              </b>

              <span>
                ${esc(c.mobile || "بدون موبایل")}
                ·
                ${esc(
                  courseName(
                    c.course_id
                  ) || "بدون دوره"
                )}
              </span>

            </div>

            <div class="lead-end">

              <b>
                ${money(c.total_paid)}
              </b>

              <small>
                ${faNum(c.payment_count)}
                پرداخت
                ·
                ${dateFa(
                  c.latest_payment
                )}
              </small>

            </div>

          </button>

        `).join("")
      }

    </div>
  `;
}


function bindCustomerClicks() {

  $$("[data-customer]")
    .forEach(button => {

      button.onclick =
        () =>
          openCustomer(
            button.dataset.customer
          );
    });
}


function openCustomer(key) {

  const customer =
    customerByKey(key);

  if (!customer)
    return;

  modal(`

    <div class="profile-head">

      <div class="avatar xl">
        ${esc(
          String(
            customer.full_name || "?"
          )[0] || "?"
        )}
      </div>

      <div>

        <span class="badge green">
          مشتری نهایی
        </span>

        <h2>
          ${esc(
            customer.full_name
          )}
        </h2>

        <a
          href="tel:${esc(
            customer.mobile
          )}"
        >
          ${esc(
            customer.mobile ||
            "بدون شماره"
          )}
        </a>

      </div>

    </div>


    <div class="profile-info" style="margin-top:18px">

      <div>
        <span>دوره</span>
        <b>
          ${esc(
            courseName(
              customer.course_id
            ) || "—"
          )}
        </b>
      </div>

      <div>
        <span>جمع پرداخت</span>
        <b>
          ${money(
            customer.total_paid
          )}
        </b>
      </div>

      <div>
        <span>تعداد پرداخت</span>
        <b>
          ${faNum(
            customer.payment_count
          )}
        </b>
      </div>

      <div>
        <span>آخرین پرداخت</span>
        <b>
          ${dateFa(
            customer.latest_payment
          )}
        </b>
      </div>

      <div>
        <span>دانشگاه</span>
        <b>
          ${esc(
            customer.university ||
            "—"
          )}
        </b>
      </div>

      <div>
        <span>رشته / ترم</span>
        <b>
          ${esc(
            [
              customer.field_of_study,
              customer.semester
            ]
              .filter(Boolean)
              .join(" / ") ||
            "—"
          )}
        </b>
      </div>

    </div>


    <section class="panel" style="margin-top:16px">

      <div class="panel-head">
        <div>
          <h3>پرداخت‌های مشتری</h3>
          <p>
            سوابق مالی این مشتری
          </p>
        </div>
      </div>

      <div class="lead-list">

        ${
          customer.payments
            .slice()
            .reverse()
            .map(p => `

              <button
                class="lead-row"
                data-customer-payment="${esc(
                  p.payment_id
                )}"
              >

                <div class="avatar">
                  +
                </div>

                <div class="lead-main">
                  <b>
                    ${money(p.amount)}
                  </b>
                  <span>
                    ${esc(
                      courseName(
                        p.course_id
                      ) || "بدون دوره"
                    )}
                  </span>
                </div>

                <div class="lead-end">
                  <small>
                    ${dateFa(
                      p.payment_date ||
                      p.created_at
                    )}
                  </small>
                </div>

              </button>

            `).join("")
        }

      </div>

    </section>


    <div class="profile-actions customer-actions">

      <button
        id="editFinalCustomerBtn"
        class="secondary glass-button"
      >
        ویرایش مشتری
      </button>

      <button
        id="addCustomerPaymentBtn"
        class="primary"
      >
        ＋ پرداخت جدید
      </button>

      <button
        id="deleteFinalCustomerBtn"
        class="danger-action"
      >
        حذف مشتری
      </button>

    </div>
  `);


  $("#editFinalCustomerBtn")
    .onclick =
      () =>
        editFinalCustomer(
          customer
        );


  $("#addCustomerPaymentBtn")
    .onclick =
      () => {

        const pseudoLead = {
          lead_id:
            customer.lead_id,
          course_id:
            customer.course_id
        };

        newPayment(
          pseudoLead,
          state.courses.find(
            c =>
              String(c.course_id) ===
              String(
                customer.course_id
              )
          ) || null
        );
      };


  $("#deleteFinalCustomerBtn")
    .onclick =
      () =>
        deleteFinalCustomer(
          customer
        );


  $$("[data-customer-payment]")
    .forEach(button => {

      button.onclick = () => {

        const inv =
          buildInvoices()
            .find(
              x =>
                String(
                  x.payment_id
                ) ===
                String(
                  button.dataset.customerPayment
                )
            );

        if (inv)
          openInvoice(
            inv.invoice_id
          );
      };
    });
}


function editFinalCustomer(customer) {

  modal(`

    <div class="modal-title">
      <span>CUSTOMER</span>
      <h2>ویرایش مشتری</h2>
      <p>
        تمام اطلاعات اختیاری هستند.
      </p>
    </div>

    <form
      id="editFinalCustomerForm"
      class="form-grid"
    >

      ${formField(
        "نام و نام خانوادگی",
        "full_name",
        "text",
        "",
        customer.full_name || ""
      )}

      ${formField(
        "شماره موبایل",
        "mobile",
        "tel",
        'inputmode="tel"',
        customer.mobile || ""
      )}

      ${selectField(
        "دوره",
        "course_id",
        `
          <option value="">
            بدون دوره
          </option>

          ${
            state.courses.map(c => `
              <option
                value="${esc(c.course_id)}"
                ${
                  String(c.course_id) ===
                  String(
                    customer.course_id ||
                    ""
                  )
                    ? "selected"
                    : ""
                }
              >
                ${esc(c.course_name)}
              </option>
            `).join("")
          }
        `
      )}

      ${formField(
        "دانشگاه",
        "university",
        "text",
        "",
        customer.university || ""
      )}

      ${formField(
        "رشته تحصیلی",
        "field_of_study",
        "text",
        "",
        customer.field_of_study || ""
      )}

      ${formField(
        "ترم",
        "semester",
        "text",
        "",
        customer.semester || ""
      )}

      ${formField(
        "منبع آشنایی",
        "source",
        "text",
        "",
        customer.source || ""
      )}

      <label class="field full">
        <span>یادداشت</span>
        <textarea
          name="notes"
          rows="4"
        >${esc(
          customer.notes || ""
        )}</textarea>
      </label>

      <button
        class="primary full submit"
        type="submit"
      >
        ذخیره تغییرات
      </button>

    </form>
  `);


  $("#editFinalCustomerForm")
    .onsubmit =
      async e => {

        e.preventDefault();

        await submitPost(
          "updateFinalCustomer",
          {
            ...formDataObject(
              e.target
            ),
            lead_id:
              customer.lead_id,
            student_id:
              customer.student_id
          },
          "اطلاعات مشتری ویرایش شد"
        );
      };
}


async function deleteFinalCustomer(
  customer
) {

  if (
    !confirm(
      `مشتری «${
        customer.full_name ||
        "بدون نام"
      }» و تمام پرداخت‌های او حذف شود؟`
    )
  ) {
    return;
  }

  try {

    loading(true);

    const result =
      await post(
        "deleteFinalCustomer",
        {
          lead_id:
            customer.lead_id,
          student_id:
            customer.student_id
        }
      );

    if (!result.success)
      throw new Error(
        result.message ||
        "حذف انجام نشد"
      );

    closeModal();
    toast("مشتری حذف شد");

    await loadAll(false);

  } catch(error) {

    toast(
      error.message ||
      "حذف مشتری انجام نشد",
      true
    );

  } finally {

    loading(false);
  }
}


/* =========================================================
   COURSES / COURSE 360
========================================================= */

function courseStudents(courseId) {
  return state.students.filter(
    s => String(s.course_id) === String(courseId)
  );
}

function courseLeads(courseId) {
  return state.leads.filter(
    l => String(l.course_id) === String(courseId)
  );
}

function coursePayments(courseId) {
  return state.payments.filter(
    p =>
      String(p.course_id) === String(courseId) &&
      (!p.status || p.status === "approved")
  );
}

function courseExpenses(courseId) {
  return state.expenses.filter(
    e => String(e.course_id) === String(courseId)
  );
}

function courseConsumptions(courseId) {
  return state.consumptions.filter(
    x => String(x.course_id) === String(courseId)
  );
}

function sumAmount(arr) {
  return arr.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
}

function sumConsumptionCost(arr) {
  return arr.reduce(
    (sum, item) => sum + Number(item.total_cost || 0),
    0
  );
}

function courseMetrics(course) {
  const students = courseStudents(course.course_id);
  const leads = courseLeads(course.course_id);
  const payments = coursePayments(course.course_id);
  const expenses = courseExpenses(course.course_id);
  const consumptions = courseConsumptions(course.course_id);

  const capacity = Number(course.capacity || 0);
  const registered = students.length;
  const remaining = Math.max(0, capacity - registered);
  const revenue = sumAmount(payments);
  const serviceCost = sumAmount(expenses);
  const inventoryCost = sumConsumptionCost(consumptions);
  const cost = serviceCost + inventoryCost;
  const profit = revenue - cost;
  const fillRate = capacity
    ? Math.min(100, Math.round((registered / capacity) * 100))
    : 0;

  return {
    students,
    leads,
    payments,
    expenses,
    consumptions,
    serviceCost,
    inventoryCost,
    capacity,
    registered,
    remaining,
    revenue,
    cost,
    profit,
    fillRate
  };
}

function renderCourses() {

  title(
    "دوره‌ها",
    "مدیریت دوره، ظرفیت، دانشجو و عملکرد مالی"
  );

  const active = state.courses.filter(
    c => c.status === "active"
  ).length;

  const totalStudents = state.students.length;

  const totalCapacity = state.courses.reduce(
    (sum, c) => sum + Number(c.capacity || 0),
    0
  );

  const remainingCapacity = Math.max(
    0,
    totalCapacity - totalStudents
  );

  $("#content").innerHTML = `

    <div class="kpi-grid" style="margin-top:0;margin-bottom:14px">

      <div class="kpi">
        <span>کل دوره‌ها</span>
        <strong>${faNum(state.courses.length)}</strong>
        <small>${faNum(active)} دوره فعال</small>
      </div>

      <div class="kpi success">
        <span>دانشجویان ثبت‌شده</span>
        <strong>${faNum(totalStudents)}</strong>
        <small>در تمام دوره‌ها</small>
      </div>

      <div class="kpi warning">
        <span>ظرفیت کل</span>
        <strong>${faNum(totalCapacity)}</strong>
        <small>صندلی تعریف‌شده</small>
      </div>

      <div class="kpi">
        <span>ظرفیت باقی‌مانده</span>
        <strong>${faNum(remainingCapacity)}</strong>
        <small>فرصت فروش</small>
      </div>

    </div>

    <div class="toolbar">

      <div>
        <h3>دوره‌های آکادمی</h3>
        <p>برای مشاهده پرونده کامل روی هر دوره بزنید.</p>
      </div>

      <button
        class="primary"
        data-action="newCourse"
      >
        ＋ دوره جدید
      </button>

    </div>

    <div class="course-grid">

      ${
        state.courses.length
          ? state.courses.map(c => {

              const m = courseMetrics(c);

              return `
                <article
                  class="course-card course-click"
                  data-course="${esc(c.course_id)}"
                  role="button"
                  tabindex="0"
                >

                  <div class="course-top">

                    <span
                      class="badge ${
                        c.status === "active"
                          ? "green"
                          : "gray"
                      }"
                    >
                      ${
                        c.status === "active"
                          ? "فعال"
                          : esc(c.status || "پیش‌نویس")
                      }
                    </span>

                    <small>
                      ${esc(c.course_code || "")}
                    </small>

                  </div>

                  <h3>${esc(c.course_name)}</h3>

                  <p>
                    ${esc(
                      c.partner_university ||
                      "دانشگاه همکار مشخص نشده"
                    )}
                  </p>

                  <div
                    style="
                      height:8px;
                      border-radius:999px;
                      background:rgba(255,255,255,.08);
                      overflow:hidden;
                      margin:14px 0 6px
                    "
                  >
                    <i
                      style="
                        display:block;
                        height:100%;
                        width:${m.fillRate}%;
                        background:currentColor;
                        border-radius:inherit
                      "
                    ></i>
                  </div>

                  <div
                    style="
                      display:flex;
                      justify-content:space-between;
                      gap:8px;
                      font-size:12px;
                      opacity:.75;
                      margin-bottom:14px
                    "
                  >
                    <span>${faNum(m.fillRate)}٪ تکمیل ظرفیت</span>
                    <span>
                      ${faNum(m.registered)}
                      /
                      ${faNum(m.capacity)}
                    </span>
                  </div>

                  <div class="course-meta">

                    <div>
                      <span>مدرس</span>
                      <b>${esc(c.instructor || "—")}</b>
                    </div>

                    <div>
                      <span>دانشجو</span>
                      <b>${faNum(m.registered)}</b>
                    </div>

                    <div>
                      <span>شروع</span>
                      <b>${dateFa(c.start_date)}</b>
                    </div>

                    <div>
                      <span>قیمت</span>
                      <b>${money(c.standard_price)}</b>
                    </div>

                  </div>

                </article>
              `;
            }).join("")
          : `
            <div class="panel empty">
              <b>هنوز دوره‌ای تعریف نشده</b>
              <span>اولین دوره آکادمی را ایجاد کنید.</span>
            </div>
          `
      }

    </div>
  `;

  bindActions();
  bindCourseClicks();
}

function bindCourseClicks() {

  $$("[data-course]").forEach(card => {

    const open = () =>
      openCourse(card.dataset.course);

    card.onclick = open;

    card.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    };
  });
}

function openCourse(id) {

  const course = state.courses.find(
    c => String(c.course_id) === String(id)
  );

  if (!course) return;

  state.selectedCourse = course;

  const m = courseMetrics(course);

  const margin =
    m.revenue
      ? Math.round((m.profit / m.revenue) * 100)
      : 0;

  modal(`

    <div class="modal-title">

      <span>COURSE 360</span>

      <h2>${esc(course.course_name)}</h2>

      <p>
        ${esc(course.partner_university || "آکادمی سینرژی")}
        ${
          course.course_code
            ? " · " + esc(course.course_code)
            : ""
        }
      </p>

    </div>

    <div class="profile-info">

      <div>
        <span>مدرس</span>
        <b>${esc(course.instructor || "—")}</b>
      </div>

      <div>
        <span>تاریخ شروع</span>
        <b>${dateFa(course.start_date)}</b>
      </div>

      <div>
        <span>محل برگزاری</span>
        <b>${esc(course.location || "—")}</b>
      </div>

      <div>
        <span>قیمت استاندارد</span>
        <b>${money(course.standard_price)}</b>
      </div>

    </div>

    <div class="kpi-grid" style="margin:16px 0">

      <div class="kpi success">
        <span>ثبت‌نام</span>
        <strong>${faNum(m.registered)}</strong>
        <small>از ${faNum(m.capacity)} نفر</small>
      </div>

      <div class="kpi warning">
        <span>ظرفیت باقی‌مانده</span>
        <strong>${faNum(m.remaining)}</strong>
        <small>${faNum(m.fillRate)}٪ تکمیل</small>
      </div>

      <div class="kpi">
        <span>درآمد وصول‌شده</span>
        <strong>${money(m.revenue)}</strong>
        <small>${faNum(m.payments.length)} پرداخت</small>
      </div>

      <div class="kpi ${m.profit >= 0 ? "success" : "danger"}">
        <span>سود دوره</span>
        <strong>${money(m.profit)}</strong>
        <small>Margin ${faNum(margin)}٪</small>
      </div>

    </div>

    <section class="panel" style="margin-bottom:14px">

      <div class="panel-head">

        <div>
          <h3>دانشجویان دوره</h3>
          <p>
            ${faNum(m.registered)}
            دانشجو در این دوره ثبت شده‌اند.
          </p>
        </div>

        <span class="count">${faNum(m.registered)}</span>

      </div>

      ${
        m.students.length
          ? `
            <div class="lead-list">
              ${m.students.map(s => {

                const lead = state.leads.find(
                  l =>
                    String(l.lead_id) ===
                    String(s.lead_id)
                );

                const name =
                  s.full_name ||
                  lead?.full_name ||
                  "دانشجو";

                const mobile =
                  s.mobile ||
                  lead?.mobile ||
                  "";

                const paid = state.payments
                  .filter(p =>
                    String(p.course_id) === String(course.course_id) &&
                    (
                      String(p.student_id || "") ===
                      String(s.student_id || "") ||
                      String(p.lead_id || "") ===
                      String(s.lead_id || "")
                    ) &&
                    (!p.status || p.status === "approved")
                  )
                  .reduce(
                    (sum, p) =>
                      sum + Number(p.amount || 0),
                    0
                  );

                return `
                  <div class="lead-row" style="cursor:default">

                    <div class="avatar">
                      ${esc(String(name).trim()[0] || "?")}
                    </div>

                    <div class="lead-main">
                      <b>${esc(name)}</b>
                      <span>${esc(mobile)}</span>
                    </div>

                    <div class="lead-end">
                      <em class="badge green">
                        ${paid ? "پرداخت " + money(paid) : "ثبت‌نام‌شده"}
                      </em>
                    </div>

                  </div>
                `;
              }).join("")}
            </div>
          `
          : `
            <div class="empty">
              <b>هنوز دانشجویی ثبت نشده</b>
              <span>
                دانشجو پس از تبدیل متقاضی به این لیست اضافه می‌شود.
              </span>
            </div>
          `
      }

    </section>

    <section class="panel" style="margin-bottom:14px">

      <div class="panel-head">

        <div>
          <h3>فرصت‌های فروش این دوره</h3>
          <p>متقاضیانی که هنوز به دانشجو تبدیل نشده‌اند.</p>
        </div>

        <span class="count">
          ${faNum(
            m.leads.filter(
              l => l.status !== "registered"
            ).length
          )}
        </span>

      </div>

      ${
        leadList(
          m.leads
            .filter(l => l.status !== "registered")
            .slice(0, 12),
          false
        )
      }

    </section>

    <section class="panel">

      <div class="panel-head">
        <div>
          <h3>عملکرد مالی دوره</h3>
          <p>بر اساس پرداخت‌ها و هزینه‌های ثبت‌شده همین دوره</p>
        </div>
      </div>

      <div class="finance-strip">

        <div>
          <span>درآمد</span>
          <strong>${money(m.revenue)}</strong>
        </div>

        <div>
          <span>هزینه مستقیم</span>
          <strong>${money(m.cost)}</strong>
        </div>

        <div>
          <span>سود</span>
          <strong>${money(m.profit)}</strong>
        </div>

      </div>

    </section>

    <div class="profile-actions" style="margin-top:14px">

      <button
        id="editCourseBtn"
        class="secondary glass-button"
      >
        ویرایش دوره
      </button>

      <button
        id="courseExpenseBtn"
        class="secondary glass-button"
      >
        ثبت هزینه دوره
      </button>

      <button
        id="coursePaymentBtn"
        class="primary"
      >
        ثبت پرداخت
      </button>

    </div>
  `);

  bindLeadClicks();

  const expenseBtn = $("#courseExpenseBtn");
  const paymentBtn = $("#coursePaymentBtn");

  if (expenseBtn)
    expenseBtn.onclick =
      () => newExpense(course);

  if (paymentBtn)
    paymentBtn.onclick =
      () => newPayment(null, course);

  const editBtn =
    $("#editCourseBtn");

  if (editBtn)
    editBtn.onclick =
      () => editCourse(course);
}


/* =========================================================
   NOTES / TODO LIST
========================================================= */

function todoPriorityLabel(p) {
  return {
    low: "کم",
    normal: "عادی",
    high: "بالا",
    urgent: "فوری"
  }[p] || "عادی";
}

function todoPriorityClass(p) {
  return {
    low: "gray",
    normal: "blue",
    high: "orange",
    urgent: "red"
  }[p] || "blue";
}

function renderTodos() {

  title(
    "یادداشت‌ها و کارها",
    "موضوعاتی که باید بعداً بررسی، خرید یا پیگیری شوند"
  );

  const open = state.todos.filter(
    x =>
      x.status !== "done" &&
      x.status !== "cancelled"
  );

  const done = state.todos.filter(
    x => x.status === "done"
  );

  const overdue = open.filter(x => {
    if (!x.due_date) return false;
    return new Date(x.due_date) < new Date();
  });

  $("#content").innerHTML = `

    <div class="kpi-grid" style="margin-top:0;margin-bottom:14px">

      <div class="kpi">
        <span>کارهای باز</span>
        <strong>${faNum(open.length)}</strong>
        <small>نیازمند اقدام</small>
      </div>

      <div class="kpi warning">
        <span>سررسید گذشته</span>
        <strong>${faNum(overdue.length)}</strong>
        <small>اولویت پیگیری</small>
      </div>

      <div class="kpi success">
        <span>انجام‌شده</span>
        <strong>${faNum(done.length)}</strong>
        <small>تکمیل‌شده</small>
      </div>

    </div>

    <div class="toolbar">

      <div>
        <h3>یادداشت‌ها و To‑Do</h3>
        <p>
          خرید وسایل، تماس‌ها، موضوعات جلسات و هر چیزی که نباید فراموش شود.
        </p>
      </div>

      <button
        class="primary"
        id="newTodoBtn"
      >
        ＋ یادداشت جدید
      </button>

    </div>

    <section class="panel">

      <div class="lead-list">

        ${
          state.todos.length
            ? state.todos
                .slice()
                .sort((a,b) => {
                  const ad = a.status === "done" ? 1 : 0;
                  const bd = b.status === "done" ? 1 : 0;
                  if (ad !== bd) return ad - bd;

                  return String(a.due_date || "9999")
                    .localeCompare(
                      String(b.due_date || "9999")
                    );
                })
                .map(todo => `

                  <div
                    class="lead-row todo-row ${
                      todo.status === "done"
                        ? "todo-done"
                        : ""
                    }"
                  >

                    <button
                      class="todo-check"
                      data-todo-done="${esc(todo.todo_id)}"
                      title="تغییر وضعیت"
                    >
                      ${
                        todo.status === "done"
                          ? "✓"
                          : "○"
                      }
                    </button>

                    <div class="lead-main">

                      <b>
                        ${esc(
                          todo.title ||
                          "بدون عنوان"
                        )}
                      </b>

                      <span>
                        ${
                          esc(
                            todo.category ||
                            "عمومی"
                          )
                        }

                        ${
                          todo.due_date
                            ? " · سررسید " +
                              jalaliDate(todo.due_date)
                            : ""
                        }
                      </span>

                      ${
                        todo.notes
                          ? `
                            <span
                              style="margin-top:6px"
                            >
                              ${esc(todo.notes)}
                            </span>
                          `
                          : ""
                      }

                    </div>

                    <div class="lead-end">

                      <em
                        class="badge ${
                          todoPriorityClass(
                            todo.priority
                          )
                        }"
                      >
                        ${
                          todoPriorityLabel(
                            todo.priority
                          )
                        }
                      </em>

                      <div
                        style="
                          display:flex;
                          gap:6px;
                          margin-top:8px
                        "
                      >

                        <button
                          class="secondary glass-button todo-mini"
                          data-todo-edit="${esc(todo.todo_id)}"
                        >
                          ویرایش
                        </button>

                        <button
                          class="danger-action todo-mini"
                          data-todo-delete="${esc(todo.todo_id)}"
                        >
                          حذف
                        </button>

                      </div>

                    </div>

                  </div>
                `).join("")
            : `
              <div class="empty">
                <b>هنوز یادداشتی ثبت نشده</b>
                <span>
                  اولین موضوع یا کار آینده را ثبت کنید.
                </span>
              </div>
            `
        }

      </div>

    </section>
  `;

  $("#newTodoBtn").onclick =
    () => todoForm();

  $$("[data-todo-edit]").forEach(btn => {
    btn.onclick = () => {
      const todo =
        state.todos.find(
          x =>
            String(x.todo_id) ===
            String(btn.dataset.todoEdit)
        );

      if (todo) todoForm(todo);
    };
  });

  $$("[data-todo-delete]").forEach(btn => {
    btn.onclick =
      () =>
        deleteTodo(
          btn.dataset.todoDelete
        );
  });

  $$("[data-todo-done]").forEach(btn => {
    btn.onclick = () => {
      const todo =
        state.todos.find(
          x =>
            String(x.todo_id) ===
            String(btn.dataset.todoDone)
        );

      if (!todo) return;

      updateTodoStatus(
        todo,
        todo.status === "done"
          ? "open"
          : "done"
      );
    };
  });
}


function todoForm(todo = null) {

  const editing = !!todo;

  modal(`

    <div class="modal-title">

      <span>
        ${editing ? "EDIT TODO" : "NEW TODO"}
      </span>

      <h2>
        ${editing ? "ویرایش یادداشت" : "یادداشت / کار جدید"}
      </h2>

      <p>
        همه فیلدها اختیاری هستند.
      </p>

    </div>


    <form
      id="todoForm"
      class="form-grid"
    >

      ${formField(
        "عنوان",
        "title",
        "text",
        "",
        todo?.title || ""
      )}

      ${selectField(
        "دسته‌بندی",
        "category",
        `
          ${["","خرید","پیگیری","جلسه","مالی","دوره","انبار","عمومی"].map(x => `
            <option
              value="${esc(x)}"
              ${String(x) === String(todo?.category || "") ? "selected" : ""}
            >
              ${x || "بدون دسته‌بندی"}
            </option>
          `).join("")}
        `
      )}

      ${selectField(
        "اولویت",
        "priority",
        `
          ${[
            ["low","کم"],
            ["normal","عادی"],
            ["high","بالا"],
            ["urgent","فوری"]
          ].map(([value,label]) => `
            <option
              value="${value}"
              ${String(value) === String(todo?.priority || "normal") ? "selected" : ""}
            >
              ${label}
            </option>
          `).join("")}
        `
      )}

      ${formField(
        "تاریخ سررسید",
        "due_date",
        "date",
        "",
        todo?.due_date
          ? String(todo.due_date).slice(0,10)
          : ""
      )}

      <label class="field full">

        <span>توضیحات</span>

        <textarea
          name="notes"
          rows="4"
        >${esc(todo?.notes || "")}</textarea>

      </label>


      <button
        class="primary full submit"
        type="submit"
      >
        ${
          editing
            ? "ذخیره تغییرات"
            : "ثبت یادداشت"
        }
      </button>

    </form>
  `);


  $("#todoForm").onsubmit =
    async e => {

      e.preventDefault();

      const data =
        formDataObject(e.target);

      if (editing) {
        data.todo_id =
          todo.todo_id;
      }

      await submitPost(
        editing
          ? "updateTodo"
          : "createTodo",
        data,
        editing
          ? "یادداشت ویرایش شد"
          : "یادداشت ثبت شد"
      );
    };
}


async function deleteTodo(id) {

  if (
    !confirm(
      "این یادداشت حذف شود؟"
    )
  ) return;

  try {

    const result =
      await post(
        "deleteTodo",
        { todo_id:id }
      );

    if (!result.success)
      throw new Error(
        result.message ||
        "حذف انجام نشد"
      );

    toast("یادداشت حذف شد");

    await loadAll(false);

  } catch (error) {

    toast(
      error.message ||
      "حذف انجام نشد",
      true
    );
  }
}


async function updateTodoStatus(
  todo,
  status
) {

  try {

    const result =
      await post(
        "updateTodo",
        {
          todo_id:todo.todo_id,
          status
        }
      );

    if (!result.success)
      throw new Error(
        result.message ||
        "بروزرسانی انجام نشد"
      );

    await loadAll(false);

  } catch (error) {

    toast(
      error.message ||
      "بروزرسانی انجام نشد",
      true
    );
  }
}


/* =========================================================
   FINANCE & PROFITABILITY
========================================================= */

function approvedPayments() {
  return state.payments.filter(
    p => !p.status || p.status === "approved"
  );
}

function financeCourseRows() {

  return state.courses
    .map(course => {

      const m = courseMetrics(course);

      const margin =
        m.revenue
          ? Math.round(
              (m.profit / m.revenue) * 100
            )
          : 0;

      return {
        course,
        ...m,
        margin
      };
    })
    .sort(
      (a, b) =>
        b.profit - a.profit
    );
}


function renderFinance() {

  title(
    "مالی و سودآوری",
    "کنترل درآمد، هزینه، سود و عملکرد اقتصادی دوره‌ها"
  );

  const payments =
    approvedPayments();

  const revenue =
    sumAmount(payments);

  const generalExpense =
    sumAmount(state.expenses);

  const inventoryConsumedCost =
    sumConsumptionCost(
      state.consumptions
    );

  const expense =
    generalExpense +
    inventoryConsumedCost;

  const purchaseSpend =
    state.purchases.reduce(
      (sum, p) =>
        sum + Number(p.total_amount || 0),
      0
    );

  const profit =
    revenue - expense;

  const margin =
    revenue
      ? Math.round(
          (profit / revenue) * 100
        )
      : 0;

  const rows =
    financeCourseRows();

  const profitable =
    rows.filter(
      x => x.profit > 0
    ).length;

  const lossMaking =
    rows.filter(
      x => x.profit < 0
    ).length;

  const avgTicket =
    payments.length
      ? Math.round(
          revenue / payments.length
        )
      : 0;

  const maxProfit =
    Math.max(
      1,
      ...rows.map(
        x =>
          Math.max(
            0,
            Number(x.profit || 0)
          )
      )
    );


  $("#content").innerHTML = `

    <section class="hero">

      <div>

        <span class="eyebrow">
          FINANCIAL CONTROL CENTER
        </span>

        <h1>
          تصویر مالی آکادمی
        </h1>

        <p>
          سود خالص فعلی
          <b>${money(profit)}</b>
          با حاشیه سود
          <b>${faNum(margin)}٪</b>
        </p>

      </div>

      <button
        class="hero-add"
        data-action="newExpense"
      >
        ＋ ثبت هزینه
      </button>

    </section>


    <div class="kpi-grid">

      <div class="kpi success">
        <span>درآمد وصول‌شده</span>
        <strong>${money(revenue)}</strong>
        <small>
          ${faNum(payments.length)}
          پرداخت تأییدشده
        </small>
      </div>

      <div class="kpi danger">
        <span>کل هزینه‌ها</span>
        <strong>${money(expense)}</strong>
        <small>
          ${faNum(state.expenses.length)}
          رکورد هزینه
        </small>
      </div>

      <div class="kpi ${profit >= 0 ? "success" : "danger"}">
        <span>سود خالص</span>
        <strong>${money(profit)}</strong>
        <small>
          درآمد منهای هزینه
        </small>
      </div>

      <div class="kpi warning">
        <span>حاشیه سود</span>
        <strong>${faNum(margin)}٪</strong>
        <small>
          Profit Margin
        </small>
      </div>

    </div>


    <div class="panel" style="margin-top:14px">

      <div class="panel-head">

        <div>
          <h3>ساختار هزینه آکادمی</h3>
          <p>
            خرید انبار هنگام خرید «موجودی» است؛ هزینه دوره زمانی شناسایی می‌شود که کالا برای یک دوره مصرف شود.
          </p>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">

          <button
            class="secondary glass-button"
            data-action="newExpense"
          >
            ＋ هزینه عمومی
          </button>

          <button
            class="primary"
            data-action="newPurchase"
          >
            ＋ فاکتور خرید کالا
          </button>

        </div>

      </div>

      <div class="finance-strip">

        <div>
          <span>هزینه عمومی / خدمات</span>
          <strong>
            ${money(generalExpense)}
          </strong>
        </div>

        <div>
          <span>کالای مصرف‌شده در دوره‌ها</span>
          <strong>
            ${money(inventoryConsumedCost)}
          </strong>
        </div>

        <div>
          <span>خرید انبار</span>
          <strong>
            ${money(purchaseSpend)}
          </strong>
        </div>

      </div>

    </div>

    <div class="kpi-grid" style="margin-top:14px">

      <div class="kpi">
        <span>میانگین هر پرداخت</span>
        <strong>${money(avgTicket)}</strong>
        <small>Average Ticket</small>
      </div>

      <div class="kpi success">
        <span>دوره‌های سودده</span>
        <strong>${faNum(profitable)}</strong>
        <small>سود مثبت</small>
      </div>

      <div class="kpi danger">
        <span>دوره‌های زیان‌ده</span>
        <strong>${faNum(lossMaking)}</strong>
        <small>نیازمند بررسی</small>
      </div>

      <div class="kpi">
        <span>کل دانشجویان</span>
        <strong>${faNum(state.students.length)}</strong>
        <small>ثبت‌نام قطعی</small>
      </div>

    </div>


    <section class="panel" style="margin-top:16px">

      <div class="panel-head">

        <div>
          <h3>سودآوری به تفکیک دوره</h3>
          <p>
            مقایسه فروش، هزینه و سود واقعی هر دوره
          </p>
        </div>

        <span class="count">
          ${faNum(rows.length)}
        </span>

      </div>

      ${
        rows.length
          ? `
            <div style="display:grid;gap:12px">

              ${
                rows.map(x => {

                  const width =
                    Math.max(
                      3,
                      Math.round(
                        Math.max(
                          0,
                          x.profit
                        ) /
                        maxProfit *
                        100
                      )
                    );

                  return `
                    <button
                      class="lead-row"
                      data-finance-course="${esc(
                        x.course.course_id
                      )}"
                      style="
                        width:100%;
                        text-align:right;
                        position:relative;
                        overflow:hidden
                      "
                    >

                      <div
                        style="
                          position:absolute;
                          inset:auto 0 0 auto;
                          height:3px;
                          width:${width}%;
                          background:currentColor;
                          opacity:.55
                        "
                      ></div>

                      <div class="avatar">
                        ${x.profit >= 0 ? "↗" : "↘"}
                      </div>

                      <div class="lead-main">

                        <b>
                          ${esc(
                            x.course.course_name
                          )}
                        </b>

                        <span>
                          درآمد:
                          ${money(x.revenue)}
                          ·
                          هزینه:
                          ${money(x.cost)}
                        </span>

                      </div>

                      <div class="lead-end">

                        <b>
                          ${money(x.profit)}
                        </b>

                        <em
                          class="badge ${
                            x.profit > 0
                              ? "green"
                              : x.profit < 0
                                ? "red"
                                : "gray"
                          }"
                        >
                          Margin
                          ${faNum(x.margin)}٪
                        </em>

                      </div>

                    </button>
                  `;
                }).join("")
              }

            </div>
          `
          : `
            <div class="empty">
              <b>داده مالی دوره‌ای نداریم</b>
              <span>
                پس از ثبت دوره، پرداخت و هزینه،
                تحلیل سودآوری اینجا نمایش داده می‌شود.
              </span>
            </div>
          `
      }

    </section>


    <div class="two-col" style="margin-top:16px">

      <section class="panel">

        <div class="panel-head">

          <div>
            <h3>آخرین پرداخت‌ها</h3>
            <p>
              جریان ورودی وجه
            </p>
          </div>

          <span class="count">
            ${faNum(payments.length)}
          </span>

        </div>

        ${
          payments.length
            ? `
              <div class="lead-list">

                ${
                  payments
                    .slice()
                    .reverse()
                    .slice(0, 8)
                    .map(p => {

                      const lead =
                        state.leads.find(
                          l =>
                            String(l.lead_id) ===
                            String(p.lead_id)
                        );

                      return `
                        <div
                          class="lead-row"
                          style="cursor:default"
                        >

                          <div class="avatar">
                            +
                          </div>

                          <div class="lead-main">

                            <b>
                              ${esc(
                                lead?.full_name ||
                                "پرداخت دانشجو"
                              )}
                            </b>

                            <span>
                              ${dateFa(
                                p.payment_date ||
                                p.created_at
                              )}
                            </span>

                          </div>

                          <div class="lead-end">

                            <b>
                              ${money(p.amount)}
                            </b>

                            <small>
                              ${esc(
                                p.payment_method ||
                                ""
                              )}
                            </small>

                          </div>

                        </div>
                      `;
                    })
                    .join("")
                }

              </div>
            `
            : `
              <div class="empty">
                <b>پرداختی ثبت نشده</b>
                <span>
                  پرداخت‌های تأییدشده اینجا دیده می‌شوند.
                </span>
              </div>
            `
        }

      </section>


      <section class="panel">

        <div class="panel-head">

          <div>
            <h3>آخرین هزینه‌ها</h3>
            <p>
              جریان خروجی وجه
            </p>
          </div>

          <button
            class="secondary glass-button"
            data-action="newExpense"
          >
            ＋ هزینه
          </button>

        </div>

        ${
          state.expenses.length
            ? `
              <div class="lead-list">

                ${
                  state.expenses
                    .slice()
                    .reverse()
                    .slice(0, 8)
                    .map(e => `
                      <div
                        class="lead-row"
                        style="cursor:default"
                      >

                        <div class="avatar">
                          −
                        </div>

                        <div class="lead-main">

                          <b>
                            ${esc(
                              e.description ||
                              e.category ||
                              "هزینه"
                            )}
                          </b>

                          <span>
                            ${esc(
                              courseName(
                                e.course_id
                              )
                            )}
                          </span>

                        </div>

                        <div class="lead-end">

                          <b>
                            ${money(e.amount)}
                          </b>

                          <button
                            class="secondary glass-button mini-edit-btn"
                            data-expense-edit="${esc(e.expense_id)}"
                          >
                            ویرایش
                          </button>

                        </div>

                      </div>
                    `)
                    .join("")
                }

              </div>
            `
            : `
              <div class="empty">
                <b>هزینه‌ای ثبت نشده</b>
                <span>
                  هزینه‌های مدرس، سالن، تجهیزات،
                  تبلیغات و سایر موارد را ثبت کنید.
                </span>
              </div>
            `
        }

      </section>

    </div>
  `;


  bindActions();

  $$("[data-expense-edit]")
    .forEach(button => {
      button.onclick = () => {
        const expense =
          state.expenses.find(
            e =>
              String(e.expense_id) ===
              String(
                button.dataset.expenseEdit
              )
          );

        if (expense)
          editExpense(expense);
      };
    });

  $$("[data-finance-course]")
    .forEach(
      btn =>
        btn.onclick =
          () =>
            openCourse(
              btn.dataset.financeCourse
            )
    );
}


/* =========================================================
   INVENTORY / PURCHASES / COURSE CONSUMPTION
========================================================= */

function inventoryProductStock(productId) {
  return state.purchaseItems
    .filter(
      item =>
        String(item.product_id) ===
        String(productId)
    )
    .reduce(
      (sum, item) =>
        sum +
        Number(
          item.remaining_qty ?? item.quantity ?? 0
        ),
      0
    );
}

function inventoryProductValue(productId) {
  return state.purchaseItems
    .filter(
      item =>
        String(item.product_id) ===
        String(productId)
    )
    .reduce(
      (sum, item) =>
        sum +
        Number(item.remaining_qty ?? 0) *
        Number(
          item.landed_unit_cost ??
          item.unit_price ??
          0
        ),
      0
    );
}


function activeProducts() {
  return state.products.filter(
    p =>
      String(
        p.status || "active"
      ).toLowerCase() !==
      "deleted"
  );
}


function inventoryTotals() {
  const stockValue =
    state.purchaseItems.reduce(
      (sum, item) =>
        sum +
        Number(item.remaining_qty ?? 0) *
        Number(
          item.landed_unit_cost ??
          item.unit_price ??
          0
        ),
      0
    );

  const purchaseValue =
    state.purchases.reduce(
      (sum, p) =>
        sum + Number(p.total_amount || 0),
      0
    );

  const consumedValue =
    sumConsumptionCost(
      state.consumptions
    );

  const lowStock =
    activeProducts().filter(p => {
      const min =
        Number(p.min_stock || 0);
      if (!min) return false;
      return (
        inventoryProductStock(p.product_id) <=
        min
      );
    }).length;

  return {
    stockValue,
    purchaseValue,
    consumedValue,
    lowStock
  };
}



async function refreshInventoryData() {

  try {

    const bundle =
      await get(
        "inventoryBundle"
      );

    if (
      !bundle?.success ||
      !bundle?.data
    ) {
      throw new Error(
        bundle?.message ||
        "اطلاعات انبار دریافت نشد."
      );
    }

    state.products =
      bundle.data.products || [];

    state.purchases =
      bundle.data.purchases || [];

    state.purchaseItems =
      bundle.data.purchaseItems || [];

    state.purchaseCosts =
      bundle.data.purchaseCosts || [];

    state.consumptions =
      bundle.data.consumptions || [];

    state.inventoryMovements =
      bundle.data.inventoryMovements || [];

    return true;

  } catch (error) {

    console.error(
      "refreshInventoryData:",
      error
    );

    return false;
  }
}


function renderInventory() {

  title(
    "انبار و مصرف دوره‌ها",
    "خرید کالا، موجودی و تخصیص هزینه واقعی به هر دوره"
  );

  const t =
    inventoryTotals();

  $("#content").innerHTML = `

    <section class="hero">

      <div>
        <span class="eyebrow">
          INVENTORY & COST ALLOCATION
        </span>

        <h1>
          انبار آکادمی
        </h1>

        <p>
          کالا را خریداری کنید، موجودی را ببینید و مصرف واقعی هر دوره را ثبت کنید.
        </p>
      </div>

      <button
        class="hero-add"
        data-action="newPurchase"
      >
        ＋ فاکتور خرید
      </button>

    </section>


    <div class="kpi-grid">

      <div class="kpi">
        <span>اقلام تعریف‌شده</span>
        <strong>
          ${faNum(activeProducts().length)}
        </strong>
        <small>SKU / کالا</small>
      </div>

      <div class="kpi success">
        <span>ارزش موجودی</span>
        <strong>
          ${money(t.stockValue)}
        </strong>
        <small>موجودی مصرف‌نشده</small>
      </div>

      <div class="kpi warning">
        <span>مصرف ثبت‌شده</span>
        <strong>
          ${money(t.consumedValue)}
        </strong>
        <small>هزینه تخصیص‌یافته به دوره‌ها</small>
      </div>

      <div class="kpi danger">
        <span>موجودی کم</span>
        <strong>
          ${faNum(t.lowStock)}
        </strong>
        <small>نیازمند خرید</small>
      </div>

    </div>


    <div
      class="toolbar"
      style="margin-top:18px"
    >

      <div>
        <h3>موجودی کالا</h3>
        <p>
          موجودی از فاکتورهای خرید منهای مصرف دوره‌ها محاسبه می‌شود.
        </p>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">

        <button
          class="secondary glass-button"
          data-action="newProduct"
        >
          ＋ تعریف کالا
        </button>

        <button
          class="secondary glass-button"
          data-action="newConsumption"
        >
          ثبت مصرف دوره
        </button>

        <button
          class="primary"
          data-action="newPurchase"
        >
          ＋ فاکتور خرید
        </button>

      </div>

    </div>


    <section class="panel">

      ${
        activeProducts().length
          ? `
            <div
              style="
                overflow:auto;
                width:100%;
              "
            >
              <table
                style="
                  width:100%;
                  min-width:780px;
                  border-collapse:collapse;
                "
              >

                <thead>
                  <tr>
                    <th style="padding:12px;text-align:right">
                      کالا
                    </th>
                    <th style="padding:12px;text-align:right">
                      کد
                    </th>
                    <th style="padding:12px;text-align:right">
                      واحد مصرف
                    </th>
                    <th style="padding:12px;text-align:right">
                      واحد خرید
                    </th>
                    <th style="padding:12px;text-align:right">
                      موجودی
                    </th>
                    <th style="padding:12px;text-align:right">
                      حداقل موجودی
                    </th>
                    <th style="padding:12px;text-align:right">
                      ارزش موجودی
                    </th>
                    <th style="padding:12px;text-align:right">
                      عملیات
                    </th>
                  </tr>
                </thead>

                <tbody>

                  ${
                    activeProducts().map(p => {

                      const stock =
                        inventoryProductStock(
                          p.product_id
                        );

                      const min =
                        Number(
                          p.min_stock || 0
                        );

                      const low =
                        min > 0 &&
                        stock <= min;

                      return `
                        <tr
                          style="
                            border-top:
                            1px solid
                            rgba(255,255,255,.08)
                          "
                        >
                          <td style="padding:12px">
                            <b>
                              ${esc(
                                p.product_name ||
                                "بدون نام"
                              )}
                            </b>
                            <div
                              style="
                                font-size:10px;
                                opacity:.6;
                                margin-top:3px
                              "
                            >
                              ${esc(
                                p.category || ""
                              )}
                            </div>
                          </td>

                          <td style="padding:12px">
                            ${esc(p.sku || "—")}
                          </td>

                          <td style="padding:12px">
                            ${esc(p.unit || "عدد")}
                          </td>

                          <td style="padding:12px">
                            <b>
                              ${esc(
                                p.purchase_unit ||
                                p.unit ||
                                "عدد"
                              )}
                            </b>
                            <div
                              style="
                                font-size:9px;
                                opacity:.58;
                                margin-top:3px;
                              "
                            >
                              هر
                              ${esc(
                                p.purchase_unit ||
                                p.unit ||
                                "واحد"
                              )}
                              =
                              ${faNum(
                                Number(
                                  p.units_per_purchase ||
                                  1
                                )
                              )}
                              ${esc(p.unit || "عدد")}
                            </div>
                          </td>

                          <td style="padding:12px">
                            <span
                              class="badge ${
                                low
                                  ? "red"
                                  : "green"
                              }"
                            >
                              ${faNum(stock)}
                            </span>
                          </td>

                          <td style="padding:12px">
                            ${faNum(min)}
                          </td>

                          <td style="padding:12px">
                            <b>
                              ${money(
                                inventoryProductValue(
                                  p.product_id
                                )
                              )}
                            </b>
                          </td>

                          <td style="padding:12px">
                            <div
                              style="
                                display:flex;
                                gap:6px;
                                flex-wrap:wrap;
                              "
                            >
                              <button
                                class="secondary glass-button mini-edit-btn"
                                data-product-edit="${esc(p.product_id)}"
                              >
                                ویرایش
                              </button>

                              <button
                                class="danger-action mini-edit-btn"
                                data-product-delete="${esc(p.product_id)}"
                              >
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join("")
                  }

                </tbody>

              </table>
            </div>
          `
          : `
            <div class="empty">
              <b>هنوز کالایی تعریف نشده</b>
              <span>
                ابتدا یک کالا تعریف کنید، سپس فاکتور خرید را ثبت کنید.
              </span>
            </div>
          `
      }

    </section>


    <div class="two-col">

      <section class="panel">

        <div class="panel-head">
          <div>
            <h3>آخرین فاکتورهای خرید</h3>
            <p>
              خریدهای ورودی به انبار
            </p>
          </div>
          <span class="count">
            ${faNum(state.purchases.length)}
          </span>
        </div>

        ${
          state.purchases.length
            ? `
              <div class="lead-list">
                ${
                  state.purchases
                    .slice()
                    .reverse()
                    .slice(0,10)
                    .map(p => `
                      <div
                        class="lead-row"
                        style="cursor:default"
                      >
                        <div class="avatar">
                          +
                        </div>

                        <div class="lead-main">
                          <b>
                            ${esc(
                              p.supplier ||
                              "فاکتور خرید"
                            )}
                          </b>
                          <span>
                            ${
                              esc(
                                p.invoice_no ||
                                "بدون شماره"
                              )
                            }
                            ·
                            ${dateFa(
                              p.purchase_date ||
                              p.created_at
                            )}
                          </span>
                        </div>

                        <div class="lead-end">
                          <b>
                            ${money(
                              p.total_amount
                            )}
                          </b>

                          ${
                            Number(
                              p.ancillary_total || 0
                            ) > 0
                              ? `
                                <small>
                                  جانبی:
                                  ${money(
                                    p.ancillary_total
                                  )}
                                </small>
                              `
                              : ""
                          }

                          <button
                            class="secondary glass-button mini-edit-btn"
                            data-purchase-edit="${esc(p.purchase_id)}"
                          >
                            ویرایش
                          </button>
                        </div>
                      </div>
                    `)
                    .join("")
                }
              </div>
            `
            : `
              <div class="empty">
                <b>فاکتور خریدی ثبت نشده</b>
                <span>
                  اولین فاکتور خرید انبار را ثبت کنید.
                </span>
              </div>
            `
        }

      </section>


      <section class="panel">

        <div class="panel-head">
          <div>
            <h3>مصرف دوره‌ها</h3>
            <p>
              هزینه کالای مصرف‌شده در هر دوره
            </p>
          </div>
          <span class="count">
            ${faNum(state.consumptions.length)}
          </span>
        </div>

        ${
          state.consumptions.length
            ? `
              <div class="lead-list">
                ${
                  state.consumptions
                    .slice()
                    .reverse()
                    .slice(0,12)
                    .map(c => {

                      const product =
                        state.products.find(
                          p =>
                            String(p.product_id) ===
                            String(c.product_id)
                        );

                      return `
                        <div
                          class="lead-row"
                          style="cursor:default"
                        >
                          <div class="avatar">
                            −
                          </div>

                          <div class="lead-main">
                            <b>
                              ${esc(
                                product?.product_name ||
                                c.product_name ||
                                "کالا"
                              )}
                            </b>
                            <span>
                              ${esc(
                                courseName(
                                  c.course_id
                                ) ||
                                "بدون دوره"
                              )}
                              ·
                              ${faNum(c.quantity)}
                              ${esc(c.unit || "")}
                            </span>
                          </div>

                          <div class="lead-end">
                            <b>
                              ${money(
                                c.total_cost
                              )}
                            </b>

                            <button
                              class="secondary glass-button mini-edit-btn"
                              data-consumption-edit="${esc(c.consumption_id)}"
                            >
                              ویرایش
                            </button>
                          </div>
                        </div>
                      `;
                    })
                    .join("")
                }
              </div>
            `
            : `
              <div class="empty">
                <b>مصرفی ثبت نشده</b>
                <span>
                  مصرف هر دوره را از موجودی انبار ثبت کنید.
                </span>
              </div>
            `
        }

      </section>

    </div>
  `;

  bindActions();

  $$("[data-product-edit]")
    .forEach(button => {
      button.onclick = () => {
        const product =
          state.products.find(
            p =>
              String(p.product_id) ===
              String(
                button.dataset.productEdit
              )
          );

        if (product)
          editProduct(product);
      };
    });


  $$("[data-product-delete]")
    .forEach(button => {

      button.onclick =
        async () => {

          const product =
            state.products.find(
              p =>
                String(p.product_id) ===
                String(
                  button.dataset.productDelete
                )
            );

          if (!product) return;

          const stock =
            inventoryProductStock(
              product.product_id
            );

          const ok =
            confirm(
              `کالای «${product.product_name || "بدون نام"}» حذف شود؟\n\n` +
              (
                stock > 0
                  ? `این کالا ${stock} ${product.unit || ""} موجودی دارد. برای حفظ سابقه مالی، از لیست فعال حذف می‌شود ولی تاریخچه خرید و مصرف باقی می‌ماند.`
                  : "اگر سابقه خرید یا مصرف داشته باشد، تاریخچه آن حفظ می‌شود."
              )
            );

          if (!ok) return;

          try {

            loading(true);

            const result =
              await post(
                "deleteProduct",
                {
                  product_id:
                    product.product_id
                }
              );

            if (!result?.success) {
              throw new Error(
                result?.message ||
                "حذف کالا انجام نشد."
              );
            }

            state.products =
              state.products.map(p =>
                String(p.product_id) ===
                String(product.product_id)
                  ? {
                      ...p,
                      status:"deleted"
                    }
                  : p
              );

            toast(
              result.mode === "hard"
                ? "کالا حذف شد"
                : "کالا از لیست فعال حذف شد و سابقه آن حفظ شد"
            );

            render();

            refreshInventoryData()
              .then(() => render());

          } catch (error) {

            toast(
              error.message ||
              "حذف کالا انجام نشد.",
              true
            );

          } finally {

            loading(false);
          }
        };
    });

  $$("[data-purchase-edit]")
    .forEach(button => {
      button.onclick = () => {
        const purchase =
          state.purchases.find(
            p =>
              String(p.purchase_id) ===
              String(
                button.dataset.purchaseEdit
              )
          );

        if (purchase)
          editPurchase(purchase);
      };
    });

  $$("[data-consumption-edit]")
    .forEach(button => {
      button.onclick = () => {
        const item =
          state.consumptions.find(
            c =>
              String(c.consumption_id) ===
              String(
                button.dataset.consumptionEdit
              )
          );

        if (item)
          editConsumption(item);
      };
    });
}


function editProduct(product) {

  modal(`

    <div class="modal-title">
      <span>EDIT PRODUCT</span>
      <h2>ویرایش کالا</h2>
    </div>

    <form
      id="editProductForm"
      class="form-grid"
    >

      ${formField(
        "نام کالا",
        "product_name",
        "text",
        "",
        product.product_name || ""
      )}

      ${formField(
        "کد / SKU",
        "sku",
        "text",
        "",
        product.sku || ""
      )}

      ${selectField(
        "واحد مصرف",
        "unit",
        `
          ${["","عدد","بسته","جفت"].map(x => `
            <option
              value="${esc(x)}"
              ${String(x) === String(product.unit || "") ? "selected" : ""}
            >
              ${x || "انتخاب کنید"}
            </option>
          `).join("")}
        `
      )}

      ${selectField(
        "واحد خرید",
        "purchase_unit",
        `
          ${["","عدد","بسته","جفت"].map(x => `
            <option
              value="${esc(x)}"
              ${String(x) === String(product.purchase_unit || product.unit || "") ? "selected" : ""}
            >
              ${x || "انتخاب کنید"}
            </option>
          `).join("")}
        `
      )}

      ${formField(
        "تعداد واحد مصرف در هر واحد خرید",
        "units_per_purchase",
        "number",
        "",
        product.units_per_purchase ||
        1
      )}

      ${selectField(
        "دسته‌بندی",
        "category",
        `
          ${["","مصرفی","تجهیزات","سایر"].map(x => `
            <option
              value="${esc(x)}"
              ${String(x) === String(product.category || "") ? "selected" : ""}
            >
              ${x || "انتخاب کنید"}
            </option>
          `).join("")}
        `
      )}

      ${formField(
        "حداقل موجودی",
        "min_stock",
        "number",
        "",
        product.min_stock || ""
      )}

      <label class="field full">
        <span>توضیحات</span>
        <textarea
          name="notes"
          rows="3"
        >${esc(
          product.notes || ""
        )}</textarea>
      </label>

      <button
        class="primary full submit"
        type="submit"
      >
        ذخیره تغییرات
      </button>

    </form>
  `);

  $("#editProductForm")
    .onsubmit =
      async e => {

        e.preventDefault();

        await submitPost(
          "updateProduct",
          {
            ...formDataObject(
              e.target
            ),
            product_id:
              product.product_id
          },
          "کالا ویرایش شد"
        );
      };
}


function editPurchase(purchase) {

  modal(`

    <div class="modal-title">
      <span>PURCHASE</span>
      <h2>ویرایش اطلاعات فاکتور خرید</h2>
      <p>
        برای حفظ صحت موجودی،
        تعداد و قیمت ردیف‌های خرید
        بعد از ثبت گردش انبار
        از این صفحه تغییر نمی‌کنند.
      </p>
    </div>

    <form
      id="editPurchaseForm"
      class="form-grid"
    >

      ${formField(
        "فروشنده",
        "supplier",
        "text",
        "",
        purchase.supplier || ""
      )}

      ${formField(
        "شماره فاکتور",
        "invoice_no",
        "text",
        "",
        purchase.invoice_no || ""
      )}

      ${formField(
        "تاریخ خرید",
        "purchase_date",
        "date",
        "",
        purchase.purchase_date
          ? String(
              purchase.purchase_date
            ).slice(0,10)
          : ""
      )}

      <label class="field full">
        <span>توضیحات</span>
        <textarea
          name="notes"
          rows="3"
        >${esc(
          purchase.notes || ""
        )}</textarea>
      </label>

      <button
        class="primary full submit"
        type="submit"
      >
        ذخیره تغییرات
      </button>

    </form>
  `);

  $("#editPurchaseForm")
    .onsubmit =
      async e => {

        e.preventDefault();

        await submitPost(
          "updatePurchase",
          {
            ...formDataObject(
              e.target
            ),
            purchase_id:
              purchase.purchase_id
          },
          "فاکتور خرید ویرایش شد"
        );
      };
}


function editConsumption(item) {

  modal(`

    <div class="modal-title">
      <span>CONSUMPTION</span>
      <h2>ویرایش مصرف دوره</h2>
      <p>
        مقدار و بهای مصرف پس از تخصیص موجودی
        قفل است؛ تاریخ و توضیحات قابل ویرایش است.
      </p>
    </div>

    <div class="profile-info" style="margin-bottom:14px">

      <div>
        <span>کالا</span>
        <b>
          ${esc(
            item.product_name ||
            "—"
          )}
        </b>
      </div>

      <div>
        <span>تعداد</span>
        <b>
          ${faNum(
            item.quantity
          )}
          ${esc(item.unit || "")}
        </b>
      </div>

      <div>
        <span>هزینه تخصیص‌یافته</span>
        <b>
          ${money(
            item.total_cost
          )}
        </b>
      </div>

    </div>

    <form
      id="editConsumptionForm"
      class="form-grid"
    >

      ${formField(
        "تاریخ مصرف",
        "consumption_date",
        "date",
        "",
        item.consumption_date
          ? String(
              item.consumption_date
            ).slice(0,10)
          : ""
      )}

      <label class="field full">
        <span>توضیحات</span>
        <textarea
          name="notes"
          rows="3"
        >${esc(
          item.notes || ""
        )}</textarea>
      </label>

      <button
        class="primary full submit"
        type="submit"
      >
        ذخیره تغییرات
      </button>

    </form>
  `);

  $("#editConsumptionForm")
    .onsubmit =
      async e => {

        e.preventDefault();

        await submitPost(
          "updateConsumption",
          {
            ...formDataObject(
              e.target
            ),
            consumption_id:
              item.consumption_id
          },
          "مصرف دوره ویرایش شد"
        );
      };
}


function newProduct() {

  modal(`

    <div class="modal-title">
      <span>PRODUCT</span>
      <h2>تعریف کالا</h2>
      <p>
        کالاهای مصرفی، تجهیزات کوچک، مواد آموزشی و اقلام موردنیاز دوره‌ها.
      </p>
    </div>

    <form
      id="productForm"
      class="form-grid"
    >

      ${formField(
        "نام کالا",
        "product_name"
      )}

      ${formField(
        "کد / SKU",
        "sku"
      )}

      ${selectField(
        "واحد مصرف",
        "unit",
        `
          <option value="">انتخاب کنید</option>
          <option value="عدد">عدد</option>
          <option value="بسته">بسته</option>
          <option value="جفت">جفت</option>
        `
      )}

      ${selectField(
        "واحد خرید",
        "purchase_unit",
        `
          <option value="">انتخاب کنید</option>
          <option value="عدد">عدد</option>
          <option value="بسته">بسته</option>
          <option value="جفت">جفت</option>
        `
      )}

      ${formField(
        "تعداد واحد مصرف در هر واحد خرید",
        "units_per_purchase",
        "number",
        'placeholder="مثلاً 150"'
      )}

      ${selectField(
        "دسته‌بندی",
        "category",
        `
          <option value="">انتخاب کنید</option>
          <option value="مصرفی">مصرفی</option>
          <option value="تجهیزات">تجهیزات</option>
          <option value="سایر">سایر</option>
        `
      )}

      ${formField(
        "حداقل موجودی",
        "min_stock",
        "number"
      )}

      <label class="field full">
        <span>توضیحات</span>
        <textarea
          name="notes"
          rows="3"
        ></textarea>
      </label>

      <button
        class="primary full submit"
        type="submit"
      >
        ذخیره کالا
      </button>

    </form>
  `);


  $("#productForm").onsubmit =
    async e => {

      e.preventDefault();

      const form =
        e.target;

      if (!form.dataset.requestId) {
        form.dataset.requestId =
          createRequestId(
            "PRDREQ"
          );
      }

      const button =
        form.querySelector(
          ".submit"
        );

      if (button) {
        button.disabled = true;
        button.textContent =
          "در حال ثبت...";
      }

      try {

        const payload =
          formDataObject(form);

        payload._request_id =
          form.dataset.requestId;

        const result =
          await post(
            "createProduct",
            payload
          );

        if (!result?.success) {
          throw new Error(
            result?.message ||
            "کالا ثبت نشد."
          );
        }

        if (result.data) {

          state.products =
            [
              ...state.products.filter(
                x =>
                  String(x.product_id) !==
                  String(
                    result.data.product_id
                  )
              ),
              result.data
            ];
        }

        closeModal();

        toast(
          result.duplicate_request
            ? "این کالا قبلاً با همین درخواست ثبت شده بود؛ رکورد تکراری ساخته نشد."
            : "کالا تعریف شد"
        );

        render();

        /*
          Reconcile in background; success is not dependent
          on this refresh finishing.
        */
        refreshInventoryData()
          .then(() => render());

      } catch (error) {

        console.error(error);

        toast(
          (
            error.message ||
            "ارتباط با سرور کامل نشد."
          ) +
          " اگر دوباره بزنید، کالا دوباره ثبت نمی‌شود.",
          true
        );

        if (button) {
          button.disabled = false;
          button.textContent =
            "تلاش مجدد";
        }
      }
    };
}




function purchaseLineHtml(index) {

  return `
    <div
      class="panel purchase-line"
      data-purchase-line="${index}"
      style="
        margin-bottom:10px;
        padding:14px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          margin-bottom:12px;
        "
      >
        <b>
          ردیف ${faNum(index + 1)}
        </b>

        <button
          type="button"
          class="danger-action remove-purchase-line"
          style="padding:7px 10px"
        >
          حذف ردیف
        </button>
      </div>

      <div class="form-grid">

        <label class="field">
          <span>کالا</span>

          <select
            name="product_id_${index}"
            class="purchase-product-select"
          >
            <option value="">
              انتخاب کالا
            </option>

            ${
              activeProducts().map(p => `
                <option
                  value="${esc(p.product_id)}"
                >
                  ${esc(p.product_name)}
                  — خرید:
                  ${esc(
                    p.purchase_unit ||
                    p.unit ||
                    "واحد"
                  )}
                  / مصرف:
                  ${esc(p.unit || "عدد")}
                </option>
              `).join("")
            }
          </select>
        </label>


        <label class="field">
          <span
            class="purchase-qty-label"
          >
            تعداد واحد خرید
          </span>

          <input
            name="purchase_quantity_${index}"
            type="text"
            data-number="true"
            inputmode="numeric"
            autocomplete="off"
          >
        </label>


        <label class="field">
          <span
            class="purchase-price-label"
          >
            قیمت هر واحد خرید
          </span>

          <input
            name="purchase_unit_price_${index}"
            type="text"
            data-number="true"
            inputmode="numeric"
            autocomplete="off"
          >
        </label>


        <div class="field">
          <span>مبلغ ردیف</span>
          <div
            class="purchase-line-total"
            style="
              min-height:45px;
              display:flex;
              align-items:center;
              padding:12px;
              border-radius:15px;
              background:rgba(255,255,255,.07);
              border:1px solid rgba(255,255,255,.12);
              font-weight:700;
            "
          >
            ۰ تومان
          </div>
        </div>

      </div>


      <div
        class="purchase-conversion-preview"
        style="
          margin-top:10px;
          padding:11px 12px;
          border-radius:15px;
          border:1px solid rgba(255,255,255,.1);
          background:rgba(255,255,255,.05);
          font-size:10px;
          line-height:1.9;
          opacity:.82;
        "
      >
        کالا را انتخاب کنید تا تبدیل واحد خرید به موجودی مصرف نمایش داده شود.
      </div>

    </div>
  `;
}




function ancillaryCostLineHtml(index) {

  return `
    <div
      class="panel ancillary-cost-line"
      data-cost-line="${index}"
      style="
        margin-bottom:8px;
        padding:12px;
      "
    >

      <div class="form-grid">

        ${formField(
          "عنوان هزینه جانبی",
          `cost_label_${index}`,
          "text",
          "",
          "هزینه ارسال"
        )}

        ${formField(
          "مبلغ",
          `cost_amount_${index}`,
          "number"
        )}

        <button
          type="button"
          class="danger-action remove-ancillary-line"
          style="
            align-self:end;
            min-height:45px;
          "
        >
          حذف
        </button>

      </div>

    </div>
  `;
}


async function newPurchase() {

  /*
    Never trust only the local state here.
    Re-read inventory first when the product list looks empty.
  */
  if (!activeProducts().length) {

    toast(
      "در حال دریافت لیست کالاها..."
    );

    await refreshInventoryData();
  }

  if (!state.products.length) {

    toast(
      "هنوز کالایی در انبار تعریف نشده است.",
      true
    );

    newProduct();

    return;
  }

  modal(`

    <div class="modal-title">

      <span>PURCHASE INVOICE</span>

      <h2>ثبت فاکتور خرید انبار</h2>

      <p>
        اقلام خرید و هر تعداد هزینه جانبی مثل ارسال، پیک یا بسته‌بندی را وارد کنید.
        سیستم هزینه‌های جانبی را خودکار بر اساس ارزش خرید بین کالاها تقسیم می‌کند.
      </p>

    </div>

    <form id="purchaseForm">

      <div class="form-grid">

        ${formField(
          "فروشنده (اختیاری)",
          "supplier"
        )}

        ${formField(
          "شماره فاکتور",
          "invoice_no"
        )}

        ${formField(
          "تاریخ خرید",
          "purchase_date",
          "date"
        )}

        <label class="field">

          <span>توضیحات</span>

          <input
            name="notes"
            type="text"
          >

        </label>

      </div>


      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin:20px 0 10px;
          gap:12px;
        "
      >

        <div>

          <h3 style="margin:0">
            اقلام فاکتور
          </h3>

          <small style="opacity:.6">
            فقط تعداد واحد خرید و قیمت همان واحد را وارد کنید؛ تبدیل به واحد مصرف خودکار است.
          </small>

        </div>

        <button
          id="addPurchaseLine"
          type="button"
          class="secondary glass-button"
        >
          ＋ ردیف کالا
        </button>

      </div>

      <div id="purchaseLines"></div>


      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin:22px 0 10px;
          gap:12px;
        "
      >

        <div>

          <h3 style="margin:0">
            هزینه‌های جانبی
          </h3>

          <small style="opacity:.6">
            هر تعداد هزینه ارسال، پیک، بسته‌بندی یا هزینه جانبی دیگر اضافه کنید.
          </small>

        </div>

        <button
          id="addAncillaryCost"
          type="button"
          class="secondary glass-button"
        >
          ＋ هزینه جانبی
        </button>

      </div>

      <div id="ancillaryCostLines"></div>


      <section
        class="panel"
        style="
          margin:14px 0;
          display:grid;
          grid-template-columns:
            repeat(3,1fr);
          gap:10px;
        "
      >

        <div>
          <span
            style="
              display:block;
              opacity:.65;
              font-size:10px;
            "
          >
            جمع کالاها
          </span>

          <strong
            id="purchaseGoodsTotal"
            style="font-size:18px"
          >
            ۰ تومان
          </strong>
        </div>

        <div>
          <span
            style="
              display:block;
              opacity:.65;
              font-size:10px;
            "
          >
            هزینه‌های جانبی
          </span>

          <strong
            id="purchaseAncillaryTotal"
            style="font-size:18px"
          >
            ۰ تومان
          </strong>
        </div>

        <div>
          <span
            style="
              display:block;
              opacity:.65;
              font-size:10px;
            "
          >
            بهای تمام‌شده خرید
          </span>

          <strong
            id="purchaseGrandTotal"
            style="font-size:20px"
          >
            ۰ تومان
          </strong>
        </div>

      </section>


      <div
        class="panel"
        style="
          margin:12px 0;
          padding:14px;
          font-size:11px;
          line-height:1.9;
        "
      >
        <b>روش تخصیص:</b>
        هزینه‌های جانبی بر اساس سهم ارزش هر کالا از کل خرید تقسیم می‌شوند.
        بنابراین هنگام مصرف کالا در هر دوره، سهم واقعی ارسال و سایر هزینه‌های جانبی هم همراه آن کالا وارد هزینه همان دوره می‌شود.
      </div>


      <button
        class="primary full submit"
        type="submit"
        style="width:100%"
      >
        ثبت خرید و افزایش موجودی
      </button>

    </form>
  `);


  let lineCounter = 0;
  let costCounter = 0;

  const lines =
    $("#purchaseLines");

  const costLines =
    $("#ancillaryCostLines");


  function addLine() {

    lines.insertAdjacentHTML(
      "beforeend",
      purchaseLineHtml(
        lineCounter
      )
    );

    lineCounter++;

    bindNumberInputs(lines);

    bindPurchaseLines();

    updatePurchaseTotals();
  }


  function addCostLine(
    label = "هزینه ارسال"
  ) {

    costLines.insertAdjacentHTML(
      "beforeend",
      ancillaryCostLineHtml(
        costCounter
      )
    );

    const row =
      costLines.lastElementChild;

    const labelInput =
      row?.querySelector(
        `[name="cost_label_${costCounter}"]`
      );

    if (labelInput) {
      labelInput.value =
        label;
    }

    costCounter++;

    bindNumberInputs(costLines);

    bindPurchaseLines();

    updatePurchaseTotals();
  }


  function getProductFromLine(line) {

    const select =
      line.querySelector(
        ".purchase-product-select"
      );

    return state.products.find(
      p =>
        String(p.product_id) ===
        String(select?.value || "")
    );
  }


  function updateLineConversion(
    line
  ) {

    const index =
      line.dataset.purchaseLine;

    const product =
      getProductFromLine(line);

    const qty =
      Number(
        rawNumber(
          line.querySelector(
            `[name="purchase_quantity_${index}"]`
          )?.value
        ) || 0
      );

    const packagePrice =
      Number(
        rawNumber(
          line.querySelector(
            `[name="purchase_unit_price_${index}"]`
          )?.value
        ) || 0
      );

    const purchaseUnit =
      product?.purchase_unit ||
      product?.unit ||
      "واحد";

    const consumptionUnit =
      product?.unit ||
      "عدد";

    const factor =
      Math.max(
        1,
        Number(
          product?.units_per_purchase ||
          1
        )
      );

    const consumptionQty =
      qty * factor;

    const lineTotal =
      qty * packagePrice;

    const baseUnitCost =
      consumptionQty > 0
        ? lineTotal /
          consumptionQty
        : 0;


    const qtyLabel =
      line.querySelector(
        ".purchase-qty-label"
      );

    if (qtyLabel) {
      qtyLabel.textContent =
        `تعداد ${purchaseUnit} خریداری‌شده`;
    }


    const priceLabel =
      line.querySelector(
        ".purchase-price-label"
      );

    if (priceLabel) {
      priceLabel.textContent =
        `قیمت هر ${purchaseUnit}`;
    }


    const totalEl =
      line.querySelector(
        ".purchase-line-total"
      );

    if (totalEl) {
      totalEl.textContent =
        money(lineTotal);
    }


    const preview =
      line.querySelector(
        ".purchase-conversion-preview"
      );

    if (!preview) return;

    if (!product) {

      preview.innerHTML =
        "کالا را انتخاب کنید تا تبدیل واحد نمایش داده شود.";

      return;
    }

    preview.innerHTML = `
      <b>
        هر
        ${esc(purchaseUnit)}
        =
        ${faNum(factor)}
        ${esc(consumptionUnit)}
      </b>

      <br>

      ${
        qty
          ? `
            این خرید وارد انبار می‌کند:
            <b>
              ${faNum(consumptionQty)}
              ${esc(consumptionUnit)}
            </b>
          `
          : `
            تعداد
            ${esc(purchaseUnit)}
            خریداری‌شده را وارد کنید.
          `
      }

      ${
        qty &&
        packagePrice
          ? `
            <br>
            قیمت پایه هر
            ${esc(consumptionUnit)}
            قبل از هزینه‌های جانبی:
            <b>
              ${money(baseUnitCost)}
            </b>
          `
          : ""
      }
    `;
  }


  function bindPurchaseLines() {

    $$(".remove-purchase-line")
      .forEach(btn => {

        btn.onclick = () => {

          btn
            .closest(
              ".purchase-line"
            )
            ?.remove();

          updatePurchaseTotals();
        };
      });


    $$(".remove-ancillary-line")
      .forEach(btn => {

        btn.onclick = () => {

          btn
            .closest(
              ".ancillary-cost-line"
            )
            ?.remove();

          updatePurchaseTotals();
        };
      });


    $$(".purchase-line")
      .forEach(line => {

        const productSelect =
          line.querySelector(
            ".purchase-product-select"
          );

        if (productSelect) {

          productSelect.onchange =
            () => {

              updateLineConversion(
                line
              );

              updatePurchaseTotals();
            };
        }

        line
          .querySelectorAll(
            "input"
          )
          .forEach(input => {

            input.oninput =
              () => {

                updateLineConversion(
                  line
                );

                updatePurchaseTotals();
              };
          });

        updateLineConversion(
          line
        );
      });


    $$(".ancillary-cost-line input")
      .forEach(input => {

        input.oninput =
          updatePurchaseTotals;
      });
  }


  function currentGoodsTotal() {

    let total = 0;

    $$(".purchase-line")
      .forEach(line => {

        const index =
          line.dataset.purchaseLine;

        const purchaseQty =
          Number(
            rawNumber(
              line.querySelector(
                `[name="purchase_quantity_${index}"]`
              )?.value
            ) || 0
          );

        const purchaseUnitPrice =
          Number(
            rawNumber(
              line.querySelector(
                `[name="purchase_unit_price_${index}"]`
              )?.value
            ) || 0
          );

        const lineTotal =
          purchaseQty *
          purchaseUnitPrice;

        total +=
          lineTotal;

        updateLineConversion(
          line
        );
      });

    return total;
  }


  function currentAncillaryTotal() {

    return $$(".ancillary-cost-line")
      .reduce(
        (sum,line) => {

          const index =
            line.dataset.costLine;

          const amount =
            Number(
              rawNumber(
                line.querySelector(
                  `[name="cost_amount_${index}"]`
                )?.value
              ) || 0
            );

          return sum + amount;
        },
        0
      );
  }


  function updatePurchaseTotals() {

    const goodsTotal =
      currentGoodsTotal();

    const ancillaryTotal =
      currentAncillaryTotal();

    $("#purchaseGoodsTotal")
      .textContent =
        money(goodsTotal);

    $("#purchaseAncillaryTotal")
      .textContent =
        money(ancillaryTotal);

    $("#purchaseGrandTotal")
      .textContent =
        money(
          goodsTotal +
          ancillaryTotal
        );
  }


  $("#addPurchaseLine").onclick =
    addLine;

  $("#addAncillaryCost").onclick =
    () =>
      addCostLine(
        "هزینه ارسال"
      );


  addLine();
  addCostLine(
    "هزینه ارسال"
  );


  $("#purchaseForm").onsubmit =
    async e => {

      e.preventDefault();

      const base =
        formDataObject(
          e.target
        );

      const items = [];

      $$(".purchase-line")
        .forEach(line => {

          const index =
            line.dataset.purchaseLine;

          const productId =
            line.querySelector(
              `[name="product_id_${index}"]`
            )?.value || "";

          const purchaseQuantity =
            Number(
              rawNumber(
                line.querySelector(
                  `[name="purchase_quantity_${index}"]`
                )?.value
              ) || 0
            );

          const purchaseUnitPrice =
            Number(
              rawNumber(
                line.querySelector(
                  `[name="purchase_unit_price_${index}"]`
                )?.value
              ) || 0
            );

          if (
            productId ||
            purchaseQuantity ||
            purchaseUnitPrice
          ) {

            items.push({
              product_id:
                productId,
              purchase_quantity:
                purchaseQuantity,
              purchase_unit_price:
                purchaseUnitPrice
            });
          }
        });


      if (!items.length) {
        toast(
          "حداقل یک ردیف کالا وارد کنید.",
          true
        );
        return;
      }


      const extraCosts = [];

      $$(".ancillary-cost-line")
        .forEach(line => {

          const index =
            line.dataset.costLine;

          const label =
            line.querySelector(
              `[name="cost_label_${index}"]`
            )?.value?.trim() || "";

          const amount =
            Number(
              rawNumber(
                line.querySelector(
                  `[name="cost_amount_${index}"]`
                )?.value
              ) || 0
            );

          if (
            label ||
            amount
          ) {

            extraCosts.push({
              label:
                label ||
                "هزینه جانبی",
              amount
            });
          }
        });


      await submitPost(
        "createPurchase",
        {
          supplier:
            base.supplier || "",
          invoice_no:
            base.invoice_no || "",
          purchase_date:
            base.purchase_date || "",
          notes:
            base.notes || "",
          items,
          extra_costs:
            extraCosts
        },
        "فاکتور خرید، هزینه‌های جانبی و موجودی ثبت شدند"
      );
    };
}




function newConsumption() {

  if (!activeProducts().length) {
    toast(
      "کالایی برای مصرف تعریف نشده است.",
      true
    );
    return;
  }

  modal(`

    <div class="modal-title">
      <span>COURSE CONSUMPTION</span>
      <h2>ثبت مصرف دوره</h2>
      <p>
        مقدار مصرف‌شده از موجودی انبار کم و هزینه واقعی آن به دوره تخصیص داده می‌شود.
      </p>
    </div>

    <form
      id="consumptionForm"
      class="form-grid"
    >

      ${selectField(
        "دوره",
        "course_id",
        `
          <option value="">
            انتخاب دوره
          </option>

          ${
            state.courses.map(c => `
              <option
                value="${esc(c.course_id)}"
              >
                ${esc(c.course_name)}
              </option>
            `).join("")
          }
        `
      )}

      ${selectField(
        "کالا",
        "product_id",
        `
          <option value="">
            انتخاب کالا
          </option>

          ${
            activeProducts().map(p => {

              const stock =
                inventoryProductStock(
                  p.product_id
                );

              return `
                <option
                  value="${esc(p.product_id)}"
                >
                  ${esc(p.product_name)}
                  — موجودی:
                  ${faNum(stock)}
                  ${esc(p.unit || "")}
                </option>
              `;
            }).join("")
          }
        `
      )}

      ${formField(
        "تعداد مصرف",
        "quantity",
        "number"
      )}

      ${formField(
        "تاریخ مصرف",
        "consumption_date",
        "date"
      )}

      <label class="field full">
        <span>توضیحات</span>
        <textarea
          name="notes"
          rows="3"
        ></textarea>
      </label>

      <button
        class="primary full submit"
        type="submit"
      >
        ثبت مصرف و تخصیص هزینه به دوره
      </button>

    </form>
  `);

  $("#consumptionForm").onsubmit =
    async e => {

      e.preventDefault();

      const data =
        formDataObject(e.target);

      const qty =
        Number(
          rawNumber(
            data.quantity
          ) || 0
        );

      if (
        !data.product_id ||
        qty <= 0
      ) {
        toast(
          "کالا و تعداد مصرف را وارد کنید.",
          true
        );
        return;
      }

      const stock =
        inventoryProductStock(
          data.product_id
        );

      if (qty > stock) {
        toast(
          `موجودی کافی نیست. موجودی فعلی ${faNum(stock)} است.`,
          true
        );
        return;
      }

      await submitPost(
        "createConsumption",
        {
          ...data,
          quantity:qty
        },
        "مصرف دوره ثبت شد و موجودی بروزرسانی شد"
      );
    };
}


/* =========================================================
   INVOICES / SALES RECEIPTS
========================================================= */

function buildInvoices() {

  state.invoices =
    state.payments
      .filter(
        p =>
          !p.status ||
          p.status === "approved"
      )
      .map((p, index) => {

        const lead =
          state.leads.find(
            l =>
              String(l.lead_id) ===
              String(p.lead_id)
          );

        const student =
          state.students.find(
            s =>
              String(s.student_id) ===
              String(p.student_id)
          );

        const course =
          state.courses.find(
            c =>
              String(c.course_id) ===
              String(p.course_id)
          );

        return {
          invoice_id:
            p.invoice_id ||
            p.payment_id ||
            `INV-${String(index + 1).padStart(4, "0")}`,

          payment_id:
            p.payment_id || "",

          full_name:
            lead?.full_name ||
            student?.full_name ||
            p.full_name ||
            "دانشجو",

          mobile:
            lead?.mobile ||
            student?.mobile ||
            p.mobile ||
            "",

          course_name:
            course?.course_name ||
            p.course_name ||
            "دوره آموزشی",

          course_code:
            course?.course_code ||
            "",

          amount:
            Number(p.amount || 0),

          payment_method:
            p.payment_method || "—",

          payment_date:
            p.payment_date ||
            p.created_at ||
            "",

          reference_no:
            p.transaction_reference ||
            p.reference_no ||
            ""
        };
      });

  return state.invoices;
}


function renderInvoices() {

  title(
    "فاکتورها",
    "رسیدها و اسناد فروش آکادمی"
  );

  const invoices =
    buildInvoices();

  const total =
    invoices.reduce(
      (sum, x) =>
        sum + Number(x.amount || 0),
      0
    );

  $("#content").innerHTML = `

    <div class="kpi-grid" style="margin-top:0;margin-bottom:14px">

      <div class="kpi">
        <span>تعداد فاکتورها</span>
        <strong>${faNum(invoices.length)}</strong>
        <small>بر اساس پرداخت‌های تأییدشده</small>
      </div>

      <div class="kpi success">
        <span>مبلغ کل</span>
        <strong>${money(total)}</strong>
        <small>فروش وصول‌شده</small>
      </div>

    </div>

    <section class="panel">

      <div class="panel-head">

        <div>
          <h3>فاکتورهای فروش</h3>
          <p>
            برای مشاهده و چاپ روی هر فاکتور بزنید.
          </p>
        </div>

        <span class="count">
          ${faNum(invoices.length)}
        </span>

      </div>

      ${
        invoices.length
          ? `
            <div class="lead-list">

              ${
                invoices
                  .slice()
                  .reverse()
                  .map(
                    inv => `
                      <button
                        class="lead-row"
                        data-invoice="${esc(inv.invoice_id)}"
                      >

                        <div class="avatar">
                          ▧
                        </div>

                        <div class="lead-main">

                          <b>
                            ${esc(inv.full_name)}
                          </b>

                          <span>
                            ${esc(inv.course_name)}
                            ·
                            ${dateFa(inv.payment_date)}
                          </span>

                        </div>

                        <div class="lead-end">

                          <b>
                            ${money(inv.amount)}
                          </b>

                          <small>
                            ${esc(inv.invoice_id)}
                          </small>

                        </div>

                      </button>
                    `
                  )
                  .join("")
              }

            </div>
          `
          : `
            <div class="empty">
              <b>هنوز فاکتوری وجود ندارد</b>
              <span>
                با ثبت پرداخت تأییدشده، رسید فروش اینجا ساخته می‌شود.
              </span>
            </div>
          `
      }

    </section>
  `;

  $$("[data-invoice]")
    .forEach(
      btn =>
        btn.onclick =
          () =>
            openInvoice(
              btn.dataset.invoice
            )
    );
}


function openInvoice(id) {

  const invoices =
    buildInvoices();

  const inv =
    invoices.find(
      x =>
        String(x.invoice_id) ===
        String(id)
    );

  if (!inv) return;

  modal(`

    <div id="invoicePrintArea">

      <div class="modal-title">

        <span>
          SYNERGY ACADEMY
        </span>

        <h2>
          رسید / فاکتور فروش
        </h2>

        <p>
          شماره:
          ${esc(inv.invoice_id)}
        </p>

      </div>


      <div class="profile-info">

        <div>
          <span>نام پرداخت‌کننده</span>
          <b>${esc(inv.full_name)}</b>
        </div>

        <div>
          <span>شماره موبایل</span>
          <b>${esc(inv.mobile || "—")}</b>
        </div>

        <div>
          <span>دوره</span>
          <b>${esc(inv.course_name)}</b>
        </div>

        <div>
          <span>کد دوره</span>
          <b>${esc(inv.course_code || "—")}</b>
        </div>

        <div>
          <span>تاریخ پرداخت</span>
          <b>${dateFa(inv.payment_date)}</b>
        </div>

        <div>
          <span>روش پرداخت</span>
          <b>${esc(inv.payment_method)}</b>
        </div>

        <div>
          <span>شماره پیگیری</span>
          <b>${esc(inv.reference_no || "—")}</b>
        </div>

        <div>
          <span>مبلغ پرداختی</span>
          <b>${money(inv.amount)}</b>
        </div>

      </div>


      <section
        class="panel"
        style="margin-top:16px"
      >

        <div class="panel-head">

          <div>
            <h3>شرح فروش</h3>
            <p>
              ثبت‌نام / شرکت در دوره آموزشی آکادمی سینرژی
            </p>
          </div>

        </div>

        <div class="finance-strip">

          <div>
            <span>مبلغ کل</span>
            <strong>
              ${money(inv.amount)}
            </strong>
          </div>

          <div>
            <span>پرداخت‌شده</span>
            <strong>
              ${money(inv.amount)}
            </strong>
          </div>

          <div>
            <span>مانده</span>
            <strong>
              ${money(0)}
            </strong>
          </div>

        </div>

      </section>

    </div>


    <div
      class="profile-actions"
      style="margin-top:16px"
    >

      <button
        id="editInvoiceBtn"
        class="secondary glass-button"
      >
        ویرایش فاکتور
      </button>

      <button
        id="deleteInvoiceBtn"
        class="danger-action"
      >
        حذف فاکتور
      </button>

      <button
        id="printInvoiceBtn"
        class="primary"
      >
        چاپ / ذخیره PDF
      </button>

    </div>
  `);


  $("#printInvoiceBtn").onclick =
    () => printInvoice(inv);

  $("#editInvoiceBtn").onclick =
    () => editInvoice(inv);

  $("#deleteInvoiceBtn").onclick =
    () => deleteInvoice(inv);
}


function editInvoice(inv) {

  modal(`

    <div class="modal-title">
      <span>EDIT INVOICE</span>
      <h2>ویرایش فاکتور / پرداخت</h2>
      <p>
        تغییرات این فرم مستقیماً روی رکورد پرداخت مالی اعمال می‌شود.
      </p>
    </div>

    <form
      id="editInvoiceForm"
      class="form-grid"
    >

      ${formField(
        "مبلغ",
        "amount",
        "number",
        "",
        inv.amount || ""
      )}

      ${selectField(
        "روش پرداخت",
        "payment_method",
        `
          ${["","کارت به کارت","انتقال بانکی","نقدی","POS"].map(x => `
            <option
              value="${esc(x)}"
              ${String(x) === String(inv.payment_method || "") ? "selected" : ""}
            >
              ${x || "مشخص نیست"}
            </option>
          `).join("")}
        `
      )}

      ${formField(
        "تاریخ پرداخت",
        "payment_date",
        "date",
        "",
        inv.payment_date
          ? String(inv.payment_date).slice(0,10)
          : ""
      )}

      ${formField(
        "شماره پیگیری",
        "transaction_reference",
        "text",
        "",
        inv.reference_no || ""
      )}

      <button
        class="primary full submit"
        type="submit"
      >
        ذخیره فاکتور
      </button>

    </form>
  `);


  $("#editInvoiceForm").onsubmit =
    async e => {

      e.preventDefault();

      const data =
        formDataObject(e.target);

      data.payment_id =
        inv.payment_id;

      await submitPost(
        "updatePayment",
        data,
        "فاکتور ویرایش شد"
      );
    };
}


async function deleteInvoice(inv) {

  if (!inv.payment_id) {
    toast(
      "شناسه پرداخت این فاکتور پیدا نشد.",
      true
    );
    return;
  }

  const ok = confirm(
    `فاکتور ${inv.invoice_id} حذف شود؟\n\nبا حذف این فاکتور، رکورد پرداخت مرتبط هم حذف می‌شود و درآمد سیستم کاهش پیدا می‌کند.`
  );

  if (!ok) return;

  try {

    loading(true);

    const result =
      await post(
        "deletePayment",
        {
          payment_id:
            inv.payment_id
        }
      );

    if (!result.success)
      throw new Error(
        result.message ||
        "حذف فاکتور انجام نشد"
      );

    closeModal();

    toast("فاکتور حذف شد");

    await loadAll(false);

  } catch (error) {

    toast(
      error.message ||
      "حذف فاکتور انجام نشد",
      true
    );

  } finally {

    loading(false);
  }
}


function printInvoice(inv) {

  const body = `
    <!doctype html>
    <html lang="fa" dir="rtl">

    <head>

      <meta charset="utf-8">

      <title>
        ${esc(inv.invoice_id)}
      </title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 40px;
          font-family:
            Tahoma,
            Arial,
            sans-serif;
          color: #151515;
          background: #fff;
        }

        .invoice {
          max-width: 760px;
          margin: auto;
          border: 1px solid #ddd;
          border-radius: 18px;
          padding: 34px;
        }

        .brand {
          font-size: 13px;
          letter-spacing: 2px;
          color: #666;
        }

        h1 {
          margin: 8px 0 4px;
          font-size: 28px;
        }

        .number {
          color: #777;
          margin-bottom: 28px;
        }

        .grid {
          display: grid;
          grid-template-columns:
            repeat(2, 1fr);
          gap: 12px;
        }

        .box {
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 14px;
        }

        .box span {
          display: block;
          color: #777;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .box b {
          font-size: 15px;
        }

        .total {
          margin-top: 24px;
          border-top: 2px solid #111;
          padding-top: 18px;
          display: flex;
          justify-content:
            space-between;
          font-size: 20px;
        }

        .footer {
          margin-top: 36px;
          color: #777;
          font-size: 12px;
          line-height: 1.9;
        }

        @media print {

          body {
            padding: 0;
          }

          .invoice {
            border: 0;
          }
        }

      </style>

    </head>

    <body>

      <div class="invoice">

        <div class="brand">
          SYNERGY ACADEMY
        </div>

        <h1>
          رسید / فاکتور فروش
        </h1>

        <div class="number">
          شماره:
          ${esc(inv.invoice_id)}
        </div>


        <div class="grid">

          <div class="box">
            <span>نام</span>
            <b>${esc(inv.full_name)}</b>
          </div>

          <div class="box">
            <span>موبایل</span>
            <b>${esc(inv.mobile || "—")}</b>
          </div>

          <div class="box">
            <span>دوره</span>
            <b>${esc(inv.course_name)}</b>
          </div>

          <div class="box">
            <span>کد دوره</span>
            <b>${esc(inv.course_code || "—")}</b>
          </div>

          <div class="box">
            <span>تاریخ پرداخت</span>
            <b>${dateFa(inv.payment_date)}</b>
          </div>

          <div class="box">
            <span>روش پرداخت</span>
            <b>${esc(inv.payment_method)}</b>
          </div>

          <div class="box">
            <span>شماره پیگیری</span>
            <b>${esc(inv.reference_no || "—")}</b>
          </div>

        </div>


        <div class="total">

          <span>مبلغ پرداختی</span>

          <b>
            ${money(inv.amount)}
          </b>

        </div>


        <div class="footer">

          این سند بر اساس پرداخت ثبت‌شده
          در سامانه مدیریت آکادمی سینرژی
          ایجاد شده است.

        </div>

      </div>

      <script>
        window.onload = () => {
          window.print();
        };
      <\/script>

    </body>

    </html>
  `;


  const win =
    window.open(
      "",
      "_blank"
    );

  if (!win) {

    toast(
      "مرورگر اجازه باز شدن صفحه چاپ را نداد.",
      true
    );

    return;
  }


  win.document.open();

  win.document.write(body);

  win.document.close();
}


/* =========================================================
   EXECUTIVE / BOARD REPORT
========================================================= */

function renderReports() {

  title(
    "گزارش مدیریتی",
    "فروش، سودآوری، دوره‌ها و انبار"
  );

  const customers =
    finalCustomers();

  const revenue =
    finalCustomerRevenue();

  const generalExpense =
    sumAmount(
      state.expenses
    );

  const inventoryConsumedCost =
    sumConsumptionCost(
      state.consumptions
    );

  const totalExpense =
    generalExpense +
    inventoryConsumedCost;

  const profit =
    revenue -
    totalExpense;

  const margin =
    revenue
      ? Math.round(
          profit /
          revenue *
          100
        )
      : 0;

  const courseRows =
    financeCourseRows();

  const bestCourse =
    courseRows.length
      ? courseRows
          .slice()
          .sort(
            (a,b) =>
              b.profit -
              a.profit
          )[0]
      : null;

  const inventory =
    inventoryTotals();

  $("#content").innerHTML = `

    <section class="hero">

      <div>

        <span class="eyebrow">
          BOARD EXECUTIVE SUMMARY
        </span>

        <h1>
          وضعیت کسب‌وکار آکادمی سینرژی
        </h1>

        <p>
          تمرکز روی مشتری نهایی،
          درآمد، هزینه، سود و موجودی
        </p>

      </div>

      <button
        id="printBoardReport"
        class="hero-add"
      >
        چاپ گزارش
      </button>

    </section>


    <div class="kpi-grid">

      <div class="kpi">
        <span>مشتریان نهایی</span>
        <strong>
          ${faNum(
            customers.length
          )}
        </strong>
        <small>دارای پرداخت</small>
      </div>

      <div class="kpi success">
        <span>درآمد</span>
        <strong>
          ${money(revenue)}
        </strong>
        <small>وصول‌شده</small>
      </div>

      <div class="kpi danger">
        <span>هزینه شناسایی‌شده</span>
        <strong>
          ${money(
            totalExpense
          )}
        </strong>
        <small>
          عمومی + مصرف انبار
        </small>
      </div>

      <div class="kpi ${
        profit >= 0
          ? "success"
          : "danger"
      }">
        <span>سود خالص</span>
        <strong>
          ${money(profit)}
        </strong>
        <small>
          Margin ${faNum(margin)}٪
        </small>
      </div>

    </div>


    <div class="two-col" style="margin-top:16px">

      <section class="panel">

        <div class="panel-head">
          <div>
            <h3>وضعیت دوره‌ها</h3>
            <p>
              درآمد و سود هر دوره
            </p>
          </div>
        </div>

        ${
          courseRows.length
            ? `
              <div class="lead-list">

                ${
                  courseRows
                    .slice(0,8)
                    .map(row => `

                      <button
                        class="lead-row"
                        data-board-course="${esc(
                          row.course.course_id
                        )}"
                      >

                        <div class="avatar">
                          ▣
                        </div>

                        <div class="lead-main">
                          <b>
                            ${esc(
                              row.course.course_name
                            )}
                          </b>
                          <span>
                            ${faNum(
                              row.registered
                            )}
                            دانشجو
                            ·
                            درآمد
                            ${money(
                              row.revenue
                            )}
                          </span>
                        </div>

                        <div class="lead-end">
                          <b>
                            ${money(
                              row.profit
                            )}
                          </b>
                          <small>
                            Margin
                            ${faNum(
                              row.margin
                            )}٪
                          </small>
                        </div>

                      </button>

                    `).join("")
                }

              </div>
            `
            : `
              <div class="empty">
                <b>
                  هنوز دوره‌ای وجود ندارد
                </b>
              </div>
            `
        }

      </section>


      <section class="panel">

        <div class="panel-head">
          <div>
            <h3>وضعیت انبار</h3>
            <p>
              موجودی و مصرف کالا
            </p>
          </div>
        </div>

        <div class="profile-info">

          <div>
            <span>ارزش موجودی</span>
            <b>
              ${money(
                inventory.stockValue
              )}
            </b>
          </div>

          <div>
            <span>هزینه مصرف‌شده</span>
            <b>
              ${money(
                inventory.consumedValue
              )}
            </b>
          </div>

          <div>
            <span>هشدار موجودی</span>
            <b>
              ${faNum(
                inventory.lowStock
              )}
            </b>
          </div>

          <div>
            <span>کالاهای تعریف‌شده</span>
            <b>
              ${faNum(
                activeProducts().length
              )}
            </b>
          </div>

        </div>

      </section>

    </div>


    <section class="panel" style="margin-top:16px">

      <div class="panel-head">

        <div>
          <h3>جمع‌بندی مدیریتی</h3>
          <p>
            مهم‌ترین شاخص‌های فعلی آکادمی
          </p>
        </div>

      </div>

      <div class="finance-strip">

        <div>
          <span>سودآورترین دوره</span>
          <strong>
            ${
              bestCourse
                ? esc(
                    bestCourse.course
                      .course_name
                  )
                : "—"
            }
          </strong>
        </div>

        <div>
          <span>سود دوره برتر</span>
          <strong>
            ${
              bestCourse
                ? money(
                    bestCourse.profit
                  )
                : money(0)
            }
          </strong>
        </div>

        <div>
          <span>تعداد پرداخت</span>
          <strong>
            ${faNum(
              approvedPayments()
                .length
            )}
          </strong>
        </div>

      </div>

    </section>
  `;


  $("#printBoardReport")
    .onclick =
      () =>
        window.print();


  $$("[data-board-course]")
    .forEach(button => {

      button.onclick =
        () =>
          openCourse(
            button.dataset.boardCourse
          );
    });
}


/* =========================================================
   ERROR
========================================================= */

function renderError() {

  $("#content").innerHTML = `

    <div class="fatal">

      <div
        style="
          font-size:42px;
          opacity:.5
        "
      >
        🐾
      </div>

      <b>
        ارتباط با Google Sheets برقرار نشد
      </b>

      <span>
        اینترنت یا Web App را بررسی کنید.
      </span>

      <button
        id="retry"
        class="primary"
      >
        تلاش مجدد
      </button>

    </div>
  `;

  const retry =
    $("#retry");

  if (retry)
    retry.onclick =
      () => loadAll(false);
}


/* =========================================================
   ACTION BINDING
========================================================= */

function bindActions() {

  $$("[data-action]")
    .forEach(
      button => {

        button.onclick =
          e => {

            e.stopPropagation();

            openAction(
              button.dataset.action
            );
          };
      }
    );

  bindLeadClicks();
}


function bindLeadClicks() {
  bindCustomerClicks();
}


function openAction(action) {

  if (action === "newLead")
    return newLead();

  if (action === "newCourse")
    return newCourse();

  if (action === "newExpense")
    return newExpense();

  if (action === "newPayment")
    return newPayment();

  if (action === "newProduct")
    return newProduct();

  if (action === "newPurchase")
    return newPurchase();

  if (action === "newConsumption")
    return newConsumption();
}


/* =========================================================
   MODAL
========================================================= */

function modal(html) {

  $("#modalBody").innerHTML =
    html;

  $("#modal")
    .classList
    .remove("hidden");

  bindNumberInputs($("#modal"));
  bindJalaliDateInputs($("#modal"));
}


function closeModal() {

  $("#modal")
    .classList
    .add("hidden");

  state.selectedLead = null;
  state.selectedCourse = null;
}


function formField(
  label,
  name,
  type = "text",
  extra = "",
  value = ""
) {

  const isNumber =
    type === "number";

  const isDate =
    type === "date" ||
    type === "datetime-local";

  if (isDate) {

    const id =
      `date-${name}-${Math.random()
        .toString(36)
        .slice(2,8)}`;

    const displayId =
      `${id}-display`;

    const longId =
      `${id}-long`;

    const cleanValue =
      value || "";

    const displayValue =
      cleanValue
        ? jalaliDate(
            cleanValue
          )
        : "";

    return `
      <label class="field jalali-field">

        <span>
          ${label}
        </span>

        <input
          id="${id}"
          name="${name}"
          type="hidden"
          value="${esc(cleanValue)}"
          data-date-kind="${type}"
        >

        <div
          class="jalali-input-wrap"
        >

          <input
            id="${displayId}"
            type="text"
            value="${esc(displayValue)}"
            placeholder="انتخاب تاریخ شمسی"
            readonly
            data-jalali-display="true"
            data-target-id="${id}"
            data-long-target-id="${longId}"
            ${extra}
          >

          <button
            type="button"
            class="jalali-calendar-button"
            tabindex="-1"
            aria-label="باز کردن تقویم شمسی"
            onclick="
              document
                .getElementById(
                  '${displayId}'
                )
                .click()
            "
          >
            📅
          </button>

        </div>

        <small
          id="${longId}"
          class="jalali-preview"
        >
          ${
            cleanValue
              ? jalaliDateLong(
                  cleanValue
                )
              : "تاریخ شمسی انتخاب نشده"
          }
        </small>

      </label>
    `;
  }

  const finalType =
    isNumber
      ? "text"
      : type;

  const numberAttrs =
    isNumber
      ? 'data-number="true" inputmode="numeric" autocomplete="off"'
      : "";

  return `
    <label class="field">

      <span>
        ${label}
      </span>

      <input
        name="${name}"
        type="${finalType}"
        value="${esc(value)}"
        ${numberAttrs}
        ${extra}
      >

    </label>
  `;
}

function selectField(
  label,
  name,
  options
) {

  return `
    <label class="field">

      <span>
        ${label}
      </span>

      <select name="${name}">
        ${options}
      </select>

    </label>
  `;
}


/* =========================================================
   CREATE LEAD
========================================================= */

function newLead() {

  modal(`

    <div class="modal-title">

      <span>FINAL CUSTOMER</span>

      <h2>
        ثبت مشتری نهایی
      </h2>

      <p>
        اینجا فقط مشتریانی را ثبت کنید
        که پرداخت / واریز وجه داشته‌اند.
        همه فیلدها اختیاری هستند.
      </p>

    </div>


    <form
      id="finalCustomerForm"
      class="form-grid"
    >

      ${formField(
        "نام و نام خانوادگی",
        "full_name"
      )}

      ${formField(
        "شماره موبایل",
        "mobile",
        "tel",
        'inputmode="tel"'
      )}

      ${selectField(
        "دوره",
        "course_id",
        `
          <option value="">
            بدون دوره
          </option>

          ${
            state.courses.map(c => `
              <option value="${esc(
                c.course_id
              )}">
                ${esc(c.course_name)}
              </option>
            `).join("")
          }
        `
      )}

      ${formField(
        "مبلغ واریزی",
        "amount",
        "number"
      )}

      ${selectField(
        "روش پرداخت",
        "payment_method",
        `
          <option value="">
            مشخص نیست
          </option>
          <option>کارت به کارت</option>
          <option>انتقال بانکی</option>
          <option>نقدی</option>
          <option>POS</option>
        `
      )}

      ${formField(
        "تاریخ پرداخت",
        "payment_date",
        "date"
      )}

      ${formField(
        "شماره پیگیری",
        "transaction_reference"
      )}

      <details class="full optional-details">

        <summary>
          اطلاعات تکمیلی اختیاری
        </summary>

        <div
          class="form-grid optional-inner"
        >

          ${formField(
            "دانشگاه",
            "university"
          )}

          ${formField(
            "رشته تحصیلی",
            "field_of_study"
          )}

          ${formField(
            "ترم",
            "semester"
          )}

          ${formField(
            "منبع آشنایی",
            "source"
          )}

          <label class="field full">
            <span>یادداشت</span>
            <textarea
              name="notes"
              rows="3"
            ></textarea>
          </label>

        </div>

      </details>

      <button
        class="primary full submit"
        type="submit"
      >
        ثبت مشتری + پرداخت
      </button>

    </form>
  `);


  $("#finalCustomerForm")
    .onsubmit =
      async e => {

        e.preventDefault();

        await submitPost(
          "createFinalCustomer",
          formDataObject(
            e.target
          ),
          "مشتری نهایی و پرداخت ثبت شد"
        );
      };
}


/* =========================================================
   COURSE
========================================================= */

function newCourse() {

  modal(`

    <div class="modal-title">

      <span>COURSE</span>

      <h2>
        دوره جدید
      </h2>

    </div>


    <form
      id="courseForm"
      class="form-grid"
    >

      ${
        formField(
          "نام دوره",
          "course_name",
          "text",
          ""
        )
      }

      ${
        formField(
          "کد دوره",
          "course_code"
        )
      }

      ${
        formField(
          "دانشگاه همکار",
          "partner_university"
        )
      }

      ${
        formField(
          "مدرس",
          "instructor"
        )
      }

      ${
        formField(
          "تاریخ شروع",
          "start_date",
          "date"
        )
      }

      ${
        formField(
          "محل برگزاری",
          "location"
        )
      }

      ${
        formField(
          "ظرفیت",
          "capacity",
          "number"
        )
      }

      ${
        formField(
          "قیمت",
          "standard_price",
          "number"
        )
      }


      <input
        type="hidden"
        name="status"
        value="active"
      >


      <button
        class="primary full submit"
      >
        ایجاد دوره
      </button>

    </form>
  `);


  $("#courseForm").onsubmit =
    async e => {

      e.preventDefault();

      await submitPost(
        "createCourse",
        formDataObject(e.target),
        "دوره ایجاد شد"
      );
    };
}


function editCourse(course) {

  modal(`

    <div class="modal-title">
      <span>EDIT COURSE</span>
      <h2>ویرایش دوره</h2>
      <p>
        تمام فیلدها قابل ویرایش هستند.
      </p>
    </div>

    <form
      id="editCourseForm"
      class="form-grid"
    >

      ${formField(
        "نام دوره",
        "course_name",
        "text",
        "",
        course.course_name || ""
      )}

      ${formField(
        "کد دوره",
        "course_code",
        "text",
        "",
        course.course_code || ""
      )}

      ${formField(
        "دانشگاه همکار",
        "partner_university",
        "text",
        "",
        course.partner_university || ""
      )}

      ${formField(
        "مدرس",
        "instructor",
        "text",
        "",
        course.instructor || ""
      )}

      ${formField(
        "تاریخ شروع",
        "start_date",
        "date",
        "",
        course.start_date
          ? String(
              course.start_date
            ).slice(0,10)
          : ""
      )}

      ${formField(
        "محل برگزاری",
        "location",
        "text",
        "",
        course.location || ""
      )}

      ${formField(
        "ظرفیت",
        "capacity",
        "number",
        "",
        course.capacity || ""
      )}

      ${formField(
        "قیمت",
        "standard_price",
        "number",
        "",
        course.standard_price || ""
      )}

      ${selectField(
        "وضعیت",
        "status",
        `
          <option
            value="active"
            ${
              course.status === "active"
                ? "selected"
                : ""
            }
          >
            فعال
          </option>

          <option
            value="inactive"
            ${
              course.status === "inactive"
                ? "selected"
                : ""
            }
          >
            غیرفعال
          </option>

          <option
            value="completed"
            ${
              course.status === "completed"
                ? "selected"
                : ""
            }
          >
            پایان‌یافته
          </option>
        `
      )}

      <button
        class="primary full submit"
        type="submit"
      >
        ذخیره تغییرات
      </button>

    </form>
  `);

  $("#editCourseForm")
    .onsubmit =
      async e => {

        e.preventDefault();

        await submitPost(
          "updateCourse",
          {
            ...formDataObject(
              e.target
            ),
            course_id:
              course.course_id
          },
          "دوره ویرایش شد"
        );
      };
}


/* =========================================================
   EXPENSE
========================================================= */

function editExpense(expense) {

  modal(`

    <div class="modal-title">
      <span>EDIT EXPENSE</span>
      <h2>ویرایش هزینه</h2>
    </div>

    <form
      id="editExpenseForm"
      class="form-grid"
    >

      ${selectField(
        "دوره",
        "course_id",
        `
          <option value="">
            عمومی آکادمی
          </option>

          ${
            state.courses.map(c => `
              <option
                value="${esc(c.course_id)}"
                ${
                  String(c.course_id) ===
                  String(
                    expense.course_id ||
                    ""
                  )
                    ? "selected"
                    : ""
                }
              >
                ${esc(c.course_name)}
              </option>
            `).join("")
          }
        `
      )}

      ${formField(
        "تاریخ",
        "expense_date",
        "date",
        "",
        expense.expense_date
          ? String(
              expense.expense_date
            ).slice(0,10)
          : ""
      )}

      ${formField(
        "دسته هزینه",
        "category",
        "text",
        "",
        expense.category || ""
      )}

      ${formField(
        "مبلغ",
        "amount",
        "number",
        "",
        expense.amount || ""
      )}

      ${formField(
        "شرح",
        "description",
        "text",
        "",
        expense.description || ""
      )}

      ${formField(
        "فروشنده / دریافت‌کننده",
        "vendor",
        "text",
        "",
        expense.vendor || ""
      )}

      <button
        class="primary full submit"
        type="submit"
      >
        ذخیره تغییرات
      </button>

    </form>
  `);


  $("#editExpenseForm")
    .onsubmit =
      async e => {

        e.preventDefault();

        await submitPost(
          "updateExpense",
          {
            ...formDataObject(
              e.target
            ),
            expense_id:
              expense.expense_id
          },
          "هزینه ویرایش شد"
        );
      };
}


function newExpense(selectedCourse = null) {

  modal(`

    <div class="modal-title">

      <span>EXPENSE</span>

      <h2>
        ثبت هزینه
      </h2>

    </div>


    <form
      id="expenseForm"
      class="form-grid"
    >

      ${
        selectField(
          "دوره",
          "course_id",

          `
            <option value="">
              عمومی آکادمی
            </option>

            ${
              state.courses
                .map(
                  c => `
                    <option
                      ${
                        selectedCourse &&
                        String(selectedCourse.course_id) ===
                        String(c.course_id)
                          ? "selected"
                          : ""
                      }
                      value="${esc(
                        c.course_id
                      )}"
                    >
                      ${
                        esc(
                          c.course_name
                        )
                      }
                    </option>
                  `
                )
                .join("")
            }
          `
        )
      }


      ${
        formField(
          "تاریخ",
          "expense_date",
          "date",
          ""
        )
      }


      ${
        selectField(
          "دسته هزینه",
          "category",

          `
            <option>مدرس</option>
            <option>دانشگاه</option>
            <option>تبلیغات</option>
            <option>تجهیزات</option>
            <option>پذیرایی</option>
            <option>چاپ</option>
            <option>سایر</option>
          `
        )
      }


      ${
        formField(
          "مبلغ",
          "amount",
          "number",
          ""
        )
      }

      ${
        formField(
          "شرح",
          "description"
        )
      }

      ${
        formField(
          "فروشنده/دریافت‌کننده",
          "vendor"
        )
      }


      <button
        class="primary full submit"
      >
        ثبت هزینه
      </button>

    </form>
  `);


  $("#expenseForm").onsubmit =
    async e => {

      e.preventDefault();

      await submitPost(
        "createExpense",
        formDataObject(e.target),
        "هزینه ثبت شد"
      );
    };
}


/* =========================================================
   PAYMENT
========================================================= */

function newPayment(
  lead = null,
  selectedCourse = null
) {

  modal(`

    <div class="modal-title">

      <span>PAYMENT</span>

      <h2>
        ثبت پرداخت
      </h2>

    </div>


    <form
      id="paymentForm"
      class="form-grid"
    >

      <input
        type="hidden"
        name="lead_id"
        value="${
          esc(
            lead?.lead_id ||
            ""
          )
        }"
      >


      ${
        selectField(
          "دوره",
          "course_id",

          `
            <option value="">
              انتخاب
            </option>

            ${
              state.courses
                .map(
                  c => `
                    <option
                      ${
                        (
                          String(lead?.course_id || "") ===
                          String(c.course_id) ||
                          String(selectedCourse?.course_id || "") ===
                          String(c.course_id)
                        )
                          ? "selected"
                          : ""
                      }
                      value="${esc(
                        c.course_id
                      )}"
                    >
                      ${
                        esc(
                          c.course_name
                        )
                      }
                    </option>
                  `
                )
                .join("")
            }
          `
        )
      }


      ${
        formField(
          "مبلغ",
          "amount",
          "number",
          ""
        )
      }

      ${
        formField(
          "تاریخ پرداخت",
          "payment_date",
          "date",
          ""
        )
      }


      ${
        selectField(
          "روش پرداخت",
          "payment_method",

          `
            <option>
              کارت به کارت
            </option>

            <option>
              انتقال بانکی
            </option>

            <option>
              نقدی
            </option>

            <option>
              POS
            </option>
          `
        )
      }


      ${
        formField(
          "شماره پیگیری",
          "transaction_reference"
        )
      }


      <input
        type="hidden"
        name="status"
        value="approved"
      >


      <button
        class="primary full submit"
      >
        ثبت پرداخت
      </button>

    </form>
  `);


  $("#paymentForm").onsubmit =
    async e => {

      e.preventDefault();

      await submitPost(
        "createPayment",
        formDataObject(e.target),
        "پرداخت ثبت شد"
      );
    };
}


/* =========================================================
   POST SUBMIT
========================================================= */


function createRequestId(prefix = "REQ") {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return (
      prefix +
      "-" +
      crypto.randomUUID()
    );
  }

  return (
    prefix +
    "-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2,10)
  );
}


async function submitPost(
  action,
  data,
  message
) {

  const button =
    $(".submit");

  const form =
    button?.closest("form");

  /*
    Keep the same request id while the same form is open.
    If the server successfully writes but the browser loses
    the response, retrying will NOT create a duplicate.
  */
  if (
    action === "createFinalCustomer" ||
    action === "createProduct"
  ) {

    if (
      form &&
      !form.dataset.requestId
    ) {
      form.dataset.requestId =
        createRequestId(
          action === "createProduct"
            ? "PRDREQ"
            : "CUSREQ"
        );
    }

    data._request_id =
      form?.dataset.requestId ||
      data._request_id ||
      createRequestId("REQ");
  }


  if (button) {

    button.disabled = true;

    button.textContent =
      "در حال ثبت...";
  }


  try {

    const result =
      await post(
        action,
        data
      );


    if (!result.success) {

      throw new Error(
        result.message ||
        "عملیات انجام نشد."
      );
    }


    toast(
      result.duplicate_request
        ? "این درخواست قبلاً ثبت شده بود؛ رکورد تکراری ساخته نشد."
        : message
    );

    closeModal();

    /*
      Do not block the user's success flow on a full refresh.
      The write is already confirmed by the server.
    */
    loadAll(false);

  } catch (error) {

    console.error(error);

    const messageText =
      error.message ||
      "ثبت انجام نشد";

    toast(
      messageText +
      " — در صورت تلاش مجدد، سیستم از ثبت تکراری جلوگیری می‌کند.",
      true
    );


    if (button) {

      button.disabled = false;

      button.textContent =
        "تلاش مجدد";
    }
  }
}


/* =========================================================
   CUSTOMER 360
========================================================= */

function openLead(id) {

  const lead =
    state.leads.find(
      x =>
        String(x.lead_id) ===
        String(id)
    );


  if (!lead)
    return;


  state.selectedLead =
    lead;


  const history =
    state.followups
      .filter(
        x =>
          String(x.lead_id) ===
          String(id)
      )
      .reverse();


  modal(`

    <div class="profile-head">

      <div class="avatar xl">
        ${
          esc(
            (
              lead.full_name ||
              "?"
            )[0]
          )
        }
      </div>


      <div>

        <span
          class="badge ${
            statusClass[
              lead.status
            ] || "gray"
          }"
        >
          ${
            statusMap[
              lead.status
            ] ||
            lead.status
          }
        </span>

        <h2>
          ${esc(
            lead.full_name
          )}
        </h2>

        <a
          href="tel:${
            esc(
              lead.mobile
            )
          }"
        >
          ${esc(
            lead.mobile
          )}
        </a>

      </div>

    </div>


    <div class="quick-actions">

      <a
        href="tel:${
          esc(
            lead.mobile
          )
        }"
      >
        ☎ تماس
      </a>

      <a
        href="sms:${
          esc(
            lead.mobile
          )
        }"
      >
        ✉ پیام
      </a>

      <button id="followBtn">
        ＋ پیگیری
      </button>

    </div>


    <div class="panel" style="margin:18px 0 12px;padding:14px">
      <div class="panel-head" style="margin-bottom:10px">
        <div>
          <h3>وضعیت فروش</h3>
          <p>نمای سریع پرونده این متقاضی</p>
        </div>
        <span class="badge ${statusClass[lead.status] || "gray"}">
          ${statusMap[lead.status] || esc(lead.status)}
        </span>
      </div>
      <div class="profile-info">
        <div>
          <span>ارزش فرصت</span>
          <b>${money(lead.expected_amount)}</b>
        </div>
        <div>
          <span>پیگیری بعدی</span>
          <b>${dateFa(lead.next_followup)}</b>
        </div>
      </div>
    </div>

    <div class="profile-info">

      <div>
        <span>دوره</span>
        <b>
          ${
            esc(
              courseName(
                lead.course_id
              ) || "—"
            )
          }
        </b>
      </div>

      <div>
        <span>منبع</span>
        <b>
          ${
            esc(
              lead.source ||
              "—"
            )
          }
        </b>
      </div>

      <div>
        <span>
          پیگیری بعدی
        </span>
        <b>
          ${
            dateFa(
              lead.next_followup
            )
          }
        </b>
      </div>

      <div>
        <span>
          مبلغ مورد انتظار
        </span>
        <b>
          ${
            money(
              lead.expected_amount
            )
          }
        </b>
      </div>

    </div>


    <div class="profile-actions customer-actions">

      <button
        id="editLeadBtn"
        class="secondary glass-button"
      >
        ویرایش
      </button>

      <button
        id="deleteLeadBtn"
        class="danger-action"
      >
        حذف
      </button>

      <button
        id="quickRegisterBtn"
        class="primary"
      >
        ثبت‌نام سریع
      </button>

      <button
        id="payBtn"
        class="secondary glass-button"
      >
        ثبت پرداخت
      </button>

      ${
        lead.status !==
        "registered"
          ? `
            <button
              id="convertBtn"
              class="primary"
            >
              تبدیل به دانشجو
            </button>
          `
          : ""
      }

    </div>


    <section class="timeline">

      <h3>
        تاریخچه ارتباط
      </h3>


      ${
        history.length
          ? history
              .map(
                item => `
                  <div class="timeline-item">

                    <i></i>

                    <div>

                      <b>
                        ${
                          esc(
                            item.result ||
                            statusMap[
                              item.new_status
                            ] ||
                            "پیگیری"
                          )
                        }
                      </b>

                      <p>
                        ${
                          esc(
                            item.notes ||
                            ""
                          )
                        }
                      </p>

                      <small>
                        ${
                          dateFa(
                            item.created_at
                          )
                        }
                        ·
                        ${
                          esc(
                            item.type ||
                            ""
                          )
                        }
                      </small>

                    </div>

                  </div>
                `
              )
              .join("")
          : `
            <div class="empty">
              <span>
                هنوز پیگیری ثبت نشده است.
              </span>
            </div>
          `
      }

    </section>
  `);


  $("#followBtn").onclick =
    () =>
      followForm(lead);


  $("#payBtn").onclick =
    () =>
      newPayment(lead);

  $("#editLeadBtn").onclick =
    () =>
      editLead(lead);

  $("#deleteLeadBtn").onclick =
    () =>
      deleteLead(lead);

  $("#quickRegisterBtn").onclick =
    () =>
      quickRegister(lead);


  const convert =
    $("#convertBtn");

  if (convert) {

    convert.onclick =
      () =>
        convertLead(lead);
  }
}


/* =========================================================
   CUSTOMER EDIT / DELETE / QUICK REGISTER
========================================================= */

function editLead(lead) {

  modal(`

    <div class="modal-title">
      <span>EDIT CUSTOMER</span>
      <h2>ویرایش مشتری</h2>
      <p>همه فیلدها اختیاری هستند.</p>
    </div>

    <form id="editLeadForm" class="form-grid">

      ${formField("نام و نام خانوادگی","full_name","text","",lead.full_name || "")}

      ${formField("شماره موبایل","mobile","tel",'inputmode="tel"',lead.mobile || "")}

      ${selectField(
        "دوره موردنظر",
        "course_id",
        `
          <option value="">مشخص نیست</option>
          ${state.courses.map(c => `
            <option
              value="${esc(c.course_id)}"
              ${String(c.course_id) === String(lead.course_id || "") ? "selected" : ""}
            >
              ${esc(c.course_name)}
            </option>
          `).join("")}
        `
      )}

      ${selectField(
        "منبع آشنایی",
        "source",
        `
          ${["","Instagram","Telegram","University","Referral","Website","Other"].map(s => `
            <option
              value="${esc(s)}"
              ${String(s) === String(lead.source || "") ? "selected" : ""}
            >
              ${s || "مشخص نیست"}
            </option>
          `).join("")}
        `
      )}

      ${selectField(
        "مرحله فروش",
        "status",
        Object.keys(statusMap).map(s => `
          <option
            value="${s}"
            ${s === lead.status ? "selected" : ""}
          >
            ${statusMap[s]}
          </option>
        `).join("")
      )}

      ${formField(
        "پیگیری بعدی",
        "next_followup",
        "datetime-local",
        "",
        lead.next_followup ? String(lead.next_followup).slice(0,16) : ""
      )}

      ${formField(
        "مبلغ مورد انتظار",
        "expected_amount",
        "number",
        "",
        lead.expected_amount || ""
      )}

      <label class="field full">
        <span>یادداشت</span>
        <textarea name="notes" rows="4">${esc(lead.notes || "")}</textarea>
      </label>

      <button class="primary full submit" type="submit">
        ذخیره تغییرات
      </button>

    </form>
  `);

  $("#editLeadForm").onsubmit =
    async e => {

      e.preventDefault();

      const data = formDataObject(e.target);
      data.lead_id = lead.lead_id;

      await submitPost(
        "updateLead",
        data,
        "اطلاعات مشتری ویرایش شد"
      );
    };
}


async function deleteLead(lead) {

  const ok = confirm(
    `مشتری «${lead.full_name || "بدون نام"}» حذف شود؟\n\nپیگیری‌های CRM این مشتری هم حذف می‌شوند، اما اسناد مالی جداگانه محفوظ می‌مانند.`
  );

  if (!ok) return;

  try {

    loading(true);

    const result =
      await post(
        "deleteLead",
        {
          lead_id: lead.lead_id
        }
      );

    if (!result.success)
      throw new Error(
        result.message ||
        "حذف انجام نشد"
      );

    closeModal();

    toast("مشتری حذف شد");

    await loadAll(false);

  } catch (error) {

    toast(
      error.message ||
      "حذف مشتری انجام نشد",
      true
    );

  } finally {

    loading(false);
  }
}


function quickRegister(lead) {

  modal(`

    <div class="modal-title">
      <span>FAST REGISTRATION</span>
      <h2>ثبت‌نام سریع</h2>
      <p>
        با یک فرم کوتاه، پرداخت و تبدیل متقاضی به دانشجو انجام می‌شود.
        همه فیلدها اختیاری هستند.
      </p>
    </div>

    <form
      id="quickRegisterForm"
      class="form-grid"
    >

      ${selectField(
        "دوره",
        "course_id",
        `
          <option value="">بدون دوره</option>
          ${state.courses.map(c => `
            <option
              value="${esc(c.course_id)}"
              ${String(c.course_id) === String(lead.course_id || "") ? "selected" : ""}
            >
              ${esc(c.course_name)}
            </option>
          `).join("")}
        `
      )}

      ${formField(
        "مبلغ پرداختی",
        "amount",
        "number"
      )}

      ${selectField(
        "روش پرداخت",
        "payment_method",
        `
          <option value="">مشخص نیست</option>
          <option>کارت به کارت</option>
          <option>انتقال بانکی</option>
          <option>نقدی</option>
          <option>POS</option>
        `
      )}

      ${formField(
        "شماره پیگیری",
        "transaction_reference"
      )}

      ${formField(
        "تاریخ پرداخت",
        "payment_date",
        "date"
      )}

      <button
        class="primary full submit"
        type="submit"
      >
        ثبت‌نام و تبدیل به دانشجو
      </button>

    </form>
  `);


  $("#quickRegisterForm").onsubmit =
    async e => {

      e.preventDefault();

      const data =
        formDataObject(e.target);

      const button = $(".submit");

      if (button) {
        button.disabled = true;
        button.textContent = "در حال ثبت...";
      }

      try {

        if (
          data.course_id &&
          String(data.course_id) !==
          String(lead.course_id || "")
        ) {
          const update = await post(
            "updateLead",
            {
              lead_id: lead.lead_id,
              course_id: data.course_id
            }
          );

          if (!update.success)
            throw new Error(
              update.message ||
              "دوره مشتری بروزرسانی نشد"
            );
        }

        if (rawNumber(data.amount)) {

          const pay = await post(
            "createPayment",
            {
              lead_id: lead.lead_id,
              course_id:
                data.course_id ||
                lead.course_id ||
                "",
              amount: rawNumber(data.amount),
              payment_method:
                data.payment_method || "",
              transaction_reference:
                data.transaction_reference || "",
              payment_date:
                data.payment_date || "",
              status: "approved"
            }
          );

          if (!pay.success)
            throw new Error(
              pay.message ||
              "پرداخت ثبت نشد"
            );
        }

        if (lead.status !== "registered") {

          const converted =
            await post(
              "convertLead",
              {
                lead_id:
                  lead.lead_id,
                course_id:
                  data.course_id ||
                  lead.course_id ||
                  ""
              }
            );

          if (
            !converted.success &&
            !String(
              converted.message || ""
            ).includes("قبلاً")
          ) {
            throw new Error(
              converted.message ||
              "تبدیل به دانشجو انجام نشد"
            );
          }
        }

        closeModal();

        toast(
          "ثبت‌نام سریع با موفقیت انجام شد"
        );

        await loadAll(false);

      } catch (error) {

        toast(
          error.message ||
          "ثبت‌نام انجام نشد",
          true
        );

        if (button) {
          button.disabled = false;
          button.textContent =
            "تلاش مجدد";
        }
      }
    };
}


/* =========================================================
   FOLLOW-UP
========================================================= */

function followForm(lead) {

  modal(`

    <div class="modal-title">

      <span>FOLLOW-UP</span>

      <h2>
        ${esc(
          lead.full_name
        )}
      </h2>

      <p>
        نتیجه تماس یا پیام را ثبت کنید. اگر مشتری از دست رفت، علت را در «نتیجه» ثبت کنید
        (قیمت، زمان دوره، عدم پاسخ، انصراف یا سایر).
      </p>

    </div>


    <form
      id="followForm"
      class="form-grid"
    >

      <input
        type="hidden"
        name="lead_id"
        value="${
          esc(
            lead.lead_id
          )
        }"
      >


      ${
        selectField(
          "نوع ارتباط",
          "type",

          `
            <option value="call">
              تماس
            </option>

            <option value="message">
              پیام
            </option>

            <option value="whatsapp">
              واتساپ
            </option>

            <option value="in_person">
              حضوری
            </option>
          `
        )
      }


      ${
        selectField(
          "مرحله جدید",
          "new_status",

          Object
            .keys(statusMap)
            .map(
              status => `
                <option
                  ${
                    status ===
                    lead.status
                      ? "selected"
                      : ""
                  }
                  value="${status}"
                >
                  ${
                    statusMap[
                      status
                    ]
                  }
                </option>
              `
            )
            .join("")
        )
      }


      ${
        formField(
          "نتیجه",
          "result",
          "text",
          ""
        )
      }


      ${
        formField(
          "پیگیری بعدی",
          "next_followup",
          "datetime-local"
        )
      }


      <label class="field full">

        <span>
          یادداشت
        </span>

        <textarea
          name="notes"
          rows="4"
        ></textarea>

      </label>


      <button
        class="primary full submit"
      >
        ثبت پیگیری
      </button>

    </form>
  `);


  $("#followForm").onsubmit =
    async e => {

      e.preventDefault();

      await submitPost(
        "addFollowUp",
        formDataObject(e.target),
        "پیگیری ثبت شد"
      );
    };
}


/* =========================================================
   CONVERT LEAD
========================================================= */

async function convertLead(
  lead
) {

  if (
    !confirm(
      "این مشتری به عنوان دانشجو ثبت شود؟"
    )
  ) {
    return;
  }


  try {

    loading(true);

    const result =
      await post(
        "convertLead",
        {
          lead_id:
            lead.lead_id
        }
      );


    if (!result.success)
      throw new Error(
        result.message
      );


    toast(
      "دانشجو با موفقیت ثبت شد"
    );

    closeModal();

    await loadAll(false);

  } catch (error) {

    toast(
      error.message ||
      "عملیات انجام نشد",
      true
    );

  } finally {

    loading(false);
  }
}


/* =========================================================
   SIDEBAR
========================================================= */

function closeSide() {

  $(".sidebar")
    ?.classList
    .remove("open");

  $("#mobileScrim")
    ?.classList
    .remove("show");
}


/* =========================================================
   EVENTS
========================================================= */

$("#menuBtn").onclick =
  () => {

    $(".sidebar")
      ?.classList
      .add("open");

    $("#mobileScrim")
      ?.classList
      .add("show");
  };


$("#mobileScrim").onclick =
  closeSide;


$("#modalClose").onclick =
  closeModal;


$("#modal").onclick =
  e => {

    if (
      e.target.id ===
      "modal"
    ) {
      closeModal();
    }
  };


$("#refreshBtn").onclick =
  () => {

    toast(
      "در حال بروزرسانی اطلاعات..."
    );

    loadAll(false);
  };


/*
  Persian date
*/

$("#today").textContent =
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", {calendar:"persian", numberingSystem:"latn", weekday:"long", day:"numeric", month:"long", year:"numeric"}).format(new Date());


/*
  Global action handler
*/

document.addEventListener(
  "click",
  e => {

    const action =
      e.target.closest(
        "[data-action]"
      );

    if (action) {

      openAction(
        action.dataset.action
      );
    }
  }
);


/* =========================================================
   START APPLICATION
========================================================= */

/*
  Render first, fetch second.
  No full-screen loading overlay on application startup.
*/

loading(false);
setConnected(false);
initThemeControls();
render();
loadAll(false);



/* =========================================================
   UNIVERSAL LIVE COLOR THEME
========================================================= */

function hexToRgb(hex) {
  const value = String(hex || "")
    .replace("#", "")
    .trim();

  if (value.length !== 6)
    return { r: 255, g: 102, b: 183 };

  return {
    r: parseInt(value.slice(0,2), 16),
    g: parseInt(value.slice(2,4), 16),
    b: parseInt(value.slice(4,6), 16)
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function applyUniversalTheme(settings = {}) {

  const primary =
    settings.primary ||
    "#ff66b7";

  const secondary =
    settings.secondary ||
    "#8b5cf6";

  const accent =
    settings.accent ||
    "#74efe7";

  const bg1 =
    settings.bg1 ||
    "#26335f";

  const bg2 =
    settings.bg2 ||
    "#4a2753";

  const bg3 =
    settings.bg3 ||
    "#31284f";

  const brightness =
    Number(
      settings.brightness ?? 100
    );

  const saturation =
    Number(
      settings.saturation ?? 100
    );

  const glass =
    Number(
      settings.glass ?? 16
    );

  const root =
    document.documentElement;

  root.style.setProperty(
    "--theme-primary",
    primary
  );

  root.style.setProperty(
    "--theme-secondary",
    secondary
  );

  root.style.setProperty(
    "--theme-accent",
    accent
  );

  root.style.setProperty(
    "--theme-bg1",
    bg1
  );

  root.style.setProperty(
    "--theme-bg2",
    bg2
  );

  root.style.setProperty(
    "--theme-bg3",
    bg3
  );

  root.style.setProperty(
    "--theme-brightness",
    brightness + "%"
  );

  root.style.setProperty(
    "--theme-saturation",
    saturation + "%"
  );

  root.style.setProperty(
    "--theme-glass-alpha",
    Math.max(
      .04,
      Math.min(
        .32,
        glass / 100
      )
    )
  );

  root.style.setProperty(
    "--pink",
    primary
  );

  root.style.setProperty(
    "--pink2",
    primary
  );

  root.style.setProperty(
    "--purple",
    secondary
  );

  root.style.setProperty(
    "--cyan",
    accent
  );

  document.body.style.background = `
    radial-gradient(
      circle at 8% 8%,
      ${rgba(accent, .42)} 0,
      transparent 34%
    ),
    radial-gradient(
      circle at 88% 10%,
      ${rgba(primary, .38)} 0,
      transparent 32%
    ),
    radial-gradient(
      circle at 82% 78%,
      ${rgba(primary, .34)} 0,
      transparent 36%
    ),
    radial-gradient(
      circle at 18% 92%,
      ${rgba(secondary, .44)} 0,
      transparent 35%
    ),
    linear-gradient(
      135deg,
      ${bg1},
      ${bg3} 48%,
      ${bg2}
    )
  `;

  document.body.style.filter =
    `brightness(${brightness}%) saturate(${saturation}%)`;

  localStorage.setItem(
    "synergyThemeUniversal",
    JSON.stringify({
      primary,
      secondary,
      accent,
      bg1,
      bg2,
      bg3,
      brightness,
      saturation,
      glass
    })
  );
}


function loadUniversalTheme() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          "synergyThemeUniversal"
        ) || "{}"
      );

    applyUniversalTheme(saved);

  } catch {

    applyUniversalTheme({});
  }
}


function openUniversalThemePanel() {

  let panel =
    document.getElementById(
      "universalThemePanel"
    );

  if (panel) {
    panel.remove();
    return;
  }

  let settings = {};

  try {
    settings =
      JSON.parse(
        localStorage.getItem(
          "synergyThemeUniversal"
        ) || "{}"
      );
  } catch {
    settings = {};
  }

  const values = {
    primary:
      settings.primary ||
      "#ff66b7",
    secondary:
      settings.secondary ||
      "#8b5cf6",
    accent:
      settings.accent ||
      "#74efe7",
    bg1:
      settings.bg1 ||
      "#26335f",
    bg2:
      settings.bg2 ||
      "#4a2753",
    bg3:
      settings.bg3 ||
      "#31284f",
    brightness:
      settings.brightness ??
      100,
    saturation:
      settings.saturation ??
      100,
    glass:
      settings.glass ??
      16
  };

  panel =
    document.createElement("div");

  panel.id =
    "universalThemePanel";

  panel.className =
    "universal-theme-panel";

  panel.innerHTML = `

    <div class="theme-panel-head">

      <div>
        <span>LIVE THEME</span>
        <h3>تنظیم کامل رنگ پلتفرم</h3>
        <p>
          هر رنگی را بدون محدودیت انتخاب کن؛
          تغییر همان لحظه نمایش داده می‌شود.
        </p>
      </div>

      <button
        id="closeThemePanel"
        class="modal-close"
        type="button"
      >
        ×
      </button>

    </div>


    <div class="theme-colors-grid">

      ${themeColorField(
        "رنگ اصلی",
        "themePrimary",
        values.primary
      )}

      ${themeColorField(
        "رنگ دوم",
        "themeSecondary",
        values.secondary
      )}

      ${themeColorField(
        "رنگ Accent",
        "themeAccent",
        values.accent
      )}

      ${themeColorField(
        "پس‌زمینه ۱",
        "themeBg1",
        values.bg1
      )}

      ${themeColorField(
        "پس‌زمینه ۲",
        "themeBg2",
        values.bg2
      )}

      ${themeColorField(
        "پس‌زمینه ۳",
        "themeBg3",
        values.bg3
      )}

    </div>


    ${themeRangeField(
      "روشنایی کلی",
      "themeBrightness",
      60,
      145,
      values.brightness,
      "%"
    )}

    ${themeRangeField(
      "اشباع رنگ",
      "themeSaturation",
      40,
      180,
      values.saturation,
      "%"
    )}

    ${themeRangeField(
      "شفافیت Glass",
      "themeGlass",
      5,
      30,
      values.glass,
      "%"
    )}


    <div class="theme-presets">

      <button
        type="button"
        data-theme-preset="pink"
      >
        صورتی
      </button>

      <button
        type="button"
        data-theme-preset="blue"
      >
        آبی
      </button>

      <button
        type="button"
        data-theme-preset="green"
      >
        سبز
      </button>

      <button
        type="button"
        data-theme-preset="purple"
      >
        بنفش
      </button>

      <button
        type="button"
        data-theme-preset="orange"
      >
        نارنجی
      </button>

      <button
        type="button"
        data-theme-preset="mono"
      >
        خنثی
      </button>

    </div>


    <button
      id="resetTheme"
      type="button"
      class="secondary glass-button theme-reset"
    >
      بازگشت به حالت پیش‌فرض
    </button>
  `;

  document.body.appendChild(
    panel
  );

  bindUniversalThemePanel();
}


function themeColorField(
  label,
  id,
  value
) {

  return `
    <label class="theme-color-field">

      <span>${label}</span>

      <div class="theme-color-control">

        <input
          id="${id}"
          type="color"
          value="${value}"
        >

        <input
          id="${id}Text"
          class="theme-hex-input"
          type="text"
          value="${value}"
          maxlength="7"
          spellcheck="false"
        >

      </div>

    </label>
  `;
}


function themeRangeField(
  label,
  id,
  min,
  max,
  value,
  suffix
) {

  return `
    <label class="theme-range-field">

      <div>
        <span>${label}</span>

        <b id="${id}Value">
          ${value}${suffix}
        </b>
      </div>

      <input
        id="${id}"
        type="range"
        min="${min}"
        max="${max}"
        value="${value}"
      >

    </label>
  `;
}


function readThemePanelValues() {

  return {
    primary:
      $("#themePrimary")?.value ||
      "#ff66b7",

    secondary:
      $("#themeSecondary")?.value ||
      "#8b5cf6",

    accent:
      $("#themeAccent")?.value ||
      "#74efe7",

    bg1:
      $("#themeBg1")?.value ||
      "#26335f",

    bg2:
      $("#themeBg2")?.value ||
      "#4a2753",

    bg3:
      $("#themeBg3")?.value ||
      "#31284f",

    brightness:
      Number(
        $("#themeBrightness")
          ?.value || 100
      ),

    saturation:
      Number(
        $("#themeSaturation")
          ?.value || 100
      ),

    glass:
      Number(
        $("#themeGlass")
          ?.value || 16
      )
  };
}


function bindUniversalThemePanel() {

  const panel =
    $("#universalThemePanel");

  if (!panel) return;

  const colorIds = [
    "themePrimary",
    "themeSecondary",
    "themeAccent",
    "themeBg1",
    "themeBg2",
    "themeBg3"
  ];

  const refresh = () => {

    $("#themeBrightnessValue")
      .textContent =
        $("#themeBrightness").value +
        "%";

    $("#themeSaturationValue")
      .textContent =
        $("#themeSaturation").value +
        "%";

    $("#themeGlassValue")
      .textContent =
        $("#themeGlass").value +
        "%";

    applyUniversalTheme(
      readThemePanelValues()
    );
  };


  colorIds.forEach(id => {

    const color =
      $("#" + id);

    const text =
      $("#" + id + "Text");

    color.oninput = () => {

      text.value =
        color.value;

      refresh();
    };

    text.oninput = () => {

      const value =
        text.value.trim();

      if (
        /^#[0-9a-fA-F]{6}$/
          .test(value)
      ) {

        color.value =
          value;

        refresh();
      }
    };
  });


  [
    "themeBrightness",
    "themeSaturation",
    "themeGlass"
  ].forEach(id => {

    $("#" + id).oninput =
      refresh;
  });


  $("#closeThemePanel").onclick =
    () =>
      panel.remove();


  $("#resetTheme").onclick =
    () => {

      localStorage.removeItem(
        "synergyThemeUniversal"
      );

      panel.remove();

      applyUniversalTheme({});
    };


  $$("[data-theme-preset]")
    .forEach(button => {

      button.onclick = () => {

        const presets = {

          pink: {
            primary:"#ff5fb2",
            secondary:"#a56cff",
            accent:"#65e5e0",
            bg1:"#574070",
            bg2:"#6d365f",
            bg3:"#47446d"
          },

          blue: {
            primary:"#5fa8ff",
            secondary:"#786cff",
            accent:"#65e5e0",
            bg1:"#243d71",
            bg2:"#304d73",
            bg3:"#2a315e"
          },

          green: {
            primary:"#51d9a5",
            secondary:"#67b5ff",
            accent:"#b2ef72",
            bg1:"#204b46",
            bg2:"#32544a",
            bg3:"#253d48"
          },

          purple: {
            primary:"#d16cff",
            secondary:"#806cff",
            accent:"#ff70b7",
            bg1:"#49335f",
            bg2:"#5b2f62",
            bg3:"#352e59"
          },

          orange: {
            primary:"#ff9a56",
            secondary:"#ff5f8f",
            accent:"#ffd46b",
            bg1:"#6a4539",
            bg2:"#70364b",
            bg3:"#4f394d"
          },

          mono: {
            primary:"#d6d6df",
            secondary:"#9ea2b2",
            accent:"#f0f0f3",
            bg1:"#363945",
            bg2:"#46444d",
            bg3:"#30323b"
          }
        };

        const preset =
          presets[
            button.dataset
              .themePreset
          ];

        if (!preset) return;

        Object.entries({
          themePrimary:
            preset.primary,
          themeSecondary:
            preset.secondary,
          themeAccent:
            preset.accent,
          themeBg1:
            preset.bg1,
          themeBg2:
            preset.bg2,
          themeBg3:
            preset.bg3
        }).forEach(
          ([id,value]) => {

            $("#" + id).value =
              value;

            $("#" + id + "Text")
              .value =
                value;
          }
        );

        refresh();
      };
    });
}


function ensureUniversalThemeButton() {
  // The main 🎨 button is created by initThemeControls().
  // Kept as a no-op to avoid duplicate theme buttons.
  return;
}


loadUniversalTheme();

document.addEventListener(
  "DOMContentLoaded",
  ensureUniversalThemeButton
);

setTimeout(
  ensureUniversalThemeButton,
  200
);
