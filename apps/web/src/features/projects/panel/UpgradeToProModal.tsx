import { useState } from "react";

import { Dialog } from "../../../components/Dialog";
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
    <Dialog title="Upgrade to Pro" onClose={onClose}>
      <div className="bl-form">
        <div className="bl-segment" style={{ width: "100%" }}>
          <button type="button" onClick={() => setBilling("monthly")} aria-pressed={billing === "monthly"} style={{ flex: 1 }}>
            Monthly
          </button>
          <button type="button" onClick={() => setBilling("annually")} aria-pressed={billing === "annually"} style={{ flex: 1 }}>
            Annually
            <span style={{ marginLeft: 5, color: "var(--mint-deep)" }}>Save {ANNUAL_DISCOUNT * 100}%</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="bl-mono" style={{ color: "var(--ink-4)" }}>
              Cost
            </p>
            <p style={{ fontSize: 22, fontWeight: 700 }}>
              ${MONTHLY_PRICE_PER_SEAT} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-4)" }}>/month/user</span>
            </p>
          </div>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span className="bl-mono" style={{ color: "var(--ink-4)" }}>
              Seats
            </span>
            <select value={seats} onChange={(event) => setSeats(Number(event.target.value))} aria-label="Number of seats" className="bl-input">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} user{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
          <p className="text-sm font-semibold">What you get</p>
          <ul className="flex flex-col gap-1.5" style={{ marginTop: 8 }}>
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <span className="bl-status-dot" style={{ marginTop: 6, background: "var(--ink-4)" }} />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
          <div>
            <p className="bl-mono" style={{ color: "var(--ink-4)" }}>
              Total amount
            </p>
            <p style={{ fontSize: 15, fontWeight: 700 }}>
              ${totalAmount.toFixed(2)}{" "}
              {billing === "annually" && (
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-4)", textDecoration: "line-through" }}>
                  ${fullAnnualTotal.toFixed(2)}
                </span>
              )}{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-4)" }}>
                (Billed {billing === "annually" ? "annually" : "monthly"})
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => toast("Billing isn't wired up yet - coming soon.", "warning")}
            className="bl-button mint"
          >
            Upgrade now
          </button>
        </div>
      </div>
    </Dialog>
  );
}
