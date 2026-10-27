import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Image as ImageIcon,
  Play,
  RefreshCw,
  ShieldCheck,
  Video,
  X,
  XCircle,
} from "lucide-react";
import AdminShell from "../../admin/components/AdminShell";
import {
  listAdminHostListingPackets,
  reviewAdminHostListingPacket,
} from "../services/hostUnifiedListing.service";

const correctionSections = [
  ["details", "Item details"],
  ["media", "Photos & video"],
  ["ingredients", "Ingredients & costing"],
  ["steps", "Preparation steps"],
  ["nutrition", "Nutrition & allergens"],
  ["selling", "Selling information"],
  ["delivery", "Delivery information"],
];
const filters = [
  ["submitted_for_review", "Awaiting review"],
  ["changes_requested", "Changes requested"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["", "All statuses"],
];
const statusLabels = {
  submitted_for_review: "Awaiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};
const statusTones = {
  submitted_for_review: "bg-[#FFF0DC] text-[#86501E] border-[#EDD7B7]",
  changes_requested: "bg-[#F0EBFC] text-[#58468B] border-[#DBD1F5]",
  approved: "bg-[#E4F3EA] text-[#175B3D] border-[#C8E2D1]",
  rejected: "bg-[#FDECEB] text-[#9B393D] border-[#EDCBC8]",
};
const inputClass =
  "w-full min-h-11 rounded-lg border border-[#CCD8CE] bg-white px-3.5 py-2.5 text-[16px] leading-6 text-[#23352B] outline-none transition focus:border-[#21815C] focus:ring-2 focus:ring-[#21815C]/15";
const show = (value, suffix = "") =>
  value !== undefined && value !== null && value !== ""
    ? `${value}${suffix}`
    : "Not provided";
const money = (value) =>
  value !== undefined && value !== null && value !== ""
    ? `₹${value}`
    : "Not provided";
const readableType = (value) => String(value || "Listing").replaceAll("_", " ");
const readableDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
const getError = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Unable to complete this request.";

function Status({ value }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[14px] font-semibold leading-5 ${
        statusTones[value] || "bg-[#F0F3EF] text-[#4D6153] border-[#D9E3DC]"
      }`}
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-current"
        aria-hidden="true"
      />
      {statusLabels[value] || readableType(value)}
    </span>
  );
}

// One visual heading system shared by each step in the review workflow.
function StepHeading({ number, title, trailing }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#D9E1D9] pb-3.5">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="shrink-0 text-[17px] font-bold tabular-nums text-[#B75B3A]">
          {number}
        </span>
        <h2 className="min-w-0 text-[23px] font-semibold leading-[1.3] tracking-[-.03em] text-[#173F35] sm:text-[25px]">
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(95px,.8fr)_minmax(0,1.2fr)] gap-3 border-b border-[#E3E9E3] py-2.5 last:border-0 sm:grid-cols-[minmax(125px,.8fr)_minmax(0,1.2fr)]">
      <dt className="text-[15px] leading-6 text-[#65776A]">{label}</dt>
      <dd className="min-w-0 break-words text-[16px] font-medium leading-6 text-[#233E30]">
        {value}
      </dd>
    </div>
  );
}

// Cloudinary's public video delivery URL can serve a still frame when requested
// as a JPG. For an ordinary HTTPS video URL, keep a clear playable fallback.
function cloudinaryVideoPoster(videoUrl) {
  try {
    const url = new URL(videoUrl);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com")
      return "";
    const marker = "/video/upload/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return "";
    const prefix = url.pathname.slice(0, markerIndex + marker.length);
    const remainder = url.pathname.slice(markerIndex + marker.length);
    // Preserve the version and public ID, but do not carry video-specific
    // transformations into the generated still-image URL.
    const versionMatch = remainder.match(/(?:^|\/)v\d+\//);
    const publicPath = versionMatch
      ? remainder.slice(versionMatch.index).replace(/^\//, "")
      : remainder;
    if (!publicPath || !/^[a-zA-Z0-9_./-]+$/.test(publicPath)) return "";
    const imagePath = publicPath.replace(/\.(?:mp4|webm|mov|m4v)$/i, "");
    return `${url.origin}${prefix}so_1,c_fill,w_640,ar_4:3/${imagePath}.jpg`;
  } catch {
    return "";
  }
}

function RecipeVideoThumbnail({ videoUrl, title, onPlay }) {
  const [posterFailed, setPosterFailed] = useState(false);
  useEffect(() => {
    setPosterFailed(false);
  }, [videoUrl]);
  const poster = cloudinaryVideoPoster(videoUrl);

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play submitted recipe video for ${title || "listing"}`}
      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#DCE7DD] text-[#173F35] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F7A55]"
    >
      {poster && !posterFailed ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          onError={() => setPosterFailed(true)}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="flex size-full items-center justify-center bg-gradient-to-br from-[#DCE8D9] to-[#B7CFBC]">
          <Video size={32} strokeWidth={1.6} aria-hidden="true" />
        </span>
      )}
      <span
        className="absolute inset-0 bg-gradient-to-t from-[#0B2D21]/55 via-transparent to-transparent"
        aria-hidden="true"
      />
      <span
        className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/95 text-[#173F35] shadow-md transition group-hover:scale-110"
        aria-hidden="true"
      >
        <Play size={22} fill="currentColor" className="ml-0.5" />
      </span>
      <span className="absolute bottom-2 left-3 text-[14px] font-semibold text-white">
        Recipe video
      </span>
    </button>
  );
}

