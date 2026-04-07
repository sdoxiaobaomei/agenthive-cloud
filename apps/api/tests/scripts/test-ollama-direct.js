// Direct Ollama test without database
const OLLAMA_URL = 'http://localhost:11434';
const MODEL = 'qwen3:14b';

async function testOllamaDirect() {
  console.log('🧪 Testing Ollama Direct Integration\n');
  console.log('Model:', MODEL);
  console.log('URL:', OLLAMA_URL);
  console.log('');
  
  // 1. Check Ollama connection
  console.log('1. Checking Ollama connection...');
  try {
    const tagsResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    const tags = await tagsResponse.json();
    console.log('✅ Ollama is running');
    console.log('Available models:', tags.models.map(m => m.name).join(', '));
  } catch (error) {
    console.error('❌ Failed to connect to Ollama:', error.message);
    return;
  }
  
  // 2. Test simple completion
  console.log('\n2. Testing simple completion...');
  const prompt = 'Say hello and introduce yourself in one sentence.';
  console.log('Prompt:', prompt);
  console.log('Streaming response:\n');
  
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              process.stdout.write(data.message.content);
              fullResponse += data.message.content;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    console.log('\n\n✅ Response complete!');
    console.log('\nFull response length:', fullResponse.length, 'characters');
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
  }
}

testOllamaDirect().catch(console.error);
