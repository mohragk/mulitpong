


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

    this.debug_text = '';
    this.socket;
    this.io = io;

    //A local timer for precision on server and client
    this.local_time = 0.016;            //The local timer
    this._dt = new Date().getTime();    //The local timer delta
    this._dte = new Date().getTime();   //The local timer last frame time
    this.dt = 0.016;

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

    this.handleInput(this.input_buffer);
    
    this.update(this.dt);


    setTimeout(this.mainLoop.bind(this), (t+this.dt) - new Date().getTime())
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
/*


*/
Simulator.prototype.start = function(host_id, client_id) {
   
    this.host_id = host_id;
    this.client_id = client_id;
    this.paddles[host_id] = this.getPaddle(host_id, {x:this.world.width/8, y:this.world.height/2});
    this.paddles[client_id] = this.getPaddle(client_id, {x:this.world.width - (this.world.width/8), y:this.world.height/2});
    this.ghosts[host_id] = this.getPaddle(host_id, {x:this.world.width/8, y:this.world.height/2});
    this.ghosts[client_id] = this.getPaddle(client_id, {x:this.world.width - (this.world.width/8), y:this.world.height/2});
    if (typeof global !== 'undefined') {
        
        this._serverIntervalId = setInterval(this.send_state.bind(this), 16); 
        this.is_server = true;
    }
    else {
        //window.requestAnimationFrame( this.mainLoop.bind(this), this.viewport );
    }

    // call to mainLoop to start looping
    this.mainLoop();


    this.last_input_seq_host = 0;
    this.last_input_seq_client = 0;
    this.input_buffer = [];
    let sim_type =  this.is_server ? 'Server' : 'Client';
    console.log(sim_type, ' simulation: ',this.id, ' started.');
};

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
        };  // <- initialize an object, not an array

        server_state.paddles[this.host_id]   = this.paddles[this.host_id];
        server_state.paddles[this.client_id] = this.paddles[this.client_id];
        
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

    paddle.velocity.y = paddle.velocity.y + acc * dt;
    let vel = paddle.velocity.y;
    paddle.pos.y = this.solvePosition(paddle.pos.y, vel, acc, dt).fixed(4);
    
    paddle = this.checkPaddleOOB(paddle, this.world);
    
    return paddle;
}

Simulator.prototype.update = function(dt) {

    // do it, do it, do it four times
    let steps = 4;
    dt /= steps;

    while(steps > 0) {
        this.paddles[this.host_id]   = this.solvePaddle(this.paddles[this.host_id], dt);
        this.paddles[this.client_id] = this.solvePaddle(this.paddles[this.client_id], dt);
        steps--;
    }
};

Simulator.prototype.solvePosition = (pos, vel, acc, dt) => {
    return pos + vel * dt + ((acc * (dt*dt)) / 2);
};


Simulator.prototype.checkPaddleOOB = (paddle, world) => {
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



Simulator.prototype.create_timer = function(){
    setInterval(function(){
        this._dt = new Date().getTime() - this._dte;
        this._dte = new Date().getTime();
        this.local_time += this._dt/1000.0;
    }.bind(this), 4);
}
