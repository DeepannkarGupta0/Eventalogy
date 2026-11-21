import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

class SettlementCalculationInputsModel {
  final int grossAmountPaise;
  final int platformFeeBps;
  final int platformFeePaise;
  final int withholdingTaxBps;
  final int withholdingTaxPaise;
  final int netAmountPaise;
  final String currency;
  final String? notes;

  const SettlementCalculationInputsModel({
    required this.grossAmountPaise,
    required this.platformFeeBps,
    required this.platformFeePaise,
    required this.withholdingTaxBps,
    required this.withholdingTaxPaise,
    required this.netAmountPaise,
    required this.currency,
    this.notes,
  });

  factory SettlementCalculationInputsModel.fromMap(Map<String, dynamic> map) {
    return SettlementCalculationInputsModel(
      grossAmountPaise: (map['grossAmountPaise'] as num?)?.toInt() ?? 0,
      platformFeeBps: (map['platformFeeBps'] as num?)?.toInt() ?? 0,
      platformFeePaise: (map['platformFeePaise'] as num?)?.toInt() ?? 0,
      withholdingTaxBps: (map['withholdingTaxBps'] as num?)?.toInt() ?? 0,
      withholdingTaxPaise: (map['withholdingTaxPaise'] as num?)?.toInt() ?? 0,
      netAmountPaise: (map['netAmountPaise'] as num?)?.toInt() ?? 0,
      currency: (map['currency'] as String?) ?? 'INR',
      notes: map['notes'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'grossAmountPaise': grossAmountPaise,
      'platformFeeBps': platformFeeBps,
      'platformFeePaise': platformFeePaise,
      'withholdingTaxBps': withholdingTaxBps,
      'withholdingTaxPaise': withholdingTaxPaise,
      'netAmountPaise': netAmountPaise,
      'currency': currency,
      if (notes != null) 'notes': notes,
    };
  }
}

class SettlementModel {
  final String settlementId;
  final String proposalReference;
  final String eventId;
  final String? bookingId;
  final String paymentId;
  final String vendorId;
  final String allocationId;
  final String currency;
  final int grossAmountPaise;
  final int deductionsPaise;
  final int netAmountPaise;
  final String status;
  final SettlementCalculationInputsModel calculationInputs;

  // Provenance
  final String proposedBy;
  final DateTime? proposedAt;
  final String? resubmittedFromSettlementId;
  final String? approvedBy;
  final DateTime? approvedAt;
  final String? rejectedBy;
  final DateTime? rejectedAt;
  final String? rejectionReason;

  // Disbursement boundaries
  final String? disbursementStatus;
  final String? disbursementBlockedReason;
  final String? payoutReference;
  final String? reconciliationEvidence;
  final String? reconciliationType;
  final String? reconciledBy;
  final DateTime? reconciledAt;

  // Reversal
  final String? reversedBy;
  final DateTime? reversedAt;
  final String? reversalReason;

  final DateTime? createdAt;
  final DateTime? updatedAt;
  final Map<String, dynamic>? metadata;

  const SettlementModel({
    required this.settlementId,
    required this.proposalReference,
    required this.eventId,
    this.bookingId,
    required this.paymentId,
    required this.vendorId,
    required this.allocationId,
    this.currency = 'INR',
    required this.grossAmountPaise,
    required this.deductionsPaise,
    required this.netAmountPaise,
    required this.status,
    required this.calculationInputs,
    required this.proposedBy,
    this.proposedAt,
    this.resubmittedFromSettlementId,
    this.approvedBy,
    this.approvedAt,
    this.rejectedBy,
    this.rejectedAt,
    this.rejectionReason,
    this.disbursementStatus,
    this.disbursementBlockedReason,
    this.payoutReference,
    this.reconciliationEvidence,
    this.reconciliationType,
    this.reconciledBy,
    this.reconciledAt,
    this.reversedBy,
    this.reversedAt,
    this.reversalReason,
    this.createdAt,
    this.updatedAt,
    this.metadata,
  });

