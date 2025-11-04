// Intentional case sensitivity issue: file is 'message.js' but code imports 'messageService'
// Auto-fix should handle this

class MessageService {
  constructor() {
    this.messages = [];
  }
  
  send(message, userId) {
    const msg = {
      id: require('crypto').randomUUID(),
      message,
      userId,
      timestamp: new Date().toISOString()
    };
    this.messages.push(msg);
    return msg;
  }
  
  getByUserId(userId) {
    return this.messages.filter(msg => msg.userId === userId);
  }
  
  getAll() {
    return this.messages;
  }
}

module.exports = new MessageService();

