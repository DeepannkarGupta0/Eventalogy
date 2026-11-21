import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../core/config/api_config.dart';

/// Flutter client service for interacting with authenticated payment endpoints:
/// - Order creation from trusted server-side booking/event records
/// - Cryptographic signature verification
/// - Sandbox test-double simulation
/// - Historical payment retrieval with ownership enforcement
class PaymentApiService {
  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? tokenProvider;

  PaymentApiService({
    http.Client? client,
    String? baseUrl,
    this.tokenProvider,
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? '${ApiConfig.baseUrl}/api/payments';

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

  /// Create a payment order for a booking or canonical event.
  /// Derives amount strictly on the backend.
  Future<Map<String, dynamic>> createOrder({
    String? bookingId,
    String? eventId,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/create-order');

    final payload = {
      'bookingId': ?bookingId,
      'eventId': ?eventId,
    };

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(payload),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return json;
    } else {
      final error = _parseErrorMessage(response, 'Failed to create payment order (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }

  /// Verify client-side payment completion with cryptographic HMAC signature verification.
  Future<Map<String, dynamic>> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/verify');

    final payload = {
      'razorpay_order_id': razorpayOrderId,
      'razorpay_payment_id': razorpayPaymentId,
      'razorpay_signature': razorpaySignature,
    };

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(payload),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return json;
    } else {
      final error = _parseErrorMessage(response, 'Payment verification failed (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }

  /// Sandbox test-double: generate simulated payment signature for testing.
  Future<Map<String, dynamic>> simulateSandboxPayment({
    required String orderId,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/sandbox-simulate-payment');

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode({'orderId': orderId}),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return json;
    } else {
      final error = _parseErrorMessage(response, 'Sandbox simulation failed (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }

  /// Sandbox test-double: simulate a payment failure event.
  Future<Map<String, dynamic>> simulateSandboxFailure({
    required String orderId,
    String? reason,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/sandbox-simulate-failure');

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode({
        'orderId': orderId,
        'reason': ?reason,
      }),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return json;
    } else {
      final error = _parseErrorMessage(response, 'Sandbox failure simulation failed (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }

  /// Retrieve the payment record for a booking with server-side ownership verification.
  Future<Map<String, dynamic>?> fetchBookingPayment(String bookingId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/booking/$bookingId');

    final response = await _client.get(
      url,
      headers: _buildHeaders(token),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else if (response.statusCode == 404) {
      return null;
    } else {
      final error = _parseErrorMessage(response, 'Failed to retrieve booking payment (HTTP ${response.statusCode})');
      throw Exception(error);
    }
  }
}
