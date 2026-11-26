class AgentNodeDescriptor {
  final String nodeId;
  final String title;
  final String role;
  final String mode; // 'LLM' | 'Hybrid' | 'Deterministic' | 'Human Gate'
  final String group;

  const AgentNodeDescriptor({
    required this.nodeId,
    required this.title,
    required this.role,
    required this.mode,
    required this.group,
  });
}

/// Ordered catalog of all 14 backend LangGraph nodes in eventology_backend/src/graph/index.ts.
const List<AgentNodeDescriptor> kAgentPipelineCatalog = [
  AgentNodeDescriptor(
    nodeId: 'orchestrator_agent',
    title: 'Orchestrator',
    role: 'Routes stages & invalidates downstream state on requirement edits',
    mode: 'Hybrid',
    group: 'Control',
  ),
  AgentNodeDescriptor(
    nodeId: 'event_intake_agent',
    title: 'Event Intake Architect',
    role: 'Extracts event type, city, date, guests & budget scope',
    mode: 'LLM',
    group: 'Intake',
  ),
  AgentNodeDescriptor(
    nodeId: 'event_planning_agent',
    title: 'Event Planner',
    role: 'Generates concept summary, schedule & required services',
    mode: 'LLM',
    group: 'Planning',
  ),
  AgentNodeDescriptor(
    nodeId: 'venue_agent',
    title: 'Venue Specialist',
    role: 'Shortlists matching verified halls & palaces in parallel',
    mode: 'LLM',
    group: 'Parallel Search',
  ),
  AgentNodeDescriptor(
    nodeId: 'vendor_agent',
    title: 'Vendor Specialist',
    role: 'Finds qualified crews & caterers by required category',
    mode: 'LLM',
    group: 'Parallel Search',
  ),
  AgentNodeDescriptor(
    nodeId: 'service_agent',
    title: 'Service Catalog Resolver',
    role: 'Maps abstract needs to concrete catalog services & packages',
    mode: 'LLM',
    group: 'Parallel Search',
  ),
  AgentNodeDescriptor(
    nodeId: 'availability_agent',
    title: 'Availability Verifier',
    role: 'Checks operating hours, blackouts & atomic reservations',
    mode: 'LLM',
    group: 'Feasibility',
  ),
  AgentNodeDescriptor(
    nodeId: 'budget_agent',
    title: 'Budget & BOM Engine',
    role: 'Builds itemized pricing, budget sufficiency & BOM',
    mode: 'LLM',
    group: 'Commercial',
  ),
  AgentNodeDescriptor(
    nodeId: 'engineering_verification_agent',
    title: 'Engineering Physics',
    role: 'Electrical load, rigging static equilibrium, NBC egress & CAD XML',
    mode: 'Deterministic',
    group: 'Engineering',
  ),
  AgentNodeDescriptor(
    nodeId: 'technical_review_agent',
    title: 'PE Technical Gate',
    role: 'Pauses if engineering holds require licensed sign-off',
    mode: 'Human Gate',
    group: 'Governance',
  ),
  AgentNodeDescriptor(
    nodeId: 'logistics_agent',
    title: 'CPM & Run-of-Show',
    role: 'Load-in docks, elevator math, critical path & curfew checks',
    mode: 'Deterministic',
    group: 'Logistics',
  ),
  AgentNodeDescriptor(
    nodeId: 'approval_agent',
    title: 'Client Approval Gate',
    role: 'Runs oversight consistency audit & pauses for client approval',
    mode: 'Human Gate',
    group: 'Governance',
  ),
  AgentNodeDescriptor(
    nodeId: 'booking_agent',
    title: 'Booking & Allocation',
    role: 'Creates event, enquiry, booking & reservation records in Firestore',
    mode: 'LLM',
    group: 'Execution',
  ),
  AgentNodeDescriptor(
    nodeId: 'communication_agent',
    title: 'Notification Dispatcher',
    role: 'Publishes in-app notifications & closes workflow',
    mode: 'LLM',
    group: 'Execution',
  ),
];

class AgentChatMessage {
  final String? id;
  final String role; // 'user' | 'assistant'
  final String content;

  const AgentChatMessage({
    this.id,
    required this.role,
    required this.content,
  });

