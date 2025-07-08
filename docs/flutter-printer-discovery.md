# Flutter Printer Discovery Application

This guide outlines how to build a native application with Flutter for printer discovery across Android, iOS, and PC platforms.

## Overview

The Flutter printer discovery application will:
1. Scan local networks for printers
2. Identify printer details (IP, port, model)
3. Test connections to printers
4. Save printer configurations
5. Integrate with the restaurant booking system

## Why Flutter?

Flutter is an excellent choice for this application because:
- **Cross-platform**: Single codebase for Android, iOS, Windows, macOS, and Linux
- **Native performance**: Direct access to network APIs for printer discovery
- **Rich ecosystem**: Extensive libraries for network operations
- **Modern UI**: Beautiful, customizable interface components
- **Easy integration**: Can communicate with your existing web application

## Project Setup

### 1. Install Flutter

Follow the [official Flutter installation guide](https://flutter.dev/docs/get-started/install) for your operating system.

### 2. Create a new Flutter project

```bash
# Create a new Flutter project
flutter create printer_discovery
cd printer_discovery
```

### 3. Add required dependencies

Update your `pubspec.yaml` file:

```yaml
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.2
  network_info_plus: ^3.0.1  # For network information
  ping_discover_network: ^0.2.0+1  # For network scanning
  shared_preferences: ^2.0.15  # For storing configurations
  http: ^0.13.5  # For API communication
  provider: ^6.0.3  # For state management
  flutter_secure_storage: ^6.0.0  # For secure storage
  permission_handler: ^10.0.0  # For handling permissions
```

Run `flutter pub get` to install the dependencies.

## Implementation

### 1. Network Scanner Service

Create a service to discover printers on the network:

```dart
// lib/services/printer_discovery_service.dart

import 'dart:async';
import 'dart:io';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:ping_discover_network/ping_discover_network.dart';

class PrinterDiscoveryService {
  static const List<int> PRINTER_PORTS = [9100, 515, 631, 80];
  
  // Discovered printer model
  class DiscoveredPrinter {
    final String ip;
    final int port;
    final String? name;
    final String? model;
    final String? manufacturer;
    
    DiscoveredPrinter({
      required this.ip,
      required this.port,
      this.name,
      this.model,
      this.manufacturer,
    });
    
    @override
    String toString() => 'Printer at $ip:$port';
  }
  
  // Get network information
  Future<Map<String, String?>> getNetworkInfo() async {
    final info = NetworkInfo();
    final wifiIP = await info.getWifiIP();
    final wifiName = await info.getWifiName();
    final wifiBSSID = await info.getWifiBSSID();
    
    return {
      'ip': wifiIP,
      'name': wifiName,
      'bssid': wifiBSSID,
    };
  }
  
  // Scan network for printers
  Future<List<DiscoveredPrinter>> scanNetwork({
    Function(double)? onProgress,
  }) async {
    final networkInfo = await getNetworkInfo();
    final deviceIP = networkInfo['ip'];
    
    if (deviceIP == null) {
      throw Exception('Could not determine device IP address');
    }
    
    // Extract network prefix (e.g., 192.168.1)
    final ipParts = deviceIP.split('.');
    if (ipParts.length != 4) {
      throw Exception('Invalid IP address format');
    }
    
    final networkPrefix = ipParts.sublist(0, 3).join('.');
    final List<DiscoveredPrinter> printers = [];
    
    // Scan common printer ports
    for (final port in PRINTER_PORTS) {
      final stream = NetworkAnalyzer.discover2(
        networkPrefix,
        port,
        timeout: Duration(milliseconds: 5000),
      );
      
      int count = 0;
      await for (final addr in stream) {
        // Update progress
        if (onProgress != null) {
          // Calculate progress (0-100%)
          final progress = (count / 254) * 100 / PRINTER_PORTS.length + 
                          (PRINTER_PORTS.indexOf(port) / PRINTER_PORTS.length * 100);
          onProgress(progress);
        }
        
        count++;
        
        if (addr.exists) {
          // Found a device with this port open
          final printer = DiscoveredPrinter(
            ip: addr.ip,
            port: port,
            name: await _tryGetPrinterName(addr.ip, port),
          );
          
          // Check if this printer is already in the list (different port)
          final existingIndex = printers.indexWhere((p) => p.ip == addr.ip);
          if (existingIndex >= 0) {
            // Update existing printer if this is a more common printer port
            if (PRINTER_PORTS.indexOf(port) < PRINTER_PORTS.indexOf(printers[existingIndex].port)) {
              printers[existingIndex] = printer;
            }
          } else {
            printers.add(printer);
          }
        }
      }
    }
    
    return printers;
  }
  
  // Try to get printer name using SNMP or other protocols
  Future<String?> _tryGetPrinterName(String ip, int port) async {
    // In a real implementation, you would use SNMP or other protocols
    // to query the printer for its name, model, etc.
    // For simplicity, we'll return a generic name based on the IP
    return 'Printer at $ip';
  }
  
  // Test connection to a specific printer
  Future<bool> testPrinterConnection(String ip, int port) async {
    try {
      final socket = await Socket.connect(ip, port, timeout: Duration(seconds: 2));
      socket.destroy();
      return true;
    } catch (e) {
      return false;
    }
  }
}
```

### 2. Printer Configuration Service

Create a service to manage printer configurations:

```dart
// lib/services/printer_config_service.dart

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class PrinterConfig {
  final String? id;
  final String name;
  final String type;
  final String ipAddress;
  final int port;
  final bool isDefault;
  final bool isActive;
  
  PrinterConfig({
    this.id,
    required this.name,
    required this.type,
    required this.ipAddress,
    required this.port,
    this.isDefault = false,
    this.isActive = true,
  });
  
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type,
    'ipAddress': ipAddress,
    'port': port,
    'isDefault': isDefault,
    'isActive': isActive,
  };
  
  factory PrinterConfig.fromJson(Map<String, dynamic> json) => PrinterConfig(
    id: json['id'],
    name: json['name'],
    type: json['type'],
    ipAddress: json['ipAddress'],
    port: json['port'],
    isDefault: json['isDefault'] ?? false,
    isActive: json['isActive'] ?? true,
  );
}

class PrinterConfigService {
  static const String _storageKey = 'printer_configs';
  static const String _apiBaseUrl = 'https://your-restaurant-app.com/api';
  final _secureStorage = FlutterSecureStorage();
  
  // Save printer configuration locally
  Future<void> savePrinterConfig(PrinterConfig config) async {
    final prefs = await SharedPreferences.getInstance();
    final configs = await getPrinterConfigs();
    
    // Check if this is an update or new config
    final existingIndex = configs.indexWhere((c) => c.id == config.id);
    
    if (existingIndex >= 0) {
      configs[existingIndex] = config;
    } else {
      configs.add(config);
    }
    
    // Save to shared preferences
    await prefs.setString(_storageKey, jsonEncode(configs.map((c) => c.toJson()).toList()));
  }
  
  // Get all printer configurations
  Future<List<PrinterConfig>> getPrinterConfigs() async {
    final prefs = await SharedPreferences.getInstance();
    final configsJson = prefs.getString(_storageKey);
    
    if (configsJson == null) {
      return [];
    }
    
    final List<dynamic> configsList = jsonDecode(configsJson);
    return configsList.map((json) => PrinterConfig.fromJson(json)).toList();
  }
  
  // Delete printer configuration
  Future<void> deletePrinterConfig(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final configs = await getPrinterConfigs();
    
    configs.removeWhere((c) => c.id == id);
    
    await prefs.setString(_storageKey, jsonEncode(configs.map((c) => c.toJson()).toList()));
  }
  
  // Sync with web application
  Future<bool> syncWithWebApp(PrinterConfig config, String restaurantId) async {
    try {
      final token = await _secureStorage.read(key: 'auth_token');
      
      if (token == null) {
        throw Exception('Not authenticated');
      }
      
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/printers'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'restaurantId': restaurantId,
          'printerName': config.name,
          'printerType': config.type,
          'ipAddress': config.ipAddress,
          'port': config.port,
          'isDefault': config.isDefault,
          'isActive': config.isActive,
        }),
      );
      
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Error syncing with web app: $e');
      return false;
    }
  }
  
  // Get restaurant ID from web app
  Future<String?> getRestaurantId() async {
    try {
      final token = await _secureStorage.read(key: 'auth_token');
      
      if (token == null) {
        return null;
      }
      
      final response = await http.get(
        Uri.parse('$_apiBaseUrl/user/restaurant'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['restaurantId'];
      }
      
      return null;
    } catch (e) {
      print('Error getting restaurant ID: $e');
      return null;
    }
  }
  
  // Login to web app
  Future<String?> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/auth/login'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['token'];
        
        // Save token to secure storage
        await _secureStorage.write(key: 'auth_token', value: token);
        
        return token;
      }
      
      return null;
    } catch (e) {
      print('Error logging in: $e');
      return null;
    }
  }
}
```

### 3. User Interface

Create the printer discovery screen:

```dart
// lib/screens/printer_discovery_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/printer_discovery_service.dart';
import '../services/printer_config_service.dart';

class PrinterDiscoveryScreen extends StatefulWidget {
  @override
  _PrinterDiscoveryScreenState createState() => _PrinterDiscoveryScreenState();
}

class _PrinterDiscoveryScreenState extends State<PrinterDiscoveryScreen> {
  final _discoveryService = PrinterDiscoveryService();
  final _configService = PrinterConfigService();
  
  bool _scanning = false;
  double _scanProgress = 0;
  String? _error;
  List<PrinterDiscoveryService.DiscoveredPrinter> _printers = [];
  String? _selectedPrinterId;
  
  // Controllers for manual entry
  final _ipController = TextEditingController();
  final _portController = TextEditingController(text: '9100');
  final _nameController = TextEditingController();
  
  @override
  void dispose() {
    _ipController.dispose();
    _portController.dispose();
    _nameController.dispose();
    super.dispose();
  }
  
  Future<void> _scanNetwork() async {
    setState(() {
      _scanning = true;
      _error = null;
      _scanProgress = 0;
      _printers = [];
    });
    
    try {
      final printers = await _discoveryService.scanNetwork(
        onProgress: (progress) {
          setState(() {
            _scanProgress = progress;
          });
        },
      );
      
      setState(() {
        _printers = printers;
        
        if (printers.isEmpty) {
          _error = 'No printers found on the network';
        }
      });
    } catch (e) {
      setState(() {
        _error = 'Error scanning network: $e';
      });
    } finally {
      setState(() {
        _scanning = false;
        _scanProgress = 100;
      });
    }
  }
  
  Future<void> _testPrinter(PrinterDiscoveryService.DiscoveredPrinter printer) async {
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    
    try {
      final success = await _discoveryService.testPrinterConnection(
        printer.ip,
        printer.port,
      );
      
      if (success) {
        scaffoldMessenger.showSnackBar(
          SnackBar(
            content: Text('Successfully connected to printer at ${printer.ip}:${printer.port}'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        scaffoldMessenger.showSnackBar(
          SnackBar(
            content: Text('Could not connect to printer at ${printer.ip}:${printer.port}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      scaffoldMessenger.showSnackBar(
        SnackBar(
          content: Text('Error testing printer: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  
  Future<void> _savePrinter(PrinterDiscoveryService.DiscoveredPrinter printer) async {
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    
    try {
      // Create printer config
      final config = PrinterConfig(
        name: printer.name ?? 'Printer at ${printer.ip}',
        type: 'network',
        ipAddress: printer.ip,
        port: printer.port,
      );
      
      // Save locally
      await _configService.savePrinterConfig(config);
      
      // Try to sync with web app
      final restaurantId = await _configService.getRestaurantId();
      
      if (restaurantId != null) {
        await _configService.syncWithWebApp(config, restaurantId);
        scaffoldMessenger.showSnackBar(
          SnackBar(
            content: Text('Printer saved and synced with web app'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        scaffoldMessenger.showSnackBar(
          SnackBar(
            content: Text('Printer saved locally. Login to sync with web app.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
      
      // Navigate back
      Navigator.pop(context, true);
    } catch (e) {
      scaffoldMessenger.showSnackBar(
        SnackBar(
          content: Text('Error saving printer: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  
  Future<void> _addManualPrinter() async {
    final ip = _ipController.text.trim();
    final portText = _portController.text.trim();
    final name = _nameController.text.trim();
    
    if (ip.isEmpty) {
      setState(() {
        _error = 'Please enter a valid IP address';
      });
      return;
    }
    
    final port = int.tryParse(portText) ?? 9100;
    
    final printer = PrinterDiscoveryService.DiscoveredPrinter(
      ip: ip,
      port: port,
      name: name.isNotEmpty ? name : 'Printer at $ip',
    );
    
    await _savePrinter(printer);
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Discover Printers'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Info card
            Card(
              color: Colors.blue.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.blue.shade800),
                        SizedBox(width: 8),
                        Text(
                          'About Printer Discovery',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.blue.shade800,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 8),
                    Text(
                      'This tool will scan your local network for printers. Make sure your printers are powered on and connected to the same network as this device.',
                      style: TextStyle(color: Colors.blue.shade700),
                    ),
                  ],
                ),
              ),
            ),
            
            SizedBox(height: 16),
            
            // Scan button
            ElevatedButton.icon(
              onPressed: _scanning ? null : _scanNetwork,
              icon: _scanning
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : Icon(Icons.wifi),
              label: Text(_scanning ? 'Scanning...' : 'Scan for Printers'),
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(vertical: 12),
              ),
            ),
            
            if (_scanning)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: LinearProgressIndicator(value: _scanProgress / 100),
              ),
            
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Card(
                  color: Colors.red.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(color: Colors.red.shade800),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            
            SizedBox(height: 16),
            
            Text(
              _printers.isEmpty
                  ? 'No printers found yet'
                  : 'Found Printers (${_printers.length})',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            
            SizedBox(height: 8),
            
            Expanded(
              child: _printers.isEmpty
                  ? Center(
                      child: _scanning
                          ? Text('Scanning network...')
                          : Text('No printers found. Tap "Scan for Printers" to begin.'),
                    )
                  : ListView.builder(
                      itemCount: _printers.length,
                      itemBuilder: (context, index) {
                        final printer = _printers[index];
                        final isSelected = _selectedPrinterId == '${printer.ip}:${printer.port}';
                        
                        return Card(
                          color: isSelected ? Colors.blue.shade50 : null,
                          child: ListTile(
                            title: Text(printer.name ?? 'Printer at ${printer.ip}'),
                            subtitle: Text('${printer.ip}:${printer.port}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: Icon(Icons.check, color: Colors.green),
                                  onPressed: () => _testPrinter(printer),
                                  tooltip: 'Test Connection',
                                ),
                                IconButton(
                                  icon: Icon(Icons.save, color: Colors.blue),
                                  onPressed: () => _savePrinter(printer),
                                  tooltip: 'Save Printer',
                                ),
                              ],
                            ),
                            onTap: () {
                              setState(() {
                                _selectedPrinterId = '${printer.ip}:${printer.port}';
                              });
                            },
                          ),
                        );
                      },
                    ),
            ),
            
            SizedBox(height: 16),
            
            ExpansionTile(
              title: Text('Manual Printer Setup'),
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: _ipController,
                        decoration: InputDecoration(
                          labelText: 'IP Address',
                          hintText: '192.168.1.100',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                      SizedBox(height: 12),
                      TextField(
                        controller: _portController,
                        decoration: InputDecoration(
                          labelText: 'Port',
                          hintText: '9100',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                      SizedBox(height: 12),
                      TextField(
                        controller: _nameController,
                        decoration: InputDecoration(
                          labelText: 'Printer Name (Optional)',
                          hintText: 'Office Printer',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _addManualPrinter,
                        child: Text('Add Printer Manually'),
                        style: ElevatedButton.styleFrom(
                          padding: EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

### 4. Main App

Create the main app with navigation:

```dart
// lib/main.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/printer_discovery_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/printer_list_screen.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Printer Discovery',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => HomeScreen(),
        '/login': (context) => LoginScreen(),
        '/printers': (context) => PrinterListScreen(),
        '/discover': (context) => PrinterDiscoveryScreen(),
      },
    );
  }
}
```

### 5. Home Screen

Create a home screen:

```dart
// lib/screens/home_screen.dart

