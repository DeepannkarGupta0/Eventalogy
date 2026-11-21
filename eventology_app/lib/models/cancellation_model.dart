import 'package:cloud_firestore/cloud_firestore.dart';

class CancellationCalculationModel {
  final String policyVersion;
  final String windowTier;
  final int grossPaidPaise;
  final int deductionBps;
  final int deductionPaise;
  final int refundEstimatePaise;
  final int? approvedRefundPaise;
  final bool isCustomReviewRequired;
  final String rationale;

  const CancellationCalculationModel({
    required this.policyVersion,
    required this.windowTier,
    required this.grossPaidPaise,
    required this.deductionBps,
    required this.deductionPaise,
    required this.refundEstimatePaise,
    this.approvedRefundPaise,
    required this.isCustomReviewRequired,
    required this.rationale,
  });

  factory CancellationCalculationModel.fromMap(Map<String, dynamic> data) {
    return CancellationCalculationModel(
      policyVersion: data['policyVersion'] as String? ?? 'POL-CAN-2026-V1',
      windowTier: data['windowTier'] as String? ?? 'standard_pre_event',
      grossPaidPaise: (data['grossPaidPaise'] as num?)?.toInt() ?? 0,
      deductionBps: (data['deductionBps'] as num?)?.toInt() ?? 0,
      deductionPaise: (data['deductionPaise'] as num?)?.toInt() ?? 0,
      refundEstimatePaise: (data['refundEstimatePaise'] as num?)?.toInt() ?? 0,
      approvedRefundPaise: (data['approvedRefundPaise'] as num?)?.toInt(),
      isCustomReviewRequired: data['isCustomReviewRequired'] as bool? ?? false,
      rationale: data['rationale'] as String? ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'policyVersion': policyVersion,
      'windowTier': windowTier,
      'grossPaidPaise': grossPaidPaise,
      'deductionBps': deductionBps,
      'deductionPaise': deductionPaise,
      'refundEstimatePaise': refundEstimatePaise,
      if (approvedRefundPaise != null) 'approvedRefundPaise': approvedRefundPaise,
      'isCustomReviewRequired': isCustomReviewRequired,
      'rationale': rationale,
    };
  }

  double get grossPaidINR => grossPaidPaise / 100.0;
  double get deductionINR => deductionPaise / 100.0;
  double get refundEstimateINR => refundEstimatePaise / 100.0;
  double? get approvedRefundINR =>
      approvedRefundPaise != null ? approvedRefundPaise! / 100.0 : null;
}

class RefundExecutionModel {
  final String executedBy;
  final Timestamp? executedAt;
  final int amountPaise;
  final String mode;
  final String providerRefundId;
  final bool isSimulated;
  final String disclaimer;

  const RefundExecutionModel({
    required this.executedBy,
    this.executedAt,
    required this.amountPaise,
    required this.mode,
    required this.providerRefundId,
    required this.isSimulated,
    required this.disclaimer,
  });

  factory RefundExecutionModel.fromMap(Map<String, dynamic> data) {
    return RefundExecutionModel(
      executedBy: data['executedBy'] as String? ?? '',
      executedAt: data['executedAt'] is Timestamp
          ? data['executedAt'] as Timestamp
          : (data['executedAt'] is Map
              ? Timestamp(
                  (data['executedAt']['_seconds'] as num?)?.toInt() ?? 0,
                  (data['executedAt']['_nanoseconds'] as num?)?.toInt() ?? 0,
                )
              : null),
      amountPaise: (data['amountPaise'] as num?)?.toInt() ?? 0,
      mode: data['mode'] as String? ?? 'sandbox_simulated',
      providerRefundId: data['providerRefundId'] as String? ?? '',
      isSimulated: data['isSimulated'] as bool? ?? false,
      disclaimer: data['disclaimer'] as String? ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'executedBy': executedBy,
      if (executedAt != null) 'executedAt': executedAt,
      'amountPaise': amountPaise,
      'mode': mode,
      'providerRefundId': providerRefundId,
      'isSimulated': isSimulated,
      'disclaimer': disclaimer,
    };
  }

  double get amountINR => amountPaise / 100.0;
}

class CancellationRequestModel {
  final String requestId;
  final String bookingId;
  final String eventId;
  final String customerId;
  final String vendorId;
  final String? allocationId;

  final String cancellationStatus;
  final String refundStatus;

  final String reason;
  final String? customerNotes;

  final CancellationCalculationModel calculation;

  final bool hasSettlementConflict;
  final String? settlementConflictDetails;

  final String? reviewedBy;
  final Timestamp? reviewedAt;
  final String? reviewDecision;
  final String? decisionReason;
  final String? adminInternalNotes;

  final RefundExecutionModel? refundExecution;

  final Timestamp? createdAt;
  final Timestamp? updatedAt;

  const CancellationRequestModel({
    required this.requestId,
    required this.bookingId,
    required this.eventId,
    required this.customerId,
    required this.vendorId,
    this.allocationId,
    required this.cancellationStatus,
    required this.refundStatus,
    required this.reason,
    this.customerNotes,
    required this.calculation,
    this.hasSettlementConflict = false,
    this.settlementConflictDetails,
    this.reviewedBy,
    this.reviewedAt,
    this.reviewDecision,
    this.decisionReason,
    this.adminInternalNotes,
    this.refundExecution,
    this.createdAt,
    this.updatedAt,
  });

