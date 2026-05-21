import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Wallet, X } from "lucide-react";

const DISMISS_STORAGE_KEY = "moneymates_income_prank_dismissed_until";
const CELEBRATED_STORAGE_KEY = "moneymates_income_celebrated_v2";
const SNOOZE_HOURS = 18;

type Step = {
  title: string;
  body: string;
  options: {
    label: string;
    next: "step1" | "step2" | "income" | "stubborn" | "close";
    tone: "primary" | "secondary" | "ghost";
  }[];
};

const STORY: Record<"step0" | "step1" | "step2", Step> = {
  step0: {
    title: "Real talk — are you a chicken? 🐔",
    body: "Because adding your income takes 30 seconds and the courage of a baked bean.",
    options: [
      { label: "Bawk bawk 🐔", next: "step1", tone: "secondary" },
      { label: "No, I'm brave 💪", next: "step1", tone: "primary" },
    ],
  },
  step1: {
    title: "Then why haven't you added your income? 👀",
    body: "Your dashboard is judging you. Quietly. With charts.",
    options: [
      { label: "I forgot 😅", next: "step2", tone: "secondary" },
      { label: "Mind your business 🙄", next: "step2", tone: "ghost" },
      { label: "I don't earn 😭", next: "step2", tone: "secondary" },
    ],
  },
  step2: {
    title: "Want to earn more? 💰",
    body: "Step 1: know what you actually make. Step 2: brag in dashboard charts. Add your income and we'll throw confetti.",
    options: [
      { label: "Fine, take me there 💸", next: "income", tone: "primary" },
      { label: "Nope, I'll stay broke 😤", next: "stubborn", tone: "ghost" },
    ],
  },
};

const STUBBORN_LINES = [
  "Oh you stubborn 😣 child. I'll ask again tomorrow.",
  "Fine, walk away. Your bank account will remember this. 📒",
  "Stubborn detected. 🚪 Recalibrating sass levels.",
  "Pretending to ignore me won't pause your subscriptions, hon. 💸",
  "Walking past income like it's an ex at a wedding. Bold. 🚶",
];

function pickStubborn() {
  return STUBBORN_LINES[Math.floor(Math.random() * STUBBORN_LINES.length)];
}

