"use client";

import React, { type ComponentType, type ReactNode } from "react";

export interface WithErrorBoundaryOptions {
  fallback?: (error: Error) => ReactNode;
}

interface ErrorBoundaryProps {
  fallback?: (error: Error) => ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Boundary de clase: React 18 exige una clase para `getDerivedStateFromError`.
 * Captura crashes de render del componente envuelto y muestra `fallback(error)`
 * o el panel por defecto.
 */
class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;

    if (error) {
      if (this.props.fallback) return this.props.fallback(error);
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
            <h2 className="text-2xl font-black text-[#E21B3C] mb-4">
              Algo salió mal
            </h2>
            <p className="text-gray-600">Recarga la página para continuar.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Decorator (US-14): envuelve `ComponentType<P>` con captura de errores de render. */
export function withErrorBoundary<P extends object>(
  Wrapped: ComponentType<P>,
  options?: WithErrorBoundaryOptions
): ComponentType<P> {
  function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={options?.fallback}>
        <Wrapped {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundary.displayName = `withErrorBoundary(${
    Wrapped.displayName || Wrapped.name || "Component"
  })`;

  return WithErrorBoundary;
}
