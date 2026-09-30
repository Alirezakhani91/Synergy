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
  selectedLead: null,
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
  showLoading = true
) {

  if (state.loading)
    return;

  if (showLoading)
    loading(true);

  let anySuccess = false;

  try {

    /*
      Dashboard first.
      We do NOT wait for 7 requests before
      rendering the application.
    */

    const dashboardResult =
      await safeLoad(
        "dashboard",
        {}
      );

    if (dashboardResult.ok) {

      state.dashboard =
        dashboardResult.data || {};

      anySuccess = true;

      setConnected(true);

      render();

      /*
        Important:
        user sees the interface now.
      */

      loading(false);
    }


    /*
      Load remaining datasets independently.
      One broken endpoint will not freeze CRM.
    */

    const results =
      await Promise.allSettled([
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
      leads,
      courses,
      students,
      payments,
      expenses,
      followups
    ] = values;


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

    render();


    if (!anySuccess) {

      throw new Error(
        "هیچ اطلاعاتی از دیتابیس دریافت نشد."
      );
    }

  } catch (error) {

    console.error(error);

    setConnected(false);

    toast(
      "ارتباط با دیتابیس برقرار نشد",
      true
    );

    renderError();

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


  $("#content").innerHTML = `

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
   COURSES
========================================================= */

function renderCourses() {

  title(
    "دوره‌ها",
    "مدیریت دوره‌های آموزشی"
  );


  $("#content").innerHTML = `

    <div class="toolbar">

      <div>
        <h3>
          دوره‌های آکادمی
        </h3>

        <p>
          ${faNum(
            state.courses.length
          )}
          دوره ثبت شده
        </p>
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
          ? state.courses
              .map(
                c => `
                  <article class="course-card">

                    <div class="course-top">

                      <span
                        class="badge ${
                          c.status ===
                          "active"
                            ? "green"
                            : "gray"
                        }"
                      >
                        ${
                          c.status ===
                          "active"
                            ? "فعال"
                            : esc(
                                c.status ||
                                "پیش‌نویس"
                              )
                        }
                      </span>

                      <small>
                        ${
                          esc(
                            c.course_code ||
                            ""
                          )
                        }
                      </small>

                    </div>


                    <h3>
                      ${esc(
                        c.course_name
                      )}
                    </h3>

                    <p>
                      ${
                        esc(
                          c.partner_university ||
                          "دانشگاه همکار مشخص نشده"
                        )
                      }
                    </p>


                    <div class="course-meta">

                      <div>
                        <span>مدرس</span>
                        <b>
                          ${
                            esc(
                              c.instructor ||
                              "—"
                            )
                          }
                        </b>
                      </div>

                      <div>
                        <span>ظرفیت</span>
                        <b>
                          ${
                            faNum(
                              c.capacity
                            )
                          }
                        </b>
                      </div>

                      <div>
                        <span>شروع</span>
                        <b>
                          ${
                            dateFa(
                              c.start_date
                            )
                          }
                        </b>
                      </div>

                      <div>
                        <span>قیمت</span>
                        <b>
                          ${
                            money(
                              c.standard_price
                            )
                          }
                        </b>
                      </div>

                    </div>

                  </article>
                `
              )
              .join("")
          : `
            <div class="panel empty">
              <b>
                هنوز دوره‌ای تعریف نشده
              </b>
              <span>
                اولین دوره آکادمی را ایجاد کنید.
              </span>
            </div>
          `
      }

    </div>
  `;

  bindActions();
}


/* =========================================================
   FINANCE
========================================================= */

function renderFinance() {

  title(
    "مالی",
    "درآمد، هزینه و سودآوری"
  );

  const d =
    state.dashboard || {};


  $("#content").innerHTML = `

    <div class="toolbar">

      <div>
        <h3>
          وضعیت مالی آکادمی
        </h3>

        <p>
          اطلاعات ثبت‌شده در سیستم
        </p>
      </div>

      <div>

        <button
          class="secondary glass-button"
          data-action="newExpense"
        >
          ثبت هزینه
        </button>

        <button
          class="primary"
          data-action="newPayment"
        >
          ثبت پرداخت
        </button>

      </div>

    </div>


    <div class="finance-grid">

      <article class="finance-card">
        <span>درآمد</span>
        <strong>
          ${money(d.revenue)}
        </strong>
      </article>

      <article class="finance-card">
        <span>هزینه</span>
        <strong>
          ${money(d.expenses)}
        </strong>
      </article>

      <article class="finance-card">
        <span>سود خالص</span>
        <strong>
          ${money(d.profit)}
        </strong>
      </article>

      <article class="finance-card">
        <span>پرداخت‌ها</span>
        <strong>
          ${faNum(
            state.payments.length
          )}
        </strong>
      </article>

    </div>

  `;

  bindActions();
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
      () => loadAll(true);
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

function newExpense() {

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
  lead = null
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
                        lead?.course_id ===
                        c.course_id
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
        نتیجه تماس یا پیام را ثبت کنید.
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
  () => loadAll(true);


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

initNav();

/*
  Safety valve:
  even if Google has an issue,
  loading overlay can never remain forever.
*/

const loadingSafety =
  setTimeout(
    () => {

      if (state.loading) {

        loading(false);

        setConnected(false);

        toast(
          "دریافت اطلاعات طولانی شد؛ دوباره تلاش کنید.",
          true
        );

        render();
      }

    },
    16000
  );


loadAll(true)
  .finally(
    () =>
      clearTimeout(
        loadingSafety
      )
  );