function isDismissedNow() {
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

function snoozeBanner(hours = SNOOZE_HOURS) {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + hours * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}

function alreadyCelebrated() {
  try {
    return window.localStorage.getItem(CELEBRATED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markCelebrated() {
  try {
    window.localStorage.setItem(CELEBRATED_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

function Confetti() {
  const pieces = useMemo(() => {
    const emojis = ["🎉", "💸", "💰", "🥳", "✨", "🪙", "🤑", "🫡"];
    return Array.from({ length: 28 }).map((_, index) => ({
      id: index,
      emoji: emojis[index % emojis.length],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.8}s`,
      duration: `${2.4 + Math.random() * 1.4}s`,
      size: `${18 + Math.random() * 18}px`,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="mm-confetti"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            fontSize: piece.size,
          }}
        >
          {piece.emoji}
        </span>
      ))}
    </div>
  );
}

type Props = {
  hasIncome: boolean;
  ready: boolean;
};

export function IncomePrankBanner({ hasIncome, ready }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"hidden" | "step0" | "step1" | "step2" | "stubborn" | "celebrate">("hidden");
  const [stubbornLine, setStubbornLine] = useState(() => pickStubborn());
  const [shake, setShake] = useState(false);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (decidedRef.current) return;
    // Debounce the first decision so transient flickers in hasIncome during the
    // initial data load don't briefly show the wrong card.
    const timeout = window.setTimeout(() => {
      if (decidedRef.current) return;
      decidedRef.current = true;
      if (hasIncome) {
        if (!alreadyCelebrated()) setStep("celebrate");
      } else if (!isDismissedNow()) {
        setStep("step0");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [ready, hasIncome]);

  const dismissCelebrate = () => {
    markCelebrated();
    setStep("hidden");
  };

  useEffect(() => {
    if (step === "hidden") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleDismiss();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (step === "hidden") return null;

  const handleDismiss = () => {
    if (step === "celebrate") {
      dismissCelebrate();
      return;
    }
    setStubbornLine(pickStubborn());
    setStep("stubborn");
    snoozeBanner();
  };

  const handleNo = () => {
    // Make a tiny prank: shake the panel before showing the stubborn message
    setShake(true);
    window.setTimeout(() => {
      setShake(false);
      setStubbornLine(pickStubborn());
      setStep("stubborn");
      snoozeBanner();
    }, 320);
  };

  const handleOption = (next: Step["options"][number]["next"]) => {
    if (next === "income") {
      snoozeBanner(2); // small snooze so the banner doesn't reappear if navigation is slow
      setStep("hidden");
      navigate("/budget?add=income");
      return;
    }
    if (next === "stubborn") {
      handleNo();
      return;
    }
    if (next === "close") {
      handleDismiss();
      return;
    }
    setStep(next);
  };

  if (step === "celebrate") {
    return createPortal(
      <>
        <Confetti />
        <div
          className="mm-dialog-overlay fixed inset-0 z-[55] flex items-center justify-center bg-moss/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Income added"
          onClick={dismissCelebrate}
        >
          <div
            className="mm-dialog-panel relative w-full max-w-sm rounded-3xl border border-moss/30 bg-white p-6 text-center shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="absolute right-3 top-3 rounded-xl border border-sage p-1.5 text-ink/60 hover:bg-mist"
              aria-label="Close"
              onClick={dismissCelebrate}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mm-salute-pop text-6xl leading-none">🫡</div>
            <h2 className="mt-4 text-2xl font-bold tracking-tightish text-ink">Income locked in.</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Salute, brave human. The dashboard finally knows what you're working with. Now go build that wealth-build rate.
            </p>
            <div className="mt-5 flex justify-center gap-2 text-2xl">
              <span className="mm-wiggle" style={{ animationDelay: "0s" }}>🎉</span>
              <span className="mm-wiggle" style={{ animationDelay: "0.15s" }}>💸</span>
              <span className="mm-wiggle" style={{ animationDelay: "0.3s" }}>🥳</span>
              <span className="mm-wiggle" style={{ animationDelay: "0.45s" }}>💰</span>
            </div>
            <button
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-moss px-4 py-2 text-sm font-bold text-white shadow-elevated hover:bg-navy"
              onClick={dismissCelebrate}
            >
              Let's go, captain
            </button>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  if (step === "stubborn") {
    return createPortal(
      <div
        className="mm-dialog-overlay fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Stubborn child message"
        onClick={() => setStep("hidden")}
      >
        <div
          className="mm-dialog-panel relative w-full max-w-sm rounded-3xl border border-sage bg-white p-6 text-center shadow-soft"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="text-5xl leading-none">😣</div>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-coral">Oh you stubborn child</p>
          <h2 className="mt-2 text-xl font-bold tracking-tightish text-ink">{stubbornLine}</h2>
          <p className="mt-3 text-xs leading-5 text-ink/55">
            I'll go pout in the corner. Snoozed for the next {SNOOZE_HOURS} hours.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-sage bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-mist"
              onClick={() => setStep("hidden")}
            >
              Fine, leave me alone
            </button>
            <button
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-moss px-3 py-2 text-sm font-semibold text-white shadow-elevated hover:bg-navy"
              onClick={() => {
                snoozeBanner(2);
                setStep("hidden");
                navigate("/budget?add=income");
              }}
            >
              Ugh, ok, take me there
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const current = STORY[step];
  const stepIndex = step === "step0" ? 0 : step === "step1" ? 1 : 2;

  return createPortal(
    <div
      className="mm-dialog-overlay fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prank-banner-title"
      onClick={handleDismiss}
    >
      <div
        className={`mm-dialog-panel relative w-full max-w-md rounded-3xl border border-sage bg-white p-6 shadow-soft ${shake ? "mm-shake" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="absolute right-3 top-3 rounded-xl border border-sage p-1.5 text-ink/60 hover:bg-mist"
          aria-label="Skip questionnaire"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-mint">
            <Wallet className="h-5 w-5 text-moss" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
              Friendly nag · {stepIndex + 1} of 3
            </p>
            <h2 id="prank-banner-title" className="mt-1 text-xl font-bold tracking-tightish text-ink">
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">{current.body}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {current.options.map((option) => (
            <button
              key={option.label}
              onClick={() => handleOption(option.next)}
              className={
                option.tone === "primary"
                  ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-moss px-4 py-2 text-sm font-bold text-white shadow-elevated transition hover:bg-navy"
                  : option.tone === "secondary"
                    ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-sage bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                    : "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-ink/60 transition hover:bg-sage/40"
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-ink/45">
          <div className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={`h-1.5 w-6 rounded-full ${dot <= stepIndex ? "bg-moss" : "bg-sage/70"}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <button className="font-semibold text-ink/45 hover:text-ink/70" onClick={handleDismiss}>
            Skip for now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
