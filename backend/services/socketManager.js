const { Server } = require('socket.io');
const UserAdmin = require('../models/UserAdmin');
const UserHandicap = require('../models/UserHandicap');

const DEFAULT_FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:4200';

let ioInstance = null;
const presenceRegistry = new Map();

function getPresenceEntry(userId, role) {
  if (!presenceRegistry.has(userId)) {
    presenceRegistry.set(userId, { role, sockets: new Set(), offlineTimer: null });
  }
  const entry = presenceRegistry.get(userId);
  if (role && entry.role !== role) {
    entry.role = role;
  }
  return entry;
}

async function setUserStatus(userId, role, statut) {
  try {
    const update = {};
    if (statut === 'en_ligne') {
      update.derniereConnexion = new Date();
    }
    if (role === 'admin') {
      update.statut = statut;
      await UserAdmin.findByIdAndUpdate(userId, update).exec();
    } else {
      update.statutCompte = statut;
      await UserHandicap.findByIdAndUpdate(userId, update).exec();
    }
  } catch (error) {
    console.error('❌ [SocketManager] Impossible de mettre à jour le statut utilisateur:', error);
  }
}

function emitStatus(userId, role, statut) {
  if (!ioInstance) return;
  const payload = { userId, role, statut, timestamp: new Date().toISOString() };
  ioInstance.to('role:admin').emit('user:status', payload);
  ioInstance.to('role:handicap').emit('user:status', payload);
  ioInstance.to(`user:${userId}`).emit('user:selfStatus', payload);
}

async function markOnline(userId, role) {
  await setUserStatus(userId, role, 'en_ligne');
  emitStatus(userId, role, 'en_ligne');
}

async function markOffline(userId, role) {
  await setUserStatus(userId, role, 'hors_ligne');
  emitStatus(userId, role, 'hors_ligne');
  presenceRegistry.delete(userId);
}

function scheduleOfflineCheck(userId, role, delayMs = 4000) {
  const entry = presenceRegistry.get(userId);
  if (!entry) return;
  if (entry.offlineTimer) {
    clearTimeout(entry.offlineTimer);
  }
  entry.offlineTimer = setTimeout(() => {
    const latest = presenceRegistry.get(userId);
    if (!latest || latest.sockets.size === 0) {
      markOffline(userId, role);
    }
  }, delayMs);
}

function cancelOfflineCheck(userId) {
  const entry = presenceRegistry.get(userId);
  if (!entry) return;
  if (entry.offlineTimer) {
    clearTimeout(entry.offlineTimer);
    entry.offlineTimer = null;
  }
}

function handleIdentify(socket, data) {
  const { userId, role } = data || {};
  if (!userId || !role) {
    console.warn('⚠️ [SocketManager] identify invalide:', data);
    return;
  }

  socket.data.userId = userId;
  socket.data.role = role;

  socket.join(`user:${userId}`);
  socket.join(`role:${role}`);
  socket.join('global');

  const entry = getPresenceEntry(userId, role);
  entry.sockets.add(socket.id);
  cancelOfflineCheck(userId);

  markOnline(userId, role);
}

function handleDisconnect(socket) {
  const { userId, role } = socket.data || {};
  if (!userId) {
    return;
  }
  const entry = presenceRegistry.get(userId);
  if (!entry) {
    return;
  }
  entry.sockets.delete(socket.id);
  if (entry.sockets.size === 0) {
    scheduleOfflineCheck(userId, role);
  }
}

function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: DEFAULT_FRONTEND_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    }
  });

  ioInstance.on('connection', (socket) => {
    socket.on('identify', (data) => handleIdentify(socket, data));
    socket.on('joinRoom', (room) => {
      if (room) socket.join(room);
    });
    socket.on('leaveRoom', (room) => {
      if (room) socket.leave(room);
    });
    socket.on('disconnect', () => handleDisconnect(socket));
  });

  return ioInstance;
}

function getIo() {
  return ioInstance;
}

function emitToRole(role, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`role:${role}`).emit(event, payload);
}

function emitToRoles(roles, event, payload) {
  if (!ioInstance) return;
  roles.forEach(role => emitToRole(role, event, payload));
}

function emitToUser(userId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}

function emitToUsers(userIds, event, payload) {
  if (!ioInstance) return;
  userIds.forEach((id) => emitToUser(id, event, payload));
}

function emitGlobal(event, payload) {
  if (!ioInstance) return;
  ioInstance.to('global').emit(event, payload);
}

module.exports = {
  initSocket,
  getIo,
  emitToRole,
  emitToRoles,
  emitToUser,
  emitToUsers,
  emitGlobal,
  markOnline,
  markOffline
};
