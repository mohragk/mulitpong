let socket;
let screenText = '';
let noteText = '';
let players = [];
let player_id;
let game_id;
let state = 'idle';
let ball;

const getPaddle = (id, pos) => {
  return (
    {
      id: id,
      w: 10, 
      h: 100, 
      pos: {
        x: pos.x, 
        y: pos.y
      } ,

      old_pos: {
        x: pos.x, 
        y: pos.y
      } ,
      direction: 0,
      velocity: {x:0, y:0},
      acceleration: 7000,
      score: 0
    }
  )
} ;

const getBall = (pos) => {
  return (
    {
      radius: 10,
      velocity: 180,
      direction: createVector(1,0),
      pos: {
        x: pos.x,
        y: pos.y
      },
      side: ''
    }
  )
};

function setup() {
  createCanvas(800,600);
 
  socket = io.connect('/');
  socket.on('waiting', showWaiting);
  socket.on('game started', initGame);
  socket.on('notification', changeNotification);

  socket.on('keypressed', handleKeyPress);
  socket.on('keyreleased', handleKeyRelease);

  socket.on('latency', measureLatency);


  socket.on('posChanged', changePosition);
  socket.on('ballPosChanged', changeBallPosition);
  state = 'idle';
  screenText = 'setup()';
}

function measureLatency(msg) {
  var now = millis();
  let diff = now - msg;
  console.log('latency: ',diff);
}

function keyPressed() {
  
  let msg = {
    id: player_id,
    keyCode: keyCode
  }
  socket.emit('keypressed', msg);

  //LATENCY
  socket.emit('latency', millis());
}

function keyReleased() {
  let msg = {
    id: player_id,
    keyCode: keyCode
  }
  socket.emit('keyreleased', msg);

  
}

function handleKeyPress(data) {
  let delta_y = 0;

  if (data.keyCode == UP_ARROW) {
    delta_y = -1;
  } else if (data.keyCode == DOWN_ARROW) {
    delta_y = 1;
  }

  
  players = players.map((paddle) => {
    if(paddle.id === data.id) {
      paddle.direction = delta_y;
    }
    return paddle;
  })

  
}

function handleKeyRelease(data) {
  let factor = 0;
  if (data.keyCode == UP_ARROW) {
    factor = 1;
  } else if (data.keyCode == DOWN_ARROW) {
    factor = -1;
  }

  
  players = players.map((paddle) => {
    if(paddle.id === data.id) {
      let old_direction = paddle.direction;
      old_direction += factor;
      paddle.direction = old_direction;
    }
    return paddle;
  })
}

function changeNotification(notification) {
  console.log(notification);
  noteText = notification.message;
}

function showWaiting(data) {
  screenText = data+': Waiting for other players';
  player_id = data;
}

function initGame(playerIds) {
  
  
  players[0] = getPaddle(playerIds.p1, {x: width/8, y:height/2});
  players[1] = getPaddle(playerIds.p2, {x: width - (width/8), y:height/2});

  game_id = playerIds.game_id;

  ball = getBall({x:width/2, y:height/2});
  state = 'running';

  screenText = game_id.toString();
}

// player 0 is always master, must change later
function isMaster() {
  return player_id === players[0].id;
}

function changePosition(data) {
 
  players = players.map((paddle) => {
   
    if(paddle.id === data.id) {
     paddle.pos.y = data.pos;
    }
    return paddle;
  });
}

function changeBallPosition(data) {
  ball.pos.x = data.pos.x;
  ball.pos.y = data.pos.y;
}



const solvePosition = (pos, vel, acc, dt) => {
  return pos + vel * dt + ((acc * (dt*dt)) / 2);
}



const moveY = (obj, dt, acc) => {
  let newObj = obj;
    
  newObj.old_pos.y = newObj.pos.y;

  acc -= newObj.velocity.y * 10;
  
  newObj.velocity.y = newObj.velocity.y + acc * dt;
  let vel = newObj.velocity.y;
  let pos = newObj.pos.y;
  newObj.pos.y = solvePosition(pos, vel, acc, dt);
  
  
  return newObj;

}

const moveBall = (direction, ball, dt) => {
  let newBall = ball;
  
  newBall.direction = direction;
  newBall.pos.x = newBall.pos.x + newBall.velocity * direction.x * dt;
  newBall.pos.y = newBall.pos.y + newBall.velocity * direction.y * dt;

  checkBallWalls(ball);
  
  let msg = {
    pos: newBall.pos
  }
  socket.emit('ballPosChanged', msg);
}

