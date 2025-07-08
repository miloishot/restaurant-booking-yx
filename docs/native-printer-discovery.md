# Native Printer Discovery Application

This guide outlines how to build a native application with network access capabilities for printer discovery across Android, iOS, and PC platforms.

## Overview

The native printer discovery application will:
1. Scan local networks for printers
2. Identify printer details (IP, port, model)
3. Test connections to printers
4. Save printer configurations
5. Integrate with the restaurant booking system

## Technology Stack Options

### Option 1: React Native with Expo

**Advantages:**
- Cross-platform (Android, iOS, web)
- JavaScript/TypeScript codebase (similar to your current web app)
- Large ecosystem of libraries
- Expo provides simplified development workflow

**Key Libraries:**
- `react-native-network-info` - Access network details
- `react-native-tcp-socket` - TCP socket connections for printer discovery
- `react-native-netinfo` - Network connectivity information
- `react-native-fs` - File system access for configuration storage

### Option 2: Flutter

**Advantages:**
- Cross-platform (Android, iOS, web, desktop)
- Single codebase for all platforms
- High performance native rendering
- Rich ecosystem of packages

**Key Libraries:**
- `network_info_plus` - Network information
- `dart:io` - Socket connections and network operations
- `shared_preferences` - Configuration storage

### Option 3: Electron (for desktop only)

**Advantages:**
- Web technologies (HTML, CSS, JavaScript)
- Full access to Node.js APIs
- Direct integration with your existing web app
- Native system capabilities

**Key Libraries:**
- `net` module - TCP socket connections
- `node-printer` - Direct printer access
- `electron-store` - Configuration storage

## Recommended Approach: React Native with Expo

React Native provides the best balance of cross-platform support, familiar technology (JavaScript/React), and network capabilities.

## Implementation Steps

### 1. Project Setup

```bash
# Install Expo CLI
npm install -g expo-cli

# Create new project
npx create-expo-app PrinterDiscoveryApp --template expo-template-blank-typescript

# Navigate to project
cd PrinterDiscoveryApp

# Install required dependencies
npm install react-native-network-info react-native-tcp-socket @react-native-community/netinfo react-native-fs
```

### 2. Network Scanner Implementation

Create a network scanner service that:
1. Determines the device's IP address and subnet
2. Scans the local network for devices with printer ports open
3. Identifies printer details through SNMP or other protocols

```typescript
// src/services/PrinterDiscovery.ts

import NetInfo from '@react-native-community/netinfo';
import { NetworkInfo } from 'react-native-network-info';
import TcpSocket from 'react-native-tcp-socket';

export interface DiscoveredPrinter {
  ip: string;
  port: number;
  name?: string;
  model?: string;
  manufacturer?: string;
}

export class PrinterDiscovery {
  // Common printer ports
  private static PRINTER_PORTS = [9100, 515, 631, 80];
  
  // Get device's IP and subnet
  static async getNetworkInfo() {
    const ipAddress = await NetworkInfo.getIPAddress();
    const subnet = await NetworkInfo.getSubnet();
    return { ipAddress, subnet };
  }
  
  // Scan network for printers
  static async scanNetwork(): Promise<DiscoveredPrinter[]> {
    const { ipAddress } = await this.getNetworkInfo();
    
    if (!ipAddress) {
      throw new Error('Could not determine device IP address');
    }
    
    // Extract network prefix (e.g., 192.168.1)
    const ipParts = ipAddress.split('.');
    const networkPrefix = ipParts.slice(0, 3).join('.');
    
    const printers: DiscoveredPrinter[] = [];
    const scanPromises: Promise<DiscoveredPrinter | null>[] = [];
    
    // Scan IP range (1-254)
    for (let i = 1; i <= 254; i++) {
      const ip = `${networkPrefix}.${i}`;
      scanPromises.push(this.checkIpForPrinter(ip));
    }
    
    const results = await Promise.all(scanPromises);
    results.forEach(printer => {
      if (printer) printers.push(printer);
    });
    
    return printers;
  }
  
  // Check if an IP has a printer
  private static async checkIpForPrinter(ip: string): Promise<DiscoveredPrinter | null> {
    for (const port of this.PRINTER_PORTS) {
      try {
        // Try to connect to the port with a timeout
        const socket = TcpSocket.createConnection({
          host: ip,
          port,
          timeout: 1000
        });
        
        return new Promise((resolve) => {
          socket.on('connect', () => {
            // Connection successful, likely a printer
            socket.destroy();
            resolve({
              ip,
              port,
              name: `Printer at ${ip}:${port}`
            });
          });
          
          socket.on('error', () => {
            socket.destroy();
            resolve(null);
          });
          
          socket.on('timeout', () => {
            socket.destroy();
            resolve(null);
          });
        });
      } catch (error) {
        // Connection failed, not a printer or not reachable
        continue;
      }
    }
    
    return null;
  }
  
  // Test connection to a specific printer
  static async testPrinterConnection(ip: string, port: number): Promise<boolean> {
    try {
      const socket = TcpSocket.createConnection({
        host: ip,
        port,
        timeout: 2000
      });
      
      return new Promise((resolve) => {
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }
}
```

### 3. User Interface

Create a user interface for printer discovery and management:

