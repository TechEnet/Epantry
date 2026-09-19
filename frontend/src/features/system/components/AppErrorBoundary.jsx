import React from 'react'

export default class AppErrorBoundary extends React.Component {
  constructor(
    props,
  ) {
    super(
      props,
    )

    this.state = {
      hasError:
        false,
    }
  }

  static getDerivedStateFromError() {
    return {
      hasError:
        true,
    }
  }

  componentDidCatch(
    error,
    info,
  ) {
    console.error(
      'EPANTRY render error',
      error,
      info,
    )
  }

  render() {
    if (
      this.state.hasError
    ) {
      return (
        <main className="page-shell py-16">
          <div
            className="surface-card mx-auto max-w-xl p-6 text-center"
            role="alert"
            aria-live="assertive"
          >
            <h1 className="text-xl font-semibold">
              Something went wrong
            </h1>

            <p className="mt-2 text-sm text-stone-600">
              This screen could not be rendered safely. Reload the
              application. If the problem continues, operational data
              may be temporarily unavailable rather than authoritative.
            </p>

            <button
              type="button"
              className="focus-ring mt-5 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white"
              onClick={() =>
                window.location.reload()
              }
            >
              Reload
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}