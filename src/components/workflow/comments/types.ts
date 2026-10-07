/** Which step, connector or page the comments view is pointing at. */
export interface CommentTarget {
  pageId: string;
  nodeId: string | null;
  edgeId: string | null;
  /** focus: the panel shows only this one place (opened from a pin). peek: the list stays, this place is highlighted. */
  mode: "focus" | "peek";
  /** Changes on every request, so asking for the same place twice still brings the comments tab forward. */
  nonce: number;
}
