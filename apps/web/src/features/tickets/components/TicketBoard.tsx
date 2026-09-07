import { useState } from "react";
import { STATUS_COLORS, STATUS_LABELS, WORKFLOW_STATUSES } from "../../../lib/workflow";
import * as api from "../api";
import { StatusSelect } from "./StatusSelect";
import type { TicketUpdateMutation } from "./types";

export function TicketBoard({ tickets, update, onOpen }: { tickets: api.Ticket[]; update: TicketUpdateMutation; onOpen: (id: string) => void }) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  return (
    <div className="bl-board">
      {WORKFLOW_STATUSES.map((s) => (
        <section
          key={s}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.setAttribute('data-dragover', 'true');
          }}
          onDragLeave={(e) => {
            e.currentTarget.removeAttribute('data-dragover');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.removeAttribute('data-dragover');
            const id = e.dataTransfer.getData("text/plain");
            if (id && id !== draggedId) {
              const ticket = tickets.find(t => t.id === id);
              if (ticket && ticket.status !== s) {
                update.mutate({ id, patch: { status: s } });
              }
            }
            setDraggedId(null);
          }}
        >
          <h2>
            <i className="bl-dot" style={{ background: STATUS_COLORS[s] }} />
            {STATUS_LABELS[s]} <span>{tickets.filter((t) => t.status === s).length}</span>
          </h2>
          {tickets
            .filter((t) => t.status === s)
            .map((t) => (
              <article
                key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", t.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedId(t.id);
                  // small timeout to allow drag image to render before styling source
                  setTimeout(() => e.target && (e.target as HTMLElement).classList.add("bl-dragging"), 0);
                }}
                onDragEnd={(e) => {
                  setDraggedId(null);
                  e.currentTarget.classList.remove("bl-dragging");
                }}
              >
                <small>{t.project_name}</small>
                <button className="bl-ticket-title" onClick={() => onOpen(t.id)}>
                  {t.body}
                </button>
                <div className="bl-chip-row">
                  {t.tags?.map((tag) => (
                    <span className="bl-chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <StatusSelect
                  ticket={t}
                  disabled={update.isPending}
                  onChange={(status) => update.mutate({ id: t.id, patch: { status } })}
                />
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}
