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
    this.host_id = player_id;
    this.client_id = -1;
    this.world = {
        width:  800,
        height: 600
    };
    this.paddles = [];

    this.debug_text = '';
    this.socket;
    this.io = io;

    if( 'undefined' != typeof global ) { 
        console.log('server sim created');
        this._intervalId = setInterval(this.mainLoop.bind(this), frame_time); 
        
        
    }
}

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
    module.exports = global.Simulator = Simulator;
}


var lastTime = 0;
var frame_time = 1000/60; // run the local game at 16ms/ 60hz



if('undefined' != typeof(global))  {
    //frame_time = 45; //on server we run at 45ms, 22hz

    Simulator.prototype.mainLoop = function() {

        let t = new Date().getTime();
        //Work out the delta time
        this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed(3) : 0.016;

        //Store the last frame time
        this.lastframetime = t;

        this.update(this.dt);
    };

 
   
} else {
    Simulator.prototype.mainLoop = function(t) {
        //Work out the delta time
        this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed(3) : 0.016;

        //Store the last frame time
        this.lastframetime = t;

        //Update the game specifics
        this.update(this.dt);
    

        //schedule the next update
        this.updateid = window.requestAnimationFrame( this.mainLoop.bind(this), this.viewport );

}; //game_core.update
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
    console.log('Sim: ' + this.id + ' started.');
    this.host_id = host_id;
    this.client_id = client_id;
    this.paddles[0] = this.getPaddle(host_id, {x:this.world.width/8, y:this.world.height/2});
    this.paddles[1] = this.getPaddle(client_id, {x:this.world.width - (this.world.width/8), y:this.world.height/2});
    if(typeof global !== 'undefined') {
    }
    else {
        window.requestAnimationFrame( this.mainLoop.bind(this), this.viewport );
        console.log('SIM STARTED CLIENT');
    }
};
Simulator.prototype.handleKeyPress = function(input) {
    if(this.paddles.length == 0) return;

    this.paddles = this.paddles.map((paddle) => {
        if( paddle.id == input.id) {
            switch(input.keyCode) {
                case 38: //UP_ARROW
                paddle.direction = -1;
                break;
                case 40: //DOWN_ARROW
                paddle.direction = 1;
            }
        }

        return paddle;
    });

    
};

Simulator.prototype.handleKeyReleased = function(input) {
    let factor = 0;
    if (input.keyCode == 38) {
        factor = 1;
    } else if (input.keyCode == 40) {
        factor = -1;
    }

    
    this.paddles = this.paddles.map((paddle) => {
        if(paddle.id === input.id) {
            let old_direction = paddle.direction;
            old_direction += factor;
            paddle.direction = old_direction;
        }
        return paddle;
    })

    
};

Simulator.prototype.update = function(dt) {
    this.paddles = this.paddles.map((paddle) => {
        let acc = paddle.acceleration * paddle.direction;

        acc -= paddle.velocity.y * 10;
 
        paddle.velocity.y = paddle.velocity.y + acc * dt;
        let vel = paddle.velocity.y;
        paddle.pos.y = this.solvePosition(paddle.pos.y, vel, acc, dt).fixed(3);
        
        
        return paddle;
    })
   
    if(typeof this.io !== 'undefined') {
        //this.io.emit('serverupdate', 'twinkle**');

        this.paddles.map((paddle)=> {
            let state = {id:paddle.id, pos:paddle.pos};
            this.io.to('game_room'+this.id).emit('serverupdate', state);
        })
        
    }
    
    
};

Simulator.prototype.solvePosition = (pos, vel, acc, dt) => {
    return pos + vel * dt + ((acc * (dt*dt)) / 2);
  }