import 'package:flutter/material.dart';
import '../services/printer_config_service.dart';

class HomeScreen extends StatefulWidget {
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _configService = PrinterConfigService();
  bool _isLoggedIn = false;
  String? _restaurantName;
  
  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }
  
  Future<void> _checkLoginStatus() async {
    final restaurantId = await _configService.getRestaurantId();
    
    setState(() {
      _isLoggedIn = restaurantId != null;
      _restaurantName = _isLoggedIn ? 'Your Restaurant' : null;
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Printer Discovery'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Restaurant Printer Manager',
                      style: Theme.of(context).textTheme.headline5,
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Discover and manage network printers for your restaurant',
                      style: Theme.of(context).textTheme.subtitle1,
                    ),
                    SizedBox(height: 16),
                    if (_isLoggedIn)
                      Text(
                        'Connected to: $_restaurantName',
                        style: TextStyle(
                          color: Colors.green,
                          fontWeight: FontWeight.bold,
                        ),
                      )
                    else
                      Text(
                        'Not connected to restaurant system',
                        style: TextStyle(
                          color: Colors.orange,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            
            SizedBox(height: 24),
            
            // Main actions
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              children: [
                _buildActionCard(
                  context,
                  'Discover Printers',
                  Icons.search,
                  Colors.blue,
                  () => Navigator.pushNamed(context, '/discover'),
                ),
                _buildActionCard(
                  context,
                  'Manage Printers',
                  Icons.print,
                  Colors.green,
                  () => Navigator.pushNamed(context, '/printers'),
                ),
                _buildActionCard(
                  context,
                  _isLoggedIn ? 'Account Settings' : 'Login',
                  _isLoggedIn ? Icons.settings : Icons.login,
                  Colors.purple,
                  () => Navigator.pushNamed(context, '/login'),
                ),
                _buildActionCard(
                  context,
                  'Help & Support',
                  Icons.help_outline,
                  Colors.orange,
                  () => _showHelpDialog(context),
                ),
              ],
            ),
            
            Spacer(),
            
            // Footer
            Text(
              '© 2025 Restaurant Printer Manager',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.grey,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildActionCard(
    BuildContext context,
    String title,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 48,
                color: color,
              ),
              SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  void _showHelpDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Help & Support'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Need help with printer discovery?'),
            SizedBox(height: 16),
            Text('• Make sure printers are powered on'),
            Text('• Connect to the same network as your printers'),
            Text('• Check firewall settings'),
            Text('• Ensure printers have static IP addresses'),
            SizedBox(height: 16),
            Text('Contact support@restaurant-app.com for assistance'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Close'),
          ),
        ],
      ),
    );
  }
}
```

### 6. Login Screen

Create a login screen to connect with your web application:

```dart
// lib/screens/login_screen.dart

