/**
 * Items a client adds through their private link are visible straight away, but they
 * do not count toward project health until staff have looked at them.
 * "Needs review" = created by a client and not yet marked reviewed.
 */
export function needsStaffReview(item: { createdVia: string; staffReviewedAt: Date | string | null | undefined }): boolean {
  return item.createdVia === "client" && !item.staffReviewedAt;
}
