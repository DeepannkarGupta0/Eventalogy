import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../core/config/api_config.dart';
import '../models/quotations_model.dart';

class QuotationApiService {
  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? tokenProvider;

  QuotationApiService({
    http.Client? client,
    String? baseUrl,
    this.tokenProvider,
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? '${ApiConfig.baseUrl}/api/quotations';

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

  /// Vendor submits a structured quotation for an enquiry
  Future<QuotationModel> submitQuotation({
    required String enquiryId,
    required List<QuotationLineItemModel> lineItems,
    int taxPaise = 0,
    List<String> inclusions = const [],
    List<String> exclusions = const [],
    String? notes,
    int validityDays = 7,
  }) async {
    final token = await _getToken();
    final url = Uri.parse(_baseUrl);

    final payload = {
      'enquiryId': enquiryId,
      'lineItems': lineItems.map((e) => e.toMap()).toList(),
      'taxPaise': taxPaise,
      'inclusions': inclusions,
      'exclusions': exclusions,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      'validityDays': validityDays,
    };

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(payload),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body);
      return QuotationModel.fromMap(json['quotation'] as Map<String, dynamic>);
    } else {
      final error = _parseErrorMessage(response, 'Failed to submit quotation (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }

  /// Fetch all quotations for an enquiry (Customer, Vendor, or Admin)
  Future<List<QuotationModel>> fetchQuotationsForEnquiry(String enquiryId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/enquiry/$enquiryId');

    final response = await _client.get(
      url,
      headers: _buildHeaders(token),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body);
      final list = json['quotations'] as List? ?? [];
      return list.map((e) => QuotationModel.fromMap(e as Map<String, dynamic>)).toList();
    } else {
      final error = _parseErrorMessage(response, 'Failed to fetch quotations (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }

  /// Fetch a single quotation by ID
  Future<QuotationModel> fetchQuotation(String quotationId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$quotationId');

    final response = await _client.get(
      url,
      headers: _buildHeaders(token),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body);
      return QuotationModel.fromMap(json['quotation'] as Map<String, dynamic>);
    } else {
      final error = _parseErrorMessage(response, 'Failed to fetch quotation (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }

  /// Customer accepts a quotation, automatically creating a confirmed booking and allocation
  Future<Map<String, dynamic>> acceptQuotation(String quotationId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$quotationId/accept');

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode({}),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body);
      return {
        'success': true,
        'quotation': QuotationModel.fromMap(json['quotation'] as Map<String, dynamic>),
        'bookingId': json['bookingId'] as String?,
        'allocationId': json['allocationId'] as String?,
        'isExisting': json['isExisting'] as bool? ?? false,
      };
    } else {
      final error = _parseErrorMessage(response, 'Failed to accept quotation (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }

  /// Customer declines a quotation with an optional reason
  Future<QuotationModel> declineQuotation(String quotationId, [String? declineReason]) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$quotationId/decline');

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode({
        if (declineReason != null && declineReason.trim().isNotEmpty)
          'declineReason': declineReason.trim(),
      }),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body);
      return QuotationModel.fromMap(json['quotation'] as Map<String, dynamic>);
    } else {
      final error = _parseErrorMessage(response, 'Failed to decline quotation (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }
}
