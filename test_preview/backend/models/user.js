// Intentional case sensitivity issue: file is 'user.js' but code imports 'User'
// Auto-fix should handle this

module.exports = class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.createdAt = data.createdAt || new Date().toISOString();
  }
  
  static create(data) {
    return new User(data);
  }
  
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      createdAt: this.createdAt
    };
  }
};

