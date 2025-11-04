'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import './globals.css'

type User = {
  id: string
  username: string
  email: string
  avatar?: string
  status?: string
  isOnline?: boolean
}

type Message = {
  id: string
  senderId: string
  receiverId: string
  message: string
  type: string
  senderUsername: string
  senderAvatar?: string
  createdAt: string
  read: boolean
}

type Conversation = {
  other_user_id: string
  other_username: string
  other_avatar?: string
  other_status: string
  last_message: string
  last_message_at: string
  unread_count: number
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [showLogin, setShowLogin] = useState(true)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api'

  // Initialize socket connection
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken && !isAuthenticated) {
      setToken(storedToken)
      checkAuth(storedToken)
    }
  }, [])

  useEffect(() => {
    if (token && user) {
      connectSocket()
      loadData()
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [token, user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const checkAuth = async (authToken: string) => {
    try {
      const res = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setIsAuthenticated(true)
      }
    } catch (error) {
      localStorage.removeItem('token')
    }
  }

  const connectSocket = () => {
    if (!token || socketRef.current) return

    const socket = io(apiUrl.replace('/api', ''), {
      auth: { token }
    })

    socket.on('connect', () => {
      console.log('✅ Connected to server')
    })

    socket.on('new_message', (message: Message) => {
      setMessages(prev => [...prev, message])
      if (selectedUser && (message.senderId === selectedUser.id || message.receiverId === selectedUser.id)) {
        loadMessages(selectedUser.id)
      }
      loadConversations()
    })

    socket.on('message_sent', (message: Message) => {
      setMessages(prev => [...prev, message])
      scrollToBottom()
    })

    socket.on('user_status', (data: { userId: string, status: string, username: string }) => {
      setUsers(prev => prev.map(u => 
        u.id === data.userId ? { ...u, status: data.status, isOnline: data.status === 'online' } : u
      ))
    })

    socket.on('user_typing', (data: { userId: string, username: string, isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers(prev => new Set([...prev, data.userId]))
      } else {
        setTypingUsers(prev => {
          const newSet = new Set(prev)
          newSet.delete(data.userId)
          return newSet
        })
      }
    })

    socket.on('error', (error: { message: string }) => {
      setError(error.message)
    })

    socketRef.current = socket
  }

  const loadData = async () => {
    await Promise.all([
      loadUsers(),
      loadConversations()
    ])
  }

  const loadUsers = async () => {
    try {
      const res = await fetch(`${apiUrl}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const loadConversations = async () => {
    try {
      const res = await fetch(`${apiUrl}/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const loadMessages = async (userId: string) => {
    try {
      const res = await fetch(`${apiUrl}/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('token', data.token)
        setToken(data.token)
        setUser(data.user)
        setIsAuthenticated(true)
        setShowLogin(false)
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (error: any) {
      setError(error.message || 'Login failed')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData)
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('token', data.token)
        setToken(data.token)
        setUser(data.user)
        setIsAuthenticated(true)
        setShowLogin(false)
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch (error: any) {
      setError(error.message || 'Registration failed')
    }
  }

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedUser || !socketRef.current) return

    socketRef.current.emit('send_message', {
      receiverId: selectedUser.id,
      message: messageInput.trim(),
      type: 'text'
    })

    setMessageInput('')
    stopTyping()
  }

  const handleTyping = () => {
    if (!selectedUser || !socketRef.current) return

    if (!isTyping) {
      setIsTyping(true)
      socketRef.current.emit('typing', { receiverId: selectedUser.id })
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping()
    }, 1000)
  }

  const stopTyping = () => {
    if (selectedUser && socketRef.current && isTyping) {
      socketRef.current.emit('stop_typing', { receiverId: selectedUser.id })
      setIsTyping(false)
    }
  }

  const selectUser = (selected: User) => {
    setSelectedUser(selected)
    loadMessages(selected.id)
  }

  const selectConversation = (conv: Conversation) => {
    const convUser = users.find(u => u.id === conv.other_user_id)
    if (convUser) {
      selectUser(convUser)
    } else {
      // User not in users list, create a temporary user object
      const tempUser: User = {
        id: conv.other_user_id,
        username: conv.other_username,
        email: '',
        avatar: conv.other_avatar,
        status: conv.other_status,
        isOnline: conv.other_status === 'online'
      }
      selectUser(tempUser)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    setSelectedUser(null)
    setMessages([])
    setUsers([])
    setConversations([])
    setShowLogin(true)
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ maxWidth: '400px', margin: '50px auto' }}>
        <h1>💬 Messaging App</h1>
        
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowLogin(true)}
            style={{
              flex: 1,
              padding: '10px',
              background: showLogin ? '#667eea' : '#f0f0f0',
              color: showLogin ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Login
          </button>
          <button
            onClick={() => setShowLogin(false)}
            style={{
              flex: 1,
              padding: '10px',
              background: !showLogin ? '#667eea' : '#f0f0f0',
              color: !showLogin ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Register
          </button>
        </div>

        {error && (
          <div style={{
            padding: '10px',
            background: '#f8d7da',
            color: '#721c24',
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {showLogin ? (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              required
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              required
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
            />
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Username"
              value={registerData.username}
              onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
              required
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
            />
            <input
              type="email"
              placeholder="Email"
              value={registerData.email}
              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              required
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={registerData.password}
              onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              required
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
            />
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Register
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '300px', background: '#f8f9fa', borderRight: '1px solid #dee2e6', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px', background: '#667eea', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>💬 Messages</h2>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
            {user?.username}
          </p>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '10px', fontWeight: 'bold', color: '#666' }}>Conversations</div>
          {conversations.map(conv => (
            <div
              key={conv.other_user_id}
              onClick={() => selectConversation(conv)}
              style={{
                padding: '15px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                background: selectedUser?.id === conv.other_user_id ? '#e7f3ff' : 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{conv.other_username}</div>
                <div style={{ fontSize: '0.9rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.last_message || 'No messages'}
                </div>
              </div>
              {conv.unread_count > 0 && (
                <div style={{
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem'
                }}>
                  {conv.unread_count}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Users List */}
        <div style={{ borderTop: '1px solid #dee2e6', maxHeight: '200px', overflowY: 'auto' }}>
          <div style={{ padding: '10px', fontWeight: 'bold', color: '#666' }}>All Users</div>
          {users.map(u => (
            <div
              key={u.id}
              onClick={() => selectUser(u)}
              style={{
                padding: '10px 15px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                background: selectedUser?.id === u.id ? '#e7f3ff' : 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: u.avatar || '#667eea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}>
                {u.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{u.username}</div>
                <div style={{ fontSize: '0.8rem', color: u.isOnline ? '#28a745' : '#666' }}>
                  {u.isOnline ? '🟢 Online' : '⚫ Offline'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '15px 20px', background: 'white', borderBottom: '1px solid #dee2e6', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: selectedUser.avatar || '#667eea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}>
                {selectedUser.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{selectedUser.username}</div>
                <div style={{ fontSize: '0.9rem', color: selectedUser.isOnline ? '#28a745' : '#666' }}>
                  {selectedUser.isOnline ? '🟢 Online' : '⚫ Offline'}
                  {typingUsers.has(selectedUser.id) && ' - typing...'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8f9fa' }}>
              {messages.map(msg => {
                const isOwn = msg.senderId === user?.id
                return (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: '10px',
                      display: 'flex',
                      justifyContent: isOwn ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '60%',
                      padding: '10px 15px',
                      background: isOwn ? '#667eea' : 'white',
                      color: isOwn ? 'white' : '#333',
                      borderRadius: '18px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      {!isOwn && (
                        <div style={{ fontSize: '0.8rem', marginBottom: '5px', opacity: 0.8 }}>
                          {msg.senderUsername}
                        </div>
                      )}
                      <div>{msg.message}</div>
                      <div style={{ fontSize: '0.7rem', marginTop: '5px', opacity: 0.7 }}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '15px 20px', background: 'white', borderTop: '1px solid #dee2e6' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value)
                    handleTyping()
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSendMessage()
                    }
                  }}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: '10px 15px',
                    border: '1px solid #dee2e6',
                    borderRadius: '20px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  style={{
                    padding: '10px 20px',
                    background: messageInput.trim() ? '#667eea' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: messageInput.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            <div style={{ textAlign: 'center' }}>
              <h2>👋 Welcome to Messaging App</h2>
              <p>Select a user or conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
