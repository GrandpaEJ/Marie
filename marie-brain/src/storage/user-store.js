import db from './db.js';

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  USER: 'user'
};

const ROLE_LEVELS = {
  [ROLES.OWNER]: 3,
  [ROLES.ADMIN]: 2,
  [ROLES.USER]: 1
};

export function hasPermission(userRole, minRole) {
  return (ROLE_LEVELS[userRole] || 1) >= (ROLE_LEVELS[minRole] || 1);
}

export function getUser(uid) {
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
  return user;
}

export function createUser(uid, name, role = ROLES.USER) {
  db.prepare(`
    INSERT INTO users (uid, name, role, created, updated)
    VALUES (?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(uid) DO UPDATE SET
      name = excluded.name,
      updated = unixepoch()
  `).run(uid, name, role);
  return getUser(uid);
}

export function setRole(uid, role) {
  if (!Object.values(ROLES).includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  db.prepare('UPDATE users SET role = ?, updated = unixepoch() WHERE uid = ?').run(role, uid);
}

export function listAdmins() {
  return db.prepare("SELECT * FROM users WHERE role IN ('owner', 'admin')").all();
}

export function ensureOwner(uid, name) {
  const user = getUser(uid);
  if (!user) {
    console.log(`Creating owner: ${name} (${uid})`);
    return createUser(uid, name, ROLES.OWNER);
  } else if (user.role !== ROLES.OWNER) {
    console.log(`Promoting ${uid} to owner`);
    setRole(uid, ROLES.OWNER);
  }
  return getUser(uid);
}
