let SHOT_DELAY = 500;

class Bullets extends Phaser.Physics.Arcade.Group {
  constructor(scene) {
    super(scene.physics.world, scene, {
      defaultKey: 'bullet',
      maxSize: 100,
      setXY: {
        x: 22,
        y: 50,
      },
      setScale: {
        x: 0.1,
        y: 0.1
      },
      immovable: true
    });
    this.scale_x = 0.1;
    this.scale_y = 0.1
  }

  outOfBounds(){
    this.children.iterate((bullet=>{
      if(bullet.x > this.world.bounds.width || bullet.x < 0 || bullet.y > this.world.bounds.height || bullet.y < 0){
        this.killAndHide(bullet);
      }
    }))
  }

  addFromOtherPlayers(bulletInfo){
    let bullet = this.get(bulletInfo.x, bulletInfo.y);
    if (!bullet) return;

    bullet
    .setActive(true)
    .setVisible(true)
    .setScale(this.scale_x, this.scale_y)
    .setVelocityX(bulletInfo.velocity.x)
    .setVelocityY(bulletInfo.velocity.y);
  }
}


class Zombies extends Phaser.Physics.Arcade.Group {
  constructor(scene, enemyCount) {
    super(scene.physics.world, scene, {
      maxSize: 100,
      defaultKey: `enemy`,
      immovable: true,
      setScale: {
        x: 0.1, y: 0.1
      }
      });
  }

  enemyFollow(player) {
    this.getChildren().forEach(enemy => {
      if (enemy.active) {
        // enemy moves to the player
        enemy.anims.play('zombiewalk', true);
        // enemy rotates to the player
        enemy.rotation = this.scene.physics.moveToObject(enemy, player);
      }
    });
  }

  enemySpawn(x, y) {
    // const [x,y] = this.getPosition();
    const enemy = this.get(x, y);
    if (!enemy) return;

    enemy
    .setActive(true)
    .setVisible(true)
    // .setScale(0.1,0.1)
    .setSize(150,150)
    .setDisplaySize(24,24)
    .play('zombiewalk');
  }

  killAll() {
    this.children.iterate((enemy=>this.killAndHide(enemy)));
  }
}


class BootScene extends Phaser.Scene {
  constructor() {
    super({
      key: 'BootScene',
      active: true
    });
  }

  preload() {
    // map tiles
    this.load.image('tiles', 'assets/map/spritesheet-extruded.png');
    // map in json format
    this.load.tilemapTiledJSON('map', 'assets/map/map.json');
    // our two characters
    this.load.spritesheet('player', 'assets/RPG_assets.png', {
      frameWidth: 16,
      frameHeight: 16
    });
    // Load zombie
    this.load.spritesheet(`enemy`, `assets/images/zombie_move.png`, {
      frameWidth: 288,
      frameHeight: 311
    });
    // Bullet image
    this.load.image(`bullet`, `assets/images/ball.png`);
  }

  create() {
    this.scene.start('WorldScene');
  }
}

class WorldScene extends Phaser.Scene {
  constructor() {
    super({
      key: 'WorldScene'
    });
  }

  create() {
    this.speed = 80;
    this.diagSpeed = Math.cos(Math.PI/4)*this.speed;
    this.bulletSpeed = 130;
    this.killedEnemies = 0;
    this.isGameover = false;
    this.highscore = 0;
    this.socket = io();
    this.otherPlayers = this.physics.add.group({
      immovable: true,
      collideWorldBounds: true
    });

    // create map
    this.createMap();

    // Add text info
    this.captionTextFormat = (
        '# Enemies:  %1\n' +
        '# Killed:   %2\n' +
        '# Players:  %3\n' +
        'Highscore:  %4'
    );

    this.info = this.add.text(16, 16, '', {
      fill: '#7fdbff',
      fontFamily: 'monospace',
      lineSpacing: 4,
      // fontSize: 8
    });
    this.info.setScale(0.75);
    // this.info.setDisplaySize(100,100);
    // this.info.setSize(100,100);

    this.gameoverText = this.add.text(16, 16, 'GAME OVER', {
      fill: '#800000',
      fontFamily: 'monospace',
      lineSpacing: 4,
      fontSize: 32
    });
    this.gameoverText.setVisible(false);

    this.countdownValue = 3;
    this.countdownText = this.add.text(16, 16, '', {
      fill: '#800000',
      fontFamily: 'monospace',
      lineSpacing: 4,
      fontSize: 32
    });
    this.countdownText.setVisible(false);


    // create player animations
    this.createAnimations();

    // user input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard.addKey('W'),
      down: this.input.keyboard.addKey('S'),
      left: this.input.keyboard.addKey('A'),
      right: this.input.keyboard.addKey('D'),
    };

