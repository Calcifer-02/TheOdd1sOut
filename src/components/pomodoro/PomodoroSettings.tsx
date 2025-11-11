import { Settings, Clock, Coffee, Repeat } from 'lucide-react';
import styles from './PomodoroSettings.module.css';

interface PomodoroSettingsProps {
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
  onFocusChange: (value: number) => void;
  onBreakChange: (value: number) => void;
  onCyclesChange: (value: number) => void;
  disabled: boolean;
}

export default function PomodoroSettings({
  focusMinutes,
  breakMinutes,
  cycles,
  onFocusChange,
  onBreakChange,
  onCyclesChange,
  disabled,
}: PomodoroSettingsProps) {
  return (
    <div className={styles.settingsPanel}>
      <h3 className={styles.settingsTitle}>
        <Settings size={20} className={styles.settingsTitleIcon} />
        Настройки таймера
      </h3>

      <div className={styles.settingItem}>
        <label className={styles.settingLabel}>
          <Clock size={18} className={styles.labelIcon} />
          Время фокуса: <strong>{focusMinutes} мин</strong>
        </label>
        <input
          type="range"
          min="1"
          max="60"
          step="1"
          value={focusMinutes}
          onChange={(e) => onFocusChange(Number(e.target.value))}
          disabled={disabled}
          className={styles.slider}
        />
      </div>

      <div className={styles.settingItem}>
        <label className={styles.settingLabel}>
          <Coffee size={18} className={styles.labelIcon} />
          Время перерыва: <strong>{breakMinutes} мин</strong>
        </label>
        <input
          type="range"
          min="1"
          max="15"
          step="1"
          value={breakMinutes}
          onChange={(e) => onBreakChange(Number(e.target.value))}
          disabled={disabled}
          className={styles.slider}
        />
      </div>

      <div className={styles.settingItem}>
        <label className={styles.settingLabel}>
          <Repeat size={18} className={styles.labelIcon} />
          Количество циклов: <strong>{cycles}</strong>
        </label>
        <input
          type="range"
          min="1"
          max="8"
          step="1"
          value={cycles}
          onChange={(e) => onCyclesChange(Number(e.target.value))}
          disabled={disabled}
          className={styles.slider}
        />
      </div>
    </div>
  );
}

