/// Represents an item-level price quote submitted by a vendor.
class RfqItemPriceModel {
  final String itemName;
  final int quotedRatePaise;

  const RfqItemPriceModel({
    required this.itemName,
    required this.quotedRatePaise,
  });

  double get quotedRateInr => quotedRatePaise / 100.0;

  factory RfqItemPriceModel.fromMap(Map<String, dynamic> map) {
    return RfqItemPriceModel(
      itemName: map['itemName']?.toString() ?? '',
      quotedRatePaise: (map['quotedRatePaise'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'itemName': itemName,
      'quotedRatePaise': quotedRatePaise,
    };
  }
}

/// Represents a single equipment line item within an RFQ package.
class RfqLineItemModel {
  final String name;
  final int quantity;
  final String unit;
  final int estimatedRatePaise;
  final String? specifications;

  const RfqLineItemModel({
    required this.name,
    required this.quantity,
    this.unit = 'units',
    this.estimatedRatePaise = 0,
    this.specifications,
  });

  double get estimatedRateInr => estimatedRatePaise / 100.0;
  int get estimatedTotalPaise => quantity * estimatedRatePaise;
  double get estimatedTotalInr => estimatedTotalPaise / 100.0;

  factory RfqLineItemModel.fromMap(Map<String, dynamic> map) {
    return RfqLineItemModel(
      name: map['name']?.toString() ?? map['itemName']?.toString() ?? '',
      quantity: (map['quantity'] as num?)?.toInt() ?? 1,
      unit: map['unit']?.toString() ?? 'units',
      estimatedRatePaise: (map['estimatedRatePaise'] as num?)?.toInt() ??
          (map['estimatedUnitCostPaise'] as num?)?.toInt() ??
          0,
      specifications: map['specifications']?.toString() ??
          map['technicalSpec']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'quantity': quantity,
      'unit': unit,
      'estimatedRatePaise': estimatedRatePaise,
      if (specifications != null) 'specifications': specifications,
    };
  }
}

/// Represents a category-specific RFQ package dispatched to vendors.
class RfqPackageModel {
  final String id;
  final String workflowId;
  final String rfqBatchId;
  final String category;
  final String title;
  final String? eventName;
  final String? eventDate;
  final String? venueName;
  final int? guestCount;
  final String status; // 'draft' | 'dispatched' | 'acknowledged' | 'quoted' | 'accepted' | 'declined'
  final List<RfqLineItemModel> lineItems;
  final List<String> matchedVendorIds;
  final String? assignedVendorId;
  final int? quotedAmountPaise;
  final int? counterBidAmountPaise;
  final List<RfqItemPriceModel>? itemPrices;
  final String? notes;
  final int? quoteValidityDays;
  final String? deliveryCommitment;
  final String? dispatchedAtIso;
  final String? acknowledgedAtIso;
  final String? quotedAtIso;
  final String? acceptedAtIso;
  final String? declinedAtIso;
  final String? declineReason;
  final String? paymentMilestoneId;
  final String? deliveryDeadlineIso;

  const RfqPackageModel({
    required this.id,
    required this.workflowId,
    required this.rfqBatchId,
    required this.category,
    required this.title,
    this.eventName,
    this.eventDate,
    this.venueName,
    this.guestCount,
    required this.status,
    required this.lineItems,
    this.matchedVendorIds = const [],
    this.assignedVendorId,
    this.quotedAmountPaise,
    this.counterBidAmountPaise,
    this.itemPrices,
    this.notes,
    this.quoteValidityDays,
    this.deliveryCommitment,
    this.dispatchedAtIso,
    this.acknowledgedAtIso,
    this.quotedAtIso,
    this.acceptedAtIso,
    this.declinedAtIso,
    this.declineReason,
    this.paymentMilestoneId,
    this.deliveryDeadlineIso,
  });

  double? get quotedAmountInr =>
      quotedAmountPaise != null ? quotedAmountPaise! / 100.0 : null;

  double? get counterBidAmountInr =>
      counterBidAmountPaise != null ? counterBidAmountPaise! / 100.0 : null;

  int get estimatedTotalPaise =>
      lineItems.fold(0, (acc, item) => acc + item.estimatedTotalPaise);

  double get estimatedTotalInr => estimatedTotalPaise / 100.0;

  bool get isTerminal => status == 'accepted' || status == 'declined';
  bool get canAcceptOrDecline => status == 'quoted';
  bool get isAccepted => status == 'accepted';
  bool get isDeclined => status == 'declined';
  bool get isQuoted => status == 'quoted';
  bool get isAcknowledged => status == 'acknowledged';
  bool get isDispatched => status == 'dispatched';

  factory RfqPackageModel.fromMap(Map<String, dynamic> map, [String? docId]) {
    final rawLineItems = map['lineItems'];
    final List<RfqLineItemModel> items = [];
    if (rawLineItems is List) {
      for (final raw in rawLineItems) {
        if (raw is Map<String, dynamic>) {
          items.add(RfqLineItemModel.fromMap(raw));
        } else if (raw is Map) {
          items.add(RfqLineItemModel.fromMap(Map<String, dynamic>.from(raw)));
        }
      }
    }

    final rawMatchedVendors = map['matchedVendorIds'];
    final List<String> vendors = [];
    if (rawMatchedVendors is List) {
      for (final v in rawMatchedVendors) {
        if (v != null) vendors.add(v.toString());
      }
    }

    final rawItemPrices = map['itemPrices'];
    final List<RfqItemPriceModel> itemPricesList = [];
    if (rawItemPrices is List) {
      for (final raw in rawItemPrices) {
        if (raw is Map<String, dynamic>) {
          itemPricesList.add(RfqItemPriceModel.fromMap(raw));
        } else if (raw is Map) {
          itemPricesList.add(RfqItemPriceModel.fromMap(Map<String, dynamic>.from(raw)));
        }
      }
    }

    return RfqPackageModel(
      id: docId ?? map['id']?.toString() ?? map['packageId']?.toString() ?? '',
      workflowId: map['workflowId']?.toString() ?? '',
      rfqBatchId: map['rfqBatchId']?.toString() ?? '',
      category: map['category']?.toString() ?? 'Other',
      title: map['title']?.toString() ?? '',
      eventName: map['eventName']?.toString(),
      eventDate: map['eventDate']?.toString(),
      venueName: map['venueName']?.toString(),
      guestCount: (map['guestCount'] as num?)?.toInt(),
      status: map['status']?.toString() ?? 'draft',
      lineItems: items,
      matchedVendorIds: vendors,
      assignedVendorId: map['assignedVendorId']?.toString() ?? map['vendorId']?.toString(),
      quotedAmountPaise: (map['quotedAmountPaise'] as num?)?.toInt(),
      counterBidAmountPaise: (map['counterBidAmountPaise'] as num?)?.toInt(),
      itemPrices: itemPricesList.isNotEmpty ? itemPricesList : null,
      notes: map['notes']?.toString(),
      quoteValidityDays: (map['quoteValidityDays'] as num?)?.toInt(),
      deliveryCommitment: map['deliveryCommitment']?.toString(),
      dispatchedAtIso: map['dispatchedAtIso']?.toString() ?? map['dispatchedAt']?.toString(),
      acknowledgedAtIso: map['acknowledgedAtIso']?.toString() ?? map['acknowledgedAt']?.toString(),
      quotedAtIso: map['quotedAtIso']?.toString() ?? map['quotedAt']?.toString(),
      acceptedAtIso: map['acceptedAtIso']?.toString() ?? map['acceptedAt']?.toString(),
      declinedAtIso: map['declinedAtIso']?.toString() ?? map['declinedAt']?.toString(),
      declineReason: map['declineReason']?.toString(),
      paymentMilestoneId: map['paymentMilestoneId']?.toString(),
      deliveryDeadlineIso: map['deliveryDeadlineIso']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'packageId': id,
      'workflowId': workflowId,
      'rfqBatchId': rfqBatchId,
      'category': category,
      'title': title,
      if (eventName != null) 'eventName': eventName,
      if (eventDate != null) 'eventDate': eventDate,
      if (venueName != null) 'venueName': venueName,
      if (guestCount != null) 'guestCount': guestCount,
      'status': status,
      'lineItems': lineItems.map((e) => e.toMap()).toList(),
      'matchedVendorIds': matchedVendorIds,
      if (assignedVendorId != null) 'assignedVendorId': assignedVendorId,
      if (assignedVendorId != null) 'vendorId': assignedVendorId,
      if (quotedAmountPaise != null) 'quotedAmountPaise': quotedAmountPaise,
      if (counterBidAmountPaise != null)
        'counterBidAmountPaise': counterBidAmountPaise,
      if (itemPrices != null)
        'itemPrices': itemPrices!.map((e) => e.toMap()).toList(),
      if (notes != null) 'notes': notes,
      if (quoteValidityDays != null) 'quoteValidityDays': quoteValidityDays,
      if (deliveryCommitment != null) 'deliveryCommitment': deliveryCommitment,
      if (dispatchedAtIso != null) 'dispatchedAtIso': dispatchedAtIso,
      if (acknowledgedAtIso != null) 'acknowledgedAtIso': acknowledgedAtIso,
      if (quotedAtIso != null) 'quotedAtIso': quotedAtIso,
      if (acceptedAtIso != null) 'acceptedAtIso': acceptedAtIso,
      if (declinedAtIso != null) 'declinedAtIso': declinedAtIso,
      if (declineReason != null) 'declineReason': declineReason,
      if (paymentMilestoneId != null) 'paymentMilestoneId': paymentMilestoneId,
      if (deliveryDeadlineIso != null)
        'deliveryDeadlineIso': deliveryDeadlineIso,
    };
  }

  RfqPackageModel copyWith({
    String? status,
    String? assignedVendorId,
    int? quotedAmountPaise,
    int? counterBidAmountPaise,
    List<RfqItemPriceModel>? itemPrices,
    String? notes,
    int? quoteValidityDays,
    String? deliveryCommitment,
    String? acknowledgedAtIso,
    String? quotedAtIso,
    String? acceptedAtIso,
    String? declinedAtIso,
    String? declineReason,
    String? paymentMilestoneId,
  }) {
    return RfqPackageModel(
      id: id,
      workflowId: workflowId,
      rfqBatchId: rfqBatchId,
      category: category,
      title: title,
      eventName: eventName,
      eventDate: eventDate,
      venueName: venueName,
      guestCount: guestCount,
      status: status ?? this.status,
      lineItems: lineItems,
      matchedVendorIds: matchedVendorIds,
      assignedVendorId: assignedVendorId ?? this.assignedVendorId,
      quotedAmountPaise: quotedAmountPaise ?? this.quotedAmountPaise,
      counterBidAmountPaise:
          counterBidAmountPaise ?? this.counterBidAmountPaise,
      itemPrices: itemPrices ?? this.itemPrices,
      notes: notes ?? this.notes,
      quoteValidityDays: quoteValidityDays ?? this.quoteValidityDays,
      deliveryCommitment: deliveryCommitment ?? this.deliveryCommitment,
      dispatchedAtIso: dispatchedAtIso,
      acknowledgedAtIso: acknowledgedAtIso ?? this.acknowledgedAtIso,
      quotedAtIso: quotedAtIso ?? this.quotedAtIso,
      acceptedAtIso: acceptedAtIso ?? this.acceptedAtIso,
      declinedAtIso: declinedAtIso ?? this.declinedAtIso,
      declineReason: declineReason ?? this.declineReason,
      paymentMilestoneId: paymentMilestoneId ?? this.paymentMilestoneId,
      deliveryDeadlineIso: deliveryDeadlineIso,
    );
  }
}

/// Represents the top-level RFQ Batch summary for an event workflow.
class RfqBatchModel {
  final String id;
  final String workflowId;
  final String eventName;
  final String? eventDate;
  final String? venueName;
  final int? guestCount;
  final String status;
  final int totalPackages;
  final int totalEstimatedCostPaise;
  final int totalApprovedCostPaise;
  final bool isFullyAccepted;
  final List<RfqPackageModel> packages;
  final String? deliveryDeadlineIso;
  final String? createdAtIso;

  const RfqBatchModel({
    required this.id,
    required this.workflowId,
    required this.eventName,
    this.eventDate,
    this.venueName,
    this.guestCount,
    required this.status,
    required this.totalPackages,
    required this.totalEstimatedCostPaise,
    required this.totalApprovedCostPaise,
    required this.isFullyAccepted,
    required this.packages,
    this.deliveryDeadlineIso,
    this.createdAtIso,
  });

  double get totalEstimatedCostInr => totalEstimatedCostPaise / 100.0;
  double get totalApprovedCostInr => totalApprovedCostPaise / 100.0;

  int get acceptedPackagesCount =>
      packages.where((p) => p.status == 'accepted').length;

  int get quotedPackagesCount =>
      packages.where((p) => p.status == 'quoted').length;

  int get pendingPackagesCount =>
      packages.where((p) => !p.isTerminal).length;

  factory RfqBatchModel.fromMap(Map<String, dynamic> map, [String? docId]) {
    final rawPackages = map['packages'];
    final List<RfqPackageModel> pkgs = [];
    if (rawPackages is List) {
      for (final raw in rawPackages) {
        if (raw is Map<String, dynamic>) {
          pkgs.add(RfqPackageModel.fromMap(raw));
        } else if (raw is Map) {
          pkgs.add(RfqPackageModel.fromMap(Map<String, dynamic>.from(raw)));
        }
      }
    }

    return RfqBatchModel(
      id: docId ?? map['id']?.toString() ?? map['rfqBatchId']?.toString() ?? '',
      workflowId: map['workflowId']?.toString() ?? '',
      eventName: map['eventName']?.toString() ?? '',
      eventDate: map['eventDate']?.toString(),
      venueName: map['venueName']?.toString(),
      guestCount: (map['guestCount'] as num?)?.toInt(),
      status: map['status']?.toString() ?? 'dispatched',
      totalPackages: (map['totalPackages'] as num?)?.toInt() ?? pkgs.length,
      totalEstimatedCostPaise:
          (map['totalEstimatedCostPaise'] as num?)?.toInt() ?? 0,
      totalApprovedCostPaise:
          (map['totalApprovedCostPaise'] as num?)?.toInt() ?? 0,
      isFullyAccepted: map['isFullyAccepted'] == true,
      packages: pkgs,
      deliveryDeadlineIso: map['deliveryDeadlineIso']?.toString(),
      createdAtIso: map['createdAtIso']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'workflowId': workflowId,
      'eventName': eventName,
      if (eventDate != null) 'eventDate': eventDate,
      if (venueName != null) 'venueName': venueName,
      if (guestCount != null) 'guestCount': guestCount,
      'status': status,
      'totalPackages': totalPackages,
      'totalEstimatedCostPaise': totalEstimatedCostPaise,
      'totalApprovedCostPaise': totalApprovedCostPaise,
      'isFullyAccepted': isFullyAccepted,
      'packages': packages.map((e) => e.toMap()).toList(),
      if (deliveryDeadlineIso != null)
        'deliveryDeadlineIso': deliveryDeadlineIso,
      if (createdAtIso != null) 'createdAtIso': createdAtIso,
    };
  }
}

/// Result returned from accepting a vendor quotation.
class RfqAcceptanceResult {
  final bool success;
  final String? paymentMilestoneId;
  final RfqPackageModel? package;

  const RfqAcceptanceResult({
    required this.success,
    this.paymentMilestoneId,
    this.package,
  });

  factory RfqAcceptanceResult.fromMap(Map<String, dynamic> map) {
    return RfqAcceptanceResult(
      success: map['success'] == true,
      paymentMilestoneId: map['paymentMilestoneId']?.toString(),
      package: map['package'] is Map
          ? RfqPackageModel.fromMap(Map<String, dynamic>.from(map['package']))
          : null,
    );
  }
}
