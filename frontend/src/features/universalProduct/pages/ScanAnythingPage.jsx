import {
  ArrowRight,
  Barcode,
  Camera,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  ImagePlus,
  LoaderCircle,
  PackagePlus,
  ScanLine,
  Search,
  ShieldCheck,
  Store,
  Upload,
  X,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

import MediaPrivacyHoldPanel from "../../mediaPrivacy/components/MediaPrivacyHoldPanel";

import { extractMediaPrivacyHolds } from "../../mediaPrivacy/services/mediaPrivacy.service";

import {
  createHostNpiFromImages,
  getUniversalProductErrorMessage,
  resolveHostUniversalBarcode,
  resolveUniversalBarcode,
  uploadProductEvidenceBatch,
} from "../services/universalProduct.service";

const EVIDENCE_PURPOSES = [
  {
    value: "front_pack",

    label: "Front of pack",
  },
  {
    value: "ingredient_panel",

    label: "Ingredients panel",
  },
  {
    value: "allergen_statement",

    label: "Allergen statement",
  },
  {
    value: "nutrition_panel",

    label: "Nutrition panel",
  },
  {
    value: "barcode",

    label: "Barcode / GTIN",
  },
  {
    value: "back_pack",

    label: "Back of pack / manufacturer",
  },
  {
    value: "certification_mark",

    label: "Certification mark",
  },
  {
    value: "other",

    label: "Other useful panel",
  },
];

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const REVIEW_NUTRIENTS = [
  ["energy", "Energy", "kcal"],
  ["protein", "Protein", "g"],
  ["carbohydrate", "Carbohydrate", "g"],
  ["total_fat", "Total fat", "g"],
  ["saturated_fat", "Saturated fat", "g"],
  ["dietary_fibre", "Dietary fibre", "g"],
  ["total_sugars", "Total sugars", "g"],
  ["sodium", "Sodium", "mg"],
];

function createReviewDetails() {
  return {
    ingredientDeclarationText: "",
    containsAllergens: "",
    mayContainAllergens: "",
    allergenStatement: "",
    countryOfOrigin: "",
    manufacturerName: "",
    nutritionBasis: "per_100g",
    servingSizeValue: "",
    servingSizeUnit: "g",
    nutrients: Object.fromEntries(REVIEW_NUTRIENTS.map(([key]) => [key, ""])),
    dietaryType: "not_declared",
    glutenFree: false,
  };
}

function splitReviewList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildReviewDeclarations(details) {
  const allergens = [
    ...splitReviewList(details.containsAllergens).map((name) => ({
      name,
      relationType: "contains",
    })),
    ...splitReviewList(details.mayContainAllergens).map((name) => ({
      name,
      relationType: "may_contain",
    })),
  ];

  const nutrients = REVIEW_NUTRIENTS.map(([key, label, unit]) => {
    const raw = details.nutrients?.[key];

    if (raw === "" || raw === null || raw === undefined) {
      return null;
    }

    const amount = Number(raw);

    return Number.isFinite(amount) && amount >= 0
      ? { name: label, amount, unit }
      : null;
  }).filter(Boolean);

  const servingValue = Number(details.servingSizeValue);
  const hasServingSize =
    details.servingSizeValue !== "" &&
    Number.isFinite(servingValue) &&
    servingValue >= 0;

  const claims = [];

  if (details.dietaryType === "vegetarian") {
    claims.push("Vegetarian");
  } else if (details.dietaryType === "vegan") {
    claims.push("Vegan");
  } else if (details.dietaryType === "non_vegetarian") {
    claims.push("Non Vegetarian");
  }

  if (details.glutenFree) {
    claims.push("Gluten Free");
  }

  const hasNutrition = nutrients.length > 0 || hasServingSize;

  return {
    ingredientDeclarationText: details.ingredientDeclarationText.trim(),
    allergenStatement: details.allergenStatement.trim(),
    allergens,
    ...(hasNutrition
      ? {
          nutrition: {
            basis: details.nutritionBasis || null,
            servingSize: hasServingSize
              ? {
                  value: servingValue,
                  unit: details.servingSizeUnit,
                }
              : null,
            nutrients,
          },
        }
      : {}),
    countryOfOrigin: details.countryOfOrigin.trim(),
    manufacturerName: details.manufacturerName.trim(),
    claims,
  };
}

function createLocalId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactText(value) {
  return String(value || "").trim();
}

function confidenceLabel(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "Confidence unknown";
  }

  return `${Math.round(parsed * 100)}% confidence`;
}

function nutritionLabel(nutrition) {
  const values = Array.isArray(nutrition) ? nutrition : [];

  if (values.length === 0) {
    return "Not available";
  }

  return `${values.length} nutrition values available`;
}

function ProductFact({ label, value, mobileWide = false }) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null;
  }

  return (
    <div
      className={[
        "rounded-[12px] border border-stone-200 bg-white/90 p-2 sm:rounded-2xl sm:p-4",
        mobileWide ? "col-span-2 sm:col-span-1" : "",
      ].join(" ")}
    >
      <p className="text-[7.5px] font-black uppercase tracking-[0.09em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
        {label}
      </p>

      <p className="mt-1 break-words text-[10px] font-bold leading-[14px] text-stone-800 sm:mt-2 sm:text-sm sm:leading-6">
        {Array.isArray(value) ? value.join(", ") : String(value)}
      </p>
    </div>
  );
}

