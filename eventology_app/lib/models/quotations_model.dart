import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

class QuotationLineItemModel {
  final String description;
  final int quantity;
  final int unitPricePaise;
  final int totalPaise;

  const QuotationLineItemModel({
    required this.description,
    required this.quantity,
    required this.unitPricePaise,
    required this.totalPaise,
  });

  factory QuotationLineItemModel.fromMap(Map<String, dynamic> map) {
    final qty = (map['quantity'] as num?)?.toInt() ?? 1;
    final unitPrice = (map['unitPricePaise'] as num?)?.toInt() ?? 0;
    final total = (map['totalPaise'] as num?)?.toInt() ?? (qty * unitPrice);

    return QuotationLineItemModel(
      description: map['description'] as String? ?? '',
      quantity: qty,
      unitPricePaise: unitPrice,
      totalPaise: total,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'description': description,
      'quantity': quantity,
      'unitPricePaise': unitPricePaise,
      'totalPaise': totalPaise,
    };
  }

  double get unitPriceRupees => unitPricePaise / 100.0;
  double get totalRupees => totalPaise / 100.0;

  String get formattedUnitPrice {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    return '₹${formatter.format(unitPriceRupees)}';
  }

  String get formattedTotal {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    return '₹${formatter.format(totalRupees)}';
  }
}

class QuotationModel {
  final String quotationId;
  final String enquiryId;
  final String eventId;
  final String customerId;
  final String vendorId;
  final String serviceId;
  final String currency;
  final List<QuotationLineItemModel> lineItems;
  final int subtotalPaise;
  final int taxPaise;
  final int totalAmountPaise;
  final List<String> inclusions;
  final List<String> exclusions;
  final String? notes;
  final DateTime validUntil;
  final String status; // 'submitted', 'accepted', 'declined', 'expired'
  final String? bookingId;
  final String? allocationId;
  final String submittedBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? acceptedAt;
  final DateTime? declinedAt;
  final String? declineReason;

  const QuotationModel({
    required this.quotationId,
    required this.enquiryId,
    required this.eventId,
    required this.customerId,
    required this.vendorId,
    required this.serviceId,
    this.currency = 'INR',
    required this.lineItems,
    required this.subtotalPaise,
    required this.taxPaise,
    required this.totalAmountPaise,
    this.inclusions = const [],
    this.exclusions = const [],
    this.notes,
    required this.validUntil,
    required this.status,
    this.bookingId,
    this.allocationId,
    required this.submittedBy,
    required this.createdAt,
    required this.updatedAt,
    this.acceptedAt,
    this.declinedAt,
    this.declineReason,
  });

  static DateTime _parseDateTime(dynamic val) {
    if (val is Timestamp) return val.toDate();
    if (val is String) {
      try {
        return DateTime.parse(val);
      } catch (_) {}
    }
    if (val is int) return DateTime.fromMillisecondsSinceEpoch(val);
    return DateTime.now();
  }

  factory QuotationModel.fromMap(Map<String, dynamic> map, [String? id]) {
    final lineItemsList = (map['lineItems'] as List?)
            ?.map((e) => QuotationLineItemModel.fromMap(Map<String, dynamic>.from(e as Map)))
            .toList() ??
        [];

    return QuotationModel(
      quotationId: (map['quotationId'] as String?) ?? id ?? '',
      enquiryId: map['enquiryId'] as String? ?? '',
      eventId: map['eventId'] as String? ?? '',
      customerId: map['customerId'] as String? ?? '',
      vendorId: map['vendorId'] as String? ?? '',
      serviceId: map['serviceId'] as String? ?? '',
      currency: map['currency'] as String? ?? 'INR',
      lineItems: lineItemsList,
      subtotalPaise: (map['subtotalPaise'] as num?)?.toInt() ?? 0,
      taxPaise: (map['taxPaise'] as num?)?.toInt() ?? 0,
      totalAmountPaise: (map['totalAmountPaise'] as num?)?.toInt() ?? 0,
      inclusions: (map['inclusions'] as List?)?.map((e) => e.toString()).toList() ?? [],
      exclusions: (map['exclusions'] as List?)?.map((e) => e.toString()).toList() ?? [],
      notes: map['notes'] as String?,
      validUntil: _parseDateTime(map['validUntil']),
      status: map['status'] as String? ?? 'submitted',
      bookingId: map['bookingId'] as String?,
      allocationId: map['allocationId'] as String?,
      submittedBy: map['submittedBy'] as String? ?? '',
      createdAt: _parseDateTime(map['createdAt']),
      updatedAt: _parseDateTime(map['updatedAt']),
      acceptedAt: map['acceptedAt'] != null ? _parseDateTime(map['acceptedAt']) : null,
      declinedAt: map['declinedAt'] != null ? _parseDateTime(map['declinedAt']) : null,
      declineReason: map['declineReason'] as String?,
    );
  }

  factory QuotationModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return QuotationModel.fromMap(data, doc.id);
  }

  Map<String, dynamic> toMap() {
    return {
      'quotationId': quotationId,
      'enquiryId': enquiryId,
      'eventId': eventId,
      'customerId': customerId,
      'vendorId': vendorId,
      'serviceId': serviceId,
      'currency': currency,
      'lineItems': lineItems.map((e) => e.toMap()).toList(),
      'subtotalPaise': subtotalPaise,
      'taxPaise': taxPaise,
      'totalAmountPaise': totalAmountPaise,
      'inclusions': inclusions,
      'exclusions': exclusions,
      if (notes != null) 'notes': notes,
      'validUntil': Timestamp.fromDate(validUntil),
      'status': status,
      if (bookingId != null) 'bookingId': bookingId,
      if (allocationId != null) 'allocationId': allocationId,
      'submittedBy': submittedBy,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': Timestamp.fromDate(updatedAt),
      if (acceptedAt != null) 'acceptedAt': Timestamp.fromDate(acceptedAt!),
      if (declinedAt != null) 'declinedAt': Timestamp.fromDate(declinedAt!),
      if (declineReason != null) 'declineReason': declineReason,
    };
  }

  double get subtotalRupees => subtotalPaise / 100.0;
  double get taxRupees => taxPaise / 100.0;
  double get totalAmountRupees => totalAmountPaise / 100.0;

  String get formattedSubtotal {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    return '₹${formatter.format(subtotalRupees)}';
  }

  String get formattedTax {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    return '₹${formatter.format(taxRupees)}';
  }

  String get formattedTotal {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    return '₹${formatter.format(totalAmountRupees)}';
  }

  bool get isSubmitted => status == 'submitted';
  bool get isAccepted => status == 'accepted';
  bool get isDeclined => status == 'declined';
  bool get isExpired => status == 'expired' || DateTime.now().isAfter(validUntil);
}
