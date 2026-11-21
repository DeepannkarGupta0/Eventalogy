import 'package:cloud_firestore/cloud_firestore.dart';

class OperatingHoursModel {
  final String open;  // "HH:MM"
  final String close; // "HH:MM"

  const OperatingHoursModel({
    required this.open,
    required this.close,
  });

  factory OperatingHoursModel.fromJson(Map<String, dynamic> json) {
    return OperatingHoursModel(
      open: json['open'] as String? ?? '09:00',
      close: json['close'] as String? ?? '21:00',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'open': open,
      'close': close,
    };
  }
}

class BlackoutDateModel {
  final String date;       // "YYYY-MM-DD"
  final String? reason;
  final bool isAllDay;
  final String? startTime;
  final String? endTime;

  const BlackoutDateModel({
    required this.date,
    this.reason,
    this.isAllDay = true,
    this.startTime,
    this.endTime,
  });

  factory BlackoutDateModel.fromJson(Map<String, dynamic> json) {
    return BlackoutDateModel(
      date: json['date'] as String? ?? '',
      reason: json['reason'] as String?,
      isAllDay: json['isAllDay'] as bool? ?? true,
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'date': date,
      if (reason != null) 'reason': reason,
      'isAllDay': isAllDay,
      if (startTime != null) 'startTime': startTime,
      if (endTime != null) 'endTime': endTime,
    };
  }
}

class DateOverrideModel {
  final String date;       // "YYYY-MM-DD"
  final bool isAvailable;
  final String? reason;
  final String? startTime;
  final String? endTime;

  const DateOverrideModel({
    required this.date,
    required this.isAvailable,
    this.reason,
    this.startTime,
    this.endTime,
  });

  factory DateOverrideModel.fromJson(Map<String, dynamic> json) {
    return DateOverrideModel(
      date: json['date'] as String? ?? '',
      isAvailable: json['isAvailable'] as bool? ?? true,
      reason: json['reason'] as String?,
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'date': date,
      'isAvailable': isAvailable,
      if (reason != null) 'reason': reason,
      if (startTime != null) 'startTime': startTime,
      if (endTime != null) 'endTime': endTime,
    };
  }
}

class VendorAvailabilityModel {
  final String vendorId;
  final bool isConfigured;
  final String timezone;
  final List<int> operatingDays; // 0=Sunday, 1=Monday, ..., 6=Saturday
  final OperatingHoursModel operatingHours;
  final int setupBufferMinutes;
  final int teardownBufferMinutes;
  final String capacityType; // "events_count", "units_inventory", "staff_personnel", "attendees"
  final int defaultCapacity;
  final List<BlackoutDateModel> blackoutDates;
  final List<DateOverrideModel> dateOverrides;
  final DateTime? updatedAt;

  const VendorAvailabilityModel({
    required this.vendorId,
    required this.isConfigured,
    this.timezone = 'Asia/Kolkata',
    required this.operatingDays,
    required this.operatingHours,
    this.setupBufferMinutes = 60,
    this.teardownBufferMinutes = 60,
    this.capacityType = 'events_count',
    this.defaultCapacity = 1,
    this.blackoutDates = const [],
    this.dateOverrides = const [],
    this.updatedAt,
  });

  factory VendorAvailabilityModel.fromJson(Map<String, dynamic> json) {
    final opHoursJson = json['operatingHours'] as Map<String, dynamic>? ?? {};
    final blackoutsJson = (json['blackoutDates'] as List<dynamic>?) ?? [];
    final overridesJson = (json['dateOverrides'] as List<dynamic>?) ?? [];
    final daysList = (json['operatingDays'] as List<dynamic>?)
            ?.map((e) => (e as num).toInt())
            .toList() ??
        [1, 2, 3, 4, 5, 6];

    DateTime? parsedUpdatedAt;
    if (json['updatedAt'] != null) {
      if (json['updatedAt'] is Timestamp) {
        parsedUpdatedAt = (json['updatedAt'] as Timestamp).toDate();
      } else if (json['updatedAt'] is String) {
        parsedUpdatedAt = DateTime.tryParse(json['updatedAt'] as String);
      }
    }

    return VendorAvailabilityModel(
      vendorId: json['vendorId'] as String? ?? '',
      isConfigured: json['isConfigured'] as bool? ?? false,
      timezone: json['timezone'] as String? ?? 'Asia/Kolkata',
      operatingDays: daysList,
      operatingHours: OperatingHoursModel.fromJson(opHoursJson),
      setupBufferMinutes: (json['setupBufferMinutes'] as num?)?.toInt() ?? 60,
      teardownBufferMinutes: (json['teardownBufferMinutes'] as num?)?.toInt() ?? 60,
      capacityType: json['capacityType'] as String? ?? 'events_count',
      defaultCapacity: (json['defaultCapacity'] as num?)?.toInt() ?? 1,
      blackoutDates: blackoutsJson.map((e) => BlackoutDateModel.fromJson(e as Map<String, dynamic>)).toList(),
      dateOverrides: overridesJson.map((e) => DateOverrideModel.fromJson(e as Map<String, dynamic>)).toList(),
      updatedAt: parsedUpdatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'vendorId': vendorId,
      'isConfigured': isConfigured,
      'timezone': timezone,
      'operatingDays': operatingDays,
      'operatingHours': operatingHours.toJson(),
      'setupBufferMinutes': setupBufferMinutes,
      'teardownBufferMinutes': teardownBufferMinutes,
      'capacityType': capacityType,
      'defaultCapacity': defaultCapacity,
      'blackoutDates': blackoutDates.map((e) => e.toJson()).toList(),
      'dateOverrides': dateOverrides.map((e) => e.toJson()).toList(),
    };
  }

