# 🔥 Complex Features - Test Preview Project

## 🎯 Intentional Complexity & Challenges

This project is designed to test the Preview System's ability to handle complex, real-world scenarios.

## ⚠️ Case Sensitivity Issues (Intentional)

### Issue 1: User Model
- **File**: `backend/models/user.js` (lowercase)
- **Import**: `require('./models/User')` (uppercase)
- **Expected**: Auto-fix should rename file to `User.js` or fix import

### Issue 2: Message Service
- **File**: `backend/services/message.js` (lowercase)
- **Import**: `require('./services/messageService')` (mixed case)
- **Expected**: Auto-fix should rename file to `messageService.js` or fix import

## 🔐 Authentication & Authorization

### Endpoints:
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires Bearer token)

### Features:
- Password hashing (SHA256)
- Session management with expiration
- Token-based authentication
- Rate limiting (5 requests per 5 minutes)

## 📁 File Upload/Download

### Endpoints:
- `POST /api/upload` - Upload file (requires auth, max 10MB)
- `GET /api/files` - List user files (requires auth)
- `GET /api/files/:id` - Download file (requires auth)

### Features:
- File type validation (images, PDF, text, docs)
- File size limits
- User-specific file storage
- Access control (users can only access their files)

## ⚡ Rate Limiting

### Implementation:
- In-memory rate limiting
- Configurable per endpoint
- IP-based tracking
- Automatic cleanup

### Rate Limits:
- `/api/auth/register`: 5 requests / 5 minutes
- `/api/auth/login`: 5 requests / 5 minutes
- `/api/performance/fibonacci`: 20 requests / 1 minute
- `/api/performance/load`: 5 requests / 1 minute

## 🗄️ Database Simulation

### In-Memory Database:
- Users (Map)
- Sessions (Map)
- Files (Map)
- Logs (Array, max 1000 entries)

### Endpoints:
- `GET /api/db/stats` - Database statistics
- `POST /api/db/log` - Create log entry
- `GET /api/db/logs` - Get user logs (with filtering)

## ⚡ Performance Testing

### Endpoints:
- `GET /api/performance/fibonacci/:n` - Calculate Fibonacci (0-40)
- `POST /api/performance/load` - Load testing with different complexities

### Features:
- CPU-intensive operations
- Configurable complexity levels
- Performance metrics
- Throughput calculation

## 🐛 Error Testing

### Endpoint:
- `GET /api/error/:type` - Test different error scenarios

### Error Types:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `timeout` - Request timeout
- `throw` - Unhandled exception

## 🧪 Testing Scenarios

### 1. Case Sensitivity
- ✅ Auto-fix should detect and fix case mismatches
- ✅ System should handle imports correctly

### 2. Authentication Flow
- ✅ Register → Login → Access protected routes
- ✅ Token expiration handling
- ✅ Invalid token rejection

### 3. File Operations
- ✅ Upload with validation
- ✅ List files per user
- ✅ Download with access control
- ✅ File type validation

### 4. Rate Limiting
- ✅ Rate limit enforcement
- ✅ Retry-after headers
- ✅ Different limits per endpoint

### 5. Error Handling
- ✅ All error codes tested
- ✅ Proper error messages
- ✅ Error recovery

### 6. Performance
- ✅ CPU-intensive operations
- ✅ Memory usage tracking
- ✅ Throughput measurement

## 📊 API Endpoints Summary

### Basic (5 endpoints)
- GET /api/test
- POST /api/echo
- GET /api/health
- GET /api/info
- POST /api/calculate

### Authentication (3 endpoints)
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Files (3 endpoints)
- POST /api/upload
- GET /api/files
- GET /api/files/:id

### Performance (2 endpoints)
- GET /api/performance/fibonacci/:n
- POST /api/performance/load

### Database (3 endpoints)
- GET /api/db/stats
- POST /api/db/log
- GET /api/db/logs

### Error Testing (1 endpoint)
- GET /api/error/:type

**Total: 17 API Endpoints**

## 🔧 Middleware Stack

1. **CORS** - Cross-origin resource sharing
2. **Body Parser** - JSON and URL-encoded
3. **Request Logging** - Request tracking
4. **Rate Limiting** - Per-endpoint limits
5. **Authentication** - Token validation
6. **Error Handling** - Global error handler

## 📦 Dependencies

- `express` - Web framework
- `cors` - CORS middleware
- `multer` - File upload handling
- `crypto` - Hashing and UUID generation
- `fs` - File system operations

## 🎯 Success Criteria

The Preview System should:
1. ✅ Detect case sensitivity issues
2. ✅ Auto-fix case mismatches
3. ✅ Handle all 17 endpoints correctly
4. ✅ Support file uploads
5. ✅ Handle authentication flow
6. ✅ Respect rate limits
7. ✅ Handle all error scenarios
8. ✅ Support performance testing

## 🚀 Next Steps

1. Test all endpoints
2. Verify auto-fix works
3. Test file uploads
4. Test authentication flow
5. Test rate limiting
6. Test error scenarios
7. Monitor performance