  static DateTime? _parseDateTime(dynamic val) {
    if (val == null) return null;
    if (val is Timestamp) return val.toDate();
    if (val is String) return DateTime.tryParse(val);
    if (val is int) return DateTime.fromMillisecondsSinceEpoch(val);
    if (val is Map && val.containsKey('_seconds')) {
      final seconds = val['_seconds'] as int? ?? 0;
      final nanoseconds = val['_nanoseconds'] as int? ?? 0;
      return Timestamp(seconds, nanoseconds).toDate();
    }
    return null;
  }

  factory SettlementModel.fromMap(Map<String, dynamic> map, [String? id]) {
    final calcMap = map['calculationInputs'] is Map<String, dynamic>
        ? map['calculationInputs'] as Map<String, dynamic>
        : (map['calculationInputs'] is Map
            ? Map<String, dynamic>.from(map['calculationInputs'] as Map)
            : <String, dynamic>{});

    return SettlementModel(
      settlementId: (map['settlementId'] as String?) ?? id ?? '',
      proposalReference: (map['proposalReference'] as String?) ?? '',
      eventId: (map['eventId'] as String?) ?? '',
      bookingId: map['bookingId'] as String?,
      paymentId: (map['paymentId'] as String?) ?? '',
      vendorId: (map['vendorId'] as String?) ?? '',
      allocationId: (map['allocationId'] as String?) ?? '',
      currency: (map['currency'] as String?) ?? 'INR',
      grossAmountPaise: (map['grossAmountPaise'] as num?)?.toInt() ?? 0,
      deductionsPaise: (map['deductionsPaise'] as num?)?.toInt() ?? 0,
      netAmountPaise: (map['netAmountPaise'] as num?)?.toInt() ?? 0,
      status: (map['status'] as String?) ?? 'pending_approval',
      calculationInputs: SettlementCalculationInputsModel.fromMap(calcMap),
      proposedBy: (map['proposedBy'] as String?) ?? '',
      proposedAt: _parseDateTime(map['proposedAt']),
      resubmittedFromSettlementId: map['resubmittedFromSettlementId'] as String?,
      approvedBy: map['approvedBy'] as String?,
      approvedAt: _parseDateTime(map['approvedAt']),
      rejectedBy: map['rejectedBy'] as String?,
      rejectedAt: _parseDateTime(map['rejectedAt']),
      rejectionReason: map['rejectionReason'] as String?,
      disbursementStatus: map['disbursementStatus'] as String?,
      disbursementBlockedReason: map['disbursementBlockedReason'] as String?,
      payoutReference: map['payoutReference'] as String?,
      reconciliationEvidence: map['reconciliationEvidence'] as String?,
      reconciliationType: map['reconciliationType'] as String?,
      reconciledBy: map['reconciledBy'] as String?,
      reconciledAt: _parseDateTime(map['reconciledAt']),
      reversedBy: map['reversedBy'] as String?,
      reversedAt: _parseDateTime(map['reversedAt']),
      reversalReason: map['reversalReason'] as String?,
      createdAt: _parseDateTime(map['createdAt']),
      updatedAt: _parseDateTime(map['updatedAt']),
      metadata: map['metadata'] != null
          ? Map<String, dynamic>.from(map['metadata'] as Map)
          : null,
    );
  }

  factory SettlementModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return SettlementModel.fromMap(data, doc.id);
  }

