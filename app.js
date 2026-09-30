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
  ["invoices", "▧", "فاکتورها"],
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

function dateFa(v) {

  if (!v) return "—";

  try {

    return new Intl.DateTimeFormat(
      "fa-IR",
      {
        month: "short",
        day: "numeric"
      }
    ).format(new Date(v));

  } catch {

    return String(v);
  }
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
  ).finally(
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
      12000
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
      15000
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

  /*
    The CRM shell must always open immediately.
    Google Sheets data loads in the background.
  */

  loading(false);
  setConnected(false);

  // Show the interface immediately with current state.
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
        safeLoad("followups", [])
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
      followups
    ] = values;


    if (dashboard.ok) {
      state.dashboard =
        dashboard.data || {};
      anySuccess = true;
    }

    if (leads.ok) {
      state.leads =
        leads.data || [];
      anySuccess = true;
    }

    if (courses.ok) {
      state.courses =
        courses.data || [];
      anySuccess = true;
    }

    if (students.ok) {
      state.students =
        students.data || [];
      anySuccess = true;
    }

    if (payments.ok) {
      state.payments =
        payments.data || [];
      anySuccess = true;
    }

    if (expenses.ok) {
      state.expenses =
        expenses.data || [];
      anySuccess = true;
    }

    if (followups.ok) {
      state.followups =
        followups.data || [];
      anySuccess = true;
    }


    setConnected(anySuccess);

    // Refresh visible data without blocking the screen.
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

    // Keep the CRM usable even if Google is unavailable.
    render();

  } finally {

    loading(false);
  }
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
    invoices: renderInvoices,
    reports: renderReports
  };

  const fn =
    pages[state.page] ||
    renderToday;

  fn();
}


/* =========================================================
   TODAY
========================================================= */

