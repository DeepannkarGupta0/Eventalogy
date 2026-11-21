import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../core/config/api_config.dart';

class FulfillmentApiService {
  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? tokenProvider;

  FulfillmentApiService({
    http.Client? client,
    String? baseUrl,
    this.tokenProvider,
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? '${ApiConfig.baseUrl}/api/fulfillment';

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

  /// Vendor queries assigned bookings
  Future<List<Map<String, dynamic>>> getVendorBookings() async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/vendor-bookings');

    final res = await _client.get(url, headers: _buildHeaders(token));
    if (res.statusCode != 200) {
      throw Exception(_parseErrorMessage(res, 'Failed to load vendor bookings.'));
    }

    final data = jsonDecode(res.body);
    final bookingsList = data['bookings'] as List<dynamic>? ?? [];
    return bookingsList.map((b) => Map<String, dynamic>.from(b as Map)).toList();
  }

  /// Fetch fulfillment details for a specific booking
  Future<Map<String, dynamic>> getBookingFulfillment(String bookingId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$bookingId');

    final res = await _client.get(url, headers: _buildHeaders(token));
    if (res.statusCode != 200) {
      throw Exception(_parseErrorMessage(res, 'Failed to fetch fulfillment details.'));
    }

    final data = jsonDecode(res.body);
    return Map<String, dynamic>.from(data['fulfillment'] as Map);
  }

  /// Advance delivery milestone (restricted to assigned vendor)
  Future<Map<String, dynamic>> updateMilestone({
    required String bookingId,
    required String milestone,
    String? notes,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$bookingId/milestone');

    final payload = {
      'milestone': milestone,
      'notes': ?notes,
    };

    final res = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(payload),
    );

    if (res.statusCode != 200) {
      throw Exception(_parseErrorMessage(res, 'Failed to update delivery milestone.'));
    }

    return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
  }

  /// Submit service completion notes and evidence references for admin review
  Future<Map<String, dynamic>> submitCompletion({
    required String bookingId,
    required String notes,
    List<String> checklistCompleted = const [],
    List<String> evidenceUrls = const [],
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$bookingId/submit-completion');

    final payload = {
      'notes': notes,
      'checklistCompleted': checklistCompleted,
      'evidenceUrls': evidenceUrls,
    };

    final res = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(payload),
    );

    if (res.statusCode != 200) {
      throw Exception(_parseErrorMessage(res, 'Failed to submit service completion evidence.'));
    }

    return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
  }

  /// Admin reviews service completion evidence (approve or reject with reason)
  Future<Map<String, dynamic>> reviewCompletion({
    required String bookingId,
    required bool approved,
    String? reason,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/$bookingId/review');

    final payload = {
      'approved': approved,
      'reason': ?reason,
    };

    final res = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(payload),
    );

    if (res.statusCode != 200) {
      throw Exception(_parseErrorMessage(res, 'Failed to review completion evidence.'));
    }

    return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
  }
}
