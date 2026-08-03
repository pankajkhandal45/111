import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught app error:", error, errorInfo);
  }

  private handleReload = () => {
    window.sessionStorage.removeItem("page_has_been_reloaded");
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-6 text-center">
          <div className="text-4xl mb-4">♔</div>
          <h1 className="text-2xl font-bold mb-2">App Reload Required</h1>
          <p className="text-slate-400 text-sm max-w-xs mb-6">
            Naya update aaya hai ya network connection slow tha. App ko reload karein.
          </p>
          <Button onClick={this.handleReload} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Reload App
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
