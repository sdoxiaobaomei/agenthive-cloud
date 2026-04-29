import { useState } from 'react'

function App() {
  const [message] = useState('Hello React!')
  return <h1>{message}</h1>
}

export default App
