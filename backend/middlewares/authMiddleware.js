const jwt = require("jsonwebtoken");
const db = require("../models");

const authenticateToken = async (req, res, next) => {
  // First try to get token from cookie
    // Debug logging
  // console.log('=== AUTH MIDDLEWARE ===');
  // console.log('Cookies received:', req.cookies);
  // console.log('Cookie header:', req.headers.cookie);
  let token = req.cookies.accessToken;
  // console.log('Token from cookie:',token, token ? '✅ Present' : '❌ Missing');
  // Fallback to Authorization header for backward compatibility
  const authHeader = req.headers["authorization"];
  // console.log("lllllllllllllllllllll",authHeader)
  if (!token && authHeader) {
    token = authHeader.split(" ")[1];
    console.log('Token from header:', token ? '✅ Present' : '❌ Missing');
  }

  if (!token) {
    console.log('❌ No token found - returning 401');
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
//  console.log('✅ Token verified for user:', decoded.user_id);
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
      console.log('❌ User not found or inactive');
      return res.status(403).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    console.log('✅ User found:', user.email);

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

const uniquePermissions = Array.from(
  new Map(permissions.map(p => [`${p.resource}:${p.action}`, p])).values()
);

// Convert to string format for consistency
const permissionStrings = uniquePermissions.map(p => 
  `${p.resource}:${p.action}`.toLowerCase()
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
        permissions: permissionStrings,
      project_roles: user.projectRoles ? user.projectRoles.map((pr) => ({
        project_id: pr.project_id,
        project_name: pr.project?.name,
        // role_id: pr.role_id,
        role_name: pr.role?.name,
        // sub_role_id: pr.sub_role_id,
        // sub_role_name: pr.subRole?.name,
      })) : [],
      is_first_logged_in: user.is_first_logged_in,
      password_changed_at: user.password_changed_at,
      requiresPasswordChange: user.is_first_logged_in === true || !user.password_changed_at
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
        // If token is expired, we could handle refresh token here
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Access token expired",
        code: "TOKEN_EXPIRED"
      });
    }
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const checkPermission = (resource, action) => {
  return (req, res, next) => {
    // console.log('\n🔐 ========== PERMISSION CHECK ==========');
    // console.log(`📍 Route: ${req.method} ${req.originalUrl}`);
    // console.log(`📍 Required Permission: ${resource}:${action}`);
    
    // No user or permissions found
    if (!req.user) {
      // console.log('❌ No user found in request');
      // console.log('🔚 ======================================\n');
      return res.status(403).json({
        success: false,
        message: "Access denied: No user found",
        code: "NO_USER"
      });
    }

    // console.log(`👤 User ID: ${req.user.user_id}`);
    // console.log(`👤 User Email: ${req.user.email}`);
    // console.log(`👤 User Type: ${req.user.user_type}`);

    if (!req.user.permissions) {
      // console.log('❌ No permissions array in user object');
      // console.log('📦 User object keys:', Object.keys(req.user));
      // console.log('🔚 ======================================\n');
      return res.status(403).json({
        success: false,
        message: "Access denied: No permissions found",
        code: "NO_PERMISSIONS"
      });
    }

    // Check if permissions array exists
    if (!Array.isArray(req.user.permissions)) {
      // console.log('❌ Permissions is not an array');
      // console.log('📦 Permissions type:', typeof req.user.permissions);
      // console.log('🔚 ======================================\n');
      return res.status(403).json({
        success: false,
        message: "Access denied: Invalid permissions format",
        code: "INVALID_PERMISSIONS"
      });
    }

    // console.log(`📋 User Permissions (${req.user.permissions.length} total):`);
    
    // Log all permissions with their types
    // req.user.permissions.forEach((perm, index) => {
    //   if (typeof perm === 'string') {
    //     console.log(`   ${index + 1}. [STRING] "${perm}"`);
    //   } else if (perm && typeof perm === 'object') {
    //     console.log(`   ${index + 1}. [OBJECT] resource: "${perm.resource}", action: "${perm.action}" -> string: "${perm.resource}:${perm.action}"`);
    //   } else {
    //     console.log(`   ${index + 1}. [UNKNOWN]`, perm);
    //   }
    // });

    if (req.user.permissions.length === 0) {
      // console.log('⚠️ Permissions array is empty');
      // console.log('🔚 ======================================\n');
      return res.status(403).json({
        success: false,
        message: "Access denied: No permissions assigned",
        code: "NO_PERMISSIONS"
      });
    }

    // Normalize the required permission to string format
    const requiredPermission = `${resource}:${action}`.toLowerCase();
    // console.log(`\n🔍 Checking for required permission: "${requiredPermission}"`);
    
    // Check permission - handle both string and object formats
    let foundMatch = false;
    let matchDetails = [];
    
    const hasPermission = req.user.permissions.some(perm => {
      // If permission is a string (e.g., "users:read")
      if (typeof perm === 'string') {
        const match = perm.toLowerCase() === requiredPermission;
        matchDetails.push({
          type: 'string',
          value: perm,
          normalized: perm.toLowerCase(),
          match
        });
        return match;
      }
      
      // If permission is an object (e.g., { resource: "users", action: "read" })
      if (perm && typeof perm === 'object') {
        const permString = `${perm.resource}:${perm.action}`.toLowerCase();
        const match = permString === requiredPermission;
        matchDetails.push({
          type: 'object',
          resource: perm.resource,
          action: perm.action,
          asString: permString,
          match
        });
        return match;
      }
      
      matchDetails.push({
        type: 'unknown',
        value: perm,
        match: false
      });
      return false;
    });

    // Log detailed matching results
    // console.log('\n📊 Permission Matching Results:');
    matchDetails.forEach((detail, index) => {
      if (detail.type === 'string') {
        console.log(`   ${index + 1}. String "${detail.value}" -> "${detail.normalized}" ${detail.match ? '✅ MATCH' : '❌ no match'}`);
      } else if (detail.type === 'object') {
        console.log(`   ${index + 1}. Object ${detail.resource}:${detail.action} -> "${detail.asString}" ${detail.match ? '✅ MATCH' : '❌ no match'}`);
      } else {
        console.log(`   ${index + 1}. Unknown format:`, detail.value);
      }
    });

    if (!hasPermission) {
      // console.log(`\n❌ PERMISSION DENIED for user ${req.user.user_id}`);
      // console.log(`   Required: "${requiredPermission}"`);
      // console.log(`   User has ${req.user.permissions.length} permissions but none match`);
      // console.log('🔚 ======================================\n');

      return res.status(403).json({
        success: false,
        message: `Access denied: Required permission ${resource}:${action}`,
        code: "PERMISSION_DENIED",
        debug: {
          required: requiredPermission,
          userPermissions: req.user.permissions,
          userId: req.user.user_id
        }
      });
    }

    // console.log(`\n✅ PERMISSION GRANTED for ${resource}:${action}`);
    // console.log('🔚 ======================================\n');
    
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