const remap = function(n, start1, stop1, start2, stop2) {
    return ((n-start1)/(stop1-start1))*(stop2-start2)+start2;
  };


  const PI = 3.14159265359

var Simulator = function(id, player_id, client_id, io) {
    
    this.id = id;
    this.is_server = false;
    this.host_id = player_id;
    this.client_id = -1;
    this.world = {
        width:  800,
        height: 600
    };
    this.paddles = [];
    this.ghosts = [];
    this.ball;

    this.debug_text = '';
    this.socket;
    this.io = io;

    //A local timer for precision on server and client
    this.local_time = 0.016;            //The local timer
    this._dt = new Date().getTime();    //The local timer delta
    this._dte = new Date().getTime();   //The local timer last frame time
    this.dt = 0.016;

    this.is_running = false;

    this.create_timer();

    //create associative input buffer
    this.input_buffer = [];
    this.last_input_seq_host;
    this.last_input_seq_client;

    this.fake_latency = 32;

    
}

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
    module.exports = global.Simulator = Simulator;
}


var lastTime = 0;
var frame_time = (1000/60); // run the local game at 16ms/ 60hz

Simulator.prototype.mainLoop = function() {
    let t = new Date().getTime();
    //Work out the delta time
    this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed(5) : 0.01666;

    //Store the last frame time
    this.lastframetime = t;

   

if(this.is_running) {
    this.handleInput(this.input_buffer);
    
    this.update(this.dt);
    
    setTimeout(this.mainLoop.bind(this), (t+this.dt) - new Date().getTime())
}
    
};

 
Simulator.prototype.pingingServer = function(client) {
    
    if(this.is_server) {
        if(this.fake_latency > 0) {
            setTimeout(function() {
                this.io.to('game_room'+this.id).emit('pingresponse', client);
            }.bind(this), this.fake_latency)
        }
        else {
            this.io.to('game_room'+this.id).emit('pingresponse', client);
        }
        
    }
    
    
}


Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };

Simulator.prototype.getPaddle = function(id,pos) {
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
};

Simulator.prototype.getBall = (pos) => {
  return (
    {
      radius: 10,
      velocity: 800,
      direction: {x:1, y:0},
      pos: {
        x: pos.x,
        y: pos.y
      },
      side: ''
    }
  )
};


Simulator.prototype.start = function( host_id ,client_id) {
   
    this.is_running = true;

    this.host_id = host_id;
    this.client_id = client_id;
    this.paddles[host_id] = this.getPaddle(host_id, {x:this.world.width/8, y:this.world.height/2});
    this.paddles[client_id] = this.getPaddle(client_id, {x:this.world.width - (this.world.width/8), y:this.world.height/2});
    this.ghosts[host_id] = this.getPaddle(host_id, {x:this.world.width/8, y:this.world.height/2});
    this.ghosts[client_id] = this.getPaddle(client_id, {x:this.world.width - (this.world.width/8), y:this.world.height/2});

    this.ball = this.getBall({x:this.world.width/2, y:this.world.height/2});

    if (typeof global !== 'undefined') {
        
        this._serverIntervalId = setInterval(this.send_state.bind(this), 16); 
        this.is_server = true;
    }
    else {
        //window.requestAnimationFrame( this.mainLoop.bind(this), this.viewport );
    }

    // call to mainLoop to start looping
    this.mainLoop();

    this.input_buffer = [];
    let sim_type =  this.is_server ? 'Server' : 'Client';
    console.log(sim_type, ' simulation: ',this.id, ' started.');
};


Simulator.prototype.stop = function( ) { 
   
    this.is_running = false;

    console.log('Server simulation: ', this.id, '  stopped.')
    clearInterval(this._serverIntervalId);

}

Simulator.prototype.handleKeyPress = function(input) {
    //if(this.paddles.length == 0) return;
    this.input_buffer.push( input );
 
};

Simulator.prototype.handleKeyReleased = function(input) {
    
    this.input_buffer = this.input_buffer.filter((the_input) => {
        return the_input.d == input.id && the_input.keyCode == input.keyCode;
    })

};

