const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db, dbHelpers } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Track online users
const onlineUsers = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  const userId = socket.userId;
  const username = socket.user.username;
  
  console.log(`✅ User connected: ${username} (${userId})`);
  
  // Add user to online list
  onlineUsers.set(userId, { socketId: socket.id, username, userId });
  
  // Update user status
  dbHelpers.updateUserStatus(userId, 'online');
  
  // Broadcast user online status
  io.emit('user_status', { userId, status: 'online', username });
  
  // Join user's personal room
  socket.join(`user_${userId}`);
  
  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { receiverId, message, type } = data;
      
      if (!receiverId || !message) {
        socket.emit('error', { message: 'Receiver ID and message are required' });
        return;
      }
      
      // Create message in database
      const messageId = crypto.randomUUID();
      await dbHelpers.createMessage({
        id: messageId,
        senderId: userId,
        receiverId,
        message,
        type: type || 'text'
      });
      
      // Create conversation if it doesn't exist
      await dbHelpers.createConversation(userId, receiverId);
      
      // Get sender info
      const sender = await dbHelpers.getUserById(userId);
      
      // Prepare message object
      const messageObj = {
        id: messageId,
        senderId: userId,
        receiverId,
        message,
        type: type || 'text',
        senderUsername: sender.username,
        senderAvatar: sender.avatar,
        createdAt: new Date().toISOString()
      };
      
      // Send to receiver
      io.to(`user_${receiverId}`).emit('new_message', messageObj);
      
      // Confirm to sender
      socket.emit('message_sent', messageObj);
      
      console.log(`📨 Message sent from ${username} to ${receiverId}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // Handle typing indicator
  socket.on('typing', (data) => {
    const { receiverId } = data;
    if (receiverId) {
      io.to(`user_${receiverId}`).emit('user_typing', {
        userId,
        username,
        isTyping: true
      });
    }
  });
  
  socket.on('stop_typing', (data) => {
    const { receiverId } = data;
    if (receiverId) {
      io.to(`user_${receiverId}`).emit('user_typing', {
        userId,
        username,
        isTyping: false
      });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${username} (${userId})`);
    
    onlineUsers.delete(userId);
    dbHelpers.updateUserStatus(userId, 'offline');
    
    // Broadcast user offline status
    io.emit('user_status', { userId, status: 'offline', username });
  });
});

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    onlineUsers: onlineUsers.size
  });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }
    
    // Check if user exists
    const existingUser = await dbHelpers.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }
    
    // Check username
    const existingUsername = await dbHelpers.getUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        error: 'Username already taken'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const userId = crypto.randomUUID();
    const user = await dbHelpers.createUser({
      id: userId,
      username,
      email,
      password: hashedPassword
    });
    
    // Generate token
    const token = jwt.sign(
      { userId, username, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        username,
        email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: error.message
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Get user
    const user = await dbHelpers.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Update status
    await dbHelpers.updateUserStatus(user.id, 'online');
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: 'online'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message
    });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await dbHelpers.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
      message: error.message
    });
  }
});

// Get all users
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const users = await dbHelpers.getAllUsers(req.userId);
    res.json({
      success: true,
      users: users.map(user => ({
        ...user,
        isOnline: onlineUsers.has(user.id)
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get users',
      message: error.message
    });
  }
});

// Get messages between two users
app.get('/api/messages/:userId', authenticate, async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const messages = await dbHelpers.getMessages(req.userId, otherUserId, limit);
    
    // Mark messages as read
    await dbHelpers.markMessagesAsRead(req.userId, otherUserId);
    
    res.json({
      success: true,
      messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
      message: error.message
    });
  }
});

// Get conversations
app.get('/api/conversations', authenticate, async (req, res) => {
  try {
    const conversations = await dbHelpers.getConversations(req.userId);
    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations',
      message: error.message
    });
  }
});

// Get unread count
app.get('/api/messages/unread/count', authenticate, async (req, res) => {
  try {
    const count = await dbHelpers.getUnreadCount(req.userId);
    res.json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Messaging App API',
    version: '1.0.0',
    endpoints: {
      'POST /api/auth/register': 'Register new user',
      'POST /api/auth/login': 'Login user',
      'GET /api/auth/me': 'Get current user',
      'GET /api/users': 'Get all users',
      'GET /api/messages/:userId': 'Get messages with user',
      'GET /api/conversations': 'Get all conversations',
      'GET /api/messages/unread/count': 'Get unread messages count',
      'GET /api/health': 'Health check'
    },
    websocket: {
      'send_message': 'Send a message',
      'typing': 'Send typing indicator',
      'stop_typing': 'Stop typing indicator',
      'new_message': 'Receive new message',
      'user_status': 'User online/offline status'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📡 API endpoints available at http://${HOST}:${PORT}/api`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`💾 Database: SQLite`);
});
