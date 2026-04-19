/**
 * ProctoringManager - Comprehensive proctoring system for interviews
 * Handles: Camera/Mic permissions, fullscreen enforcement, violation detection, warning system
 */

class ProctoringManager {
  constructor(interviewId, onWarningUpdate, onTerminated) {
    this.interviewId = interviewId
    this.onWarningUpdate = onWarningUpdate // Callback: (warningCount) => {}
    this.onTerminated = onTerminated // Callback: (reason) => {}

    this.warningCount = 0
    this.isTerminated = false
    this.mediaStream = null
    this.isFullscreen = false
    this.tabSwitchTimeout = null

    // Event listeners references for cleanup
    this.listeners = {}

    // Violation debounce - prevent duplicate warnings in short time
    this.lastViolationTime = {}
    this.violationDebounceMs = 1000
  }

  /**
   * Initialize proctoring - request permissions and start monitoring
   */
  async init() {
    try {
      // Step 1: Request permissions
      await this.requestPermissions()

      // Step 2: Start monitoring
      this.startMonitoring()

      // Step 3: Request fullscreen
      await this.enterFullscreen()

      return true
    } catch (error) {
      console.error('[ProctoringManager] Initialization failed:', error.message)
      throw error
    }
  }

  /**
   * Request camera and microphone access
   */
  async requestPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      })

      this.mediaStream = stream
      console.log('[ProctoringManager] Camera and microphone access granted')

      // Monitor camera status
      this.monitorCameraStatus(stream)
    } catch (error) {
      console.error('[ProctoringManager] Permission denied:', error.message)
      throw new Error(
        'Camera and Microphone access are required to start the interview. Please grant permissions and try again.'
      )
    }
  }

  /**
   * Get video stream for preview display
   */
  getVideoStream() {
    return this.mediaStream
  }

  /**
   * Monitor if camera is still active
   */
  monitorCameraStatus(stream) {
    const videoTrack = stream.getVideoTracks()[0]

    if (!videoTrack) return

    const checkCameraStatus = () => {
      if (videoTrack.readyState === 'ended') {
        this.recordViolation('CAMERA_OFF', { reason: 'Camera stream ended' })
      }

      // Check periodically
      setTimeout(checkCameraStatus, 5000)
    }

    checkCameraStatus()
  }

  /**
   * Request fullscreen
   */
  async enterFullscreen() {
    try {
      const elem = document.documentElement

      if (elem.requestFullscreen) {
        await elem.requestFullscreen()
        this.isFullscreen = true
        console.log('[ProctoringManager] Fullscreen enabled')
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen()
        this.isFullscreen = true
      }
    } catch (error) {
      console.error('[ProctoringManager] Could not enable fullscreen:', error.message)
      throw new Error('Failed to enable fullscreen mode. Please try again.')
    }
  }

  /**
   * Re-enforce fullscreen when user tries to exit
   */
  async enforceFullscreen() {
    if (!this.isFullscreen) {
      try {
        await this.enterFullscreen()
        this.recordViolation('FULLSCREEN_EXIT', { action: 'auto-restored' })
      } catch (error) {
        console.warn('[ProctoringManager] Could not restore fullscreen:', error.message)
      }
    }
  }

  /**
   * Start all monitoring listeners
   */
  startMonitoring() {
    this.setupFullscreenListener()
    this.setupVisibilityListener()
    this.setupWindowFocusListener()
    this.setupKeyboardListener()
  }

  /**
   * Listen for fullscreen changes
   */
  setupFullscreenListener() {
    const handleFullscreenChange = async () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )

      if (!isCurrentlyFullscreen && this.isFullscreen) {
        console.warn('[ProctoringManager] User exited fullscreen')
        this.isFullscreen = false
        await this.enforceFullscreen()
      } else if (isCurrentlyFullscreen && !this.isFullscreen) {
        this.isFullscreen = true
      }
    }

    this.listeners.fullscreenchange = handleFullscreenChange

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)
  }

  /**
   * Detect tab switch using visibility API
   */
  setupVisibilityListener() {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.warn('[ProctoringManager] Tab became hidden - potential tab switch')
        this.recordViolation('TAB_SWITCH', { status: 'tab-hidden' })
      } else {
        console.warn('[ProctoringManager] Tab became visible again')
        this.recordViolation('TAB_SWITCH', { status: 'tab-visible' })
      }
    }

    this.listeners.visibilitychange = handleVisibilityChange
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  /**
   * Detect window focus loss
   */
  setupWindowFocusListener() {
    const handleBlur = () => {
      console.warn('[ProctoringManager] Window lost focus')
      this.recordViolation('WINDOW_BLUR', { event: 'blur' })
    }

    const handleFocus = () => {
      console.log('[ProctoringManager] Window regained focus')
    }

    this.listeners.blur = handleBlur
    this.listeners.focus = handleFocus

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
  }

  /**
   * Block dangerous keyboard shortcuts
   */
  setupKeyboardListener() {
    const handleKeyDown = (e) => {
      const isBannedKey = e.key === 'Escape' || (e.ctrlKey && (e.key === 't' || e.key === 'w')) || (e.altKey && e.key === 'Tab')

      if (isBannedKey) {
        e.preventDefault()
        console.warn('[ProctoringManager] Banned key pressed:', e.key)
        this.recordViolation('KEY_PRESS', {
          key: e.key,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
        })
        return false
      }
    }

    this.listeners.keydown = handleKeyDown
    window.addEventListener('keydown', handleKeyDown)
  }

  /**
   * Record a violation and send to backend
   */
  async recordViolation(type, details = {}) {
    if (this.isTerminated) {
      console.warn('[ProctoringManager] Cannot record violation - interview terminated')
      return
    }

    // Debounce repeated violations
    const now = Date.now()
    const lastTime = this.lastViolationTime[type] || 0

    if (now - lastTime < this.violationDebounceMs) {
      return // Skip duplicate violation
    }

    this.lastViolationTime[type] = now

    try {
      const response = await fetch('/api/proctor/proctor-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewId: this.interviewId,
          eventType: type,
          details,
        }),
      })

      const data = await response.json()

      if (data.success) {
        this.warningCount = data.warningCount || this.warningCount

        // Update UI
        if (this.onWarningUpdate) {
          this.onWarningUpdate(this.warningCount)
        }

        // Check termination
        if (data.terminated) {
          this.terminate('Too many violations detected')
        }

        console.log(`[ProctoringManager] Violation recorded. Warnings: ${this.warningCount}/5`)
      }
    } catch (error) {
      console.error('[ProctoringManager] Failed to record violation:', error.message)
    }
  }

  /**
   * Terminate the interview
   */
  async terminate(reason = 'Interview terminated') {
    if (this.isTerminated) return

    this.isTerminated = true
    this.stopMonitoring()

    try {
      await fetch('/api/proctor/terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewId: this.interviewId,
          reason,
        }),
      })

      if (this.onTerminated) {
        this.onTerminated(reason)
      }
    } catch (error) {
      console.error('[ProctoringManager] Failed to terminate interview:', error.message)
    }
  }

  /**
   * Stop all monitoring
   */
  stopMonitoring() {
    document.removeEventListener('fullscreenchange', this.listeners.fullscreenchange)
    document.removeEventListener('webkitfullscreenchange', this.listeners.fullscreenchange)
    document.removeEventListener('mozfullscreenchange', this.listeners.fullscreenchange)
    document.removeEventListener('msfullscreenchange', this.listeners.fullscreenchange)
    document.removeEventListener('visibilitychange', this.listeners.visibilitychange)
    window.removeEventListener('blur', this.listeners.blur)
    window.removeEventListener('focus', this.listeners.focus)
    window.removeEventListener('keydown', this.listeners.keydown)

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    console.log('[ProctoringManager] Monitoring stopped')
  }

  /**
   * Get current proctoring status
   */
  getStatus() {
    return {
      interviewId: this.interviewId,
      warningCount: this.warningCount,
      isTerminated: this.isTerminated,
      isFullscreen: this.isFullscreen,
      mediaStream: !!this.mediaStream,
    }
  }
}

export default ProctoringManager
