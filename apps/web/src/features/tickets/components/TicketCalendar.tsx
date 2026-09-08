import { useState, type DragEvent } from "react";
import { STATUS_COLORS } from "../../../lib/workflow";
import * as api from "../api";
import type { TicketUpdateMutation } from "./types";

export function TicketCalendar({ tickets, update, onOpen }: { tickets: api.Ticket[]; update: TicketUpdateMutation; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const first = new Date(month.getFullYear(), month.getMonth(), 1), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first.getDay() + days) / 7) * 7 }, (_, i) => i - first.getDay() + 1);

  // Dropping a ticket on a day (or on "No due date") sets/clears due_at - same
  // draggedId/dataTransfer pattern as TicketBoard's status columns (FD-AUD-034).
  function dropOnDay(key: string | null) {
    return (e: DragEvent) => {
      e.preventDefault();
      e.currentTarget.removeAttribute("data-dragover");
      const id = e.dataTransfer.getData("text/plain");
      const ticket = tickets.find((t) => t.id === id);
      const nextDueAt = key ? `${key}T00:00:00Z` : null;
      if (ticket && (ticket.due_at ?? null) !== nextDueAt) {
        update.mutate({ id, patch: { due_at: nextDueAt } });
      }
      setDraggedId(null);
    };
  }
  function dragOverDay(e: DragEvent) {
    e.preventDefault();
    e.currentTarget.setAttribute("data-dragover", "true");
  }
  function dragLeaveDay(e: DragEvent) {
    e.currentTarget.removeAttribute("data-dragover");
  }
  function ticketChip(t: api.Ticket) {
    return (
      <button
        key={t.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", t.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggedId(t.id);
        }}
        onDragEnd={() => setDraggedId(null)}
        onClick={() => onOpen(t.id)}
        style={{ borderLeftColor: STATUS_COLORS[t.status] }}
        aria-label={`View ticket: ${t.body}`}
        title={`${t.body} · ${t.project_name}`}
        className={draggedId === t.id ? "bl-dragging" : undefined}
      >
        {t.body}
      </button>
    );
  }

  return <section><div className="bl-toolbar"><button className="bl-quiet" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><h2 id="calendar-heading">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><button className="bl-quiet" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button><span className="bl-mono">Dates from the current results page - drag a ticket onto a day to set its due date</span></div><div className="bl-calendar" role="grid" aria-labelledby="calendar-heading"><div role="row">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => <strong key={d} role="columnheader">{d}</strong>)}</div>{Array.from({ length: cells.length / 7 }).map((_, weekIndex) => <div key={weekIndex} role="row">{cells.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, i) => { const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2,'0')}`; const valid = day >= 1 && day <= days; return <div key={i} className={valid ? '' : 'outside'} role="gridcell" aria-label={valid ? key : undefined} onDragOver={valid ? dragOverDay : undefined} onDragLeave={valid ? dragLeaveDay : undefined} onDrop={valid ? dropOnDay(key) : undefined}>{valid && <><span>{day}</span>{tickets.filter((t) => t.due_at?.slice(0,10) === key).map(ticketChip)}</>}</div>; })}</div>)}</div><h2 className="bl-group-title">No due date</h2><div className="bl-chip-row" onDragOver={dragOverDay} onDragLeave={dragLeaveDay} onDrop={dropOnDay(null)}>{tickets.filter((t) => !t.due_at).map((t) => <button className="bl-chip" key={t.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDraggedId(t.id); }} onDragEnd={() => setDraggedId(null)} onClick={() => onOpen(t.id)} aria-label={`View ticket: ${t.body.slice(0,70)}`}>{t.body.slice(0,70)}</button>)}</div></section>;
}
