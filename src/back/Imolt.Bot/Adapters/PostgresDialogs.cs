using Dapper;
using Imolt.Bot.Domain;
using Imolt.Bot.Ports;
using Npgsql;

namespace Imolt.Bot.Adapters;

/// Состояние переписок в базе решения (R-080, миграция 0007).
///
/// Переписка хранилищем не является: всё, что обязано пережить удаление
/// сообщения, живёт здесь — какая карточка ведётся, какие сообщения
/// принадлежат боту и показан ли перечень команд (ADR-0009, инвариант 5).
///
/// Связь переписки с участником читается, но не пишется: колонку
/// `subscriber.max_chat_id` заполняет расчётная часть, когда проверит подпись
/// стартовых параметров мини-приложения (R-071). Два писателя в одну запись
/// означали бы, что владельца у неё нет.
///
/// @req: R-080
/// @supports: R-071
/// @adr: ADR-0009
public sealed class PostgresDialogs(NpgsqlDataSource dataSource, TimeProvider time) : IDialogs
{
  public async Task<DialogState> FindAsync(long chatId, CancellationToken cancellationToken)
  {
    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken)
        .ConfigureAwait(false);

    var row = await connection.QuerySingleOrDefaultAsync<DialogRow>(new CommandDefinition(
        """
        select d.chat_id,
               d.card_message_id,
               d.own_message_ids,
               d.commands_announced,
               (select s.id::text from subscriber s where s.max_chat_id = d.chat_id limit 1)
                   as participant_id
          from bot_dialog d
         where d.chat_id = @chatId
        """,
        new { chatId },
        cancellationToken: cancellationToken)).ConfigureAwait(false);

    if (row is null)
    {
      // Переписки в базе ещё нет — это начало разговора, а не поломка. У
      // участника при этом уже может быть учётная запись: он мог войти в
      // мини-приложение до первого сообщения боту.
      var participant = await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
          "select id::text from subscriber where max_chat_id = @chatId limit 1",
          new { chatId },
          cancellationToken: cancellationToken)).ConfigureAwait(false);

      return DialogState.Empty(chatId) with { ParticipantId = participant };
    }

    return new DialogState(
        row.ChatId,
        row.ParticipantId,
        row.CardMessageId,
        row.OwnMessageIds ?? [],
        row.CommandsAnnounced);
  }

  public async Task SaveAsync(DialogState state, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(state);

    await using var connection = await dataSource.OpenConnectionAsync(cancellationToken)
        .ConfigureAwait(false);

    await connection.ExecuteAsync(new CommandDefinition(
        """
        insert into bot_dialog (chat_id, card_message_id, own_message_ids, commands_announced, updated_at)
        values (@chatId, @cardMessageId, @ownMessageIds, @commandsAnnounced, @updatedAt)
        on conflict (chat_id) do update
           set card_message_id    = excluded.card_message_id,
               own_message_ids    = excluded.own_message_ids,
               commands_announced = excluded.commands_announced,
               updated_at         = excluded.updated_at
        """,
        new
        {
          chatId = state.ChatId,
          cardMessageId = state.CardMessageId,
          ownMessageIds = state.OwnMessageIds.ToArray(),
          commandsAnnounced = state.CommandsAnnounced,
          updatedAt = time.GetUtcNow(),
        },
        cancellationToken: cancellationToken)).ConfigureAwait(false);
  }

  /// Строка таблицы `bot_dialog` вместе с прочитанной связью участника.
  private sealed record DialogRow(
      long ChatId,
      string? CardMessageId,
      string[]? OwnMessageIds,
      bool CommandsAnnounced,
      string? ParticipantId);
}
