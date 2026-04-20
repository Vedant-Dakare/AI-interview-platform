/**
 * ProctoringManager - Comprehensive proctoring system for interviews
 * Handles: Camera/Mic permissions, fullscreen enforcement, violation detection, warning system
 */

import { getAuthToken } from './authApi'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

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
    this.hasPendingFullscreenRecovery = false
    this.proctorApiUnauthorized = false

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

      // Step 3: Request fullscreen. If blocked by browser gesture rules,
      // keep interview running and recover fullscreen on next user interaction.
      const enteredFullscreen = await this.enterFullscreen({ throwOnFailure: false })
      if (!enteredFullscreen) {
        this.scheduleFullscreenRecovery()
      }

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
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support camera and microphone access for proctored interviews.')
    }

    if (!window.isSecureContext) {
      throw new Error(
        'Camera and microphone require a secure context. Open the app on localhost or HTTPS and try again.'
      )
    }

    const permissionState = await this.getPermissionState()
    if (permissionState.camera === 'denied' || permissionState.microphone === 'denied') {
      throw new Error(
        'Camera or microphone permission is blocked in browser site settings. Enable both permissions and retry.'
      )
    }

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
      console.error('[ProctoringManager] Permission denied:', error.name, error.message)
      throw new Error(this.mapPermissionError(error))
    }
  }

  async getPermissionState() {
    if (!navigator.permissions?.query) {
      return { camera: 'prompt', microphone: 'prompt' }
    }

    try {
      const [cameraStatus, microphoneStatus] = await Promise.all([
        navigator.permissions.query({ name: 'camera' }),
        navigator.permissions.query({ name: 'microphone' }),
      ])

      return {
        camera: cameraStatus?.state || 'prompt',
        microphone: microphoneStatus?.state || 'prompt',
      }
    } catch {
      return { camera: 'prompt', microphone: 'prompt' }
    }
  }

  mapPermissionError(error) {
    const name = error?.name || ''

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Camera and microphone access were denied. Click the lock icon in your browser address bar, allow both permissions, and try again.'
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera or microphone was detected. Connect both devices and try again.'
    }

    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Camera or microphone is currently in use by another app. Close other apps using these devices and retry.'
    }

    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return 'Requested media constraints are not supported by your device. Reconnect your camera and microphone, then retry.'
    }

    if (name === 'AbortError') {
      return 'Camera or microphone initialization was interrupted. Please retry.'
    }

    return 'Camera and microphone access are required to start the interview. Please grant permissions and try again.'
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
  async enterFullscreen({ throwOnFailure = true } = {}) {
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

      return true
    } catch (error) {
      console.error('[ProctoringManager] Could not enable fullscreen:', error.message)
      this.isFullscreen = false

      if (throwOnFailure) {
        throw new Error('Failed to enable fullscreen mode. Please try again.')
      }

      return false
    }
  }

  /**
   * Recover fullscreen only on next user gesture to satisfy browser constraints.
   */
  scheduleFullscreenRecovery() {
    if (this.hasPendingFullscreenRecovery || this.isTerminated) {
      return
    }

    this.hasPendingFullscreenRecovery = true

    const tryRecover = async () => {
      const recovered = await this.enterFullscreen({ throwOnFailure: false })
      if (recovered) {
        this.hasPendingFullscreenRecovery = false
        window.removeEventListener('pointerdown', tryRecover, true)
        window.removeEventListener('keydown', tryRecover, true)
        console.log('[ProctoringManager] Fullscreen restored from user interaction')
      }
    }

    this.listeners.fullscreenRecover = tryRecover
    window.addEventListener('pointerdown', tryRecover, true)
    window.addEventListener('keydown', tryRecover, true)
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
        this.recordViolation('FULLSCREEN_EXIT', { action: 'manual-exit' })
        this.scheduleFullscreenRecovery()
      } else if (isCurrentlyFullscreen && !this.isFullscreen) {
        this.isFullscreen = true
        this.hasPendingFullscreenRecovery = false
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

    if (this.proctorApiUnauthorized) {
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
      const token = getAuthToken()

      const response = await fetch(`${API_BASE_URL}/api/proctor/proctor-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          interviewId: this.interviewId,
          eventType: type,
          details,
        }),
      })

      if (response.status === 401) {
        this.proctorApiUnauthorized = true
        console.warn('[ProctoringManager] Proctor API unauthorized. Event reporting paused until next login.')
        return
      }

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Failed to record proctor event')
      }

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
      const token = getAuthToken()

      const response = await fetch(`${API_BASE_URL}/api/proctor/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          interviewId: this.interviewId,
          reason,
        }),
      })

      if (response.status === 401) {
        this.proctorApiUnauthorized = true
        console.warn('[ProctoringManager] Unauthorized during terminate call.')
      }

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
    window.removeEventListener('pointerdown', this.listeners.fullscreenRecover, true)
    window.removeEventListener('keydown', this.listeners.fullscreenRecover, true)

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
