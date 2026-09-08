import { Avatar } from "@backline/ui";
import type { MemberOut } from "../../workspaces/api";

export function PeoplePicker({ label, members, selected, onChange }: { label: string; members: MemberOut[]; selected: string[]; onChange: (value: string[]) => void }) {
  return (
    <fieldset className="bl-people">
      <legend>{label}</legend>
      {members.map((m) => (
        <label key={m.user_id}>
          <input type="checkbox" checked={selected.includes(m.user_id)} onChange={(e) => onChange(e.target.checked ? [...selected, m.user_id] : selected.filter((id) => id !== m.user_id))} />
          <Avatar name={m.name || m.email} size={16} />
          {m.name || m.email}
        </label>
      ))}
    </fieldset>
  );
}