    // listen for web socket events
    this.socket.on('currentPlayers', (players) => {
      Object.keys(players).forEach((id) => {
        if (players[id].playerId === this.socket.id) {
          this.createPlayer(players[id]);

          // create enemies
          this.createEnemies();

          // Set up bullets group
          this.createBullets();
        } else {
          this.addOtherPlayers(players[id]);
        }
      });
    });

    this.socket.on('newPlayer', (playerInfo) => {
      this.addOtherPlayers(playerInfo);
    });

    this.socket.on('disconnect', (playerId) => {
      this.otherPlayers.getChildren().forEach((player) => {
        if (playerId === player.playerId) {
          player.destroy();
        }
      });
    });

    this.socket.on('playerMoved', (playerInfo) => {
      this.otherPlayers.getChildren().forEach((player) => {
        if (playerInfo.playerId === player.playerId) {
          if(playerInfo.x>player.x){
            player.anims.play('otherPlayerRight', true);
          }else if(playerInfo.x<player.x){
            player.anims.play('otherPlayerLeft', true);
          }else if (playerInfo.y<player.y){
            player.anims.play('otherPlayerUp', true);
          }else if (playerInfo.y>player.y){
            player.anims.play('otherPlayerDown', true);
          }
          player.x=playerInfo.x;
          player.y=playerInfo.y;
          player.flipX = playerInfo.flipX;
        }
      });
    });

    this.socket.on('bulletShot', (bullet) => {
      if(this.bullets && bullet.playerId !== this.socket.id){
        this.bullets.addFromOtherPlayers(bullet.bulletInfo);
      }
    });

    this.socket.on('enemies', (enemies) => {
      console.log(enemies.length, "new enemies spawned");
      enemies.forEach((enemy, i)=>{
        // if (i>=this.enemies.getLength()){
        this.enemies.enemySpawn(enemy.x, enemy.y);
        // }
      })
    });

