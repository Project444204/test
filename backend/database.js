const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');

// Create database file if it doesn't exist
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, '');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    status TEXT DEFAULT 'offline',
    last_seen TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Messages table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    read BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  )`);

  // Conversations table (for grouping messages)
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    last_message_id TEXT,
    last_message_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id),
    UNIQUE(user1_id, user2_id)
  )`);

  // Friends/Friendships table
  db.run(`CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id),
    UNIQUE(user1_id, user2_id)
  )`);

  console.log('✅ Database tables initialized');
});

// Database helper functions
const dbHelpers = {
  // User operations
  createUser: (userData) => {
    return new Promise((resolve, reject) => {
      const { id, username, email, password, avatar } = userData;
      db.run(
        `INSERT INTO users (id, username, email, password, avatar) VALUES (?, ?, ?, ?, ?)`,
        [id, username, email, password, avatar || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id, username, email, avatar });
        }
      );
    });
  },

  getUserByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  getUserById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT id, username, email, avatar, status, last_seen, created_at FROM users WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  getUserByUsername: (username) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM users WHERE username = ?`, [username], [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  updateUserStatus: (userId, status) => {
    return new Promise((resolve, reject) => {
      const lastSeen = new Date().toISOString();
      db.run(
        `UPDATE users SET status = ?, last_seen = ? WHERE id = ?`,
        [status, lastSeen, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getAllUsers: (excludeUserId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, username, email, avatar, status, last_seen FROM users WHERE id != ? ORDER BY username`,
        [excludeUserId || ''],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  // Message operations
  createMessage: (messageData) => {
    return new Promise((resolve, reject) => {
      const { id, senderId, receiverId, message, type } = messageData;
      db.run(
        `INSERT INTO messages (id, sender_id, receiver_id, message, type) VALUES (?, ?, ?, ?, ?)`,
        [id, senderId, receiverId, message, type || 'text'],
        function(err) {
          if (err) reject(err);
          else resolve({ id, senderId, receiverId, message, type });
        }
      );
    });
  },

  getMessages: (userId1, userId2, limit = 50) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [userId1, userId2, userId2, userId1, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve((rows || []).reverse());
        }
      );
    });
  },

  markMessagesAsRead: (userId, senderId) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE messages SET read = 1 WHERE receiver_id = ? AND sender_id = ? AND read = 0`,
        [userId, senderId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  getUnreadCount: (userId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read = 0`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.count || 0);
        }
      );
    });
  },

  // Conversation operations
  getConversations: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT
          CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END as other_user_id,
          u.username as other_username,
          u.avatar as other_avatar,
          u.status as other_status,
          (SELECT message FROM messages WHERE (sender_id = ? AND receiver_id = other_user_id) OR (sender_id = other_user_id AND receiver_id = ?) ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages WHERE (sender_id = ? AND receiver_id = other_user_id) OR (sender_id = other_user_id AND receiver_id = ?) ORDER BY created_at DESC LIMIT 1) as last_message_at,
          (SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND sender_id = other_user_id AND read = 0) as unread_count
        FROM conversations c
        JOIN users u ON (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END) = u.id
        WHERE c.user1_id = ? OR c.user2_id = ?
        ORDER BY last_message_at DESC`,
        [userId, userId, userId, userId, userId, userId, userId, userId, userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  createConversation: (user1Id, user2Id) => {
    return new Promise((resolve, reject) => {
      const id = require('crypto').randomUUID();
      db.run(
        `INSERT OR IGNORE INTO conversations (id, user1_id, user2_id) VALUES (?, ?, ?)`,
        [id, user1Id, user2Id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

module.exports = { db, dbHelpers };