  Map<String, dynamic> toMap() {
    return {
      'settlementId': settlementId,
      'proposalReference': proposalReference,
      'eventId': eventId,
      if (bookingId != null) 'bookingId': bookingId,
      'paymentId': paymentId,
      'vendorId': vendorId,
      'allocationId': allocationId,
      'currency': currency,
      'grossAmountPaise': grossAmountPaise,
      'deductionsPaise': deductionsPaise,
      'netAmountPaise': netAmountPaise,
      'status': status,
      'calculationInputs': calculationInputs.toMap(),
      'proposedBy': proposedBy,
      if (proposedAt != null) 'proposedAt': Timestamp.fromDate(proposedAt!),
      if (resubmittedFromSettlementId != null)
        'resubmittedFromSettlementId': resubmittedFromSettlementId,
      if (approvedBy != null) 'approvedBy': approvedBy,
      if (approvedAt != null) 'approvedAt': Timestamp.fromDate(approvedAt!),
      if (rejectedBy != null) 'rejectedBy': rejectedBy,
      if (rejectedAt != null) 'rejectedAt': Timestamp.fromDate(rejectedAt!),
      if (rejectionReason != null) 'rejectionReason': rejectionReason,
      if (disbursementStatus != null) 'disbursementStatus': disbursementStatus,
      if (disbursementBlockedReason != null)
        'disbursementBlockedReason': disbursementBlockedReason,
      if (payoutReference != null) 'payoutReference': payoutReference,
      if (reconciliationEvidence != null)
        'reconciliationEvidence': reconciliationEvidence,
      if (reconciliationType != null)
        'reconciliationType': reconciliationType,
      if (reconciledBy != null) 'reconciledBy': reconciledBy,
      if (reconciledAt != null) 'reconciledAt': Timestamp.fromDate(reconciledAt!),
      if (reversedBy != null) 'reversedBy': reversedBy,
      if (reversedAt != null) 'reversedAt': Timestamp.fromDate(reversedAt!),
      if (reversalReason != null) 'reversalReason': reversalReason,
      if (createdAt != null) 'createdAt': Timestamp.fromDate(createdAt!),
      if (updatedAt != null) 'updatedAt': Timestamp.fromDate(updatedAt!),
      if (metadata != null) 'metadata': metadata,
    };
  }

  // --- Financial & Formatting Helpers ---
  double get grossAmountINR => grossAmountPaise / 100.0;
  double get deductionsINR => deductionsPaise / 100.0;
  double get netAmountINR => netAmountPaise / 100.0;
  double get platformFeeINR => calculationInputs.platformFeePaise / 100.0;
  double get withholdingTaxINR => calculationInputs.withholdingTaxPaise / 100.0;

  static final NumberFormat _inrFormatter = NumberFormat('#,##,##0.00', 'en_IN');

  String get formattedGross => '₹${_inrFormatter.format(grossAmountINR)}';
  String get formattedDeductions => '₹${_inrFormatter.format(deductionsINR)}';
  String get formattedNet => '₹${_inrFormatter.format(netAmountINR)}';
  String get formattedPlatformFee =>
      '₹${_inrFormatter.format(platformFeeINR)} (${(calculationInputs.platformFeeBps / 100.0).toStringAsFixed(1)}%)';
  String get formattedWithholdingTax =>
      '₹${_inrFormatter.format(withholdingTaxINR)} (${(calculationInputs.withholdingTaxBps / 100.0).toStringAsFixed(1)}%)';

  bool get isPendingApproval => status == 'pending_approval';
  bool get isApproved => status == 'approved';
  bool get isPaid => status == 'paid';
  bool get isRejected => status == 'rejected';
  bool get isReversed => status == 'reversed';
  bool get isPayoutBlocked =>
      disbursementStatus == 'payout_not_configured' ||
      disbursementBlockedReason != null;

  String get statusDisplayLabel {
    switch (status.toLowerCase()) {
      case 'pending_approval':
        return 'Pending Approval';
      case 'approved':
        return disbursementStatus == 'payout_not_configured'
            ? 'Approved — Payout Not Configured'
            : 'Approved';
      case 'paid':
        return (reconciliationType == 'manual_ledger' || reconciliationEvidence != null)
            ? 'Manual Ledger Reconciliation Recorded'
            : 'External Transfer Confirmed';
      case 'rejected':
        return 'Rejected';
      case 'reversed':
        return 'Reversed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.toUpperCase().replaceAll('_', ' ');
    }
  }
}

class EligibleAllocationModel {
  final String allocationId;
  final String eventId;
  final String? eventTitle;
  final String vendorId;
  final String? vendorName;
  final String? bookingId;
  final String? serviceId;
  final int contractedAmountPaise;
  final int committedSettledPaise;
  final int pendingApprovalPaise;
  final int remainingEligiblePaise;
  final String? paymentId;
  final String paymentStatus;
  final String fulfillmentStatus;
  final String settlementEligibility;
  final bool isEligible;
  final String? blockedReason;
  final DateTime? completionApprovedAt;
  final String? completionApprovedBy;

