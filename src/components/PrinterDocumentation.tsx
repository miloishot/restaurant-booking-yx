import React from 'react';
import { FileText, Printer, QrCode, Wifi, AlertTriangle, HelpCircle, CheckCircle, Settings } from 'lucide-react';

export function PrinterDocumentation() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <FileText className="w-6 h-6 text-blue-600 mr-3" />
        <h2 className="text-xl font-semibold text-gray-800">QR Code Printing Documentation</h2>
      </div>

      <div className="space-y-8">
        {/* Overview Section */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <QrCode className="w-5 h-5 text-blue-600 mr-2" />
            System Overview
          </h3>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-gray-700 mb-3">
              The QR Code Printing System allows restaurant staff to generate and print QR codes for tables, 
              enabling customers to access the digital menu and ordering system by scanning the code with their smartphones.
            </p>
            <p className="text-gray-700">
              This system supports direct network printing to compatible thermal receipt printers, 
              as well as standard browser printing for regular printers.
            </p>
          </div>
        </section>

        {/* Printer Setup Section */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <Settings className="w-5 h-5 text-blue-600 mr-2" />
            Printer Setup Guide
          </h3>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-2">Network Printer Requirements</h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Thermal receipt printer with network capability (Ethernet or Wi-Fi)</li>
                <li>Printer must support ESC/POS command set (most thermal receipt printers do)</li>
                <li>Static IP address assigned to the printer</li>
                <li>Printer must be on the same network as the computer running the application</li>
                <li>Network port 9100 must be open for communication (standard printer port)</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-2">Supported Printer Models</h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li><strong>Epson:</strong> TM-T88V, TM-T88VI, TM-T20II, TM-m30</li>
                <li><strong>Star Micronics:</strong> TSP100, TSP650II, mC-Print2, mC-Print3</li>
                <li><strong>Bixolon:</strong> SRP-350III, SRP-350plusIII, SRP-380</li>
                <li><strong>Citizen:</strong> CT-S310II, CT-S601II, CT-S751</li>
                <li><strong>Other:</strong> Any printer supporting ESC/POS commands and network connectivity</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-2">Network Printer Configuration Steps</h4>
              <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-2">
                <li>
                  <strong>Assign Static IP:</strong> Configure your printer with a static IP address through its control panel or web interface.
                </li>
                <li>
                  <strong>Verify Network Connection:</strong> Ensure the printer is connected to the same network as your computer.
                </li>
                <li>
                  <strong>Test Network Connectivity:</strong> Ping the printer's IP address to verify it's reachable.
                </li>
                <li>
                  <strong>Add Printer in System:</strong> Go to the Printer Setup page and add your printer with its IP address and port (usually 9100).
                </li>
                <li>
                  <strong>Test Print:</strong> Send a test print to verify the connection is working properly.
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* QR Code Printing Section */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <Printer className="w-5 h-5 text-blue-600 mr-2" />
            QR Code Printing Guide
          </h3>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-2">Printing Methods</h4>
              <div className="space-y-3">
                <div>
                  <h5 className="text-sm font-medium text-gray-700">1. Direct Network Printing</h5>
                  <p className="text-sm text-gray-600 ml-4">
                    Sends print jobs directly to network-enabled thermal receipt printers. 
                    Requires proper printer configuration in the system.
                  </p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-700">2. Browser Printing</h5>
                  <p className="text-sm text-gray-600 ml-4">
                    Uses the browser's built-in print functionality. Works with any printer 
                    connected to your computer. Provides more formatting options.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-2">QR Code Specifications</h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li><strong>Error Correction Level:</strong> Medium (M) - Balances size and reliability</li>
                <li><strong>Size Options:</strong> Small (32×32), Medium (48×48), Large (64×64)</li>
                <li><strong>Format:</strong> PNG image (for browser printing) or binary data (for direct printing)</li>
                <li><strong>Content:</strong> URL linking to the table's unique ordering session</li>
                <li><strong>Margin:</strong> 2 modules (white space around the QR code)</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-2">Best Practices</h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Use medium or large size QR codes for better scanning reliability</li>
                <li>Print on high-quality paper or card stock for durability</li>
                <li>Consider laminating QR codes for tables to protect from spills and damage</li>
                <li>Test QR codes after printing to ensure they scan properly</li>
                <li>Include clear instructions for customers on how to use the QR codes</li>
                <li>Print multiple copies as backups in case of damage or loss</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Troubleshooting Section */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
            Troubleshooting
          </h3>
          <div className="space-y-4">
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <h4 className="font-medium text-orange-800 mb-2">Common Issues</h4>
              <div className="space-y-3">
                <div>
                  <h5 className="text-sm font-medium text-orange-700">Printer Not Responding</h5>
                  <ul className="list-disc pl-5 text-sm text-orange-600 space-y-1">
                    <li>Verify the printer is powered on and connected to the network</li>
                    <li>Check that the IP address and port are correct</li>
                    <li>Ensure there are no firewall restrictions blocking port 9100</li>
                    <li>Try restarting the printer</li>
                  </ul>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-orange-700">QR Codes Not Scanning</h5>
                  <ul className="list-disc pl-5 text-sm text-orange-600 space-y-1">
                    <li>Increase the QR code size for better readability</li>
                    <li>Ensure the printer has sufficient resolution for QR codes</li>
                    <li>Check that there's adequate lighting for customers to scan the codes</li>
                    <li>Verify the QR code URL is correct and accessible</li>
                  </ul>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-orange-700">Print Quality Issues</h5>
                  <ul className="list-disc pl-5 text-sm text-orange-600 space-y-1">
                    <li>Check printer ink or thermal paper quality</li>
                    <li>Clean the print head if prints are faded or streaked</li>
                    <li>Adjust print density settings if available</li>
                    <li>Try using browser printing if direct printing quality is poor</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            Security Considerations
          </h3>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h4 className="font-medium text-green-800 mb-2">Security Measures</h4>
            <ul className="list-disc pl-5 text-sm text-green-700 space-y-1">
              <li><strong>Network Security:</strong> Printers are only accessible on the local network</li>
              <li><strong>Authentication:</strong> Only authorized staff can access printer configuration</li>
              <li><strong>QR Code Security:</strong> Each QR code contains a unique, randomly generated token</li>
              <li><strong>Session Management:</strong> Order sessions can be deactivated when no longer needed</li>
              <li><strong>Access Control:</strong> QR codes only grant access to the specific table's ordering interface</li>
            </ul>
          </div>
        </section>

        {/* Support Section */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <HelpCircle className="w-5 h-5 text-purple-600 mr-2" />
            Support Resources
          </h3>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h4 className="font-medium text-purple-800 mb-2">Additional Help</h4>
            <ul className="list-disc pl-5 text-sm text-purple-700 space-y-1">
              <li>For technical support, contact our support team at support@example.com</li>
              <li>Visit our knowledge base at help.example.com for detailed guides</li>
              <li>For printer-specific issues, refer to your printer's manufacturer documentation</li>
              <li>Community forums are available for peer assistance at community.example.com</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}