Simulator.prototype.handleInput = function(input_buffer) {
    if(!this.paddles) return;
   
    let new_host_direction = 0;
    let new_client_direction = 0;

    if(input_buffer.length > 0) {
        for (let i = 0; i < input_buffer.length; i++) {
            let id = input_buffer[i].id;
            let keycode = input_buffer[i].keyCode;
            let new_direction = 0;
            switch(keycode) {
                case 38:
                    new_direction = -1;
                    break;
                case 40:
                    new_direction = 1;
                    break
            }
            
            if (id == this.host_id) new_host_direction = new_direction;
            if (id == this.client_id) new_client_direction = new_direction; 

            
        }
    }

    this.paddles[this.host_id].direction = new_host_direction;
    this.paddles[this.client_id].direction = new_client_direction;

    // pressed:
    
}

Simulator.prototype.send_state = function(dt) { 
    
    if(typeof this.io !== 'undefined') {

        let  server_state = {
            time: 0,
            paddles: {},
            ball: {}
        };  // <- initialize an object, not an array

        server_state.paddles[this.host_id]   = this.paddles[this.host_id];
        server_state.paddles[this.client_id] = this.paddles[this.client_id];
        
        server_state.ball = this.ball;
        
        server_state.time = new Date().getTime().fixed(4);



        let state = JSON.stringify(server_state); // "{"a":"The letter A"}"
        
        if(this.fake_latency > 0) {
            let to = setTimeout (() => {
                this.io.to('game_room'+this.id).emit('serverupdate', server_state);
            },this.fake_latency)
        }
        else {
            this.io.to('game_room'+this.id).emit('serverupdate', server_state);
        }
        
       
        
    }
}


Simulator.prototype.solvePaddle = function(paddle, dt) {
    let acc = paddle.acceleration * paddle.direction;

    acc -= paddle.velocity.y * 10;

    paddle.old_pos.x = paddle.pos.x;
    paddle.old_pos.y = paddle.pos.y;

    paddle.velocity.y = paddle.velocity.y + acc * dt;
    let vel = paddle.velocity.y;
    paddle.pos.y = this.solvePosition(paddle.pos.y, vel, acc, dt).fixed(4);
    
    paddle = this.checkPaddleOOB(paddle, this.world);
    
    return paddle;
}

Simulator.prototype.update = function(dt) {

    // do it, do it, do it four times
    let steps = 1;
    dt /= steps;

    while(steps > 0) {
        this.paddles[this.host_id]   = this.solvePaddle(this.paddles[this.host_id], dt);
        this.paddles[this.client_id] = this.solvePaddle(this.paddles[this.client_id], dt);

        if (this.is_server) {
            let ballDT = this.getDeltaTimeForBall(this.paddles);
            this.ball = this.moveBall(this.ball.direction, this.ball, dt);
            this.ball = this.checkBallWalls(this.ball, this.world, dt);
            this.ball = this.checkBallPaddlesCollision(this.paddles, this.ball, dt);
        }
        

        steps--;
    }
};

Simulator.prototype.getDeltaTimeForBall = function(paddles) {
    
    const getDeltaPos = (paddle) => {
        return Math.abs(paddle.pos.y - paddle.old_pos.y);
    }
  
 
    let result = paddles.map((paddle) => {
        return getDeltaPos(paddle);
    });
    
   
    
    let total = result[0] + result[1];
    
    return total / 800;
}


Simulator.prototype.solvePosition = function(pos, vel, acc, dt)  {
    return pos + vel * dt + ((acc * (dt*dt)) / 2);
};


