import { firebaseService } from './firebase.js';

let currentUser = null;
let allRequestsData = [];
let employeesData = [];

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Login form handler
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Employee management event listeners
    document.getElementById('addEmployeeBtn').addEventListener('click', showAddEmployeeForm);
    document.getElementById('employeeForm').addEventListener('submit', handleEmployeeSubmit);
    
    // Listen for auth state changes
    firebaseService.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const employee = await firebaseService.getEmployeeByEmail(user.email);
                if (employee) {
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        ...employee
                    };
                    showAppPage();
                } else {
                    await firebaseService.logoutUser();
                    showMessage('Error', 'Employee record not found. Please contact HR.');
                }
            } catch (error) {
                console.error('Auth state error:', error);
            }
        } else {
            currentUser = null;
            showLoginPage();
        }
    });
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Signing in...';
    submitBtn.disabled = true;
    
    try {
        await firebaseService.loginUser(email, password);
        // Auth state listener will handle the rest and reset the button
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again.';
        
        if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid email or password.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        }
        
        showMessage('Login Failed', errorMessage);
        
        // Reset button state on error
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function showLoginPage() {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('loginForm').reset();
}

function showAppPage() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appPage').style.display = 'block';
    document.getElementById('userWelcome').textContent = `Welcome, ${currentUser.name}`;
    
    // Update welcome message based on role
    const welcomeTitle = document.getElementById('welcomeTitle');
    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    
    if (currentUser.role === 'Employee') {
        welcomeTitle.textContent = `Welcome to Your Spa Portal, ${currentUser.name}`;
        welcomeSubtitle.textContent = 'Manage your schedule, request time off, and view your requests';
    } else if (currentUser.role === 'Head') {
        welcomeTitle.textContent = `Team Management Portal`;
        welcomeSubtitle.textContent = `Review and manage requests for the ${currentUser.department} team`;
    } else if (currentUser.role === 'HR') {
        welcomeTitle.textContent = `Spa Management Dashboard`;
        welcomeSubtitle.textContent = 'Manage all staff members and review system-wide requests';
    }
    
    // Show appropriate view based on role
    document.getElementById('employeeView').style.display = currentUser.role === 'Employee' ? 'block' : 'none';
    document.getElementById('headView').style.display = currentUser.role === 'Head' ? 'block' : 'none';
    document.getElementById('hrView').style.display = currentUser.role === 'HR' ? 'block' : 'none';
    
    // Initialize the appropriate view
    if (currentUser.role === 'Employee') {
        initializeEmployeeView();
    } else if (currentUser.role === 'Head') {
        initializeHeadView();
    } else if (currentUser.role === 'HR') {
        initializeHRView();
    }
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await firebaseService.logoutUser();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

function showHelp() {
    showMessage('Need Help?', 'For technical support or login issues, please contact HR Department.');
}

function showMessage(title, message) {
    document.getElementById('messageModalTitle').textContent = title;
    document.getElementById('messageModalBody').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('messageModal'));
    modal.show();
}

// Employee View Functions
function initializeEmployeeView() {
    loadMyRequests();
}

async function submitLeaveRequest() {
    const leaveType = document.getElementById('leaveType').value;
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    const reason = document.getElementById('leaveReason').value;
    
    if (!leaveType || !startDate || !endDate || !reason) {
        showMessage('Error', 'Please fill in all required fields.');
        return;
    }
    
    const totalDays = calculateDaysDifference(startDate, endDate);
    if (totalDays <= 0) {
        showMessage('Invalid Dates', 'End date must be after start date.');
        return;
    }
    
    const requestData = {
        employeeName: currentUser.name,
        employeeId: currentUser.employeeId,
        department: currentUser.department,
        position: currentUser.position,
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate,
        totalDays: totalDays,
        reason: reason,
        type: 'Leave',
        status: 'Pending',
        submissionDate: new Date().toISOString()
    };
    
    try {
        await firebaseService.submitLeaveRequest(requestData);
        showMessage('Success', 'Leave request submitted successfully!');
        clearLeaveForm();
        loadMyRequests();
    } catch (error) {
        showMessage('Error', 'Failed to submit request: ' + error.message);
    }
}

