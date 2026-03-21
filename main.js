;(function(){
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))

  // DateTime updater
  const datetimeEl = $('#datetime')
  function updateDateTime(){
    if(!datetimeEl) return
    const now = new Date()
    const formatted = now.toLocaleString([], { weekday:'short', year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' })
    datetimeEl.textContent = formatted
  }
  updateDateTime()
  setInterval(updateDateTime, 30_000)

  // Theme toggle
  const themeBtn = $('#toggle-theme')
  const THEME_KEY = 'pref-theme'
  const applyTheme = (mode) => {
    if(mode === 'light'){
      document.documentElement.style.setProperty('--bg', '#f6f7fb')
      document.documentElement.style.setProperty('--panel', '#ffffff')
      document.documentElement.style.setProperty('--panel-2', '#f3f6ff')
      document.documentElement.style.setProperty('--text', '#0b1020')
      document.documentElement.style.setProperty('--muted', '#5b6687')
    } else {
      document.documentElement.style.removeProperty('--bg')
      document.documentElement.style.removeProperty('--panel')
      document.documentElement.style.removeProperty('--panel-2')
      document.documentElement.style.removeProperty('--text')
      document.documentElement.style.removeProperty('--muted')
    }
  }
  const savedTheme = localStorage.getItem(THEME_KEY)
  if(savedTheme) applyTheme(savedTheme)
  themeBtn && themeBtn.addEventListener('click', () => {
    const current = localStorage.getItem(THEME_KEY) === 'light' ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, current)
    applyTheme(current)
    toast(`Switched to ${current} mode`, 'success')
  })

  // Simple role-based auth
  const AUTH_KEY = 'sa.auth'
  const USERS_KEY = 'sa.users'
  function getAuth(){
    try{ return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') }catch{ return null }
  }
  function setAuth(data){ localStorage.setItem(AUTH_KEY, JSON.stringify(data)) }
  function clearAuth(){ localStorage.removeItem(AUTH_KEY) }
  function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '[]') }catch{ return [] } }
  function setUsers(list){ localStorage.setItem(USERS_KEY, JSON.stringify(list)) }

  // Seed a default admin if none (teachers are stored in DB)
  ;(function seed(){
    const users = getUsers()
    if(!users.find(u => u.email === 'admin@example.com')){
      users.push({ name:'Admin', email:'admin@example.com', password:'admin123', role:'Admin' })
      setUsers(users)
    }
  })()

  // Guard pages using data-role-guard on #app
  const appRoot = document.getElementById('app')
  const requiredRole = appRoot?.getAttribute('data-role-guard')
  if(requiredRole){
    const auth = getAuth()
    if(!auth || auth.role !== requiredRole){
      toast('Please login as '+requiredRole, 'danger')
      setTimeout(()=> location.href = 'login.html', 600)
      return
    }
  }

  // Login form handling
  const loginForm = document.getElementById('login-form')
  if(loginForm){
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('email').value.trim().toLowerCase()
      const password = document.getElementById('password').value
      const role = document.getElementById('role').value
      try{
        const res = await authAPI.login(email, password, role)
        if(!res?.success){ toast(res?.error || 'Invalid credentials', 'danger'); return }
        const user = res.user
        setAuth({ email: user.email, name: user.name, role: user.role })
        toast('Signed in as '+user.role, 'success')
        setTimeout(()=>{
          if(user.role === 'Admin') location.href = 'admin.html'
          else location.href = 'teacher-dashboard.html'
        }, 500)
      }catch(err){
        toast('Login failed', 'danger')
      }
    })
  }

  // Logout buttons
  $$('#logout').forEach(btn => btn.addEventListener('click', () => {
    clearAuth()
    toast('Logged out', 'success')
    setTimeout(()=> location.href = 'login.html', 400)
  }))

  // Toasts
  function toast(message, type = 'success'){
    const toastContainer = $('#toast-container')
    if(!toastContainer) {
      console.log(`[${type.toUpperCase()}] ${message}`)
      return
    }
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
      margin-bottom: 10px;
    `
    toastContainer.appendChild(el)
    setTimeout(() => el.style.opacity = '1', 10)
    setTimeout(() => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(12px)'
      setTimeout(() => el.remove(), 250)
    }, 3000)
  }
  
  // Make toast globally available
  window.toast = toast

  // Attendance page interactions - integrated with Flask recognition
  const video = $('#video')
  const statusBox = $('#status')
  const statusText = statusBox ? statusBox.querySelector('.status-text') : null
  const statusIcon = statusBox ? statusBox.querySelector('.status-icon') : null
  const btnDetect = $('#btn-detect')
  const btnReset = $('#btn-reset')

  // Cloud routing: Use /api to hit the proxy which forwards to Python
  const FLASK_BASE = window.location.pathname.replace(/\/[^\/]*$/, '') + '/api';
  let streaming = false
  let streamTimer = null
  let attendanceLog = []
  let recognitionCounts = {} // Track recognition counts per student
  let attendanceRecords = [] // Final attendance records
  const REQUIRED_DETECTIONS = 2 // Number of detections needed to mark attendance

  async function initCamera(){
    if(!video) return
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      video.srcObject = stream
      
      // Auto-start recognition when camera is ready
      video.addEventListener('loadedmetadata', () => {
        if(btnDetect && !streaming) {
          setTimeout(() => {
            btnDetect.click() // Auto-start recognition
          }, 1000)
        }
      })
    }catch(err){
      toast('Camera access denied. Please allow camera access and refresh the page.', 'danger')
    }
  }

  // Initialize camera when page loads
  if(video) {
    initCamera()
  }

  function getAttendanceMeta(){
    const sel = (()=>{ try{ return JSON.parse(localStorage.getItem('sa.attendance.selection')||'null') }catch{ return null } })() || {}
    return {
      teacher_id: 1,
      department: sel.dept || 'Computer',
      year: sel.year || 'FY',
      division: sel.division || 'A',
      time_slot: sel.slot || '9:00 - 10:00',
      subject: localStorage.getItem('sa.attendance.subject') || 'General'
    }
  }

  function addAttendanceLogEntry(name, rollNo, status, confidence) {
    const now = new Date()
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    const logEntry = {
      time,
      name,
      rollNo,
      status,
      confidence,
      timestamp: now
    }
    
    attendanceLog.unshift(logEntry) // Add to beginning
    
    // Keep only last 20 entries
    if(attendanceLog.length > 20) {
      attendanceLog = attendanceLog.slice(0, 20)
    }
    
    // Update UI if log container exists
    updateAttendanceLogDisplay()
  }

  function processRecognition(name, rollNo, confidence, decision) {
    const now = new Date()
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    // Add to live log
    addToLiveLog(name, rollNo, confidence, decision, time)
    
    // Only count confident recognitions (>=60%)
    if (decision === 'present' || decision === 'uncertain') {
      if (!recognitionCounts[rollNo]) {
        recognitionCounts[rollNo] = {
          name: name,
          rollNo: rollNo,
          count: 0,
          bestConfidence: 0,
          firstSeen: time,
          lastSeen: time
        }
      }
      
      recognitionCounts[rollNo].count++
      recognitionCounts[rollNo].lastSeen = time
      recognitionCounts[rollNo].bestConfidence = Math.max(recognitionCounts[rollNo].bestConfidence, confidence)
      
      // Check if we should mark attendance
      if (recognitionCounts[rollNo].count >= REQUIRED_DETECTIONS) {
        // Check if not already in attendance records
        const alreadyMarked = attendanceRecords.find(record => record.rollNo === rollNo)
        if (!alreadyMarked) {
          markAttendance(rollNo, name, confidence, time)
        }
      }
    }
    
    updateAttendanceRecordsDisplay()
    updateStatsDisplay()
  }
  
  function addToLiveLog(name, rollNo, confidence, decision, time) {
    const logEntry = {
      time,
      name,
      rollNo,
      confidence,
      decision,
      timestamp: new Date()
    }
    
    attendanceLog.unshift(logEntry) // Add to beginning
    
    // Keep only last 10 entries
    if(attendanceLog.length > 10) {
      attendanceLog = attendanceLog.slice(0, 10)
    }
    
    updateLiveLogDisplay()
  }
  
  function markAttendance(rollNo, name, confidence, time) {
    const attendanceRecord = {
      rollNo: rollNo,
      name: name,
      time: time,
      confidence: confidence,
      detections: recognitionCounts[rollNo].count,
      status: 'Present',
      timestamp: new Date()
    }
    
    attendanceRecords.push(attendanceRecord)
    
    // Save to CSV via API call
    saveAttendanceToCSV(attendanceRecord)
    
    // Show success message
    toast(`✅ Attendance marked for ${name} (${rollNo}) after ${recognitionCounts[rollNo].count} detections!`, 'success')
  }
  
  async function saveAttendanceToCSV(record) {
    // This would typically call an API to save to CSV
    // For now, we'll just log it
    console.log('Saving to CSV:', record)
    
    // You can implement an API call here to save to the actual CSV file
    // try {
    //   await fetch('/save_attendance', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(record)
    //   })
    // } catch (error) {
    //   console.error('Error saving to CSV:', error)
    // }
  }
  
  function updateAttendanceRecordsDisplay() {
    const recordsBody = $('#attendance-records-body')
    if (!recordsBody) return
    
    recordsBody.innerHTML = ''
    
    if (attendanceRecords.length === 0) {
      // Show pending recognitions
      const pendingStudents = Object.values(recognitionCounts).filter(student => student.count < REQUIRED_DETECTIONS)
      
      if (pendingStudents.length === 0) {
        recordsBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 20px; color: var(--muted);">
              Waiting for students...
            </td>
          </tr>
        `
      } else {
        pendingStudents.forEach(student => {
          const row = document.createElement('tr')
          row.className = 'pending-recognition'
          row.innerHTML = `
            <td>${student.rollNo}</td>
            <td>${student.name}</td>
            <td>${student.firstSeen}</td>
            <td>${student.bestConfidence.toFixed(1)}%</td>
            <td>${student.count}/${REQUIRED_DETECTIONS}</td>
            <td><span class="badge warning">Detecting...</span></td>
          `
          recordsBody.appendChild(row)
        })
      }
    }
    
    // Add confirmed attendance records
    attendanceRecords.forEach(record => {
      const row = document.createElement('tr')
      row.innerHTML = `
        <td><strong>${record.rollNo}</strong></td>
        <td><strong>${record.name}</strong></td>
        <td>${record.time}</td>
        <td>${record.confidence.toFixed(1)}%</td>
        <td>${record.detections}</td>
        <td><span class="badge success">Present</span></td>
      `
      recordsBody.appendChild(row)
    })
    
    // Show pending recognitions below confirmed ones
    const pendingStudents = Object.values(recognitionCounts).filter(student => 
      student.count < REQUIRED_DETECTIONS && !attendanceRecords.find(r => r.rollNo === student.rollNo)
    )
    
    pendingStudents.forEach(student => {
      const row = document.createElement('tr')
      row.className = 'pending-recognition'
      row.style.opacity = '0.7'
      row.innerHTML = `
        <td>${student.rollNo}</td>
        <td>${student.name}</td>
        <td>${student.firstSeen}</td>
        <td>${student.bestConfidence.toFixed(1)}%</td>
        <td><span class="badge info">${student.count}/${REQUIRED_DETECTIONS}</span></td>
        <td><span class="badge warning">Detecting...</span></td>
      `
      recordsBody.appendChild(row)
    })
  }
  
  function updateLiveLogDisplay() {
    const logContainer = $('#live-attendance-log')
    
    if(logContainer) {
      logContainer.innerHTML = ''
      
      if(attendanceLog.length === 0) {
        logContainer.innerHTML = '<div class="log-item"><span class="log-time">--:--</span><span class="log-text">Waiting for face detection...</span></div>'
      } else {
        attendanceLog.forEach(entry => {
          const logItem = document.createElement('div')
          logItem.className = 'log-item'
          
          let statusText = ''
          if (entry.decision === 'present') {
            statusText = `✅ Recognized (${entry.confidence.toFixed(1)}%)`
          } else if (entry.decision === 'uncertain') {
            statusText = `❓ Uncertain (${entry.confidence.toFixed(1)}%)`
          } else {
            statusText = `❌ Not recognized`
          }
          
          logItem.innerHTML = `
            <span class="log-time">${entry.time}</span>
            <span class="log-text">${entry.name} (${entry.rollNo}) - ${statusText}</span>
          `
          logContainer.appendChild(logItem)
        })
      }
    }
  }
  
  function updateStatsDisplay() {
    const totalCountEl = $('#total-present-count')
    const lastUpdatedEl = $('#last-updated')
    
    if(totalCountEl) {
      totalCountEl.textContent = attendanceRecords.length
    }
    
    if(lastUpdatedEl && attendanceRecords.length > 0) {
      const lastRecord = attendanceRecords[attendanceRecords.length - 1]
      lastUpdatedEl.textContent = lastRecord.time
    }
  }
  
  function updateAttendanceLogDisplay() {
    // Legacy function - now split into separate functions
    updateAttendanceRecordsDisplay()
    updateLiveLogDisplay()
    updateStatsDisplay()
  }
  
  // Load today's attendance from CSV via Python server
  async function loadTodayAttendanceFromServer() {
    try {
      const res = await fetch(`${FLASK_BASE}/attendance/today`)
      if (!res.ok) return
      
      const json = await res.json()
      if (json.success && json.records && json.records.length > 0) {
        console.log('Loading existing attendance records:', json.records.length)
        
        // Add records from CSV to our display
        json.records.forEach(record => {
          const rollNo = record.RollNo || record.roll_no
          const name = record.Name || record.name
          const time = record.Time || record.time
          const confidenceStr = record.Confidence || '0%'
          const confidence = parseFloat(confidenceStr.replace('%', '')) || 0
          
          // Check if not already in our records
          if (!attendanceRecords.find(r => r.rollNo === rollNo)) {
            attendanceRecords.push({
              rollNo: rollNo,
              name: name,
              time: time,
              confidence: confidence,
              detections: 2,
              status: 'Present',
              timestamp: new Date()
            })
            
            // Also mark in recognition counts to prevent re-marking
            recognitionCounts[rollNo] = {
              name: name,
              rollNo: rollNo,
              count: REQUIRED_DETECTIONS,
              bestConfidence: confidence,
              firstSeen: time,
              lastSeen: time
            }
          }
        })
        
        updateAttendanceRecordsDisplay()
        updateStatsDisplay()
        
        toast(`Loaded ${json.records.length} existing attendance record(s)`, 'success')
      }
    } catch (error) {
      console.log('Could not load existing attendance:', error)
    }
  }

  async function checkServerHealth() {
    try {
      const res = await fetch(`${FLASK_BASE}/health`)
      const json = await res.json()
      return json.ok
    } catch(err) {
      return false
    }
  }

  async function captureAndSendFrame(){
    if(!video || !streaming) return
    
    // Check if video is ready
    if(video.videoWidth === 0 || video.videoHeight === 0) return
    
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    
    try{
      const res = await fetch(`${FLASK_BASE}/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: dataUrl, meta: getAttendanceMeta() })
      })
      
      if(!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }
      
      const json = await res.json()
      
      if(!statusBox || !statusText || !statusIcon) return
      
      if(json.success){
        const decision = json.decision
        const name = json.name || 'Unknown'
        const rollNo = json.roll_no || ''
        const confidence = json.confidence || 0
        
        // Process recognition for counting and attendance marking
        if (name !== 'Unknown' && rollNo) {
          processRecognition(name, rollNo, confidence, decision)
        }
        
        // Update status display
        if(decision === 'present' || decision === 'uncertain'){
          const currentCount = recognitionCounts[rollNo] ? recognitionCounts[rollNo].count : 0
          const isAlreadyMarked = attendanceRecords.find(record => record.rollNo === rollNo)
          
          if (isAlreadyMarked) {
            statusBox.classList.remove('danger', 'warning')
            statusBox.classList.add('success')
            statusText.textContent = `✅ Already Present: ${name} (${rollNo}) - ${confidence.toFixed(1)}%`
            statusIcon.textContent = '✅'
          } else if (currentCount >= REQUIRED_DETECTIONS) {
            statusBox.classList.remove('danger', 'warning')
            statusBox.classList.add('success')
            statusText.textContent = `✅ Attendance Confirmed: ${name} (${rollNo}) - ${confidence.toFixed(1)}%`
            statusIcon.textContent = '✅'
          } else {
            statusBox.classList.remove('success', 'danger')
            statusBox.classList.add('warning')
            statusText.textContent = `🔍 Detecting: ${name} (${rollNo}) - ${currentCount}/${REQUIRED_DETECTIONS} - ${confidence.toFixed(1)}%`
            statusIcon.textContent = '🔍'
          }
        } else {
          statusBox.classList.remove('success', 'warning')
          statusBox.classList.add('danger')
          statusText.textContent = `❌ Face Not Recognized - ${confidence.toFixed(1)}%`
          statusIcon.textContent = '❌'
        }
      } else {
        statusBox.classList.remove('success', 'warning')
        statusBox.classList.add('danger')
        statusText.textContent = `⚠️ ${json.error || 'Recognition error'}`
        statusIcon.textContent = '⚠️'
      }
    }catch(err){
      console.error('Recognition error:', err)
      if(statusBox && statusText && statusIcon){
        statusBox.classList.remove('success')
        statusBox.classList.add('danger')
        statusText.textContent = 'Connection to recognition server failed'
        statusIcon.textContent = '⚠️'
      }
    }
  }

  btnDetect && btnDetect.addEventListener('click', async () => {
    if(!statusBox || !statusText || !statusIcon) return
    
    if(!streaming){
      // Check server health first
      const serverHealthy = await checkServerHealth()
      if(!serverHealthy) {
        toast('Face recognition server is not running. Please start face_recognition_server.py', 'danger')
        return
      }
      
      streaming = true
      btnDetect.textContent = 'Stop Recognition'
      statusText.textContent = 'Starting recognition...'
      statusIcon.textContent = '🔍'
      streamTimer = setInterval(captureAndSendFrame, 1500) // Slightly slower for better accuracy
      toast('Face recognition started', 'info')
      loadTodayAttendanceFromServer() // Load existing attendance records
    } else {
      streaming = false
      btnDetect.textContent = 'Start Recognition'
      if(streamTimer){ clearInterval(streamTimer); streamTimer = null }
      statusText.textContent = 'Recognition stopped'
      statusIcon.textContent = '⏹️'
      toast('Face recognition stopped', 'info')
    }
  })

  btnReset && btnReset.addEventListener('click', () => {
    if(!statusBox || !statusText || !statusIcon) return
    statusBox.classList.remove('success','danger','warning')
    statusText.textContent = 'Waiting for detection...'
    statusIcon.textContent = '⌛'
    
    // Clear all data
    attendanceLog = []
    recognitionCounts = {}
    attendanceRecords = []
    
    // Update displays
    updateAttendanceLogDisplay()
    
    toast('Reset complete - all data cleared', 'info')
  })

  // Reports heatmap demo
  const heatmap = $('#heatmap')
  if(heatmap){
    const days = 28 * 5
    for(let i=0;i<days;i++){
      const cell = document.createElement('div')
      cell.className = 'heatmap-cell'
      const v = Math.random()
      cell.style.background = `rgba(108,124,255, ${v * 0.6})`
      heatmap.appendChild(cell)
    }
  }

  // Records page filters and table
  const rDate = document.getElementById('r-date')
  const rClass = document.getElementById('r-class')
  const rYear = document.getElementById('r-year')
  const rDiv = document.getElementById('r-division')
  const rStudent = document.getElementById('r-student')
  const rApply = document.getElementById('r-apply')
  const rBody = document.getElementById('records-body')
  async function renderRecords(){
    if(!rBody) return
    rBody.innerHTML = ''
    const params = {}
    if(rDate?.value) params.date = rDate.value
    if(rClass?.value) params.class = rClass.value
    if(rYear?.value) params.year = rYear.value
    if(rDiv?.value) params.division = rDiv.value
    try{
      const data = await attendanceAPI.getRecords(params)
      let rows = Array.isArray(data) ? data : []
      const q = (rStudent?.value||'').toLowerCase()
      if(q){ rows = rows.filter(x => (x.student_name||'').toLowerCase().includes(q) || String(x.student_id||'').includes(q)) }
      rows.forEach(x => {
        const tr = document.createElement('tr')
        tr.innerHTML = `<td>${x.attendance_date||x.date||''}</td><td>${x.student_name||''}</td><td>${x.class||x.class_name||''}</td><td>${x.year||''}</td><td>${x.division||''}</td><td>${x.subject||''}</td><td>${x.time_slot||''}</td><td>${x.status||'Present'}</td>`
        rBody.appendChild(tr)
      })
    }catch(err){ toast('Failed to load records', 'danger') }
  }
  rApply && rApply.addEventListener('click', renderRecords)
  renderRecords()

  // Home schedule + filters (unchanged)
  const scheduleGrid = document.getElementById('schedule-grid')
  const scheduleCaption = document.getElementById('schedule-caption')
  const applyFilterBtn = document.getElementById('apply-filter')
  const goAttendanceBtn = document.getElementById('go-attendance')
  const deptSel = document.getElementById('f-dept')
  const yearSel = document.getElementById('f-year')
  const divSel = document.getElementById('f-division')
  const slotSel = document.getElementById('f-slot')
  const FILTER_KEY = 'sa.home.filters'
  function loadFilters(){ try{ return JSON.parse(localStorage.getItem(FILTER_KEY) || 'null') }catch{ return null } }
  function saveFilters(obj){ localStorage.setItem(FILTER_KEY, JSON.stringify(obj)) }
  function renderSchedule(){
    if(!scheduleGrid) return
    scheduleGrid.innerHTML = ''
    const slots = [9,10,11,12,'lunch',14,15,16]
    slots.forEach((h) => {
      const div = document.createElement('div')
      div.className = 'slot' + (h==='lunch' ? ' lunch' : '')
      if(h==='lunch'){
        div.innerHTML = `<span class="time">1:00 - 2:00</span><span class="label">Lunch Break</span>`
      } else {
        const start = h
        const end = h+1
        const fmt = (x) => { const ampm = x < 12 ? 'AM' : 'PM'; const hour = ((x+11)%12)+1; return `${hour}:00 ${ampm}` }
        div.innerHTML = `<span class="time">${fmt(start)} - ${fmt(end)}</span><span class="label">1 hour</span>`
      }
      scheduleGrid.appendChild(div)
    })
  }
  function applyFiltersUI(){
    if(!scheduleCaption) return
    const d = deptSel?.value || ''
    const y = yearSel?.value || ''
    const v = divSel?.value || ''
    const parts = []
    if(d) parts.push(d)
    if(y) parts.push(y)
    if(v) parts.push(`Div ${v}`)
    scheduleCaption.textContent = parts.length ? `Schedule for ${parts.join(' • ')}` : 'Select Department, Year and Division'
  }
  ;(function initHomeFilters(){
    const saved = loadFilters()
    if(saved){ if(deptSel) deptSel.value = saved.dept || ''; if(yearSel) yearSel.value = saved.year || ''; if(divSel) divSel.value = saved.division || ''; if(slotSel) slotSel.value = saved.slot || '' }
    applyFiltersUI()
    renderSchedule()
  })()
  applyFilterBtn && applyFilterBtn.addEventListener('click', () => {
    const current = { dept: deptSel.value, year: yearSel.value, division: divSel.value, slot: slotSel?.value || '' }
    if(!current.dept || !current.year || !current.division || !current.slot){ toast('Please select Department, Year, Division and Time Slot', 'danger'); return }
    localStorage.setItem('sa.attendance.selection', JSON.stringify({ dept: current.dept, year: current.year, division: current.division, slot: current.slot }))
    applyFiltersUI()
    if(goAttendanceBtn) goAttendanceBtn.style.display = 'inline-block'
    toast('Selection saved. You can now mark attendance.', 'success')
  })

  // Student management (unchanged)
  const studentsBody = document.getElementById('students-body')
  const studentForm = document.getElementById('student-form')
  const studentPreview = document.getElementById('student-preview')
  const studentPhotosInput = document.getElementById('s-photos')
  const studentUploadBtn = document.getElementById('s-upload-btn')
  studentUploadBtn && studentUploadBtn.addEventListener('click', () => {
    studentPhotosInput?.click()
  })
  async function renderStudents(){
    if(!studentsBody) return
    studentsBody.innerHTML = ''
    try{
      const list = await studentsAPI.getAll()
      const fClass = (document.getElementById('st-filter-class')?.value || '').toLowerCase()
      const fYear = (document.getElementById('st-filter-year')?.value || '').toLowerCase()
      const fDiv = (document.getElementById('st-filter-division')?.value || '').toLowerCase()
      const filtered = list.filter(s => {
        const cls = (s.class || s.class_name || '').toLowerCase()
        const yr = (s.year || '').toLowerCase()
        const dv = (s.division || '').toLowerCase()
        if(fClass && !cls.includes(fClass)) return false
        if(fYear && !yr.includes(fYear)) return false
        if(fDiv && !dv.includes(fDiv)) return false
        return true
      })
      filtered.forEach((s) => {
        const tr = document.createElement('tr')
        const imgCell = ''
        tr.innerHTML = `<td>${imgCell}</td><td>${s.name||''}</td><td>${s.email||''}</td><td>${s.phone||''}</td><td>${s.roll_no||''}</td><td>${s.class||s.class_name||''}</td><td>${s.section||''}</td><td>${s.department||''}</td><td></td>`
        studentsBody.appendChild(tr)
      })
    }catch(err){ toast('Failed to load students', 'danger') }
  }
  function readFileAsDataUrl(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  studentPhotosInput && studentPhotosInput.addEventListener('change', async (e) => {
    const files = e.target.files
    if(!files || !files.length){ studentPreview && (studentPreview.innerHTML = ''); return }
    if(studentPreview){
      studentPreview.innerHTML = ''
      Array.from(files).slice(0,3).forEach(async (f) => {
        const dataUrl = await readFileAsDataUrl(f)
        const img = document.createElement('img')
        img.src = dataUrl
        studentPreview.appendChild(img)
      })
    }
  })
  studentForm && studentForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = document.getElementById('s-name').value.trim()
    const email = document.getElementById('s-email').value.trim()
    const phone = document.getElementById('s-phone').value.trim()
    const roll = document.getElementById('s-roll').value.trim()
    const className = document.getElementById('s-class').value.trim()
    const year = document.getElementById('s-year').value.trim()
    const division = document.getElementById('s-division').value.trim()
    const section = document.getElementById('s-section').value.trim()
    const department = document.getElementById('s-dept').value.trim()
    const files = studentPhotosInput?.files || []
    if(!name || !className || !year || !division){ toast('Fill required fields', 'danger'); return }
    try{
      const res = await studentsAPI.addMultipart({ name, className, year, division, roll, department, email, phone, files })
      if(!res?.success){ toast(res?.error || 'Failed to save student', 'danger'); return }
      studentForm.reset()
      if(studentPreview) studentPreview.innerHTML = ''
      toast('Student saved', 'success')
      renderStudents()
    }catch(err){ toast('Failed to save student', 'danger') }
  })

  // Teacher student filters
  const stApply = document.getElementById('st-apply')
  stApply && stApply.addEventListener('click', () => { renderStudents() })
  renderStudents()

  // =====================================================
  // Teacher Management (Admin)
  // =====================================================
  const teacherForm = document.getElementById('teacher-form')
  const teachersBody = document.getElementById('teachers-body')
  
  async function renderTeachers(){
    if(!teachersBody) return
    teachersBody.innerHTML = ''
    try{
      const teachers = await teachersAPI.getAll()
      if(!Array.isArray(teachers) || teachers.length === 0){
        teachersBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">No teachers added yet</td></tr>'
        return
      }
      teachers.forEach(t => {
        const tr = document.createElement('tr')
        const createdDate = t.created_at ? new Date(t.created_at).toLocaleDateString() : ''
        tr.innerHTML = `
          <td>${t.name || ''}</td>
          <td>${t.email || ''}</td>
          <td>${t.department || ''}</td>
          <td>${t.phone || ''}</td>
          <td>${t.employee_id || ''}</td>
          <td>${t.designation || ''}</td>
          <td>${createdDate}</td>
        `
        teachersBody.appendChild(tr)
      })
    }catch(err){
      console.error('Failed to load teachers:', err)
      toast('Failed to load teachers', 'danger')
    }
  }
  
  // Teacher form submit
  teacherForm && teacherForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const name = document.getElementById('t-name').value.trim()
    const email = document.getElementById('t-email').value.trim().toLowerCase()
    const password = document.getElementById('t-password').value.trim()
    const phone = document.getElementById('t-phone').value.trim()
    const department = document.getElementById('t-dept').value.trim()
    const employeeId = document.getElementById('t-empid').value.trim()
    const designation = document.getElementById('t-title').value.trim()
    
    if(!name || !email || !password || !department){
      toast('Please fill all required fields (Name, Email, Password, Department)', 'danger')
      return
    }
    
    // Basic email validation
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      toast('Please enter a valid email address', 'danger')
      return
    }
    
    // Password validation (minimum 6 characters)
    if(password.length < 6){
      toast('Password must be at least 6 characters', 'danger')
      return
    }
    
    try{
      const teacherData = {
        name,
        email,
        password,
        phone,
        department,
        employee_id: employeeId,
        designation
      }
      
      const res = await teachersAPI.add(teacherData)
      
      if(!res || !res.success){
        toast(res?.error || 'Failed to add teacher', 'danger')
        return
      }
      
      // Success!
      toast(`✅ Teacher added successfully! Login email: ${email}`, 'success')
      teacherForm.reset()
      renderTeachers()
    }catch(err){
      console.error('Error adding teacher:', err)
      toast('Failed to add teacher. Please try again.', 'danger')
    }
  })
  
  // Load teachers on page load
  renderTeachers()

  // =====================================================
  // Admin Dashboard Stats & Teachers Table
  // =====================================================
  const statTeachers = document.getElementById('stat-teachers')
  const statStudents = document.getElementById('stat-students')
  const statClasses = document.getElementById('stat-classes')
  const adminTeachersBody = document.getElementById('teachers-body')
  const teacherSearch = document.getElementById('t-search')
  const teacherSort = document.getElementById('t-sort')
  const teacherPrev = document.getElementById('t-prev')
  const teacherNext = document.getElementById('t-next')
  const teacherPage = document.getElementById('t-page')
  
  let allTeachersData = []
  let currentPage = 1
  const itemsPerPage = 10
  
  // Fetch and display admin stats
  async function loadAdminStats(){
    if(!statTeachers || !statStudents || !statClasses) return
    
    try{
      const response = await fetch('admin_stats.php')
      const data = await response.json()
      
      if(data.success){
        statTeachers.textContent = data.teachers || 0
        statStudents.textContent = data.students || 0
        statClasses.textContent = data.classes || 0
      } else {
        statTeachers.textContent = '0'
        statStudents.textContent = '0'
        statClasses.textContent = '0'
      }
    }catch(err){
      console.error('Failed to load stats:', err)
      statTeachers.textContent = 'N/A'
      statStudents.textContent = 'N/A'
      statClasses.textContent = 'N/A'
    }
  }
  
  // Fetch all teachers for the admin dashboard table
  async function loadAdminTeachersTable(){
    if(!adminTeachersBody) return
    
    try{
      const teachers = await teachersAPI.getAll()
      allTeachersData = Array.isArray(teachers) ? teachers : []
      renderAdminTeachersTable()
    }catch(err){
      console.error('Failed to load teachers:', err)
      adminTeachersBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">Failed to load teachers</td></tr>'
    }
  }
  
  // Render teachers table with filtering, sorting, and pagination
  function renderAdminTeachersTable(){
    if(!adminTeachersBody) return
    
    let filteredTeachers = [...allTeachersData]
    
    // Apply search filter
    const searchQuery = (teacherSearch?.value || '').toLowerCase().trim()
    if(searchQuery){
      filteredTeachers = filteredTeachers.filter(t => {
        const name = (t.name || '').toLowerCase()
        const email = (t.email || '').toLowerCase()
        const dept = (t.department || '').toLowerCase()
        return name.includes(searchQuery) || email.includes(searchQuery) || dept.includes(searchQuery)
      })
    }
    
    // Apply sorting
    const sortValue = teacherSort?.value || 'created_at|desc'
    const [sortField, sortOrder] = sortValue.split('|')
    
    filteredTeachers.sort((a, b) => {
      let aVal = a[sortField] || ''
      let bVal = b[sortField] || ''
      
      // Handle dates
      if(sortField === 'created_at'){
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      } else {
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
      }
      
      if(sortOrder === 'asc'){
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
    })
    
    // Pagination
    const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage)
    currentPage = Math.max(1, Math.min(currentPage, totalPages || 1))
    
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const pageTeachers = filteredTeachers.slice(startIndex, endIndex)
    
    // Update pagination controls
    if(teacherPage) teacherPage.textContent = `${currentPage} / ${totalPages || 1}`
    if(teacherPrev) teacherPrev.disabled = currentPage <= 1
    if(teacherNext) teacherNext.disabled = currentPage >= totalPages
    
    // Render table
    adminTeachersBody.innerHTML = ''
    
    if(pageTeachers.length === 0){
      adminTeachersBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">No teachers found</td></tr>'
      return
    }
    
    pageTeachers.forEach(t => {
      const tr = document.createElement('tr')
      const createdDate = t.created_at ? new Date(t.created_at).toLocaleDateString() : ''
      tr.innerHTML = `
        <td><strong>${t.name || ''}</strong></td>
        <td>${t.email || ''}</td>
        <td>${t.department || ''}</td>
        <td>${t.phone || '-'}</td>
        <td>${t.employee_id || '-'}</td>
        <td>${t.designation || '-'}</td>
        <td>${createdDate}</td>
      `
      adminTeachersBody.appendChild(tr)
    })
  }
  
  // Event listeners for admin dashboard
  teacherSearch && teacherSearch.addEventListener('input', () => {
    currentPage = 1
    renderAdminTeachersTable()
  })
  
  teacherSort && teacherSort.addEventListener('change', () => {
    currentPage = 1
    renderAdminTeachersTable()
  })
  
  teacherPrev && teacherPrev.addEventListener('click', () => {
    if(currentPage > 1){
      currentPage--
      renderAdminTeachersTable()
    }
  })
  
  teacherNext && teacherNext.addEventListener('click', () => {
    const totalPages = Math.ceil(allTeachersData.length / itemsPerPage)
    if(currentPage < totalPages){
      currentPage++
      renderAdminTeachersTable()
    }
  })
  
  // Load admin dashboard data on page load
  if(statTeachers || adminTeachersBody){
    loadAdminStats()
    loadAdminTeachersTable()
    
    // Refresh stats every 30 seconds
    setInterval(() => {
      loadAdminStats()
      loadAdminTeachersTable()
    }, 30000)
  }
})()