  VendorAvailabilityModel copyWith({
    String? vendorId,
    bool? isConfigured,
    String? timezone,
    List<int>? operatingDays,
    OperatingHoursModel? operatingHours,
    int? setupBufferMinutes,
    int? teardownBufferMinutes,
    String? capacityType,
    int? defaultCapacity,
    List<BlackoutDateModel>? blackoutDates,
    List<DateOverrideModel>? dateOverrides,
    DateTime? updatedAt,
  }) {
    return VendorAvailabilityModel(
      vendorId: vendorId ?? this.vendorId,
      isConfigured: isConfigured ?? this.isConfigured,
      timezone: timezone ?? this.timezone,
      operatingDays: operatingDays ?? this.operatingDays,
      operatingHours: operatingHours ?? this.operatingHours,
      setupBufferMinutes: setupBufferMinutes ?? this.setupBufferMinutes,
      teardownBufferMinutes: teardownBufferMinutes ?? this.teardownBufferMinutes,
      capacityType: capacityType ?? this.capacityType,
      defaultCapacity: defaultCapacity ?? this.defaultCapacity,
      blackoutDates: blackoutDates ?? this.blackoutDates,
      dateOverrides: dateOverrides ?? this.dateOverrides,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  bool operatesOnDay(int dayOfWeek) => operatingDays.contains(dayOfWeek);

  bool isBlackoutDate(String dateStr) => blackoutDates.any((b) => b.date == dateStr);
}

class VendorCommitmentModel {
  final String reservationId;
  final String bookingId;
  final String eventId;
  final String eventTitle;
  final String eventDate;
  final DateTime? startTime;
  final DateTime? endTime;
  final int quantity;
  final String status;

  const VendorCommitmentModel({
    required this.reservationId,
    required this.bookingId,
    required this.eventId,
    required this.eventTitle,
    required this.eventDate,
    this.startTime,
    this.endTime,
    required this.quantity,
    required this.status,
  });

  factory VendorCommitmentModel.fromJson(Map<String, dynamic> json) {
    DateTime? sTime;
    DateTime? eTime;
    if (json['startTime'] is String) sTime = DateTime.tryParse(json['startTime']);
    if (json['endTime'] is String) eTime = DateTime.tryParse(json['endTime']);

    return VendorCommitmentModel(
      reservationId: json['reservationId'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      eventId: json['eventId'] as String? ?? '',
      eventTitle: json['eventTitle'] as String? ?? 'Scheduled Event',
      eventDate: json['eventDate'] as String? ?? '',
      startTime: sTime,
      endTime: eTime,
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      status: json['status'] as String? ?? 'confirmed',
    );
  }
}

class AvailabilityCheckResultModel {
  final bool isAvailable;
  final bool isConfigured;
  final String vendorId;
  final String eventDate;
  final int requestedQuantity;
  final int availableCapacity;
  final int totalCapacity;
  final String? conflictReason;
  final String? conflictType;

  const AvailabilityCheckResultModel({
    required this.isAvailable,
    required this.isConfigured,
    required this.vendorId,
    required this.eventDate,
    required this.requestedQuantity,
    required this.availableCapacity,
    required this.totalCapacity,
    this.conflictReason,
    this.conflictType,
  });

  factory AvailabilityCheckResultModel.fromJson(Map<String, dynamic> json) {
    final details = json['conflictDetails'] as Map<String, dynamic>?;
    return AvailabilityCheckResultModel(
      isAvailable: json['isAvailable'] as bool? ?? false,
      isConfigured: json['isConfigured'] as bool? ?? false,
      vendorId: json['vendorId'] as String? ?? '',
      eventDate: json['eventDate'] as String? ?? '',
      requestedQuantity: (json['requestedQuantity'] as num?)?.toInt() ?? 1,
      availableCapacity: (json['availableCapacity'] as num?)?.toInt() ?? 0,
      totalCapacity: (json['totalCapacity'] as num?)?.toInt() ?? 0,
      conflictReason: json['conflictReason'] as String?,
      conflictType: details?['type'] as String?,
    );
  }
}
