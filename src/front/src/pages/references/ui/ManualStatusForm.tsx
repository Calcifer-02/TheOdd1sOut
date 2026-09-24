/**
 * Ручной ввод статуса полигона — объявленный запасной путь к автоматическому
 * сбору (R-044): когда сообщение источника не распознано либо источник
 * недоступен, статус ставит менеджер данных.
 *
 * Перечень статусов — из договора (`LandfillStatus`); выдумывать
 * «приостановлен» нельзя, служба такой запрос отклоняет. Основание
 * необязательно, но передаётся, когда названо: запись без основания не
 * объясняет сама себя.
 *
 * @req: R-044
 * @adr: ADR-0008
 */
import { useState } from 'react';
import { STATUS_WORD } from '@/entities/landfill';
import { Button, Field, Notice, RadioPills, Select } from '@/shared/ui';
import type { LandfillStatus } from '@/shared/api/contracts';
import type { Landfill } from '@/shared/api/references';

/**
 * Слова статусов берутся у сущности «полигон»: значок в списке и выбор в
 * редакторе обязаны называть одно состояние одинаково.
 */
const STATUS_OPTIONS: { value: LandfillStatus; label: string }[] = [
  { value: 'active', label: STATUS_WORD.active },
  { value: 'blocked', label: STATUS_WORD.blocked },
  { value: 'unconfirmed', label: STATUS_WORD.unconfirmed },
];

export type ManualStatusFormProps = {
  /** Полигоны на выбор. Пустой перечень означает, что полигон уже назван. */
  landfills: Landfill[];
  /** Полигон, статус которого ставится. */
  landfillId: string | null;
  onPickLandfill?: (landfillId: string) => void;
  busy?: boolean;
  disabled?: boolean;
  refusal?: string | null;
  onSave: (status: LandfillStatus, reason: string) => Promise<boolean>;
  onDone?: () => void;
};

export function ManualStatusForm({
  landfills,
  landfillId,
  onPickLandfill,
  busy = false,
  disabled = false,
  refusal = null,
  onSave,
  onDone,
}: ManualStatusFormProps) {
  const [status, setStatus] = useState<LandfillStatus>('active');
  const [reason, setReason] = useState('');

  return (
    <form
      className="imolt-references-form"
      onSubmit={event => {
        event.preventDefault();

        if (landfillId === null) {
          return;
        }

        void onSave(status, reason).then(accepted => {
          if (accepted) {
            setReason('');
            onDone?.();
          }
        });
      }}
    >
      {onPickLandfill !== undefined && (
        <Select
          id="manual-status-landfill"
          label="Полигон"
          value={landfillId ?? ''}
          options={landfills.map(landfill => ({ value: landfill.id, label: landfill.name }))}
          onPick={onPickLandfill}
        />
      )}

      <RadioPills
        name="manual-status"
        label="Статус полигона"
        className="imolt-units"
        options={STATUS_OPTIONS}
        value={status}
        onPick={setStatus}
      />

      <Field
        id="manual-status-reason"
        label="Основание"
        value={reason}
        onChange={setReason}
        hint="Чем подтверждён статус: письмо полигона, публикация, звонок"
      />

      {refusal !== null && <Notice kind="error">{refusal}</Notice>}

      <Button type="submit" disabled={disabled || busy || landfillId === null}>
        Задать статус
      </Button>
    </form>
  );
}