function renderToday() {

  title(
    "امروز",
    "مرکز عملیات روزانه آکادمی"
  );

  const d =
    state.dashboard || {};

  const today =
    d.today_followups || [];

  const overdue =
    d.overdue_followups || [];

  const waiting =
    state.leads.filter(
      x =>
        x.status ===
        "awaiting_payment"
    );


  $("#content").innerHTML = `

    <section class="hero">

      <div>

        <span class="eyebrow">
          SYNERGY ACADEMY
        </span>

        <h1>
          امروز چه چیزی نیاز به توجه دارد؟
        </h1>

        <p>
          ${faNum(today.length)}
          پیگیری امروز و
          ${faNum(overdue.length)}
          پیگیری عقب‌افتاده دارید.
        </p>

      </div>

      <button
        data-action="newLead"
        class="hero-add"
      >
        ＋ ثبت متقاضی
      </button>

    </section>


    <div class="kpi-grid">

      <div class="kpi">
        <span>کل متقاضیان</span>
        <strong>
          ${faNum(
            d.total_leads ??
            state.leads.length
          )}
        </strong>
        <small>CRM</small>
      </div>


      <div class="kpi warning">
        <span>پیگیری امروز</span>
        <strong>
          ${faNum(today.length)}
        </strong>
        <small>نیازمند اقدام</small>
      </div>


      <div class="kpi danger">
        <span>عقب‌افتاده</span>
        <strong>
          ${faNum(overdue.length)}
        </strong>
        <small>اولویت بالا</small>
      </div>


      <div class="kpi success">
        <span>نرخ تبدیل</span>
        <strong>
          ${faNum(
            d.conversion_rate || 0
          )}٪
        </strong>
        <small>ثبت‌نام قطعی</small>
      </div>

    </div>


    <div class="two-col">

      <section class="panel">

        <div class="panel-head">

          <div>
            <h3>کارهای امروز</h3>
            <p>
              پیگیری‌هایی که باید انجام شوند
            </p>
          </div>

          <span class="count">
            ${faNum(
              today.length +
              overdue.length
            )}
          </span>

        </div>

        ${
          leadList(
            [
              ...overdue,
              ...today
            ].slice(0, 8),
            true
          )
        }

      </section>


      <section class="panel">

        <div class="panel-head">

          <div>
            <h3>منتظر پرداخت</h3>
            <p>
              فرصت‌های نزدیک به ثبت‌نام
            </p>
          </div>

          <span class="count">
            ${faNum(waiting.length)}
          </span>

        </div>

        ${
          leadList(
            waiting.slice(0, 8),
            false
          )
        }

      </section>

    </div>


    <section class="panel finance-strip">

      <div>
        <span>درآمد تأییدشده</span>
        <strong>
          ${money(d.revenue)}
        </strong>
      </div>

      <div>
        <span>هزینه</span>
        <strong>
          ${money(d.expenses)}
        </strong>
      </div>

      <div>
        <span>سود</span>
        <strong>
          ${money(d.profit)}
        </strong>
      </div>

    </section>
  `;

  bindActions();
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
   LEADS PAGE
========================================================= */

function renderLeads() {

  title(
    "مشتریان",
    "Pipeline فروش و پیگیری متقاضیان"
  );

  const groups =
    Object.keys(statusMap);


  const leadStats = {
    total: state.leads.length,
    hot: state.leads.filter(x =>
      ["interested", "payment_info_sent", "awaiting_payment"].includes(x.status)
    ).length,
    paid: state.leads.filter(x =>
      ["paid", "registered"].includes(x.status)
    ).length,
    lost: state.leads.filter(x => x.status === "lost").length
  };

  $("#content").innerHTML = `

    <div class="kpi-grid" style="margin-top:0;margin-bottom:14px">
      <div class="kpi">
        <span>کل متقاضیان</span>
        <strong>${faNum(leadStats.total)}</strong>
        <small>بانک مشتریان</small>
      </div>
      <div class="kpi warning">
        <span>فرصت‌های داغ</span>
        <strong>${faNum(leadStats.hot)}</strong>
        <small>نیازمند پیگیری فروش</small>
      </div>
      <div class="kpi success">
        <span>پرداخت / ثبت‌نام</span>
        <strong>${faNum(leadStats.paid)}</strong>
        <small>تبدیل‌شده</small>
      </div>
      <div class="kpi danger">
        <span>از دست رفته</span>
        <strong>${faNum(leadStats.lost)}</strong>
        <small>نیازمند تحلیل علت</small>
      </div>
    </div>

    <div class="toolbar">

      <div class="search">

        <span>⌕</span>

        <input
          id="leadSearch"
          placeholder="جستجو نام یا موبایل..."
        >

      </div>


      <button
        class="primary"
        data-action="newLead"
      >
        ＋ مشتری جدید
      </button>

    </div>


    <div class="pipeline">

      ${
        groups.map(
          status => {

            const list =
              state.leads.filter(
                x =>
                  x.status ===
                  status
              );

            return `
              <section class="pipe">

                <div class="pipe-head">

                  <span
                    class="dot ${
                      statusClass[
                        status
                      ]
                    }"
                  ></span>

                  <b>
                    ${statusMap[status]}
                  </b>

                  <em>
                    ${faNum(list.length)}
                  </em>

                </div>


                <div class="pipe-body">

                  ${
                    list.length
                      ? list
                          .map(leadCard)
                          .join("")
                      : `
                        <div class="pipe-empty">
                          موردی نیست
                        </div>
                      `
                  }

                </div>

              </section>
            `;
          }
        ).join("")
      }

    </div>


    <section class="panel mobile-leads">

      <div id="mobileLeadList">
        ${
          leadList(
            state.leads,
            false
          )
        }
      </div>

    </section>
  `;


  const search =
    $("#leadSearch");

  if (search) {

    search.oninput = e => {

      const q =
        e.target.value
          .trim()
          .toLowerCase();

      const filtered =
        state.leads.filter(
          x =>
            (
              String(
                x.full_name || ""
              ) +
              " " +
              String(
                x.mobile || ""
              )
            )
            .toLowerCase()
            .includes(q)
        );

      $("#mobileLeadList")
        .innerHTML =
          leadList(
            filtered,
            false
          );

      bindLeadClicks();
    };
  }


  bindActions();
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

function sumAmount(arr) {
  return arr.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
}

function courseMetrics(course) {
  const students = courseStudents(course.course_id);
  const leads = courseLeads(course.course_id);
  const payments = coursePayments(course.course_id);
  const expenses = courseExpenses(course.course_id);

  const capacity = Number(course.capacity || 0);
  const registered = students.length;
  const remaining = Math.max(0, capacity - registered);
  const revenue = sumAmount(payments);
  const cost = sumAmount(expenses);
  const profit = revenue - cost;
  const fillRate = capacity
    ? Math.min(100, Math.round((registered / capacity) * 100))
    : 0;

  return {
    students,
    leads,
    payments,
    expenses,
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

  const expense =
    sumAmount(state.expenses);

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

                          <small>
                            ${dateFa(
                              e.expense_date ||
                              e.created_at
                            )}
                          </small>

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
            p.reference_no || ""
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
        id="printInvoiceBtn"
        class="primary"
      >
        چاپ / ذخیره PDF
      </button>

    </div>
  `);


  $("#printInvoiceBtn").onclick =
    () => printInvoice(inv);
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
   REPORTS
========================================================= */

function renderReports() {

  title(
    "گزارش مدیریت",
    "نمای مدیریتی عملکرد آکادمی"
  );

  const d =
    state.dashboard || {};


  $("#content").innerHTML = `

    <section class="board-hero">

      <span>
        BOARD VIEW
      </span>

      <h1>
        ${money(d.profit)}
      </h1>

      <p>
        سود خالص ثبت‌شده آکادمی
      </p>

    </section>


    <div class="report-grid">

      <article>
        <span>متقاضی</span>
        <strong>
          ${
            faNum(
              d.total_leads ??
              state.leads.length
            )
          }
        </strong>
      </article>

      <article>
        <span>ثبت‌نام قطعی</span>
        <strong>
          ${
            faNum(
              d.registered_students
            )
          }
        </strong>
      </article>

      <article>
        <span>نرخ تبدیل</span>
        <strong>
          ${
            faNum(
              d.conversion_rate
            )
          }٪
        </strong>
      </article>

      <article>
        <span>دوره فعال</span>
        <strong>
          ${
            faNum(
              d.active_courses
            )
          }
        </strong>
      </article>

    </div>


    <section
      class="panel"
      style="margin-top:14px"
    >

      <div class="panel-head">

        <div>
          <h3>قیف فروش</h3>
          <p>
            تعداد مشتری در هر مرحله
          </p>
        </div>

      </div>


      <div class="funnel">

        ${
          Object
            .keys(statusMap)
            .map(
              status => {

                const count =
                  state.leads.filter(
                    x =>
                      x.status ===
                      status
                  ).length;

                const width =
                  state.leads.length
                    ? Math.max(
                        3,
                        count /
                        state.leads.length *
                        100
                      )
                    : 3;

                return `
                  <div>

                    <span>
                      ${
                        statusMap[
                          status
                        ]
                      }
                    </span>

                    <b>
                      ${faNum(count)}
                    </b>

                    <i
                      style="
                        width:${width}%
                      "
                    ></i>

                  </div>
                `;
              }
            )
            .join("")
        }

      </div>

    </section>
  `;
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

  $$("[data-lead]")
    .forEach(
      button => {

        button.onclick =
          () =>
            openLead(
              button.dataset.lead
            );
      }
    );
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
  extra = ""
) {

  return `
    <label class="field">

      <span>
        ${label}
      </span>

      <input
        name="${name}"
        type="${type}"
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

      <span>
        NEW LEAD
      </span>

      <h2>
        ثبت متقاضی جدید
      </h2>

      <p>
        اطلاعات اولیه دانشجو را وارد کنید.
      </p>

    </div>


    <form
      id="leadForm"
      class="form-grid"
    >

      ${
        formField(
          "نام و نام خانوادگی",
          "full_name",
          "text",
          "required"
        )
      }

      ${
        formField(
          "شماره موبایل",
          "mobile",
          "tel",
          'required inputmode="tel"'
        )
      }


      ${
        selectField(
          "دوره موردنظر",
          "course_id",

          `
            <option value="">
              انتخاب دوره
            </option>

            ${
              state.courses
                .map(
                  c => `
                    <option
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
        selectField(
          "منبع آشنایی",
          "source",

          `
            <option>Instagram</option>
            <option>Telegram</option>
            <option>University</option>
            <option>Referral</option>
            <option>Website</option>
            <option>Other</option>
          `
        )
      }


      ${
        formField(
          "پیگیری بعدی",
          "next_followup",
          "datetime-local"
        )
      }


      ${
        formField(
          "مبلغ مورد انتظار",
          "expected_amount",
          "number",
          'inputmode="numeric"'
        )
      }


      <label class="field full">

        <span>
          یادداشت اولیه
        </span>

        <textarea
          name="notes"
          rows="3"
        ></textarea>

      </label>


      <button
        class="primary full submit"
        type="submit"
      >
        ثبت مشتری
      </button>

    </form>
  `);


  $("#leadForm").onsubmit =
    async e => {

      e.preventDefault();

      const data =
        Object.fromEntries(
          new FormData(e.target)
        );

      await submitPost(
        "createLead",
        data,
        "مشتری ثبت شد"
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
          "required"
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
        Object.fromEntries(
          new FormData(e.target)
        ),
        "دوره ایجاد شد"
      );
    };
}


/* =========================================================
   EXPENSE
========================================================= */

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
          "required"
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
          "required"
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
        Object.fromEntries(
          new FormData(e.target)
        ),
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
          "required"
        )
      }

      ${
        formField(
          "تاریخ پرداخت",
          "payment_date",
          "date",
          "required"
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
        Object.fromEntries(
          new FormData(e.target)
        ),
        "پرداخت ثبت شد"
      );
    };
}


/* =========================================================
   POST SUBMIT
========================================================= */

async function submitPost(
  action,
  data,
  message
) {

  const button =
    $(".submit");

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


    toast(message);

    closeModal();

    await loadAll(false);

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "ثبت انجام نشد",
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


    <div class="profile-actions">

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


  const convert =
    $("#convertBtn");

  if (convert) {

    convert.onclick =
      () =>
        convertLead(lead);
  }
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
          "required"
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
        Object.fromEntries(
          new FormData(e.target)
        ),
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
  new Intl.DateTimeFormat(
    "fa-IR",
    {
      weekday: "long",
      day: "numeric",
      month: "long"
    }
  ).format(new Date());


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
render();
loadAll(false);
