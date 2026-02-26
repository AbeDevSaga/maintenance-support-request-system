const jwt = require("jsonwebtoken");
const db = require("../models");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user with roles and permissions
    const user = await db.User.findByPk(decoded.user_id, {
      attributes: {
        exclude: ["password"],
        include: ['is_first_logged_in', 'password_changed_at']
      },
      include: [
        {
          model: db.ProjectUserRole,
          as: "projectRoles",
          where: { is_active: true },
          required: false,
          include: [
            {
              model: db.Role,
              as: "role",
              include: [
                {
                  model: db.RoleSubRole,
                  as: "roleSubRoles",
                  where: { is_active: true },
                  required: false,
                  include: [
                    {
                      model: db.SubRole,
                      as: "subRole",
                    },
                    {
                      model: db.RoleSubRolePermission,
                      as: "permissions",
                      include: [
                        {
                          model: db.Permission,
                          as: "permission",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              model: db.SubRole,
              as: "subRole",
            },
            {
              model: db.Project,
              as: "project",
            },
          ],
        },
        {
          model: db.Institute,
          as: "institute",
        },
        {
          model: db.UserType,
          as: "userType",
        },
        {
          model: db.Role,
          as: "roles",
          through: { attributes: [] },
          include: [
            {
              model: db.Permission,
              as: "permissions",
              through: { attributes: [] },
              attributes: ["permission_id", "resource", "action"],
            },
          ],
        },
      ],
    });

    if (!user || !user.is_active) {
      return res.status(403).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    // Password change enforcement paths
    const publicPaths = [
      '/update-password',
      '/auth/update-password',
      '/change-password',
      '/auth/change-password',
      '/api/auth/update-password',
      '/api/auth/change-password',
      '/logout',
      '/auth/logout',
      '/api/auth/logout',
      '/login',
      '/auth/login',
      '/api/auth/login',
      '/refresh-token',
      '/api/refresh-token',
    ];

    const isPublicPath = publicPaths.some(path => {
      return req.path === path || req.path.startsWith(path + '/');
    });

    // If password change is required and this is not a public path, block access
    if ((user.is_first_logged_in === true || !user.password_changed_at) && !isPublicPath) {
      return res.status(403).json({
        success: false,
        message: "Password change required before accessing this resource",
        code: "PASSWORD_CHANGE_REQUIRED",
        redirectTo: "/change-password"
      });
    }

    // Check for password expiration (e.g., after 90 days)
    if (user.password_changed_at) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      if (user.password_changed_at < ninetyDaysAgo && !isPublicPath) {
        return res.status(403).json({
          success: false,
          message: "Password expired. Please change your password",
          code: "PASSWORD_EXPIRED",
          redirectTo: "/change-password"
        });
      }
    }

    // Extract permissions and roles
    const permissions = [];
    const roles = new Set();

    // Get permissions from global roles
    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach(role => {
        roles.add(role.name);
        if (role.permissions && Array.isArray(role.permissions)) {
          role.permissions.forEach(perm => {
            permissions.push({
              resource: perm.resource,
              action: perm.action
            });
          });
        }
      });
    }

    // Get permissions from project roles
    if (user.projectRoles && Array.isArray(user.projectRoles)) {
      user.projectRoles.forEach((projectRole) => {
        if (projectRole.role) {
          roles.add(projectRole.role.name);

          // Get permissions from role sub roles
          if (projectRole.role.roleSubRoles && Array.isArray(projectRole.role.roleSubRoles)) {
            projectRole.role.roleSubRoles.forEach((roleSubRole) => {
              if (roleSubRole.permissions && Array.isArray(roleSubRole.permissions)) {
                roleSubRole.permissions.forEach((rolePermission) => {
                  if (rolePermission.permission) {
                    permissions.push({
                      resource: rolePermission.permission.resource,
                      action: rolePermission.permission.action
                    });
                  }
                });
              }
            });
          }
        }

        // Add sub-role if exists
        if (projectRole.subRole) {
          roles.add(projectRole.subRole.name);
        }
      });
    }

    // Remove duplicate permissions
    const uniquePermissions = Array.from(
      new Map(permissions.map(p => [`${p.resource}:${p.action}`, p])).values()
    );

    // Add password change status to req.user
    req.user = {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      institute_id: user.institute_id,
      user_type_id: user.user_type_id,
      user_type: user.userType?.name,
      roles: Array.from(roles),
      permissions: uniquePermissions, // ✅ Consistent field name with object format
      project_roles: user.projectRoles ? user.projectRoles.map((pr) => ({
        project_id: pr.project_id,
        project_name: pr.project?.name,
        role_id: pr.role_id,
        role_name: pr.role?.name,
        sub_role_id: pr.sub_role_id,
        sub_role_name: pr.subRole?.name,
      })) : [],
      is_first_logged_in: user.is_first_logged_in,
      password_changed_at: user.password_changed_at,
      requiresPasswordChange: user.is_first_logged_in === true || !user.password_changed_at
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const checkPermission = (resource, action) => {
  return (req, res, next) => {
    // No user or permissions found
    if (!req.user || !req.user.permissions) {
      console.warn(`Unauthorized access attempt - No permissions found: ${req.originalUrl}`, {
        ip: req.ip,
        user: req.user?.user_id,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: "Access denied: No permissions found",
        code: "NO_PERMISSIONS",
        redirectTo: "/unauthorized"
      });
    }

    // Check if permissions array exists and has items
    if (!Array.isArray(req.user.permissions) || req.user.permissions.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied: No permissions assigned",
        code: "NO_PERMISSIONS"
      });
    }

    // Check permission in object format { resource, action }
    const hasPermission = req.user.permissions.some(perm => {
      // Handle object format
      if (perm && typeof perm === 'object') {
        return perm.resource === resource && perm.action === action;
      }
      // Handle string format (fallback)
      if (typeof perm === 'string') {
        return perm === `${resource}:${action}`;
      }
      return false;
    });

    if (!hasPermission) {
      console.warn(`Permission denied: User ${req.user?.user_id} attempted to access ${req.originalUrl}`, {
        requiredPermission: `${resource}:${action}`,
        userPermissions: req.user.permissions,
        ip: req.ip
      });

      return res.status(403).json({
        success: false,
        message: `Access denied: Required permission ${resource}:${action}`,
        code: "PERMISSION_DENIED",
        redirectTo: "/unauthorized"
      });
    }

    // User has permission, proceed
    next();
  };
};

// Role checking middleware
const requireRole = (roleName) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({
        success: false,
        message: "Access denied: No roles found",
      });
    }

    if (!req.user.roles.includes(roleName)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Required role ${roleName}`,
      });
    }

    next();
  };
};

// Check if user has any of the specified roles
const requireAnyRole = (roleNames) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({
        success: false,
        message: "Access denied: No roles found",
      });
    }

    const hasRole = roleNames.some((roleName) =>
      req.user.roles.includes(roleName)
    );

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Required one of roles: ${roleNames.join(", ")}`,
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  checkPermission,
  requireRole,
  requireAnyRole,
};