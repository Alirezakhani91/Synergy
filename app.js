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
  products: [],
  purchases: [],
  purchaseItems: [],
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

function formDataObject(form) {
  const data = Object.fromEntries(new FormData(form));

  form.querySelectorAll("[data-number='true']").forEach(input => {
    data[input.name] = rawNumber(input.value);
  });

  return data;
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
        safeLoad("followups", []),
        safeLoad("products", []),
        safeLoad("purchases", []),
        safeLoad("purchaseItems", []),
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
      products,
      purchases,
      purchaseItems,
      consumptions,
      inventoryMovements
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

    if (products.ok) {
      state.products =
        products.data || [];
      anySuccess = true;
    }

    if (purchases.ok) {
      state.purchases =
        purchases.data || [];
      anySuccess = true;
    }

    if (purchaseItems.ok) {
      state.purchaseItems =
        purchaseItems.data || [];
      anySuccess = true;
    }

    if (consumptions.ok) {
      state.consumptions =
        consumptions.data || [];
      anySuccess = true;
    }

    if (inventoryMovements.ok) {
      state.inventoryMovements =
        inventoryMovements.data || [];
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
    inventory: renderInventory,
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
        Number(item.unit_price ?? 0),
      0
    );
}

function inventoryTotals() {
  const stockValue =
    state.purchaseItems.reduce(
      (sum, item) =>
        sum +
        Number(item.remaining_qty ?? 0) *
        Number(item.unit_price ?? 0),
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
    state.products.filter(p => {
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
          ${faNum(state.products.length)}
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
        state.products.length
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
                      واحد
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
                  </tr>
                </thead>

                <tbody>

                  ${
                    state.products.map(p => {

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
                          <small>
                            ${esc(p.purchase_id)}
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
                            <small>
                              ${dateFa(
                                c.created_at
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

      ${formField(
        "واحد",
        "unit",
        "text",
        'placeholder="عدد، بسته، جفت، متر..."'
      )}

      ${formField(
        "دسته‌بندی",
        "category"
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

      await submitPost(
        "createProduct",
        formDataObject(e.target),
        "کالا تعریف شد"
      );
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

        ${selectField(
          "کالا",
          `product_id_${index}`,
          `
            <option value="">
              انتخاب کالا
            </option>

            ${
              state.products.map(p => `
                <option
                  value="${esc(p.product_id)}"
                >
                  ${esc(p.product_name)}
                  ${
                    p.unit
                      ? " — " + esc(p.unit)
                      : ""
                  }
                </option>
              `).join("")
            }
          `
        )}

        ${formField(
          "تعداد",
          `quantity_${index}`,
          "number"
        )}

        ${formField(
          "قیمت واحد",
          `unit_price_${index}`,
          "number"
        )}

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

    </div>
  `;
}


function newPurchase() {

  if (!state.products.length) {
    toast(
      "ابتدا حداقل یک کالا تعریف کنید.",
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
        یک فاکتور می‌تواند شامل چند کالای مختلف با تعداد و قیمت متفاوت باشد.
      </p>
    </div>

    <form
      id="purchaseForm"
    >

      <div class="form-grid">

        ${formField(
          "فروشنده",
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
        "
      >
        <div>
          <h3 style="margin:0">
            اقلام فاکتور
          </h3>
          <small style="opacity:.6">
            برای هر محصول تعداد و قیمت واحد را وارد کنید.
          </small>
        </div>

        <button
          id="addPurchaseLine"
          type="button"
          class="secondary glass-button"
        >
          ＋ ردیف جدید
        </button>
      </div>

      <div id="purchaseLines"></div>

      <div
        class="panel"
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin:12px 0;
        "
      >
        <span>
          مبلغ کل فاکتور
        </span>

        <strong
          id="purchaseGrandTotal"
          style="font-size:20px"
        >
          ۰ تومان
        </strong>
      </div>

      <button
        class="primary full submit"
        type="submit"
        style="width:100%"
      >
        ثبت فاکتور و افزایش موجودی
      </button>

    </form>
  `);

  let lineCounter = 0;

  const lines =
    $("#purchaseLines");

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
  }

  function bindPurchaseLines() {

    $$(".remove-purchase-line")
      .forEach(btn => {

        btn.onclick = () => {

          const line =
            btn.closest(
              ".purchase-line"
            );

          line?.remove();

          updatePurchaseTotals();
        };
      });

    $$(".purchase-line input")
      .forEach(input => {

        input.addEventListener(
          "input",
          updatePurchaseTotals
        );
      });
  }

  function updatePurchaseTotals() {

    let grand = 0;

    $$(".purchase-line")
      .forEach(line => {

        const index =
          line.dataset.purchaseLine;

        const qty =
          Number(
            rawNumber(
              line.querySelector(
                `[name="quantity_${index}"]`
              )?.value
            ) || 0
          );

        const price =
          Number(
            rawNumber(
              line.querySelector(
                `[name="unit_price_${index}"]`
              )?.value
            ) || 0
          );

        const total =
          qty * price;

        grand += total;

        const totalEl =
          line.querySelector(
            ".purchase-line-total"
          );

        if (totalEl) {
          totalEl.textContent =
            money(total);
        }
      });

    $("#purchaseGrandTotal")
      .textContent =
        money(grand);
  }

  $("#addPurchaseLine").onclick =
    addLine;

  addLine();

  $("#purchaseForm").onsubmit =
    async e => {

      e.preventDefault();

      const base =
        formDataObject(e.target);

      const items = [];

      $$(".purchase-line")
        .forEach(line => {

          const index =
            line.dataset.purchaseLine;

          const productId =
            line.querySelector(
              `[name="product_id_${index}"]`
            )?.value || "";

          const quantity =
            Number(
              rawNumber(
                line.querySelector(
                  `[name="quantity_${index}"]`
                )?.value
              ) || 0
            );

          const unitPrice =
            Number(
              rawNumber(
                line.querySelector(
                  `[name="unit_price_${index}"]`
                )?.value
              ) || 0
            );

          if (
            productId ||
            quantity ||
            unitPrice
          ) {
            items.push({
              product_id:productId,
              quantity,
              unit_price:unitPrice
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
          items
        },
        "فاکتور خرید ثبت شد و موجودی افزایش یافت"
      );
    };
}


function newConsumption() {

  if (!state.products.length) {
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
            state.products.map(p => {

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

  title("گزارش مدیریتی","نمای اجرایی برای مدیریت و اعضای هیئت‌مدیره");

  const payments = approvedPayments();
  const revenue = sumAmount(payments);
  const generalExpense = sumAmount(state.expenses);
  const inventoryConsumedCost =
    sumConsumptionCost(state.consumptions);
  const expense =
    generalExpense +
    inventoryConsumedCost;
  const profit = revenue - expense;
  const margin = revenue ? Math.round((profit / revenue) * 100) : 0;

  const totalLeads = state.leads.length;
  const registered = state.leads.filter(
    l => l.status === "registered" || l.status === "paid"
  ).length;
  const conversion = totalLeads ? Math.round((registered / totalLeads) * 100) : 0;

  const rows = financeCourseRows();
  const bestCourse = rows.length ? rows.slice().sort((a,b)=>b.profit-a.profit)[0] : null;
  const mostSold = rows.length ? rows.slice().sort((a,b)=>b.registered-a.registered)[0] : null;

  const sourceMap = {};
  state.leads.forEach(l => {
    const s = l.source || l.lead_source || "نامشخص";
    sourceMap[s] = (sourceMap[s] || 0) + 1;
  });
  const sources = Object.entries(sourceMap).sort((a,b)=>b[1]-a[1]);
  const maxSource = Math.max(1,...sources.map(x=>x[1]));

  const pipeline = Object.keys(statusMap).map(status => ({
    status,
    label: statusMap[status],
    count: state.leads.filter(l=>l.status===status).length
  }));
  const maxPipeline = Math.max(1,...pipeline.map(x=>x.count));

  $("#content").innerHTML = `
    <section class="hero">
      <div>
        <span class="eyebrow">BOARD EXECUTIVE SUMMARY</span>
        <h1>وضعیت کسب‌وکار آکادمی سینرژی</h1>
        <p>نمای یکپارچه فروش، ثبت‌نام، درآمد و سودآوری</p>
      </div>
      <button id="printBoardReport" class="hero-add">چاپ گزارش</button>
    </section>

    <div class="kpi-grid">
      <div class="kpi"><span>کل متقاضیان</span><strong>${faNum(totalLeads)}</strong><small>Lead Database</small></div>
      <div class="kpi success"><span>ثبت‌نام / پرداخت</span><strong>${faNum(registered)}</strong><small>Conversion ${faNum(conversion)}٪</small></div>
      <div class="kpi success"><span>درآمد</span><strong>${money(revenue)}</strong><small>وصول‌شده</small></div>
      <div class="kpi ${profit>=0?"success":"danger"}"><span>سود خالص</span><strong>${money(profit)}</strong><small>Margin ${faNum(margin)}٪</small></div>
    </div>

    <div class="two-col" style="margin-top:16px">
      <section class="panel">
        <div class="panel-head"><div><h3>قیف فروش</h3><p>توزیع متقاضیان در مراحل فروش</p></div></div>
        <div style="display:grid;gap:12px">
          ${pipeline.map(x=>`
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>${esc(x.label)}</span><b>${faNum(x.count)}</b></div>
              <div style="height:9px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden">
                <i style="display:block;height:100%;width:${Math.max(2,Math.round(x.count/maxPipeline*100))}%;background:currentColor;border-radius:inherit"></i>
              </div>
            </div>`).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h3>منابع جذب مشتری</h3><p>کانال‌های ایجاد متقاضی</p></div></div>
        ${sources.length ? `<div style="display:grid;gap:12px">${sources.slice(0,8).map(([s,n])=>`
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>${esc(s)}</span><b>${faNum(n)}</b></div>
            <div style="height:9px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden">
              <i style="display:block;height:100%;width:${Math.max(3,Math.round(n/maxSource*100))}%;background:currentColor;border-radius:inherit"></i>
            </div>
          </div>`).join("")}</div>` :
          `<div class="empty"><b>منبع جذب ثبت نشده</b><span>با ثبت Source تحلیل کانال‌ها فعال می‌شود.</span></div>`}
      </section>
    </div>

    <div class="kpi-grid" style="margin-top:16px">
      <div class="kpi"><span>دوره‌های فعال</span><strong>${faNum(state.courses.filter(c=>c.status==="active").length)}</strong><small>از ${faNum(state.courses.length)} دوره</small></div>
      <div class="kpi success"><span>پرفروش‌ترین دوره</span><strong style="font-size:18px">${mostSold?esc(mostSold.course.course_name):"—"}</strong><small>${mostSold?faNum(mostSold.registered)+" دانشجو":"داده کافی نیست"}</small></div>
      <div class="kpi success"><span>سودآورترین دوره</span><strong style="font-size:18px">${bestCourse?esc(bestCourse.course.course_name):"—"}</strong><small>${bestCourse?money(bestCourse.profit):"داده کافی نیست"}</small></div>
      <div class="kpi danger"><span>کل هزینه</span><strong>${money(expense)}</strong><small>${faNum(state.expenses.length)} رکورد هزینه</small></div>
    </div>

    <section class="panel" style="margin-top:16px">
      <div class="panel-head"><div><h3>عملکرد دوره‌ها</h3><p>ثبت‌نام، ظرفیت، درآمد، هزینه و سود</p></div><span class="count">${faNum(rows.length)}</span></div>
      ${rows.length ? `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:760px">
        <thead><tr>
          <th style="text-align:right;padding:12px">دوره</th><th style="text-align:right;padding:12px">ثبت‌نام</th>
          <th style="text-align:right;padding:12px">ظرفیت</th><th style="text-align:right;padding:12px">درآمد</th>
          <th style="text-align:right;padding:12px">هزینه</th><th style="text-align:right;padding:12px">سود</th>
          <th style="text-align:right;padding:12px">Margin</th>
        </tr></thead>
        <tbody>${rows.map(x=>`<tr style="border-top:1px solid rgba(255,255,255,.08)">
          <td style="padding:12px"><b>${esc(x.course.course_name)}</b></td>
          <td style="padding:12px">${faNum(x.registered)}</td><td style="padding:12px">${faNum(x.capacity)}</td>
          <td style="padding:12px">${money(x.revenue)}</td><td style="padding:12px">${money(x.cost)}</td>
          <td style="padding:12px"><b>${money(x.profit)}</b></td>
          <td style="padding:12px"><span class="badge ${x.margin>0?"green":x.margin<0?"red":"gray"}">${faNum(x.margin)}٪</span></td>
        </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><b>داده دوره‌ای وجود ندارد</b><span>با ثبت دوره‌ها گزارش تکمیل می‌شود.</span></div>`}
    </section>
  `;

  const btn=$("#printBoardReport");
  if(btn) btn.onclick=()=>window.print();
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

  const isNumber = type === "number";
  const finalType = isNumber ? "text" : type;
  const numberAttrs = isNumber
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

      <span>NEW LEAD</span>

      <h2>ثبت سریع متقاضی</h2>

      <p>
        هیچ فیلدی اجباری نیست. فقط اطلاعاتی را که الان دارید وارد کنید.
      </p>

    </div>


    <form
      id="leadForm"
      class="form-grid"
    >

      ${
        formField(
          "نام و نام خانوادگی",
          "full_name"
        )
      }

      ${
        formField(
          "شماره موبایل",
          "mobile",
          "tel",
          'inputmode="tel"'
        )
      }


      ${
        selectField(
          "دوره موردنظر",
          "course_id",
          `
            <option value="">فعلاً مشخص نیست</option>
            ${
              state.courses.map(c => `
                <option value="${esc(c.course_id)}">
                  ${esc(c.course_name)}
                </option>
              `).join("")
            }
          `
        )
      }


      ${
        selectField(
          "منبع آشنایی",
          "source",
          `
            <option value="">مشخص نیست</option>
            <option>Instagram</option>
            <option>Telegram</option>
            <option>University</option>
            <option>Referral</option>
            <option>Website</option>
            <option>Other</option>
          `
        )
      }


      <details class="full optional-details">

        <summary>
          اطلاعات تکمیلی اختیاری
        </summary>

        <div class="form-grid optional-inner">

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
              "number"
            )
          }

          <label class="field full">

            <span>یادداشت اولیه</span>

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
        ثبت متقاضی
      </button>

    </form>
  `);


  $("#leadForm").onsubmit =
    async e => {

      e.preventDefault();

      await submitPost(
        "createLead",
        formDataObject(e.target),
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
