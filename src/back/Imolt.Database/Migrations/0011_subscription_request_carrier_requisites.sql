-- Реквизиты перевозчика в заявке на подписку (R-051).
--
-- Учётная запись несёт их с первой миграции, а заявка — нет. Учётная запись
-- хранит сегодняшнее состояние и переписывается следующей заявкой; заявка же
-- говорит, что участник сообщил о себе на свою дату, и по ней менеджер решает
-- о подписке.
--
-- Пустое значение допускается и значения по умолчанию нет: «не сообщил» и
-- «сообщил, что документа нет» — разные ответы, и по второму откажут.

alter table subscription_request
  add column if not exists phone text;

alter table subscription_request
  add column if not exists has_transport_license boolean;

alter table subscription_request
  add column if not exists has_sez boolean;

comment on column subscription_request.phone is
  'Телефон перевозчика в каноническом виде +7XXXXXXXXXX (R-051)';

comment on column subscription_request.has_transport_license is
  'Признак лицензии на транспортирование отходов I–IV классов опасности (R-051)';

comment on column subscription_request.has_sez is
  'Признак санитарно-эпидемиологического заключения — условия лицензии с 01.09.2026 (R-051)';
