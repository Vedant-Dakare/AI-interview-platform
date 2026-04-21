import { useEffect, useMemo, useRef, useState } from 'react'
import { endInterviewById, submitInterviewAnswer, synthesizeInterviewSpeech, transcribeInterviewAudio } from '../../services/interviewApi'

function VisualBars({ large = false }) {
  if (large) {
    return (
      <div className="live-waveform-large">
        <div className="b h1" />
        <div className="b h2" />
        <div className="b h3" />
        <div className="b h4" />
        <div className="b h5" />
        <div className="b h6" />
        <div className="b h7" />
        <div className="b h8" />
        <div className="b h9" />
        <div className="b h10" />
        <div className="b h11" />
        <div className="b h12" />
        <div className="b h13" />
      </div>
    )
  }

  return (
    <div className="visualizer-bars">
      <div className="v v1" />
      <div className="v v2" />
      <div className="v v3" />
      <div className="v v4" />
      <div className="v v5" />
    </div>
  )
}

function formatRole(role) {
  const normalized = String(role || '').toLowerCase()

  if (normalized === 'dsa') {
    return 'DSA'
  }

  if (normalized === 'ml') {
    return 'ML'
  }

  if (normalized === 'backend') {
    return 'Backend'
  }

  return String(role || 'Backend')
}

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function pickPreferredVoice(voices) {
  if (!Array.isArray(voices) || !voices.length) {
    return null
  }

  const preferredNames = [
    'Google UK English Female',
    'Google US English',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Samantha',
  ]

  for (const voiceName of preferredNames) {
    const match = voices.find((voice) => voice.name === voiceName)
    if (match) {
      return match
    }
  }

  const englishVoice = voices.find((voice) =>
    /^en(-|_)/i.test(voice.lang || '') || String(voice.lang || '').toLowerCase() === 'en'
  )

  return englishVoice || voices[0]
}

function normalizeSpeechText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([,.;!?])\s*/g, '$1 ')
    .replace(/\bNode\.js\b/g, 'Node.js')
    .replace(/\s+/g, ' ')
    .trim()
}

