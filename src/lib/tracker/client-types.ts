/** Shapes the tracker API returns, derived from the serializers so the two cannot drift. */
import type { serializeAccount, serializeItem, serializePerson, serializePhase, serializeRemark } from "./serialize";
import type { getProjectDetail, listPortfolio } from "./project-service";

export type AccountDTO = ReturnType<typeof serializeAccount> & { projectCount?: number; peopleCount?: number };
export type PersonDTO = ReturnType<typeof serializePerson>;
export type PhaseDTO = ReturnType<typeof serializePhase>;
export type ItemDTO = ReturnType<typeof serializeItem>;
export type RemarkDTO = ReturnType<typeof serializeRemark>;
export type ProjectDetailDTO = Awaited<ReturnType<typeof getProjectDetail>>;
export type PortfolioProjectDTO = Awaited<ReturnType<typeof listPortfolio>>[number];
export type ProjectDTO = ProjectDetailDTO["project"];
export type ProjectSummaryDTO = ProjectDetailDTO["summary"];
