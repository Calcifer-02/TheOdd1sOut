export const TasksSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
            <div
                key={i}
                style={{
                    background: '#F9FAFB',
                    borderRadius: '12px',
                    padding: '16px',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div
                        style={{
                            width: '40px',
                            height: '24px',
                            background: '#E5E7EB',
                            borderRadius: '12px',
                        }}
                    />
                    <div
                        style={{
                            flex: 1,
                            height: '20px',
                            background: '#E5E7EB',
                            borderRadius: '8px',
                        }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '52px' }}>
                    <div
                        style={{
                            width: '80px',
                            height: '16px',
                            background: '#E5E7EB',
                            borderRadius: '6px',
                        }}
                    />
                    <div
                        style={{
                            width: '60px',
                            height: '16px',
                            background: '#E5E7EB',
                            borderRadius: '6px',
                        }}
                    />
                </div>
            </div>
        ))}
        <style>{`
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
    `}</style>
    </div>
);