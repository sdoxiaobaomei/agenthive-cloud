// Verify all new modules can be imported without syntax errors
import '../src/app.js'
import '../src/chat-controller/types.js'
import '../src/chat-controller/service.js'
import '../src/chat-controller/controller.js'
import '../src/chat-controller/routes.js'
import '../src/chat-controller/websocket.js'
import '../src/project/types.js'
import '../src/project/service.js'
import '../src/project/controller.js'
import '../src/project/routes.js'

console.log('[CheckImports] All modules imported successfully!')
