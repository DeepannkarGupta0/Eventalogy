import 'package:cloud_firestore/cloud_firestore.dart';

class VendorModel {
  final String vendorId;
  final String userId;
  final String businessName;
  final String ownerName;
  final String? description;
  final List<String> categoryIds;
  final List<String>? serviceIds;
  final String? locationId;
  final String? phone;
  final String? email;
  final String? pricingModel;
  final List<String>? portfolioImages;
  final double? rating;
  final bool verified;
  final String status;
  final Timestamp createdAt;
  final Timestamp? updatedAt;
  final String? gstNumber;

  // ── Tier 1: Legal Identity & KYC ──────────────────────────────────────────
  final String? legalEntityName;
  final String? tradeName;
  final String? entityType; // 'sole_proprietorship', 'partnership', 'llp', 'pvt_ltd', 'public_ltd'
  final String? panNumber;
  final Map<String, dynamic>? registeredAddress;
  final String? signatoryName;
  final String? signatoryGovtIdUrl;
  final String? opsEmergencyPhone;
  final String? gstinCertificateUrl;

  // ── Tier 2: Bank Settlement & Escrow Payout ───────────────────────────────
  final String? bankAccountHolder;
  final String? bankName;
  final String? accountNumber;
  final String? ifscCode;
  final String? accountType; // 'current', 'savings'
  final String? cancelledChequeUrl;
  final String payoutStatus; // 'pending_verification', 'verified', 'rejected'

  // ── Tier 3: Category Equipment Manifest ───────────────────────────────────
  final Map<String, dynamic>? equipmentManifest;

  // ── Tier 4: Site Operations Logistics ─────────────────────────────────────
  final double? maxPowerDrawKva;
  final int? coreCrewHeadcount;
  final List<String>? transportFleet;
  final double? setupLeadTimeHours;
  final double? strikeTimeHours;
  final String? spareEquipmentPolicy;

  // ── Tier 5: Commercial Policies & Insurance ───────────────────────────────
  final int? baseDayRatePaise;
  final bool escrowTermsAccepted;
  final String? insurancePolicyNumber;
  final int? insuranceCoveragePaise;
  final String? cancellationPolicy; // 'standard', 'moderate', 'strict'

  VendorModel({
    required this.vendorId,
    required this.userId,
    required this.businessName,
    required this.ownerName,
    this.description,
    required this.categoryIds,
    this.serviceIds,
    this.locationId,
    this.phone,
    this.email,
    this.pricingModel,
    this.portfolioImages,
    this.rating,
    required this.verified,
    required this.status,
    required this.createdAt,
    this.updatedAt,
    this.gstNumber,
    this.legalEntityName,
    this.tradeName,
    this.entityType,
    this.panNumber,
    this.registeredAddress,
    this.signatoryName,
    this.signatoryGovtIdUrl,
    this.opsEmergencyPhone,
    this.gstinCertificateUrl,
    this.bankAccountHolder,
    this.bankName,
    this.accountNumber,
    this.ifscCode,
    this.accountType,
    this.cancelledChequeUrl,
    this.payoutStatus = 'pending_verification',
    this.equipmentManifest,
    this.maxPowerDrawKva,
    this.coreCrewHeadcount,
    this.transportFleet,
    this.setupLeadTimeHours,
    this.strikeTimeHours,
    this.spareEquipmentPolicy,
    this.baseDayRatePaise,
    this.escrowTermsAccepted = false,
    this.insurancePolicyNumber,
    this.insuranceCoveragePaise,
    this.cancellationPolicy = 'standard',
  });

