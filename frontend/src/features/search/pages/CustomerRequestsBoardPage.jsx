import {
  ArrowRight,
  Bell,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../api/apiClient";
import AdminShell from "../../admin/components/AdminShell";

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function RequestBoard({ isAdmin }) {
  const [status, setStatus] = useState("active");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ items: [], hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      status,
      page: String(page),
      ...(query ? { query } : {}),
    });
    apiClient
      .get(`/notifications/customer-demand?${params}`)
      .then(({ data: result }) => {
        if (live) setData(result?.data || { items: [], hasMore: false });
      })
      .catch((err) => {
        if (!live) return;
        setData({ items: [], hasMore: false });
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load requests."
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [page, query, refresh, status]);

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };
  const rows = Array.isArray(data.items) ? data.items : [];
  if (isAdmin) {
    return (
      <main className="min-w-0 bg-[#F6F4EE] text-[#183D34]">
        <div className="w-full min-w-0 pb-5 sm:pb-8">
          <section
            className="grid overflow-hidden rounded-[20px] border border-[#D9E4D8] lg:grid-cols-[minmax(0,1.25fr)_minmax(315px,0.75fr)]"
            aria-labelledby="customer-demand-heading"
          >
            <div className="min-w-0 bg-[#DDEDE5] px-4 py-5 sm:px-8 sm:py-8 xl:px-10 xl:py-9">
              <div className="inline-flex items-center gap-2 text-[13px] font-bold text-[#346953]">
                <span
                  className="h-1.5 w-5 rounded-full bg-[#C76443]"
                  aria-hidden="true"
                />
                CUSTOMER DEMAND
              </div>
              <h2
                id="customer-demand-heading"
                className="mt-2 max-w-[720px] text-[27px] font-extrabold leading-[1.13] tracking-[-.035em] text-[#143E32] sm:mt-3 sm:text-[36px] xl:text-[42px]"
              >
                <span className="sm:hidden">What customers need</span>
                <span className="hidden sm:inline">
                  See what customers need next.
                </span>
              </h2>
              <p className="mt-3 hidden max-w-[670px] text-[15px] leading-[1.6] text-[#426255] sm:block sm:text-[16px]">
                Explore requested products and review matching listings before
                they become available to customers.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-6 sm:gap-2.5">
                <Link
                  to="/admin/host-listings"
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] bg-[#174638] px-4 text-[14px] font-bold sm:min-h-11 sm:px-5 text-white transition hover:bg-[#0D3529]"
                >
                  Review listings <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setRefresh((value) => value + 1)}
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] border border-[#ADC9BA] bg-white/85 px-3 text-[14px] font-bold sm:min-h-11 sm:px-4 text-[#174638] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : ""}
                    aria-hidden="true"
                  />{" "}
                  Refresh
                </button>
              </div>
            </div>
            <div className="min-w-0 bg-[#F9E2D3] px-4 py-3.5 sm:px-8 sm:py-8 lg:border-l lg:border-[#EACDBD] xl:px-9">
              <p className="text-[12px] font-bold text-[#9D563A] sm:text-[13px]">
                HOW A REQUEST MOVES
              </p>
              <div
                className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] font-semibold text-[#173E34] sm:hidden"
                aria-label="Request, host listing, then admin approval"
              >
                <span>Request</span>
                <ArrowRight size={13} aria-hidden="true" />
                <span>Host lists</span>
                <ArrowRight size={13} aria-hidden="true" />
                <span>Admin approves</span>
              </div>
              <div className="mt-5 hidden gap-4 sm:grid">
                {[
                  ["01", "Customer requests", "A customer asks for a product."],
                  ["02", "Host lists", "A Host submits a matching product."],
                  [
                    "03",
                    "Admin approves",
                    "Customers are alerted when it is ready to buy.",
                  ],
                ].map(([number, title, description]) => (
                  <div
                    key={number}
                    className="flex items-start gap-3 border-b border-[#E9C5B4] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white/80 text-[13px] font-extrabold text-[#B15838]">
                      {number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold leading-5 text-[#173E34]">
                        {title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-5 text-[#735F55]">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-[14px] border border-[#F0B6B6] bg-[#FFF1F1] px-4 py-3 text-[14px] font-semibold text-[#9F2F35]"
            >
              {error}
            </div>
          ) : null}

          <div className="mt-3 grid min-w-0 gap-3 sm:mt-5 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.28fr)] xl:items-start">
            <section
              className="min-w-0 overflow-hidden rounded-[18px] border border-[#DDE5DD] bg-[#FFFEFB]"
              aria-labelledby="request-inbox-title"
            >
              <div className="border-b border-[#DFE8DE] px-3 py-4 sm:px-6 sm:py-6">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <p className="hidden text-[13px] font-bold text-[#B75F3F] sm:block">
                      PRODUCT REQUESTS
                    </p>
                    <h3
                      id="request-inbox-title"
                      className="text-[22px] font-extrabold tracking-[-.025em] text-[#173E34] sm:mt-1 sm:text-[28px]"
                    >
                      Request inbox
                    </h3>
                  </div>
                  <div
                    role="group"
                    aria-label="Request status"
                    className="inline-flex rounded-[11px] border border-[#D2E1D6] bg-[#EAF2EC] p-1"
                  >
                    {[
                      ["active", "Open"],
                      ["notified", "Fulfilled"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => changeStatus(value)}
                        aria-pressed={status === value}
                        className={`focus-ring min-h-10 rounded-[8px] px-4 text-[14px] font-bold transition ${
                          status === value
                            ? "bg-[#194A3A] text-white shadow-sm"
                            : "text-[#426555] hover:bg-white/70"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <form
                  className="mt-3 flex w-full min-w-0 flex-nowrap gap-2 sm:mt-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setQuery(text.trim().slice(0, 80));
                    setPage(1);
                  }}
                >
                  <label htmlFor="demand-search" className="sr-only">
                    Find requested product
                  </label>
                  <div className="relative min-w-0 flex-1 sm:basis-[210px]">
                    <Search
                      size={18}
                      aria-hidden="true"
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#658575]"
                    />
                    <input
                      id="demand-search"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      type="search"
                      placeholder="Search customer product requests"
                      maxLength={80}
                      className="focus-ring min-h-11 w-full rounded-[11px] border border-[#C5D8CA] bg-white pl-11 pr-3 text-[15px] text-[#183D34] outline-offset-2 placeholder:text-[#799081]"
                    />
                  </div>
                  <button
                    type="submit"
                    aria-label="Search product requests"
                    className="focus-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-[11px] bg-[#E0ECFB] px-3 text-[14px] font-bold text-[#204C74] transition hover:bg-[#D2E4FB] sm:px-5"
                  >
                    <Search
                      size={18}
                      aria-hidden="true"
                      className="sm:hidden"
                    />
                    <span className="hidden sm:inline">Search</span>
                  </button>
                </form>
                <div className="mt-4 hidden flex-wrap items-center justify-between gap-2 text-[13px] font-medium text-[#5D7467] sm:flex">
                  <span>
                    {status === "active"
                      ? "Requests awaiting a live product match"
                      : "Requests with customer alerts sent"}
                  </span>
                  {!loading && !error ? (
                    <span>{rows.length} shown on this page</span>
                  ) : null}
                </div>
              </div>

              <div aria-busy={loading} className="min-w-0">
                {loading ? (
                  <div
                    role="status"
                    className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-[#F3F8F4] px-4 py-9 text-center"
                  >
                    <RefreshCw
                      size={25}
                      className="animate-spin text-[#327B5B]"
                      aria-hidden="true"
                    />
                    <p className="text-[15px] font-semibold text-[#476959]">
                      Loading customer requests…
                    </p>
                  </div>
                ) : rows.length ? (
                  <div className="divide-y divide-[#DDE7E0]">
                    {rows.map((item, index) => (
                      <article
                        key={`${item.query}-${index}`}
                        className="grid min-w-0 gap-3 px-4 py-4 transition-colors hover:bg-[#F5F9F5] sm:grid-cols-[minmax(0,1fr)_minmax(125px,0.25fr)] sm:items-center sm:gap-5 sm:px-6 sm:py-5"
                      >
                        <div className="min-w-0">
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${
                                status === "active"
                                  ? "bg-[#FFF0C7] text-[#866019]"
                                  : "bg-[#DCF1E6] text-[#216845]"
                              }`}
                            >
                              {status === "active" ? "Open" : "Fulfilled"}
                            </span>
                            <span className="text-[12px] text-[#647A6D]">
                              {status === "active"
                                ? `Requested ${dateLabel(item.lastRequestedAt)}`
                                : `Alert sent ${dateLabel(item.notifiedAt)}`}
                            </span>
                          </div>
                          <h4 className="break-words text-[17px] font-bold leading-6 text-[#173D32] sm:text-[18px]">
                            {item.query}
                          </h4>
                          {item.matchedProductName ? (
                            <p className="mt-1 break-words text-[13px] leading-5 text-[#607569]">
                              Matched listing: {item.matchedProductName}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center sm:justify-end">
                          <span className="inline-flex items-center gap-2 rounded-[10px] bg-[#EAF2FA] px-3 py-2 text-[13px] font-bold text-[#275677]">
                            <Users size={16} aria-hidden="true" />{" "}
                            {item.customers}{" "}
                            {item.customers === 1 ? "customer" : "customers"}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 bg-[#F3F8F5] px-4 py-5 sm:min-h-[250px] sm:gap-5 sm:grid-cols-[110px_minmax(0,1fr)] sm:items-center sm:gap-7 sm:px-8 sm:py-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#C7DDD1] sm:h-[100px] sm:w-[100px] sm:rounded-[26px] bg-[#E2F1E9]">
                      <PackageCheck
                        size={46}
                        strokeWidth={1.5}
                        className="h-7 w-7 text-[#35795D] sm:h-[46px] sm:w-[46px]"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[18px] font-extrabold leading-tight text-[#173E34] sm:text-[21px]">
                        No {status === "active" ? "open" : "fulfilled"} requests
                        found
                      </h4>
                      <p className="mt-2 hidden max-w-lg text-[14px] leading-6 text-[#5C7565] sm:block">
                        Try a different product name or switch between Open and
                        Fulfilled requests.
                      </p>
                      {status === "active" ? (
                        <button
                          type="button"
                          onClick={() => changeStatus("notified")}
                          className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-[11px] bg-white px-4 text-[14px] font-bold text-[#215744] ring-1 ring-[#C8DBCE] transition hover:bg-[#E7F4EA]"
                        >
                          <span className="sm:hidden">See fulfilled</span>
                          <span className="hidden sm:inline">
                            View fulfilled requests
                          </span>{" "}
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => changeStatus("active")}
                          className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-[11px] bg-white px-4 text-[14px] font-bold text-[#215744] ring-1 ring-[#C8DBCE] transition hover:bg-[#E7F4EA]"
                        >
                          <span className="sm:hidden">See open</span>
                          <span className="hidden sm:inline">
                            View open requests
                          </span>{" "}
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <nav
                aria-label="Request pages"
                className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E1E8E0] bg-[#FCFDF9] px-3 py-3 sm:gap-3 sm:px-6 sm:py-4"
              >
                <span className="text-[13px] font-semibold text-[#5C7364]">
                  Page {page}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loading || page === 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="focus-ring min-h-10 rounded-[10px] border border-[#C8D9CB] bg-white px-4 text-[14px] font-bold text-[#235440] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={loading || !data.hasMore}
                    onClick={() => setPage((value) => value + 1)}
                    className="focus-ring min-h-10 rounded-[10px] border border-[#C8D9CB] bg-white px-4 text-[14px] font-bold text-[#235440] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </nav>
            </section>

            <aside
              className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1"
              aria-label="Request guidance"
            >
              <section className="hidden min-w-0 rounded-[18px] border border-[#D4DEF1] bg-[#E7EEFA] px-5 py-6 sm:block sm:px-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/80 text-[#345E91]">
                  <Bell size={20} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[19px] font-extrabold text-[#1D4665]">
                  Request status
                </h3>
                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="inline-flex rounded-full bg-[#FFF1BD] px-2.5 py-1 text-[12px] font-bold text-[#805A18]">
                      Open
                    </dt>
                    <dd className="mt-1.5 text-[14px] leading-5 text-[#49677A]">
                      Still waiting for an approved, available product.
                    </dd>
                  </div>
                  <div className="border-t border-[#C9D6E8] pt-3">
                    <dt className="inline-flex rounded-full bg-[#D4EFE2] px-2.5 py-1 text-[12px] font-bold text-[#205D45]">
                      Fulfilled
                    </dt>
                    <dd className="mt-1.5 text-[14px] leading-5 text-[#49677A]">
                      A matching product became available and the customer was
                      notified.
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="min-w-0 rounded-[14px] border border-[#E9DBB8] bg-[#FFF1CD] px-3 py-3 sm:rounded-[18px] sm:px-6 sm:py-6">
                <div className="flex items-start gap-2.5 sm:block">
                  <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/80 text-[#926328] sm:h-10 sm:w-10 sm:rounded-[12px]">
                    <ShieldCheck size={21} aria-hidden="true" />
                  </div>
                  <p className="text-[13px] font-medium leading-5 text-[#695E47] sm:hidden">
                    Customer details stay private. Alerts follow approved
                    listings.
                  </p>
                </div>
                <h3 className="mt-4 hidden text-[19px] font-extrabold text-[#694D24] sm:block">
                  Customer privacy
                </h3>
                <p className="mt-2 hidden text-[14px] leading-6 text-[#695E47] sm:block">
                  This list shows only products customers explicitly requested.
                  Names and addresses stay private. Availability alerts require
                  an approved product that is actively for sale.
                </p>
              </section>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 bg-[#F7F6F1] text-[#173F35]">
      <div className="mx-auto max-w-[1360px] px-3 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#CEDDD2] pb-5">
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-[.08em] text-[#AB6246]">
              Customer demand / Requested products
            </p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-[-.035em] sm:text-[34px]">
              What customers want next.
            </h1>
            <p className="mt-2 max-w-[690px] text-[15px] leading-6 text-[#53675A]">
              See products customers couldn't find. Hosts can submit them for
              Super Admin approval; customers are alerted only when a matching
              product is ready to buy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => setRefresh((v) => v + 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#B7CDBE] bg-white px-4 text-[14px] font-semibold disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
                aria-hidden="true"
              />{" "}
              Refresh
            </button>
            <Link
              to={
                isAdmin
                  ? "/admin/host-listings"
                  : "/host/listings/new?type=grocery"
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#173F35] px-4 text-[14px] font-bold text-white"
            >
              {isAdmin ? "Review listings" : "Create listing"}{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </header>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[#3D6951]">
            <Bell size={19} aria-hidden="true" />
            <h2 className="text-[21px] font-bold">Product requests</h2>
          </div>
          <div
            role="group"
            aria-label="Request status"
            className="inline-flex rounded-lg bg-[#E4ECE4] p-1"
          >
            {[
              ["active", "Open"],
              ["notified", "Fulfilled"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => changeStatus(value)}
                aria-pressed={status === value}
                className={`min-h-10 rounded-md px-4 text-[14px] font-semibold ${
                  status === value
                    ? "bg-[#173F35] text-white"
                    : "text-[#345949] hover:bg-[#DAE7DB]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <form
          className="mt-4 flex max-w-[560px] gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(text.trim().slice(0, 80));
            setPage(1);
          }}
        >
          <label htmlFor="demand-search" className="sr-only">
            Find requested product
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8473]"
            />
            <input
              id="demand-search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              type="search"
              placeholder="Find a product request"
              maxLength={80}
              className="min-h-11 w-full rounded-lg border border-[#BDCFBF] bg-white pl-10 pr-3 text-[15px] outline-offset-2"
            />
          </div>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-[#B0C7B4] bg-[#E5F0E8] px-4 text-[14px] font-bold"
          >
            Find
          </button>
        </form>
        {error ? (
          <p
            role="alert"
            className="mt-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-[14px] text-red-800"
          >
            {error}
          </p>
        ) : null}
        <section
          aria-busy={loading}
          className="mt-4 overflow-hidden border-y border-[#C9D9CC] bg-[#FBFCF8]"
        >
          {loading ? (
            <p role="status" className="px-5 py-8 text-[15px]">
              Loading customer requests…
            </p>
          ) : rows.length ? (
            <div className="divide-y divide-[#D8E2D7]">
              {rows.map((item, i) => (
                <article
                  key={`${item.query}-${i}`}
                  className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6"
                >
                  <div className="min-w-0">
                    <h3 className="break-words text-[17px] font-bold sm:text-[18px]">
                      {item.query}
                    </h3>
                    <p className="mt-1 text-[13px] leading-5 text-[#607567]">
                      {status === "active"
                        ? `Last requested ${dateLabel(item.lastRequestedAt)}`
                        : `Customer notified ${dateLabel(item.notifiedAt)}`}
                      {item.matchedProductName
                        ? ` · Listed as ${item.matchedProductName}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F1E9] px-3 py-1.5 text-[13px] font-bold text-[#276447]">
                      <Users size={15} aria-hidden="true" />
                      {item.customers}{" "}
                      {item.customers === 1 ? "customer" : "customers"}
                    </span>
                    {status === "active" && !isAdmin ? (
                      <Link
                        to="/host/listings/new?type=grocery"
                        className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-[#174F3B] hover:underline"
                      >
                        List this item{" "}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <PackageCheck
                size={32}
                className="mx-auto text-[#32775B]"
                aria-hidden="true"
              />
              <h3 className="mt-2 text-[18px] font-bold">
                No {status === "active" ? "open" : "fulfilled"} requests found.
              </h3>
              <p className="mt-1 text-[14px] text-[#607567]">
                Try another search or switch the status.
              </p>
            </div>
          )}
        </section>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={loading || page === 1}
            onClick={() => setPage((v) => Math.max(1, v - 1))}
            className="min-h-10 rounded-lg border border-[#B7CDBE] px-4 text-[14px] font-bold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-[14px] font-semibold">Page {page}</span>
          <button
            type="button"
            disabled={loading || !data.hasMore}
            onClick={() => setPage((v) => v + 1)}
            className="min-h-10 rounded-lg border border-[#B7CDBE] px-4 text-[14px] font-bold disabled:opacity-40"
          >
            Next
          </button>
        </div>
        <p className="mt-7 text-[13px] leading-5 text-[#647A6A]">
          Only explicit customer requests appear here. Customer identities and
          addresses remain private. Approval and active selling are required
          before anyone receives an availability alert.
        </p>
      </div>
    </main>
  );
}

export default function CustomerRequestsBoardPage({ isAdmin = false }) {
  return isAdmin ? (
    <AdminShell title="Customer Requests" showWorkspaceBadge={false}>
      <RequestBoard isAdmin />
    </AdminShell>
  ) : (
    <RequestBoard isAdmin={false} />
  );
}
