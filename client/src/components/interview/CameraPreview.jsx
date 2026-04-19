import { useEffect, useRef } from 'react'

function CameraPreview({ mediaStream, inline = false }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream
    }
  }, [mediaStream])

  if (inline) {
    // For use in the right-side panel
    return (
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          borderRadius: '8px',
          backgroundColor: '#000'
        }}
      />
    )
  }

  // Original corner preview (floating)
  if (!mediaStream) {
    return null
  }

  return (
    <div className="camera-preview">
      <div className="camera-preview-label">Your Camera</div>
      <video ref={videoRef} autoPlay muted playsInline />
    </div>
  )
}

export default CameraPreview
