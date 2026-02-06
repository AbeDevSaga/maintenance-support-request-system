export const getHeirarchyStructure = (projectId: string, object: any) => {
  if (!object?.project_roles || !Array.isArray(object.project_roles)) {
    return null;
  }

  const matchingProject = object.project_roles.find(
    (projectRole: any) => projectRole.project?.project_id === projectId
  );

  return matchingProject?.hierarchy_node || null;
};

export const isLeafNode = (nodeId: string, allNodes: any[]): boolean => {
  if (!nodeId || !allNodes || allNodes.length === 0) return false;
  
  // Find the node in the flat list
  const node = allNodes.find(n => n.internal_node_id === nodeId);
  if (!node) return false;
  
  // Check if this node has any children
  // A node has children if there are other nodes where this node is the parent
  const hasChildren = allNodes.some(n => n.parent?.internal_node_id === nodeId);
  
  return !hasChildren; // Leaf node = no children
};

/**
 * Get user's current node from assignments
 */
export const getUserCurrentNode = (userProjectNode: any): any | null => {
  if (!userProjectNode?.assignments?.length) return null;
  
  // Get the first assignment's internal node
  return userProjectNode.assignments[0].internal_node || null;
};

/**
 * Check if user is at leaf node
 */
export const isUserAtLeafNode = (userProjectNode: any, allNodes: any[]): boolean => {
  const userNode = getUserCurrentNode(userProjectNode);
  if (!userNode) return false;
  
  return isLeafNode(userNode.internal_node_id, allNodes);
};

export const getUsersAtSameLevel = (
  userNodeId: string, 
  allUsersWithAssignments: any[]
): any[] => {
  if (!userNodeId || !allUsersWithAssignments) return [];
  
  // Filter users who are assigned to the same internal node
  return allUsersWithAssignments.filter(user => {
    // Check if user has assignments
    if (!user.assignments || !user.assignments.length) return false;
    
    // Check if any assignment is to the same node
    return user.assignments.some((assignment: any) => 
      assignment.internal_node?.internal_node_id === userNodeId
    );
  });
};

/**
 * Check if user can transfer (is at leaf node and there are other users at same level)
 */
export const userCanTransfer = (
  userProjectNode: any, 
  allNodes: any[], 
  allUsersWithAssignments: any[]
): boolean => {
  if (!userProjectNode) return false;
  
  const userNode = getUserCurrentNode(userProjectNode);
  if (!userNode) return false;
  
  // Check if user is at leaf node
  const isLeaf = isLeafNode(userNode.internal_node_id, allNodes);
  if (!isLeaf) return false;
  
  // Get users at same level (excluding current user)
  const usersAtSameLevel = getUsersAtSameLevel(
    userNode.internal_node_id, 
    allUsersWithAssignments
  ).filter(user => user.user_id !== userProjectNode.user_id);
  
  // Can transfer if there are other users at the same level
  return usersAtSameLevel.length > 0;
};

/**
 * Get available users for transfer (users at same level excluding current user)
 */
export const getAvailableUsersForTransfer = (
  userProjectNode: any,
  allUsersWithAssignments: any[]
): any[] => {
  if (!userProjectNode) return [];
  
  const userNode = getUserCurrentNode(userProjectNode);
  if (!userNode) return [];
  
  const currentUserId = userProjectNode.user_id;
  
  return getUsersAtSameLevel(userNode.internal_node_id, allUsersWithAssignments)
    .filter(user => user.user_id !== currentUserId);
};