// Horizontal media rail: on desktop the second tile is 80% visible,
// signalling that more media can be revealed by scrolling.
function ListingMediaStrip({ images, videoUrl, title, onPlay }) {
  const stripRef = useRef(null);
  const mediaCount = images.length + (videoUrl ? 1 : 0);
  const tileWidth =
    mediaCount > 1
      ? "shrink-0 basis-[calc(50%_-_6px)] lg:basis-[calc(55.5556%_-_6.6667px)]"
      : "shrink-0 basis-[calc(50%_-_6px)]";
  const scrollMedia = (direction) => {
    if (!stripRef.current) return;
    stripRef.current.scrollBy({
      left: direction * stripRef.current.clientWidth,
      behavior: "smooth",
    });
  };

  if (!mediaCount)
    return (
      <div className="flex aspect-[5/3] items-center justify-center gap-2 rounded-lg bg-[#EEF2E9] text-[15px] text-[#627768]">
        <ImageIcon size={22} aria-hidden="true" /> No photo supplied
      </div>
    );

  return (
    <div className="min-w-0">
      <div
        ref={stripRef}
        role="region"
        aria-label="Submitted listing photos and video"
        tabIndex={mediaCount > 1 ? 0 : undefined}
        className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F7A55]"
      >
        {images.map((image, index) => (
          <a
            key={`${image}-${index}`}
            href={image}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open submitted photo ${index + 1} of ${images.length}`}
            className={`group relative block aspect-[4/3] min-w-0 ${tileWidth} snap-start overflow-hidden rounded-lg border border-[#D8E2D7] bg-[#E6ECE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F7A55]`}
          >
            <img
              src={image}
              alt={`Submitted photo ${index + 1} for ${title || "listing"}`}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span
              className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-white/95 text-[#173F35] shadow-sm"
              aria-hidden="true"
            >
              <ArrowUpRight size={17} />
            </span>
          </a>
        ))}
        {videoUrl && (
          <div className={`min-w-0 ${tileWidth} snap-start`}>
            <RecipeVideoThumbnail
              videoUrl={videoUrl}
              title={title}
              onPlay={onPlay}
            />
          </div>
        )}
      </div>
      {mediaCount > 1 && (
        <div
          className={`${
            mediaCount === 2 ? "hidden lg:flex" : "flex"
          } mt-1 items-center justify-between gap-2`}
        >
          <span className="text-[14px] text-[#617468]">
            Scroll to see all {mediaCount} media items
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Scroll gallery left"
              onClick={() => scrollMedia(-1)}
              className="flex size-9 items-center justify-center rounded-full border border-[#CAD9CE] bg-white text-[#173F35] transition hover:bg-[#E8F1E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F7A55]"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Scroll gallery right"
              onClick={() => scrollMedia(1)}
              className="flex size-9 items-center justify-center rounded-full border border-[#CAD9CE] bg-white text-[#173F35] transition hover:bg-[#E8F1E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F7A55]"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUnifiedListingReviewPage() {
  const [params] = useSearchParams();
  const focus = params.get("focus");
  const [listings, setListings] = useState([]);
  const [selectedId, setSelectedId] = useState(focus || "");
  const [filter, setFilter] = useState("submitted_for_review");
  const [note, setNote] = useState("");
  const [section, setSection] = useState("details");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [videoOpen, setVideoOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listAdminHostListingPackets(filter);
      setListings(result?.listings || []);
    } catch (cause) {
      setError(getError(cause));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (focus) setSelectedId(focus);
  }, [focus]);

  const selected = listings.find((row) => row.id === selectedId) || listings[0];
  const packet = selected?.packet || {};
  const ingredientRows = packet.ingredients || [];
  const stepRows = packet.steps || [];
  const isRecipeListing = String(selected?.type || "")
    .toLowerCase()
    .includes("recipe");
  const imageRows = packet.images || [];
  const awaitingDecision = selected?.status === "submitted_for_review";
  const postalCodes = packet.delivery?.postalCodes || [];

  // Always close the playback dialog when switching to another submission.
  useEffect(() => {
    setVideoOpen(false);
  }, [selected?.id]);
  useEffect(() => {
    if (!videoOpen) return undefined;
    const onEscape = (event) => {
      if (event.key === "Escape") setVideoOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [videoOpen]);

  async function decide(decision) {
    if (!selected || busy || !awaitingDecision) return;
    if (decision !== "approved" && note.trim().length < 5) {
      setError(
        "Explain the correction or rejection in at least five characters."
      );
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await reviewAdminHostListingPacket(selected.id, {
        decision,
        note: note.trim(),
        section: decision === "changes_requested" ? section : "",
      });
      setSuccess(
        `Decision saved for ${selected.title}. The Host will receive an in-app notification.`
      );
      setNote("");
      await load();
    } catch (cause) {
      setError(getError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Host listing review"
      description="Check Host submissions and make the final publishing decision."
      showWorkspaceBadge={false}
      actions={
        <button
          type="button"
          disabled={loading || busy}
          onClick={load}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#C7D5C9] bg-white px-3.5 text-[15px] font-semibold text-[#174635] transition hover:bg-[#E9F4EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F7A55] disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
            aria-hidden="true"
          />{" "}
          {loading ? "Refreshing..." : "Refresh queue"}
        </button>
      }
    >
      <main className="mx-auto w-full max-w-[1400px] min-w-0 text-[#23352B]">
        {error && (
          <p
            role="alert"
            className="mb-4 border-l-[3px] border-[#BA4545] bg-[#FFF0EC] px-4 py-3 text-[16px] leading-6 text-[#842F32]"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mb-4 border-l-[3px] border-[#24734C] bg-[#E8F4E9] px-4 py-3 text-[16px] leading-6 text-[#174635]"
          >
            {success}
          </p>
        )}

        {/* Horizontal selector: no left-side rail and no unused column beneath it. */}
        <section
          aria-label="Review submissions"
          className="min-w-0 rounded-xl border border-[#D5E1D6] bg-[#EBF1E9] p-4 sm:p-5 lg:p-6"
        >
          <StepHeading
            number="01"
            title="Select a submission"
            trailing={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium text-[#51695B]">
                  {listings.length} listings
                </span>
                <label htmlFor="admin-review-filter" className="sr-only">
                  Filter submissions
                </label>
                <select
                  id="admin-review-filter"
                  className={`${inputClass} min-h-10 w-auto max-w-[215px] py-1.5 text-[15px]`}
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value);
                    setSelectedId("");
                    setNote("");
                    setSuccess("");
                  }}
                >
                  {filters.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
          {listings.length ? (
            <div
              className="mt-4 flex min-w-0 gap-3 overflow-x-auto pb-1.5"
              aria-live="polite"
            >
              {listings.map((row) => {
                const active = selected?.id === row.id;
                const thumbnail = row.packet?.images?.[0];
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedId(row.id);
                      setNote("");
                      setError("");
                      setSuccess("");
                    }}
                    className={`relative flex min-h-[90px] w-[250px] min-w-[230px] shrink-0 items-center gap-3 rounded-lg border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F7A55] sm:w-[270px] ${
                      active
                        ? "border-[#B66A47] bg-white shadow-[0_2px_9px_rgba(40,65,47,.08)]"
                        : "border-[#D5E0D5] bg-[#F9FAF6] hover:border-[#81AA8E]"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-[#C86C42]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="flex size-[58px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#E1E9E0] text-[#6E9277]">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon size={22} aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[16px] font-semibold leading-5 text-[#173F35]">
                        {row.title || "Untitled listing"}
                      </span>
                      <span className="mt-1 block text-[14px] capitalize leading-5 text-[#5E7466]">
                        {readableType(row.type)}
                      </span>
                      <span className="mt-0.5 block text-[14px] font-semibold leading-5 text-[#975A38]">
                        {statusLabels[row.status] || readableType(row.status)}
                      </span>
                    </span>
                    <ChevronRight
                      size={17}
                      className="shrink-0 text-[#A27555]"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-[16px] text-[#566B5C]">
              No submissions in this status. Choose another filter.
            </p>
          )}
        </section>

        {selected ? (
          <div className="mt-3 min-w-0 border-x border-[#E0E4DC] bg-[#FCFCF9] px-4 sm:px-6 lg:px-8">
            {/* Single-column sequence. Every numbered section starts at the same left edge. */}
            <section className="min-w-0 border-b border-[#DDE3DB] py-6 sm:py-7">
              <StepHeading
                number="02"
                title="Listing overview"
                trailing={<Status value={selected.status} />}
              />
              <div className="mt-5 grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,48%)] lg:gap-8">
                <div className="min-w-0">
                  <h3 className="break-words text-[26px] font-semibold leading-[1.25] tracking-[-.035em] text-[#173F35] sm:text-[30px]">
                    {selected.title || "Untitled listing"}
                  </h3>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] leading-6 text-[#52685A]">
                    <span className="capitalize font-medium">
                      {readableType(selected.type)}
                    </span>
                    <span className="text-[#A6B5A8]" aria-hidden="true">
                      •
                    </span>
                    <span>{packet.category || "Category not provided"}</span>
                    {selected.submittedAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={14} aria-hidden="true" />{" "}
                        {readableDate(selected.submittedAt)}
                      </span>
                    )}
                  </p>
                  <p className="mt-4 max-w-[75ch] whitespace-pre-line break-words text-[16px] leading-[1.65] text-[#465C4D]">
                    {packet.description ||
                      "No description provided by the Host."}
                  </p>
                </div>
                <ListingMediaStrip
                  key={selected.id}
                  images={imageRows}
                  videoUrl={packet.videoUrl}
                  title={selected.title}
                  onPlay={() => setVideoOpen(true)}
                />
              </div>
            </section>

            {isRecipeListing && (
              <section className="min-w-0 border-b border-[#DDE3DB] py-6 sm:py-7">
                <StepHeading
                  number="03"
                  title="Ingredients & quantities"
                  trailing={
                    <span className="text-[15px] font-medium text-[#5D7464]">
                      {ingredientRows.length} ingredients
                    </span>
                  }
                />
                {ingredientRows.length ? (
                  <div className="mt-3 grid min-w-0 gap-x-9 md:grid-cols-2">
                    {ingredientRows.map((item, index) => (
                      <div
                        key={index}
                        className="flex min-w-0 items-center gap-3 border-b border-[#E5E9E1] py-3"
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#EDF1E8] text-[#708E77]">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageIcon size={19} aria-hidden="true" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[16px] font-semibold leading-5 text-[#173F35]">
                            {item.name || "Unnamed ingredient"}
                          </p>
                          <p className="mt-1 break-words text-[14px] leading-5 text-[#68796C]">
                            {item.unitPrice == null
                              ? "Purchase price not supplied"
                              : `${money(item.unitPrice)} per ${
                                  item.priceQuantity || ""
                                } ${item.priceUnit || ""}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-[16px] font-semibold tabular-nums text-[#2B5140]">
                          {show(item.quantity)} {item.unit || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pt-4 text-[16px] text-[#627468]">
                    No ingredients listed.
                  </p>
                )}
                {(selected.estimate?.ingredientCost != null ||
                  selected.estimate?.fullRecipeCost != null) && (
                  <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 bg-[#EDF3EA] px-4 py-3 text-[15px] text-[#4B6351]">
                    <span>
                      Ingredient cost{" "}
                      <strong className="ml-1 text-[17px] text-[#173F35]">
                        {selected.estimate?.ingredientCost == null
                          ? "Incomplete"
                          : money(selected.estimate.ingredientCost)}
                      </strong>
                    </span>
                    <span>
                      Production cost{" "}
                      <strong className="ml-1 text-[17px] text-[#173F35]">
                        {selected.estimate?.fullRecipeCost == null
                          ? "Incomplete"
                          : money(selected.estimate.fullRecipeCost)}
                      </strong>
                    </span>
                    <span className="text-[14px]">Host estimates</span>
                  </div>
                )}
              </section>
            )}

            {isRecipeListing && (
              <section className="min-w-0 border-b border-[#DDE3DB] py-6 sm:py-7">
                <StepHeading
                  number="04"
                  title="How to make it"
                  trailing={
                    <span className="text-[15px] font-medium text-[#647366]">
                      {stepRows.length} steps
                    </span>
                  }
                />
                {stepRows.length ? (
                  <ol className="mt-3 grid min-w-0 gap-x-9 md:grid-cols-2">
                    {stepRows.map((step, index) => (
                      <li
                        key={index}
                        className="flex min-w-0 items-start gap-3 border-b border-[#EEE6DD] py-3.5"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FBE4D7] text-[14px] font-bold tabular-nums text-[#985235]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[16px] leading-[1.6] text-[#34483C]">
                            {step.instruction || "Step not provided"}
                          </p>
                          {step.timerMinutes != null &&
                            Number(step.timerMinutes) > 0 && (
                              <span className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#7D715C]">
                                <Clock3 size={13} aria-hidden="true" />{" "}
                                {step.timerMinutes} min
                              </span>
                            )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="pt-4 text-[16px] text-[#627468]">
                    No preparation steps supplied.
                  </p>
                )}
              </section>
            )}

            <section className="min-w-0 border-b border-[#DDE3DB] py-6 sm:py-7">
              <StepHeading
                number={isRecipeListing ? "05" : "03"}
                title="Food facts & selling"
              />
              <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-9">
                <div className="min-w-0">
                  <h3 className="border-b border-[#D9E6DC] pb-2 text-[18px] font-semibold text-[#173F35]">
                    Nutrition & allergens
                  </h3>
                  <dl>
                    <DataRow label="Dietary" value={show(packet.dietary)} />
                    <DataRow
                      label="Allergens"
                      value={
                        packet.allergens?.length
                          ? packet.allergens
                              .map((a) => `${a.key} (${a.relationship})`)
                              .join(", ")
                          : "Not declared"
                      }
                    />
                    <DataRow
                      label="Energy"
                      value={show(packet.nutrition?.energyKcal, " kcal")}
                    />
                    <DataRow
                      label="Protein"
                      value={show(packet.nutrition?.proteinG, " g")}
                    />
                    <DataRow
                      label="Fat"
                      value={show(packet.nutrition?.fatG, " g")}
                    />
                  </dl>
                  {packet.nutrition?.evidenceNote && (
                    <details className="group mt-3 rounded-lg border border-[#EAD6C8] bg-[#FFF6EE] px-3.5 py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold text-[#88553D] [&::-webkit-details-marker]:hidden">
                        Evidence & calculation notes{" "}
                        <ChevronDown
                          size={16}
                          className="transition group-open:rotate-180"
                        />
                      </summary>
                      <p className="mt-2 whitespace-pre-line break-words border-t border-[#F0DECF] pt-2 text-[15px] leading-6 text-[#5A5149]">
                        {packet.nutrition.evidenceNote}
                      </p>
                    </details>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="border-b border-[#D9E6DC] pb-2 text-[18px] font-semibold text-[#173F35]">
                    Selling & delivery
                  </h3>
                  <dl>
                    <DataRow
                      label="Selling price"
                      value={money(packet.selling?.salePrice)}
                    />
                    <DataRow
                      label="Available stock"
                      value={show(packet.selling?.stockQuantity)}
                    />
                    <DataRow
                      label="Pack / portion"
                      value={`${show(packet.selling?.packQuantity)} ${
                        packet.selling?.packUnit || ""
                      }`}
                    />
                    <DataRow
                      label="Minimum order"
                      value={show(packet.selling?.minimumOrderQuantity)}
                    />
                    <DataRow
                      label="Fulfilment"
                      value={show(packet.delivery?.fulfillment)}
                    />
                  </dl>
                  {postalCodes.length > 0 && (
                    <details className="group mt-3 rounded-lg border border-[#DCE5DB] bg-[#EFF4ED] px-3.5 py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold text-[#27573D] [&::-webkit-details-marker]:hidden">
                        Delivery pincodes ({postalCodes.length}){" "}
                        <ChevronDown
                          size={16}
                          className="transition group-open:rotate-180"
                        />
                      </summary>
                      <p className="mt-2 break-words border-t border-[#D8E3D7] pt-2 text-[15px] leading-6 text-[#496653]">
                        {postalCodes.join(", ")}
                      </p>
                    </details>
                  )}
                </div>
              </div>
            </section>

            <section className="min-w-0 border-b border-[#DDE3DB] py-5 sm:py-6">
              <StepHeading
                number={isRecipeListing ? "06" : "04"}
                title="Review history"
                trailing={
                  <span className="text-[15px] text-[#667769]">
                    {selected.reviewHistory?.length || 0} events
                  </span>
                }
              />
              <details className="group mt-3">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-[16px] font-medium text-[#395E47] [&::-webkit-details-marker]:hidden">
                  View previous decisions and messages{" "}
                  <ChevronDown
                    size={17}
                    className="transition group-open:rotate-180"
                  />
                </summary>
                {selected.reviewHistory?.length ? (
                  <div className="mt-2 divide-y divide-[#E5EAE3]">
                    {selected.reviewHistory.map((entry, index) => (
                      <p
                        key={index}
                        className="break-words py-3 text-[15px] leading-6 text-[#526558]"
                      >
                        <strong className="capitalize text-[#173F35]">
                          {readableType(entry.decision)}
                        </strong>
                        {entry.note ? ` · ${entry.note}` : " · Submitted"}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[15px] text-[#617469]">
                    No previous review decisions.
                  </p>
                )}
                {selected.reviewNote && (
                  <p className="mt-2 bg-[#FFF2E8] px-3 py-2.5 text-[15px] leading-6 text-[#714D3D]">
                    <strong>Last note:</strong> {selected.reviewNote}
                  </p>
                )}
              </details>
            </section>

            {awaitingDecision && (
              <section className="min-w-0 border-b border-[#DDE3DB] bg-[#FFF3EA] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
                <StepHeading
                  number={isRecipeListing ? "07" : "05"}
                  title="Make a decision"
                />
                <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,.8fr)] lg:gap-6">
                  <div className="min-w-0">
                    <label
                      htmlFor="admin-review-note"
                      className="block text-[15px] font-semibold text-[#324638]"
                    >
                      Note to Host{" "}
                      <span className="font-normal text-[#70645C]">
                        (required for corrections or rejection)
                      </span>
                    </label>
                    <textarea
                      id="admin-review-note"
                      rows={3}
                      maxLength={1500}
                      className={`${inputClass} mt-1.5 resize-y`}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Explain what needs to change..."
                    />
                  </div>
                  <div className="min-w-0">
                    <label
                      htmlFor="admin-correction-section"
                      className="block text-[15px] font-semibold text-[#324638]"
                    >
                      Section to correct
                    </label>
                    <select
                      id="admin-correction-section"
                      className={`${inputClass} mt-1.5`}
                      value={section}
                      onChange={(event) => setSection(event.target.value)}
                    >
                      {correctionSections
                        .filter(
                          ([value]) =>
                            isRecipeListing ||
                            (value !== "ingredients" && value !== "steps")
                        )
                        .map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                    </select>
                    <p className="mt-1.5 text-[14px] text-[#756B5F]">
                      Used only when requesting changes.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decide("approved")}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#165A3C] px-5 text-[16px] font-semibold text-white transition hover:bg-[#0D452D] disabled:opacity-60"
                  >
                    <CheckCircle2 size={18} aria-hidden="true" /> Approve
                    listing
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decide("changes_requested")}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#CFA994] bg-white px-5 text-[16px] font-semibold text-[#875039] transition hover:bg-[#FFE8D8] disabled:opacity-60"
                  >
                    <FileText size={18} aria-hidden="true" /> Request changes
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decide("rejected")}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#E9C3C0] bg-[#FFF8F7] px-5 text-[16px] font-semibold text-[#A13F43] transition hover:bg-[#FCE6E5] disabled:opacity-60"
                  >
                    <XCircle size={18} aria-hidden="true" /> Reject
                  </button>
                </div>
                <p className="mt-3 flex items-center gap-2 text-[14px] leading-5 text-[#617162]">
                  <ShieldCheck
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />{" "}
                  Approval publishes the listing; other marketplace permissions
                  remain unchanged.
                </p>
              </section>
            )}
          </div>
        ) : (
          <div className="mt-4 flex min-h-44 flex-col items-center justify-center border border-[#D9E2D9] bg-[#FBFCF8] p-6 text-center">
            <h2 className="text-[22px] font-semibold text-[#173F35]">
              No submission selected
            </h2>
            <p className="mt-2 text-[16px] text-[#607164]">
              Select a listing above or change the status filter.
            </p>
          </div>
        )}

        {videoOpen && packet.videoUrl && (
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setVideoOpen(false);
            }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0B1913]/85 p-3 sm:p-6"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Recipe video for ${selected?.title || "listing"}`}
              className="w-full max-w-[980px] min-w-0 overflow-hidden rounded-xl bg-[#F7F6F2] shadow-2xl"
            >
              <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <p className="min-w-0 truncate text-[17px] font-semibold text-[#173F35]">
                  {selected?.title || "Listing"} · Recipe video
                </p>
                <button
                  type="button"
                  onClick={() => setVideoOpen(false)}
                  autoFocus
                  aria-label="Close recipe video"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#CCD8CE] bg-white text-[#173F35] transition hover:bg-[#E4EEE6]"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <video
                key={packet.videoUrl}
                src={packet.videoUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="max-h-[75vh] w-full bg-black object-contain"
                aria-label={`Submitted recipe video for ${
                  selected?.title || "listing"
                }`}
              >
                Your browser does not support this video format.
              </video>
            </div>
          </div>
        )}

        <Link
          to="/admin/host-operations"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-[#17543B] underline-offset-4 hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to Host operations
        </Link>
      </main>
    </AdminShell>
  );
}