function InterviewWorkspace({
  interviewId,
  candidateName,
  role,
  question,
  currentQuestionIndex,
  totalQuestions,
  onAnswerSubmitted,
  onInterviewCompleted,
}) {
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnswered, setIsAnswered] = useState(false)
  const [error, setError] = useState('')
  const [voiceState, setVoiceState] = useState('idle')
  const [isTranscribing, setIsTranscribing] = useState(false)

  const recognitionRef = useRef(null)
  const noSpeechTimerRef = useRef(null)
  const hasSpokenIntroRef = useRef(false)
  const lastQuestionIdRef = useRef(null)
  const selectedVoiceRef = useRef(null)
  const audioPlayerRef = useRef(null)
  const latestAnswerRef = useRef('')
  const isSubmittingRef = useRef(false)
  const listeningSessionRef = useRef(0)
  const mediaRecorderRef = useRef(null)
  const recordingChunksRef = useRef([])
  const recordingStreamRef = useRef(null)

  const supportsSpeechRecognition = useMemo(() => Boolean(getSpeechRecognition()), [])

  function clearNoSpeechTimer() {
    if (noSpeechTimerRef.current) {
      window.clearTimeout(noSpeechTimerRef.current)
      noSpeechTimerRef.current = null
    }
  }

  function stopListening() {
    clearNoSpeechTimer()

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort()
        } else {
          recognitionRef.current.stop()
        }
      } catch {
        // Ignore stop errors from already stopped recognizers.
      }

      recognitionRef.current = null
    }
  }

  function stopAudioStreamTracks(stream = recordingStreamRef.current) {
    if (!stream) {
      return
    }

    stream.getTracks().forEach((track) => {
      track.stop()
    })

    if (recordingStreamRef.current === stream) {
      recordingStreamRef.current = null
    }
  }

  async function startAudioRecording() {
    if (!navigator?.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      return false
    }

    if (mediaRecorderRef.current) {
      return true
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recordingStreamRef.current = stream

    const supportedType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/wav'].find((mimeType) =>
      window.MediaRecorder.isTypeSupported?.(mimeType)
    )

    const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream)
    recordingChunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        recordingChunksRef.current.push(event.data)
      }
    }

    recorder.start(250)
    mediaRecorderRef.current = recorder
    return true
  }

  async function stopAudioRecording() {
    const recorder = mediaRecorderRef.current
    const recorderStream = recordingStreamRef.current

    if (!recorder) {
      stopAudioStreamTracks(recorderStream)
      return null
    }

    return new Promise((resolve) => {
      const finalize = () => {
        const mimeType = recorder.mimeType || recordingChunksRef.current[0]?.type || 'audio/webm'
        const blob = recordingChunksRef.current.length
          ? new Blob(recordingChunksRef.current, { type: mimeType })
          : null

        mediaRecorderRef.current = null
        recordingChunksRef.current = []
        stopAudioStreamTracks(recorderStream)
        resolve(blob)
      }

      recorder.onstop = finalize

      if (recorder.state === 'inactive') {
        finalize()
        return
      }

      try {
        recorder.stop()
      } catch {
        finalize()
      }
    })
  }

  async function transcribeWithRetry(audioBlob, maxAttempts = 2) {
    let lastError = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const extension = audioBlob.type.includes('wav') ? 'wav' : 'webm'
        const response = await transcribeInterviewAudio(audioBlob, `answer-${Date.now()}.${extension}`)
        return String(response?.data?.transcript || '').trim()
      } catch (error) {
        lastError = error
      }
    }

    throw lastError || new Error('Transcription failed')
  }

  async function resolveTranscriptFromRecording(fallbackTranscript = '') {
    const audioBlob = await stopAudioRecording()
    const normalizedFallback = String(fallbackTranscript || '').trim()

    if (audioBlob && audioBlob.size > 0) {
      try {
        const transcript = await transcribeWithRetry(audioBlob)
        if (transcript) {
          return transcript
        }
      } catch {
        if (normalizedFallback) {
          return normalizedFallback
        }
        throw new Error('Transcription failed')
      }
    }

    return normalizedFallback
  }

  async function processCapturedAnswer(fallbackTranscript = '') {
    setVoiceState('processing')
    setIsTranscribing(true)

    try {
      const transcript = await resolveTranscriptFromRecording(fallbackTranscript)

      if (!transcript || isSubmittingRef.current) {
        if (!isSubmittingRef.current) {
          setVoiceState('idle')
          setError('No response detected. Click Retry Listening or type your answer.')
        }
        return
      }

      setAnswer(transcript)
      await handleSubmitAnswer(transcript)
    } catch {
      setVoiceState('idle')
      setError('Transcription failed. Please click Retry Listening and try again.')
    } finally {
      setIsTranscribing(false)
    }
  }

  function cancelSpeech() {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current.src = ''
      audioPlayerRef.current = null
    }

    if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) {
      window.speechSynthesis.cancel()
    }
  }

  function playAudioBlob(audioBlob) {
    return new Promise((resolve, reject) => {
      try {
        const objectUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(objectUrl)
        audioPlayerRef.current = audio

        audio.onended = () => {
          URL.revokeObjectURL(objectUrl)
          if (audioPlayerRef.current === audio) {
            audioPlayerRef.current = null
          }
          resolve()
        }

        audio.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          if (audioPlayerRef.current === audio) {
            audioPlayerRef.current = null
          }
          reject(new Error('Server audio playback failed'))
        }

        audio.play().catch((error) => {
          URL.revokeObjectURL(objectUrl)
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  function speakText(text) {
    return (async () => {
      if (!text) {
        return
      }

      cancelSpeech()
      setVoiceState('speaking')
      const normalizedText = normalizeSpeechText(text)

      try {
        const speechBlob = await synthesizeInterviewSpeech(normalizedText)
        await playAudioBlob(speechBlob)
        return
      } catch {
        // Fall back to browser speech when server TTS is unavailable.
      }

      await new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(normalizedText)
        const voices = window.speechSynthesis.getVoices()
        if (!selectedVoiceRef.current || !voices.some((voice) => voice.name === selectedVoiceRef.current?.name)) {
          selectedVoiceRef.current = pickPreferredVoice(voices)
        }

        if (selectedVoiceRef.current) {
          utterance.voice = selectedVoiceRef.current
          utterance.lang = selectedVoiceRef.current.lang || 'en-US'
        } else {
          utterance.lang = 'en-US'
        }

        utterance.rate = 0.82
        utterance.pitch = 1
        utterance.volume = 1

        utterance.onend = () => resolve()
        utterance.onerror = () => reject(new Error('Speech synthesis failed'))

        window.speechSynthesis.speak(utterance)
      })
    })()
  }

  function startListening() {
    setError('')
    stopListening()
    void stopAudioRecording()
    const activeSessionId = listeningSessionRef.current + 1
    listeningSessionRef.current = activeSessionId
    setVoiceState('listening')

    if (!supportsSpeechRecognition) {
      startAudioRecording()
        .then((started) => {
          if (!started) {
            setVoiceState('idle')
            setError('Voice input is not supported in this browser. Please type your answer.')
            return
          }

          noSpeechTimerRef.current = window.setTimeout(() => {
            if (activeSessionId !== listeningSessionRef.current) {
              return
            }

            stopListening()
            void processCapturedAnswer('')
          }, 12000)
        })
        .catch(() => {
          setVoiceState('idle')
          setError('Microphone permission is required for voice input. Please allow microphone and retry.')
        })

      return
    }

    const SpeechRecognition = getSpeechRecognition()
    const recognition = new SpeechRecognition()
    let finalTranscript = ''
    let lastCapturedTranscript = ''

    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      if (activeSessionId !== listeningSessionRef.current) {
        return
      }

      let interimTranscript = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const segment = event.results[index][0]?.transcript || ''
        if (event.results[index].isFinal) {
          finalTranscript += `${segment} `
        } else {
          interimTranscript += segment
        }
      }

      const combinedTranscript = `${finalTranscript}${interimTranscript}`.trim()
      if (combinedTranscript) {
        lastCapturedTranscript = combinedTranscript
        setAnswer(combinedTranscript)
      }
    }

    recognition.onerror = () => {
      if (activeSessionId !== listeningSessionRef.current) {
        return
      }

      setVoiceState('idle')
      setError('Could not capture your voice. Please retry or type your answer.')
    }

    recognition.onend = () => {
      if (activeSessionId !== listeningSessionRef.current) {
        return
      }

      clearNoSpeechTimer()
      void processCapturedAnswer(finalTranscript.trim() || lastCapturedTranscript.trim())
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      if (activeSessionId !== listeningSessionRef.current) {
        return
      }

      setVoiceState('idle')
      setError('Could not start voice listening. Please click Retry Listening again or type your answer.')
      recognitionRef.current = null
      return
    }

    noSpeechTimerRef.current = window.setTimeout(() => {
      if (activeSessionId !== listeningSessionRef.current) {
        return
      }

      if (!finalTranscript.trim() && !lastCapturedTranscript.trim()) {
        stopListening()
        void processCapturedAnswer('')
      }
    }, 12000)

    startAudioRecording().catch(() => {
      // Speech recognition continues even if MediaRecorder is unavailable.
    })
  }

  async function runQuestionFlow() {
    if (!interviewId || !question?.questionText || isSubmitting) {
      return
    }

    setError('')
    setIsAnswered(false)
    setAnswer('')

    try {
      stopListening()

      if (!hasSpokenIntroRef.current) {
        hasSpokenIntroRef.current = true
        await speakText(
          `Hello ${candidateName || 'Candidate'}, welcome to your AI interview for the ${formatRole(role)} role. Let's begin.`
        )
      }

      await new Promise((resolve) => window.setTimeout(resolve, 400))
      await speakText(`Question ${currentQuestionIndex + 1}: ${question.questionText}`)
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      startListening()
    } catch {
      setVoiceState('idle')
      setError('Speech output failed. You can retry listening or type your answer manually.')
    }
  }

  async function handleSubmitAnswer(answerOverride = null) {
    const answerToSubmit = (answerOverride || answer).trim()

    if (!answerToSubmit) {
      setError('Please provide an answer before continuing.')
      return
    }

    stopListening()
    await stopAudioRecording()
    cancelSpeech()
    setIsSubmitting(true)
    isSubmittingRef.current = true
    setVoiceState('processing')
    setError('')

    try {
      const response = await submitInterviewAnswer(interviewId, question.id, answerToSubmit)
      const payload = response.data || {}

      setAnswer(answerToSubmit)
      setIsAnswered(true)

      if (payload.hasNextQuestion) {
        onAnswerSubmitted?.(payload.currentQuestionIndex, payload.status)
      } else {
        setVoiceState('speaking')
        await speakText('Thank you, your interview is completed.')
        await endInterviewById(interviewId)
        setVoiceState('completed')
        onInterviewCompleted?.()
      }
    } catch (err) {
      setVoiceState('idle')
      setError(err.message)
      setIsAnswered(false)
    } finally {
      setIsSubmitting(false)
      isSubmittingRef.current = false
    }
  }

  async function handleRetryListening() {
    if (!question?.questionText || isSubmittingRef.current) {
      return
    }

    setError('')
    stopListening()
    cancelSpeech()

    try {
      await speakText(`Question ${currentQuestionIndex + 1}: ${question.questionText}`)
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      startListening()
    } catch {
      setVoiceState('idle')
      setError('Could not replay the question. Please retry or type your answer.')
    }
  }

  async function handleSubmitClick() {
    if (voiceState === 'listening' && !isSubmittingRef.current) {
      setError('')
      stopListening()
      await processCapturedAnswer(latestAnswerRef.current)
      return
    }

    await handleSubmitAnswer()
  }

  useEffect(() => {
    latestAnswerRef.current = answer
  }, [answer])

  useEffect(() => {
    isSubmittingRef.current = isSubmitting
  }, [isSubmitting])

  useEffect(() => {
    if (!window.speechSynthesis) {
      return
    }

    const primeVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length && !selectedVoiceRef.current) {
        selectedVoiceRef.current = pickPreferredVoice(voices)
      }
    }

    primeVoices()
    window.speechSynthesis.addEventListener('voiceschanged', primeVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', primeVoices)
      stopListening()
      void stopAudioRecording()
      cancelSpeech()
    }
  }, [])

  useEffect(() => {
    if (!question?.id || lastQuestionIdRef.current === question.id) {
      return
    }

    lastQuestionIdRef.current = question.id
    runQuestionFlow()
  }, [question?.id, interviewId])

  const statusHeading =
    voiceState === 'speaking'
      ? 'Interviewer is speaking'
      : voiceState === 'listening'
        ? 'Interviewer is listening'
        : voiceState === 'processing'
          ? 'Processing your answer'
          : voiceState === 'completed'
            ? 'Interview completed'
            : isAnswered
              ? 'Your Answer Recorded'
              : 'Interviewer is listening'

  return (
    <section className="interview-workspace">
      <div className="ai-visual-wrap">
        <div className="ai-visual-core ai-pulse">
          <div className="ai-visual-inner">
            <VisualBars />
          </div>
        </div>
        <div className="ai-environment-glow" />
      </div>

      <div className="question-block">
        <h2>{statusHeading}</h2>
        <h1>{question?.questionText || 'Loading question...'}</h1>
      </div>

      <div className="interaction-zone">
        <div className="interaction-card">
          <VisualBars large />
          <div className="interaction-divider" />
          
          {!isAnswered ? (
            <div className="answer-input-section">
              <textarea
                className="answer-textarea"
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isSubmitting || isTranscribing || voiceState === 'speaking'}
                rows={6}
              />
              {error && <div className="answer-error">{error}</div>}
              <button
                className="submit-answer-btn"
                onClick={handleSubmitClick}
                disabled={isSubmitting || isTranscribing || (!answer.trim() && voiceState !== 'listening') || !question?.id}
              >
                {isSubmitting || isTranscribing ? 'Processing...' : 'Submit Answer'}
              </button>
              <button
                className="next-question-btn"
                onClick={handleRetryListening}
                disabled={isSubmitting || isTranscribing || voiceState === 'speaking'}
              >
                Retry Listening
              </button>
            </div>
          ) : (
            <div className="answer-submitted-section">
              <div className="submitted-message">
                <span className="material-symbols-outlined">check_circle</span>
                <p>{currentQuestionIndex + 1 >= totalQuestions ? 'Final answer recorded' : 'Your answer has been recorded'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default InterviewWorkspace
