import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/config/api_config.dart';
import '../models/cancellation_model.dart';

class CancellationApiService {
  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? tokenProvider;

  CancellationApiService({
    http.Client? client,
    String? baseUrl,
    this.tokenProvider,
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? '${ApiConfig.baseUrl}/api/cancellations';

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

  /// Preview cancellation policy estimate and refund calculation before requesting cancellation.
  Future<CancellationCalculationModel> fetchEstimate(String bookingId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/estimate/$bookingId');

    final response = await _client.get(url, headers: _buildHeaders(token));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return CancellationCalculationModel.fromMap(
          Map<String, dynamic>.from(data['estimate'] as Map));
    }
    throw Exception(_parseErrorMessage(response, 'Failed to fetch cancellation estimate'));
  }

  /// Submit customer cancellation request.
  Future<CancellationRequestModel> requestCancellation({
    required String bookingId,
    required String reason,
    String? customerNotes,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/request');

    final body = jsonEncode({
      'bookingId': bookingId,
      'reason': reason,
      if (customerNotes != null && customerNotes.isNotEmpty)
        'customerNotes': customerNotes,
    });

    final response = await _client.post(url, headers: _buildHeaders(token), body: body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return CancellationRequestModel.fromMap(
          Map<String, dynamic>.from(data['request'] as Map));
    }
    throw Exception(_parseErrorMessage(response, 'Failed to submit cancellation request'));
  }

  /// Retrieve cancellation request for a specific booking.
  Future<CancellationRequestModel?> fetchCancellationByBooking(String bookingId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/booking/$bookingId');

    final response = await _client.get(url, headers: _buildHeaders(token));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return CancellationRequestModel.fromMap(
          Map<String, dynamic>.from(data['request'] as Map));
    }
    if (response.statusCode == 404) {
      return null;
    }
    throw Exception(_parseErrorMessage(response, 'Failed to retrieve cancellation record'));
  }

  /// Withdraw a pending cancellation request before admin decision.
  Future<CancellationRequestModel> withdrawCancellation(String requestId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$requestId/withdraw');

    final response = await _client.post(url, headers: _buildHeaders(token));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return CancellationRequestModel.fromMap(
          Map<String, dynamic>.from(data['request'] as Map));
    }
    throw Exception(_parseErrorMessage(response, 'Failed to withdraw cancellation request'));
  }

  /// Admin queries queue of cancellation requests.
  Future<List<CancellationRequestModel>> fetchAdminQueue({
    String? status,
    int? limit,
  }) async {
    final token = await _getToken();
    final queryParams = <String, String>{};
    if (status != null && status.isNotEmpty && status.toLowerCase() != 'all') {
      queryParams['status'] = status;
    }
    if (limit != null) {
      queryParams['limit'] = limit.toString();
    }

    final url = Uri.parse('$_baseUrl/admin/queue').replace(queryParameters: queryParams.isEmpty ? null : queryParams);

    final response = await _client.get(url, headers: _buildHeaders(token));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = data['requests'] as List<dynamic>? ?? [];
      return list
          .map((item) => CancellationRequestModel.fromMap(
              Map<String, dynamic>.from(item as Map)))
          .toList();
    }
    throw Exception(_parseErrorMessage(response, 'Failed to retrieve cancellation queue'));
  }

  /// Admin approves cancellation with decision note and refund determination.
  Future<CancellationRequestModel> approveCancellation({
    required String requestId,
    required String decisionReason,
    String? adminInternalNotes,
    required String refundDecision,
    int? approvedRefundPaise,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/admin/$requestId/approve');

    final body = jsonEncode({
      'decisionReason': decisionReason,
      if (adminInternalNotes != null && adminInternalNotes.isNotEmpty)
        'adminInternalNotes': adminInternalNotes,
      'refundDecision': refundDecision,
      // ignore: use_null_aware_elements
      if (approvedRefundPaise != null) 'approvedRefundPaise': approvedRefundPaise,
    });

    final response = await _client.post(url, headers: _buildHeaders(token), body: body);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return CancellationRequestModel.fromMap(
          Map<String, dynamic>.from(data['request'] as Map));
    }
    throw Exception(_parseErrorMessage(response, 'Failed to approve cancellation'));
  }

  /// Admin rejects cancellation with mandatory decision note.
  Future<CancellationRequestModel> rejectCancellation({
    required String requestId,
    required String decisionReason,
    String? adminInternalNotes,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/admin/$requestId/reject');

    final body = jsonEncode({
      'decisionReason': decisionReason,
      if (adminInternalNotes != null && adminInternalNotes.isNotEmpty)
        'adminInternalNotes': adminInternalNotes,
    });

    final response = await _client.post(url, headers: _buildHeaders(token), body: body);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return CancellationRequestModel.fromMap(
          Map<String, dynamic>.from(data['request'] as Map));
    }
    throw Exception(_parseErrorMessage(response, 'Failed to reject cancellation'));
  }

  /// Admin executes simulated refund in test-double mode.
  Future<Map<String, dynamic>> executeRefund(String requestId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/admin/$requestId/execute-refund');

    final response = await _client.post(url, headers: _buildHeaders(token));
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception(_parseErrorMessage(response, 'Failed to execute refund'));
  }
}

final cancellationApiService = CancellationApiService();
