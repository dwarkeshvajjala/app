import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as workspaceApi from "../workspaces/api";

interface MentionsInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  // M-06: notified server-side by stable member id, not by re-parsing "@Name" out of
  // the body text later (names aren't unique or stable - a later rename or a same-
  // named member would misfire). Called once per picker selection with the accumulated
  // set of member ids inserted into this draft; the caller resets it when the draft is
  // cleared/submitted (CommentThreadPanel.tsx).
  onMentionedIdsChange?: (memberIds: string[]) => void;
}

export function MentionsInput({ onMentionedIdsChange, ...props }: MentionsInputProps) {
  const { workspaceSlug } = useParams();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionedIdsRef = useRef<Set<string>>(new Set());

  const [mentionState, setMentionState] = useState<{ active: boolean; query: string; startIndex: number; top: number; left: number } | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => {
      const ws = await workspaceApi.listWorkspaces();
      return ws.find(w => w.slug === workspaceSlug);
    },
    enabled: !!workspaceSlug
  });

  const membersQuery = useQuery({
    queryKey: ['members', workspaceQuery.data?.id],
    queryFn: () => workspaceApi.listMembers(workspaceQuery.data!.id),
    enabled: !!workspaceQuery.data?.id,
  });

  const members = membersQuery.data || [];
  const filteredMembers = members.filter(m => 
    (m.name || "").toLowerCase().includes(mentionState?.query.toLowerCase() || "") ||
    (m.email || "").toLowerCase().includes(mentionState?.query.toLowerCase() || "")
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionState) return;
    if (e.key === 'Escape') {
      setMentionState(null);
      e.preventDefault();
    } else if (e.key === 'Enter' && filteredMembers.length > 0) {
      insertMention(filteredMembers[0]);
      e.preventDefault();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    props.onChange(e);
    
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    
    // Check if we just typed `@`
    const textBeforeCursor = value.slice(0, cursor);
    const match = textBeforeCursor.match(/@([\w-]*)$/);
    
    if (match) {
      // Crude approximation of cursor position
      setMentionState({
        active: true,
        query: match[1],
        startIndex: match.index!,
        top: 20, // would ideally calculate cursor coordinates
        left: 20,
      });
    } else {
      setMentionState(null);
    }
  }

  function insertMention(member: workspaceApi.MemberOut) {
    if (!mentionState || !textareaRef.current) return;
    
    const before = props.value.slice(0, mentionState.startIndex);
    const after = props.value.slice(textareaRef.current.selectionStart);
    
    const mentionText = `@${member.name || member.email} `;

    const syntheticEvent = {
      target: { value: before + mentionText + after }
    } as React.ChangeEvent<HTMLTextAreaElement>;

    props.onChange(syntheticEvent);
    mentionedIdsRef.current.add(member.user_id);
    onMentionedIdsChange?.(Array.from(mentionedIdsRef.current));
    setMentionState(null);
    
    // Focus back on textarea and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = before.length + mentionText.length;
        textareaRef.current.selectionEnd = before.length + mentionText.length;
      }
    }, 0);
  }

  return (
    <div className="relative w-full">
      <textarea
        {...props}
        ref={textareaRef}
        onChange={handleChange}
        onKeyDown={(e) => {
          handleKeyDown(e);
          if (props.onKeyDown) props.onKeyDown(e);
        }}
      />
      
      {mentionState && filteredMembers.length > 0 && (
        <div 
          className="absolute z-50 bg-bg-surface border border-black/10 dark:border-white/10 rounded-md shadow-lg py-1 max-h-48 overflow-y-auto"
          style={{ top: "100%", left: 0, minWidth: "200px" }}
        >
          {filteredMembers.map(m => (
            <button
              key={m.id}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => insertMention(m)}
              type="button"
            >
              {m.name || m.email}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