import 'package:flutter/material.dart';
import '../services/printer_config_service.dart';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _configService = PrinterConfigService();
  
  bool _isLoading = false;
  String? _error;
  
  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
  
  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    setState(() {
      _isLoading = true;
      _error = null;
    });
    
    try {
      final token = await _configService.login(
        _emailController.text.trim(),
        _passwordController.text,
      );
      
      if (token != null) {
        // Login successful
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Login successful'),
            backgroundColor: Colors.green,
          ),
        );
        
        // Navigate back
        Navigator.pop(context);
      } else {
        setState(() {
          _error = 'Invalid email or password';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Error logging in: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Login'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Connect to Restaurant System',
                        style: Theme.of(context).textTheme.headline6,
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Login with your restaurant account to sync printers with your web dashboard',
                        style: TextStyle(color: Colors.grey.shade700),
                      ),
                    ],
                  ),
                ),
              ),
              
              SizedBox(height: 24),
              
              if (_error != null)
                Card(
                  color: Colors.red.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(color: Colors.red.shade800),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              
              SizedBox(height: 16),
              
              TextFormField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your email';
                  }
                  if (!value.contains('@')) {
                    return 'Please enter a valid email';
                  }
                  return null;
                },
              ),
              
              SizedBox(height: 16),
              
              TextFormField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your password';
                  }
                  return null;
                },
              ),
              
              SizedBox(height: 24),
              
              ElevatedButton(
                onPressed: _isLoading ? null : _login,
                child: _isLoading
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          ),
                          SizedBox(width: 12),
                          Text('Logging in...'),
                        ],
                      )
                    : Text('Login'),
                style: ElevatedButton.styleFrom(
                  padding: EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

### 7. Printer List Screen

Create a screen to manage saved printers:

```dart
// lib/screens/printer_list_screen.dart

import 'package:flutter/material.dart';
import '../services/printer_config_service.dart';
import '../services/printer_discovery_service.dart';

class PrinterListScreen extends StatefulWidget {
  @override
  _PrinterListScreenState createState() => _PrinterListScreenState();
}

class _PrinterListScreenState extends State<PrinterListScreen> {
  final _configService = PrinterConfigService();
  final _discoveryService = PrinterDiscoveryService();
  
  List<PrinterConfig> _printers = [];
  bool _loading = true;
  String? _testingPrinterId;
  
  @override
  void initState() {
    super.initState();
    _loadPrinters();
  }
  
  Future<void> _loadPrinters() async {
    setState(() {
      _loading = true;
    });
    
    try {
      final printers = await _configService.getPrinterConfigs();
      setState(() {
        _printers = printers;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error loading printers: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }
  
  Future<void> _testPrinter(PrinterConfig printer) async {
    setState(() {
      _testingPrinterId = printer.id;
    });
    
    try {
      final success = await _discoveryService.testPrinterConnection(
        printer.ipAddress,
        printer.port,
      );
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'Successfully connected to printer'
                : 'Failed to connect to printer',
          ),
          backgroundColor: success ? Colors.green : Colors.red,
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error testing printer: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _testingPrinterId = null;
      });
    }
  }
  
  Future<void> _deletePrinter(PrinterConfig printer) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete Printer'),
        content: Text('Are you sure you want to delete this printer?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Delete'),
          ),
        ],
      ),
    );
    
    if (confirm != true) {
      return;
    }
    
    try {
      await _configService.deletePrinterConfig(printer.id!);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Printer deleted'),
          backgroundColor: Colors.green,
        ),
      );
      
      _loadPrinters();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error deleting printer: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  
  Future<void> _syncPrinters() async {
    final restaurantId = await _configService.getRestaurantId();
    
    if (restaurantId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please login to sync printers'),
          backgroundColor: Colors.orange,
          action: SnackBarAction(
            label: 'Login',
            onPressed: () => Navigator.pushNamed(context, '/login'),
          ),
        ),
      );
      return;
    }
    
    setState(() {
      _loading = true;
    });
    
    try {
      int successCount = 0;
      
      for (final printer in _printers) {
        final success = await _configService.syncWithWebApp(printer, restaurantId);
        if (success) {
          successCount++;
        }
      }
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Synced $successCount of ${_printers.length} printers'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error syncing printers: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Manage Printers'),
        actions: [
          IconButton(
            icon: Icon(Icons.sync),
            onPressed: _syncPrinters,
            tooltip: 'Sync with Web App',
          ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator())
          : _printers.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.print_disabled,
                        size: 64,
                        color: Colors.grey,
                      ),
                      SizedBox(height: 16),
                      Text(
                        'No printers configured yet',
                        style: TextStyle(
                          fontSize: 18,
                          color: Colors.grey.shade700,
                        ),
                      ),
                      SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: () => Navigator.pushNamed(context, '/discover'),
                        icon: Icon(Icons.search),
                        label: Text('Discover Printers'),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  itemCount: _printers.length,
                  itemBuilder: (context, index) {
                    final printer = _printers[index];
                    
                    return Card(
                      margin: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: ListTile(
                        leading: Icon(
                          Icons.print,
                          color: printer.isActive ? Colors.blue : Colors.grey,
                        ),
                        title: Text(printer.name),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${printer.ipAddress}:${printer.port}'),
                            if (printer.isDefault)
                              Text(
                                'Default Printer',
                                style: TextStyle(
                                  color: Colors.green,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                          ],
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: _testingPrinterId == printer.id
                                  ? SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : Icon(Icons.check_circle_outline),
                              onPressed: _testingPrinterId != null
                                  ? null
                                  : () => _testPrinter(printer),
                              tooltip: 'Test Connection',
                            ),
                            IconButton(
                              icon: Icon(Icons.delete_outline),
                              onPressed: () => _deletePrinter(printer),
                              tooltip: 'Delete Printer',
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.pushNamed(context, '/discover'),
        child: Icon(Icons.add),
        tooltip: 'Add Printer',
      ),
    );
  }
}
```

## Building and Distribution

### Android

1. Configure app in `android/app/src/main/AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>
    
    <application
        android:label="Printer Discovery"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher">
        <!-- ... rest of your manifest ... -->
    </application>
</manifest>
```

2. Build for Android:
```bash
flutter build apk --release
```

### iOS

1. Configure app in `ios/Runner/Info.plist`:
```xml
<key>NSLocalNetworkUsageDescription</key>
<string>This app needs access to your local network to discover printers</string>
```

2. Build for iOS:
```bash
flutter build ios --release
```

### Windows/macOS/Linux

1. Enable desktop support:
```bash
flutter config --enable-windows-desktop
flutter config --enable-macos-desktop
flutter config --enable-linux-desktop
```

2. Build for desktop:
```bash
# For Windows
flutter build windows --release

# For macOS
flutter build macos --release

# For Linux
flutter build linux --release
```

## Integration with Restaurant Booking System

### API Endpoints

To integrate with your restaurant booking system, create these API endpoints:

1. **POST /api/printers** - Save printer configuration
2. **GET /api/printers** - Get all printers for a restaurant
3. **PUT /api/printers/:id** - Update printer configuration
4. **DELETE /api/printers/:id** - Delete printer configuration
5. **POST /api/printers/:id/test** - Test printer connection

### Security Considerations

1. Implement proper authentication for API endpoints
2. Use HTTPS for all API communication
3. Validate printer configurations before saving
4. Implement rate limiting to prevent abuse

## Conclusion

This Flutter application provides a robust solution for discovering and configuring network printers across multiple platforms. By using Flutter, you can maintain a single codebase while deploying to Android, iOS, and desktop platforms.

The application handles the complex network operations that are restricted in web browsers, providing a seamless experience for restaurant staff to set up their printing infrastructure.