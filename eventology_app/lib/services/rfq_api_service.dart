import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../core/config/api_config.dart';
import '../models/rfq_model.dart';

class RfqApiService {
  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? tokenProvider;

  RfqApiService({
    http.Client? client,
    String? baseUrl,
    this.tokenProvider,
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? '${ApiConfig.baseUrl}/api/rfq';

  Future<String?> _getToken() async {
    if (tokenProvider != null) {
      return await tokenProvider!();
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
    return defaultMsg;
  }

  /// Get all RFQ packages for an active event workflow.
  Future<List<RfqPackageModel>> getPackagesByWorkflow(String workflowId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$workflowId/packages');

    final response = await _client.get(
      url,
      headers: _buildHeaders(token),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = jsonDecode(response.body);
      if (body is Map && body['packages'] is List) {
        return (body['packages'] as List)
            .map((p) => RfqPackageModel.fromMap(Map<String, dynamic>.from(p)))
            .toList();
      }
      return [];
    }

    throw Exception(
      _parseErrorMessage(
        response,
        'Failed to fetch RFQ packages for workflow $workflowId (HTTP ${response.statusCode})',
      ),
    );
  }

  /// Get all RFQ packages dispatched to or accessible by a specific vendor.
  Future<List<RfqPackageModel>> getPackagesForVendor(String vendorId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/vendor/$vendorId/packages');

    final response = await _client.get(
      url,
      headers: _buildHeaders(token),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = jsonDecode(response.body);
      if (body is Map && body['packages'] is List) {
        return (body['packages'] as List)
            .map((p) => RfqPackageModel.fromMap(Map<String, dynamic>.from(p)))
            .toList();
      }
      return [];
    }

    throw Exception(
      _parseErrorMessage(
        response,
        'Failed to fetch RFQ inbox for vendor $vendorId (HTTP ${response.statusCode})',
      ),
    );
  }

  /// Get a single RFQ package by ID.
  Future<RfqPackageModel?> getPackage(String packageId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/package/$packageId');

    final response = await _client.get(
      url,
      headers: _buildHeaders(token),
    );

    if (response.statusCode == 200) {
      final body = jsonDecode(response.body);
      if (body is Map && body['package'] is Map) {
        return RfqPackageModel.fromMap(
          Map<String, dynamic>.from(body['package']),
        );
      }
      return null;
    } else if (response.statusCode == 404) {
      return null;
    }

    throw Exception(
      _parseErrorMessage(
        response,
        'Failed to fetch RFQ package $packageId (HTTP ${response.statusCode})',
      ),
    );
  }

  /// Get batch summary by RFQ Batch ID.
  Future<RfqBatchModel?> getRfqBatch(String rfqBatchId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/batch/$rfqBatchId');

    final response = await _client.get(
      url,
      headers: _buildHeaders(token),
    );

    if (response.statusCode == 200) {
      final body = jsonDecode(response.body);
      if (body is Map && body['batch'] is Map) {
        return RfqBatchModel.fromMap(
          Map<String, dynamic>.from(body['batch']),
        );
      }
      return null;
    } else if (response.statusCode == 404) {
      return null;
    }

    throw Exception(
      _parseErrorMessage(
        response,
        'Failed to fetch RFQ batch $rfqBatchId (HTTP ${response.statusCode})',
      ),
    );
  }

  /// Customer accepts a vendor's quotation for an RFQ package.
  /// Automatically creates an escrow payment milestone link.
  Future<RfqAcceptanceResult> acceptQuotation(String packageId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/package/$packageId/accept');

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = jsonDecode(response.body);
      if (body is Map) {
        return RfqAcceptanceResult.fromMap(Map<String, dynamic>.from(body));
      }
      return const RfqAcceptanceResult(success: true);
    }

    throw Exception(
      _parseErrorMessage(
        response,
        'Failed to accept quotation for package $packageId (HTTP ${response.statusCode})',
      ),
    );
  }

  /// Customer declines a vendor's quotation for an RFQ package.
  Future<RfqPackageModel> declineQuotation(
    String packageId, {
    String? declineReason,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/package/$packageId/decline');

    final payload = {
      if (declineReason != null && declineReason.trim().isNotEmpty)
        'declineReason': declineReason.trim(),
    };

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(payload),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = jsonDecode(response.body);
      if (body is Map && body['package'] is Map) {
        return RfqPackageModel.fromMap(
          Map<String, dynamic>.from(body['package']),
        );
      }
      throw Exception('Malformed response from server');
    }

    throw Exception(
      _parseErrorMessage(
        response,
        'Failed to decline quotation for package $packageId (HTTP ${response.statusCode})',
      ),
    );
  }

  /// Vendor acknowledges receipt of an RFQ package.
  Future<RfqPackageModel> acknowledgeRfq(
    String packageId,
    String vendorId,
  ) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/package/$packageId/acknowledge');

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode({'vendorId': vendorId}),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = jsonDecode(response.body);
      if (body is Map && body['package'] is Map) {
        return RfqPackageModel.fromMap(
          Map<String, dynamic>.from(body['package']),
        );
      }
      throw Exception('Malformed response from server');
    }

    throw Exception(
      _parseErrorMessage(
        response,
        'Failed to acknowledge RFQ package $packageId (HTTP ${response.statusCode})',
      ),
    );
  }

  /// Vendor submits a structured quotation or counter-bid for an RFQ package.
  Future<RfqPackageModel> submitQuotation(
    String packageId, {
    required String vendorId,
    required int quotedAmountPaise,
    int? counterBidAmountPaise,
    List<RfqItemPriceModel>? itemPrices,
    String? notes,
    int? quoteValidityDays,
    String? deliveryCommitment,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/package/$packageId/quote');

    final payload = {
      'vendorId': vendorId,
      'quotedAmountPaise': quotedAmountPaise,
      if (counterBidAmountPaise != null)
        'counterBidAmountPaise': counterBidAmountPaise,
      if (itemPrices != null)
        'itemPrices': itemPrices.map((e) => e.toMap()).toList(),
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      if (quoteValidityDays != null) 'quoteValidityDays': quoteValidityDays,
      if (deliveryCommitment != null && deliveryCommitment.trim().isNotEmpty)
        'deliveryCommitment': deliveryCommitment.trim(),
    };

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(payload),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = jsonDecode(response.body);
      if (body is Map && body['package'] is Map) {
        return RfqPackageModel.fromMap(
          Map<String, dynamic>.from(body['package']),
        );
      }
      throw Exception('Malformed response from server');
    }

    throw Exception(
      _parseErrorMessage(
        response,
        'Failed to submit quotation for package $packageId (HTTP ${response.statusCode})',
      ),
    );
  }
}
