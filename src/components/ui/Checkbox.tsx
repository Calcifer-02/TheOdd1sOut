'use client';

import { MouseEvent } from 'react';

interface CheckboxProps {
    checked: boolean;
    // @ts-ignore TS71007
    onChange: (e: MouseEvent<HTMLDivElement>) => void;
    // @ts-ignore TS71007
    onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}


const Checkbox = ({ checked, onChange, onClick }: CheckboxProps) => {
    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        e.stopPropagation(); // Предотвращаем всплытие по умолчанию
        onClick?.(e);
        onChange(e);
    };

    return (
        <div
            onClick={handleClick}
            style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                border: checked ? '2px solid #007AFF' : '2px solid #D1D5DB',
                backgroundColor: checked ? '#007AFF' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
            }}
        >
            {checked && (
                <svg
                    width="14"
                    height="11"
                    viewBox="0 0 14 11"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M1 5.5L5 9.5L13 1.5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </div>
    );
};
export default Checkbox

