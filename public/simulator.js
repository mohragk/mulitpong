/*
( function () {

    var lastTime = 0;
    var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

    for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) {
        window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
        window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
    }

    if ( !window.requestAnimationFrame ) {
        window.requestAnimationFrame = function ( callback, element ) {
            var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
            var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if ( !window.cancelAnimationFrame ) {
        window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
    }

}() );

*/





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


    this.create_timer();
    
}

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
    module.exports = global.Simulator = Simulator;
}


var lastTime = 0;
var frame_time = 1000/60; // run the local game at 16ms/ 60hz

Simulator.prototype.mainLoop = function() {
    let t = new Date().getTime();
    //Work out the delta time
    this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed(3) : 0.016;

    //Store the last frame time
    this.lastframetime = t;
    
    this.update(this.dt);
};

 



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
        // main loop runs at different interval
        
        this._serverIntervalId = setInterval(this.send_state.bind(this), 45); 
        this.is_server = true;
    }
    else {
        //window.requestAnimationFrame( this.mainLoop.bind(this), this.viewport );
    }

    this._intervalId = setInterval(this.mainLoop.bind(this), frame_time); 

    let sim_type =  this.is_server ? 'Server' : 'Client';
    console.log(sim_type, ' simulation: ',this.id, ' started.');
};

Simulator.prototype.handleKeyPress = function(input) {
    //if(this.paddles.length == 0) return;

    if(!this.paddles) return;
   
    switch(input.keyCode) {
        case 38: //UP_ARROW
        this.paddles[input.id].direction = -1;
        break;
        case 40: //DOWN_ARROW
        this.paddles[input.id].direction = 1;
    }

    
};

Simulator.prototype.handleKeyReleased = function(input) {
    let factor = 0;
    if (input.keyCode == 38) {
        factor = 1;
    } else if (input.keyCode == 40) {
        factor = -1;
    }
    let old_direction = this.paddles[input.id].direction;
    old_direction += factor;
    this.paddles[input.id].direction = old_direction;
    

    
};

Simulator.prototype.send_state = function(dt) { 
    /*
    this.laststate = {
        hp  : this.players.self.pos,                //'host position', the game creators position
        cp  : this.players.other.pos,               //'client position', the person that joined, their position
        his : this.players.self.last_input_seq,     //'host input sequence', the last input we processed for the host
        cis : this.players.other.last_input_seq,    //'client input sequence', the last input we processed for the client
        t   : this.server_time                      // our current local time on the server
    };
    */

    let  server_state = {
        time: 0,
        paddles: {}
    };  // <- initialize an object, not an array
    
    
    if(typeof this.io !== 'undefined') {


        server_state.paddles[this.host_id] = this.paddles[this.host_id].pos;
        server_state.paddles[this.client_id] = this.paddles[this.client_id].pos;


        
        server_state.time = new Date().getTime().fixed(4);

        let state = JSON.stringify(server_state); // "{"a":"The letter A"}"
        this.io.to('game_room'+this.id).emit('serverupdate', server_state);
    }
}




Simulator.prototype.update = function(dt) {

    // do it, do it, do it four times
    let steps = 4;
    dt /= steps;

    const solvePaddle = (paddle) => {
        let acc = paddle.acceleration * paddle.direction;
    
        acc -= paddle.velocity.y * 10;
    
        paddle.velocity.y = paddle.velocity.y + acc * dt;
        let vel = paddle.velocity.y;
        paddle.pos.y = this.solvePosition(paddle.pos.y, vel, acc, dt).fixed(4);
        
        paddle = this.checkPaddleOOB(paddle, this.world);
        
        return paddle;
    }

    while(steps > 0) {
        this.paddles[this.host_id]   = solvePaddle(this.paddles[this.host_id]);
        this.paddles[this.client_id] = solvePaddle(this.paddles[this.client_id]);
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
