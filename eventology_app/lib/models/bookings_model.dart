import 'package:cloud_firestore/cloud_firestore.dart';

class BookingModel {
  final String bookingId;
  final String eventId;
  final String customerId;
  final String vendorId;
  final String serviceId;
  final String? venueId;
  final String? packageId;
  final double amount;
  final int? amountInPaise;
  final String currency;
  final String status;
  final String paymentStatus;
  final String? quotationId;
  final String? enquiryId;
  final String? allocationId;
  final String fulfillmentStatus;
  final List<Map<String, dynamic>> fulfillmentMilestones;
  final Map<String, dynamic>? completionEvidence;
  final Map<String, dynamic>? completionReview;
  final String? cancellationStatus;
  final String? cancellationRequestId;
  final Timestamp bookingDate;
  final Timestamp createdAt;
  final Timestamp? updatedAt;

  const BookingModel({
    required this.bookingId,
    required this.eventId,
    required this.customerId,
    required this.vendorId,
    required this.serviceId,
    this.venueId,
    this.packageId,
    required this.amount,
    this.amountInPaise,
    this.currency = 'INR',
    required this.status,
    required this.paymentStatus,
    this.quotationId,
    this.enquiryId,
    this.allocationId,
    this.cancellationStatus,
    this.cancellationRequestId,
    this.fulfillmentStatus = 'unassigned',
    this.fulfillmentMilestones = const [],
    this.completionEvidence,
    this.completionReview,
    required this.bookingDate,
    required this.createdAt,
    this.updatedAt,
  });

  factory BookingModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return BookingModel(
      bookingId: data['bookingId'] as String? ?? doc.id,
      eventId: data['eventId'] as String? ?? '',
      customerId: data['customerId'] as String? ?? '',
      vendorId: data['vendorId'] as String? ?? '',
      serviceId: data['serviceId'] as String? ?? '',
      venueId: data['venueId'] as String?,
      packageId: data['packageId'] as String?,
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      amountInPaise: (data['amountInPaise'] as num?)?.toInt(),
      currency: data['currency'] as String? ?? 'INR',
      status: data['status'] as String? ?? '',
      paymentStatus: data['paymentStatus'] as String? ?? '',
      quotationId: data['quotationId'] as String?,
      enquiryId: data['enquiryId'] as String?,
      allocationId: data['allocationId'] as String?,
      cancellationStatus: data['cancellationStatus'] as String?,
      cancellationRequestId: data['cancellationRequestId'] as String?,
      fulfillmentStatus: data['fulfillmentStatus'] as String? ??
          (data['status'] == 'confirmed' ? 'confirmed' : 'unassigned'),
      fulfillmentMilestones: (data['fulfillmentMilestones'] as List<dynamic>?)
              ?.map((m) => Map<String, dynamic>.from(m as Map))
              .toList() ??
          [],
      completionEvidence: data['completionEvidence'] != null
          ? Map<String, dynamic>.from(data['completionEvidence'] as Map)
          : null,
      completionReview: data['completionReview'] != null
          ? Map<String, dynamic>.from(data['completionReview'] as Map)
          : null,
      bookingDate: data['bookingDate'] as Timestamp? ?? Timestamp.now(),
      createdAt: data['createdAt'] as Timestamp? ?? Timestamp.now(),
      updatedAt: data['updatedAt'] as Timestamp?,
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'bookingId': bookingId,
      'eventId': eventId,
      'customerId': customerId,
      'vendorId': vendorId,
      'serviceId': serviceId,
      if (venueId != null) 'venueId': venueId,
      if (packageId != null) 'packageId': packageId,
      'amount': amount,
      if (amountInPaise != null) 'amountInPaise': amountInPaise,
      'currency': currency,
      'status': status,
      'paymentStatus': paymentStatus,
      if (quotationId != null) 'quotationId': quotationId,
      if (enquiryId != null) 'enquiryId': enquiryId,
      if (allocationId != null) 'allocationId': allocationId,
      if (cancellationStatus != null) 'cancellationStatus': cancellationStatus,
      if (cancellationRequestId != null) 'cancellationRequestId': cancellationRequestId,
      'fulfillmentStatus': fulfillmentStatus,
      'fulfillmentMilestones': fulfillmentMilestones,
      if (completionEvidence != null) 'completionEvidence': completionEvidence,
      if (completionReview != null) 'completionReview': completionReview,
      'bookingDate': bookingDate,
      'createdAt': createdAt,
      if (updatedAt != null) 'updatedAt': updatedAt,
    };
  }

  BookingModel copyWith({
    String? bookingId,
    String? eventId,
    String? customerId,
    String? vendorId,
    String? serviceId,
    String? venueId,
    String? packageId,
    double? amount,
    int? amountInPaise,
    String? currency,
    String? status,
    String? paymentStatus,
    String? quotationId,
    String? enquiryId,
    String? allocationId,
    String? cancellationStatus,
    String? cancellationRequestId,
    String? fulfillmentStatus,
    List<Map<String, dynamic>>? fulfillmentMilestones,
    Map<String, dynamic>? completionEvidence,
    Map<String, dynamic>? completionReview,
    Timestamp? bookingDate,
    Timestamp? createdAt,
    Timestamp? updatedAt,
  }) {
    return BookingModel(
      bookingId: bookingId ?? this.bookingId,
      eventId: eventId ?? this.eventId,
      customerId: customerId ?? this.customerId,
      vendorId: vendorId ?? this.vendorId,
      serviceId: serviceId ?? this.serviceId,
      venueId: venueId ?? this.venueId,
      packageId: packageId ?? this.packageId,
      amount: amount ?? this.amount,
      amountInPaise: amountInPaise ?? this.amountInPaise,
      currency: currency ?? this.currency,
      status: status ?? this.status,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      quotationId: quotationId ?? this.quotationId,
      enquiryId: enquiryId ?? this.enquiryId,
      allocationId: allocationId ?? this.allocationId,
      cancellationStatus: cancellationStatus ?? this.cancellationStatus,
      cancellationRequestId: cancellationRequestId ?? this.cancellationRequestId,
      fulfillmentStatus: fulfillmentStatus ?? this.fulfillmentStatus,
      fulfillmentMilestones: fulfillmentMilestones ?? this.fulfillmentMilestones,
      completionEvidence: completionEvidence ?? this.completionEvidence,
      completionReview: completionReview ?? this.completionReview,
      bookingDate: bookingDate ?? this.bookingDate,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  String get id => bookingId;
  double get totalAmount => amount;
  Timestamp get targetDate => bookingDate;
  bool get isPaid => paymentStatus.toLowerCase() == 'paid';
  bool get isUnpaid => !isPaid;
  bool get isRefunded => paymentStatus.toLowerCase() == 'refunded';
  bool get isCancelled => status.toLowerCase() == 'cancelled';
  bool get isCancellationRequested =>
      cancellationStatus == 'cancellation_requested' ||
      cancellationStatus == 'under_review';
  bool get isFulfillmentEligible => isPaid && status == 'confirmed';
  bool get isCompleted => fulfillmentStatus == 'completed';
  bool get isReviewPending => fulfillmentStatus == 'review_pending';
  bool get isDelivered => fulfillmentStatus == 'delivered';
  bool get isRejected => fulfillmentStatus == 'rejected';
}
