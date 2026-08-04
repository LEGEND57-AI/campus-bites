export function getUserRoom(userId) {
  return `user:${userId}`;
}

export function getAdminRoom() {
  return "admin";
}

export async function joinUserRoom(socket) {
  const room = getUserRoom(socket.user.id);

  await socket.join(room);

  console.log(`👤 ${socket.user.name} joined ${room}`);
}

export async function joinAdminRoom(socket) {
  if (socket.user.role !== "admin") {
    return;
  }

  const room = getAdminRoom();

  await socket.join(room);

  console.log(`🛡️ Admin ${socket.user.name} joined ${room}`);
}