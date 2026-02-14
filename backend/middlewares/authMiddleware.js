const jwt = require("jsonwebtoken");
const db = require("../models");

// const authenticateToken = async (req, res, next) => {
//   // ✅ 1️⃣ Development bypass (fake user injection)
//   // if (process.env.NODE_ENV !== "production" && req.user) {
//   //   console.log("⚠️ Dev auth bypass detected — skipping token verification");
//   //   return next();
//   // }

//   const authHeader = req.headers["authorization"];
//   const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

//   if (!token) {
//     return res.status(401).json({
//       success: false,
//       message: "Access token required",
//     });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Fetch user with roles and permissions
//     const user = await db.User.findByPk(decoded.user_id, {
//       attributes: { exclude: ["password"] },
//       include: [
//         {
//           model: db.ProjectUserRole,
//           as: "projectRoles",
//           where: { is_active: true },
//           required: false,
//           include: [
//             {
//               model: db.Role,
//               as: "role",
//               include: [
//                 {
//                   model: db.RoleSubRole,
//                   as: "roleSubRoles",
//                   where: { is_active: true },
//                   required: false,
//                   include: [
//                     {
//                       model: db.SubRole,
//                       as: "subRole",
//                     },
//                     {
//                       model: db.RoleSubRolePermission,
//                       as: "permissions",
//                       include: [
//                         {
//                           model: db.Permission,
//                           as: "permission",
//                         },
//                       ],
//                     },
//                   ],
//                 },
//               ],
//             },
//             {
//               model: db.SubRole,
//               as: "subRole",
//             },
//             {
//               model: db.Project,
//               as: "project",
//             },
//           ],
//         },
//         {
//           model: db.Institute,
//           as: "institute",
//         },

//         {
//           model: db.UserType,
//           as: "userType",
//         },
//       ],
//     });

//     if (!user || !user.is_active) {
//       return res.status(403).json({
//         success: false,
//         message: "User not found or inactive",
//       });
//     }

//     // Extract permissions and roles
//     const permissions = new Set();
//     const roles = new Set();

//     user.projectRoles.forEach((projectRole) => {
//       if (projectRole.role) {
//         roles.add(projectRole.role.name);

//         // Get permissions from role sub roles
//         if (projectRole.role.roleSubRoles) {
//           projectRole.role.roleSubRoles.forEach((roleSubRole) => {
//             if (roleSubRole.permissions) {
//               roleSubRole.permissions.forEach((rolePermission) => {
//                 if (rolePermission.permission) {
//                   const permissionString = `${rolePermission.permission.resource}:${rolePermission.permission.action}`;
//                   permissions.add(permissionString);
//                 }
//               });
//             }
//           });
//         }
//       }

//       // Add sub-role if exists
//       if (projectRole.subRole) {
//         roles.add(projectRole.subRole.name);
//       }
//     });

//     req.user = {
//       user_id: user.user_id,
//       email: user.email,
//       full_name: user.full_name,
//       institute_id: user.institute_id,
//       user_type_id: user.user_type_id,
//       user_type: user.userType?.name,
//       roles: Array.from(roles),
//       permissions: Array.from(permissions),
//       project_roles: user.projectRoles.map((pr) => ({
//         project_id: pr.project_id,
//         project_name: pr.project?.name,
//         role_id: pr.role_id,
//         role_name: pr.role?.name,
//         sub_role_id: pr.sub_role_id,
//         sub_role_name: pr.subRole?.name,
//       })),
//     };

//     next();
//   } catch (error) {
//     console.error("Auth middleware error:", error);
//     return res.status(403).json({
//       success: false,
//       message: "Invalid or expired token",
//     });
//   }
// };
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
        include: ['is_first_logged_in', 'password_changed_at'] // Make sure these are included
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
      ],
    });

    if (!user || !user.is_active) {
      return res.status(403).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    // 🔐 PASSWORD CHANGE ENFORCEMENT - ADD THIS SECTION change-password
    // List of paths that should be accessible even if password change is required
const publicPaths = [
  '/update-password',              // Add this based on the log
  '/auth/update-password',         // Keep this too
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
// console.log("🔍 FULL PATH DEBUG:", {
//   originalUrl: req.originalUrl,
//   baseUrl: req.baseUrl,
//   path: req.path,
//   url: req.url
// });
// Check if current path requires password change enforcement
const isPublicPath = publicPaths.some(path => {
  const matches = req.path === path || req.path.startsWith(path + '/');
  // console.log(`🔍 Checking path: "${req.path}" against "${path}" = ${matches}`);
  return matches;
});

// console.log("🔍 Final result:", { path: req.path, isPublicPath });
    // If password change is required and this is not a public path, block access
    if ((user.is_first_logged_in === true || !user.password_changed_at) && !isPublicPath) {
      return res.status(403).json({
        success: false,
        message: "Password change required before accessing this resource",
        code: "PASSWORD_CHANGE_REQUIRED",
        redirectTo: "/change-password"
      });
    }

    // Optional: Check for password expiration (e.g., after 90 days)
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
    const permissions = new Set();
    const roles = new Set();

    user.projectRoles.forEach((projectRole) => {
      if (projectRole.role) {
        roles.add(projectRole.role.name);

        // Get permissions from role sub roles
        if (projectRole.role.roleSubRoles) {
          projectRole.role.roleSubRoles.forEach((roleSubRole) => {
            if (roleSubRole.permissions) {
              roleSubRole.permissions.forEach((rolePermission) => {
                if (rolePermission.permission) {
                  const permissionString = `${rolePermission.permission.resource}:${rolePermission.permission.action}`;
                  permissions.add(permissionString);
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

    // Add password change status to req.user
    req.user = {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      institute_id: user.institute_id,
      user_type_id: user.user_type_id,
      user_type: user.userType?.name,
      roles: Array.from(roles),
      permissions: Array.from(permissions),
      project_roles: user.projectRoles.map((pr) => ({
        project_id: pr.project_id,
        project_name: pr.project?.name,
        role_id: pr.role_id,
        role_name: pr.role?.name,
        sub_role_id: pr.sub_role_id,
        sub_role_name: pr.subRole?.name,
      })),
      // Add these flags
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
// Permission middleware
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    const requiredPermission = `${resource}:${action}`;

    if (!req.user || !req.user.permissions) {
      return res.status(403).json({
        success: false,
        message: "Access denied: No permissions found",
      });
    }

    if (!req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Required permission ${requiredPermission}`,
      });
    }

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
        message: `Access denied: Required one of roles: ${roleNames.join(
          ", "
        )}`,
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
