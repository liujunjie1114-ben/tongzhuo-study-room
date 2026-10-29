import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
 code: text('code').primaryKey(), duration: integer('duration').notNull().default(1500),
 remaining: integer('remaining').notNull().default(1500), endsAt: integer('ends_at'),
 phase: text('phase').notNull().default('focus'), runId: text('run_id'), createdAt: integer('created_at').notNull(),
});
export const members = sqliteTable('members', {
 token: text('token').primaryKey(), room: text('room').notNull(), slot: integer('slot').notNull(),
 name: text('name').notNull(), seen: integer('seen').notNull(), visible: integer('visible').notNull().default(1),
}, t => [uniqueIndex('room_slot').on(t.room,t.slot)]);
export const tasks = sqliteTable('tasks', {
 id: text('id').primaryKey(), room: text('room').notNull(), owner: integer('owner').notNull(),
 title: text('title').notNull(), done: integer('done').notNull().default(0), createdAt: integer('created_at').notNull(),
});
export const messages = sqliteTable('messages', {
 id: text('id').primaryKey(), room: text('room').notNull(), owner: integer('owner').notNull(),
 content: text('content').notNull(), createdAt: integer('created_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
 id: text('id').primaryKey(), room: text('room').notNull(), seconds: integer('seconds').notNull(), createdAt: integer('created_at').notNull(),
});
