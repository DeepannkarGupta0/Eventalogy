import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/config/api_config.dart';
import '../models/settlements_model.dart';

class SettlementApiService {
  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? tokenProvider;

  SettlementApiService({
    http.Client? client,
    String? baseUrl,
    this.tokenProvider,
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? '${ApiConfig.baseUrl}/api/settlements';

  Future<String?> _getToken() async {
    final provider = tokenProvider;
    if (provider != null) {
      return await provider();
    }
    try {
      return await FirebaseAuth.instance.currentUser?.getIdToken();
    } catch (_) {
      return null;
    }
  }

  Map<String, String> _buildHeaders(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  String _parseErrorMessage(http.Response response, String defaultMsg) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map && body.containsKey('error')) {
        return body['error'].toString();
      }
    } catch (_) {}
    return '$defaultMsg (${response.statusCode})';
  }

  /// List settlements filtered by optional eventId, vendorId, or status.
  Future<List<SettlementModel>> fetchSettlements({
    String? eventId,
    String? vendorId,
    String? status,
  }) async {
    final token = await _getToken();
    final queryParams = <String, String>{};
    if (eventId != null && eventId.isNotEmpty) queryParams['eventId'] = eventId;
    if (vendorId != null && vendorId.isNotEmpty) queryParams['vendorId'] = vendorId;
    if (status != null && status.isNotEmpty && status.toLowerCase() != 'all') {
      queryParams['status'] = status.toLowerCase();
    }

    final uri = Uri.parse(_baseUrl).replace(
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    final response = await _client.get(uri, headers: _buildHeaders(token));

    if (response.statusCode != 200) {
      throw Exception(_parseErrorMessage(response, 'Failed to fetch settlements'));
    }

    final data = jsonDecode(response.body);
    final list = data['settlements'] as List<dynamic>? ?? [];
    return list.map((item) => SettlementModel.fromMap(item as Map<String, dynamic>)).toList();
  }

  /// Retrieve a specific settlement by ID.
  Future<SettlementModel> fetchSettlement(String settlementId) async {
    final token = await _getToken();
    final uri = Uri.parse('$_baseUrl/$settlementId');
    final response = await _client.get(uri, headers: _buildHeaders(token));

    if (response.statusCode != 200) {
      throw Exception(_parseErrorMessage(response, 'Failed to fetch settlement'));
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return SettlementModel.fromMap(data, settlementId);
  }

  /// Administratively approve a pending settlement proposal.
  Future<SettlementModel> approveSettlement(String settlementId) async {
    final token = await _getToken();
    final uri = Uri.parse('$_baseUrl/$settlementId/approve');
    final response = await _client.post(uri, headers: _buildHeaders(token));

    if (response.statusCode != 200) {
      throw Exception(_parseErrorMessage(response, 'Failed to approve settlement'));
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final settlementMap = data['settlement'] as Map<String, dynamic>? ?? data;
    return SettlementModel.fromMap(settlementMap, settlementId);
  }

  /// Administratively reject a settlement proposal with reason.
  Future<SettlementModel> rejectSettlement(String settlementId, String reason) async {
    if (reason.trim().isEmpty) {
      throw ArgumentError('Rejection reason is required.');
    }

    final token = await _getToken();
    final uri = Uri.parse('$_baseUrl/$settlementId/reject');
    final response = await _client.post(
      uri,
      headers: _buildHeaders(token),
      body: jsonEncode({'reason': reason.trim()}),
    );

    if (response.statusCode != 200) {
      throw Exception(_parseErrorMessage(response, 'Failed to reject settlement'));
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final settlementMap = data['settlement'] as Map<String, dynamic>? ?? data;
    return SettlementModel.fromMap(settlementMap, settlementId);
  }

  /// Reconcile settlement with verified provider confirmation reference & evidence.
  Future<SettlementModel> reconcileSettlement(
    String settlementId, {
    required String payoutReference,
    required String reconciliationEvidence,
  }) async {
    if (payoutReference.trim().length < 6) {
      throw ArgumentError('Payout reference must be at least 6 characters.');
    }
    if (reconciliationEvidence.trim().length < 10) {
      throw ArgumentError('Reconciliation evidence must be at least 10 characters.');
    }

    final token = await _getToken();
    final uri = Uri.parse('$_baseUrl/$settlementId/reconcile');
    final response = await _client.post(
      uri,
      headers: _buildHeaders(token),
      body: jsonEncode({
        'payoutReference': payoutReference.trim(),
        'reconciliationEvidence': reconciliationEvidence.trim(),
      }),
    );

    if (response.statusCode != 200) {
      throw Exception(_parseErrorMessage(response, 'Failed to reconcile settlement'));
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final settlementMap = data['settlement'] as Map<String, dynamic>? ?? data;
    return SettlementModel.fromMap(settlementMap, settlementId);
  }

  /// Fetch allocation summary (contracted, committed, remaining balance).
  Future<Map<String, dynamic>> fetchAllocationSummary(String allocationId) async {
    final token = await _getToken();
    final uri = Uri.parse('$_baseUrl/allocation/$allocationId/summary');
    final response = await _client.get(uri, headers: _buildHeaders(token));

    if (response.statusCode != 200) {
      throw Exception(_parseErrorMessage(response, 'Failed to fetch allocation summary'));
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Fetch allocations queue eligible for administrative settlement review.
  Future<List<EligibleAllocationModel>> fetchEligibleAllocations() async {
    final token = await _getToken();
    final uri = Uri.parse('$_baseUrl/eligible-allocations');
    final response = await _client.get(uri, headers: _buildHeaders(token));

    if (response.statusCode != 200) {
      throw Exception(_parseErrorMessage(response, 'Failed to fetch eligible allocations'));
    }

    final data = jsonDecode(response.body);
    final list = data['allocations'] as List<dynamic>? ?? [];
    return list.map((item) => EligibleAllocationModel.fromMap(item as Map<String, dynamic>)).toList();
  }

  /// Administratively propose a settlement with explicit commercial policy.
  Future<SettlementModel> proposeSettlement({
    required String paymentId,
    required String allocationId,
    required int platformFeeBps,
    int? withholdingTaxBps,
    int? proposedAmountPaise,
    String? notes,
    String? proposalReference,
    String? resubmittedFromSettlementId,
  }) async {
    if (platformFeeBps < 0 || platformFeeBps > 10000) {
      throw ArgumentError('Platform fee basis points must be between 0 and 10000.');
    }

    final token = await _getToken();
    final uri = Uri.parse('$_baseUrl/propose');
    final body = <String, dynamic>{
      'paymentId': paymentId,
      'allocationId': allocationId,
      'platformFeeBps': platformFeeBps,
      'withholdingTaxBps': ?withholdingTaxBps,
      'proposedAmountPaise': ?proposedAmountPaise,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (proposalReference != null && proposalReference.isNotEmpty)
        'proposalReference': proposalReference,
      if (resubmittedFromSettlementId != null && resubmittedFromSettlementId.isNotEmpty)
        'resubmittedFromSettlementId': resubmittedFromSettlementId,
    };

    final response = await _client.post(
      uri,
      headers: _buildHeaders(token),
      body: jsonEncode(body),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(_parseErrorMessage(response, 'Failed to propose settlement'));
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final settlementMap = data['settlement'] as Map<String, dynamic>? ?? data;
    return SettlementModel.fromMap(settlementMap);
  }

  /// Fetch authenticated vendor settlement ledger and statement history.
  Future<VendorSettlementHistoryResponseModel> fetchVendorSettlementHistory({
    String? status,
    int? limit,
  }) async {
    final token = await _getToken();
    final queryParams = <String, String>{};
    if (status != null && status.isNotEmpty && status.toLowerCase() != 'all') {
      queryParams['status'] = status.toLowerCase();
    }
    if (limit != null) {
      queryParams['limit'] = limit.toString();
    }

    final uri = Uri.parse('$_baseUrl/vendor-history').replace(
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    final response = await _client.get(uri, headers: _buildHeaders(token));

    if (response.statusCode != 200) {
      throw Exception(_parseErrorMessage(response, 'Failed to fetch vendor settlement statement'));
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return VendorSettlementHistoryResponseModel.fromMap(data);
  }
}