  factory AgentChatMessage.fromMap(Map<String, dynamic> map) {
    return AgentChatMessage(
      id: map['id']?.toString(),
      role: map['role']?.toString() ?? 'assistant',
      content: map['content']?.toString() ?? '',
    );
  }
}

class AgentBudgetLineItem {
  final String item;
  final String category;
  final num cost;
  final String? unit;
  final int? quantity;

  const AgentBudgetLineItem({
    required this.item,
    required this.category,
    required this.cost,
    this.unit,
    this.quantity,
  });

  factory AgentBudgetLineItem.fromMap(Map<String, dynamic> map) {
    return AgentBudgetLineItem(
      item: (map['itemName'] ?? map['name'] ?? map['item'] ?? 'Line Item').toString(),
      category: (map['category'] ?? 'General').toString(),
      cost: (map['estimatedCost'] ?? map['totalCost'] ?? map['cost'] ?? 0) as num,
      unit: map['unit']?.toString(),
      quantity: map['quantity'] is num ? (map['quantity'] as num).toInt() : null,
    );
  }
}

class AgentBudgetBreakdown {
  final num totalEstimatedCost;
  final num? contingencyAmount;
  final String currency;
  final List<AgentBudgetLineItem> lineItems;

  const AgentBudgetBreakdown({
    required this.totalEstimatedCost,
    this.contingencyAmount,
    this.currency = 'INR',
    this.lineItems = const [],
  });

  factory AgentBudgetBreakdown.fromMap(Map<String, dynamic> map) {
    final rawItems = map['lineItems'];
    final items = rawItems is List
        ? rawItems
            .whereType<Map>()
            .map((e) => AgentBudgetLineItem.fromMap(Map<String, dynamic>.from(e)))
            .toList()
        : <AgentBudgetLineItem>[];

    return AgentBudgetBreakdown(
      totalEstimatedCost: (map['totalEstimatedCost'] ?? map['total'] ?? 0) as num,
      contingencyAmount: map['contingency'] is num ? map['contingency'] as num : null,
      currency: map['currency']?.toString() ?? 'INR',
      lineItems: items,
    );
  }
}

class AgentApprovalSummary {
  final String approvalId;
  final String summary;
  final num totalEstimatedCost;
  final String status;
  final String? venue;
  final int vendorCount;

  const AgentApprovalSummary({
    required this.approvalId,
    required this.summary,
    required this.totalEstimatedCost,
    required this.status,
    this.venue,
    this.vendorCount = 0,
  });

  factory AgentApprovalSummary.fromMap(Map<String, dynamic> map) {
    return AgentApprovalSummary(
      approvalId: map['approvalId']?.toString() ?? '',
      summary: map['summary']?.toString() ?? 'Review finalized production plan and BOM.',
      totalEstimatedCost: (map['totalEstimatedCost'] ?? 0) as num,
      status: map['status']?.toString() ?? 'pending',
      venue: map['venue']?.toString(),
      vendorCount: map['vendorCount'] is num ? (map['vendorCount'] as num).toInt() : 0,
    );
  }
}

class AgentStateSnapshot {
  final String workflowId;
  final String conversationId;
  final String? eventId;
  final String workflowStatus;
  final String currentStage;
  final String currentAgent;
  final bool intakeComplete;
  final Map<String, dynamic> eventRequirements;
  final List<String> pendingQuestions;
  final List<String> missingInformation;
  final Map<String, dynamic>? eventPlan;
  final int candidateVenueCount;
  final int candidateVendorCount;
  final int availableVenueCount;
  final int availableVendorCount;
  final List<Map<String, dynamic>> candidateVenues;
  final List<Map<String, dynamic>> candidateVendors;
  final AgentBudgetBreakdown? budgetBreakdown;
  final String approvalStatus;
  final List<AgentApprovalSummary> pendingApprovals;
  final List<String> createdBookingIds;
  final List<String> createdEnquiryIds;
  final List<String> completedTasks;
  final String? lastError;
  final List<Map<String, dynamic>> artifacts;
  final List<Map<String, dynamic>> technicalReviews;
  final String technicalReviewStatus;
  final bool hasActiveTechnicalHolds;
  final List<AgentChatMessage> messages;

