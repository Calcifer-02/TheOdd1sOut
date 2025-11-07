import { useState } from 'react';
import { Panel, Typography, Button, Input } from '@maxhub/max-ui';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

interface DeadlinePickerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate?: Date;
    selectedTime: string;
    onDateChange: (date: Date | undefined) => void;
    onTimeChange: (time: string) => void;
}

export const DeadlinePicker = ({
                                   isOpen,
                                   onClose,
                                   selectedDate,
                                   selectedTime,
                                   onDateChange,
                                   onTimeChange,
                               }: DeadlinePickerProps) => {
    const [tempDate, setTempDate] = useState<Date | undefined>(selectedDate);
    const [tempTime, setTempTime] = useState(selectedTime);

    const handleApply = () => {
        onDateChange(tempDate);
        onTimeChange(tempTime);
        onClose();
    };

    const handleClear = () => {
        setTempDate(undefined);
        setTempTime('');
        onDateChange(undefined);
        onTimeChange('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'flex-end',
                paddingTop: '60px',
            }}
            onClick={onClose}
        >
            <Panel
                mode="primary"
                style={{
                    width: '100%',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
                    <Typography.Headline>Выбор дедлайна</Typography.Headline>
                </div>
                <div style={{ padding: '16px' }}>
                    <Button
                        appearance="neutral"
                        mode="secondary"
                        size="large"
                        stretched
                        onClick={handleClear}
                        style={{ marginBottom: '16px' }}
                    >
                        Без срока
                    </Button>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '16px',
                    }}>
                        <style>{`
              .rdp-root {
                --rdp-accent-color: #007aff;
                --rdp-accent-background-color: #007aff;
                --rdp-day-height: 44px;
                --rdp-day-width: 44px;
                --rdp-day_button-border-radius: 100%;
                --rdp-day_button-border: 2px solid transparent;
                --rdp-day_button-height: 42px;
                --rdp-day_button-width: 42px;
                --rdp-selected-border: 2px solid #007aff;
                --rdp-disabled-opacity: 0.5;
                --rdp-outside-opacity: 0.75;
                --rdp-today-color: #007aff;
              }
              .rdp {
                --rdp-cell-size: 40px;
                --rdp-accent-color: #007aff;
                --rdp-background-color: #007aff;
                margin: 0;
              }
              .rdp-months {
                justify-content: center;
              }
              .rdp-month {
                width: 100%;
                max-width: 320px;
              }
              .rdp-caption {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 8px;
                margin-bottom: 8px;
                position: relative;
              }
              .rdp-caption_label {
                flex: 1;
                justify-content: center;
                text-align: center;
                z-index: 1;
              }
              .rdp-nav {
                position: absolute;
                width: 100%;
                display: flex;
                justify-content: space-between;
                top: 0;
                left: 0;
                right: 0;
                z-index: 2;
              }
              .rdp-nav_button {
                cursor: pointer;
                background: white;
                border: none;
                padding: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 3;
              }
              .rdp-nav_button:hover {
                background-color: #EFF6FF;
                border-radius: 8px;
              }
              .rdp-nav_button:disabled {
                opacity: 0.3;
                cursor: not-allowed;
              }
              .rdp-day_button {
                -webkit-tap-highlight-color: transparent;
                tap-highlight-color: transparent;
              }
              .rdp-day_button:active::before,
              .rdp-day_button:focus::before {
                display: none !important;
              }
              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                background-color: #EFF6FF;
              }
              .rdp-day_selected .rdp-day_button,
              .rdp-day_selected .rdp-day_button:hover,
              .rdp-day_selected .rdp-day_button:focus,
              .rdp-day_selected .rdp-day_button:active {
                background-color: #007aff !important;
                color: white !important;
                font-weight: normal !important;
                border: none !important;
                outline: none !important;
                box-shadow: none !important;
              }
              .rdp-day_selected {
                background-color: transparent !important;
              }
              .rdp-day_today:not(.rdp-day_selected) .rdp-day_button {
                font-weight: bold;
                color: #007aff;
                background-color: transparent;
              }
              .rdp-day_today.rdp-day_selected .rdp-day_button {
                background-color: #007aff !important;
                color: white !important;
                font-weight: normal !important;
              }
            `}</style>
                        <DayPicker
                            mode="single"
                            selected={tempDate}
                            onSelect={setTempDate}
                            locale={ru}
                            disabled={{ before: new Date() }}
                        />
                    </div>

                    {tempDate && (
                        <div style={{ marginBottom: '16px' }}>
                            <Input
                                mode="primary"
                                type="time"
                                placeholder="Время (необязательно)"
                                value={tempTime}
                                onChange={(e) => setTempTime(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                    )}

                    <Button
                        appearance="themed"
                        mode="primary"
                        size="large"
                        stretched
                        onClick={handleApply}
                    >
                        Готово
                    </Button>
                </div>
            </Panel>
        </div>
    );
};