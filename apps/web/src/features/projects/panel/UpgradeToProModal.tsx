import { useState } from "react";

import { useToast } from "../../../components/Toast";

const FEATURES = [
  "Create unlimited Projects",
  "Invite unlimited guests to collaborate without creating an account",
  "Sync instantly with Trello, Jira, Asana, and Slack",
  "500GB of secure cloud space for all your files",
];

const MONTHLY_PRICE_PER_SEAT = 15;
const ANNUAL_DISCOUNT = 0.16;

// Full pricing page, reached from the footer's own "Upgrade to Pro" button (as
// opposed to ProFeatureModal's smaller "you just tried something Pro" teaser) -
// static only, same as every other pro-gated surface in this pass: no real billing
// integration exists yet, "Upgrade Now" doesn't charge anything.
export function UpgradeToProModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [billing, setBilling] = useState<"monthly" | "annually">("monthly");
  const [seats, setSeats] = useState(1);

  const monthlyTotal = MONTHLY_PRICE_PER_SEAT * seats;
  const fullAnnualTotal = monthlyTotal * 12;
  const discountedAnnualTotal = Math.round(fullAnnualTotal * (1 - ANNUAL_DISCOUNT));
  const totalAmount = billing === "monthly" ? monthlyTotal : discountedAnnualTotal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade to Pro"
        onClick={(event) => event.stopPropagation()}
        className="bg-bg-surface flex w-full max-w-md flex-col gap-5 rounded-xl p-6 dark:bg-[#14141A]"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">Upgrade to Pro</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-muted text-xl leading-none">
            ×
          </button>
        </div>

        <div className="bg-bg-canvas flex rounded-lg p-1 text-sm font-medium">
          <button
            onClick={() => setBilling("monthly")}
            aria-pressed={billing === "monthly"}
            className={`flex-1 rounded-md py-2 ${
              billing === "monthly" ? "bg-bg-surface shadow dark:bg-[#14141A]" : "text-text-muted"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annually")}
            aria-pressed={billing === "annually"}
            className={`flex-1 rounded-md py-2 ${
              billing === "annually" ? "bg-bg-surface shadow dark:bg-[#14141A]" : "text-text-muted"
            }`}
          >
            Annually <span className="text-accent-primary">Save {ANNUAL_DISCOUNT * 100}%</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-muted text-xs font-medium">Cost</p>
            <p className="text-2xl font-bold">
              ${MONTHLY_PRICE_PER_SEAT} <span className="text-text-muted text-sm font-normal">/month/user</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-text-muted text-xs font-medium">Seats</span>
            <select
              value={seats}
              onChange={(event) => setSeats(Number(event.target.value))}
              aria-label="Number of seats"
              className="rounded-md border border-black/10 px-2 py-1.5 text-sm dark:border-white/10 dark:bg-transparent"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} user{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10">
          <p className="text-sm font-semibold">What you get</p>
          <ul className="flex flex-col gap-1.5">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
          <div>
            <p className="text-text-muted text-xs font-medium">Total Amount</p>
            <p className="text-lg font-bold">
              ${totalAmount.toFixed(2)}{" "}
              {billing === "annually" && (
                <span className="text-text-muted text-sm font-normal line-through">
                  ${fullAnnualTotal.toFixed(2)}
                </span>
              )}{" "}
              <span className="text-text-muted text-sm font-normal">
                (Billed {billing === "annually" ? "annually" : "monthly"})
              </span>
            </p>
          </div>
          <button
            onClick={() => toast("Billing isn't wired up yet - coming soon.", "warning")}
            className="from-accent-primary rounded-lg bg-gradient-to-r to-fuchsia-500 px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}
