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
const crypto = require("crypto");

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};
const jwt = require("jsonwebtoken");
// const refreshAccessToken = async (req, res) => {
//   try {
//     const { refreshToken } = req.cookies;

//     if (!refreshToken) {
//       return res.status(401).json({ message: "Refresh token required" });
//     }

//     const storedToken = await RefreshToken.findOne({
//       where: {
//         refresh_token: refreshToken,
//         is_revoked: false,
//       },
//     });

//     if (!storedToken) {
//       return res.status(403).json({ message: "Invalid refresh token" });
//     }

//     if (new Date(storedToken.expires_at) < new Date()) {
//       return res.status(403).json({ message: "Refresh token expired" });
//     }

//     // 🔥 ROTATION — revoke old token
//     storedToken.is_revoked = true;
//     await storedToken.save();

//     const user = await User.findOne({
//       where: { user_id: storedToken.user_id },
//     });

//     // Generate NEW tokens
//     const newAccessToken = jwt.sign(
//       { user_id: user.user_id },
//       process.env.JWT_SECRET,
//       { expiresIn: "15m" }
//     );

//     const newRefreshToken = generateRefreshToken();

//     const newExpiry = new Date();
//     newExpiry.setDate(newExpiry.getDate() + 7);

//     await RefreshToken.create({
//       refresh_token: newRefreshToken,
//       user_id: user.user_id,
//       expires_at: newExpiry,
//       is_revoked: false,
//     });

//     res.cookie("refreshToken", newRefreshToken, {
//       httpOnly: true,
//       secure: true,
//     sameSite: "None",
//     });

//     return res.status(200).json({
//       accessToken: newAccessToken,
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    const storedToken = await RefreshToken.findOne({
      where: {
        refresh_token: refreshToken,
        is_revoked: false,
      },
    });

    if (!storedToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      return res.status(403).json({ message: "Refresh token expired" });
    }

    // Revoke old token
    storedToken.is_revoked = true;
    await storedToken.save();

    // Get complete user data with all associations (same as in login)
    const user = await User.findOne({
      where: { user_id: storedToken.user_id },
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
          include: [
            {
              model: Permission,
              as: "permissions",
              through: {
                model: RolePermission,
                attributes: ["is_active"],
              },
              attributes: ["permission_id", "action", "resource"],
              where: {
                is_active: true,
              },
              required: false,
            },
          ],
        },
        // Add other includes as needed from your login function
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "User is inactive" });
    }

    // Collect permissions (same logic as login)
    const allPermissions = new Map();
    const addRolePermissions = (role) => {
      if (role && role.permissions) {
        role.permissions.forEach((permission) => {
          if (!allPermissions.has(permission.permission_id)) {
            allPermissions.set(permission.permission_id, {
              permission_id: permission.permission_id,
              action: permission.action,
              resource: permission.resource,
            });
          }
        });
      }
    };

    if (user.roles) {
      user.roles.forEach((role) => {
        addRolePermissions(role);
      });
    }

    const uniquePermissions = Array.from(allPermissions.values());

    // Format user data for token (same as login)
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
      permissions: uniquePermissions,
      roles: user.roles
        ? user.roles.map((role) => ({
            role_id: role.role_id,
            name: role.name,
          }))
        : [],
    };

    // Generate new tokens
    const newAccessToken = jwt.sign(
      userDataForToken, // Use full user data, not just user_id
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION_TIME || "15m" }
    );

    const newRefreshToken = generateRefreshToken();
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);

    await RefreshToken.create({
      refresh_token: newRefreshToken,
      user_id: user.user_id,
      expires_at: newExpiry,
      is_revoked: false,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure in production
      sameSite: "Strict",
    });

    return res.status(200).json({
      accessToken: newAccessToken,
      user: userDataForToken, // Optionally send user data back
    });

  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
module.exports = {
  refreshAccessToken,
};