// ==========================================
// CONFIGURATION
// ==========================================
const API_URL = 'http://localhost:3000/api';
const NOTIF_URL = 'http://localhost:3001/api';

let authToken = null;
let currentUser = null;
let allStudents = [];
let deleteTargetId = null;
let isEditMode = false;

// ==========================================
// DOM REFS
// ==========================================
const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userDisplay = document.getElementById('userDisplay');
const studentName = document.getElementById('studentName');
const studentsBody = document.getElementById('studentsBody');
const notificationsList = document.getElementById('notificationsList');
const searchInput = document.getElementById('searchInput');
const toast = document.getElementById('toast');

const enrollModal = document.getElementById('enrollModal');
const enrollForm = document.getElementById('enrollForm');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');
const editStudentId = document.getElementById('editStudentId');
const statusGroup = document.getElementById('statusGroup');
const formError = document.getElementById('formError');

const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const deleteStudentInfo = document.getElementById('deleteStudentInfo');

const totalStudentsEl = document.getElementById('totalStudents');
const pendingStudentsEl = document.getElementById('pendingStudents');
const enrolledStudentsEl = document.getElementById('enrolledStudents');
const totalNotificationsEl = document.getElementById('totalNotifications');

// ==========================================
// TOGGLE PASSWORD
// ==========================================
document.getElementById('togglePassword').addEventListener('click', function () {
    const input = document.getElementById('password');
    if (input.type === 'password') {
        input.type = 'text';
        this.textContent = 'Hide';
    } else {
        input.type = 'password';
        this.textContent = 'Show';
    }
});

// ==========================================
// TOAST
// ==========================================
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ==========================================
// AUTH
// ==========================================
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    loginPage.style.display = 'flex';
    dashboardPage.style.display = 'none';
    loginError.textContent = '';
}

function showDashboard() {
    loginPage.style.display = 'none';
    dashboardPage.style.display = 'block';
    userDisplay.textContent = currentUser.username;
    studentName.textContent = currentUser.username;
    loadStudents();
    loadNotifications();
    updateStats();
}

// ==========================================
// LOGIN
// ==========================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            loginError.textContent = data.error || 'Login failed';
            showToast(data.error || 'Login failed', 'error');
            return;
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));

        showToast('Welcome back, ' + currentUser.username + '!');
        showDashboard();

    } catch (error) {
        loginError.textContent = 'Network error. Is the server running?';
        showToast('Network error. Is the server running?', 'error');
        console.error('Login error:', error);
    }
});

// ==========================================
// LOGOUT
// ==========================================
logoutBtn.addEventListener('click', () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showLogin();
    showToast('Logged out successfully', 'info');
});

