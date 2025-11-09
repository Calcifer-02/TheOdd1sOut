'use client';

import { useRef } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from './store';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';

export function StoreProvider({ children }: { children: React.ReactNode }) {
    const storeRef = useRef<ReturnType<typeof makeStore>>();
    const persistorRef = useRef<ReturnType<typeof persistStore>>();

    if (!storeRef.current) {
        storeRef.current = makeStore();
        persistorRef.current = persistStore(storeRef.current);
    }

    return (
        <Provider store={storeRef.current}>
            <PersistGate loading={null} persistor={persistorRef.current!}>
                {children}
            </PersistGate>
        </Provider>
    );
}