const checkBallWalls = (ball) => {
  
  if ( (ball.pos.y - 0.5 * ball.radius) <= 0 ) {
    ball.direction.y *= -1;
    
    //nudge
    ball.pos.y = ball.radius;
  }
     
  if ( (ball.pos.y + 0.5 * ball.radius) > height ) {
    ball.direction.y *= -1;
    
    ball.pos.y = height - ball.radius;
  }
  
  const sidedBall = (ball) => {
    let newBall = ball;
    let range = 100;
    if (newBall.pos.x < -range) {
      banewBallll = leftBall(ball);
      newAudio = playToneScore(audio, 24);
    }
    else if (newBall.pos.x > width + range) {
      newBall = rightBall(ball);
      newAudio = playToneScore(audio, 20);
    }
    
    return newBall;
  } 

}

const overlap = (paddle, ball) => {
  let test = false;
  let newBall = ball;
  let newPaddle = paddle;
   
  if (  newBall.pos.x - (0.5*newBall.radius) < newPaddle.pos.x + (0.5*newPaddle.w) &&
        newBall.pos.x + (0.5*newBall.radius) > newPaddle.pos.x - (0.5*newPaddle.w) ) 
  {
    if (  newBall.pos.y + (0.5*newBall.radius) > newPaddle.pos.y - (0.5*newPaddle.h) &&
          newBall.pos.y - (0.5*newBall.radius) < newPaddle.pos.y + (0.5*newPaddle.h) )
    {
        test = true;
    }
  }
  
  
  return test;
}

const solveBallPaddleCollision = (ball, paddle, dt) => {
  let haveCollided = false;
 
  let origDir_x = ball.direction.x;
  let origDir_y = ball.direction.y;
  let count = 0;
  
  while( overlap(paddle, ball ) ) {
    let dir = createVector(origDir_x * -1, origDir_y *-1);
    dir.normalize();
    let newPos = ball.pos;
    newPos.x = newPos.x + ((ball.velocity + 100) * dir.x * dt);
    newPos.y = newPos.y + ((ball.velocity + 100) * dir.y * dt);
    
    ball.pos = newPos;
    
    haveCollided = true;
  }
  
  return {ball, haveCollided};
}


const checkBallPaddlesCollision = (paddles, ball, dt) => {
  
  const getBounceDirection = (paddle, ball) => {
    // map output dir to where paddle is hitExternal
    
    let ball_y = ball.pos.y;
    let padd_y = paddle.pos.y;
    let lim = 0.5 * paddle.h;
    
    let paddleLerp = map(ball_y, padd_y - lim, padd_y + lim, -1,1);
    let v = p5.Vector.fromAngle(0.25*PI * paddleLerp);
    
    v.x = paddle.pos.x > 0.5 * width ? v.x *-1 : v.x;
    
    return v;
    
  }

  paddles.map((paddle) => {
    
    let result = solveBallPaddleCollision(ball, paddle, dt);
    ball = result.ball;
    
    if (result.haveCollided){
      let newDir = getBounceDirection(paddle, ball);
      moveBall(newDir, ball, dt);
    }
    
  });

  
}

const movePaddles = (paddles, dt) => {
  paddles.map((paddle) => {
    let newPaddle = moveY(paddle, dt, paddle.direction * paddle.acceleration);
    newPaddle = checkPaddleOOB(newPaddle);
    let msg = {
      id: newPaddle.id,
      pos: newPaddle.pos.y
    }
    socket.emit('posChanged', msg);
  });
}

const checkPaddleOOB = (paddle) => {
  let newPaddle = paddle;
  
  if ( (newPaddle.pos.y - 0.5 * newPaddle.h) <= 0) {
    newPaddle.pos.y = 0.5 * newPaddle.h;
   newPaddle.old_pos.y = 0.5 * newPaddle.h;
    
  } else if ((newPaddle.pos.y + 0.5 * newPaddle.h) > height){
    newPaddle.pos.y = height - 0.5 * newPaddle.h;
    newPaddle.old_pos.y = height - 0.5 * newPaddle.h;
  }

  return newPaddle;
}

const getDeltaTimeForBall = (paddles) => {

  const getDeltaPos = (paddle) => {
    return Math.abs(paddle.pos.y - paddle.old_pos.y);
  }

  let result = paddles.map((paddle) => {
    return getDeltaPos(paddle);
  });
  
 
  let total = result[0] + result[1];
  
  return total / 800; //magic number!
}

function updateGame(dt) {  

  if (isMaster()) {
    fill(200);
    text('master', 40, height - 20);
    movePaddles(players,dt);

    let ballDT = getDeltaTimeForBall(players);
    moveBall(ball.direction, ball, ballDT);
    checkBallPaddlesCollision(players, ball, dt);
  }
  
}

function renderObjects() {
  players.map((paddle) => {
    fill(255);
    rectMode(CENTER);
    rect(paddle.pos.x, paddle.pos.y, paddle.w, paddle.h);
  });

  rect(ball.pos.x, ball.pos.y, ball.radius, ball.radius);
}

function draw() {
  background(12);

  fill(255);
  textAlign(CENTER);
  text(screenText, width/2, height/2);
  text(noteText, width/2, height - 30);

  
  
  if(state === 'running') {
    updateGame(deltaTime/1000);
    renderObjects();
  } 
}