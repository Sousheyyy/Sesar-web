"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Section error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-destructive/20">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium mb-1">
              Bu bölüm yüklenirken bir hata oluştu
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Lütfen tekrar deneyiniz.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false })}
            >
              Tekrar Dene
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
