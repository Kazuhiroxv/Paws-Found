<?php
/**
 * Notifications.
 *
 *   GET   /api/notifications            the signed-in account's notifications
 *   PATCH /api/notifications/7          mark one as read
 *   PATCH /api/notifications            mark them all as read
 *
 * A notification always belongs to exactly one account, and an account only
 * ever sees its own. The user id is taken from the session, never from the
 * request — otherwise anyone could read anyone else's by changing a number.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function handle_notifications(string $method, ?string $identifier): never
{
    $user = require_login();

    if ($method === 'GET' && $identifier === null) {
        notifications_list($user);
    }

    if ($method === 'PATCH' && $identifier === null) {
        notifications_mark_all_read($user);
    }

    if ($method === 'PATCH' && ctype_digit((string) $identifier)) {
        notification_mark_read($user, (int) $identifier);
    }

    json_error('No such endpoint.', 404);
}

function notifications_list(array $user): never
{
    $where = ['n.user_id = :user_id'];
    $params = [':user_id' => $user['user_id']];

    if (query_string_param('unread') === 'true') {
        $where[] = 'n.is_read = FALSE';
    }

    $clause = ' WHERE ' . implode(' AND ', $where);

    $statement = db()->prepare(
        "SELECT n.notification_id, n.notification_type, n.title, n.body,
                n.report_id, n.match_id, n.is_read, n.created_at
           FROM notifications n
           {$clause}
           ORDER BY n.created_at DESC, n.notification_id DESC"
    );
    $statement->execute($params);
    $rows = $statement->fetchAll();

    // The unread badge needs the count of everything unread, not of this page.
    $unread = db()->prepare(
        'SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = FALSE'
    );
    $unread->execute([':user_id' => $user['user_id']]);

    json_response([
        'data' => array_map(fn ($row) => [
            'notification_id' => (int) $row['notification_id'],
            'type' => $row['notification_type'],
            'title' => $row['title'],
            'body' => $row['body'],
            'report_id' => $row['report_id'] === null ? null : (int) $row['report_id'],
            'match_id' => $row['match_id'] === null ? null : (int) $row['match_id'],
            'is_read' => (bool) $row['is_read'],
            'created_at' => $row['created_at'],
        ], $rows),
        'meta' => ['unread' => (int) $unread->fetchColumn()],
    ]);
}

function notification_mark_read(array $user, int $id): never
{
    // The user id in the WHERE clause is what stops one account marking
    // another account's notifications as read.
    $statement = db()->prepare(
        'UPDATE notifications SET is_read = TRUE
          WHERE notification_id = :id AND user_id = :user_id'
    );
    $statement->execute([':id' => $id, ':user_id' => $user['user_id']]);

    if ($statement->rowCount() === 0) {
        json_error('That notification does not exist.', 404);
    }

    activity_log((int) $user['user_id'], 'notification_read', 'notification', $id);

    notifications_list($user);
}

function notifications_mark_all_read(array $user): never
{
    $statement = db()->prepare(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = :user_id AND is_read = FALSE'
    );
    $statement->execute([':user_id' => $user['user_id']]);

    // Only when something was unread: pressing it on an empty list did nothing.
    if ($statement->rowCount() > 0) {
        activity_log((int) $user['user_id'], 'notifications_all_read', null, null, $statement->rowCount() . ' marked read');
    }

    notifications_list($user);
}
