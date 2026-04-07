// Simple test script for hello world task
const API_URL = 'http://localhost:3005';

async function testHelloWorld() {
  console.log('Testing Hello World task...\n');
  
  // 1. Check health
  console.log('1. Checking API health...');
  const health = await fetch(`${API_URL}/api/health`);
  console.log('Health:', await health.json());
  
  // 2. Create task with detailed error logging
  console.log('\n2. Creating task...');
  const requestBody = {
    title: 'Hello World Test',
    description: 'Say hello and introduce yourself in one sentence',
    type: 'code_analysis'
  };
  console.log('Request body:', JSON.stringify(requestBody));
  
  try {
    const createResponse = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const responseText = await createResponse.text();
    console.log('Response status:', createResponse.status);
    console.log('Response body:', responseText);
    
    let task;
    try {
      task = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON:', e.message);
      return;
    }
    
    if (!task.success) {
      console.error('Task creation failed:', task.error);
      return;
    }
    
    console.log('Task created:', JSON.stringify(task.data, null, 2));
    const taskId = task.data.id;
    
    // 3. Execute task
    console.log('\n3. Executing task...');
    const execResponse = await fetch(`${API_URL}/api/tasks/${taskId}/execute`, {
      method: 'POST'
    });
    
    const execResult = await execResponse.json();
    console.log('Execute response:', JSON.stringify(execResult, null, 2));
    
    // 4. Poll for progress
    console.log('\n4. Checking progress (polling 10 times, 3s interval)...');
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      
      const progressResponse = await fetch(`${API_URL}/api/tasks/${taskId}/progress`);
      const progress = await progressResponse.json();
      
      console.log(`\nPoll ${i + 1}:`);
      console.log('  Status:', progress.data?.status);
      console.log('  Progress:', (progress.data?.progress || 0) + '%');
      if (progress.data?.error) {
        console.log('  Error:', progress.data.error);
      }
      
      if (progress.data?.status === 'completed' || progress.data?.status === 'failed') {
        console.log('\n✅ Final result:', JSON.stringify(progress.data, null, 2));
        
        // Show the LLM output if available
        if (progress.data?.result?.output?.content) {
          console.log('\n📝 LLM Response:');
          console.log(progress.data.result.output.content);
        }
        break;
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testHelloWorld().catch(console.error);
