import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import './App.css'

function App() {
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [response, setResponse] = useState('')
  const [sentimentData, setSentimentData] = useState([
    { time: '0s', sentiment: 0.5 },
    { time: '3s', sentiment: 0.45 },
    { time: '6s', sentiment: 0.52 },
    { time: '9s', sentiment: 0.48 },
    { time: '12s', sentiment: 0.55 },
  ])

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const countRef = useRef(0)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/analyze'

  // Start listening to microphone
  const startListening = async () => {
    try {
      setError('')
      setResponse('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.start()
      setIsListening(true)
      setStatus('Listening...')

      // Send audio every 3 seconds
      intervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length > 0) {
          await sendAudioToApi()
        }
      }, 3000)
    } catch (err) {
      setError(`Error accessing microphone: ${err.message}`)
      setStatus('idle')
    }
  }

  // Stop listening
  const stopListening = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    setIsListening(false)
    setStatus('Stopped')
  }

  // Send audio to FastAPI endpoint
  const sendAudioToApi = async () => {
    if (audioChunksRef.current.length === 0) return

    setStatus('Sending...')
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.webm')

      const res = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const data = await res.json()
      setResponse(JSON.stringify(data, null, 2))
      setStatus('Listening...')
      
      // Update sentiment data with new value (hardcoded for now)
      countRef.current += 1
      const newSentiment = Math.random() * 0.4 + 0.3 // Random value between 0.3 and 0.7
      setSentimentData(prev => [
        ...prev.slice(-4),
        { time: `${countRef.current * 3}s`, sentiment: newSentiment }
      ])
      
      // Clear chunks after sending
      audioChunksRef.current = []
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.start()
      }
    } catch (err) {
      setError(`Error sending audio: ${err.message}`)
      setStatus('Error')
    }
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="dashboard">
      <div className="container">
        <h1>Audio Sentiment Analysis Dashboard</h1>

        <div className="control-section">
          <button
            className={`btn ${isListening ? 'stop' : 'start'}`}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </button>
        </div>

        <div className="status-section">
          <div className={`status-badge ${status.toLowerCase()}`}>
            {status}
          </div>
        </div>

        {error && (
          <div className="error-section">
            <p className="error">❌ {error}</p>
          </div>
        )}

        <div className="chart-section">
          <h3>Sentiment Analysis</h3>
          <div className="sentiment-info">
            <span className="negative">😞 Negative</span>
            <span className="positive">😊 Positive</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sentimentData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12, fill: '#666' }}
              />
              <YAxis 
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                label={{ value: 'Sentiment Score', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12, fill: '#666' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                formatter={(value) => value.toFixed(2)}
              />
              <Line 
                type="monotone" 
                dataKey="sentiment" 
                stroke="#667eea" 
                dot={{ fill: '#667eea', r: 4 }}
                activeDot={{ r: 6 }}
                isAnimationActive={true}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {response && (
          <div className="response-section">
            <h3>Last Response:</h3>
            <pre>{response}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
