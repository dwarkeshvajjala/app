import { STATUS_COLORS, STATUS_LABELS, WORKFLOW_STATUSES } from "../../../lib/workflow";
import * as api from "../api";

export function StatusSelect({ ticket, disabled, onChange }: { ticket: api.Ticket; disabled: boolean; onChange: (status: api.Ticket["status"]) => void }) {
  return <select className="bl-status-select" style={{ borderLeftColor: STATUS_COLORS[ticket.status] }} aria-label={`Status for ${ticket.body.slice(0, 40)}`} value={ticket.status} disabled={disabled} onChange={(e) => onChange(e.target.value as api.Ticket["status"])}>{WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>;
}
