import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class NotificationsService {
  constructor(private readonly ds: DataSource) {}

  private wrap(data: unknown) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  async findAll(userId: string, query?: { type?: string; isRead?: string }) {
    let sql = `SELECT id, type, title, body AS message, entity_type AS entityType,
               entity_id AS entityId, is_read AS isRead, created_at AS createdAt
               FROM notifications WHERE user_id = @0`;
    const params: unknown[] = [userId];
    let idx = 1;

    if (query?.type) {
      sql += ` AND type = @${idx}`;
      params.push(query.type);
      idx++;
    }
    if (query?.isRead !== undefined) {
      sql += ` AND is_read = @${idx}`;
      params.push(query.isRead === 'true' ? 1 : 0);
      idx++;
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.ds.query(sql, params);
    return this.wrap(rows.map((r: Record<string, unknown>) => ({ ...r, isRead: !!r.isRead })));
  }

  async unreadCount(userId: string) {
    const [row] = await this.ds.query(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = @0 AND is_read = 0',
      [userId],
    );
    return this.wrap(Number(row?.cnt ?? 0));
  }

  async markAsRead(id: string, userId: string) {
    await this.ds.query(
      'UPDATE notifications SET is_read = 1 WHERE id = @0 AND user_id = @1',
      [id, userId],
    );
    return this.wrap(null);
  }

  async markAllAsRead(userId: string) {
    await this.ds.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = @0 AND is_read = 0',
      [userId],
    );
    return this.wrap(null);
  }
}