  const EligibleAllocationModel({
    required this.allocationId,
    required this.eventId,
    this.eventTitle,
    required this.vendorId,
    this.vendorName,
    this.bookingId,
    this.serviceId,
    required this.contractedAmountPaise,
    required this.committedSettledPaise,
    required this.pendingApprovalPaise,
    required this.remainingEligiblePaise,
    this.paymentId,
    required this.paymentStatus,
    required this.fulfillmentStatus,
    required this.settlementEligibility,
    required this.isEligible,
    this.blockedReason,
    this.completionApprovedAt,
    this.completionApprovedBy,
  });

  factory EligibleAllocationModel.fromMap(Map<String, dynamic> map) {
    return EligibleAllocationModel(
      allocationId: (map['allocationId'] as String?) ?? '',
      eventId: (map['eventId'] as String?) ?? '',
      eventTitle: map['eventTitle'] as String?,
      vendorId: (map['vendorId'] as String?) ?? '',
      vendorName: map['vendorName'] as String?,
      bookingId: map['bookingId'] as String?,
      serviceId: map['serviceId'] as String?,
      contractedAmountPaise: (map['contractedAmountPaise'] as num?)?.toInt() ?? 0,
      committedSettledPaise: (map['committedSettledPaise'] as num?)?.toInt() ?? 0,
      pendingApprovalPaise: (map['pendingApprovalPaise'] as num?)?.toInt() ?? 0,
      remainingEligiblePaise: (map['remainingEligiblePaise'] as num?)?.toInt() ?? 0,
      paymentId: map['paymentId'] as String?,
      paymentStatus: (map['paymentStatus'] as String?) ?? 'unpaid',
      fulfillmentStatus: (map['fulfillmentStatus'] as String?) ?? 'unassigned',
      settlementEligibility: (map['settlementEligibility'] as String?) ?? 'not_eligible',
      isEligible: (map['isEligible'] as bool?) ?? (map['isEligibleForSettlement'] as bool?) ?? false,
      blockedReason: map['blockedReason'] as String?,
      completionApprovedAt: SettlementModel._parseDateTime(map['completionApprovedAt']),
      completionApprovedBy: map['completionApprovedBy'] as String?,
    );
  }

  static final NumberFormat _inrFormatter = NumberFormat('#,##,##0.00', 'en_IN');

  double get contractedAmountINR => contractedAmountPaise / 100.0;
  double get remainingEligibleINR => remainingEligiblePaise / 100.0;
  double get committedSettledINR => committedSettledPaise / 100.0;
  double get pendingApprovalINR => pendingApprovalPaise / 100.0;

  String get formattedContracted => '₹${_inrFormatter.format(contractedAmountINR)}';
  String get formattedRemaining => '₹${_inrFormatter.format(remainingEligibleINR)}';
  String get formattedCommitted => '₹${_inrFormatter.format(committedSettledINR)}';
  String get formattedPending => '₹${_inrFormatter.format(pendingApprovalINR)}';

  bool get isPaymentPaid => paymentStatus.toLowerCase() == 'paid';
  bool get isFulfillmentCompleted => fulfillmentStatus.toLowerCase() == 'completed';
}

class VendorSettlementCalculationBreakdownModel {
  final int grossAmountPaise;
  final int platformFeeBps;
  final int platformFeePaise;
  final int withholdingTaxBps;
  final int withholdingTaxPaise;
  final int netAmountPaise;
  final String currency;
  final bool isAvailable;

  const VendorSettlementCalculationBreakdownModel({
    required this.grossAmountPaise,
    required this.platformFeeBps,
    required this.platformFeePaise,
    required this.withholdingTaxBps,
    required this.withholdingTaxPaise,
    required this.netAmountPaise,
    this.currency = 'INR',
    this.isAvailable = true,
  });

