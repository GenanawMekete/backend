const chatHandler = (io, socket) => {
  // Send message to room
  socket.on('send_message', async (data) => {
    try {
      const { roomCode, message, type = 'text' } = data;
      
      if (!roomCode || !message) {
        socket.emit('error', { message: 'Room code and message are required' });
        return;
      }
      
      // Check if user is in the room
      const rooms = Array.from(socket.rooms);
      if (!rooms.includes(roomCode)) {
        socket.emit('error', { message: 'You are not in this room' });
        return;
      }
      
      // Create message object
      const messageObj = {
        userId: socket.userId,
        username: socket.username,
        message,
        type,
        timestamp: Date.now(),
        roomCode,
      };
      
      // Broadcast to room (excluding sender)
      socket.to(roomCode).emit('new_message', messageObj);
      
      // Also send to sender for confirmation
      socket.emit('message_sent', {
        ...messageObj,
        status: 'delivered',
      });
      
      // Log message (optional)
      // You could store messages in a database here
      
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // Send private message
  socket.on('send_private_message', async (data) => {
    try {
      const { toUserId, message } = data;
      
      if (!toUserId || !message) {
        socket.emit('error', { message: 'Recipient and message are required' });
        return;
      }
      
      // Create message object
      const messageObj = {
        fromUserId: socket.userId,
        fromUsername: socket.username,
        toUserId,
        message,
        timestamp: Date.now(),
      };
      
      // Send to recipient if they're online
      io.to(`user:${toUserId}`).emit('private_message', messageObj);
      
      // Confirm to sender
      socket.emit('private_message_sent', {
        ...messageObj,
        status: 'delivered',
      });
      
    } catch (error) {
      console.error('Send private message error:', error);
      socket.emit('error', { message: 'Failed to send private message' });
    }
  });
  
  // Typing indicator
  socket.on('typing', (data) => {
    try {
      const { roomCode, isTyping } = data;
      
      if (!roomCode) {
        return;
      }
      
      // Broadcast typing indicator to room (excluding sender)
      socket.to(roomCode).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      console.error('Typing indicator error:', error);
    }
  });
  
  // Read receipt
  socket.on('message_read', (data) => {
    try {
      const { messageId, roomCode } = data;
      
      if (!messageId) {
        return;
      }
      
      // Broadcast read receipt if in a room
      if (roomCode) {
        socket.to(roomCode).emit('message_read_receipt', {
          messageId,
          userId: socket.userId,
          username: socket.username,
          timestamp: Date.now(),
        });
      }
      
    } catch (error) {
      console.error('Message read error:', error);
    }
  });
};

module.exports = chatHandler;
