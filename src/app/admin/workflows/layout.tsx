/** Everything under Workflow Builder (the list and the editor) reads in Inter. `contents` keeps the wrapper out of the page layout. */
export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return <div className="font-workflow contents">{children}</div>;
}
