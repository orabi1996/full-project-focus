import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ViewErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in View:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = "#dashboard";
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-4 my-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">
              {this.props.fallbackTitle || "حدث خطأ غير متوقع أثناء عرض هذه الصفحة"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              يمكنك إعادة المحاولة أو الانتقال إلى لوحة المؤشرات الرئيسية.
            </p>
            {this.state.error?.message && (
              <div className="mt-3 inline-block rounded-xl bg-card border border-border p-2.5 text-[11px] font-mono text-destructive max-w-xl text-start overflow-auto">
                {this.state.error.message}
              </div>
            )}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              size="sm"
              className="rounded-full text-xs font-bold gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة تحميل المكون
            </Button>
            <Button
              onClick={this.handleReset}
              variant="outline"
              size="sm"
              className="rounded-full text-xs font-bold gap-1.5"
            >
              <Home className="h-4 w-4" />
              الرئيسية
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
