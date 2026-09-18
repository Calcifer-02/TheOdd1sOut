import { useEffect, useState } from 'react';

// Плацдарм мини-приложения: экран показывает, что статика отдана и что путь
// до расчётной части через /api жив. Экраны продукта берутся из макетов
// в ux/ по мере реализации пользовательских путей UC-001 — UC-009.

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ready'; service: string; status: string }
  | { kind: 'error'; reason: string };

export function App() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    const abort = new AbortController();

    fetch('/api/health', { signal: abort.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`расчётная часть ответила кодом ${response.status}`);
        }
        return response.json() as Promise<{ service: string; status: string }>;
      })
      .then((body) => setState({ kind: 'ready', service: body.service, status: body.status }))
      .catch((error: unknown) => {
        // Размонтирование компонента прерывает запрос — это не отказ службы.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setState({
          kind: 'error',
          reason: error instanceof Error ? error.message : 'неизвестная причина',
        });
      });

    return () => abort.abort();
  }, []);

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 390,
        margin: '0 auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h1 style={{ fontSize: 24, lineHeight: '30px', margin: 0 }}>ИМОЛТ</h1>
      <p style={{ margin: 0, color: '#707070', fontSize: 14, lineHeight: '20px' }}>
        Плацдарм мини-приложения. Экран проверяет, что статика отдана и расчётная часть отвечает.
      </p>

      {state.kind === 'loading' && <p style={{ margin: 0 }}>Проверяем расчётную часть…</p>}

      {state.kind === 'ready' && (
        <p style={{ margin: 0, color: '#1F8A4C' }}>
          Расчётная часть отвечает: служба «{state.service}», состояние «{state.status}».
        </p>
      )}

      {state.kind === 'error' && (
        <p style={{ margin: 0, color: '#D3321B' }}>
          Расчётная часть недоступна: {state.reason}
        </p>
      )}
    </main>
  );
}
