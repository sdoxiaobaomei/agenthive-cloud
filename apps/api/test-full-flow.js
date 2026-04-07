// Full flow test with in-memory task storage
const API_URL = 'http://localhost:3003';
const OLLAMA_URL = 'http://localhost:11434';
const MODEL = 'qwen3:14b';

// In-memory task store
const tasks = new Map();
let taskIdCounter = 1;

async function testFullFlow() {
  console.log('🚀 Testing Full Flow with Ollama\n');
  
  // 1. Create task in memory
  console.log('1. Creating task...');
  const task = {
    id: `task-${taskIdCounter++}`,
    title: 'Hello World Test',
    description: 'Say hello and introduce yourself in one sentence',
    type: 'code_analysis',
    status: 'running',
    progress: 0,
    createdAt: new Date(),
    startedAt: new Date(),
  };
  tasks.set(task.id, task);
  console.log(`✅ Task created: ${task.id}`);
  
  // 2. Execute with Ollama
  console.log('\n2. Executing with Ollama...');
  console.log('Sending prompt to qwen3:14b...\n');
  
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful AI assistant. Be concise and friendly.' 
          },
          { 
            role: 'user', 
            content: task.description 
          }
        ],
        stream: true,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    console.log('📝 LLM Response:');
    console.log('─'.repeat(50));
    
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
              fullContent += data.message.content;
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    }
    
    console.log('\n' + '─'.repeat(50));
    
    // 3. Update task with result
    task.status = 'completed';
    task.progress = 100;
    task.completedAt = new Date();
    task.result = {
      content: fullContent,
      length: fullContent.length,
    };
    
    console.log('\n✅ Task completed!');
    console.log('\n📊 Summary:');
    console.log(`  Task ID: ${task.id}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Response length: ${fullContent.length} chars`);
    console.log(`  Duration: ${task.completedAt - task.startedAt}ms`);
    
  } catch (error) {
    console.error('\n❌ Execution failed:', error.message);
    task.status = 'failed';
    task.error = error.message;
  }
  
  // 4. Display final task state
  console.log('\n📋 Final Task State:');
  console.log(JSON.stringify(task, null, 2));
}

testFullFlow().catch(console.error);
