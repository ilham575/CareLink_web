/**
 * Socket.IO Integration for Strapi
 * Attaches Socket.IO to Strapi's existing HTTP server
 * Allows real-time notification updates without polling
 */

let Server;
try {
  // Require socket.io if available
  ({ Server } = require('socket.io'));
} catch (err) {
  console.warn('[Socket.IO] optional dependency not installed:', err.message);
  Server = null;
}

/**
 * Initialize Socket.IO on Strapi's server
 * Call this from Strapi's bootstrap to attach socket.io to the HTTP server
 * @param {Object} strapiInstance - The strapi instance
 * @param {Object} httpServer - The HTTP server (strapi.server)
 */
function initializeSocketIO(strapiInstance, httpServer) {
  if (!Server) {
    console.warn('[Socket.IO] Server not available — socket features disabled.');
    // provide a no-op interface to avoid breaking code that expects strapi.io
    strapiInstance.io = null;
    return null;
  }

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  /**
   * Middleware: Verify JWT token from socket handshake
   */
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    console.log(`[Socket] Auth middleware - token present: ${!!token}, origin: ${socket.handshake.headers.origin}`);
    
    if (!token) {
      // Allow anonymous connections (for public data)
      console.log(`[Socket] ${socket.id} - No token provided, allowing anonymous connection`);
      return next();
    }
    
    try {
      // Verify JWT using Strapi's JWT service
      const jwtService = strapiInstance.plugin('users-permissions').service('jwt');
      const decoded = jwtService.verify(token);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      console.log(`[Socket] ${socket.id} - Token verified for user: ${socket.userEmail}`);
      next();
    } catch (err) {
      console.warn('[Socket] Invalid JWT token:', err.message);
      socket.userId = null;
      // Still allow connection, just without auth
      next();
    }
  });

  /**
   * Connection handler
   */
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}, userId: ${socket.userId || 'anonymous'}`);

    /**
     * Join room: client joins a room
     * Rooms: notification:{notificationId}, customer:{customerId}, staff:{staffId}
     */
    socket.on('join', (room) => {
      if (room && typeof room === 'string') {
        socket.join(room);
        console.log(`[Socket.IO] ${socket.id} joined room: ${room}`);
      }
    });

    /**
     * Leave room
     */
    socket.on('leave', (room) => {
      if (room && typeof room === 'string') {
        socket.leave(room);
        console.log(`[Socket.IO] ${socket.id} left room: ${room}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });

    // Handle socket errors
    socket.on('error', (error) => {
      console.error(`[Socket.IO] Socket error for ${socket.id}:`, error);
    });
  });

  // Handle connection errors
  io.on('connect_error', (error) => {
    console.error('[Socket.IO] Connection error:', error.message);
  });

  // Store io instance on strapi for access in lifecycle hooks and controllers
  strapiInstance.io = io;
  console.log('[Socket.IO] Initialized and attached to Strapi server');
  
  return io;
}

module.exports = { initializeSocketIO };

