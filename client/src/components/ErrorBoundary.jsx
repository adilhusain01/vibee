import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('Error Boundary caught an error:', error, errorInfo);

    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Optional: Send error to logging service
    if (process.env.NODE_ENV === 'production') {
      // Report error to monitoring service
      console.error('Production error:', {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="items-center justify-center p-4">
          <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 text-center">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            {/* Error Title */}
            <h2 className="text-xl font-bold text-white mb-2">
              Something went wrong
            </h2>

            {/* Error Description */}
            <p className="text-white/70 mb-6">
              We encountered an unexpected error. This has been logged and we're working to fix it.
            </p>

            {/* Development Error Details */}
            {isDevelopment && this.state.error && (
              <div className="bg-black/20 rounded-lg p-3 mb-6 text-left">
                <p className="text-red-400 text-xs font-mono mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <details className="text-white/60 text-xs">
                    <summary className="cursor-pointer">Component Stack</summary>
                    <pre className="mt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw size={16} />
                Try Again
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <Home size={16} />
                Go Home
              </button>
            </div>

            {/* Help Text */}
            <p className="text-white/50 text-xs mt-4">
              If this problem persists, please contact support
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for functional components
export const withErrorBoundary = (Component, fallback) => {
  return function WithErrorBoundaryComponent(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

export default ErrorBoundary;