export function getUserRoom(userId) {
  return `user:${userId}`;
}

export function getAdminRoom() {
  return "admin";
}

export async function joinUserRoom(socket) {
  const room = getUserRoom(socket.user.id);

  await socket.join(room);
}

export async function joinAdminRoom(socket) {
  if (socket.user.role !== "admin") {
    return;
  }

  const room = getAdminRoom();

  await socket.join(room);

}