  const AgentStateSnapshot({
    required this.workflowId,
    required this.conversationId,
    this.eventId,
    required this.workflowStatus,
    required this.currentStage,
    required this.currentAgent,
    required this.intakeComplete,
    this.eventRequirements = const {},
    this.pendingQuestions = const [],
    this.missingInformation = const [],
    this.eventPlan,
    this.candidateVenueCount = 0,
    this.candidateVendorCount = 0,
    this.availableVenueCount = 0,
    this.availableVendorCount = 0,
    this.candidateVenues = const [],
    this.candidateVendors = const [],
    this.budgetBreakdown,
    this.approvalStatus = 'none',
    this.pendingApprovals = const [],
    this.createdBookingIds = const [],
    this.createdEnquiryIds = const [],
    this.completedTasks = const [],
    this.lastError,
    this.artifacts = const [],
    this.technicalReviews = const [],
    this.technicalReviewStatus = 'none',
    this.hasActiveTechnicalHolds = false,
    this.messages = const [],
  });

  factory AgentStateSnapshot.fromMap(Map<String, dynamic> map) {
    List<String> _toStrList(dynamic v) =>
        v is List ? v.map((e) => e.toString()).toList() : const [];

    List<Map<String, dynamic>> _toMapList(dynamic v) => v is List
        ? v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : const [];

    return AgentStateSnapshot(
      workflowId: map['workflowId']?.toString() ?? '',
      conversationId: map['conversationId']?.toString() ?? '',
      eventId: map['eventId']?.toString(),
      workflowStatus: map['workflowStatus']?.toString() ?? 'active',
      currentStage: map['currentStage']?.toString() ?? 'intake',
      currentAgent: map['currentAgent']?.toString() ?? 'orchestrator_agent',
      intakeComplete: map['intakeComplete'] == true,
      eventRequirements: map['eventRequirements'] is Map
          ? Map<String, dynamic>.from(map['eventRequirements'])
          : const {},
      pendingQuestions: _toStrList(map['pendingQuestions']),
      missingInformation: _toStrList(map['missingInformation']),
      eventPlan: map['eventPlan'] is Map
          ? Map<String, dynamic>.from(map['eventPlan'])
          : null,
      candidateVenueCount: (map['candidateVenueCount'] as num?)?.toInt() ?? 0,
      candidateVendorCount: (map['candidateVendorCount'] as num?)?.toInt() ?? 0,
      availableVenueCount: (map['availableVenueCount'] as num?)?.toInt() ?? 0,
      availableVendorCount: (map['availableVendorCount'] as num?)?.toInt() ?? 0,
      candidateVenues: _toMapList(map['candidateVenues']),
      candidateVendors: _toMapList(map['candidateVendors']),
      budgetBreakdown: map['budgetBreakdown'] is Map
          ? AgentBudgetBreakdown.fromMap(
              Map<String, dynamic>.from(map['budgetBreakdown']),
            )
          : null,
      approvalStatus: map['approvalStatus']?.toString() ?? 'none',
      pendingApprovals: _toMapList(map['pendingApprovals'])
          .map(AgentApprovalSummary.fromMap)
          .toList(),
      createdBookingIds: _toStrList(map['createdBookingIds']),
      createdEnquiryIds: _toStrList(map['createdEnquiryIds']),
      completedTasks: _toStrList(map['completedTasks']),
      lastError: map['lastError']?.toString(),
      artifacts: _toMapList(map['artifacts']),
      technicalReviews: _toMapList(map['technicalReviews']),
      technicalReviewStatus: map['technicalReviewStatus']?.toString() ?? 'none',
      hasActiveTechnicalHolds: map['hasActiveTechnicalHolds'] == true,
      messages: _toMapList(map['messages'])
          .map(AgentChatMessage.fromMap)
          .where((m) => m.content.trim().isNotEmpty)
          .toList(),
    );
  }
}

class AgentStreamEvent {
  final String eventType; // 'started' | 'node_update' | 'state_update' | 'interrupt' | 'complete' | 'error'
  final String? conversationId;
  final String? node;
  final String? nextAgent;
  final String? currentStage;
  final String? workflowStatus;
  final List<String>? completedTasks;
  final AgentStateSnapshot? state;
  final bool interrupted;
  final String? error;

  const AgentStreamEvent({
    required this.eventType,
    this.conversationId,
    this.node,
    this.nextAgent,
    this.currentStage,
    this.workflowStatus,
    this.completedTasks,
    this.state,
    this.interrupted = false,
    this.error,
  });
}