async function submitOvertimeRequest() {
    const adjustmentType = document.getElementById('overtimeType').value;
    const startDateTime = document.getElementById('overtimeStartDate').value;
    const endDateTime = document.getElementById('overtimeEndDate').value;
    const reason = document.getElementById('overtimeReason').value;
    
    if (!adjustmentType || !startDateTime || !endDateTime || !reason) {
        showMessage('Error', 'Please fill in all required fields.');
        return;
    }
    
    const totalHours = calculateHoursDifference(startDateTime, endDateTime);
    if (totalHours <= 0) {
        showMessage('Invalid Times', 'End time must be after start time.');
        return;
    }
    
    const requestData = {
        employeeName: currentUser.name,
        employeeId: currentUser.employeeId,
        department: currentUser.department,
        position: currentUser.position,
        adjustmentType: adjustmentType,
        startDate: startDateTime,
        endDate: endDateTime,
        totalHours: totalHours,
        reason: reason,
        type: 'Overtime',
        status: 'Pending',
        submissionDate: new Date().toISOString()
    };
    
    try {
        await firebaseService.submitOvertimeRequest(requestData);
        showMessage('Success', 'Overtime request submitted successfully!');
        clearOvertimeForm();
        loadMyRequests();
    } catch (error) {
        showMessage('Error', 'Failed to submit request: ' + error.message);
    }
}

function clearLeaveForm() {
    document.getElementById('leaveType').value = '';
    document.getElementById('leaveStartDate').value = '';
    document.getElementById('leaveEndDate').value = '';
    document.getElementById('leaveReason').value = '';
}

function clearOvertimeForm() {
    document.getElementById('overtimeType').value = 'Overtime';
    document.getElementById('overtimeStartDate').value = '';
    document.getElementById('overtimeEndDate').value = '';
    document.getElementById('overtimeReason').value = '';
}

