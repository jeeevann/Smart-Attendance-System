// API helper functions for database operations
// On localhost (XAMPP), the project may live under /Mini-Project/FaceRecognition.
// On Render, the app is deployed at the site root. Use a dynamic base to support both.
const API_BASE = window.location.hostname === 'localhost' ? '/Mini-Project/FaceRecognition' : '';

async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE}/${endpoint}`.replace(/^\/\//, '/'), options);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Students API
const studentsAPI = {
    getAll: () => apiRequest('students.php'),
    addMultipart: async ({ name, className, year, division, roll, department, email, phone, files }) => {
        const form = new FormData();
        form.append('name', name);
        form.append('class', className);
        form.append('year', year);
        form.append('division', division);
        if(roll) form.append('roll_no', roll);
        if(department) form.append('department', department);
        if(email) form.append('email', email);
        if(phone) form.append('phone', phone);
        // Append each file with array notation for PHP to receive as array
        if(files && files.length){ 
            Array.from(files).forEach((f, index) => {
                form.append('photos[]', f);
            });
        }
        const res = await fetch(`${API_BASE}/students.php`.replace(/^\/\//, '/'), { method: 'POST', body: form });
        return res.json();
    },
    update: (student) => apiRequest('students.php', 'PUT', student),
    delete: (id) => apiRequest(`students.php?id=${id}`, 'DELETE')
};

// Teachers API
const teachersAPI = {
    getAll: () => apiRequest('teachers.php'),
    add: (teacher) => apiRequest('teachers.php', 'POST', teacher),
    update: (teacher) => apiRequest('teachers.php', 'PUT', teacher),
    delete: (id) => apiRequest(`teachers.php?id=${id}`, 'DELETE')
};

// Auth API
const authAPI = {
    login: (email, password, role) => apiRequest('login.php', 'POST', { email, password, role }),
};

// Admin API
const adminAPI = {
    getStats: () => apiRequest('admin_stats.php'),
};

// Attendance API
const attendanceAPI = {
    getRecords: (filters = {}) => {
        const params = new URLSearchParams(filters);
        return apiRequest(`attendance.php?${params}`);
    },
    mark: (attendance) => apiRequest('attendance.php', 'POST', attendance)
};