  factory CancellationRequestModel.fromMap(Map<String, dynamic> data) {
    return CancellationRequestModel(
      requestId: data['requestId'] as String? ?? '',
      bookingId: data['bookingId'] as String? ?? '',
      eventId: data['eventId'] as String? ?? '',
      customerId: data['customerId'] as String? ?? '',
      vendorId: data['vendorId'] as String? ?? '',
      allocationId: data['allocationId'] as String?,
      cancellationStatus: data['cancellationStatus'] as String? ?? 'cancellation_requested',
      refundStatus: data['refundStatus'] as String? ?? 'none',
      reason: data['reason'] as String? ?? '',
      customerNotes: data['customerNotes'] as String?,
      calculation: data['calculation'] != null
          ? CancellationCalculationModel.fromMap(
              Map<String, dynamic>.from(data['calculation'] as Map))
          : const CancellationCalculationModel(
              policyVersion: 'POL-CAN-2026-V1',
              windowTier: 'standard_pre_event',
              grossPaidPaise: 0,
              deductionBps: 0,
              deductionPaise: 0,
              refundEstimatePaise: 0,
              isCustomReviewRequired: false,
              rationale: '',
            ),
      hasSettlementConflict: data['hasSettlementConflict'] as bool? ?? false,
      settlementConflictDetails: data['settlementConflictDetails'] as String?,
      reviewedBy: data['reviewedBy'] as String?,
      reviewedAt: data['reviewedAt'] is Timestamp
          ? data['reviewedAt'] as Timestamp
          : (data['reviewedAt'] is Map
              ? Timestamp(
                  (data['reviewedAt']['_seconds'] as num?)?.toInt() ?? 0,
                  (data['reviewedAt']['_nanoseconds'] as num?)?.toInt() ?? 0,
                )
              : null),
      reviewDecision: data['reviewDecision'] as String?,
      decisionReason: data['decisionReason'] as String?,
      adminInternalNotes: data['adminInternalNotes'] as String?,
      refundExecution: data['refundExecution'] != null
          ? RefundExecutionModel.fromMap(
              Map<String, dynamic>.from(data['refundExecution'] as Map))
          : null,
      createdAt: data['createdAt'] is Timestamp
          ? data['createdAt'] as Timestamp
          : (data['createdAt'] is Map
              ? Timestamp(
                  (data['createdAt']['_seconds'] as num?)?.toInt() ?? 0,
                  (data['createdAt']['_nanoseconds'] as num?)?.toInt() ?? 0,
                )
              : null),
      updatedAt: data['updatedAt'] is Timestamp
          ? data['updatedAt'] as Timestamp
          : (data['updatedAt'] is Map
              ? Timestamp(
                  (data['updatedAt']['_seconds'] as num?)?.toInt() ?? 0,
                  (data['updatedAt']['_nanoseconds'] as num?)?.toInt() ?? 0,
                )
              : null),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'requestId': requestId,
      'bookingId': bookingId,
      'eventId': eventId,
      'customerId': customerId,
      'vendorId': vendorId,
      if (allocationId != null) 'allocationId': allocationId,
      'cancellationStatus': cancellationStatus,
      'refundStatus': refundStatus,
      'reason': reason,
      if (customerNotes != null) 'customerNotes': customerNotes,
      'calculation': calculation.toMap(),
      'hasSettlementConflict': hasSettlementConflict,
      if (settlementConflictDetails != null)
        'settlementConflictDetails': settlementConflictDetails,
      if (reviewedBy != null) 'reviewedBy': reviewedBy,
      if (reviewedAt != null) 'reviewedAt': reviewedAt,
      if (reviewDecision != null) 'reviewDecision': reviewDecision,
      if (decisionReason != null) 'decisionReason': decisionReason,
      if (adminInternalNotes != null) 'adminInternalNotes': adminInternalNotes,
      if (refundExecution != null) 'refundExecution': refundExecution!.toMap(),
      if (createdAt != null) 'createdAt': createdAt,
      if (updatedAt != null) 'updatedAt': updatedAt,
    };
  }

  bool get isPendingReview =>
      cancellationStatus == 'cancellation_requested' ||
      cancellationStatus == 'under_review';
  bool get isApproved => cancellationStatus == 'cancellation_approved';
  bool get isRejected => cancellationStatus == 'cancellation_rejected';
  bool get isCompleted => cancellationStatus == 'cancellation_completed';
  bool get isWithdrawn => cancellationStatus == 'request_withdrawn';
  bool get isRefundApproved => refundStatus == 'refund_approved';
  bool get isRefundConfirmed => refundStatus == 'refund_confirmed';
  bool get isSimulatedRefund => refundExecution?.isSimulated == true;

  String get statusDisplayLabel {
    switch (cancellationStatus) {
      case 'cancellation_requested':
      case 'under_review':
        return 'Pending Administrative Review';
      case 'cancellation_approved':
        if (refundStatus == 'refund_confirmed') {
          return 'Refund Confirmed (Simulated)';
        }
        if (refundStatus == 'refund_approved') {
          return 'Refund Approved — Awaiting Processing';
        }
        if (refundStatus == 'refund_rejected') {
          return 'Cancellation Approved (No Refund)';
        }
        return 'Cancellation Approved';
      case 'cancellation_completed':
        return isRefundConfirmed
            ? 'Cancellation Completed (Refund Executed)'
            : 'Cancellation Completed';
      case 'cancellation_rejected':
        return 'Cancellation Request Rejected';
      case 'request_withdrawn':
        return 'Cancellation Request Withdrawn';
      default:
        return cancellationStatus.toUpperCase();
    }
  }
}
