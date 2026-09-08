import type { CommentOut } from "../../../board/api";
import { CommentRow } from "./CommentRow";

export interface CommentsListProps {
  isLoading: boolean;
  allThreads: CommentOut[];
  filteredThreads: CommentOut[];
  sortedThreads: CommentOut[];
  displayMode: "comfortable" | "compact";
  groupBy: "none" | "page";
  projectId: string;
  sequenceByCommentId: Map<string, number>;
  onNavigate: (commentId: string) => void;
  selectedCommentId?: string | null;
}

export function CommentsList({
  isLoading,
  allThreads,
  filteredThreads,
  sortedThreads,
  displayMode,
  groupBy,
  projectId,
  sequenceByCommentId,
  onNavigate,
  selectedCommentId,
}: CommentsListProps) {
  return (
    <>
      {isLoading && <p className="text-text-muted text-sm">Loading...</p>}
      {!isLoading && allThreads.length === 0 && (
        <p className="text-text-muted text-sm">No comments on this project yet.</p>
      )}
      {!isLoading && allThreads.length > 0 && filteredThreads.length === 0 && (
        <p className="text-text-muted text-sm">No comments match the current filters.</p>
      )}

      <div className={`flex flex-col ${displayMode === 'compact' ? 'gap-0' : 'gap-2'}`}>
        {(() => {
          if (groupBy === 'none') {
            return sortedThreads.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                projectId={projectId}
                sequenceNumber={sequenceByCommentId.get(comment.id) ?? 0}
                onNavigate={onNavigate}
                selected={comment.id === selectedCommentId}
              />
            ));
          } else {
            // Group by page
            const groups = new Map<string, typeof sortedThreads>();
            for (const comment of sortedThreads) {
              const p = comment.page_id;
              if (!groups.has(p)) groups.set(p, []);
              groups.get(p)!.push(comment);
            }
            return Array.from(groups.entries()).map(([pageId, comments]) => (
              <div key={pageId} className="mb-4">
                <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">
                  Page ID: {pageId}
                </h3>
                <div className={`flex flex-col ${displayMode === 'compact' ? 'gap-0' : 'gap-2'}`}>
                  {comments.map((comment) => (
                    <CommentRow
                      key={comment.id}
                      comment={comment}
                      projectId={projectId}
                      sequenceNumber={sequenceByCommentId.get(comment.id) ?? 0}
                      onNavigate={onNavigate}
                      selected={comment.id === selectedCommentId}
                    />
                  ))}
                </div>
              </div>
            ));
          }
        })()}
      </div>
    </>
  );
}