    this.socket.emit('setup');
  }

  createMap() {
    // create the map
    this.map = this.make.tilemap({
      key: 'map'
    });

    // first parameter is the name of the tilemap in tiled
    var tiles = this.map.addTilesetImage('spritesheet', 'tiles', 16, 16, 1, 2);

    // creating the layers
    this.map.createStaticLayer('Grass', tiles, 0, 0);
    this.obstacles = this.map.createStaticLayer('Obstacles', tiles, 0, 0);

    // make all tiles in obstacles collidable
    this.obstacles.setCollisionByExclusion([-1]);

    // don't go out of the map
    this.physics.world.bounds.width = this.map.widthInPixels;
    this.physics.world.bounds.height = this.map.heightInPixels;
  }

  createAnimations() {
    //  animation with key 'left', we don't need left and right as we will use one and flip the sprite
    this.anims.create({
      key: 'left',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [4, 10, 4, 16]
      }),
      frameRate: 10,
      repeat: -1
    });

    // animation with key 'right'
    this.anims.create({
      key: 'right',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [4, 10, 4, 16]
      }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'up',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [5, 11, 5, 17]
      }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'down',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [3, 9, 3, 15]
      }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'otherPlayerLeft',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [1, 7, 1, 13]
      }),
      frameRate: 10,
      repeat: -1
    });

    // animation with key 'right'
    this.anims.create({
      key: 'otherPlayerRight',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [1, 7, 1, 13]
      }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'otherPlayerUp',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [2, 8, 2, 14]
      }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'otherPlayerDown',
      frames: this.anims.generateFrameNumbers('player', {
        frames: [0, 6, 0, 12]
      }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'zombiewalk',
      frames: this.anims.generateFrameNumbers('enemy', {
        start: 0,
        end: 17
      }),
      frameRate: 10,
      repeat: -1
    });
  }

  createPlayer(playerInfo) {
    // our player sprite created through the physics system
    this.player = this.add.sprite(0, 0, 'player', 9);

    this.container = this.add.container(playerInfo.x, playerInfo.y);
    this.container.setSize(16, 16);
    this.physics.world.enable(this.container);
    this.container.add(this.player);
    this.container.body.immovable = true;

    // update camera
    this.updateCamera();

    // don't go out of the map
    this.container.body.setCollideWorldBounds(true);
  }

  addOtherPlayers(playerInfo) {
    const otherPlayer = this.add.sprite(playerInfo.x, playerInfo.y, 'player', 6);
    // otherPlayer.setTint(Math.random() * 0x0f0f0f);
    otherPlayer.playerId = playerInfo.playerId;
    this.otherPlayers.add(otherPlayer);
  }

  updateCamera() {
    // don't walk on trees
    this.physics.add.collider(this.container, this.obstacles);

    // don't walk over other players
    this.physics.add.collider(this.container, this.otherPlayers);

    // limit camera to map
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.startFollow(this.container);
    this.cameras.main.roundPixels = true; // avoid tile bleed
  }

  createBullets(){
    this.bullets = new Bullets(this);
    this.nextShotAt = 0;

    this.physics.add.collider(this.bullets, this.obstacles, (bullet)=>this.bullets.killAndHide(bullet))
    this.physics.add.collider(this.bullets, this.enemies, (bullet,enemy)=>{
      if(bullet.active && enemy.active){
        this.enemies.killAndHide(enemy);
        this.bullets.killAndHide(bullet);
        this.socket.emit('enemyKilled');
        this.killedEnemies++;
      }
    })
  }

  createEnemies() {
    this.enemies = new Zombies(this, 10);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.enemies, this.container, (enemy, player)=>{
      if(enemy.active && !this.isGameover && player.active){
        console.log("Player DEAD!");
        this.isGameover = true;
        this.killedEnemies = 0;
        this.countdownToRestart = this.time.addEvent({
          delay: 1000,
          callback: ()=>{
            this.countdownText.setText(this.countdownValue);
            this.countdownValue--;
            this.countdownText.setVisible(true);
          },
          loop: true,
          callbackScope: this
        });
        this.resetEvent = this.time.addEvent({
          delay: 4000,
          callback: ()=>{
            this.enemies.killAll();
            this.socket.emit('setup');
            this.isGameover = false;
            this.resetEvent.remove(false);
            this.countdownToRestart.remove(false);
            this.countdownValue = 3;
          },
          callbackScope: this
        });

      }
      return true;
    });
    // this.physics.add.collider(this.enemies, this.enemies); // Not sure how to make the enemies split from overlapping
  }

  shoot(x, y, direction){
    if (this.nextShotAt > this.time.now) return;
    this.nextShotAt = this.time.now + SHOT_DELAY;

    let bullet = this.bullets.get(x,y);
    if (!bullet) return;

    bullet
    .setActive(true)
    .setVisible(true)
    .setScale(this.bullets.scale_x,this.bullets.scale_y)
    .setVelocity(0);

    switch(direction){
      case 0:
        bullet.setVelocityY(-this.bulletSpeed);
        bullet.rotation = -Math.PI/2
      break
      case 1:
        bullet.setVelocityX(this.bulletSpeed);
        bullet.setVelocityY(-this.bulletSpeed);
      break
      case 2:
        bullet.setVelocityX(this.bulletSpeed);
      break
      case 3:
        bullet.setVelocityX(this.bulletSpeed);
        bullet.setVelocityY(this.bulletSpeed);
      break
      case 4:
        bullet.setVelocityY(this.bulletSpeed);
      break
      case 5:
        bullet.setVelocityY(this.bulletSpeed);
        bullet.setVelocityX(-this.bulletSpeed);
      break
      case 6:
        bullet.setVelocityX(-this.bulletSpeed);
      break
      case 7:
        bullet.setVelocityX(-this.bulletSpeed);
        bullet.setVelocityY(-this.bulletSpeed);
      break
    }

    this.socket.emit('bulletShot', {
      x: bullet.x,
      y: bullet.y,
      velocity: bullet.body.velocity,
    });
  }

  update() {
    if (this.container) {
      this.enemies.enemyFollow(this.container);
      this.bullets.outOfBounds();

      this.container.body.setVelocity(0);
      if(!this.isGameover){
        if(this.wasd.left.isDown){
          this.player.anims.play('left', true);
          this.player.flipX = true;
          if(this.wasd.up.isDown){
            this.container.body.setVelocityX(-this.diagSpeed);
            this.container.body.setVelocityY(-this.diagSpeed);
          }else if(this.wasd.down.isDown){
            this.container.body.setVelocityX(-this.diagSpeed);
            this.container.body.setVelocityY(this.diagSpeed);
          }else{
            this.container.body.setVelocityX(-this.speed);
          }
        }else if(this.wasd.right.isDown){
          this.player.anims.play('right', true);
          this.player.flipX = false;
          if(this.wasd.up.isDown){
            this.container.body.setVelocityX(this.diagSpeed);
            this.container.body.setVelocityY(-this.diagSpeed);
          }else if(this.wasd.down.isDown){
            this.container.body.setVelocityX(this.diagSpeed);
            this.container.body.setVelocityY(this.diagSpeed);
          }else{
            this.container.body.setVelocityX(this.speed);
          }
        }else{
          if(this.wasd.up.isDown){
            this.player.anims.play('up', true);
            this.container.body.setVelocityY(-this.speed);
          }else if(this.wasd.down.isDown){
            this.player.anims.play('down', true);
            this.container.body.setVelocityY(this.speed);
          }else{
            this.player.anims.stop();
          }
        }
      }

      if(this.cursors.left.isDown){
        if(this.cursors.up.isDown){
          let bulletDir = 7;
          this.shoot(this.container.x, this.container.y, bulletDir);
        }else if(this.cursors.down.isDown){
          let bulletDir = 5;
          this.shoot(this.container.x, this.container.y, bulletDir);
        }else{
          let bulletDir = 6;
          this.shoot(this.container.x, this.container.y, bulletDir);
        }
      }else if(this.cursors.right.isDown){
        if(this.cursors.up.isDown){
          let bulletDir = 1;
          this.shoot(this.container.x, this.container.y, bulletDir);
        }else if(this.cursors.down.isDown){
          let bulletDir = 3;
          this.shoot(this.container.x, this.container.y, bulletDir);
        }else{
          let bulletDir = 2;
          this.shoot(this.container.x, this.container.y, bulletDir);
        }
      }else{
        if(this.cursors.up.isDown){
          let bulletDir = 0;
          this.shoot(this.container.x, this.container.y, bulletDir);
        }else if(this.cursors.down.isDown){
          let bulletDir = 4;
          this.shoot(this.container.x, this.container.y, bulletDir);
        }else{
        }
      }


      if (this.wasd.left.isDown  ||
          this.wasd.right.isDown ||
          this.wasd.up.isDown    ||
          this.wasd.down.isDown){
        this.socket.emit('playerMovement', {
          x: this.container.x,
          y: this.container.y,
          flipX: this.player.flipX
        });
      }

      this.info.x = Math.max(this.container.x-140,16);
      this.info.y = Math.max(this.container.y-100,16);
      this.highscore = Math.max(this.highscore, this.killedEnemies);
      this.info.setText(Phaser.Utils.String.Format(this.captionTextFormat, [
        this.enemies.countActive(),
        this.killedEnemies,
        this.otherPlayers.countActive()+1,
        this.highscore
      ]));

      if (this.isGameover){
        this.gameoverText.x = this.container.x-this.gameoverText.width/2;
        this.gameoverText.y = this.container.y-this.gameoverText.height/2;
        this.gameoverText.setVisible(true);

        this.countdownText.x = this.container.x-this.countdownText.width/2;
        this.countdownText.y = this.container.y+this.gameoverText.height/2+20;
        this.countdownText.setVisible(true);
      } else{
        this.gameoverText.setVisible(false);
        this.countdownText.setVisible(false);
        this.countdownText.setText("");
      }
    }
  }
}

var config = {
  type: Phaser.AUTO,
  parent: 'content',
  width: 320,
  height: 240,
  zoom: 3,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: {
        y: 0
      },
      debug: true // set to true to view zones
    }
  },
  scene: [
    BootScene,
    WorldScene
  ]
};
var game = new Phaser.Game(config);
