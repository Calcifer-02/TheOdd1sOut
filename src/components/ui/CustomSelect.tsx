'use client';

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import styles from './CustomSelect.module.css';

interface Option {
    value: string;
    label: string;
    icon?: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    disabled?: boolean;
}

export function CustomSelect({ value, onChange, options, disabled = false }: CustomSelectProps) {
    const selectedOption = options.find(opt => opt.value === value) || options[0];

    return (
        <Listbox value={value} onChange={onChange} disabled={disabled}>
            <div className={styles.selectWrapper}>
                <Listbox.Button className={`${styles.selectButton} ${disabled ? styles.disabled : ''}`}>
                    <span className={styles.selectedValue}>
                        {selectedOption.icon && <span className={styles.icon}>{selectedOption.icon}</span>}
                        {selectedOption.label}
                    </span>
                    <ChevronDown className={styles.chevron} size={20} />
                </Listbox.Button>

                <Transition
                    as={Fragment}
                    leave={styles.transitionLeave}
                    leaveFrom={styles.transitionLeaveFrom}
                    leaveTo={styles.transitionLeaveTo}
                >
                    <Listbox.Options className={styles.options}>
                        {options.map((option) => (
                            <Listbox.Option
                                key={option.value}
                                value={option.value}
                                as={Fragment}
                            >
                                {({ active, selected }) => (
                                    <li
                                        className={`${styles.option} ${active ? styles.optionActive : ''} ${selected ? styles.optionSelected : ''}`}
                                    >
                                        {option.icon && <span className={styles.icon}>{option.icon}</span>}
                                        <span className={styles.optionLabel}>{option.label}</span>
                                        {selected && <Check className={styles.checkIcon} size={18} />}
                                    </li>
                                )}
                            </Listbox.Option>
                        ))}
                    </Listbox.Options>
                </Transition>
            </div>
        </Listbox>
    );
}

