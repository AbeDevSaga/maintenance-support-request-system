const {
  User,
  UserType,
  Institute,
  ProjectUserRole,
  Project,
  HierarchyNode,
  InstituteProject,
  Role,
  InternalProjectUserRole,
  InternalNode,
  Permission,
  UserPosition,
  ProjectMetric,
  ProjectMetricUser,
  RefreshToken,
  UserRoles,
  RolePermission,
} = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4, validate: isUuid } = require("uuid");
const { Op } = require("sequelize");
const { generateRandomPassword } = require("../utils/password");
const { sendEmail } = require("../utils/sendEmail");
const { parseDuration, DEFAULT_COOKIE_DURATIONS } = require("../utils/parseDuration");
const crypto = require("crypto");

const generateRefreshToken = () => {
  const length = parseInt(process.env.REFRESH_TOKEN_LENGTH) || 32;
  return crypto.randomBytes(length).toString("hex");
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
      attributes: { include: ['password'] },
      include: [
        {
          model: Institute,
          as: "institute",
          attributes: ["institute_id", "name"],
        },
        {
          model: UserType,
          as: "userType",
          attributes: ["user_type_id", "name"],
        },
        {
          model: UserPosition,
          as: "userPosition",
          attributes: ["user_position_id", "name"],
        },
        {
          model: HierarchyNode,
          as: "hierarchyNode",
          attributes: [
            "hierarchy_node_id",
            "name",
            "level",
            "parent_id",
            "description",
          ],
        },
        {
          model: InternalNode,
          as: "internalNode",
          attributes: ["internal_node_id", "name", "level", "parent_id"],
        },
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["role_id", "name"], // Only load role names, not permissions
        },
        {
          model: ProjectMetric,
          as: "metrics",
          through: { attributes: ["value"] },
        },
        {
          model: ProjectUserRole,
          as: "projectRoles",
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["project_id", "name", "description"],
            },
            {
              model: Role,
              as: "role",
              attributes: ["role_id", "name"], // Remove nested permissions
            },
            {
              model: HierarchyNode,
              as: "hierarchyNode",
              attributes: ["hierarchy_node_id", "name", "level", "parent_id"],
            },
          ],
        },
        {
          model: InternalProjectUserRole,
          as: "internalProjectUserRoles",
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["project_id", "name", "description"],
            },
            {
              model: Role,
              as: "role",
              attributes: ["role_id", "name"], // Remove nested permissions
            },
            {
              model: InternalNode,
              as: "internalNode",
              attributes: ["internal_node_id", "name", "level", "parent_id"],
            },
          ],
        },
      ],
    });

    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });
    if (!user.is_active)
      return res.status(403).json({ message: "User is inactive" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    // Minimal data for JWT token (only essential auth data - keeps cookie small)
    const minimalUserDataForToken = {
      user_id: user.user_id,
      email: user.email,
      user_type: user.userType ? user.userType.name : null,
      institute_id: user.institute ? user.institute.institute_id : null,
    };

    // Full user data for response JSON (includes all roles, permissions, project data)
    // This is sent in the response body, not in the JWT cookie
    const userDataForToken = {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      user_type: user.userType ? user.userType.name : null,
      institute: user.institute
        ? {
            institute_id: user.institute.institute_id,
            name: user.institute.name,
          }
        : null,
      user_position: user.userPosition
        ? {
            user_position_id: user.userPosition.user_position_id,
            name: user.userPosition.name,
          }
        : null,
      hierarchy_node: user.hierarchyNode
        ? {
            hierarchy_node_id: user.hierarchyNode.hierarchy_node_id,
            name: user.hierarchyNode.name,
            level: user.hierarchyNode.level,
          }
        : null,
      internal_node: user.internalNode
        ? {
            internal_node_id: user.internalNode.internal_node_id,
            name: user.internalNode.name,
            level: user.internalNode.level,
          }
        : null,
  
      // Permissions should be loaded separately when needed
      permissions: [],
       
     
      roles: user.roles
        ? user.roles.map((role) => ({
 
            name: role.name,
          }))
        : [],
      // Include metrics
      metrics: user.metrics
        ? user.metrics.map((metric) => ({
            project_metric_id: metric.project_metric_id,
            name: metric.name,
            description: metric.description,
            value: metric.ProjectMetricUser?.value,
          }))
        : [],
    };

    // Generate minimal JWT for authentication (small token for fast cookie transmission)
    const accessToken = jwt.sign(minimalUserDataForToken, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRATION_TIME || "15m",
    });
// 🔹 Generate Refresh Token
const refreshToken = generateRefreshToken();
const refreshExpiry = new Date();
refreshExpiry.setDate(refreshExpiry.getDate() + 7); // 7 days

await RefreshToken.create({
  refresh_token: refreshToken,
  user_id: user.user_id,
  expires_at: refreshExpiry,
  is_revoked: false,
});
// console.log("Setting cookies with:");
console.log("- Access Token length:", accessToken.length);
console.log("- Refresh Token length:", refreshToken.length);
// console.log("- NODE_ENV:", process.env.NODE_ENV);
const isProduction = process.env.NODE_ENV === "production";
    // Set cookies
    // Access Token in secure cookie (httpOnly)
    // Access Token cookie    
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: parseDuration(process.env.ACCESS_TOKEN_EXPIRY) || DEFAULT_COOKIE_DURATIONS.ACCESS_TOKEN,
      path: '/',
    });

    // Refresh Token in secure cookie (httpOnly)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: parseDuration(process.env.REFRESH_TOKEN_EXPIRY) || DEFAULT_COOKIE_DURATIONS.REFRESH_TOKEN,
      path: "/",
    });
    // console.log("Response headers after setting cookies:", res.getHeaders());
    // Update last login
    await User.update(
      { last_login_at: new Date() },
      { where: { user_id: user.user_id } }
    );

    return res.status(200).json({
      message: "Login successful",

      requiresPasswordChange: user.is_first_logged_in === true || !user.password_changed_at,
      user: {
        ...userDataForToken,
        phone_number: user.phone_number,
        profile_image: user.profile_image,
        is_first_logged_in: user.is_first_logged_in,
        // Include project-specific roles
        project_roles: user.projectRoles?.map((pr) => ({
          project_user_role_id: pr.project_user_role_id,
          project: pr.project
            ? {
                project_id: pr.project.project_id,
                name: pr.project.name,
                description: pr.project.description,
              }
            : null,
          role: pr.role ? pr.role.name : null,
          // role_id: pr.role ? pr.role.role_id : null,
          
          permissions:
            pr.role?.permissions?.map((p) => ({
              // permission_id: p.permission_id,
              action: p.action,
              resource: p.resource,
            })) || [],
          hierarchy_node: pr.hierarchyNode
            ? {
                hierarchy_node_id: pr.hierarchyNode.hierarchy_node_id,
                name: pr.hierarchyNode.name,
                level: pr.hierarchyNode.level,
              }
            : null,
        })),
        // Include internal project roles
        internal_project_roles: user.internalProjectUserRoles?.map((ipr) => ({
          internal_project_user_role_id: ipr.internal_project_user_role_id,
          project: ipr.project
            ? {
                project_id: ipr.project.project_id,
                name: ipr.project.name,
                description: ipr.project.description,
              }
            : null,
          role: ipr.role ? ipr.role.name : null,
          // role_id: ipr.role ? ipr.role.role_id : null,
          permissions:
            ipr.role?.permissions?.map((p) => ({
              // permission_id: p.permission_id,
              action: p.action,
              resource: p.resource,
            })) || [],
          internal_node: ipr.internalNode
            ? {
                internal_node_id: ipr.internalNode.internal_node_id,
                name: ipr.internalNode.name,
                level: ipr.internalNode.level,
              }
            : null,
          is_active: ipr.is_active,
        })),
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      await RefreshToken.update(
        { is_revoked: true },
        { where: { refresh_token: refreshToken } }
      );
    }

       // Clear both cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken", { path: "/api/refresh-token" });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });

  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// const getCurrentUser = async (req, res) => {
//   try {

//   const userId = req.user.user_id;
//     const user = await User.findOne({
//      where: { user_id: userId },
//       attributes: {
//         exclude: ["password"],
//       },
//       include: [
//         {
//           model: Institute,
//           as: "institute",
//           attributes: ["institute_id", "name"],
//         },
//         {
//           model: UserType,
//           as: "userType",
//           attributes: ["user_type_id", "name"],
//         },
//         {
//           model: UserPosition,
//           as: "userPosition",
//           attributes: ["user_position_id", "name"],
//         },
//         {
//           model: HierarchyNode,
//           as: "hierarchyNode",
//           attributes: [
//             "hierarchy_node_id",
//             "name",
//             "level",
//             "parent_id",
//             "description",
//           ],
//         },
//         {
//           model: InternalNode,
//           as: "internalNode",
//           attributes: ["internal_node_id", "name", "level", "parent_id"],
//         },
// {
//   model: Role,
//   as: "roles",
//   include: [
//     {
//       model: Permission,
//       as: "permissions",
//       through: {
//         model: RolePermission,
//         attributes: ["is_active"],
//       },
//       attributes: ["permission_id", "action", "resource"],
//       where: { is_active: true },
//       required: false,
//     },
//   ],
// },
        
//         {
//           model: ProjectMetric,
//           as: "metrics",
//           through: { attributes: ["value"] },
//         },
//         // Project roles
//         {
//           model: ProjectUserRole,
//           as: "projectRoles",
//           include: [
//             {
//               model: Project,
//               as: "project",
//               attributes: ["project_id", "name", "description"],
//             },
// {
//   model: Role,
//   as: "role",
//   attributes: ["role_id", "name"],
//   include: [
//     {
//       model: Permission,
//       as: "permissions",
//       through: {
//         model: RolePermission,
//         attributes: ["is_active"],
//       },
//       attributes: ["permission_id", "action", "resource"],
//       where: { is_active: true },
//       required: false,
//     },
//   ],
// },
//             {
//               model: HierarchyNode,
//               as: "hierarchyNode",
//               attributes: ["hierarchy_node_id", "name", "level", "parent_id"],
//             },
//             {
//               model: InstituteProject,
//               as: "instituteProject",
//               attributes: ["institute_project_id", "institute_id"],
//             },
//           ],
//         },
//         // Internal project roles
//         {
//           model: InternalProjectUserRole,
//           as: "internalProjectUserRoles",
//           include: [
//             {
//               model: Project,
//               as: "project",
//               attributes: ["project_id", "name", "description"],
//             },
//             {
//               model: Role,
//               as: "role",
//               attributes: ["role_id", "name"],
//               include: [
//                 {
//                   model: Permission,
//                   as: "permissions",
//                   through: {
//                     model: RolePermission,
//                     attributes: ["is_active"],
//                   },
//                   attributes: ["permission_id", "action", "resource"],
//                   where: {
//                     is_active: true,
//                   },
//                   required: false,
//                 },
//               ],
//             },
//             {
//               model: InternalNode,
//               as: "internalNode",
//               attributes: ["internal_node_id", "name", "level", "parent_id"],
//             },
//           ],
//         },
//       ],
//     });

//     if (!user) return res.status(404).json({ message: "User not found" });
//     // Collect all unique permissions from all roles

//     // Convert permissions to string format for consistency
//     const permissions = [];
//     if (user.roles) {
//       user.roles.forEach(role => {
//         if (role.permissions) {
//           role.permissions.forEach(perm => {
//             permissions.push(`${perm.resource}:${perm.action}`);
//           });
//         }
//       });
//     }

//     // Remove duplicates
//     const uniquePermissions = [...new Set(permissions)];



 
//     return res.status(200).json({
//       user: {
//         user_id: user.user_id,
//         full_name: user.full_name,
//         email: user.email,
//         phone_number: user.phone_number,
//         position: user.position,
//         profile_image: user.profile_image,
//         is_first_logged_in: user.is_first_logged_in,
//  permissions: uniquePermissions,
//         user_type: user.userType ? user.userType.name : null,

//         institute: user.institute
//           ? {
//               institute_id: user.institute.institute_id,
//               name: user.institute.name,
//             }
//           : null,

//         user_position: user.userPosition
//           ? {
//               user_position_id: user.userPosition.user_position_id,
//               name: user.userPosition.name,
//             }
//           : null,

//         hierarchy_node: user.hierarchyNode
//           ? {
//               hierarchy_node_id: user.hierarchyNode.hierarchy_node_id,
//               name: user.hierarchyNode.name,
//               level: user.hierarchyNode.level,
//               parent_id: user.hierarchyNode.parent_id,
//               description: user.hierarchyNode.description,
//             }
//           : null,

//         internal_node: user.internalNode
//           ? {
//               internal_node_id: user.internalNode.internal_node_id,
//               name: user.internalNode.name,
//               level: user.internalNode.level,
//               parent_id: user.internalNode.parent_id,
//             }
//           : null,

//         // Global roles with permissions
//         roles: user.roles
//           ? user.roles.map((role) => ({
//               // role_id: role.role_id,
//               name: role.name,
//             }))
//           : [],

//         // User metrics
//         metrics: user.metrics
//           ? user.metrics.map((metric) => ({
//               project_metric_id: metric.project_metric_id,
//               name: metric.name,
//               description: metric.description,
//               weight: metric.weight,
//               value: metric.ProjectMetricUser.value,
//             }))
//           : [],

//         project_roles: user.projectRoles?.map((pr) => ({
//           project_user_role_id: pr.project_user_role_id,
//           project: pr.project
//             ? {
//                 project_id: pr.project.project_id,
//                 name: pr.project.name,
//                 description: pr.project.description,
//               }
//             : null,
//           role: pr.role ? pr.role.name : null,
//           // role_id: pr.role ? pr.role.role_id : null,
          
//           permissions:
//             pr.role?.permissions?.map((p) => ({
//               // permission_id: p.permission_id,
//               action: p.action,
//               resource: p.resource,
//             })) || [],
//           hierarchy_node: pr.hierarchyNode
//             ? {
//                 hierarchy_node_id: pr.hierarchyNode.hierarchy_node_id,
//                 name: pr.hierarchyNode.name,
//                 level: pr.hierarchyNode.level,
//               }
//             : null,
//         })),
//         // Include internal project roles
//         internal_project_roles: user.internalProjectUserRoles?.map((ipr) => ({
//           internal_project_user_role_id: ipr.internal_project_user_role_id,
//           project: ipr.project
//             ? {
//                 project_id: ipr.project.project_id,
//                 name: ipr.project.name,
//                 description: ipr.project.description,
//               }
//             : null,
//           role: ipr.role ? ipr.role.name : null,
//           // role_id: ipr.role ? ipr.role.role_id : null,
//           permissions:
//             ipr.role?.permissions?.map((p) => ({
//               // permission_id: p.permission_id,
//               action: p.action,
//               resource: p.resource,
//             })) || [],
//           internal_node: ipr.internalNode
//             ? {
//                 internal_node_id: ipr.internalNode.internal_node_id,
//                 name: ipr.internalNode.name,
//                 level: ipr.internalNode.level,
//               }
//             : null,
//           is_active: ipr.is_active,
//         })),
//       },
//     });
//   } catch (error) {
//     console.error(error);
//     return res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const user = await User.findOne({
      where: { user_id: userId },
      attributes: { exclude: ["password"] },
      // Use raw: false here because we need the Sequelize associations 
      // but we will use 'raw: true' for nested joins where possible.
      include: [
        { model: Institute, as: "institute", attributes: ["institute_id", "name"] },
        { model: UserType, as: "userType", attributes: ["user_type_id", "name"] },
        { model: UserPosition, as: "userPosition", attributes: ["user_position_id", "name"] },
        { 
          model: HierarchyNode, 
          as: "hierarchyNode", 
          attributes: ["hierarchy_node_id", "name", "level", "parent_id", "description"] 
        },
        { 
          model: InternalNode, 
          as: "internalNode", 
          attributes: ["internal_node_id", "name", "level", "parent_id"] 
        },
        {
          model: Role,
          as: "roles",
          attributes: ["role_id", "name"],
          include: [{
            model: Permission,
            as: "permissions",
            attributes: ["permission_id", "action", "resource"],
            where: { is_active: true },
            required: false,
          }],
        },
        {
          model: ProjectMetric,
          as: "metrics",
          through: { attributes: ["value"] },
        },
        {
          model: ProjectUserRole,
          as: "projectRoles",
          include: [
            { model: Project, as: "project", attributes: ["project_id", "name", "description"] },
            { 
              model: Role, 
              as: "role", 
              attributes: ["role_id", "name"],
              include: [{
                model: Permission,
                as: "permissions",
                attributes: ["action", "resource"],
                where: { is_active: true },
                required: false
              }]
            },
            { model: HierarchyNode, as: "hierarchyNode", attributes: ["hierarchy_node_id", "name", "level", "parent_id"] },
            { model: InstituteProject, as: "instituteProject", attributes: ["institute_project_id", "institute_id"] },
          ],
        },
        {
          model: InternalProjectUserRole,
          as: "internalProjectUserRoles",
          include: [
            { model: Project, as: "project", attributes: ["project_id", "name", "description"] },
            { 
              model: Role, 
              as: "role", 
              attributes: ["role_id", "name"],
              include: [{
                model: Permission,
                as: "permissions",
                attributes: ["action", "resource"],
                where: { is_active: true },
                required: false
              }]
            },
            { model: InternalNode, as: "internalNode", attributes: ["internal_node_id", "name", "level", "parent_id"] },
          ],
        },
      ],
      // This helps Sequelize handle the large nested includes more efficiently
      subQuery: false 
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // 1. Efficient Permission Extraction
    // Using a Set directly avoids the large array push/dedupe cycle
    const permissionSet = new Set();
    user.roles?.forEach(role => {
      role.permissions?.forEach(perm => {
        permissionSet.add(`${perm.resource}:${perm.action}`);
      });
    });

    // 2. Return identical structure to avoid breaking frontend
    return res.status(200).json({
      user: {
        ...user.get({ plain: true }), // Converts to a plain JSON object efficiently
        user_type: user.userType?.name || null,
        permissions: Array.from(permissionSet),
        
        // Ensure manual mappings for your specific UI requirements
        institute: user.institute ? {
          institute_id: user.institute.institute_id,
          name: user.institute.name,
        } : null,

        // Map Roles for Frontend
        roles: user.roles?.map(role => ({ name: role.name })) || [],

        // Map Metrics
        metrics: user.metrics?.map(metric => ({
          project_metric_id: metric.project_metric_id,
          name: metric.name,
          description: metric.description,
          weight: metric.weight,
          value: metric.ProjectMetricUser?.value,
        })) || [],

        // Map Project Roles
        project_roles: user.projectRoles?.map(pr => ({
          project_user_role_id: pr.project_user_role_id,
          project: pr.project,
          role: pr.role?.name || null,
          permissions: pr.role?.permissions || [],
          hierarchy_node: pr.hierarchyNode
        })) || [],

        // Map Internal Project Roles
        internal_project_roles: user.internalProjectUserRoles?.map(ipr => ({
          internal_project_user_role_id: ipr.internal_project_user_role_id,
          project: ipr.project,
          role: ipr.role?.name || null,
          permissions: ipr.role?.permissions || [],
          internal_node: ipr.internalNode,
          is_active: ipr.is_active
        })) || [],
      },
    });
  } catch (error) {
    console.error("GetCurrentUser Optimization Error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
const updateUserPassword = async (req, res) => {
  try {
    // const authHeader = req.headers.authorization;
    // if (!authHeader) {
    //   return res.status(401).json({ message: "Unauthorized" });
    // }

    // const token = authHeader.split(" ")[1];
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
const userId = req.user.user_id;
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({
        message: "new password are required",
      });
    }

    const user = await User.findOne({
      where: { user_id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password and first login flag
    await User.update(
      {
        password: hashedPassword,
        is_first_logged_in: false,
        password_changed_at: new Date(),
        updated_at: new Date(),
      },
      {
        where: { user_id: user.user_id },
      }
    );

    // Send email notification
    // await sendEmail(
    //   user.email,
    //   `Password Updated - ${process.env.APP_NAME}`,
    //   `
    //   Dear ${user.full_name},
    //   Your password has been updated successfully.
    //   Email: ${user.email}
    //   If you did not perform this action, please contact support immediately.
    //   Regards,
    //   ${process.env.APP_NAME} Team
    //   `
    // );

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { login, logout, getCurrentUser, updateUserPassword };