  factory VendorModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return VendorModel(
      vendorId: data['vendorId'] as String? ?? doc.id,
      userId: data['userId'] as String? ?? '',
      businessName: data['businessName'] as String? ?? '',
      ownerName: data['ownerName'] as String? ?? '',
      description: data['description'] as String?,
      categoryIds: List<String>.from(data['categoryIds'] ?? []),
      serviceIds: data['serviceIds'] != null ? List<String>.from(data['serviceIds']) : null,
      locationId: data['locationId'] as String?,
      phone: data['phone'] as String?,
      email: data['email'] as String?,
      pricingModel: data['pricingModel'] as String?,
      portfolioImages: data['portfolioImages'] != null ? List<String>.from(data['portfolioImages']) : null,
      rating: (data['rating'] as num?)?.toDouble(),
      verified: data['verified'] as bool? ?? false,
      status: data['status'] as String? ?? 'pending',
      createdAt: data['createdAt'] as Timestamp? ?? Timestamp.now(),
      updatedAt: data['updatedAt'] as Timestamp?,
      gstNumber: (data['gstNumber'] ?? data['gstin']) as String?,
      legalEntityName: data['legalEntityName'] as String?,
      tradeName: data['tradeName'] as String?,
      entityType: data['entityType'] as String?,
      panNumber: data['panNumber'] as String?,
      registeredAddress: data['registeredAddress'] != null
          ? Map<String, dynamic>.from(data['registeredAddress'] as Map)
          : null,
      signatoryName: data['signatoryName'] as String?,
      signatoryGovtIdUrl: data['signatoryGovtIdUrl'] as String?,
      opsEmergencyPhone: data['opsEmergencyPhone'] as String?,
      gstinCertificateUrl: data['gstinCertificateUrl'] as String?,
      bankAccountHolder: data['bankAccountHolder'] as String?,
      bankName: data['bankName'] as String?,
      accountNumber: data['accountNumber'] as String?,
      ifscCode: data['ifscCode'] as String?,
      accountType: data['accountType'] as String?,
      cancelledChequeUrl: data['cancelledChequeUrl'] as String?,
      payoutStatus: data['payoutStatus'] as String? ?? 'pending_verification',
      equipmentManifest: data['equipmentManifest'] != null
          ? Map<String, dynamic>.from(data['equipmentManifest'] as Map)
          : null,
      maxPowerDrawKva: (data['maxPowerDrawKva'] as num?)?.toDouble(),
      coreCrewHeadcount: (data['coreCrewHeadcount'] as num?)?.toInt(),
      transportFleet: data['transportFleet'] != null
          ? List<String>.from(data['transportFleet'])
          : null,
      setupLeadTimeHours: (data['setupLeadTimeHours'] as num?)?.toDouble(),
      strikeTimeHours: (data['strikeTimeHours'] as num?)?.toDouble(),
      spareEquipmentPolicy: data['spareEquipmentPolicy'] as String?,
      baseDayRatePaise: (data['baseDayRatePaise'] as num?)?.toInt(),
      escrowTermsAccepted: data['escrowTermsAccepted'] as bool? ?? false,
      insurancePolicyNumber: data['insurancePolicyNumber'] as String?,
      insuranceCoveragePaise: (data['insuranceCoveragePaise'] as num?)?.toInt(),
      cancellationPolicy: data['cancellationPolicy'] as String? ?? 'standard',
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'vendorId': vendorId,
      'userId': userId,
      'businessName': businessName,
      'ownerName': ownerName,
      if (description != null) 'description': description,
      'categoryIds': categoryIds,
      if (serviceIds != null) 'serviceIds': serviceIds,
      if (locationId != null) 'locationId': locationId,
      if (phone != null) 'phone': phone,
      if (email != null) 'email': email,
      if (pricingModel != null) 'pricingModel': pricingModel,
      if (portfolioImages != null) 'portfolioImages': portfolioImages,
      if (rating != null) 'rating': rating,
      'verified': verified,
      'status': status,
      'createdAt': createdAt,
      if (updatedAt != null) 'updatedAt': updatedAt,
      if (gstNumber != null) 'gstNumber': gstNumber,
      if (gstNumber != null) 'gstin': gstNumber,
      if (legalEntityName != null) 'legalEntityName': legalEntityName,
      if (tradeName != null) 'tradeName': tradeName,
      if (entityType != null) 'entityType': entityType,
      if (panNumber != null) 'panNumber': panNumber,
      if (registeredAddress != null) 'registeredAddress': registeredAddress,
      if (signatoryName != null) 'signatoryName': signatoryName,
      if (signatoryGovtIdUrl != null) 'signatoryGovtIdUrl': signatoryGovtIdUrl,
      if (opsEmergencyPhone != null) 'opsEmergencyPhone': opsEmergencyPhone,
      if (gstinCertificateUrl != null) 'gstinCertificateUrl': gstinCertificateUrl,
      if (bankAccountHolder != null) 'bankAccountHolder': bankAccountHolder,
      if (bankName != null) 'bankName': bankName,
      if (accountNumber != null) 'accountNumber': accountNumber,
      if (ifscCode != null) 'ifscCode': ifscCode,
      if (accountType != null) 'accountType': accountType,
      if (cancelledChequeUrl != null) 'cancelledChequeUrl': cancelledChequeUrl,
      'payoutStatus': payoutStatus,
      if (equipmentManifest != null) 'equipmentManifest': equipmentManifest,
      if (maxPowerDrawKva != null) 'maxPowerDrawKva': maxPowerDrawKva,
      if (coreCrewHeadcount != null) 'coreCrewHeadcount': coreCrewHeadcount,
      if (transportFleet != null) 'transportFleet': transportFleet,
      if (setupLeadTimeHours != null) 'setupLeadTimeHours': setupLeadTimeHours,
      if (strikeTimeHours != null) 'strikeTimeHours': strikeTimeHours,
      if (spareEquipmentPolicy != null) 'spareEquipmentPolicy': spareEquipmentPolicy,
      if (baseDayRatePaise != null) 'baseDayRatePaise': baseDayRatePaise,
      'escrowTermsAccepted': escrowTermsAccepted,
      if (insurancePolicyNumber != null) 'insurancePolicyNumber': insurancePolicyNumber,
      if (insuranceCoveragePaise != null) 'insuranceCoveragePaise': insuranceCoveragePaise,
      if (cancellationPolicy != null) 'cancellationPolicy': cancellationPolicy,
    };
  }

  VendorModel copyWith({
    String? vendorId,
    String? userId,
    String? businessName,
    String? ownerName,
    String? description,
    List<String>? categoryIds,
    List<String>? serviceIds,
    String? locationId,
    String? phone,
    String? email,
    String? pricingModel,
    List<String>? portfolioImages,
    double? rating,
    bool? verified,
    String? status,
    Timestamp? createdAt,
    Timestamp? updatedAt,
    String? gstNumber,
    String? legalEntityName,
    String? tradeName,
    String? entityType,
    String? panNumber,
    Map<String, dynamic>? registeredAddress,
    String? signatoryName,
    String? signatoryGovtIdUrl,
    String? opsEmergencyPhone,
    String? gstinCertificateUrl,
    String? bankAccountHolder,
    String? bankName,
    String? accountNumber,
    String? ifscCode,
    String? accountType,
    String? cancelledChequeUrl,
    String? payoutStatus,
    Map<String, dynamic>? equipmentManifest,
    double? maxPowerDrawKva,
    int? coreCrewHeadcount,
    List<String>? transportFleet,
    double? setupLeadTimeHours,
    double? strikeTimeHours,
    String? spareEquipmentPolicy,
    int? baseDayRatePaise,
    bool? escrowTermsAccepted,
    String? insurancePolicyNumber,
    int? insuranceCoveragePaise,
    String? cancellationPolicy,
  }) {
    return VendorModel(
      vendorId: vendorId ?? this.vendorId,
      userId: userId ?? this.userId,
      businessName: businessName ?? this.businessName,
      ownerName: ownerName ?? this.ownerName,
      description: description ?? this.description,
      categoryIds: categoryIds ?? this.categoryIds,
      serviceIds: serviceIds ?? this.serviceIds,
      locationId: locationId ?? this.locationId,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      pricingModel: pricingModel ?? this.pricingModel,
      portfolioImages: portfolioImages ?? this.portfolioImages,
      rating: rating ?? this.rating,
      verified: verified ?? this.verified,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      gstNumber: gstNumber ?? this.gstNumber,
      legalEntityName: legalEntityName ?? this.legalEntityName,
      tradeName: tradeName ?? this.tradeName,
      entityType: entityType ?? this.entityType,
      panNumber: panNumber ?? this.panNumber,
      registeredAddress: registeredAddress ?? this.registeredAddress,
      signatoryName: signatoryName ?? this.signatoryName,
      signatoryGovtIdUrl: signatoryGovtIdUrl ?? this.signatoryGovtIdUrl,
      opsEmergencyPhone: opsEmergencyPhone ?? this.opsEmergencyPhone,
      gstinCertificateUrl: gstinCertificateUrl ?? this.gstinCertificateUrl,
      bankAccountHolder: bankAccountHolder ?? this.bankAccountHolder,
      bankName: bankName ?? this.bankName,
      accountNumber: accountNumber ?? this.accountNumber,
      ifscCode: ifscCode ?? this.ifscCode,
      accountType: accountType ?? this.accountType,
      cancelledChequeUrl: cancelledChequeUrl ?? this.cancelledChequeUrl,
      payoutStatus: payoutStatus ?? this.payoutStatus,
      equipmentManifest: equipmentManifest ?? this.equipmentManifest,
      maxPowerDrawKva: maxPowerDrawKva ?? this.maxPowerDrawKva,
      coreCrewHeadcount: coreCrewHeadcount ?? this.coreCrewHeadcount,
      transportFleet: transportFleet ?? this.transportFleet,
      setupLeadTimeHours: setupLeadTimeHours ?? this.setupLeadTimeHours,
      strikeTimeHours: strikeTimeHours ?? this.strikeTimeHours,
      spareEquipmentPolicy: spareEquipmentPolicy ?? this.spareEquipmentPolicy,
      baseDayRatePaise: baseDayRatePaise ?? this.baseDayRatePaise,
      escrowTermsAccepted: escrowTermsAccepted ?? this.escrowTermsAccepted,
      insurancePolicyNumber: insurancePolicyNumber ?? this.insurancePolicyNumber,
      insuranceCoveragePaise: insuranceCoveragePaise ?? this.insuranceCoveragePaise,
      cancellationPolicy: cancellationPolicy ?? this.cancellationPolicy,
    );
  }

  String get id => vendorId;
  List<String> get mediaGallery => portfolioImages ?? [];
  String? get vendorType => categoryIds.isNotEmpty ? categoryIds.first : null;
  double? get basePrice => baseDayRatePaise != null ? baseDayRatePaise! / 100.0 : 0.0;
}
