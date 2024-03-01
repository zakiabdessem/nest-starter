const socket = io();

socket.on('connect', () => {
  console.log('Connected to the server');
  socket.emit('joinRoom', 'defaultRoom');
});

socket.on('notification-fire', (data) => {
  console.log('Notification received:', data);
});
