import { Server } from 'socket.io'

const visitorRooms = new Map<string, { joinedAt: number }>()
const VISITOR_TIMEOUT = 1000 * 60 * 10 // 10 minutes

export function createHub(io: Server) {
  io.on('connection', (socket) => {
    const isVisitor = !socket.handshake.auth.token
    const roomId = isVisitor ? `visitor-${socket.id}` : `user-${socket.handshake.auth.userId}`

    if (isVisitor) {
      visitorRooms.set(socket.id, { joinedAt: Date.now() })
      socket.join('demo-broadcast')
      socket.emit('mode', 'visitor')

      // Read-only: visitors cannot emit commands
      socket.on('command', () => {
        socket.emit('error', { message: 'Please sign in to send commands' })
      })

      // Timeout cleanup
      setTimeout(() => {
        socket.disconnect(true)
      }, VISITOR_TIMEOUT)
    } else {
      socket.join(roomId)
      socket.emit('mode', 'authenticated')
    }

    socket.on('disconnect', () => {
      visitorRooms.delete(socket.id)
    })
  })
}
