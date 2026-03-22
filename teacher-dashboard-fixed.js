;(function(){
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))

  // Toast function fallback
  function toast(message, type = 'success') {
    // Try to use the global toast function first
    if (window.toast && typeof window.toast === 'function') {
      return window.toast(message, type)
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`)
    
    // Create a simple toast
    const toastContainer = $('#toast-container') || document.body
    const el = document.createElement('div')
    el.className = `toast ${type}`
    el.textContent = message
    el.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : type === 'danger' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s;
    `
    toastContainer.appendChild(el)
    
    setTimeout(() => el.style.opacity = '1', 10)
    setTimeout(() => {
      el.style.opacity = '0'
      setTimeout(() => el.remove(), 300)
    }, 3000)
  }

  // Navigation handling
  const navLinks = $$('.nav-link[data-section]')
  const contentSections = $$('.content-section')
  const pageTitle = $('#page-title')

  function showSection(sectionId) {
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === sectionId)
    })

    contentSections.forEach(section => {
      section.classList.toggle('active', section.id === `${sectionId}-section`)
    })

    const titles = {
      'dashboard': 'Dashboard',
      'manage-students': 'Manage Students',
      'take-attendance': 'Take Attendance',
      'attendance-reports': 'Attendance Reports'
    }
    if (pageTitle) pageTitle.textContent = titles[sectionId] || 'Dashboard'

    if (sectionId === 'dashboard') {
      loadDashboardStats()
    } else if (sectionId === 'manage-students') {
      loadStudents()
    } else if (sectionId === 'take-attendance') {
      initializeAttendance()
    } else if (sectionId === 'attendance-reports') {
      loadReports()
    }
  }

  // Navigation event listeners
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      showSection(link.dataset.section)
    })
  })

  // Quick action buttons
  $$('[data-section]').forEach(btn => {
    if (btn.classList.contains('btn')) {
      btn.addEventListener('click', () => {
        showSection(btn.dataset.section)
      })
    }
  })

  // Dashboard functionality
  function loadDashboardStats() {
    // Dashboard stats functionality
    loadRecentActivities()
  }
  
  // Load recent activities
  async function loadRecentActivities() {
    const activityList = $('#recentActivityList')
    if (!activityList) {
      console.log('Activity list element not found')
      return
    }
    
    try {
      console.log('Fetching activities...')
      const response = await fetch('students.php?activities=1&limit=10')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const activities = await response.json()
      console.log('Activities loaded:', activities)
      
      if (!Array.isArray(activities) || activities.length === 0) {
        activityList.innerHTML = '<li style="text-align: center; padding: 20px; color: #aab3d1;">No recent activity</li>'
        return
      }
      
      activityList.innerHTML = ''
      activities.forEach(activity => {
        const li = document.createElement('li')
        const activityDate = new Date(activity.created_at)
        const timeStr = activityDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const dateStr = activityDate.toLocaleDateString()
        
        // Get icon based on activity type
        let icon = '📝'
        if (activity.activity_type === 'student_added') icon = '👤➕'
        else if (activity.activity_type === 'student_deleted') icon = '🗑️'
        else if (activity.activity_type === 'attendance_taken') icon = '✅'
        
        li.className = 'activity-item'
        li.innerHTML = `
          <div style="display: flex; align-items: start; gap: 12px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <span style="font-size: 20px;">${icon}</span>
            <div style="flex: 1;">
              <div style="font-weight: 500; margin-bottom: 4px; color: #e7ecff;">${activity.activity_description}</div>
              <div style="font-size: 12px; color: #aab3d1;">${timeStr} • ${dateStr}</div>
            </div>
          </div>
        `
        activityList.appendChild(li)
      })
      console.log(`Displayed ${activities.length} activities`)
    } catch (error) {
      console.error('Error loading activities:', error)
      if (activityList) {
        activityList.innerHTML = '<li style="text-align: center; padding: 20px; color: #ff6b6b;">Failed to load activities</li>'
      }
    }
  }

  // Student management
  const studentForm = $('#add-student-form')
  const photoPreview = $('#photo-preview')
  const studentPhotosInput = $('#student-photos')
  const uploadPhotosBtn = $('#upload-photos-btn')
  
  uploadPhotosBtn && uploadPhotosBtn.addEventListener('click', () => {
    studentPhotosInput?.click()
  })

  studentPhotosInput && studentPhotosInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || [])
    if(!files.length){ 
      if(photoPreview) photoPreview.innerHTML = ''
      return 
    }
    if(photoPreview) {
      photoPreview.innerHTML = ''
      const max = Math.min(files.length, 3)
      for(let i=0; i<max; i++){
        const file = files[i]
        const reader = new FileReader()
        reader.onload = () => {
          const img = document.createElement('img')
          img.src = reader.result
          photoPreview.appendChild(img)
        }
        reader.readAsDataURL(file)
      }
    }
  })

  const studentsTableBody = $('#students-table-body')
  const studentSearch = $('#student-search')
  const filterDepartment = $('#filter-department')
  const filterYear = $('#filter-year')
  const filterDivision = $('#filter-division')
  const applyFilters = $('#apply-filters')

  // Student form submission
  studentForm && studentForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const name = $('#student-name')?.value?.trim()
    const studentId = $('#student-id')?.value?.trim()
    const department = $('#student-department')?.value
    const year = $('#student-year')?.value
    const division = $('#student-division')?.value
    
    if (!name || !studentId || !department || !year || !division) {
      toast('Please fill all required fields', 'danger')
      return
    }
    
    const uploadedFiles = (studentPhotosInput && studentPhotosInput.files) ? Array.from(studentPhotosInput.files) : []
    if (uploadedFiles.length === 0) {
      toast('Please add at least one photo', 'danger')
      return
    }
    
    try {
      const r = await fetch('students.php');
      const rt = await r.text();
      let existingStudents = [];
      try { existingStudents = JSON.parse(rt); } catch(e) { throw new Error(rt.substring(0, 200)); }
      if (Array.isArray(existingStudents)) {
        const duplicate = existingStudents.find(s => (s.roll_no || '').toLowerCase() === studentId.toLowerCase())
        if (duplicate) {
          toast('Student ID already exists. Please use a different ID.', 'danger')
          $('#student-id')?.focus()
          return
        }
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error)
    }
    
    const formData = new FormData()
    formData.append('name', name)
    formData.append('roll_no', studentId)
    formData.append('class', department)
    formData.append('year', year)
    formData.append('division', division)
    
    const email = $('#student-email')?.value?.trim() || ''
    const phone = $('#student-phone')?.value?.trim() || ''
    
    if (email) formData.append('email', email)
    if (phone) formData.append('phone', phone)
    formData.append('department', department)
    
    uploadedFiles.forEach((file) => {
      formData.append('photos[]', file)
    })

    try {
      const response = await fetch('students.php', {
        method: 'POST',
        body: formData
      })
      const result = await response.json()
      
      if (result.success) {
        toast(`Student added successfully! Photos saved: ${result.photos_saved || 0}`, 'success')
        studentForm.reset()
        if(studentPhotosInput) studentPhotosInput.value = ''
        if(photoPreview) photoPreview.innerHTML = ''
        await loadStudents()
        await loadRecentActivities() // Refresh activity log
      } else {
        toast(result.error || 'Failed to add student', 'danger')
      }
    } catch (error) {
      console.error('Error adding student:', error)
      toast(`[SYSTEM ERROR]: ${error.message}`, 'danger')
    }
  })

  // Load students from database
  async function loadStudents() {
    if (!studentsTableBody) return
    
    try {
      studentsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--muted);">Loading students...</td></tr>'
      
      const response = await fetch('students.php')
      const students = await response.json()
      
      if (!Array.isArray(students)) {
        console.error('Invalid response from API:', students)
        studentsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--danger);">Failed to load students</td></tr>'
        return
      }

      let filteredStudents = students
      const searchTerm = studentSearch?.value?.toLowerCase() || ''
      const departmentFilter = filterDepartment?.value || ''
      const yearFilter = filterYear?.value || ''
      const divisionFilter = filterDivision?.value || ''

      if (searchTerm) {
        filteredStudents = filteredStudents.filter(s => 
          (s.name || '').toLowerCase().includes(searchTerm) || 
          (s.roll_no || '').toLowerCase().includes(searchTerm)
        )
      }
      if (departmentFilter) {
        filteredStudents = filteredStudents.filter(s => (s.department || s.class || s.class_name || '') === departmentFilter)
      }
      if (yearFilter) {
        filteredStudents = filteredStudents.filter(s => (s.year || '') === yearFilter)
      }
      if (divisionFilter) {
        filteredStudents = filteredStudents.filter(s => (s.division || '') === divisionFilter)
      }

      studentsTableBody.innerHTML = ''
      
      if (filteredStudents.length === 0) {
        studentsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--muted);">No students found</td></tr>'
        return
      }
      
      filteredStudents.forEach(student => {
        const row = document.createElement('tr')
        const photoPath = student.photo_folder_path ? `${student.photo_folder_path}/img1.jpg` : null
        row.innerHTML = `
          <td>
            <div class="student-photo">
              ${photoPath ? `<img src="${photoPath}" alt="${student.name}" onerror="this.parentElement.innerHTML='👤'" />` : '👤'}
            </div>
          </td>
          <td>${student.name || ''}</td>
          <td>${student.roll_no || ''}</td>
          <td>${student.department || student.class || student.class_name || ''}</td>
          <td>${student.year || ''}</td>
          <td>${student.division || ''}</td>
          <td>
            <button class="btn-icon" onclick="deleteStudent(${student.id})" title="Delete">🗑️</button>
          </td>
        `
        studentsTableBody.appendChild(row)
      })
    } catch (error) {
      console.error('Error loading students:', error)
      if (studentsTableBody) {
        studentsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--danger);">Failed to load students</td></tr>'
      }
      toast('Failed to load students', 'danger')
    }
  }

  // Filter event listeners
  studentSearch && studentSearch.addEventListener('input', loadStudents)
  filterDepartment && filterDepartment.addEventListener('change', loadStudents)
  filterYear && filterYear.addEventListener('change', loadStudents)
  filterDivision && filterDivision.addEventListener('change', loadStudents)
  applyFilters && applyFilters.addEventListener('click', loadStudents)

  // Take Attendance functionality
  function initializeAttendance() {
    // Attendance initialization if needed
  }

  // Attendance Reports functionality
  const reportTableBody = $('#reports-table-body')
  const generateReportBtn = $('#generate-report')
  const downloadReportBtn = $('#download-report')

  function loadReports() {
    if (!reportTableBody) return
    
    const reports = [
      { date: '2024-01-15', name: 'John Doe', class: 'Computer', year: 'FY', division: 'A', subject: 'Mathematics', timeSlot: '9:00-10:00', status: 'Present', timestamp: '09:05 AM' },
      { date: '2024-01-15', name: 'Jane Smith', class: 'Computer', year: 'FY', division: 'A', subject: 'Mathematics', timeSlot: '9:00-10:00', status: 'Present', timestamp: '09:07 AM' }
    ]

    const present = reports.filter(r => r.status === 'Present').length
    const absent = reports.filter(r => r.status === 'Absent').length
    const total = reports.length
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0

    const totalPresentEl = $('#total-present')
    const totalAbsentEl = $('#total-absent')
    const attendancePercentageEl = $('#attendance-percentage')
    
    if (totalPresentEl) totalPresentEl.textContent = present
    if (totalAbsentEl) totalAbsentEl.textContent = absent
    if (attendancePercentageEl) attendancePercentageEl.textContent = `${percentage}%`

    reportTableBody.innerHTML = ''
    reports.forEach(report => {
      const row = document.createElement('tr')
      row.innerHTML = `
        <td>${report.date}</td>
        <td>${report.name}</td>
        <td>${report.class}</td>
        <td>${report.year}</td>
        <td>${report.division}</td>
        <td>${report.subject}</td>
        <td>${report.timeSlot}</td>
        <td><span class="badge ${report.status === 'Present' ? 'success' : 'danger'}">${report.status}</span></td>
        <td>${report.timestamp}</td>
      `
      reportTableBody.appendChild(row)
    })
  }

  generateReportBtn && generateReportBtn.addEventListener('click', loadReports)
  downloadReportBtn && downloadReportBtn.addEventListener('click', () => {
    toast('Report downloaded successfully', 'success')
  })

  // Global functions for student actions
  window.deleteStudent = async function(id) {
    if (confirm('Are you sure you want to delete this student?')) {
      try {
        const response = await fetch(`students.php?id=${id}`, {
          method: 'DELETE'
        })
        const result = await response.json()
        
        if (result.success) {
          toast('Student deleted successfully', 'success')
          loadStudents()
          loadRecentActivities() // Refresh activity log
        } else {
          toast('Failed to delete student', 'danger')
        }
      } catch (error) {
        console.error('Error deleting student:', error)
        toast('Failed to delete student', 'danger')
      }
    }
  }

  // Initialize dashboard on load
  loadDashboardStats()
  loadStudents()

})()

