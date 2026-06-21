// Phaser 4 scene for "Phage Defense". Imported only by PhaserGame, which is itself lazy() —
// so Phaser (~500KB) is code-split onto the single /games/phage-defense route. Primitives only
// (no uploaded sprites required); when art is added it loads from /games/assets/* (GAME_ASSETS).
import Phaser from "phaser";

export function createPhageDefense(
  parent: HTMLElement,
  onGameOver: (score: number) => void,
): Phaser.Game {
  class MainScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Rectangle;
    private bacteria: Phaser.GameObjects.Arc[] = [];
    private phages: Phaser.GameObjects.Rectangle[] = [];
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;
    private keySpace!: Phaser.Input.Keyboard.Key;
    private scoreText!: Phaser.GameObjects.Text;
    private spawnEvent!: Phaser.Time.TimerEvent;
    private score = 0;
    private over = false;

    constructor() {
      super("main");
    }

    create() {
      this.player = this.add.rectangle(400, 560, 64, 16, 0x22d3ee);
      const kb = this.input.keyboard!;
      this.cursors = kb.createCursorKeys();
      this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.scoreText = this.add.text(14, 12, "0", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#edeaf5",
      });
      this.add.rectangle(400, 596, 800, 8, 0x4f2d7f);
      this.spawnEvent = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => this.spawnBacterium(),
      });
      this.input.on("pointerdown", () => this.shoot());
    }

    private spawnBacterium() {
      const x = Phaser.Math.Between(20, 780);
      this.bacteria.push(this.add.circle(x, -12, 14, 0x4f2d7f));
    }

    private shoot() {
      if (this.over) return;
      this.phages.push(this.add.rectangle(this.player.x, 545, 5, 16, 0x22d3ee));
    }

    private gameOver() {
      this.over = true;
      this.spawnEvent.remove();
      this.add
        .text(400, 300, "Game Over", {
          fontFamily: "monospace",
          fontSize: "40px",
          color: "#edeaf5",
        })
        .setOrigin(0.5);
      onGameOver(this.score);
    }

    update(_time: number, deltaMs: number) {
      if (this.over) return;
      const dt = deltaMs / 1000;
      const speed = 380;
      if (this.cursors.left.isDown || this.keyA.isDown) this.player.x -= speed * dt;
      if (this.cursors.right.isDown || this.keyD.isDown) this.player.x += speed * dt;
      this.player.x = Phaser.Math.Clamp(this.player.x, 34, 766);
      if (Phaser.Input.Keyboard.JustDown(this.keySpace)) this.shoot();

      for (const p of this.phages) p.y -= 520 * dt;
      for (const b of this.bacteria) b.y += (80 + this.score * 2) * dt;

      for (const b of this.bacteria) {
        if (!b.active) continue;
        for (const p of this.phages) {
          if (!p.active) continue;
          if (Math.abs(p.x - b.x) < 18 && Math.abs(p.y - b.y) < 18) {
            b.destroy();
            p.destroy();
            this.score++;
            this.scoreText.setText(String(this.score));
            break;
          }
        }
        if (b.active && b.y > 590) {
          this.gameOver();
          return;
        }
      }
      this.bacteria = this.bacteria.filter((b) => b.active);
      this.phages = this.phages.filter((p) => p.active && p.y > -20);
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 600,
    backgroundColor: "#120b1f",
    scene: MainScene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
}