```typescript
// src/screens/PrinterDiscoveryScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { PrinterDiscovery, DiscoveredPrinter } from '../services/PrinterDiscovery';

export default function PrinterDiscoveryScreen() {
  const [scanning, setScanning] = useState(false);
  const [printers, setPrinters] = useState<DiscoveredPrinter[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const startScan = async () => {
    try {
      setScanning(true);
      setError(null);
      
      const discoveredPrinters = await PrinterDiscovery.scanNetwork();
      setPrinters(discoveredPrinters);
      
      if (discoveredPrinters.length === 0) {
        setError('No printers found on the network');
      }
    } catch (err) {
      setError(`Error scanning network: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };
  
  const testPrinter = async (printer: DiscoveredPrinter) => {
    try {
      const success = await PrinterDiscovery.testPrinterConnection(printer.ip, printer.port);
      
      if (success) {
        Alert.alert('Success', `Successfully connected to printer at ${printer.ip}:${printer.port}`);
      } else {
        Alert.alert('Connection Failed', `Could not connect to printer at ${printer.ip}:${printer.port}`);
      }
    } catch (err) {
      Alert.alert('Error', `Test failed: ${err.message}`);
    }
  };
  
  const savePrinter = (printer: DiscoveredPrinter) => {
    // Here you would save the printer to your app's storage
    // And potentially send it to your web application's backend
    Alert.alert('Printer Saved', `Printer at ${printer.ip}:${printer.port} has been saved`);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Printer Discovery</Text>
      
      <TouchableOpacity 
        style={[styles.scanButton, scanning && styles.scanningButton]} 
        onPress={startScan}
        disabled={scanning}
      >
        <Text style={styles.buttonText}>
          {scanning ? 'Scanning Network...' : 'Scan for Printers'}
        </Text>
        {scanning && <ActivityIndicator color="#fff" style={styles.spinner} />}
      </TouchableOpacity>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      <Text style={styles.sectionTitle}>
        {printers.length > 0 ? `Found Printers (${printers.length})` : 'No printers found yet'}
      </Text>
      
      <FlatList
        data={printers}
        keyExtractor={(item) => `${item.ip}:${item.port}`}
        renderItem={({ item }) => (
          <View style={styles.printerItem}>
            <View style={styles.printerInfo}>
              <Text style={styles.printerName}>{item.name || `Printer at ${item.ip}`}</Text>
              <Text style={styles.printerDetails}>{item.ip}:{item.port}</Text>
              {item.model && (
                <Text style={styles.printerModel}>{item.manufacturer} {item.model}</Text>
              )}
            </View>
            <View style={styles.printerActions}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.testButton]}
                onPress={() => testPrinter(item)}
              >
                <Text style={styles.actionButtonText}>Test</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.saveButton]}
                onPress={() => savePrinter(item)}
              >
                <Text style={styles.actionButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !scanning && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No printers found. Tap "Scan for Printers" to begin.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanningButton: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  spinner: {
    marginLeft: 8,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#b91c1c',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  printerItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  printerInfo: {
    flex: 1,
  },
  printerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  printerDetails: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 4,
  },
  printerModel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  printerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  testButton: {
    backgroundColor: '#e0f2fe',
  },
  saveButton: {
    backgroundColor: '#dcfce7',
  },
  actionButtonText: {
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
});
```

### 4. Integration with Web Application

Create a bridge between the native app and your web application:

```typescript
// src/services/WebAppIntegration.ts

import { DiscoveredPrinter } from './PrinterDiscovery';

export class WebAppIntegration {
  private static API_URL = 'https://your-restaurant-app.com/api';
  
  // Send discovered printer to web app
  static async sendPrinterToWebApp(
    printer: DiscoveredPrinter, 
    restaurantId: string, 
    authToken: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_URL}/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          restaurantId,
          printerName: printer.name || `Printer at ${printer.ip}`,
          printerType: 'network',
          ipAddress: printer.ip,
          port: printer.port,
          isDefault: false,
          isActive: true
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error sending printer to web app:', error);
      return false;
    }
  }
  
  // Get restaurant ID from web app
  static async getRestaurantId(authToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.API_URL}/user/restaurant`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.restaurantId;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting restaurant ID:', error);
      return null;
    }
  }
  
  // Login to web app
  static async login(email: string, password: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.token;
      }
      
      return null;
    } catch (error) {
      console.error('Error logging in:', error);
      return null;
    }
  }
}
```

### 5. Main App Component

```typescript
// App.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import PrinterDiscoveryScreen from './src/screens/PrinterDiscoveryScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Printer Discovery' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
        <Stack.Screen name="PrinterDiscovery" component={PrinterDiscoveryScreen} options={{ title: 'Find Printers' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## Building and Distribution

### Android

1. Configure app in `app.json`:
```json
{
  "expo": {
    "name": "Printer Discovery",
    "slug": "printer-discovery",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.printerdiscovery"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.yourcompany.printerdiscovery",
      "permissions": [
        "ACCESS_NETWORK_STATE",
        "ACCESS_WIFI_STATE",
        "INTERNET"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

2. Build for Android:
```bash
expo build:android
```

### iOS

1. Build for iOS:
```bash
expo build:ios
```

### Desktop (Electron)

For desktop support, you can wrap the React Native app with Electron:

1. Install Electron dependencies:
```bash
npm install electron electron-builder
```

2. Create Electron main file:
```javascript
// electron/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, '../web-build/index.html'),
    protocol: 'file:',
    slashes: true
  });
  
  mainWindow.loadURL(startUrl);
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function() {
  if (mainWindow === null) {
    createWindow();
  }
});
```

3. Add Electron build scripts to package.json:
```json
"scripts": {
  "electron": "electron ./electron/main.js",
  "electron-build": "electron-builder"
}
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

This native application provides a robust solution for discovering and configuring network printers across multiple platforms. By using React Native, you can maintain a single codebase while deploying to Android, iOS, and desktop platforms.

The application handles the complex network operations that are restricted in web browsers, providing a seamless experience for restaurant staff to set up their printing infrastructure.