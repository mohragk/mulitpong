
class Animator {
    constructor(actor, startPos, endPos, duration) {
      this.actor = actor;
      this.startPos = startPos;
      this.endPos = endPos;
      this.duration = duration;
      this.state = 'idle';
      this.timer = 0;
      this.interval = new Interval(this.update, 300);
    }
    
    start() {
      if(this.state == 'idle') {
        this.state = 'animating';
        this.actor.pos.x = this.startPos.x;
        this.actor.pos.y = this.startPos.y;
        this.timer = 0;

        if (this.interval.isRunning() != false) this.interval.start();
      }
    }
    
    resetPoints(start, end) {
      if(this.state == 'idle') {
        this.startPos = start;
        this.endPos = end;
      }
    }
    
    cancel() {
      this.state = 'idle';
      this.timer = 0;
      this.actor.pos.x = this.startPos.x;
      this.actor.pos.y = this.startPos.y;
    }

    skip() {
        this.timer = this.duration;
      this.actor.pos.x = this.endPos.x;
      this.actor.pos.y = this.endPos.y;
      console.log('skipping')
    }
    
    revert() {
      let temp_x = this.startPos.x;
      let temp_y = this.startPos.y;
      this.startPos.x = this.endPos.x;
      this.startPos.y = this.endPos.y;
      this.endPos.x = temp_x;
      this.endPos.y = temp_y;
      
      this.timer = this.duration - this.timer;
      
      
    }
    
    update(dt) {
        if ( this.timer > this.duration ) {
            this.state = 'idle';
            this.interval.stop();
        }
      if (this.state === 'animating') {
        let dt = (60/1000) / 4;
        let mu = this.timer / this.duration;
        let new_x = f_lerp(this.startPos.x, this.endPos.x, mu);
        let new_y = f_lerp(this.startPos.y, this.endPos.y, mu);;
          
        this.actor.pos.x = new_x;
        this.actor.pos.y = new_y;
        
        this.timer += dt;
        
      } 
    }  
  } // class Animate