// ==========================================
// API HELPER
// ==========================================
async function apiRequest(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = 'Bearer ' + authToken;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// ==========================================
// LOAD STUDENTS
// ==========================================
async function loadStudents() {
    try {
        const students = await apiRequest(API_URL + '/students');
        allStudents = students;
        renderStudents(students);
        updateStats();
    } catch (error) {
        studentsBody.innerHTML = '<tr><td colspan="7" class="loading-text">Error: ' + error.message + '</td></tr>';
        showToast('Failed to load students', 'error');
    }
}

// ==========================================
// RENDER STUDENTS
// ==========================================
function renderStudents(students) {
    if (students.length === 0) {
        studentsBody.innerHTML = '<tr><td colspan="7" class="loading-text">No students found</td></tr>';
        return;
    }

    let html = '';
    for (let s of students) {
        html += `
            <tr>
                <td>${s.student_id}</td>
                <td><strong>${s.student_number}</strong></td>
                <td>${s.firstname} ${s.lastname}</td>
                <td>${s.course}</td>
                <td>${s.year}</td>
                <td><span class="status-badge status-${s.status.toLowerCase()}">${s.status}</span></td>
                <td>
                    <button class="btn btn-success btn-small" onclick="editStudent(${s.student_id})">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="confirmDelete(${s.student_id})">Delete</button>
                </td>
            </tr>
        `;
    }
    studentsBody.innerHTML = html;
}

// ==========================================
// SEARCH
// ==========================================
function searchStudents() {
    const query = searchInput.value.toLowerCase();
    if (!query) {
        renderStudents(allStudents);
        return;
    }
    const filtered = allStudents.filter(function (s) {
        return s.firstname.toLowerCase().includes(query) ||
            s.lastname.toLowerCase().includes(query) ||
            s.student_number.toLowerCase().includes(query) ||
            s.course.toLowerCase().includes(query);
    });
    renderStudents(filtered);
}

// ==========================================
// UPDATE STATS
// ==========================================
function updateStats() {
    const total = allStudents.length;
    let pending = 0;
    let enrolled = 0;

    for (let s of allStudents) {
        if (s.status === 'Pending') pending++;
        if (s.status === 'Enrolled') enrolled++;
    }

    totalStudentsEl.textContent = total;
    pendingStudentsEl.textContent = pending;
    enrolledStudentsEl.textContent = enrolled;
}

// ==========================================
// LOAD NOTIFICATIONS
// ==========================================
async function loadNotifications() {
    try {
        const response = await fetch(NOTIF_URL + '/api/notifications');
        if (!response.ok) throw new Error('Failed to fetch notifications');

        const notifications = await response.json();

        if (notifications.length === 0) {
            notificationsList.innerHTML = '<p class="loading-text">No notifications</p>';
            totalNotificationsEl.textContent = '0';
            return;
        }

        totalNotificationsEl.textContent = notifications.length;

        let html = '';
        const maxShow = Math.min(notifications.length, 20);
        for (let i = 0; i < maxShow; i++) {
            const n = notifications[i];
            const date = new Date(n.createdAt || n.created_at);
            html += `
                <div class="notification-item">
                    <strong>${n.message || 'New student enrolled'}</strong>
                    <div class="time">${date.toLocaleString()}</div>
                </div>
            `;
        }
        notificationsList.innerHTML = html;

    } catch (error) {
        notificationsList.innerHTML = '<p class="loading-text">Notifications unavailable</p>';
        console.error('Notification error:', error);
    }
}

// ==========================================
// OPEN ENROLL MODAL
// ==========================================
function openEnrollModal() {
    isEditMode = false;
    modalTitle.textContent = 'Enroll New Student';
    submitBtn.textContent = 'Enroll Student';
    enrollForm.reset();
    document.getElementById('editStudentId').value = '';
    statusGroup.style.display = 'none';
    formError.textContent = '';
    document.getElementById('studentNumber').disabled = false;
    enrollModal.classList.add('show');
}

// ==========================================
// EDIT STUDENT
// ==========================================
async function editStudent(id) {
    try {
        const student = await apiRequest(API_URL + '/students/' + id);

        isEditMode = true;
        modalTitle.textContent = 'Edit Student';
        submitBtn.textContent = 'Update Student';

        document.getElementById('editStudentId').value = student.student_id;
        document.getElementById('studentNumber').value = student.student_number;
        document.getElementById('studentNumber').disabled = true;
        document.getElementById('firstName').value = student.firstname;
        document.getElementById('lastName').value = student.lastname;
        document.getElementById('course').value = student.course;
        document.getElementById('year').value = student.year;
        document.getElementById('status').value = student.status;

        statusGroup.style.display = 'block';
        formError.textContent = '';

        enrollModal.classList.add('show');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// CLOSE MODAL
// ==========================================
function closeModal() {
    enrollModal.classList.remove('show');
    document.getElementById('studentNumber').disabled = false;
    formError.textContent = '';
}

// ==========================================
// SUBMIT ENROLL / UPDATE
// ==========================================
enrollForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    formError.textContent = '';

    const studentId = document.getElementById('editStudentId').value;
    const student_number = document.getElementById('studentNumber').value.trim();
    const firstname = document.getElementById('firstName').value.trim();
    const lastname = document.getElementById('lastName').value.trim();
    const course = document.getElementById('course').value;
    const year = document.getElementById('year').value;
    const status = document.getElementById('status').value;

    if (!student_number || !firstname || !lastname || !course || !year) {
        formError.textContent = 'All fields are required';
        return;
    }

    try {
        let result;

        if (isEditMode) {
            result = await apiRequest(API_URL + '/students/' + studentId, {
                method: 'PUT',
                body: JSON.stringify({ firstname, lastname, course, year, status })
            });
            showToast('Student updated successfully!');
        } else {
            result = await apiRequest(API_URL + '/students', {
                method: 'POST',
                body: JSON.stringify({ student_number, firstname, lastname, course, year })
            });
            showToast('Student enrolled successfully!');
        }

        closeModal();
        loadStudents();
        loadNotifications();

    } catch (error) {
        formError.textContent = error.message;
        showToast(error.message, 'error');
    }
});

// ==========================================
// CONFIRM DELETE
// ==========================================
async function confirmDelete(id) {
    try {
        const student = await apiRequest(API_URL + '/students/' + id);
        deleteTargetId = id;
        deleteStudentInfo.textContent = student.firstname + ' ' + student.lastname + ' (' + student.student_number + ')';
        deleteModal.classList.add('show');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function closeDeleteModal() {
    deleteModal.classList.remove('show');
    deleteTargetId = null;
}

// ==========================================
// DELETE CONFIRMATION
// ==========================================
confirmDeleteBtn.addEventListener('click', async function () {
    if (!deleteTargetId) return;

    try {
        await apiRequest(API_URL + '/students/' + deleteTargetId, {
            method: 'DELETE'
        });

        closeDeleteModal();
        showToast('Student deleted successfully!');
        loadStudents();

    } catch (error) {
        showToast(error.message, 'error');
        closeDeleteModal();
    }
});

// ==========================================
// AUTO REFRESH (every 30 seconds)
// ==========================================
setInterval(function () {
    if (authToken) {
        loadStudents();
        loadNotifications();
    }
}, 30000);

// ==========================================
// INIT
// ==========================================
checkAuth();
console.log('Enrollment System Frontend loaded');
console.log('Default login: admin / admin123');