Simulator.prototype.checkPaddleOOB = function(paddle, world) {
    let height = world.height;
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
/*
Simulator.prototype.checkBallWalls = function(ball, world) { 
    let newBall = ball;

    if(newBall.pos.y < newBall.radius/2 || newBall.pos.y > world.height - newBall.radius/2) {
        newBall.direction.y *= -1;
    }

    if(newBall.pos.x < newBall.radius/2 || newBall.pos.x > world.width - newBall.radius/2) {
        newBall.direction.x *= -1;
    }

    return newBall;
}
*/
Simulator.prototype.moveBall = function (direction, ball, dt) {
    let newBall = ball;
    
    newBall.direction = direction;
    newBall.pos.x = newBall.pos.x + newBall.velocity * direction.x * dt;
    newBall.pos.y = newBall.pos.y + newBall.velocity * direction.y * dt;
    
    return newBall;
  }
  

Simulator.prototype.overlap = function(paddle, ball) {
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
  
  
Simulator.prototype.checkBallPaddlesCollision = function (paddles, ball, dt) {
    let newBall = ball;
    
    const getBounceDirection = (paddle, ball) => {
    // map output dir to where paddle is hitExternal

        const fromAngle = (angle, length) => {
            if (typeof length === 'undefined') {
                length = 1;
            }
            return {x: length * Math.cos(angle), y:length * Math.sin(angle) };
        };
        
        let ball_y = ball.pos.y;
        let padd_y = paddle.pos.y;
        let lim = 0.5 * paddle.h;
        
        let paddleLerp = remap(ball_y, padd_y - lim, padd_y + lim, -1,1);
        let v = fromAngle(0.25*PI * paddleLerp);
        
        v.x = paddle.pos.x > 0.5 * this.world.width ? v.x *-1 : v.x;
        
        return v;
        
    }
    
      

        let result = this.solveBallPaddleCollision(newBall, paddles[this.client_id], dt);
        newBall = result.newBall;

  
        if (result.haveCollided){
            let newDir = getBounceDirection(paddles[this.client_id], newBall);
            newBall.direction = newDir;
        }

        let result_b = this.solveBallPaddleCollision(newBall, paddles[this.host_id], dt);
        newBall = result_b.newBall;
  
        if (result_b.haveCollided){
            let newDir = getBounceDirection(paddles[this.host_id], newBall);
            newBall.direction = newDir;
        }
  
    return newBall;
  }


Simulator.prototype.resetBallLeft = function(ball, dt) {
    ball.pos = {x:0.75*this.world.width, y:this.world.height/2};
    ball.direction = {x: -1, y:0};
    return ball;
}
  
Simulator.prototype.resetBallRight = function(ball, dt) {
    ball.pos = {x:0.25*this.world.width, y:this.world.height/2};
    ball.direction = {x:1, y:0};
    return ball;
}


Simulator.prototype.checkBallWalls = function(ball, world, dt) {
    let newBall = ball;
    
    
    if ( (newBall.pos.y - 0.5 * newBall.radius) <= 0 ) {
      newBall.direction.y *= -1;
      
      //nudge
      newBall.pos.y = newBall.radius;
    }
       
    if ( (newBall.pos.y + 0.5 * newBall.radius) > world.height ) {
      newBall.direction.y *= -1;
      
      newBall.pos.y = world.height - newBall.radius;
    }
    
    const sidedBall = (ball) => {
      let newBall = ball;
      let range = 100;
      if (newBall.pos.x < -range) {
        newBall = this.resetBallLeft(newBall, dt);
    
      }
      else if (newBall.pos.x > world.width + range) {
        newBall = this.resetBallRight(newBall, dt);
    
      }
      
      return newBall;
    } 
    newBall = sidedBall(newBall);
    return newBall ;
    
  }
  
  function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj))
 }

Simulator.prototype.solveBallPaddleCollision = function(ball, paddle, dt) {

    

    const mult = (v, n) => {
        if (!(typeof n === 'number' && isFinite(n))) {
          console.warn(
            'p5.Vector.prototype.mult:',
            'n is undefined or not a finite number'
          );
          return v;
        }
        v.x *= n;
        v.y *= n;
        v.z *= n;
        return v;
      };
    
      const mag = (vecT) => {
        const x = vecT.x,
          y = vecT.y,
          z = vecT.z || 0;
        const magSq = x * x + y * y + z * z;
        return Math.sqrt(magSq);
      };
    
     const normalize_vector = (v) => {
        const len = mag(v);
        // here we multiply by the reciprocal instead of calling 'div()'
        // since div duplicates this zero check.
        if (len !== 0) v = mult(v , 1 / len);
        return v;
      };


    let haveCollided = false;
    let newBall = cloneObject(ball);
    let newPaddle = cloneObject(paddle);
    let origDir_x = newBall.direction.x;
    let origDir_y = newBall.direction.y;
    let count = 0;
    
     

    while( this.overlap(newPaddle, newBall ) ) {
      let dir = { x:origDir_x * -1, y:origDir_y *-1};
      //dir = normalize_vector(dir);
      let newPos = newBall.pos;
      newPos.x = newPos.x + ((newBall.velocity + 10) * dir.x * dt);
      newPos.y = newPos.y + ((newBall.velocity + 10) * dir.y * dt);
      
      newBall.pos.x = newPos.x;
      newBall.pos.y = newPos.y;
      
      haveCollided = true;

    console.log(newBall.pos.x, ' . ', paddle.id, ' . ', paddle.pos.x)
    }
    
    return {newBall, haveCollided};
  }
  
  

Simulator.prototype.create_timer = function(){
    setInterval(function(){
        this._dt = new Date().getTime() - this._dte;
        this._dte = new Date().getTime();
        this.local_time += this._dt/1000.0;
    }.bind(this), 4);
}