  factory VendorSettlementCalculationBreakdownModel.fromMap(Map<String, dynamic> map) {
    return VendorSettlementCalculationBreakdownModel(
      grossAmountPaise: (map['grossAmountPaise'] as num?)?.toInt() ?? 0,
      platformFeeBps: (map['platformFeeBps'] as num?)?.toInt() ?? 0,
      platformFeePaise: (map['platformFeePaise'] as num?)?.toInt() ?? 0,
      withholdingTaxBps: (map['withholdingTaxBps'] as num?)?.toInt() ?? 0,
      withholdingTaxPaise: (map['withholdingTaxPaise'] as num?)?.toInt() ?? 0,
      netAmountPaise: (map['netAmountPaise'] as num?)?.toInt() ?? 0,
      currency: (map['currency'] as String?) ?? 'INR',
      isAvailable: (map['isAvailable'] as bool?) ?? true,
    );
  }

  static final NumberFormat _inrFormatter = NumberFormat('#,##,##0.00', 'en_IN');

  double get grossAmountINR => grossAmountPaise / 100.0;
  double get platformFeeINR => platformFeePaise / 100.0;
  double get withholdingTaxINR => withholdingTaxPaise / 100.0;
  double get netAmountINR => netAmountPaise / 100.0;

  String get formattedGross => '₹${_inrFormatter.format(grossAmountINR)}';
  String get formattedPlatformFee =>
      '₹${_inrFormatter.format(platformFeeINR)} (${(platformFeeBps / 100.0).toStringAsFixed(1)}%)';
  String get formattedWithholdingTax =>
      '₹${_inrFormatter.format(withholdingTaxINR)} (${(withholdingTaxBps / 100.0).toStringAsFixed(1)}%)';
  String get formattedNet => '₹${_inrFormatter.format(netAmountINR)}';
}

class VendorSettlementItemModel {
  final String settlementId;
  final String proposalReference;
  final String eventId;
  final String? eventTitle;
  final String? bookingId;
  final String vendorId;
  final String allocationId;
  final String? serviceId;
  final String currency;
  final int grossAmountPaise;
  final int deductionsPaise;
  final int netAmountPaise;
  final String status;
  final VendorSettlementCalculationBreakdownModel? calculationBreakdown;

  final DateTime? proposedAt;
  final DateTime? approvedAt;
  final DateTime? rejectedAt;
  final String? rejectionReason;

  final String? payoutReference;
  final String? reconciliationType;
  final String? reconciliationEvidence;
  final DateTime? reconciledAt;
  final String? disbursementStatus;
  final String? disbursementBlockedReason;

  final DateTime? createdAt;
  final DateTime? updatedAt;

  const VendorSettlementItemModel({
    required this.settlementId,
    required this.proposalReference,
    required this.eventId,
    this.eventTitle,
    this.bookingId,
    required this.vendorId,
    required this.allocationId,
    this.serviceId,
    this.currency = 'INR',
    required this.grossAmountPaise,
    required this.deductionsPaise,
    required this.netAmountPaise,
    required this.status,
    this.calculationBreakdown,
    this.proposedAt,
    this.approvedAt,
    this.rejectedAt,
    this.rejectionReason,
    this.payoutReference,
    this.reconciliationType,
    this.reconciliationEvidence,
    this.reconciledAt,
    this.disbursementStatus,
    this.disbursementBlockedReason,
    this.createdAt,
    this.updatedAt,
  });

