import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import AdminShell from "../../admin/components/AdminShell";
import {
  listAdminHostListingPackets,
  reviewAdminHostListingPacket,
} from "../services/hostUnifiedListing.service";

const sections = [
  "details",
  "media",
  "ingredients",
  "steps",
  "nutrition",
  "selling",
  "delivery",
];
const statusLabel = {
  submitted_for_review: "Waiting for review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Not approved",
};
const field =
  "w-full rounded-lg border border-[#CED6CA] bg-white px-3 py-2.5 text-base text-[#202421]";
function cleanError(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to complete this request."
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const result = await listAdminHostListingPackets(filter);
      setListings(result?.listings || []);
    } catch (cause) {
      setError(cleanError(cause));
    }
  }, [filter]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (focus) setSelectedId(focus);
  }, [focus]);
  const selected = listings.find((row) => row.id === selectedId) || listings[0];
  async function decide(decision) {
    if (!selected || busy || selected.status !== "submitted_for_review") return;
    if (decision !== "approved" && note.trim().length < 5) {
      setError("Add a clear review note of at least five characters.");
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
        `Decision recorded for ${selected.title}. The Host will receive an in-app notification.`
      );
      setNote("");
      await load();
    } catch (cause) {
      setError(cleanError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminShell
      title="Host listing review"
      description="Review the complete submission before it is shown to customers. Price, stock and delivery stay under existing marketplace rules."
    >
      <main className="bg-[#F7F6F2] p-3 text-[#202421] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CED6CA] pb-5">
          <div>
            <h1 className="text-2xl font-semibold text-[#173F35]">
              Unified listing approvals
            </h1>
            <p className="mt-1 text-sm">
              Approve, request a specific correction, or reject a submitted
              listing.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[#173F35] px-4 py-2.5 font-semibold text-[#173F35]"
            onClick={load}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 border-l-4 border-red-600 bg-red-50 p-3"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mt-4 border-l-4 border-green-700 bg-green-50 p-3"
          >
            {success}
          </p>
        )}
        <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="min-w-0">
            <label
              className="text-sm font-semibold"
              htmlFor="admin-review-filter"
            >
              Review queue
            </label>
            <select
              id="admin-review-filter"
              className={`${field} mt-2`}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setSelectedId("");
              }}
            >
              <option value="submitted_for_review">Awaiting review</option>
              <option value="changes_requested">Changes requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="">All statuses</option>
            </select>
            <div className="mt-4 divide-y divide-[#CED6CA] border-y border-[#CED6CA]">
              {listings.length ? (
                listings.map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    onClick={() => {
                      setSelectedId(row.id);
                      setNote("");
                    }}
                    className={`w-full px-3 py-4 text-left hover:bg-[#E3ECE2] ${
                      selected?.id === row.id ? "bg-[#E3ECE2]" : ""
                    }`}
                  >
                    <strong className="block break-words text-base">
                      {row.title || "Untitled listing"}
                    </strong>
                    <span className="mt-1 block text-sm text-[#59655D]">
                      {row.type.replaceAll("_", " ")} ·{" "}
                      {statusLabel[row.status] || row.status}
                    </span>
                  </button>
                ))
              ) : (
                <p className="py-5 text-sm text-[#59655D]">
                  No listings in this queue.
                </p>
              )}
            </div>
          </section>
          <section className="min-w-0 border-t-4 border-[#C86C42] bg-white px-4 py-5 sm:px-6">
            {selected ? (
              <>
                <p className="text-sm font-semibold text-[#C86C42]">
                  {statusLabel[selected.status] || selected.status}
                </p>
                <h2 className="mt-1 break-words text-2xl font-semibold">
                  {selected.title}
                </h2>
                <p className="mt-2 text-sm text-[#59655D]">
                  {selected.type.replaceAll("_", " ")} ·{" "}
                  {selected.packet?.category || "Other"}
                </p>
                <p className="mt-3 whitespace-pre-line text-base">
                  {selected.packet?.description || "No description provided."}
                </p>
                {selected.packet?.videoUrl && (
                  <p className="mt-3 text-sm">
                    <a
                      className="font-semibold text-[#173F35] underline"
                      href={selected.packet.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View uploaded preparation video
                    </a>
                  </p>
                )}
                {!!selected.packet?.images?.length && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {selected.packet.images.map((image, index) => (
                      <img
                        key={`${image}-${index}`}
                        alt={`Submitted item ${index + 1}`}
                        src={image}
                        className="h-28 w-32 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
                <div className="mt-5 grid gap-4 border-y border-[#CED6CA] py-4 sm:grid-cols-2">
                  <div>
                    <h3 className="font-semibold">Ingredients & quantities</h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {selected.packet?.ingredients?.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="h-9 w-9 rounded object-cover"
                            />
                          )}
                          <span>
                            {item.name} · {item.quantity} {item.unit} · Host
                            cost:{" "}
                            {item.unitPrice === null
                              ? "Unknown"
                              : `₹${item.unitPrice} per ${item.priceQuantity} ${item.priceUnit}`}
                          </span>
                        </li>
                      )) || <li>Not applicable</li>}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold">Preparation steps</h3>
                    <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
                      {selected.packet?.steps?.map((step, index) => (
                        <li key={index}>{step.instruction}</li>
                      )) || <li>Not applicable</li>}
                    </ol>
                  </div>
                  <div>
                    <h3 className="font-semibold">Food information</h3>
                    <p className="mt-2 text-sm">
                      Dietary: {selected.packet?.dietary || "Not declared"}
                    </p>
                    <p className="mt-2 text-sm">
                      Allergens:{" "}
                      {selected.packet?.allergens
                        ?.map((a) => `${a.key} (${a.relationship})`)
                        .join(", ") || "Not declared"}
                    </p>
                    <p className="mt-2 text-sm">
                      Energy:{" "}
                      {selected.packet?.nutrition?.energyKcal ?? "Unknown"} kcal
                      · Protein:{" "}
                      {selected.packet?.nutrition?.proteinG ?? "Unknown"} g ·
                      Fat: {selected.packet?.nutrition?.fatG ?? "Unknown"} g
                    </p>
                    <p className="mt-2 text-sm">
                      Evidence:{" "}
                      {selected.packet?.nutrition?.evidenceNote ||
                        "Not supplied"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Selling & fulfilment</h3>
                    <p className="mt-2 text-sm">
                      Host-declared price:{" "}
                      {selected.packet?.selling?.salePrice ?? "Not supplied"}
                    </p>
                    <p className="mt-2 text-sm">
                      Stock:{" "}
                      {selected.packet?.selling?.stockQuantity ??
                        "Not supplied"}
                    </p>
                    <p className="mt-2 text-sm">
                      Pack:{" "}
                      {selected.packet?.selling?.packQuantity ?? "Not supplied"}{" "}
                      {selected.packet?.selling?.packUnit || ""} · Minimum
                      order:{" "}
                      {selected.packet?.selling?.minimumOrderQuantity ??
                        "Not supplied"}
                    </p>
                    <p className="mt-2 text-sm">
                      Fulfilment: {selected.packet?.delivery?.fulfillment}
                    </p>
                    <p className="mt-2 break-words text-sm">
                      Host-selected pincodes:{" "}
                      {selected.packet?.delivery?.postalCodes?.join(", ") ||
                        "Not applicable"}
                    </p>
                  </div>
                </div>
                {selected.reviewNote && (
                  <p className="mt-4 bg-[#E3ECE2] p-3 text-sm">
                    Last review note: {selected.reviewNote}
                  </p>
                )}
                <p className="mt-5 bg-[#E6EDE4] p-3 text-sm">
                  Estimated ingredient cost:{" "}
                  {selected.estimate?.ingredientCost === null
                    ? "Incomplete"
                    : `₹${selected.estimate.ingredientCost}`}{" "}
                  · Total production estimate:{" "}
                  {selected.estimate?.fullRecipeCost === null
                    ? "Incomplete"
                    : `₹${selected.estimate.fullRecipeCost}`}
                  . Values are Host-declared.
                </p>
                <div className="mt-5 text-sm">
                  <h3 className="font-semibold">Review history</h3>
                  <div className="mt-2 space-y-2">
                    {selected.reviewHistory?.map((row, index) => (
                      <p key={index}>
                        {row.decision.replaceAll("_", " ")} ·{" "}
                        {row.note || "Submitted"}
                      </p>
                    ))}
                  </div>
                </div>
                {selected.status === "submitted_for_review" && (
                  <div className="mt-6 border-t border-[#CED6CA] pt-5">
                    <label
                      htmlFor="admin-review-note"
                      className="block font-semibold"
                    >
                      Note to Host
                    </label>
                    <textarea
                      id="admin-review-note"
                      rows={3}
                      className={`${field} mt-2`}
                      value={note}
                      maxLength={1500}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Explain any corrections clearly"
                    />
                    <label
                      htmlFor="admin-correction-section"
                      className="mt-4 block font-semibold"
                    >
                      Correction section
                    </label>
                    <select
                      id="admin-correction-section"
                      className={`${field} mt-2`}
                      value={section}
                      onChange={(event) => setSection(event.target.value)}
                    >
                      {sections.map((s) => (
                        <option value={s} key={s}>
                          {s[0].toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        disabled={busy}
                        type="button"
                        onClick={() => decide("approved")}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#173F35] px-4 py-3 font-semibold text-white disabled:opacity-60"
                      >
                        <CheckCircle2 size={17} /> Approve
                      </button>
                      <button
                        disabled={busy}
                        type="button"
                        onClick={() => decide("changes_requested")}
                        className="rounded-lg border border-[#C86C42] px-4 py-3 font-semibold text-[#A65031] disabled:opacity-60"
                      >
                        Request changes
                      </button>
                      <button
                        disabled={busy}
                        type="button"
                        onClick={() => decide("rejected")}
                        className="rounded-lg border border-red-600 px-4 py-3 font-semibold text-red-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
                <p className="mt-5 flex items-start gap-2 text-sm text-[#59655D]">
                  <ShieldCheck size={18} /> Approval makes this entry
                  discoverable in the curated Host listings collection. Existing
                  catalog, food-intelligence and marketplace purchasing
                  permissions are not bypassed.
                </p>
              </>
            ) : (
              <p className="text-[#59655D]">Choose a listing to review.</p>
            )}
          </section>
        </div>
        <p className="mt-5 text-sm">
          <Link
            to="/admin/host-operations"
            className="font-semibold text-[#173F35] underline"
          >
            Back to Host operations
          </Link>
        </p>
      </main>
    </AdminShell>
  );
}
