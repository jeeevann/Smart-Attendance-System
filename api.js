// API helper functions for database operations
// Auto-detect base path from current page URL.
// - XAMPP: /Mini-Project/FaceRecognition/login.html  -> /Mini-Project/FaceRecognition
// - Render: /login.html                              -> (empty string)
let API_BASE = window.location.pathname.replace(/\/[^\/]*$/, '');
if (API_BASE === '/') API_BASE = '';

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
        // Intercept exactly whatever text is blindly dropping from Render/PHP
        const rawText = await response.text();
        
        try {
            return JSON.parse(rawText);
        } catch (jsonErr) {
            console.error("RAW API Response (Not JSON):", rawText);
            // Slice the first 100 characters so the Toast tells us exactly the PHP/Database Error instead of SyntaxError!
            throw new Error(rawText.substring(0, 150));
        }
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