async function loadMyRequests() {
    const container = document.getElementById('myRequestsContainer');
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Loading your requests...</p>
        </div>
    `;
    
    try {
        const [leaveRequests, overtimeRequests] = await Promise.all([
            firebaseService.getLeaveRequestsByEmployee(currentUser.employeeId),
            firebaseService.getOvertimeRequestsByEmployee(currentUser.employeeId)
        ]);
        
        const allRequests = [...leaveRequests, ...overtimeRequests].sort((a, b) => {
            const dateA = a.submissionDate?.toDate ? a.submissionDate.toDate() : new Date(a.submissionDate);
            const dateB = b.submissionDate?.toDate ? b.submissionDate.toDate() : new Date(b.submissionDate);
            return dateB - dateA;
        });
        
        if (allRequests.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Requests Found</h5>
                    <p class="text-muted">You haven't submitted any requests yet.</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover mobile-friendly">
                    <thead class="table-light">
                        <tr>
                            <th>Type</th>
                            <th>Details</th>
                            <th>Dates</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th>Submitted</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        allRequests.forEach(request => {
            const statusClass = getStatusBadgeClass(request.status);
            html += `
                <tr>
                    <td>
                        <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">
                            ${request.type}
                        </span>
                        <div class="small text-muted mt-1">
                            ${request.leaveType || request.adjustmentType}
                        </div>
                    </td>
                    <td>
                        <div class="small">${request.reason || 'No reason provided'}</div>
                    </td>
                    <td>
                        <div class="small">
                            ${formatDate(request.startDate)} to ${formatDate(request.endDate)}
                        </div>
                    </td>
                    <td>
                        <strong>
                            ${request.type === 'Leave' ? 
                                request.totalDays + ' days' : 
                                request.totalHours + ' hours'
                            }
                        </strong>
                    </td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${request.status}
                        </span>
                        ${request.approvedBy ? `
                            <div class="small text-muted mt-1">
                                by ${request.approvedBy}
                            </div>
                        ` : ''}
                    </td>
                    <td>
                        <small>${formatDate(request.submissionDate)}</small>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error Loading Requests</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadMyRequests()">Try Again</button>
            </div>
        `;
    }
}

// Head View Functions
function initializeHeadView() {
    document.getElementById('headDepartment').textContent = `${currentUser.department}`;
    loadDepartmentRequests();
}

async function loadDepartmentRequests() {
    const container = document.getElementById('requestsContainer');
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Loading requests for your department...</p>
        </div>
    `;
    
    try {
        const requests = await firebaseService.getPendingRequestsByDepartment(currentUser.department);
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Pending Requests</h5>
                    <p class="text-muted">No pending requests found in your department.</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover table-bordered mobile-friendly">
                    <thead class="table-dark">
                        <tr>
                            <th>Employee</th>
                            <th>Position</th>
                            <th>Type</th>
                            <th>Dates</th>
                            <th>Duration</th>
                            <th>Reason</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        requests.forEach(request => {
            html += `
                <tr>
                    <td>
                        <strong>${request.employeeName}</strong><br>
                        <small class="text-muted">${request.employeeId}</small>
                    </td>
                    <td>${request.position || 'N/A'}</td>
                    <td>
                        <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">
                            ${request.type}
                        </span>
                        <br>
                        <small>${request.leaveType || request.adjustmentType}</small>
                    </td>
                    <td>
                        ${formatDate(request.startDate)}<br>
                        <small class="text-muted">to ${formatDate(request.endDate)}</small>
                    </td>
                    <td>
                        <strong>
                            ${request.type === 'Leave' ? 
                                request.totalDays + ' days' : 
                                request.totalHours + ' hours'
                            }
                        </strong>
                    </td>
                    <td>${request.reason || 'No reason provided'}</td>
                    <td>
                        <div class="btn-group-vertical">
                            <button class="btn btn-success btn-sm mb-1" onclick="approveRequest('${request.id}', '${request.type}')">
                                <i class="fas fa-check me-1"></i>Approve
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="rejectRequest('${request.id}', '${request.type}')">
                                <i class="fas fa-times me-1"></i>Reject
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="mt-3">
                <p class="text-muted"><small>Found ${requests.length} pending request(s)</small></p>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error Loading Requests</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadDepartmentRequests()">Try Again</button>
            </div>
        `;
    }
}

async function approveRequest(requestId, type) {
    if (confirm('Are you sure you want to APPROVE this request?')) {
        try {
            await firebaseService.updateRequestStatus(requestId, 'Approved', type, currentUser.name);
            showMessage('Success', 'Request approved successfully!');
            loadDepartmentRequests();
        } catch (error) {
            showMessage('Error', 'Failed to approve request: ' + error.message);
        }
    }
}

async function rejectRequest(requestId, type) {
    if (confirm('Are you sure you want to REJECT this request?')) {
        try {
            await firebaseService.updateRequestStatus(requestId, 'Rejected', type, currentUser.name);
            showMessage('Notice', 'Request rejected.');
            loadDepartmentRequests();
        } catch (error) {
            showMessage('Error', 'Failed to reject request: ' + error.message);
        }
    }
}

// HR View Functions
function initializeHRView() {
    loadAllRequests();
    loadEmployeeList();
    setupFilters();
}

function setupFilters() {
    document.getElementById('searchName').addEventListener('input', applyFilters);
    document.getElementById('filterDepartment').addEventListener('change', applyFilters);
    document.getElementById('filterRequestType').addEventListener('change', applyFilters);
    document.getElementById('filterStatus').addEventListener('change', applyFilters);
    document.getElementById('startDateFilter').addEventListener('change', applyFilters);
    document.getElementById('endDateFilter').addEventListener('change', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
}

async function loadAllRequests() {
    const tbody = document.getElementById('allRequestsTable');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading all requests...</p>
            </td>
        </tr>
    `;
    
    try {
        allRequestsData = await firebaseService.getAllRequests();
        displayFilteredRequests(allRequestsData);
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    Error loading requests: ${error.message}
                </td>
            </tr>
        `;
    }
}

function applyFilters() {
    const searchName = document.getElementById('searchName').value.toLowerCase();
    const department = document.getElementById('filterDepartment').value;
    const requestType = document.getElementById('filterRequestType').value;
    const status = document.getElementById('filterStatus').value;
    const startDate = document.getElementById('startDateFilter').value;
    const endDate = document.getElementById('endDateFilter').value;

    const filteredRequests = allRequestsData.filter(request => {
        // Name filter
        if (searchName && !request.employeeName.toLowerCase().includes(searchName) && 
            !request.employeeId.toLowerCase().includes(searchName)) {
            return false;
        }
        
        // Department filter
        if (department && request.department !== department) {
            return false;
        }
        
        // Request Type filter
        if (requestType && request.type !== requestType) {
            return false;
        }
        
        // Status filter
        if (status && request.status !== status) {
            return false;
        }
        
        // Date range filter
        if (startDate) {
            const requestStartDate = new Date(request.startDate);
            const filterStartDate = new Date(startDate);
            if (requestStartDate < filterStartDate) return false;
        }
        
        if (endDate) {
            const requestEndDate = new Date(request.endDate);
            const filterEndDate = new Date(endDate);
            if (requestEndDate > filterEndDate) return false;
        }
        
        return true;
    });
    
    displayFilteredRequests(filteredRequests);
}

function displayFilteredRequests(requests) {
    const tbody = document.getElementById('allRequestsTable');
    
    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No requests match your filters</td></tr>';
        return;
    }
    
    let html = '';
    requests.forEach(request => {
        const statusClass = getStatusBadgeClass(request.status);
        html += `
            <tr>
                <td>
                    <div class="fw-semibold">${request.employeeName}</div>
                    <small class="text-muted">${request.employeeId}</small>
                </td>
                <td>
                    <span class="badge bg-light text-dark">${request.department}</span>
                </td>
                <td>${request.position || 'N/A'}</td>
                <td>
                    <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">
                        ${request.type}
                    </span>
                    <div class="small text-muted mt-1">
                        ${request.leaveType || request.adjustmentType}
                    </div>
                </td>
                <td>
                    <div class="small">
                        ${formatDate(request.startDate)} to ${formatDate(request.endDate)}
                    </div>
                    <div class="small text-muted">
                        ${request.type === 'Leave' ? 
                            request.totalDays + ' days' : 
                            request.totalHours + ' hours'
                        }
                    </div>
                    <div class="small text-truncate" style="max-width: 200px;" title="${request.reason || 'No reason'}">
                        ${request.reason || '-'}
                    </div>
                </td>
                <td>
                    <span class="badge ${statusClass}">
                        ${request.status}
                    </span>
                </td>
                <td>
                    <small>${formatDate(request.submissionDate)}</small>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function clearFilters() {
    document.getElementById('searchName').value = '';
    document.getElementById('filterDepartment').value = '';
    document.getElementById('filterRequestType').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('startDateFilter').value = '';
    document.getElementById('endDateFilter').value = '';
    displayFilteredRequests(allRequestsData);
}

// Employee Management Functions
async function loadEmployeeList() {
    const container = document.getElementById('employeesContainer');
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Loading employees...</p>
        </div>
    `;
    
    try {
        employeesData = await firebaseService.getAllEmployees();
        displayEmployees(employeesData);
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error Loading Employees</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadEmployeeList()">Try Again</button>
            </div>
        `;
    }
}

function displayEmployees(employees) {
    const container = document.getElementById('employeesContainer');
    
    if (employees.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-users fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No Employees Found</h5>
                <p class="text-muted">No employees have been added to the system yet.</p>
                <button class="btn btn-primary" onclick="showAddEmployeeForm()">
                    <i class="fas fa-plus me-1"></i>Add First Employee
                </button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-hover mobile-friendly">
                <thead class="table-dark">
                    <tr>
                        <th>Employee ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Position</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    employees.forEach(employee => {
        html += `
            <tr>
                <td><strong>${employee.employeeId}</strong></td>
                <td>${employee.name}</td>
                <td>${employee.email}</td>
                <td>
                    <span class="badge bg-light text-dark">${employee.department}</span>
                </td>
                <td>${employee.position || 'N/A'}</td>
                <td>
                    <span class="badge ${getRoleBadgeClass(employee.role)}">
                        ${employee.role}
                    </span>
                </td>
                <td>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteEmployee('${employee.id}', '${employee.name}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div class="mt-3">
            <p class="text-muted"><small>Total employees: ${employees.length}</small></p>
        </div>
    `;
    
    container.innerHTML = html;
}

function getRoleBadgeClass(role) {
    switch(role) {
        case 'HR': return 'bg-danger';
        case 'Head': return 'bg-warning';
        case 'Employee': return 'bg-info';
        default: return 'bg-secondary';
    }
}

function showAddEmployeeForm() {
    document.getElementById('employeeFormTitle').textContent = 'Add New Staff Member';
    document.getElementById('employeeForm').reset();
    document.getElementById('employeePasswordGroup').style.display = 'block';
    const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
    modal.show();
}

async function handleEmployeeSubmit(e) {
    e.preventDefault();
    
    const employeeData = {
        employeeId: document.getElementById('employeeId').value,
        name: document.getElementById('employeeName').value,
        email: document.getElementById('employeeEmail').value,
        department: document.getElementById('employeeDepartment').value,
        role: document.getElementById('employeeRole').value,
        position: document.getElementById('employeePosition').value
    };
    
    const password = document.getElementById('employeePassword').value;
    
    // Validation
    if (!employeeData.employeeId || !employeeData.name || !employeeData.email || 
        !employeeData.department || !employeeData.role || !employeeData.position) {
        showMessage('Error', 'Please fill in all required fields.');
        return;
    }
    
    if (!password) {
        showMessage('Error', 'Password is required for new employees.');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
    submitBtn.disabled = true;
    
    try {
        console.log('Creating new employee:', employeeData);
        await firebaseService.createEmployee(employeeData, password);
        showMessage('Success', 'Staff member created successfully!');
        
        // Close modal and refresh list
        const modal = bootstrap.Modal.getInstance(document.getElementById('employeeModal'));
        if (modal) {
            modal.hide();
        }
        
        // Reset form and reload data
        document.getElementById('employeeForm').reset();
        await loadEmployeeList();
        
    } catch (error) {
        console.error('Error creating employee:', error);
        showMessage('Error', `Failed to create staff member: ${error.message}`);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function deleteEmployee(employeeId, employeeName) {
    if (confirm(`Are you sure you want to delete staff member "${employeeName}"? This will permanently remove their account and all associated data. This action cannot be undone.`)) {
        try {
            const result = await firebaseService.deleteEmployee(employeeId);
            showMessage('Success', result.message || 'Staff member deleted successfully!');
            loadEmployeeList();
        } catch (error) {
            showMessage('Error', 'Failed to delete staff member: ' + error.message);
        }
    }
}

// Utility Functions
function calculateDaysDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function calculateHoursDifference(startDateTime, endDateTime) {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const diffTime = Math.abs(end - start);
    return parseFloat((diffTime / (1000 * 60 * 60)).toFixed(2));
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'Approved': return 'status-approved';
        case 'Rejected': return 'status-rejected';
        case 'Pending': return 'status-pending';
        default: return 'bg-secondary';
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        if (dateString.toDate) {
            const date = dateString.toDate();
            return date.toLocaleDateString('en-US');
        } else {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US');
        }
    } catch (e) {
        return String(dateString);
    }
}

// Make functions globally available for HTML onclick handlers
window.submitLeaveRequest = submitLeaveRequest;
window.submitOvertimeRequest = submitOvertimeRequest;
window.clearLeaveForm = clearLeaveForm;
window.clearOvertimeForm = clearOvertimeForm;
window.loadMyRequests = loadMyRequests;
window.loadDepartmentRequests = loadDepartmentRequests;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.loadAllRequests = loadAllRequests;
window.loadEmployeeList = loadEmployeeList;
window.showAddEmployeeForm = showAddEmployeeForm;
window.deleteEmployee = deleteEmployee;
window.handleEmployeeSubmit = handleEmployeeSubmit;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.logout = logout;
window.showHelp = showHelp;