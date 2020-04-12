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
        x: 0.5,
        y: 0.5
      },
      immovable: true
    });
  }

  outOfBounds(){
    this.children.iterate((bullet=>{
      if(bullet.x > this.world.bounds.width || bullet.x < 0 || bullet.y > this.world.bounds.height || bullet.y < 0){
        this.killAndHide(bullet);
      }
    }))
  }
}
class Zombies extends Phaser.Physics.Arcade.Group {
  constructor(scene, enemyCount) {
    super(scene.physics.world, scene, {
      maxSize: enemyCount,
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

  enemySpawn(numEnemies) {
    // if (this.nextEnemyAt > this.game.time.now) return;
    // if (this.countDead() === 0) return;

    const [x,y] = this.getPosition();
    const enemy = this.get(x, y);
    if (!enemy) return;

    // console.log(enemy)

    enemy
    .setActive(true)
    .setVisible(true)
    .setScale(0.1,0.1)
    .play('zombiewalk');

    // reset enemies on x and y from pos array
    // if the score is less than needed reset enemy at position with 1 health
    // if (score <= this.enemyHealthIncrease) {
    //   enemy.reset(enemySpawnPosition[0], enemySpawnPosition[1], this.health);
    // }

    // if the score is higher or same as needed to `level up` then update the enemy health with +1 and reset level to score +10
    // if (score >= this.enemyHealthIncrease) {
    //   this.health ++;
    //   this.enemyHealthIncrease += ENEMY_HEALTH_INCREASE_AT_SCORE;
    //   enemy.reset(enemySpawnPosition[0], enemySpawnPosition[1], this.health);
    // }

    // this.nextEnemyAt = this.game.time.now + this.enemyDelay;
  }

  getPosition() {
    const w = this.world.bounds.width;
    const h = this.world.bounds.height;
    // array where zombies can spawn
    const pos = [
      [0, 0],
      [0, h],
      [w, 0],
      [w, h],
      [w / 2, 0],
      [w / 2, h],
      [w, h / 2]
    ];

    // take 1 array from pos array to use in reset
    const randomPos = pos[Math.floor(Math.random() * 7)];

    return randomPos;
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
    this.load.image(`bullet`, `assets/images/bullet.png`);
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
    this.socket = io();
    this.otherPlayers = this.physics.add.group();

    // create map
    this.createMap();

    // create player animations
    this.createAnimations();

    // user input
    this.cursors = this.input.keyboard.createCursorKeys();

    // create enemies
    this.createEnemies();

    // listen for web socket events
    this.socket.on('currentPlayers', (players) => {
      Object.keys(players).forEach((id) => {
        if (players[id].playerId === this.socket.id) {
          this.createPlayer(players[id]);
        } else {
          this.addOtherPlayers(players[id]);
        }
      });
    });

    this.socket.on('newPlayer', function (playerInfo) {
      this.addOtherPlayers(playerInfo);
    }.bind(this));

    this.socket.on('disconnect', function (playerId) {
      this.otherPlayers.getChildren().forEach(function (player) {
        if (playerId === player.playerId) {
          player.destroy();
        }
      }.bind(this));
    }.bind(this));

    this.socket.on('playerMoved', (playerInfo) => {
      this.otherPlayers.getChildren().forEach((player) => {
        if (playerInfo.playerId === player.playerId) {
          player.x=playerInfo.x;
          player.y=playerInfo.y;
          player.flipX = playerInfo.flipX;
        }
      });
    });
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

    // update camera
    this.updateCamera();

    // don't go out of the map
    this.container.body.setCollideWorldBounds(true);
  }

  addOtherPlayers(playerInfo) {
    const otherPlayer = this.add.sprite(playerInfo.x, playerInfo.y, 'player', 6);
    otherPlayer.setTint(Math.random() * 0x0f0f0f);
    otherPlayer.playerId = playerInfo.playerId;
    this.otherPlayers.add(otherPlayer);
  }

  updateCamera() {
    // don't walk on trees
    this.physics.add.collider(this.container, this.obstacles);

    // limit camera to map
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.startFollow(this.container);
    this.cameras.main.roundPixels = true; // avoid tile bleed
  }

  createBullets(){
    this.bullets = new Bullets(this);

    this.physics.add.collider(this.bullets, this.obstacles, (bullet)=>this.bullets.killAndHide(bullet))
    this.physics.add.collider(this.bullets, this.enemies, (bullet,enemy)=>{
      this.bullets.killAndHide(bullet);
      this.enemies.killAndHide(enemy);
    })
  }

  createEnemies() {
    /**
     * TODO: Create Zombie object on server and receive here.
     * When bullets collide with zombie, send to server that the zombie is dead.
     */
    this.enemies = new Zombies(this, 10);
    this.physics.add.collider(this.enemies, this.obstacles);
  }

  shoot(x, y, direction){
    let bullet = this.bullets.get(x,y);
    if (!bullet) return;

    bullet
    .setActive(true)
    .setVisible(true)
    .setScale(0.5,0.5);

    switch(direction){
      case 0:
        bullet.rotation = this.physics.moveTo(bullet, this.physics.world.bounds.width/2, 0, this.bulletSpeed);
      break
      case 1:
        bullet.rotation = this.physics.moveTo(bullet, this.physics.world.bounds.width, 0, this.bulletSpeed);
      break
      case 2:
        bullet.rotation = this.physics.moveTo(bullet, this.physics.world.bounds.width, this.physics.world.bounds.height/2, this.bulletSpeed);
      break
      case 3:
        bullet.rotation = this.physics.moveTo(bullet, this.physics.world.bounds.width, this.physics.world.bounds.height, this.bulletSpeed);
      break
      case 4:
        bullet.rotation = this.physics.moveTo(bullet, this.physics.world.bounds.width/2, this.physics.world.bounds.height, this.bulletSpeed);
      break
      case 5:
        bullet.rotation = this.physics.moveTo(bullet, 0, this.physics.world.bounds.height, this.bulletSpeed);
      break
      case 6:
        bullet.rotation = this.physics.moveTo(bullet, 0, this.physics.world.bounds.height/2, this.bulletSpeed);
      break
      case 7:
        bullet.rotation = this.physics.moveTo(bullet, 0, 0, this.bulletSpeed);
      break
    }
  }

  update() {
    if (this.container) {
      this.enemies.enemyFollow(this.container);
      this.bullets.outOfBounds();

      this.container.body.setVelocity(0);
      if(this.wasd.left.isDown){
        this.player.anims.play('left', true);
        this.player.flipX = true;
        if(this.wasd.up.isDown){
          this.container.body.setVelocityX(-this.speed);
          this.container.body.setVelocityY(-this.speed);
        }else if(this.wasd.down.isDown){
          this.container.body.setVelocityX(-this.speed);
          this.container.body.setVelocityY(this.speed);
        }else{
          this.container.body.setVelocityX(-this.speed);
        }
      }else if(this.wasd.right.isDown){
        this.player.anims.play('right', true);
        this.player.flipX = false;
        if(this.wasd.up.isDown){
          this.container.body.setVelocityX(this.speed);
          this.container.body.setVelocityY(-this.speed);
        }else if(this.wasd.down.isDown){
          this.container.body.setVelocityX(this.speed);
          this.container.body.setVelocityY(this.speed);
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