function VerificationBanner({ resolution, hostMode }) {
  if (!resolution) {
    return null;
  }

  const verified = resolution.verificationStatus === "verified";

  return (
    <div
      className={[
        "rounded-[16px] border p-3 sm:rounded-[22px] sm:p-4",

        verified
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        {verified ? (
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <CircleAlert
            size={20}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
        )}

        <div>
          <p className="text-[12px] font-black sm:text-sm">
            {hostMode
              ? verified
                ? "Product match found"
                : "New product needs a quick review"
              : verified
              ? resolution.state === "verified_historical"
                ? "Verified historical pack"
                : "Verified EPANTRY product"
              : resolution.state === "provisional_external"
              ? "External product details found"
              : "Product is not yet verified in EPANTRY"}
          </p>

          <p className="mt-1 text-[10px] font-semibold leading-4 opacity-80 sm:text-xs sm:font-normal sm:leading-5">
            {hostMode
              ? verified
                ? "This barcode matches an existing EPANTRY product. Continue to pricing and stock when you are ready."
                : "Add clear pack photos and complete the details below. EPANTRY checks them before this product can be listed."
              : verified
              ? "This result is backed by a published EPANTRY canonical Product Version."
              : "These details can help you identify the pack, but they are not EPANTRY-verified catalog truth."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ExternalProductDetails({ candidate }) {
  if (!candidate) {
    return null;
  }

  const imageUrl =
    candidate.referenceImages?.front ||
    candidate.referenceImages?.ingredients ||
    candidate.referenceImages?.nutrition ||
    "";

  return (
    <div className="mt-3 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2.5 sm:mt-5 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4 lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-5">
      <div className="self-start overflow-hidden rounded-[14px] border border-amber-200 bg-amber-50 sm:rounded-[24px]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={candidate.title || "Scanned product"}
            className="aspect-[3/4] w-full object-cover sm:aspect-square"
          />
        ) : (
          <div className="grid aspect-[3/4] place-items-center text-stone-400 sm:aspect-square">
            <Barcode size={30} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="min-w-0 self-center sm:self-start">
        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-amber-700 sm:text-xs sm:tracking-[0.12em]">
          {candidate.brandName || "External product match"}
        </p>

        <h2 className="mt-0.5 text-[15px] font-black leading-[18px] text-stone-950 sm:mt-1 sm:text-2xl sm:leading-normal">
          {candidate.title || candidate.genericName || "Scanned product"}
        </h2>

        <div className="mt-1.5 flex flex-wrap gap-1 text-[8px] font-bold sm:mt-3 sm:gap-2 sm:text-[11px]">
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 sm:px-2.5">
            {confidenceLabel(candidate.confidence)}
          </span>

          <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-600 sm:px-2.5">
            {candidate.source?.sourceName || "External data"}
          </span>
        </div>
      </div>

      <div className="col-span-2 grid grid-cols-2 gap-1.5 sm:col-span-1 sm:col-start-2 sm:mt-1 sm:gap-3">
        <ProductFact label="Barcode" value={candidate.barcode} />

        <ProductFact label="Pack size" value={candidate.netQuantityText} />

        <ProductFact label="Category" value={candidate.categoryText} />

        <ProductFact
          label="Country of origin"
          value={candidate.originText || candidate.countryText}
        />

        <ProductFact
          label="Ingredients"
          value={candidate.ingredientDeclarationText}
          mobileWide
        />

        <ProductFact label="Allergens" value={candidate.allergenText} />

        <ProductFact label="May contain" value={candidate.traceTags} />

        <ProductFact
          label="Nutrition"
          value={nutritionLabel(candidate.nutrition)}
        />
      </div>
    </div>
  );
}

export default function ScanAnythingPage({ mode = "customer" }) {
  const hostMode = mode === "host";

  const videoRef = useRef(null);

  const streamRef = useRef(null);

  const timerRef = useRef(null);

  const [barcodeInput, setBarcodeInput] = useState("");

  const [market, setMarket] = useState("IN");

  const [barcodeResolution, setBarcodeResolution] = useState(null);

  const [isResolvingBarcode, setIsResolvingBarcode] = useState(false);

  const [isCameraRunning, setIsCameraRunning] = useState(false);

  const [cameraNotice, setCameraNotice] = useState("");

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [privacyHolds, setPrivacyHolds] = useState([]);

  const [evidencePurpose, setEvidencePurpose] = useState("front_pack");

  const [evidenceFiles, setEvidenceFiles] = useState([]);

  const [uploadProgress, setUploadProgress] = useState(null);

  const [isCreatingNpi, setIsCreatingNpi] = useState(false);

  const [hostNpiResult, setHostNpiResult] = useState(null);

  const [hints, setHints] = useState({
    title: "",

    brandName: "",

    netQuantityText: "",
  });

  const [reviewDetails, setReviewDetails] = useState(createReviewDetails);

  const canonicalProduct = barcodeResolution?.product || null;

  const externalCandidate = barcodeResolution?.externalCandidate || null;

  const searchQuery = useMemo(() => {
    const parts = [
      canonicalProduct?.brand?.name || externalCandidate?.brandName || "",

      canonicalProduct?.displayName ||
        externalCandidate?.title ||
        externalCandidate?.genericName ||
        "",
    ]
      .map(compactText)
      .filter(Boolean);

    return [...new Set(parts)].join(" ");
  }, [canonicalProduct, externalCandidate]);

  const stopCamera = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);

      timerRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraRunning(false);
  };

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    },
    []
  );

  async function resolveCode(code, source, decodedFormat = "UNKNOWN") {
    const normalized = compactText(code);

    if (!normalized) {
      setError("Enter or scan a barcode first.");

      return;
    }

    setError("");
    setSuccess("");
    setHostNpiResult(null);
    setReviewDetails(createReviewDetails());
    setPrivacyHolds([]);
    setCameraNotice("");
    setIsResolvingBarcode(true);

    try {
      const resolver = hostMode
        ? resolveHostUniversalBarcode
        : resolveUniversalBarcode;

      const result = await resolver({
        code: normalized,

        decodedFormat,

        source,

        market,
      });

      const resolution = result?.resolution || null;

      setBarcodeInput(normalized);

      setBarcodeResolution(resolution);

      if (hostMode && resolution?.externalCandidate) {
        const candidate = resolution.externalCandidate;

        setHints({
          title: candidate.title || candidate.genericName || "",

          brandName: candidate.brandName || "",

          netQuantityText: candidate.netQuantityText || "",
        });

        setReviewDetails({
          ...createReviewDetails(),
          ingredientDeclarationText: candidate.ingredientDeclarationText || "",
          allergenStatement: candidate.allergenText || "",
          mayContainAllergens: Array.isArray(candidate.traceTags)
            ? candidate.traceTags.join(", ")
            : "",
          countryOfOrigin: candidate.originText || candidate.countryText || "",
          nutritionBasis: candidate.nutritionBasis || "per_100g",
        });
      }
    } catch (requestError) {
      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to resolve this barcode."
        )
      );
    } finally {
      setIsResolvingBarcode(false);
    }
  }

  async function startCamera() {
    setError("");
    setCameraNotice("");

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraNotice(
        "Camera access is not supported here. Enter the barcode manually."
      );

      return;
    }

    if (!("BarcodeDetector" in window)) {
      setCameraNotice(
        "Live barcode detection is not supported by this browser. Enter the barcode manually."
      );

      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },
        },

        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await videoRef.current.play();
      }

      const Detector = window.BarcodeDetector;

      const detector = new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      });

      setIsCameraRunning(true);

      setCameraNotice("Hold the barcode steady inside the camera view.");

      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          return;
        }

        try {
          const detected = await detector.detect(videoRef.current);

          const first = detected?.[0];

          if (first?.rawValue) {
            stopCamera();

            await resolveCode(
              first.rawValue,
              "camera",
              first.format || "UNKNOWN"
            );
          }
        } catch {
          // A single unreadable camera frame is not an application error.
        }
      }, 650);
    } catch (cameraError) {
      stopCamera();

      setCameraNotice(
        cameraError?.name === "NotAllowedError"
          ? "Camera permission was not granted. Enter the barcode manually."
          : "Camera could not be started. Enter the barcode manually."
      );
    }
  }

  function addEvidenceFiles(event) {
    const files = Array.from(event.target.files || []);

    event.target.value = "";

    if (!files.length) {
      return;
    }

    const supported = files.filter((file) =>
      ACCEPTED_IMAGE_TYPES.has(file.type)
    );

    if (supported.length !== files.length) {
      setError("Only JPEG, PNG, and WebP product images are accepted.");
    } else {
      setError("");
    }

    setEvidenceFiles((current) =>
      [
        ...current,

        ...supported.map((file) => ({
          id: createLocalId(),

          purpose: evidencePurpose,

          file,
        })),
      ].slice(0, 8)
    );
  }

  function removeEvidence(evidenceId) {
    setEvidenceFiles((current) =>
      current.filter((item) => item.id !== evidenceId)
    );
  }

  async function createHostDraft() {
    if (!hostMode || !evidenceFiles.length) {
      setError(
        "Add at least one clear pack photo before sending this product for review."
      );

      return;
    }

    setError("");
    setSuccess("");
    setPrivacyHolds([]);
    setIsCreatingNpi(true);
    setUploadProgress({
      completed: 0,

      total: evidenceFiles.length,
    });

    try {
      const assets = await uploadProductEvidenceBatch({
        evidenceFiles,

        scope: "host",

        onProgress: setUploadProgress,
      });

      const result = await createHostNpiFromImages({
        assets,

        market,

        hints: {
          title: hints.title,

          brandName: hints.brandName,

          barcode: barcodeInput.trim(),

          netQuantityText: hints.netQuantityText,
        },

        hostDeclarations: buildReviewDeclarations(reviewDetails),
      });

      setHostNpiResult(result);
      setEvidenceFiles([]);

      const status = result?.resolution?.draft?.status || "";

      setSuccess(
        status === "ready_for_review"
          ? "Product details are ready for review."
          : "Product review draft created. Open Listing Studio to continue."
      );
    } catch (requestError) {
      const holds = extractMediaPrivacyHolds(requestError);

      setPrivacyHolds(holds);

      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to prepare this product for review."
        )
      );
    } finally {
      setIsCreatingNpi(false);
      setUploadProgress(null);
    }
  }

  return (
    <div
      className={
        hostMode
          ? "relative left-1/2 w-screen -translate-x-1/2 overflow-x-hidden bg-[#F7FBFF] px-5 pb-0 pt-0 sm:left-auto sm:w-auto sm:translate-x-0 sm:overflow-visible sm:bg-transparent sm:px-7 sm:pb-7 sm:pt-0 lg:px-8 lg:pb-8 lg:pt-0"
          : "ep-scan-page w-full min-w-0 pb-8"
      }
    >
      {hostMode ? (
        <section className="overflow-hidden rounded-[22px] border border-emerald-200 bg-[#F4FBF8] shadow-[0_18px_45px_-32px_rgba(5,150,105,0.28)] sm:rounded-[28px]">
          <div className="border-b border-emerald-200 bg-[linear-gradient(135deg,#DDF8EC_0%,#E8F5FF_52%,#F1EDFF_100%)] p-3 sm:p-6 lg:p-7">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl">
                <Store
                  size={23}
                  className="h-5 w-5 sm:h-[23px] sm:w-[23px]"
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-700 sm:text-[11px] sm:tracking-[0.17em]">
                  PRODUCT SCAN
                </p>

                <h1 className="mt-0.5 text-[21px] font-black leading-6 tracking-tight text-stone-950 sm:mt-1 sm:text-3xl sm:leading-tight">
                  Scan a product to list
                </h1>

                <p className="mt-1.5 max-w-3xl text-[10.5px] font-semibold leading-[15px] text-stone-600 sm:mt-3 sm:text-sm sm:font-medium sm:leading-6">
                  <span className="sm:hidden">
                    Scan the barcode to find a match. New products need pack
                    photos before review.
                  </span>
                  <span className="hidden sm:inline">
                    Scan the pack barcode. Existing EPANTRY products can move to
                    pricing and stock; new products will ask for pack photos
                    before review.
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
              {[
                {
                  number: "1",
                  title: "Scan barcode",
                  text: "Enter the code or use your camera.",
                  tone: "border-emerald-200 bg-emerald-50",
                  numberTone: "bg-emerald-600",
                },
                {
                  number: "2",
                  title: "Check match",
                  text: "EPANTRY looks for an existing product.",
                  tone: "border-sky-200 bg-sky-50",
                  numberTone: "bg-sky-600",
                },
                {
                  number: "3",
                  title: "Review if new",
                  text: "Add clear pack photos for a new product.",
                  tone: "border-violet-200 bg-violet-50",
                  numberTone: "bg-violet-600",
                },
                {
                  number: "4",
                  title: "Continue listing",
                  text: "Continue in Listing Studio to manage price and stock.",
                  tone: "border-cyan-200 bg-cyan-50",
                  numberTone: "bg-cyan-700",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className={`rounded-xl border p-2 sm:rounded-2xl sm:p-3 ${step.tone}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-black text-white sm:h-6 sm:w-6 sm:text-[10px] ${step.numberTone}`}
                    >
                      {step.number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black leading-3 text-stone-900 sm:text-xs sm:leading-4">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[8.5px] font-semibold leading-[12px] text-stone-500 sm:mt-1 sm:text-[11px] sm:leading-4">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 grid gap-2 sm:mt-0 sm:gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="bg-[#EAF6FF] p-3 sm:p-7 lg:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-sky-700 sm:text-[10px]">
                    BARCODE CHECK
                  </p>
                  <h2 className="mt-0.5 text-sm font-black text-stone-950 sm:text-lg">
                    Find the product
                  </h2>
                </div>
                <div className="rounded-xl border border-sky-200 bg-white/80 px-2.5 py-1.5 text-[9px] font-black text-sky-700 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-[10px]">
                  Host listing
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px] gap-2 sm:mt-5 sm:grid-cols-[minmax(0,1fr)_100px] sm:gap-4">
                <label className="block min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-[0.11em] text-stone-500 sm:text-xs sm:tracking-[0.12em]">
                    Barcode number
                  </span>

                  <div className="mt-1 flex min-h-10 rounded-xl border border-sky-200 bg-white/90 p-1 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100 sm:mt-2 sm:min-h-0 sm:rounded-2xl sm:p-1.5 sm:focus-within:ring-4">
                    <div className="grid w-8 shrink-0 place-items-center text-stone-400 sm:w-11">
                      <Barcode size={17} aria-hidden="true" />
                    </div>

                    <input
                      value={barcodeInput}
                      onChange={(event) => setBarcodeInput(event.target.value)}
                      inputMode="numeric"
                      placeholder="8901234567890"
                      className="min-w-0 flex-1 bg-transparent px-0.5 py-1.5 text-[11px] font-bold outline-none sm:px-1 sm:py-2.5 sm:text-sm"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-[8px] font-black uppercase tracking-[0.11em] text-stone-500 sm:text-xs sm:tracking-[0.12em]">
                    Market
                  </span>

                  <input
                    value={market}
                    onChange={(event) =>
                      setMarket(event.target.value.toUpperCase().slice(0, 10))
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-sky-200 bg-white/90 px-2 text-center text-[11px] font-black outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-sm sm:focus:ring-4"
                  />
                </label>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap sm:gap-3">
                <button
                  type="button"
                  disabled={isResolvingBarcode}
                  onClick={() => resolveCode(barcodeInput, "manual")}
                  className="focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-2.5 py-2 text-[10px] font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                >
                  {isResolvingBarcode ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileSearch size={15} aria-hidden="true" />
                  )}
                  Check barcode
                </button>

                <button
                  type="button"
                  onClick={isCameraRunning ? stopCamera : startCamera}
                  className="focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-2 text-[10px] font-black text-violet-800 transition hover:border-violet-300 hover:bg-violet-100 sm:min-h-0 sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                >
                  <Camera size={15} aria-hidden="true" />

                  {isCameraRunning ? "Stop camera" : "Use camera"}
                </button>
              </div>

              <div
                className={[
                  "mt-3 overflow-hidden rounded-xl bg-stone-950 sm:mt-5 sm:rounded-[24px]",
                  isCameraRunning ? "block" : "hidden",
                ].join(" ")}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="h-[180px] w-full object-cover sm:h-auto sm:aspect-video"
                />
              </div>

              {cameraNotice ? (
                <p className="mt-2 text-[9px] font-semibold leading-4 text-stone-500 sm:mt-3 sm:text-xs sm:leading-5">
                  {cameraNotice}
                </p>
              ) : null}

              {error ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-[10px] font-semibold leading-4 text-red-700 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
                  <CircleAlert
                    size={16}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              ) : null}

              {success ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-2.5 text-[10px] font-semibold leading-4 text-emerald-800 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{success}</span>
                </div>
              ) : null}

              {privacyHolds.length ? (
                <div className="mt-3 sm:mt-5">
                  <MediaPrivacyHoldPanel holds={privacyHolds} scope="host" />
                </div>
              ) : null}
            </div>

            <aside className="border-t border-violet-200 bg-[#F1EDFF] p-3 sm:p-6 xl:border-l xl:border-t-0 xl:p-7">
              <div className="flex items-center gap-2 text-stone-950">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-600 text-white sm:h-10 sm:w-10 sm:rounded-2xl">
                  <ShieldCheck size={17} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-violet-700 sm:text-[10px]">
                    AFTER THE SCAN
                  </p>
                  <h2 className="text-sm font-black text-stone-950 sm:text-base">
                    What happens next
                  </h2>
                </div>
              </div>

              <p className="mt-2 text-[9.5px] font-semibold leading-[14px] text-stone-600 sm:mt-3 sm:text-sm sm:font-medium sm:leading-6">
                <span className="sm:hidden">
                  EPANTRY checks the barcode first. New products need clear pack
                  photos before listing.
                </span>
                <span className="hidden sm:inline">
                  EPANTRY checks whether the barcode already matches a product.
                  New products need clear pack photos and review before they can
                  be listed.
                </span>
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 xl:grid-cols-1 xl:gap-3">
                {[
                  {
                    title: "Existing product",
                    text: "Continue to Pricing & Stock.",
                    tone: "border-emerald-200 bg-emerald-50",
                  },
                  {
                    title: "New product",
                    text: "Add clear product and pack photos.",
                    tone: "border-sky-200 bg-sky-50",
                  },
                  {
                    title: "Product review",
                    text: "EPANTRY checks new product details before listing.",
                    tone: "border-violet-200 bg-violet-50",
                  },
                  {
                    title: "Next workspace",
                    text: "Continue in Listing Studio when review is needed.",
                    tone: "border-cyan-200 bg-cyan-50",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className={`flex gap-2 rounded-xl border p-2 sm:gap-3 sm:rounded-2xl sm:p-3 ${item.tone}`}
                  >
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-emerald-700 sm:h-[17px] sm:w-[17px]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[9.5px] font-black leading-3 text-stone-900 sm:text-xs sm:leading-4">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[8.5px] font-semibold leading-[12px] text-stone-500 sm:mt-1 sm:text-[11px] sm:leading-4">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section className="ep-scan-experience" aria-labelledby="ep-scan-title">
          <div className="ep-scan-main">
            <div className="ep-scan-heading">
              <div className="ep-scan-kicker">
                <span className="ep-scan-kicker-line" /> EPANTRY / Product
                finder
              </div>
              <h1 id="ep-scan-title">
                Scan a product<span className="ep-scan-period">.</span>
              </h1>
              <p>
                <span className="ep-scan-desktop-lede">
                  Find out what a barcode belongs to, explore verified product
                  information, and discover what's available on EPANTRY.
                </span>
                <span className="ep-scan-mobile-lede">
                  Find products by barcode on EPANTRY.
                </span>
              </p>
            </div>

            <div className="ep-scan-console" aria-label="Barcode scanner">
              <div className="ep-scan-console-header">
                <div>
                  <span className="ep-scan-eyebrow">YOUR FIRST STEP</span>
                  <h2>Find by barcode</h2>
                </div>
                <span className="ep-scan-number">01 / 02</span>
              </div>
              <p className="ep-scan-console-intro">
                Enter the number beneath the barcode, or let your camera read
                it.
              </p>

              <div className="ep-scan-fields">
                <label className="ep-scan-field ep-scan-barcode-field">
                  <span className="ep-scan-field-label">Barcode number</span>
                  <span className="ep-scan-input-shell">
                    <Barcode size={21} strokeWidth={1.75} aria-hidden="true" />
                    <input
                      value={barcodeInput}
                      onChange={(event) => setBarcodeInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !isResolvingBarcode) {
                          event.preventDefault();
                          resolveCode(barcodeInput, "manual");
                        }
                      }}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Enter barcode digits"
                    />
                  </span>
                </label>
                <label className="ep-scan-field ep-scan-market-field">
                  <span className="ep-scan-field-label">Market</span>
                  <input
                    value={market}
                    onChange={(event) =>
                      setMarket(event.target.value.toUpperCase().slice(0, 10))
                    }
                    maxLength={10}
                    aria-label="Market code"
                  />
                </label>
              </div>

              <div className="ep-scan-actions">
                <button
                  type="button"
                  className="ep-scan-primary focus-ring"
                  disabled={isResolvingBarcode}
                  onClick={() => resolveCode(barcodeInput, "manual")}
                >
                  {isResolvingBarcode ? (
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Search size={19} aria-hidden="true" />
                  )}
                  {isResolvingBarcode ? "Finding product…" : "Find product"}
                  {!isResolvingBarcode && (
                    <ArrowRight size={18} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className="ep-scan-secondary focus-ring"
                  onClick={isCameraRunning ? stopCamera : startCamera}
                >
                  <Camera size={19} aria-hidden="true" />
                  {isCameraRunning ? "Stop camera" : "Use camera"}
                </button>
              </div>
              <p className="ep-scan-field-note">
                Your barcode is checked against available product records. No
                item is added automatically.
              </p>

              <div
                className={`ep-scan-camera ${
                  isCameraRunning ? "ep-scan-camera-on" : ""
                }`}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="ep-scan-video"
                />
              </div>
              {cameraNotice ? (
                <p className="ep-scan-feedback ep-scan-note" role="status">
                  {cameraNotice}
                </p>
              ) : null}
              {error ? (
                <div className="ep-scan-feedback ep-scan-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}
              {success ? (
                <div className="ep-scan-feedback ep-scan-success" role="status">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>{success}</span>
                </div>
              ) : null}
              {privacyHolds.length ? (
                <div className="ep-scan-privacy">
                  <MediaPrivacyHoldPanel
                    holds={privacyHolds}
                    scope="customer"
                  />
                </div>
              ) : null}
            </div>

            <div className="ep-scan-bottom-note">
              <ShieldCheck size={20} strokeWidth={1.7} aria-hidden="true" />
              <span>
                Verified listings and unverified references are clearly
                distinguished after lookup.
              </span>
            </div>
          </div>

          <aside
            className="ep-scan-guide"
            aria-label="What happens after scanning"
          >
            <div className="ep-scan-guide-heading">
              <span className="ep-scan-eyebrow">02 / AFTER THE SCAN</span>
              <h2>
                From barcode to
                <br />
                the right product.
              </h2>
              <p>
                The result tells you what was found—and what you can do next.
              </p>
            </div>
            <div className="ep-scan-journey">
              {[
                {
                  number: "01",
                  title: "Verified on EPANTRY",
                  text: "A catalog match opens the published product information.",
                },
                {
                  number: "02",
                  title: "Other product matches",
                  text: "Unverified external matches stay clearly marked as references.",
                },
                {
                  number: "03",
                  title: "Find and open a product",
                  text: "Browse available EPANTRY options and open the relevant product listing.",
                },
              ].map((step) => (
                <div key={step.number} className="ep-scan-journey-step">
                  <span className="ep-scan-step-number">{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="ep-scan-guide-footer">
              <span className="ep-scan-guide-tip">A BETTER SCAN</span>
              <p>
                Keep the barcode flat, well-lit and fully inside your camera
                frame.
              </p>
            </div>
          </aside>
          <style>{String.raw`
            .ep-scan-page { color: #202421; font-family: 'Plus Jakarta Sans', Inter, sans-serif; }
            .ep-scan-experience { display: grid; grid-template-columns: minmax(0, 1.48fr) minmax(400px, .82fr); width: 100%; background: #F7F6F2; min-width: 0; overflow: hidden; border-top: 3px solid #173F35; }
            .ep-scan-main { min-width: 0; padding: clamp(28px, 3.2vw, 48px) clamp(20px, 4.2vw, 72px) 32px; }
            .ep-scan-kicker { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 13px; line-height: 1.5; color: #173F35; }
            .ep-scan-kicker-line { width: 26px; height: 2px; background: #C56C42; display: inline-block; }
            .ep-scan-heading h1 { margin: 13px 0 13px; color: #202421; font-size: clamp(34px, 3.5vw, 52px); line-height: 1.12; letter-spacing: -.043em; font-weight: 700; }
            .ep-scan-period { color: #C56C42; }
            .ep-scan-heading > p { max-width: 610px; font-size: 16px; font-weight: 400; line-height: 1.65; color: #515A55; }
            .ep-scan-mobile-lede { display: none; }
            .ep-scan-console { margin-top: 30px; padding: 25px 28px 24px; background: #FFFFFF; border: 1px solid #D7DDCF; border-top: 4px solid #173F35; border-radius: 3px; }
            .ep-scan-console-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
            .ep-scan-eyebrow { color: #C56C42; font-weight: 700; font-size: 12px; letter-spacing: .075em; line-height: 1.4; }
            .ep-scan-console-header h2 { margin-top: 7px; font-size: 25px; line-height: 1.2; letter-spacing: -.028em; font-weight: 650; color: #202421; }
            .ep-scan-number { font-size: 13px; color: #173F35; font-weight: 650; padding-bottom: 4px; white-space: nowrap; }
            .ep-scan-console-intro { font-size: 14px; color: #5B645E; line-height: 1.65; margin-top: 10px; }
            .ep-scan-fields { display: grid; grid-template-columns: minmax(0, 1fr) 112px; align-items: end; gap: 13px; margin-top: 26px; }
            .ep-scan-field { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
            .ep-scan-field-label { color: #202421; font-size: 14px; line-height: 1.4; font-weight: 650; }
            .ep-scan-input-shell { min-width: 0; width: 100%; height: 54px; padding: 0 14px; display: flex; align-items: center; gap: 12px; border: 1px solid #C9CFC6; border-radius: 6px; background: #F7F6F2; color: #173F35; }
            .ep-scan-input-shell:focus-within { border-color: #173F35; outline: 3px solid #D7DDCF; outline-offset: 1px; }
            .ep-scan-input-shell input { background: transparent; border: none; outline: none; min-width: 0; width: 100%; font-size: 16px; color: #202421; font-weight: 500; }
            .ep-scan-input-shell input::placeholder { color: #6D746E; font-weight: 400; }
            .ep-scan-market-field input { width: 100%; height: 54px; text-align: center; padding: 0 10px; background: #F7F6F2; color: #173F35; font-weight: 700; font-size: 16px; border: 1px solid #C9CFC6; border-radius: 6px; outline: none; }
            .ep-scan-market-field input:focus { border-color: #173F35; outline: 3px solid #D7DDCF; outline-offset: 1px; }
            .ep-scan-actions { display: flex; align-items: stretch; gap: 12px; margin-top: 15px; }
            .ep-scan-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 50px; padding: 12px 18px; border-radius: 5px; font-size: 15px; font-weight: 650; line-height: 1.3; transition: background .15s ease, border-color .15s ease; }
            .ep-scan-primary { flex: 1.1; background: #173F35; color: #FFFFFF; border: 1px solid #173F35; }
            .ep-scan-primary:hover:not(:disabled) { background: #235547; }
            .ep-scan-primary:disabled { opacity: .55; cursor: not-allowed; }
            .ep-scan-secondary { flex: .9; background: #FFFFFF; color: #173F35; border: 1px solid #173F35; }
            .ep-scan-secondary:hover { background: #F1F3EE; }
            .ep-scan-actions button:focus-visible { outline: 3px solid #C56C42; outline-offset: 3px; }
            .ep-scan-field-note { color: #626A63; font-size: 13px; line-height: 1.55; margin-top: 17px; }
            .ep-scan-camera { display: none; margin-top: 20px; background: #202421; padding: 8px; border-radius: 8px; }
            .ep-scan-camera-on { display: block; }
            .ep-scan-video { width: 100%; height: auto; max-height: 350px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 4px; }
            .ep-scan-feedback { display: flex; align-items: flex-start; gap: 10px; padding: 13px 14px; margin-top: 14px; font-size: 14px; line-height: 1.55; border-left: 3px solid; }
            .ep-scan-error { color: #8A2D29; background: #FFF0ED; border-color: #C56C42; }
            .ep-scan-success { color: #173F35; background: #EFF5EE; border-color: #173F35; }
            .ep-scan-note { color: #515A55; background: #F1F3EE; border-color: #D7DDCF; }
            .ep-scan-privacy { margin-top: 16px; }
            .ep-scan-bottom-note { display: flex; align-items: center; gap: 12px; color: #4D5C52; max-width: 680px; margin-top: 25px; font-size: 14px; line-height: 1.55; }
            .ep-scan-bottom-note svg { flex: 0 0 auto; color: #173F35; }
            .ep-scan-guide { display: flex; min-width: 0; flex-direction: column; padding: clamp(28px, 3.2vw, 48px) clamp(22px, 2.9vw, 42px) 30px; background: #D7DDCF; border-left: 1px solid #C2CABD; }
            .ep-scan-guide-heading h2 { margin-top: 13px; color: #173F35; font-weight: 650; font-size: clamp(26px, 2.5vw, 35px); line-height: 1.23; letter-spacing: -.035em; }
            .ep-scan-guide-heading > p { max-width: 400px; margin-top: 10px; font-size: 15px; line-height: 1.55; color: #4C5A51; }
            .ep-scan-journey { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; margin-top: 22px; border-top: 1px solid #B6C1B2; }
            .ep-scan-journey-step { display: block; min-width: 0; padding: 14px 0 12px; border-bottom: 1px solid #B6C1B2; }
            .ep-scan-step-number { display: block; font-size: 14px; font-weight: 700; color: #C56C42; margin-bottom: 7px; }
            .ep-scan-journey-step h3 { color: #173F35; font-size: 15px; line-height: 1.35; font-weight: 650; }
            .ep-scan-journey-step p { font-size: 13px; color: #4C5A51; line-height: 1.55; margin-top: 5px; }
            .ep-scan-guide-footer { margin-top: auto; padding-top: 20px; }
            .ep-scan-guide-tip { display: inline-block; color: #173F35; font-size: 12px; font-weight: 700; letter-spacing: .08em; }
            .ep-scan-guide-footer p { margin-top: 7px; font-size: 14px; line-height: 1.55; color: #4C5A51; }
            .ep-scan-result { border-color: #D7DDCF !important; border-radius: 6px !important; background: #FFFFFF !important; box-shadow: none !important; margin-top: 22px !important; }
            @media (max-width: 1024px) {
              .ep-scan-experience { grid-template-columns: minmax(0, 1fr); }
              .ep-scan-guide { border-left: 0; border-top: 1px solid #C2CABD; }
              .ep-scan-journey { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 22px; }
            }
            @media (max-width: 640px) {
              /* Customer scan: reclaim only this page's outer mobile gutters. */
              .ep-scan-page { width: calc(100% + 12px); max-width: none; margin-inline: -6px; }
              .ep-scan-experience { width: 100%; }
              .ep-scan-main { padding: 27px 10px 26px; }
              .ep-scan-heading h1 { margin-top: 12px; font-size: 34px; }
              .ep-scan-heading > p { font-size: 13px; line-height: 1.4; }
              .ep-scan-desktop-lede { display: none; }
              .ep-scan-mobile-lede { display: block; white-space: nowrap; font-size: clamp(11px, 3.3vw, 13px); letter-spacing: -.02em; }
              .ep-scan-console { margin-top: 25px; padding: 20px 12px 19px; }
              .ep-scan-console-intro, .ep-scan-field-note { display: none; }
              .ep-scan-console-header h2 { font-size: 22px; }
              .ep-scan-fields { gap: 10px; grid-template-columns: minmax(0, 1fr) 75px; margin-top: 18px; }
              .ep-scan-input-shell { height: 49px; padding: 0 10px; gap: 7px; }
              .ep-scan-market-field input { height: 49px; padding: 0 4px; font-size: 14px; }
              .ep-scan-input-shell input { font-size: 14px; }
              .ep-scan-actions { gap: 9px; }
              .ep-scan-actions button { font-size: 13px; gap: 7px; padding: 12px 9px; min-height: 46px; }
              .ep-scan-bottom-note { margin-top: 19px; font-size: 13px; }
              .ep-scan-guide { padding: 27px 12px 30px; }
              .ep-scan-guide-heading h2 { margin-top: 10px; font-size: 27px; }
              .ep-scan-journey { display: block; margin-top: 20px; }
              .ep-scan-journey-step { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 14px 0; }
              .ep-scan-step-number { margin-bottom: 0; }
              .ep-scan-journey-step p { font-size: 14px; }
              .ep-scan-guide-footer { padding-top: 19px; }
              .ep-scan-result { padding: 18px !important; }
            }
            @media (prefers-reduced-motion: reduce) {
              .ep-scan-actions button { transition: none; }
            }
          `}</style>
        </section>
      )}

      {barcodeResolution ? (
        <section
          className={`mt-3 rounded-[20px] border p-3 shadow-sm sm:mt-5 sm:rounded-[28px] sm:p-7 ${
            !hostMode ? "ep-scan-result" : ""
          } ${
            hostMode && !canonicalProduct
              ? "border-amber-200 bg-[#FFF9EE]"
              : "border-stone-200 bg-white"
          }`}
        >
          <VerificationBanner
            resolution={barcodeResolution}
            hostMode={hostMode}
          />

          {canonicalProduct ? (
            <div className="mt-5 grid gap-5 md:grid-cols-[140px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-2xl bg-stone-100">
                {canonicalProduct.image?.url ? (
                  <img
                    src={canonicalProduct.image.url}
                    alt={
                      canonicalProduct.image.alt || canonicalProduct.displayName
                    }
                    className="aspect-square h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-square place-items-center text-stone-400">
                    <Barcode size={30} aria-hidden="true" />
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                  {canonicalProduct.brand?.name || "Canonical product"}
                </p>

                <h2 className="mt-1 text-2xl font-black text-stone-950">
                  {canonicalProduct.displayName}
                </h2>

                <p className="mt-2 text-sm text-stone-500">
                  GTIN {canonicalProduct.gtin || "not displayed"}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to={`/products/${encodeURIComponent(
                      canonicalProduct.productVersionId || canonicalProduct.id
                    )}/passport`}
                    className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-700 hover:border-emerald-300 hover:text-emerald-800"
                  >
                    Open Product Passport
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>

                  {hostMode ? (
                    <Link
                      to={`/host/marketplace?packId=${encodeURIComponent(
                        canonicalProduct.packId || ""
                      )}`}
                      className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800"
                    >
                      <PackagePlus size={17} aria-hidden="true" />
                      Continue to pricing & stock
                    </Link>
                  ) : searchQuery ? (
                    <Link
                      to={`/grocery?q=${encodeURIComponent(searchQuery)}`}
                      className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800"
                    >
                      <Search size={17} aria-hidden="true" />
                      Search EPANTRY
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : externalCandidate ? (
            <>
              <ExternalProductDetails candidate={externalCandidate} />

              {!hostMode && searchQuery ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <p className="font-black text-emerald-950">
                      Want to buy this on EPANTRY?
                    </p>

                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      Search the marketplace for this product or close matches.
                      External scan data does not mean an EPANTRY listing
                      already exists.
                    </p>
                  </div>

                  <Link
                    to={`/grocery?q=${encodeURIComponent(searchQuery)}`}
                    className="focus-ring mt-3 inline-flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800 sm:mt-0"
                  >
                    <Search size={17} aria-hidden="true" />
                    Search EPANTRY
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="font-black text-stone-900">
                No product details were found for this barcode.
              </p>

              <p className="mt-2 text-sm leading-6 text-stone-600">
                {hostMode
                  ? "Add clear pack photos below so EPANTRY can review this new product."
                  : "Try searching EPANTRY using the product or brand name printed on the pack."}
              </p>
            </div>
          )}
        </section>
      ) : null}

      {hostMode && barcodeResolution && !canonicalProduct ? (
        <section className="mt-3 rounded-[20px] border border-emerald-200 bg-[#EAFBF3] p-3 shadow-sm sm:mt-5 sm:rounded-[28px] sm:p-7">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white sm:h-10 sm:w-10 sm:rounded-2xl">
              <ImagePlus size={18} aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700 sm:text-xs">
                COMPLETE NEW PRODUCT
              </p>

              <h2 className="mt-0.5 text-[17px] font-black leading-5 text-stone-950 sm:mt-1 sm:text-xl sm:leading-normal">
                Add the details needed for review
              </h2>

              <p className="mt-1 max-w-3xl text-[10px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:font-normal sm:leading-6">
                Add clear pack photos and copy the label details below. EPANTRY
                checks them before this product can be listed.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {[
              {
                number: "1",
                title: "Add photos",
                text: "Upload clear pack and label photos.",
                tone: "border-sky-200 bg-sky-50",
                numberTone: "bg-sky-600",
              },
              {
                number: "2",
                title: "Check details",
                text: "Confirm the name, pack and label facts.",
                tone: "border-violet-200 bg-violet-50",
                numberTone: "bg-violet-600",
              },
              {
                number: "3",
                title: "Add food info",
                text: "Fill nutrition, allergens and Veg / Non-veg.",
                tone: "border-cyan-200 bg-cyan-50",
                numberTone: "bg-cyan-700",
              },
              {
                number: "4",
                title: "Send for review",
                text: "Then continue in Listing Studio.",
                tone: "border-emerald-200 bg-emerald-50",
                numberTone: "bg-emerald-700",
              },
            ].map((step) => (
              <div
                key={step.number}
                className={`rounded-xl border p-2 sm:rounded-2xl sm:p-3 ${step.tone}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-black text-white sm:h-6 sm:w-6 sm:text-[10px] ${step.numberTone}`}
                  >
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[14px] text-stone-900 sm:text-xs sm:leading-4">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[8.5px] font-semibold leading-3 text-stone-500 sm:mt-1 sm:text-[11px] sm:leading-4">
                      {step.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 xl:mt-5 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] xl:gap-5">
            <div className="rounded-[18px] border border-sky-200 bg-[#EAF5FF] p-3 sm:rounded-[24px] sm:p-5">
              <p className="text-[12px] font-black text-stone-950 sm:text-sm">
                Product photos
              </p>
              <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:mt-1 sm:text-xs sm:leading-5">
                Add the clearest pack panels so the review team can verify the
                label.
              </p>

              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:mt-4 sm:gap-3">
                <select
                  value={evidencePurpose}
                  onChange={(event) => setEvidencePurpose(event.target.value)}
                  className="min-w-0 rounded-xl border border-sky-200 bg-white px-2.5 py-2 text-[10px] font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                >
                  {EVIDENCE_PURPOSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <label className="focus-ring inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2 text-[10px] font-black text-white hover:bg-sky-800 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
                  <Upload size={15} aria-hidden="true" />
                  Add photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    multiple
                    onChange={addEvidenceFiles}
                    className="sr-only"
                  />
                </label>
              </div>

              {evidenceFiles.length ? (
                <div className="mt-2 space-y-1.5 sm:mt-4 sm:space-y-2">
                  {evidenceFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white/90 p-2 sm:gap-3 sm:rounded-2xl sm:p-3"
                    >
                      <ImagePlus
                        size={15}
                        className="shrink-0 text-sky-700"
                        aria-hidden="true"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-black text-stone-800 sm:text-xs">
                          {item.file.name}
                        </p>
                        <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-[11px]">
                          {EVIDENCE_PURPOSES.find(
                            (purpose) => purpose.value === item.purpose
                          )?.label || item.purpose}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeEvidence(item.id)}
                        className="focus-ring grid h-7 w-7 place-items-center rounded-full text-stone-400 hover:bg-white hover:text-red-600 sm:h-8 sm:w-8"
                        aria-label="Remove image"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-[18px] border border-violet-200 bg-[#F2EEFF] p-3 sm:rounded-[24px] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-black text-stone-950 sm:text-sm">
                    Product details
                  </p>
                  <p className="mt-0.5 max-w-2xl text-[9px] font-semibold leading-4 text-stone-500 sm:mt-1 sm:text-xs sm:leading-5">
                    Check the scan and complete the information printed on the
                    pack before review.
                  </p>
                </div>
                <span className="rounded-full border border-violet-200 bg-white/80 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-violet-700 sm:text-[9px]">
                  Pack details
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4">
                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Product name
                  </span>
                  <input
                    value={hints.title}
                    onChange={(event) =>
                      setHints((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Brand name
                  </span>
                  <input
                    value={hints.brandName}
                    onChange={(event) =>
                      setHints((current) => ({
                        ...current,
                        brandName: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Printed pack size
                  </span>
                  <input
                    value={hints.netQuantityText}
                    onChange={(event) =>
                      setHints((current) => ({
                        ...current,
                        netQuantityText: event.target.value,
                      }))
                    }
                    placeholder="250 ml"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Country of origin
                  </span>
                  <input
                    value={reviewDetails.countryOfOrigin}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        countryOfOrigin: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="col-span-2 min-w-0 sm:col-span-1">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Manufacturer / Packer
                  </span>
                  <input
                    value={reviewDetails.manufacturerName}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        manufacturerName: event.target.value,
                      }))
                    }
                    placeholder="Printed manufacturer or packer"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="col-span-2 min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Ingredients
                  </span>
                  <textarea
                    rows={2}
                    maxLength={10000}
                    value={reviewDetails.ingredientDeclarationText}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        ingredientDeclarationText: event.target.value,
                      }))
                    }
                    placeholder="Copy the ingredients from the pack"
                    className="mt-1.5 w-full resize-y rounded-xl border border-violet-200 bg-white px-2.5 py-2 text-[10px] font-semibold leading-4 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm sm:leading-5"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Contains allergens
                  </span>
                  <input
                    value={reviewDetails.containsAllergens}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        containsAllergens: event.target.value,
                      }))
                    }
                    placeholder="Milk, Soy"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    May contain
                  </span>
                  <input
                    value={reviewDetails.mayContainAllergens}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        mayContainAllergens: event.target.value,
                      }))
                    }
                    placeholder="Nuts, Gluten"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="col-span-2 min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Printed allergen statement
                  </span>
                  <input
                    value={reviewDetails.allergenStatement}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        allergenStatement: event.target.value,
                      }))
                    }
                    placeholder="Example: Contains milk and soy"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 rounded-[16px] border border-cyan-200 bg-[#EAFBFD] p-2.5 sm:mt-5 sm:rounded-2xl sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black text-stone-900 sm:text-xs">
                      Nutrition
                    </p>
                    <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[10px]">
                      Enter only values printed on the pack.
                    </p>
                  </div>

                  <select
                    value={reviewDetails.nutritionBasis}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        nutritionBasis: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-[9px] font-black outline-none sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                  >
                    <option value="per_100g">Per 100 g</option>
                    <option value="per_100ml">Per 100 ml</option>
                    <option value="per_serving">Per serving</option>
                    <option value="per_pack">Per pack</option>
                  </select>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
                  {REVIEW_NUTRIENTS.map(([key, label, unit]) => (
                    <label key={key} className="min-w-0">
                      <span className="block truncate text-[7.5px] font-black uppercase tracking-[0.04em] text-stone-500 sm:text-[9px]">
                        {label} ({unit})
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={reviewDetails.nutrients[key]}
                        onChange={(event) =>
                          setReviewDetails((current) => ({
                            ...current,
                            nutrients: {
                              ...current.nutrients,
                              [key]: event.target.value,
                            },
                          }))
                        }
                        className="mt-1 h-8 w-full min-w-0 rounded-lg border border-cyan-200 bg-white px-2 text-[9px] font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
                  <label className="min-w-0">
                    <span className="text-[8px] font-black text-stone-500 sm:text-[10px]">
                      Serving size
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={reviewDetails.servingSizeValue}
                      onChange={(event) =>
                        setReviewDetails((current) => ({
                          ...current,
                          servingSizeValue: event.target.value,
                        }))
                      }
                      className="mt-1 h-8 w-full rounded-lg border border-cyan-200 bg-white px-2 text-[9px] font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                    />
                  </label>

                  <label className="min-w-0">
                    <span className="text-[8px] font-black text-stone-500 sm:text-[10px]">
                      Serving unit
                    </span>
                    <select
                      value={reviewDetails.servingSizeUnit}
                      onChange={(event) =>
                        setReviewDetails((current) => ({
                          ...current,
                          servingSizeUnit: event.target.value,
                        }))
                      }
                      className="mt-1 h-8 w-full rounded-lg border border-cyan-200 bg-white px-2 text-[9px] font-bold outline-none sm:mt-2 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="piece">piece</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-3 rounded-[16px] border border-emerald-200 bg-[#ECF9F2] p-2.5 sm:mt-4 sm:rounded-2xl sm:p-4">
                <p className="text-[10px] font-black text-stone-900 sm:text-xs">
                  Dietary details
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3">
                  <label className="min-w-0">
                    <span className="text-[8px] font-black text-stone-500 sm:text-[10px]">
                      Veg / Non-veg
                    </span>
                    <select
                      value={reviewDetails.dietaryType}
                      onChange={(event) =>
                        setReviewDetails((current) => ({
                          ...current,
                          dietaryType: event.target.value,
                        }))
                      }
                      className="mt-1 h-8 w-full rounded-lg border border-emerald-200 bg-white px-2 text-[9px] font-bold outline-none sm:mt-2 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                    >
                      <option value="not_declared">Not declared</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="non_vegetarian">Non-vegetarian</option>
                    </select>
                  </label>

                  <label className="flex min-w-0 items-end">
                    <span className="flex h-8 w-full items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2 text-[9px] font-black text-stone-600 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs">
                      <input
                        type="checkbox"
                        checked={reviewDetails.glutenFree}
                        onChange={(event) =>
                          setReviewDetails((current) => ({
                            ...current,
                            glutenFree: event.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 accent-emerald-700 sm:h-4 sm:w-4"
                      />
                      Gluten free
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                disabled={isCreatingNpi || !evidenceFiles.length}
                onClick={createHostDraft}
                className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-5 sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3.5 sm:text-sm"
              >
                {isCreatingNpi ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <PackagePlus size={17} aria-hidden="true" />
                )}

                {isCreatingNpi
                  ? uploadProgress
                    ? `Uploading ${uploadProgress.completed}/${uploadProgress.total} photos…`
                    : "Preparing review…"
                  : "Send product for review"}
              </button>

              {hostNpiResult ? (
                <Link
                  to="/host/listings/new"
                  className="focus-ring mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-[10px] font-black text-emerald-800 hover:bg-emerald-50 sm:mt-3 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                >
                  Open Listing Studio
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
