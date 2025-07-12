import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, Employee, TimeEntry } from '../types/database';
import { Clock, Users, Plus, Calendar, BarChart3, User, Lock, CheckCircle, XCircle, LogIn, LogOut } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

interface StaffTimeTrackingProps {
  restaurant: Restaurant;
}

export function StaffTimeTracking({ restaurant }: StaffTimeTrackingProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEmployee, setShowAddEmployee] = useState(false);  
  const [selectedAction, setSelectedAction] = useState<{type: 'in' | 'out', employee: Employee} | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [punchForm, setPunchForm] = useState({
    password: ''
  });

  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    employeeId: '',
    password: '',
    adminPassword: ''
  });

  useEffect(() => {
    fetchEmployees();
    fetchTimeEntries();
  }, [restaurant.id, dateRange, customStartDate, customEndDate]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchTimeEntries = async () => {
    try {
      setLoading(true);
      
      let startDate: string;
      let endDate: string;
      const today = new Date();

      switch (dateRange) {
        case 'today':
          startDate = format(today, 'yyyy-MM-dd');
          endDate = format(today, 'yyyy-MM-dd');
          break;
        case 'week':
          startDate = format(startOfWeek(today), 'yyyy-MM-dd');
          endDate = format(endOfWeek(today), 'yyyy-MM-dd');
          break;
        case 'month':
          startDate = format(startOfMonth(today), 'yyyy-MM-dd');
          endDate = format(endOfMonth(today), 'yyyy-MM-dd');
          break;
        default:
          startDate = customStartDate || format(today, 'yyyy-MM-dd');
          endDate = customEndDate || format(today, 'yyyy-MM-dd');
      }

      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          employee:employees(*)
        `)
        .eq('restaurant_id', restaurant.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('punch_in_time', { ascending: false });

      if (error) throw error;
      setTimeEntries(data || []);
    } catch (error) {
      console.error('Error fetching time entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

  const handlePunchIn = async (employee: Employee) => {
    try {
      // Verify password
      if (employee.password !== punchForm.password) {
        throw new Error('Invalid password');
      }

      // Check if already punched in today
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: existingEntry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('employee_id', employee.employee_id)
        .eq('date', today)
        .is('punch_out_time', null)
        .maybeSingle();

      if (existingEntry) {
        throw new Error('Employee is already punched in');
      }

      const { error } = await supabase
        .from('time_entries')
        .insert({
          restaurant_id: restaurant.id,
          employee_id: employee.employee_id,
          punch_in_time: new Date().toISOString(),
          date: today
        });

      if (error) throw error;

      showNotification(`${employee.name} punched in successfully!`);
      setSelectedAction(null);
      setPunchForm({ password: '' });
      fetchTimeEntries();
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Punch in failed', 'error');
    }
  };

  const handlePunchOut = async (employee: Employee) => {
    try {
      // Verify password
      if (employee.password !== punchForm.password) {
        throw new Error('Invalid password');
      }

      // Find today's punch in entry
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('employee_id', employee.employee_id)
        .eq('date', today)
        .is('punch_out_time', null)
        .maybeSingle();

      if (entryError || !entry) {
        throw new Error('No active punch in found for today');
      }

      const { error } = await supabase
        .from('time_entries')
        .update({
          punch_out_time: new Date().toISOString()
        })
        .eq('id', entry.id);

      if (error) throw error;

      showNotification(`${employee.name} punched out successfully!`);
      setSelectedAction(null);
      setPunchForm({ password: '' });
      fetchTimeEntries();
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Punch out failed', 'error');
    }
  };

  const handleAddEmployee = async () => {
    try {
      if (employeeForm.adminPassword !== 'TGS123') {
        throw new Error('Invalid admin password');
      }

      const { error } = await supabase
        .from('employees')
        .insert({
          restaurant_id: restaurant.id,
          employee_id: employeeForm.employeeId,
          name: employeeForm.name,
          password: employeeForm.password
        });

      if (error) throw error;

      showNotification('Employee added successfully!');
      setShowAddEmployee(false);
      setEmployeeForm({ name: '', employeeId: '', password: '', adminPassword: '' });
      fetchEmployees();
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Failed to add employee', 'error');
    }
  };

  const calculateTotalHours = (entries: TimeEntry[]) => {
    return entries.reduce((total, entry) => total + (entry.total_hours || 0), 0);
  };

  const isEmployeePunchedIn = (employeeId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return timeEntries.some(entry => 
      entry.employee_id === employeeId && 
      entry.date === today && 
      entry.punch_out_time === null
    );
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const getActiveEmployees = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return timeEntries.filter(entry => 
      entry.date === today && entry.punch_out_time === null
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Staff Time Tracking
            </h2>
            <p className="text-gray-600">Manage employee punch in/out and track working hours</p>
          </div>
          
          <button
            onClick={() => setShowAddEmployee(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </button>
        </div>

        {/* Punch In/Out Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowPunchModal('in')}
            className="flex items-center justify-center px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Clock className="w-5 h-5 mr-2" />
            Punch In
          </button>
          
          <button
            onClick={() => setShowPunchModal('out')}
            className="flex items-center justify-center px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Clock className="w-5 h-5 mr-2" />
            Punch Out
          </button>
        </div>
      </div>

      {/* Currently Active */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Currently Active</h3>
        {getActiveEmployees().length === 0 ? (
          <p className="text-gray-600">No employees currently punched in</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getActiveEmployees().map((entry) => (
              <div key={entry.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-green-800">{entry.employee?.name}</h4>
                    <p className="text-sm text-green-600">ID: {entry.employee_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600">Punched in:</p>
                    <p className="font-medium text-green-800">
                      {format(new Date(entry.punch_in_time), 'h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Time Records</h3>
          
          <div className="flex items-center space-x-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'today' | 'week' | 'month')}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            
            {dateRange === 'custom' && (
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-600">Total Employees</p>
                <p className="text-2xl font-bold text-blue-800">{employees.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-green-600">Total Hours</p>
                <p className="text-2xl font-bold text-green-800">
                  {formatHours(calculateTotalHours(timeEntries))}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-purple-600">Active Now</p>
                <p className="text-2xl font-bold text-purple-800">{getActiveEmployees().length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Time Entries Table */}
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading time records...</p>
          </div>
        ) : timeEntries.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No time records found for the selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Punch In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Punch Out
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timeEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {entry.employee?.name}
                        </div>
                        <div className="text-sm text-gray-500">ID: {entry.employee_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(entry.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(entry.punch_in_time), 'h:mm a')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.punch_out_time 
                        ? format(new Date(entry.punch_out_time), 'h:mm a')
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.total_hours ? formatHours(entry.total_hours) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.punch_out_time ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Punch In/Out Modal */}
      {selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Punch {selectedAction.type === 'in' ? 'In' : 'Out'}: {selectedAction.employee.name}
              </h3>
              
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center text-blue-800 mb-2">
                  <User className="w-4 h-4 mr-2" />
                  <span className="font-medium">Employee Details</span>
                </div>
                <p className="text-sm text-blue-700">
                  <strong>Name:</strong> {selectedAction.employee.name}<br />
                  <strong>ID:</strong> {selectedAction.employee.employee_id}
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      value={punchForm.password}
                      onChange={(e) => setPunchForm({ password: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter password"
                      autoFocus
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  onClick={() => {
                    setSelectedAction(null);
                    setPunchForm({ password: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedAction.type === 'in' 
                    ? handlePunchIn(selectedAction.employee) 
                    : handlePunchOut(selectedAction.employee)
                  }
                  className={`flex-1 px-4 py-2 rounded text-white ${
                    selectedAction.type === 'in' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Punch {selectedAction.type === 'in' ? 'In' : 'Out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Employee</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee Name
                  </label>
                  <input
                    type="text"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter employee name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={employeeForm.employeeId}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter unique employee ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={employeeForm.password}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    value={employeeForm.adminPassword}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, adminPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter admin password"
                  />
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  onClick={() => {
                    setShowAddEmployee(false);
                    setEmployeeForm({ name: '', employeeId: '', password: '', adminPassword: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEmployee}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Add Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}