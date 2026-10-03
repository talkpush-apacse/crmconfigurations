"use client";

import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type WorkflowErrorBoundaryProps = {
  children: ReactNode;
};

type WorkflowErrorBoundaryState = {
  hasError: boolean;
};

export default class WorkflowErrorBoundary extends Component<
  WorkflowErrorBoundaryProps,
  WorkflowErrorBoundaryState
> {
  state: WorkflowErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): WorkflowErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[workflow editor error boundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Workflow editor crashed
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Your browser hit an editor error. Return to the dashboard and open
              the workflow again.
            </p>
            <Button asChild variant="cta" className="mt-5">
              <Link href="/admin/workflows">Return to Dashboard</Link>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
