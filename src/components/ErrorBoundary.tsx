import { Component, type ErrorInfo, type ReactNode } from "react";

// ══════════════════════════════════════
// ErrorBoundary — ошибка отрисовки вместо чёрного экрана
// ══════════════════════════════════════
// Исключение при рендере React размонтирует всё дерево — остаётся пустой фон
// без единого сообщения. Здесь его ловим и показываем текст ошибки, стек
// компонентов и кнопку перезагрузки. Стили — инлайн: тема могла не примениться.

interface State {
  error: Error | null;
  componentStack: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crashed", error, info.componentStack);

    this.setState({ componentStack: info.componentStack ?? "" });
  }

  render() {
    const { error, componentStack } = this.state;

    if (!error) return this.props.children;

    return (
      <div style={{ height: "100vh", overflow: "auto", padding: 24, background: "#0d1117", color: "#e6edf3", font: "13px/1.5 -apple-system, sans-serif" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#f85149" }}>Ошибка интерфейса</div>
        <pre style={pre}>{`${error.name}: ${error.message}\n\n${error.stack ?? ""}`}</pre>
        {componentStack && <pre style={pre}>{componentStack.trim()}</pre>}
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid #30363d", background: "#21262d", color: "#e6edf3", cursor: "pointer" }}
        >
          Перезагрузить
        </button>
      </div>
    );
  }
}

const pre: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: 12,
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 6,
  padding: 12,
  marginTop: 8,
  userSelect: "text",
};