  factory VendorSettlementItemModel.fromMap(Map<String, dynamic> map) {
    VendorSettlementCalculationBreakdownModel? breakdown;
    if (map['calculationBreakdown'] is Map) {
      breakdown = VendorSettlementCalculationBreakdownModel.fromMap(
        Map<String, dynamic>.from(map['calculationBreakdown'] as Map),
      );
    }

    return VendorSettlementItemModel(
      settlementId: (map['settlementId'] as String?) ?? '',
      proposalReference: (map['proposalReference'] as String?) ?? '',
      eventId: (map['eventId'] as String?) ?? '',
      eventTitle: map['eventTitle'] as String?,
      bookingId: map['bookingId'] as String?,
      vendorId: (map['vendorId'] as String?) ?? '',
      allocationId: (map['allocationId'] as String?) ?? '',
      serviceId: map['serviceId'] as String?,
      currency: (map['currency'] as String?) ?? 'INR',
      grossAmountPaise: (map['grossAmountPaise'] as num?)?.toInt() ?? 0,
      deductionsPaise: (map['deductionsPaise'] as num?)?.toInt() ?? 0,
      netAmountPaise: (map['netAmountPaise'] as num?)?.toInt() ?? 0,
      status: (map['status'] as String?) ?? 'pending_approval',
      calculationBreakdown: breakdown,
      proposedAt: SettlementModel._parseDateTime(map['proposedAt']),
      approvedAt: SettlementModel._parseDateTime(map['approvedAt']),
      rejectedAt: SettlementModel._parseDateTime(map['rejectedAt']),
      rejectionReason: map['rejectionReason'] as String?,
      payoutReference: map['payoutReference'] as String?,
      reconciliationType: map['reconciliationType'] as String?,
      reconciliationEvidence: map['reconciliationEvidence'] as String?,
      reconciledAt: SettlementModel._parseDateTime(map['reconciledAt']),
      disbursementStatus: map['disbursementStatus'] as String?,
      disbursementBlockedReason: map['disbursementBlockedReason'] as String?,
      createdAt: SettlementModel._parseDateTime(map['createdAt']),
      updatedAt: SettlementModel._parseDateTime(map['updatedAt']),
    );
  }

  static final NumberFormat _inrFormatter = NumberFormat('#,##,##0.00', 'en_IN');

  double get grossAmountINR => grossAmountPaise / 100.0;
  double get deductionsINR => deductionsPaise / 100.0;
  double get netAmountINR => netAmountPaise / 100.0;

  String get formattedGross => '₹${_inrFormatter.format(grossAmountINR)}';
  String get formattedDeductions => '₹${_inrFormatter.format(deductionsINR)}';
  String get formattedNet => '₹${_inrFormatter.format(netAmountINR)}';

  bool get isPendingApproval => status == 'pending_approval';
  bool get isApproved => status == 'approved';
  bool get isPaid => status == 'paid';
  bool get isRejected => status == 'rejected';
  bool get isReversed => status == 'reversed';
  bool get isPayoutBlocked =>
      disbursementStatus == 'payout_not_configured' || disbursementBlockedReason != null;

  String get statusDisplayLabel {
    switch (status.toLowerCase()) {
      case 'pending_approval':
        return 'Pending Approval';
      case 'approved':
        return disbursementStatus == 'payout_not_configured'
            ? 'Approved — Payout Not Configured'
            : 'Approved';
      case 'paid':
        return (reconciliationType == 'manual_ledger' || reconciliationEvidence != null)
            ? 'Manual Ledger Reconciliation Recorded'
            : 'External Transfer Confirmed';
      case 'rejected':
        return 'Rejected';
      case 'reversed':
        return 'Reversed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.toUpperCase().replaceAll('_', ' ');
    }
  }
}

class VendorSettlementSummaryModel {
  final String currency;
  final int totalGrossPaise;
  final int pendingApprovalGrossPaise;
  final int approvedReservedNetPaise;
  final int reconciledPaidNetPaise;
  final int rejectedGrossPaise;
  final int totalPlatformFeePaise;
  final int totalWithholdingTaxPaise;
  final int totalDeductionsPaise;
  final int netDisbursablePaise;
  final bool disbursementConfigured;
  final String systemLimitationNotice;

  const VendorSettlementSummaryModel({
    this.currency = 'INR',
    required this.totalGrossPaise,
    required this.pendingApprovalGrossPaise,
    required this.approvedReservedNetPaise,
    required this.reconciledPaidNetPaise,
    required this.rejectedGrossPaise,
    required this.totalPlatformFeePaise,
    required this.totalWithholdingTaxPaise,
    required this.totalDeductionsPaise,
    required this.netDisbursablePaise,
    this.disbursementConfigured = false,
    required this.systemLimitationNotice,
  });

