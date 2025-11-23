// HR View Global Variables
let allRequests = [];
let allEmployees = [];
let filteredRequests = [];
let filteredEmployees = [];
let employeesUnsubscribe = null;
let requestsUnsubscribe = null;

// HR View Functions
function initializeHRView() {
    setupRealTimeListeners();
    
    // Add event listeners
    document.getElementById('addEmployeeForm').addEventListener('submit', handleAddEmployee);
    document.getElementById('editEmployeeForm').addEventListener('submit', handleUpdateEmployee);
    
    // Setup filter event listeners
    document.getElementById('requestSearch').addEventListener('input', filterRequests);
    document.getElementById('requestDepartment').addEventListener('change', filterRequests);
    document.getElementById('requestStatus').addEventListener('change', filterRequests);
    document.getElementById('requestType').addEventListener('change', filterRequests);
    document.getElementById('requestDate').addEventListener('change', filterRequests);
    
    document.getElementById('employeeSearch').addEventListener('input', filterEmployees);
    document.getElementById('employeeDepartment').addEventListener('change', filterEmployees);
    document.getElementById('employeeRole').addEventListener('change', filterEmployees);
    document.getElementById('employeeHireDate').addEventListener('change', filterEmployees);
}

function setupRealTimeListeners() {
    // Real-time employees listener
    employeesUnsubscribe = firebaseService.onEmployeesChange((employees) => {
        allEmployees = employees;
        filteredEmployees = [...allEmployees];
        updateEmployeesDisplay();
    });

    // Real-time requests listener
    requestsUnsubscribe = firebaseService.onRequestsChange((requests) => {
        allRequests = requests;
        filteredRequests = [...allRequests];
        updateRequestsDisplay();
    });
}

function cleanupHRView() {
    if (employeesUnsubscribe) {
        employeesUnsubscribe();
    }
    if (requestsUnsubscribe) {
        requestsUnsubscribe();
    }
}

function filterRequests() {
    const searchTerm = document.getElementById('requestSearch').value.toLowerCase();
    const department = document.getElementById('requestDepartment').value;
    const status = document.getElementById('requestStatus').value;
    const type = document.getElementById('requestType').value;
    const date = document.getElementById('requestDate').value;

    filteredRequests = allRequests.filter(request => {
        const matchesSearch = !searchTerm || 
            request.employeeName?.toLowerCase().includes(searchTerm) ||
            request.employeeId?.toLowerCase().includes(searchTerm);
        
        const matchesDepartment = !department || request.department === department;
        const matchesStatus = !status || request.status === status;
        const matchesType = !type || request.type === type;
        
        let matchesDate = true;
        if (date) {
            const searchDate = new Date(date).toISOString().split('T')[0];
            const startDate = request.startDate ? new Date(request.startDate).toISOString().split('T')[0] : '';
            const endDate = request.endDate ? new Date(request.endDate).toISOString().split('T')[0] : '';
            const submissionDate = request.submissionDate ? 
                new Date(request.submissionDate.toDate ? request.submissionDate.toDate() : request.submissionDate).toISOString().split('T')[0] : '';
            
            matchesDate = startDate === searchDate || endDate === searchDate || submissionDate === searchDate;
        }

        return matchesSearch && matchesDepartment && matchesStatus && matchesType && matchesDate;
    });

    updateRequestsDisplay();
}

