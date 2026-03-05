const {
  IssueEscalation,
  Issue,
  User,
  IssueTier,
  Attachment,
  IssueHistory,
  EscalationAttachment,
  IssueEscalationHistory,
  HierarchyNode,
  IssueAction,
  sequelize,
} = require("../../models");

const { v4: uuidv4 } = require("uuid");
const NotificationService = require("../../services/notificationService");

// ------------------------------------------------------
//  ESCALATE ISSUE
// ------------------------------------------------------
const escalateIssue = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      issue_id,
      from_tier,
      reason,
      escalated_by,
      attachment_ids,
    } = req.body;

    // 1. Validate Issue
    const issue = await Issue.findByPk(issue_id);
    if (!issue) return res.status(404).json({ message: "Issue not found." });

    // 2. Validate User
    const escalator = await User.findByPk(escalated_by);
    if (!escalator)
      return res
        .status(404)
        .json({ message: "User (escalated_by) not found." });

    // 3. Determine the target tier (parent hierarchy)
    let to_tier = null;
    
    // Get the current hierarchy node details
    const currentNode = await HierarchyNode.findByPk(from_tier);
    
    if (!currentNode) {
      return res.status(400).json({ message: "Invalid from_tier" });
    }
    
    console.log("Current node:", currentNode.toJSON());
    
    // If current node has a parent, escalate to that parent
    if (currentNode.parent_id) {
      to_tier = currentNode.parent_id;
      console.log(`Escalating to parent node: ${to_tier}`);
    } else {
      // If no parent (root node), escalate to internal/EAII
      console.log("Root node - escalating to internal");
      // to_tier remains null for internal escalation
    }

    const escalation_id = uuidv4();

    // 4. Create escalation
    await IssueEscalation.create(
      {
        escalation_id,
        issue_id,
        from_tier,
        to_tier, // Now determined by backend
        reason,
        escalated_by,
        escalated_at: new Date(),
      },
      { transaction: t }
    );

    // 5. Attach files
    if (attachment_ids?.length > 0) {
      const links = attachment_ids.map((attachment_id) => ({
        escalation_id,
        attachment_id,
        created_at: new Date(),
      }));

      await EscalationAttachment.bulkCreate(links, { transaction: t });
    }

    // 6. Create tier entry (for new tier assignment)
    await IssueTier.create(
      {
        issue_tier_id: uuidv4(),
        issue_id,
        tier_level: to_tier, // Will be parent ID or null
        handler_id: null,
        assigned_at: new Date(),
        status: "pending",
        remarks: `Escalated from ${from_tier}`,
      },
      { transaction: t }
    );

    // 7. Log Action
    await IssueAction.create(
      {
        action_id: uuidv4(),
        issue_id,
        action_name: "Issue Escalated",
        action_description: `Escalated from ${from_tier} to ${to_tier || 'Internal'}`,
        performed_by: escalated_by,
        related_tier: from_tier,
      },
      { transaction: t }
    );

    // 8. CREATE IssueHistory ENTRY
    await IssueHistory.create(
      {
        history_id: uuidv4(),
        issue_id: issue_id,
        user_id: escalated_by,
        action: "escalated",
        status_at_time: "escalated",
        escalation_id: escalation_id,
        resolution_id: null,
        notes: `Escalated from tier ${from_tier} to tier ${to_tier || 'Internal'}. Reason: ${reason}`,
        created_at: new Date(),
      },
      { transaction: t }
    );

    // 9. Update issue status
    issue.status = "escalated";
    await issue.save({ transaction: t });

    // ================================
    // SEND NOTIFICATION TO PARENT HIERARCHY
    // ================================
    try {
      if (issue.project_id && escalated_by && from_tier) {
        // If we found a parent (to_tier exists)
        if (to_tier) {
          console.log("Sending escalation notification to parent hierarchy...");
          await NotificationService.sendToImmediateParentHierarchy(
            {
              sender_id: escalated_by,
              project_id: issue.project_id,
              issue_id: issue.issue_id,
              hierarchy_node_id: from_tier,
              title: `Issue Escalated: ${issue.title}`,
              message: `Issue (${issue.ticket_number}) has been escalated from your child hierarchy. Please review and take necessary action.`,
              type: "ISSUE_ESCALATED",
            },
            t
          );
        } else {
          // No parent found - this is a root node, notify internal users
          console.log("Sending escalation notification to Internal Root Users...");
          await NotificationService.sendToInternalAssignedRootUsers(
            {
              sender_id: escalated_by,
              project_id: issue.project_id,
              issue_id: issue.issue_id,
              hierarchy_node_id: from_tier,
              title: `Issue Escalated to Internal: ${issue.title}`,
              message: `Issue (${issue.ticket_number}) has been escalated to internal team for resolution.`,
              type: "ISSUE_ESCALATED",
            },
            t
          );
        }
      }
    } catch (notificationError) {
      console.warn(
        "Failed to send notification for issue escalation:",
        notificationError.message
      );
    }

    // COMMIT ALL
    await t.commit();

    // Return escalation with details
    const fullEscalation = await IssueEscalation.findOne({
      where: { escalation_id },
      include: [
        { model: Issue, as: "issue" },
        { model: User, as: "escalator" },
        {
          model: EscalationAttachment,
          as: "attachments",
          include: [{ model: Attachment, as: "attachment" }],
        },
        {
          model: HierarchyNode,
          as: "fromTierNode",
          attributes: ["hierarchy_node_id", "name", "level"]
        },
        {
          model: HierarchyNode,
          as: "toTierNode",
          attributes: ["hierarchy_node_id", "name", "level"]
        }
      ],
    });

    console.log("Escalation completed:", {
      from: from_tier,
      to: to_tier || "Internal",
      escalated_by
    });

    return res.status(201).json(fullEscalation);
  } catch (error) {
    console.error("ESCALATION ERROR:", error);
    await t.rollback();
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// ------------------------------------------------------
//  GET ESCALATIONS BY ISSUE ID
// ------------------------------------------------------
const getEscalationsByIssueId = async (req, res) => {
  try {
    const { issue_id } = req.params;

    const data = await IssueEscalation.findAll({
      where: { issue_id },
      include: [
        { model: User, as: "escalator" },
        {
          model: EscalationAttachment,
          as: "attachments",
          include: [{ model: Attachment, as: "attachment" }],
        },
      ],
      order: [["escalated_at", "DESC"]],
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error("ESCALATION FETCH ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ------------------------------------------------------
//  GET ESCALATION HISTORY BY ISSUE ID
// ------------------------------------------------------
const getEscalationHistoryByIssueId = async (req, res) => {
  try {
    const { issue_id } = req.params;

    const history = await IssueEscalationHistory.findAll({
      where: { issue_id },
      include: [
        { model: User, as: "escalator" },
        { model: Issue, as: "issue" },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json(history);
  } catch (error) {
    console.error("ESCALATION HISTORY ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ------------------------------------------------------
//  GET ESCALATION BY ID
// ------------------------------------------------------
const getEscalationById = async (req, res) => {
  try {
    const { escalation_id } = req.params;

    const escalation = await IssueEscalation.findOne({
      where: { escalation_id },
      include: [
        { model: Issue, as: "issue" },
        { model: User, as: "escalator" },
        {
          model: EscalationAttachment,
          as: "attachments",
          include: [{ model: Attachment, as: "attachment" }],
        },
      ],
    });

    if (!escalation)
      return res.status(404).json({ message: "Escalation not found" });

    return res.status(200).json(escalation);
  } catch (error) {
    console.error("GET ESCALATION ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ------------------------------------------------------
//  DELETE ESCALATION
// ------------------------------------------------------
const deleteEscalation = async (req, res) => {
  try {
    const { escalation_id } = req.params;

    const escalation = await IssueEscalation.findByPk(escalation_id);
    if (!escalation)
      return res.status(404).json({ message: "Escalation not found" });

    await IssueEscalation.destroy({ where: { escalation_id } });

    return res.status(204).send();
  } catch (error) {
    console.error("DELETE ESCALATION ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ------------------------------------------------------
module.exports = {
  escalateIssue,
  getEscalationsByIssueId,
  getEscalationHistoryByIssueId,
  getEscalationById,
  deleteEscalation,
};
