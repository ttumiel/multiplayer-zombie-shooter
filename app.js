// reads in our .env file and makes those values available as environment variables
require('dotenv').config();
const express = require('express');

// create an instance of an express app
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);

const players = {};
var allEnemies = [];
let numPlayers = 0;

const w = 480;
const h = 480;
const validEnemyStart = [
  [0, 0],
  [0, h],
  [w, 0],
  [w, h],
  [w / 2, 0],
  [w / 2, h],
  [w, h / 2]
];

function getValidPosition(){
  return validEnemyStart[Math.floor(Math.random()*validEnemyStart.length)];
}

function generateZombies(numEnemies){
  let enemies = [];
  const num = (numPlayers-1)*3;
  for (let i=0;i<numEnemies;i++){
    let [x,y] = getValidPosition();
    enemies.push({
      id: num + i,
      x: x,
      y: y
    });
  }
  return enemies;
}

io.on('connection', function (socket) {
  console.log('a user connected: ', socket.id);
  numPlayers += 1;
  // create a new player and add it to our players object
  players[socket.id] = {
    flipX: false,
    x: Math.floor(Math.random() * w),
    y: Math.floor(Math.random() * h),
    playerId: socket.id
  };
  // send the players object to the new player
  socket.emit('currentPlayers', players);
  // update all other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Check enemy list
  // if (enemies.length === 0){
  let newEnemies = generateZombies(3);
  // }

  socket.broadcast.emit('enemies', newEnemies);

  // when a player disconnects, remove them from our players object
  socket.on('disconnect', function () {
    console.log('user disconnected: ', socket.id);
    delete players[socket.id];
    numPlayers -= 1;
    // for(i=0;i<3;i++)
    //   enemies.pop()
    // emit a message to all players to remove this player
    io.emit('disconnect', socket.id);
  });

  // when a player moves, update the player data
  socket.on('playerMovement', function (movementData) {
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;
    players[socket.id].flipX = movementData.flipX;
    // emit a message to all players about the player that moved
    socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  // When receiving bullet info, emit to all players
  socket.on('bulletShot', function (bulletInfo) {
    // emit a message to all players about the new bullet
    socket.broadcast.emit('bulletShot', {playerId: socket.id, bulletInfo: bulletInfo});
  });

  // When an enemy dies, spawn another 2
  socket.on('enemyKilled', ()=>{
    console.log("enemykilled");
    let numz = 1 + Math.round(Math.random());
    let newz = generateZombies(numz);
    socket.broadcast.emit('enemies', newz);
    socket.emit('enemies', newz);
  });

  // When the client is set up, send them all the current enemies
  socket.on('setup', ()=>{
    socket.emit('enemies', newEnemies);
  });
});

app.get('/game.html', function (req, res) {
  res.sendFile(__dirname + '/public/game.html');
});

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

// catch all other routes
app.use((req, res, next) => {
  res.status(404).json({ message: '404 - Not Found' });
});

// handle errors
app.use((err, req, res, next) => {
  console.log(err.message);
  res.status(err.status || 500).json({ error: err.message });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${process.env.PORT || 3000}`);
});