// Global function for start attendance button (outside the closure)
window.handleStartAttendance = function() {
  console.log('handleStartAttendance called')
  
  const classEl = document.getElementById('lecture-class')
  const yearEl = document.getElementById('lecture-year')
  const divisionEl = document.getElementById('lecture-division')
  const subjectEl = document.getElementById('lecture-subject')
  const timeSlotEl = document.getElementById('lecture-time-slot')

  console.log('Elements found:', {
    class: !!classEl,
    year: !!yearEl,
    division: !!divisionEl,
    subject: !!subjectEl,
    timeSlot: !!timeSlotEl
  })

  if (!classEl || !yearEl || !divisionEl || !subjectEl || !timeSlotEl) {
    alert('Form elements not found. Please refresh the page.')
    return
  }

  const classVal = classEl.value
  const yearVal = yearEl.value
  const divisionVal = divisionEl.value
  const subjectVal = subjectEl.value
  const timeSlotVal = timeSlotEl.value

  console.log('Form values:', { classVal, yearVal, divisionVal, subjectVal, timeSlotVal })

  if (!classVal || !yearVal || !divisionVal || !subjectVal || !timeSlotVal) {
    alert('Please fill all lecture details')
    return
  }

  // Save selection and navigate
  try {
    localStorage.setItem('sa.attendance.selection', JSON.stringify({
      dept: classVal,
      year: yearVal,
      division: divisionVal,
      slot: timeSlotVal
    }))
    localStorage.setItem('sa.attendance.subject', subjectVal)
    
    console.log('Selection saved, redirecting...')
    window.location.href = 'attendance.html'
    
  } catch (error) {
    console.error('Error saving to localStorage:', error)
    alert('Error saving selection: ' + error.message)
  }
}
