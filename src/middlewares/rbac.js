
/**
 * RBAC Middleware for Marie
 * This middleware checks if the user has sufficient permissions to use a command 
 * or interact with the AI in fallback mode.
 * 
 * Strict access: Unknown users (not in DB) or unauthorized users are ignored silently.
 */
export default function rbacMiddleware(userStore) {
  return async (ctx, next) => {
    const { registry, event } = ctx;
    const body = event.body || '';
    
    // 1. Identify the intended command
    const matched = registry.findCommand(body);
    let targetCommand = matched ? matched.command : null;
    
    // 2. If no command matched, it might be a fallback chat interaction
    if (!targetCommand && body && !event.type?.startsWith('log:')) {
      targetCommand = registry.commands.get('chat');
    }

    if (targetCommand) {
      // 3. Strict Check: Verify user exists in DB and has required role
      const dbUser = userStore.getUser(event.senderID);
      
      if (!dbUser) {
        // Silent ignore for unknown users
        return;
      }

      const requiredRole = targetCommand.minRole || 'user';
      const userRole = dbUser.role || 'user';

      if (!userStore.hasPermission(userRole, requiredRole)) {
        console.warn(`[RBAC] User ${event.senderID} (${userRole}) denied access to ${targetCommand.name} (requires ${requiredRole}) - Silent Fail`);
        return; // Halt the pipeline silently
      }

      // Update ctx.user with the verified DB user just in case
      ctx.user = dbUser;
    }

    await next();
  };
}