  factory VendorSettlementSummaryModel.fromMap(Map<String, dynamic> map) {
    return VendorSettlementSummaryModel(
      currency: (map['currency'] as String?) ?? 'INR',
      totalGrossPaise: (map['totalGrossPaise'] as num?)?.toInt() ?? 0,
      pendingApprovalGrossPaise: (map['pendingApprovalGrossPaise'] as num?)?.toInt() ?? 0,
      approvedReservedNetPaise: (map['approvedReservedNetPaise'] as num?)?.toInt() ?? 0,
      reconciledPaidNetPaise: (map['reconciledPaidNetPaise'] as num?)?.toInt() ?? 0,
      rejectedGrossPaise: (map['rejectedGrossPaise'] as num?)?.toInt() ?? 0,
      totalPlatformFeePaise: (map['totalPlatformFeePaise'] as num?)?.toInt() ?? 0,
      totalWithholdingTaxPaise: (map['totalWithholdingTaxPaise'] as num?)?.toInt() ?? 0,
      totalDeductionsPaise: (map['totalDeductionsPaise'] as num?)?.toInt() ?? 0,
      netDisbursablePaise: (map['netDisbursablePaise'] as num?)?.toInt() ?? 0,
      disbursementConfigured: (map['disbursementConfigured'] as bool?) ?? false,
      systemLimitationNotice: (map['systemLimitationNotice'] as String?) ??
          'Automated payouts are currently unconfigured. Reconciled entries reflect verified internal accounting records and are not proof of external bank transfers.',
    );
  }

  static final NumberFormat _inrFormatter = NumberFormat('#,##,##0.00', 'en_IN');

  double get totalGrossINR => totalGrossPaise / 100.0;
  double get pendingApprovalGrossINR => pendingApprovalGrossPaise / 100.0;
  double get approvedReservedNetINR => approvedReservedNetPaise / 100.0;
  double get reconciledPaidNetINR => reconciledPaidNetPaise / 100.0;
  double get rejectedGrossINR => rejectedGrossPaise / 100.0;
  double get totalPlatformFeeINR => totalPlatformFeePaise / 100.0;
  double get totalWithholdingTaxINR => totalWithholdingTaxPaise / 100.0;
  double get totalDeductionsINR => totalDeductionsPaise / 100.0;
  double get netDisbursableINR => netDisbursablePaise / 100.0;

  String get formattedTotalGross => '₹${_inrFormatter.format(totalGrossINR)}';
  String get formattedPendingApproval => '₹${_inrFormatter.format(pendingApprovalGrossINR)}';
  String get formattedApprovedReserved => '₹${_inrFormatter.format(approvedReservedNetINR)}';
  String get formattedReconciledPaid => '₹${_inrFormatter.format(reconciledPaidNetINR)}';
  String get formattedRejected => '₹${_inrFormatter.format(rejectedGrossINR)}';
  String get formattedTotalPlatformFee => '₹${_inrFormatter.format(totalPlatformFeeINR)}';
  String get formattedTotalWithholdingTax => '₹${_inrFormatter.format(totalWithholdingTaxINR)}';
  String get formattedTotalDeductions => '₹${_inrFormatter.format(totalDeductionsINR)}';
  String get formattedNetDisbursable => '₹${_inrFormatter.format(netDisbursableINR)}';
}

class VendorSettlementHistoryResponseModel {
  final String vendorId;
  final List<VendorSettlementItemModel> settlements;
  final VendorSettlementSummaryModel summary;

  const VendorSettlementHistoryResponseModel({
    required this.vendorId,
    required this.settlements,
    required this.summary,
  });

  factory VendorSettlementHistoryResponseModel.fromMap(Map<String, dynamic> map) {
    final list = map['settlements'] as List<dynamic>? ?? [];
    final summaryMap = map['summary'] is Map
        ? Map<String, dynamic>.from(map['summary'] as Map)
        : <String, dynamic>{};

    return VendorSettlementHistoryResponseModel(
      vendorId: (map['vendorId'] as String?) ?? '',
      settlements: list
          .map((item) => VendorSettlementItemModel.fromMap(
                Map<String, dynamic>.from(item as Map),
              ))
          .toList(),
      summary: VendorSettlementSummaryModel.fromMap(summaryMap),
    );
  }
}
