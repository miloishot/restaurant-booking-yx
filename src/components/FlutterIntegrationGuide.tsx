import React from 'react';
import { Download, Smartphone, Laptop, Code, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export function FlutterIntegrationGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Flutter Integration Guide</h2>
        <p className="text-gray-600">
          Connect your restaurant system with a native Flutter app for advanced printer discovery and management.
        </p>
      </div>

      <div className="space-y-8">
        {/* Overview Section */}
        <section>
          <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
            <Smartphone className="w-5 h-5 mr-2 text-blue-600" />
            Overview
          </h3>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-gray-700 mb-3">
              The Flutter integration allows you to discover and manage network printers from a native mobile or desktop application.
              This overcomes the limitations of browser-based printer discovery and provides a more robust solution for your restaurant.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <h4 className="font-semibold text-blue-800 mb-2">Mobile App</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Android & iOS support</li>
                  <li>• Network printer discovery</li>
                  <li>• Direct printer testing</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <h4 className="font-semibold text-blue-800 mb-2">Desktop App</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Windows, macOS & Linux</li>
                  <li>• Advanced printer management</li>
                  <li>• Direct printing capabilities</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <h4 className="font-semibold text-blue-800 mb-2">Integration</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Syncs with web dashboard</li>
                  <li>• Secure API communication</li>
                  <li>• Real-time printer status</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Download Section */}
        <section>
          <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
            <Download className="w-5 h-5 mr-2 text-green-600" />
            Download Apps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <h4 className="font-semibold text-gray-800 mb-2">Android App</h4>
              <p className="text-sm text-gray-600 mb-3">
                Discover and manage printers from your Android device.
              </p>
              <button className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                <Download className="w-4 h-4 mr-2" />
                Download APK
              </button>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <h4 className="font-semibold text-gray-800 mb-2">iOS App</h4>
              <p className="text-sm text-gray-600 mb-3">
                Available on the App Store for iPhone and iPad.
              </p>
              <button className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4 mr-2" />
                App Store
              </button>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <h4 className="font-semibold text-gray-800 mb-2">Desktop App</h4>
              <p className="text-sm text-gray-600 mb-3">
                Windows, macOS, and Linux versions available.
              </p>
              <button className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
                <Laptop className="w-4 h-4 mr-2" />
                Download for Desktop
              </button>
            </div>
          </div>
        </section>

        {/* API Integration Section */}
        <section>
          <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
            <Code className="w-5 h-5 mr-2 text-indigo-600" />
            API Integration
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-gray-700 mb-4">
              The Flutter app communicates with your restaurant system through secure API endpoints. 
              Here's how to integrate with your existing system:
            </p>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-gray-800">Authentication</h4>
                  <button 
                    onClick={() => handleCopy(`
// Flutter code to authenticate with your restaurant system
Future<String?> login(String email, String password) async {
  final response = await http.post(
    Uri.parse('https://your-restaurant-app.com/api/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'email': email, 'password': password}),
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['token'];
  }
  return null;
}`, 'auth')}
                    className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                  >
                    {copiedSection === 'auth' ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-gray-800 rounded-md p-4 overflow-x-auto">
                  <pre className="text-green-400 text-sm">
                    <code>{`// Flutter code to authenticate with your restaurant system
Future<String?> login(String email, String password) async {
  final response = await http.post(
    Uri.parse('https://your-restaurant-app.com/api/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'email': email, 'password': password}),
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['token'];
  }
  return null;
}`}</code>
                  </pre>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-gray-800">Sending Printer Data</h4>
                  <button 
                    onClick={() => handleCopy(`
// Flutter code to send printer data to your restaurant system
Future<bool> savePrinter(PrinterConfig printer, String token) async {
  final response = await http.post(
    Uri.parse('https://your-restaurant-app.com/api/printers'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token'
    },
    body: jsonEncode({
      'printer_name': printer.name,
      'printer_type': 'network',
      'ip_address': printer.ipAddress,
      'port': printer.port,
      'is_default': printer.isDefault,
      'is_active': true
    }),
  );
  
  return response.statusCode == 200 || response.statusCode == 201;
}`, 'printer')}
                    className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                  >
                    {copiedSection === 'printer' ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-gray-800 rounded-md p-4 overflow-x-auto">
                  <pre className="text-green-400 text-sm">
                    <code>{`// Flutter code to send printer data to your restaurant system
Future<bool> savePrinter(PrinterConfig printer, String token) async {
  final response = await http.post(
    Uri.parse('https://your-restaurant-app.com/api/printers'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token'
    },
    body: jsonEncode({
      'printer_name': printer.name,
      'printer_type': 'network',
      'ip_address': printer.ipAddress,
      'port': printer.port,
      'is_default': printer.isDefault,
      'is_active': true
    }),
  );
  
  return response.statusCode == 200 || response.statusCode == 201;
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Configuration Section */}
        <section>
          <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
            <Laptop className="w-5 h-5 mr-2 text-orange-600" />
            Configuration
          </h3>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <p className="text-gray-700 mb-4">
              To configure the Flutter app to work with your restaurant system:
            </p>
            
            <ol className="list-decimal pl-6 space-y-3 text-gray-700">
              <li>
                <strong>Download and install</strong> the appropriate app for your platform
              </li>
              <li>
                <strong>Launch the app</strong> and navigate to the settings screen
              </li>
              <li>
                <strong>Enter your API URL</strong>: <code className="bg-white px-2 py-1 rounded text-sm">https://your-restaurant-app.com/api</code>
              </li>
              <li>
                <strong>Log in</strong> with your restaurant account credentials
              </li>
              <li>
                <strong>Discover printers</strong> on your local network
              </li>
              <li>
                <strong>Save and sync</strong> printer configurations to your restaurant system
              </li>
            </ol>
            
            <div className="mt-4 p-3 bg-white rounded-lg border border-orange-100">
              <p className="text-sm text-orange-800 font-medium">Important Note:</p>
              <p className="text-sm text-orange-700">
                The mobile app must be on the same local network as your printers for discovery to work properly.
                For best results, connect to your restaurant's WiFi network before scanning.
              </p>
            </div>
          </div>
        </section>

        {/* Resources Section */}
        <section>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Additional Resources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a 
              href="#" 
              className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <ExternalLink className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-800">Developer Documentation</h4>
                <p className="text-sm text-gray-600">Complete API reference and integration guides</p>
              </div>
            </a>
            <a 
              href="#" 
              className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <Code className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-800">GitHub Repository</h4>
                <p className="text-sm text-gray-600">Source code and example implementations</p>
              </div>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}