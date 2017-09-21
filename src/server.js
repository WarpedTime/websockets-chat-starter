const http = require('http'); // pull in the http server module
const fs = require('fs');
const socketio = require('socket.io');

const index = fs.readFileSync(`${__dirname}/../client/client.html`);
const port = process.env.PORT || process.env.NODE_PORT || 3000;


const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

// create server and pass to socketio
const app = http.createServer(onRequest).listen(port);
console.log(`Listening on 127.0.0.1: ${port}`);
const io = socketio(app);

const users = {};

const getActiveUsers = () => {
  let activeUsers = 'Active Users: ';
  const keys = Object.keys(users);
  for (let i = 0; i < keys.length; i++) {
    if (users[keys[i]] && users[keys[i]].active) {
      activeUsers += `[${keys[i]}] `;
    }
  }
  return activeUsers;
};


const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    // sen message to new user

    // prevent from loggin in if username is logged in
    if (users[data.name] && users[data.name].active === true) {
      const errMsg = {
        name: 'server',
        msg: `Cannot join room, username[${data.name}] is already active`,
      };
      socket.emit('msg', errMsg);

      return;
    }
    users[data.name] = data;
    users[data.name].active = true;
    console.dir(users);

    // get num active users
    let numUsers = 0;
    const keys = Object.keys(users);
    for (let i = 0; i < keys.length; i++) {
      if (users[keys[i]] && users[keys[i]].active) {
        numUsers += 1;
      }
    }

    const joinMsg = {
      name: 'server',
      msg: `There are ${numUsers} users online.`,
    };

    // send user number of active members
    socket.name = data.name;
    socket.emit('msg', joinMsg);

    socket.join('room1'); // add to room

    // broadcast to others in room
    const response = {
      name: 'server',
      msg: `${data.name} has joined the room.`,
    };
    socket.broadcast.to('room1').emit('msg', response);

    console.log(`${data.name} joined`);
    // success message
    socket.emit('msg', { name: 'server', msg: 'You joined the room' });
  });
};

const onMsg = (sock) => {
  const socket = sock;

  socket.on('msgAtServer', (data) => {
    // pm
    const keys = Object.keys(users);
    for (let i = 0; i < keys.length; i++) {
      if (users[keys[i]]) {
        if (users[keys[i]].active && data.msg.startsWith(`@${keys[i]} `)) {
          io.sockets.in('room1').emit('msg', { name: socket.name, msg: data.msg, PM: keys[i] });
          socket.emit('msg', { name: socket.name, msg: data.msg, PM: socket.name });

          // console.log(user);
          return;
        } else if (data.msg === '@server listActive') {
          socket.emit('msg', { name: 'server', msg: getActiveUsers() });
          return;
        }
      }
    }

    io.sockets.in('room1').emit('msg', { name: socket.name, msg: data.msg });
    // console.log('recieved message');
    // socket.broadcast.to('room1').emit('msg', data);
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    // leave server
    const tempUser = users[socket.name];
    if (tempUser)tempUser.active = true;
    else return;

    const response = {
      name: 'server',
      msg: `${tempUser.name} has Left the room.`,
    };

    // set user as inactive
    users[tempUser.name].active = false;
    io.sockets.in('room1').to('room1').emit('msg', response);

    // console.log('left');
    // remove from room
    socket.leave('room1');
  });
};

io.sockets.on('connection', (socket) => {
  console.log('started');

  onJoined(socket);
  onMsg(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');