function updateRequestsDisplay() {
    const tbody = document.getElementById('allRequestsTable');
    const countElement = document.getElementById('requestsCount');
    
    countElement.textContent = filteredRequests.length;

    if (filteredRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No requests found matching your filters</td></tr>';
        return;
    }

    let html = '';
    filteredRequests.forEach(request => {
        const statusClass = getStatusBadgeClass(request.status);
        const typeClass = request.type === 'Leave' ? 'bg-info' : 'bg-warning';
        const typeDetail = request.leaveType || request.adjustmentType || '-';
        
        html += `
            <tr>
                <td>
                    <div class="fw-semibold">${request.employeeName || 'N/A'}</div>
                    <small class="text-muted">${request.employeeId || 'N/A'}</small>
                </td>
                <td>
                    <span class="badge bg-light text-dark">${request.department || 'N/A'}</span>
                </td>
                <td>
                    <span class="badge ${typeClass}">
                        ${request.type}
                    </span>
                    <div class="small text-muted mt-1">
                        ${typeDetail}
                    </div>
                </td>
                <td>
                    <div class="small">
                        ${formatDate(request.startDate)} to ${formatDate(request.endDate)}
                    </div>
                </td>
                <td>
                    <div class="small text-muted">
                        ${request.type === 'Leave' ? 
                            (request.totalDays || '0') + ' days' : 
                            (request.totalHours || '0') + ' hours'
                        }
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

function clearRequestFilters() {
    document.getElementById('requestSearch').value = '';
    document.getElementById('requestDepartment').value = '';
    document.getElementById('requestStatus').value = '';
    document.getElementById('requestType').value = '';
    document.getElementById('requestDate').value = '';
    filterRequests();
}

// Employee Management Functions
function filterEmployees() {
    const searchTerm = document.getElementById('employeeSearch').value.toLowerCase();
    const department = document.getElementById('employeeDepartment').value;
    const role = document.getElementById('employeeRole').value;
    const hireDate = document.getElementById('employeeHireDate').value;

    filteredEmployees = allEmployees.filter(employee => {
        const matchesSearch = !searchTerm || 
            employee.name?.toLowerCase().includes(searchTerm) ||
            employee.email?.toLowerCase().includes(searchTerm) ||
            employee.employeeId?.toLowerCase().includes(searchTerm);
        
        const matchesDepartment = !department || employee.department === department;
        const matchesRole = !role || employee.role === role;
        
        let matchesHireDate = true;
        if (hireDate) {
            const searchDate = new Date(hireDate).toISOString().split('T')[0];
            const employeeHireDate = employee.hireDate ? 
                new Date(employee.hireDate.toDate ? employee.hireDate.toDate() : employee.hireDate).toISOString().split('T')[0] : '';
            matchesHireDate = employeeHireDate === searchDate;
        }

        return matchesSearch && matchesDepartment && matchesRole && matchesHireDate;
    });

    updateEmployeesDisplay();
}

function updateEmployeesDisplay() {
    const tbody = document.getElementById('allEmployeesTable');
    const countElement = document.getElementById('employeesCount');
    
    countElement.textContent = filteredEmployees.length;

    if (filteredEmployees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No employees found matching your filters</td></tr>';
        return;
    }

    let html = '';
    filteredEmployees.forEach(employee => {
        const roleClass = employee.role === 'HR' ? 'bg-info' : employee.role === 'Head' ? 'bg-warning' : 'bg-primary';
        const isCurrentUser = employee.email === currentUser.email;
        
        html += `
            <tr>
                <td>
                    <div class="fw-semibold">${employee.name}</div>
                </td>
                <td>
                    <code>${employee.employeeId}</code>
                </td>
                <td>
                    <span class="badge bg-light text-dark">${employee.department}</span>
                </td>
                <td>${employee.position || '-'}</td>
                <td>
                    <span class="badge ${roleClass}">${employee.role}</span>
                </td>
                <td>
                    <small>${employee.email}</small>
                </td>
                <td>
                    <small>${formatDate(employee.hireDate)}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editEmployee('${employee.id}')" title="Edit Employee">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteEmployee('${employee.id}', '${employee.name}')" 
                                ${isCurrentUser ? 'disabled' : ''} title="Delete Employee">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function clearEmployeeFilters() {
    document.getElementById('employeeSearch').value = '';
    document.getElementById('employeeDepartment').value = '';
    document.getElementById('employeeRole').value = '';
    document.getElementById('employeeHireDate').value = '';
    filterEmployees();
}

async function handleAddEmployee(e) {
    e.preventDefault();
    
    const name = document.getElementById('newEmployeeName').value;
    const email = document.getElementById('newEmployeeEmail').value;
    const employeeId = document.getElementById('newEmployeeId').value;
    const department = document.getElementById('newEmployeeDepartment').value;
    const position = document.getElementById('newEmployeePosition').value;
    const role = document.getElementById('newEmployeeRole').value;
    const hireDate = document.getElementById('newEmployeeHireDate').value;

    if (!name || !email || !employeeId || !department || !role) {
        showMessage('Error', 'Please fill in all required fields.');
        return;
    }

    // Check if employee ID already exists
    const existingEmployee = allEmployees.find(emp => emp.employeeId === employeeId);
    if (existingEmployee) {
        showMessage('Error', `Employee ID ${employeeId} already exists.`);
        return;
    }

    // Check if email already exists
    const existingEmail = allEmployees.find(emp => emp.email === email);
    if (existingEmail) {
        showMessage('Error', `Email ${email} is already registered.`);
        return;
    }

    const employeeData = {
        name,
        email,
        employeeId,
        department,
        position,
        role,
        hireDate: hireDate ? new Date(hireDate) : new Date()
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';
        submitBtn.disabled = true;
        
        await firebaseService.createEmployee(employeeData);
        showMessage('Success', `Employee ${name} added successfully!\n\nEmail: ${email}\nDefault Password: spa2024\n\nPlease inform the employee to change their password after first login.`);
        clearEmployeeForm();
        showEmployeesTab();
    } catch (error) {
        console.error('Error adding employee:', error);
        if (error.code === 'auth/email-already-in-use') {
            showMessage('Error', 'This email is already registered in the system.');
        } else {
            showMessage('Error', 'Failed to add employee: ' + error.message);
        }
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function clearEmployeeForm() {
    document.getElementById('addEmployeeForm').reset();
}

function editEmployee(employeeId) {
    const employee = allEmployees.find(emp => emp.id === employeeId);
    if (!employee) return;

    document.getElementById('editEmployeeId').value = employee.id;
    document.getElementById('editEmployeeName').value = employee.name;
    document.getElementById('editEmployeeEmail').value = employee.email;
    document.getElementById('editEmployeeEmployeeId').value = employee.employeeId;
    document.getElementById('editEmployeeDepartment').value = employee.department;
    document.getElementById('editEmployeePosition').value = employee.position || '';
    document.getElementById('editEmployeeRole').value = employee.role;
    
    if (employee.hireDate) {
        const hireDate = employee.hireDate.toDate ? employee.hireDate.toDate() : employee.hireDate;
        document.getElementById('editEmployeeHireDate').value = new Date(hireDate).toISOString().split('T')[0];
    } else {
        document.getElementById('editEmployeeHireDate').value = '';
    }

    const modal = new bootstrap.Modal(document.getElementById('editEmployeeModal'));
    modal.show();
}

async function handleUpdateEmployee(e) {
    e.preventDefault();
    
    const employeeId = document.getElementById('editEmployeeId').value;
    const name = document.getElementById('editEmployeeName').value;
    const email = document.getElementById('editEmployeeEmail').value;
    const employeeIdValue = document.getElementById('editEmployeeEmployeeId').value;
    const department = document.getElementById('editEmployeeDepartment').value;
    const position = document.getElementById('editEmployeePosition').value;
    const role = document.getElementById('editEmployeeRole').value;
    const hireDate = document.getElementById('editEmployeeHireDate').value;

    if (!name || !email || !employeeIdValue || !department || !role) {
        showMessage('Error', 'Please fill in all required fields.');
        return;
    }

    // Check if employee ID already exists (excluding current employee)
    const existingEmployee = allEmployees.find(emp => 
        emp.employeeId === employeeIdValue && emp.id !== employeeId
    );
    if (existingEmployee) {
        showMessage('Error', `Employee ID ${employeeIdValue} already exists.`);
        return;
    }

    const employeeData = {
        name,
        email,
        employeeId: employeeIdValue,
        department,
        position,
        role,
        hireDate: hireDate ? new Date(hireDate) : allEmployees.find(emp => emp.id === employeeId).hireDate
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
        submitBtn.disabled = true;
        
        await firebaseService.updateEmployee(employeeId, employeeData);
        showMessage('Success', 'Employee updated successfully!');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('editEmployeeModal'));
        modal.hide();
    } catch (error) {
        showMessage('Error', 'Failed to update employee: ' + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function deleteEmployee(employeeId, employeeName) {
    if (!confirm(`Are you sure you want to delete ${employeeName}? This action cannot be undone.`)) {
        return;
    }

    try {
        await firebaseService.deleteEmployee(employeeId);
        showMessage('Success', `Employee ${employeeName} deleted successfully!`);
    } catch (error) {
        showMessage('Error', 'Failed to delete employee: ' + error.message);
    }
}

// Tab Navigation Functions
function showAddEmployeeTab() {
    const addEmployeeTab = new bootstrap.Tab(document.getElementById('addEmployee-tab'));
    addEmployeeTab.show();
}

function showEmployeesTab() {
    const employeesTab = new bootstrap.Tab(document.getElementById('employees-tab'));
    employeesTab.show();
}

// Utility Functions
function getStatusBadgeClass(status) {
    switch (status) {
        case 'Approved': return 'bg-success';
        case 'Rejected': return 'bg-danger';
        case 'Pending': return 'bg-warning';
        default: return 'bg-secondary';
    }
}

function formatDate(dateValue) {
    if (!dateValue) return 'N/A';
    
    try {
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

function showMessage(title, message) {
    // You can implement a toast or modal notification here
    alert(`${title}: ${message}`);
}

// Make functions globally available
window.filterRequests = filterRequests;
window.clearRequestFilters = clearRequestFilters;
window.filterEmployees = filterEmployees;
window.clearEmployeeFilters = clearEmployeeFilters;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.showAddEmployeeTab = showAddEmployeeTab;
window.showEmployeesTab = showEmployeesTab;
window.cleanupHRView = cleanupHRView;